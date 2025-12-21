import { Router, Request, Response } from 'express';
import twilio from 'twilio';
import { generateAIResponse } from '../openai';
import { db } from '../db';
import { wrapTenantDb } from '../tenantDb';
import { conversations, messages as messagesTable } from '@shared/schema';
import { eq, asc } from 'drizzle-orm';
import { shouldRouteToLegacyCleanMachine, forwardToLegacyCleanMachine } from '../services/smsRouter';
import { inferLanguageFromText, SupportedLanguage } from '../utils/translator';
import { isDuplicateInboundSms, recordProcessedInboundSms } from '../services/smsInboundDedup';
import { 
  extractSmsBookingStateFromHistory, 
  detectSlotSelection, 
  getSmsBookingState,
  updateSmsBookingState,
  getSmsBookingStateSummary,
  shouldResetBookingState,
  createResetBookingState,
  getSessionContextWindowStart,
  detectUpsellResponse,
  detectEmailAddress,
  detectSkipEmail,
  type SmsBookingState
} from '../services/bookingDraftService';
import { buildSmsLlmContext } from '../services/smsConversationContextService';
import { handleBook } from '../calendarApi';
import { truncateSmsResponse } from '../utils/smsLength';
import { parseAvailabilityHorizonDays, buildAvailabilitySms, type AvailabilitySlot } from '../services/smsSlotPresentationService';
import { getCompactSlotsSms } from '../services/slotOfferSummary';
import { getTenantTimeZone, formatLocalDateTime } from '../utils/timeFormat';
import { formatApptLocal } from '../utils/formatLocalTime';

export const twilioTestSmsRouter = Router();

const MessagingResponse = twilio.twiml.MessagingResponse;

async function getOrCreateTestConversation(tenantDb: any, phone: string) {
  let conversation = await tenantDb.query.conversations.findFirst({
    where: tenantDb.withTenantFilter(conversations, eq(conversations.customerPhone, phone)),
  });
  
  if (!conversation) {
    const [created] = await tenantDb
      .insert(conversations)
      .values({
        customerPhone: phone,
        platform: 'sms',
        status: 'active',
        controlMode: 'auto',
      })
      .returning();
    conversation = created;
    console.log('[TWILIO TEST SMS] Created new conversation for', phone);
  }
  
  return conversation;
}

async function updateConversationLanguage(tenantDb: any, conversationId: number, language: SupportedLanguage) {
  try {
    await tenantDb
      .update(conversations)
      .set({ customerLanguage: language })
      .where(eq(conversations.id, conversationId));
    console.log(`[TWILIO TEST SMS] Updated conversation ${conversationId} language to ${language}`);
  } catch (error) {
    console.error('[TWILIO TEST SMS] Error updating conversation language:', error);
  }
}

async function getConversationHistory(tenantDb: any, conversationId: number) {
  const msgs = await tenantDb
    .select()
    .from(messagesTable)
    .where(tenantDb.withTenantFilter(messagesTable, eq(messagesTable.conversationId, conversationId)))
    .orderBy(asc(messagesTable.timestamp))
    .limit(15);
  
  return msgs.map((msg: typeof messagesTable.$inferSelect) => ({
    content: msg.content,
    role: msg.sender === 'customer' ? 'user' as const : 'assistant' as const,
    sender: msg.sender,
    metadata: msg.metadata as Record<string, any> | null
  }));
}

async function addMessage(tenantDb: any, conversationId: number, content: string, sender: string) {
  const now = new Date();
  
  // Insert the message
  await tenantDb
    .insert(messagesTable)
    .values({
      conversationId,
      content,
      sender,
      fromCustomer: sender === 'customer',
      platform: 'sms',
      timestamp: now,
    });
  
  // Update conversation's last_message_time so it appears in the messages list
  await tenantDb
    .update(conversations)
    .set({ lastMessageTime: now })
    .where(eq(conversations.id, conversationId));
}

async function handleServiceProInboundSms(req: Request, res: Response, dedupeMessageSid?: string) {
  const twimlResponse = new MessagingResponse();
  
  try {
    const { Body, From, To, MessageSid, NumMedia } = req.body || {};
    const messageSid = dedupeMessageSid || MessageSid;
    
    // Record this MessageSid as processed (idempotent, safe to call)
    if (messageSid) {
      void recordProcessedInboundSms(messageSid, From, To, 'root');
    }
    
    console.log("[TWILIO SMS INBOUND] Parsed fields:", {
      From: (req.body as any)?.From,
      To: (req.body as any)?.To,
      Body: (req.body as any)?.Body,
    });
    
    // P0-HOTFIX: Ignore iMessage reaction messages (Loved, Liked, Emphasized, etc.)
    // These are not real customer messages and should not trigger AI or booking flows
    const iMessageReactionPattern = /^(Loved|Liked|Emphasized|Laughed at|Disliked|Questioned)\s+".*"/i;
    if (Body && iMessageReactionPattern.test(Body.trim())) {
      console.log(`[SMS_REACTION_IGNORED] phone=${From} sid=${MessageSid} body="${Body.substring(0, 50)}"`);
      res.status(204).send();
      return;
    }
    
    if (!Body || !From) {
      console.warn('[TWILIO SMS INBOUND] Missing Body or From');
      twimlResponse.message("Sorry, I couldn't process your message. Please try again.");
      res.type('text/xml').send(twimlResponse.toString());
      return;
    }
    
    const tenantId = 'root';
    const tenantDb = wrapTenantDb(db, tenantId);
    
    // CRITICAL: Check STOP/START keywords BEFORE any conversation creation or AI routing
    // This is required for TCPA/CTIA compliance
    const { handleSmsConsentKeywords } = await import('../services/smsConsentKeywords');
    const consentResult = await handleSmsConsentKeywords({
      tenantId,
      fromPhone: From,
      body: Body,
      tenantDb,
    });
    
    if (consentResult.handled) {
      console.log(`[TWILIO SMS INBOUND] Consent keyword handled: ${consentResult.keyword} action=${consentResult.action}`);
      res.type('text/xml').send(consentResult.twiml);
      return;
    }
    
    // CM-Billing-Prep: Record inbound SMS usage
    try {
      const { recordSmsInbound, recordMmsInbound } = await import('../usage/usageRecorder');
      const hasMms = NumMedia && parseInt(NumMedia, 10) > 0;
      if (hasMms) {
        void recordMmsInbound(tenantId, { messageSid: MessageSid, from: From, to: To, numMedia: NumMedia });
      } else {
        void recordSmsInbound(tenantId, { messageSid: MessageSid, from: From, to: To });
      }
    } catch (usageError) {
      console.error('[USAGE] Failed to record SMS inbound:', usageError);
    }
    
    const conversation = await getOrCreateTestConversation(tenantDb, From);
    
    // Add customer message
    await addMessage(tenantDb, conversation.id, Body, 'customer');
    
    // SP-22: Detect customer language from message
    let customerLanguage: SupportedLanguage = conversation.customerLanguage || 'en';
    if (!conversation.customerLanguage || conversation.customerLanguage === 'unknown') {
      const detectedLang = await inferLanguageFromText(Body);
      if (detectedLang !== 'unknown') {
        customerLanguage = detectedLang;
        await updateConversationLanguage(tenantDb, conversation.id, customerLanguage);
        console.log(`[TWILIO TEST SMS] Detected customer language: ${customerLanguage}`);
      }
    } else {
      customerLanguage = conversation.customerLanguage as SupportedLanguage;
    }
    
    // === BOOKING DRAFT STATE - Prevent "looping/forgetting" ===
    // 1. Load persisted SMS booking state from database
    let persistedState = await getSmsBookingState(tenantDb, conversation.id);
    
    // Parse availability horizon expansion from customer message
    const parsedHorizonDays = parseAvailabilityHorizonDays(Body);
    if (parsedHorizonDays !== null) {
      const clampedDays = Math.max(7, Math.min(parsedHorizonDays, 90));
      persistedState.horizonDays = clampedDays;
      console.log(`[SLOT OFFER] Horizon expanded to ${clampedDays} days (parsed from message)`);
    }
    
    // Get session context window start BEFORE building context
    const sessionStartedAt = getSessionContextWindowStart(persistedState);
    
    // === Build SMS LLM context with canonical context builder ===
    const smsContext = await buildSmsLlmContext({
      tenantId,
      conversationId: conversation.id,
      fromPhone: From,
      toPhone: To,
      tenantDb,
      behaviorSettings: conversation.behaviorSettings as Record<string, any>,
      sessionStartedAt, // Filter to current booking session
    });
    
    // Use formatted messages from context builder
    let conversationHistory = smsContext.recentMessages;
    
    // 2. Check if we need to reset state (new booking or service changed)
    const resetCheck = shouldResetBookingState(Body, persistedState, From);
    if (resetCheck.shouldReset) {
      console.log(`[SMS STATE] reset=true reason=${resetCheck.reason} prev_service=${persistedState.service || 'none'} new_service=${resetCheck.newService || 'none'}`);
      // Let createResetBookingState decide what to preserve (address is auto-preserved if recently verified)
      const newState = createResetBookingState(
        resetCheck.reason || 'unknown',
        undefined, // Let the function decide based on verification metadata
        resetCheck.newService,
        From,
        persistedState
      );
      await updateSmsBookingState(tenantDb, conversation.id, newState);
      persistedState = newState;
      
      // Rebuild context with new session window - CRITICAL for preventing stale messages
      const newSessionStart = getSessionContextWindowStart(newState);
      const rebuildContext = await buildSmsLlmContext({
        tenantId,
        conversationId: conversation.id,
        fromPhone: From,
        toPhone: To,
        tenantDb,
        behaviorSettings: conversation.behaviorSettings as Record<string, any>,
        sessionStartedAt: newSessionStart,
      });
      // CRITICAL: Use rebuilt context for this session - NOT stale context
      conversationHistory = rebuildContext.recentMessages;
      console.log(`[SMS CONTEXT] Rebuilt after state reset: loaded=${conversationHistory.length} messages`);
    }
    
    // 3. Extract fresh state from conversation history and merge with persisted
    const historyState = extractSmsBookingStateFromHistory(conversationHistory);
    const smsBookingState: SmsBookingState = {
      ...historyState,
      ...persistedState, // Persisted state takes precedence (has chosenSlotLabel etc.)
      // But use fresh lastOfferedSlots from history if available
      lastOfferedSlots: historyState.lastOfferedSlots || persistedState.lastOfferedSlots,
    };
    
    // Log draft state for debugging
    console.log('[SMS DRAFT] State:', getSmsBookingStateSummary(smsBookingState));
    
    // === CONFIRM / RESCHEDULE COMMAND HANDLING (before LLM) ===
    const confirmMatch = /^confirm\b/i.test(Body.trim());
    const rescheduleMatch = /^(reschedule|change)\b/i.test(Body.trim());
    
    // P0-HOTFIX: Correlation ID for booking confirmation tracking
    const correlationId = `${From}|${MessageSid}|conv${conversation.id}`;
    
    if (confirmMatch) {
      console.log(`[BOOKING_CONFIRM_RECEIVED] correlationId=${correlationId} body="${Body.trim()}"`);
      
      const { findUpcomingUnconfirmedBooking, confirmBooking } = await import('../services/smsBookingRecordService');
      
      // FAIL-OPEN: If booking record lookup fails (e.g., table missing), proceed gracefully
      let upcomingBooking = null;
      let bookingLookupFailed = false;
      try {
        upcomingBooking = await findUpcomingUnconfirmedBooking(tenantId, From);
      } catch (lookupErr: any) {
        bookingLookupFailed = true;
        console.error(`[BOOKING_CONFIRM_LOOKUP_FAILED] correlationId=${correlationId} err=${lookupErr?.message} code=${lookupErr?.code}`);
        // If table doesn't exist (42P01) or other DB error, continue with fail-open path
      }
      
      if (upcomingBooking) {
        try {
          await confirmBooking(tenantId, upcomingBooking.id);
          const { formatInTimeZone } = await import('date-fns-tz');
          const bookingDay = formatInTimeZone(new Date(upcomingBooking.startTime), 'America/Chicago', 'EEEE MMM d');
          const bookingTime = formatInTimeZone(new Date(upcomingBooking.startTime), 'America/Chicago', 'h:mm a');
          const confirmReply = truncateSmsResponse(`Confirmed! See you ${bookingDay} at ${bookingTime}. Reply CHANGE if you need to reschedule.`);
          await addMessage(tenantDb, conversation.id, confirmReply, 'ai');
          twimlResponse.message(confirmReply);
          console.log(`[BOOKING_CONFIRM_SUCCESS] correlationId=${correlationId} bookingId=${upcomingBooking.id} calendarEventId=${upcomingBooking.eventId}`);
          res.type('text/xml').send(twimlResponse.toString());
          return;
        } catch (confirmErr: any) {
          console.error(`[BOOKING_CONFIRM_FAILED] correlationId=${correlationId} err=${confirmErr?.message} stack=${confirmErr?.stack}`);
          
          // P0-HOTFIX: Escalate to owner on confirm failure
          let escalationFailed = false;
          try {
            const ownerPhone = process.env.BUSINESS_OWNER_PERSONAL_PHONE;
            if (ownerPhone) {
              const twilioClient = (await import('twilio')).default(
                process.env.TWILIO_ACCOUNT_SID,
                process.env.TWILIO_AUTH_TOKEN
              );
              const escalationMsg = `🚨 CONFIRM FAILED:\nCustomer: ${From}\nBooking ID: ${upcomingBooking.id}\nEventId: ${upcomingBooking.eventId}\nError: ${confirmErr?.message || 'Unknown'}`;
              await twilioClient.messages.create({
                to: ownerPhone,
                from: To,
                body: escalationMsg,
              });
              console.log(`[ESCALATION_SENT] correlationId=${correlationId} reason=confirm_failed`);
            }
          } catch (escErr) {
            console.error(`[ESCALATION_FAILED] correlationId=${correlationId}`, escErr);
            escalationFailed = true;
          }
          
          // Mark conversation as needing human follow-up (whether escalation succeeded or not)
          try {
            await tenantDb.update(conversations).set({ 
              needsHumanAttention: true,
              needsHumanReason: escalationFailed 
                ? 'Confirm failed + escalation SMS failed' 
                : 'Confirm failed - owner notified'
            }).where(eq(conversations.id, conversation.id));
            console.log(`[BOOKING HANDOFF] conversation=${conversation.id} needsHumanAttention=true reason=confirm_failed escalation_failed=${escalationFailed}`);
          } catch (handoffErr) {
            console.error(`[BOOKING HANDOFF] failed to set needsHumanAttention:`, handoffErr);
          }
          
          const errorReply = truncateSmsResponse("I'm having trouble confirming right now—someone will follow up shortly to confirm your appointment.");
          await addMessage(tenantDb, conversation.id, errorReply, 'ai');
          twimlResponse.message(errorReply);
          res.type('text/xml').send(twimlResponse.toString());
          return;
        }
      } else {
        // FAIL-OPEN: If lookup failed due to DB error, give positive confirmation to customer
        // and flag for human review (customer likely has a booking, we just can't look it up)
        const failReason = bookingLookupFailed ? 'booking_lookup_db_error' : 'no_upcoming_booking_found';
        console.log(`[BOOKING_CONFIRM_FAILOPEN] correlationId=${correlationId} reason=${failReason}`);
        
        // CRITICAL: If DB lookup failed, give customer a positive confirmation message
        // The booking likely exists in Google Calendar even if our records table is missing
        if (bookingLookupFailed) {
          const failOpenReply = truncateSmsResponse("Got it! Your appointment is confirmed. We'll see you soon!");
          await addMessage(tenantDb, conversation.id, failOpenReply, 'ai');
          twimlResponse.message(failOpenReply);
          
          // Background: notify owner about the DB issue (non-blocking)
          try {
            const ownerPhone = process.env.BUSINESS_OWNER_PERSONAL_PHONE;
            if (ownerPhone) {
              const twilioClient = (await import('twilio')).default(
                process.env.TWILIO_ACCOUNT_SID,
                process.env.TWILIO_AUTH_TOKEN
              );
              await twilioClient.messages.create({
                to: ownerPhone,
                from: To,
                body: `⚠️ CONFIRM (fail-open): Customer ${From} replied CONFIRM but booking lookup failed. Auto-confirmed. Please verify their calendar event.`,
              });
            }
          } catch (escErr) {
            console.error(`[FAILOPEN_NOTIFY_FAILED] correlationId=${correlationId}`, escErr);
          }
          
          // Mark for human review
          try {
            await tenantDb.update(conversations).set({ 
              needsHumanAttention: true,
              needsHumanReason: 'Confirm fail-open: DB lookup failed, customer auto-confirmed'
            }).where(eq(conversations.id, conversation.id));
          } catch (handoffErr) {
            console.error(`[FAILOPEN_HANDOFF_FAILED]`, handoffErr);
          }
          
          console.log(`[BOOKING_CONFIRM_FAILOPEN_SUCCESS] correlationId=${correlationId} customer_notified=true`);
          res.type('text/xml').send(twimlResponse.toString());
          return;
        }
        
        // No booking found (not a DB error) - escalate to owner
        let noBookingEscalationFailed = false;
        try {
          const ownerPhone = process.env.BUSINESS_OWNER_PERSONAL_PHONE;
          if (ownerPhone) {
            const twilioClient = (await import('twilio')).default(
              process.env.TWILIO_ACCOUNT_SID,
              process.env.TWILIO_AUTH_TOKEN
            );
            const escalationMsg = `🚨 CONFIRM - NO BOOKING FOUND:\nCustomer: ${From}\nThey replied CONFIRM but we have no record of their booking. Please follow up.`;
            await twilioClient.messages.create({
              to: ownerPhone,
              from: To,
              body: escalationMsg,
            });
            console.log(`[ESCALATION_SENT] correlationId=${correlationId} reason=no_booking_found`);
            console.log(`[BOOKING_CREATE_FAILED] correlationId=${correlationId} reason=confirm_no_booking_found`);
          } else {
            noBookingEscalationFailed = true;
          }
        } catch (escErr) {
          console.error(`[ESCALATION_FAILED] correlationId=${correlationId}`, escErr);
          noBookingEscalationFailed = true;
        }
        
        // Mark conversation for human attention
        try {
          await tenantDb.update(conversations).set({ 
            needsHumanAttention: true,
            needsHumanReason: noBookingEscalationFailed 
              ? 'No booking found + escalation SMS failed' 
              : 'No booking found - owner notified'
          }).where(eq(conversations.id, conversation.id));
          console.log(`[BOOKING HANDOFF] conversation=${conversation.id} needsHumanAttention=true reason=no_booking_found escalation_failed=${noBookingEscalationFailed}`);
        } catch (handoffErr) {
          console.error(`[BOOKING HANDOFF] failed:`, handoffErr);
        }
        
        const noBookingReply = truncateSmsResponse("I couldn't find your booking right now—someone will follow up shortly to help confirm.");
        await addMessage(tenantDb, conversation.id, noBookingReply, 'ai');
        twimlResponse.message(noBookingReply);
        res.type('text/xml').send(twimlResponse.toString());
        return;
      }
    }
    
    if (rescheduleMatch) {
      const { findUpcomingUnconfirmedBooking, markRescheduleRequested } = await import('../services/smsBookingRecordService');
      
      // FAIL-OPEN: If booking record lookup fails, give positive response
      let upcomingBooking = null;
      let rescheduleLookupFailed = false;
      try {
        upcomingBooking = await findUpcomingUnconfirmedBooking(tenantId, From);
      } catch (lookupErr: any) {
        rescheduleLookupFailed = true;
        console.error(`[RESCHEDULE_LOOKUP_FAILED] phone=${From} err=${lookupErr?.message} code=${lookupErr?.code}`);
      }
      
      if (upcomingBooking) {
        await markRescheduleRequested(tenantId, upcomingBooking.id);
        // Reset booking state to re-offer slots for the same service
        const newState = createResetBookingState(
          'reschedule_requested',
          undefined,
          upcomingBooking.service,
          From,
          persistedState
        );
        await updateSmsBookingState(tenantDb, conversation.id, newState);
        const rescheduleReply = truncateSmsResponse(`No problem! Let's find a new time for your ${upcomingBooking.service}. When would work better for you?`);
        await addMessage(tenantDb, conversation.id, rescheduleReply, 'ai');
        twimlResponse.message(rescheduleReply);
        console.log(`[CONFIRM] Reschedule requested phone=${From} eventId=${upcomingBooking.eventId}`);
        res.type('text/xml').send(twimlResponse.toString());
        return;
      }
      
      // FAIL-OPEN: If DB lookup failed, give positive response and flag for review
      if (rescheduleLookupFailed) {
        const failOpenReply = truncateSmsResponse("No problem! When would work better for you? Just let me know your preferred day and time.");
        await addMessage(tenantDb, conversation.id, failOpenReply, 'ai');
        twimlResponse.message(failOpenReply);
        
        // Notify owner (non-blocking)
        try {
          const ownerPhone = process.env.BUSINESS_OWNER_PERSONAL_PHONE;
          if (ownerPhone) {
            const twilioClient = (await import('twilio')).default(
              process.env.TWILIO_ACCOUNT_SID,
              process.env.TWILIO_AUTH_TOKEN
            );
            await twilioClient.messages.create({
              to: ownerPhone,
              from: To,
              body: `⚠️ RESCHEDULE (fail-open): Customer ${From} wants to reschedule but lookup failed. Please check their calendar.`,
            });
          }
        } catch (escErr) {
          console.error(`[RESCHEDULE_FAILOPEN_NOTIFY_FAILED] phone=${From}`, escErr);
        }
        
        // Mark for human review
        try {
          await tenantDb.update(conversations).set({ 
            needsHumanAttention: true,
            needsHumanReason: 'Reschedule fail-open: DB lookup failed'
          }).where(eq(conversations.id, conversation.id));
        } catch (handoffErr) {
          console.error(`[RESCHEDULE_FAILOPEN_HANDOFF_FAILED]`, handoffErr);
        }
        
        console.log(`[RESCHEDULE_FAILOPEN_SUCCESS] phone=${From} customer_notified=true`);
        res.type('text/xml').send(twimlResponse.toString());
        return;
      }
      // If no booking found (not a DB error), continue to normal flow
    }
    
    // === EMAIL CONFIRMATION STAGE (after booking) ===
    if (smsBookingState.stage === 'booked' && smsBookingState.emailStage === 'asking') {
      const detectedEmail = detectEmailAddress(Body);
      const skipEmail = detectSkipEmail(Body);
      
      if (detectedEmail) {
        // Save email to customer record
        try {
          await tenantDb.update(customers).set({ email: detectedEmail }).where(
            tenantDb.withTenantFilter(customers, eq(customers.phone, From))
          );
          
          // Send confirmation email
          const { sendBookingConfirmationEmail } = await import('../emailService');
          const bookingTimeStr = smsBookingState.chosenSlotLabel || 'Scheduled';
          const subject = `Booking Confirmation - ${smsBookingState.service || 'Auto Detail'}`;
          const emailBody = `Hi! Your booking is confirmed:\n\nService: ${smsBookingState.service}\nTime: ${bookingTimeStr}\nAddress: ${smsBookingState.address}\n\nThank you for choosing us!`;
          
          try {
            await sendBookingConfirmationEmail(detectedEmail, subject, emailBody);
            console.log(`[EMAIL] confirmation_sent=true email=${detectedEmail} phone=${From}`);
          } catch (emailErr) {
            console.error(`[EMAIL] confirmation_failed email=${detectedEmail}:`, emailErr);
            // Don't fail - email is non-blocking
          }
          
          // Mark email stage complete
          await updateSmsBookingState(tenantDb, conversation.id, { emailStage: 'done', customerEmail: detectedEmail });
          
          const emailReply = truncateSmsResponse(`Perfect — email confirmation sent to ${detectedEmail}. 👍`);
          await addMessage(tenantDb, conversation.id, emailReply, 'ai');
          twimlResponse.message(emailReply);
          console.log(`[EMAIL] collected=true phone=${From} email=${detectedEmail}`);
          res.type('text/xml').send(twimlResponse.toString());
          return;
        } catch (emailErr) {
          console.error(`[EMAIL] save_failed phone=${From}:`, emailErr);
          // Continue anyway - ask again
        }
      } else if (skipEmail) {
        // Customer skipped email
        await updateSmsBookingState(tenantDb, conversation.id, { emailStage: 'done' });
        const skipReply = truncateSmsResponse(`No problem! Booking confirmed. Reply CHANGE if you need to reschedule.`);
        await addMessage(tenantDb, conversation.id, skipReply, 'ai');
        twimlResponse.message(skipReply);
        console.log(`[EMAIL] skipped=true phone=${From}`);
        res.type('text/xml').send(twimlResponse.toString());
        return;
      } else {
        // Invalid response - ask again
        const emailReply = truncateSmsResponse(`I didn't get that. Please reply with your email (e.g., name@example.com) or SKIP.`);
        await addMessage(tenantDb, conversation.id, emailReply, 'ai');
        twimlResponse.message(emailReply);
        res.type('text/xml').send(twimlResponse.toString());
        return;
      }
    }
    
    // 3. Check for DETERMINISTIC slot selection BEFORE calling LLM
    const slotSelection = detectSlotSelection(Body, smsBookingState);
    
    if (slotSelection) {
      console.log('[SMS DRAFT] Slot selection detected:', slotSelection.chosenSlotLabel);
      
      // Persist the chosen slot
      await updateSmsBookingState(tenantDb, conversation.id, {
        chosenSlotLabel: slotSelection.chosenSlotLabel,
        chosenSlotIso: slotSelection.chosenSlotIso,
      });
      
      // Deterministic response - ask for address if not collected yet
      let deterministicReply: string;
      if (!smsBookingState.address) {
        deterministicReply = `Perfect — I've got you down for ${slotSelection.chosenSlotLabel}. What's the address where we'll be working?`;
        const truncatedMsg = truncateSmsResponse(deterministicReply);
        await addMessage(tenantDb, conversation.id, truncatedMsg, 'ai');
        twimlResponse.message(truncatedMsg);
        console.log(`[SMS TRACE] sid=${MessageSid} from=${From} service=${smsBookingState.service || 'unset'} stage=choosing_slot action=ask_address`);
      } else if (!smsBookingState.service) {
        deterministicReply = `Got it, ${slotSelection.chosenSlotLabel}. What service are you interested in?`;
        const truncatedMsg = truncateSmsResponse(deterministicReply);
        await addMessage(tenantDb, conversation.id, truncatedMsg, 'ai');
        twimlResponse.message(truncatedMsg);
        console.log(`[SMS TRACE] sid=${MessageSid} from=${From} service=${smsBookingState.service || 'unset'} stage=choosing_slot action=ask_service`);
      } else if (smsBookingState.stage === 'offering_upsells') {
        // === UPSELL STAGE: Handle YES/NO response ===
        const upsellResponse = detectUpsellResponse(Body);
        
        if (upsellResponse) {
          console.log('[UPSELL] customer_response=' + upsellResponse);
          
          if (upsellResponse === 'yes') {
            // Mark selected upsells (store the IDs shown)
            await updateSmsBookingState(tenantDb, conversation.id, {
              selectedUpsells: smsBookingState.lastUpsellOfferIdsShown || [],
              declinedUpsells: false,
            });
            console.log(`[UPSELL] accepted offerIds=${smsBookingState.lastUpsellOfferIdsShown?.join(',') || 'none'}`);
          } else {
            // Customer declined
            await updateSmsBookingState(tenantDb, conversation.id, {
              declinedUpsells: true,
              selectedUpsells: [],
            });
            console.log('[UPSELL] declined');
          }
          
          // Proceed to booking (moved to below)
        } else {
          // Invalid response - ask again
          const upsellReply = truncateSmsResponse("I didn't catch that. Would you like to add the service? Reply YES or NO.");
          await addMessage(tenantDb, conversation.id, upsellReply, 'ai');
          twimlResponse.message(upsellReply);
          console.log(`[SMS TRACE] sid=${MessageSid} from=${From} stage=offering_upsells action=ask_again`);
          res.type('text/xml').send(twimlResponse.toString());
          return;
        }
      }
      
      // Have all required fields OR just answered upsells - CREATE REAL BOOKING
      if (smsBookingState.service && smsBookingState.address && slotSelection) {
        console.log('[BOOKING ATTEMPT]', {
          service: smsBookingState.service,
          slot: slotSelection.chosenSlotLabel,
          phone: From,
          address: smsBookingState.address,
          vehicle: smsBookingState.vehicle || 'unknown',
          selectedUpsells: smsBookingState.selectedUpsells || [],
        });
        
        let bookingSuccess = false;
        let bookingEventId = '';
        let bookingError = '';
        let recordPersisted = false;
        let ownerNotified = false;
        let appointmentId = 0;
        
        // Check if we should offer upsells first (only once per session)
        if (!smsBookingState.stage?.includes('offering_upsells') && !smsBookingState.declinedUpsells && !smsBookingState.selectedUpsells?.length) {
          try {
            const { getTopUpsellsForServiceName } = await import('../upsellService');
            const topUpsells = await getTopUpsellsForServiceName(tenantDb, smsBookingState.service || '', 2);
            
            if (topUpsells.length > 0) {
              // Build upsell prompt
              const offerName = topUpsells[0].name;
              const offerPrice = topUpsells[0].price ? `+$${topUpsells[0].price}` : '';
              const upsellPrompt = truncateSmsResponse(`Quick question — want to add ${offerName} ${offerPrice}? Reply YES or NO.`);
              
              // Store offer IDs and move to upsell stage
              await updateSmsBookingState(tenantDb, conversation.id, {
                stage: 'offering_upsells',
                lastUpsellOfferIdsShown: topUpsells.map(u => u.id),
              });
              
              await addMessage(tenantDb, conversation.id, upsellPrompt, 'ai');
              twimlResponse.message(upsellPrompt);
              console.log(`[UPSELL] offers_shown=${topUpsells.length} offerIds=${topUpsells.map(u => u.id).join(',')}`);
              console.log(`[SMS TRACE] sid=${MessageSid} from=${From} service=${smsBookingState.service || 'unset'} stage=offering_upsells action=show_offers`);
              res.type('text/xml').send(twimlResponse.toString());
              return;
            } else {
              console.log('[UPSELL] skipping (none applicable)');
            }
          } catch (upsellErr) {
            console.error('[UPSELL] error fetching offers:', upsellErr);
            // Continue to booking anyway
          }
        }
        
        // P0-HOTFIX: State snapshot logging before booking attempt (detect service=unset issues)
        console.log(`[BOOKING_CREATE_START] correlationId=${correlationId} state_snapshot=${JSON.stringify({
          service: smsBookingState.service || 'UNSET',
          address: smsBookingState.address ? 'SET' : 'UNSET',
          chosenSlot: slotSelection.chosenSlotLabel,
          chosenSlotIso: slotSelection.chosenSlotIso,
          stage: smsBookingState.stage,
          vehicle: smsBookingState.vehicle || 'none',
        })}`);
        
        try {
          // Step 1: Attempt calendar booking
          const bookingReq = {
            body: {
              name: conversation.customerName || 'SMS Customer',
              phone: From,
              address: smsBookingState.address,
              service: smsBookingState.service,
              time: slotSelection.chosenSlotIso || new Date().toISOString(),
              vehicles: smsBookingState.vehicle ? [{ description: smsBookingState.vehicle }] : [],
              notes: `Booked via SMS. Slot: ${slotSelection.chosenSlotLabel}`,
              smsConsent: true,
            }
          };
          
          const bookingRes = {
            status: (code: number) => ({
              json: (data: any) => {
                if (code === 200 && data.success && data.eventId) {
                  bookingSuccess = true;
                  bookingEventId = data.eventId;
                } else {
                  bookingError = data.message || 'Missing eventId or error code';
                }
              }
            }),
            json: (data: any) => {
              if (data.success && data.eventId) {
                bookingSuccess = true;
                bookingEventId = data.eventId;
              } else {
                bookingError = data.message || 'Missing eventId or error response';
              }
            }
          };
          
          await handleBook(bookingReq, bookingRes);
          
          // Step 2: Check eventId exists before proceeding
          if (!bookingSuccess || !bookingEventId) {
            console.log(`[BOOKING RESULT] success=false reason=missing_eventid eventId=null error="${bookingError || 'unknown'}"`);
            
            // P0-HOTFIX: MANDATORY OWNER ESCALATION ON BOOKING FAILURE
            let bookingFailedEscalationFailed = false;
            try {
              const ownerPhone = process.env.BUSINESS_OWNER_PERSONAL_PHONE;
              if (ownerPhone) {
                const twilioClient = (await import('twilio')).default(
                  process.env.TWILIO_ACCOUNT_SID,
                  process.env.TWILIO_AUTH_TOKEN
                );
                const escalationMsg = `🚨 BOOKING FAILED - NEEDS HUMAN:\nCustomer: ${From}\nService: ${smsBookingState.service || 'Unknown'}\nTime: ${slotSelection.chosenSlotLabel}\nAddress: ${smsBookingState.address || 'Not provided'}\nError: ${bookingError || 'Calendar insert failed'}`;
                await twilioClient.messages.create({
                  to: ownerPhone,
                  from: To,
                  body: escalationMsg,
                });
                console.log(`[ESCALATION_SENT] phone=${From} reason=booking_failed owner=${ownerPhone.slice(-4).padStart(10, '*')}`);
              } else {
                console.error(`[ESCALATION_FAILED] reason=no_owner_phone_configured phone=${From}`);
                bookingFailedEscalationFailed = true;
              }
            } catch (escalationErr) {
              console.error(`[ESCALATION_FAILED] phone=${From} error:`, escalationErr);
              bookingFailedEscalationFailed = true;
            }
            
            // Mark conversation as needing human follow-up
            try {
              await tenantDb.update(conversations).set({ 
                needsHumanAttention: true,
                needsHumanReason: bookingFailedEscalationFailed 
                  ? 'Booking failed + escalation SMS failed' 
                  : 'Booking failed - owner notified'
              }).where(eq(conversations.id, conversation.id));
              console.log(`[BOOKING HANDOFF] conversation=${conversation.id} needsHumanAttention=true escalation_failed=${bookingFailedEscalationFailed}`);
            } catch (handoffErr) {
              console.error(`[BOOKING HANDOFF] failed to set needsHumanAttention:`, handoffErr);
            }
            
            // P0-HOTFIX: Send honest message - never claim "all set" when booking failed
            deterministicReply = `I'm still finalizing this on my end—someone will confirm shortly. We have your info for ${slotSelection.chosenSlotLabel}.`;
          } else {
            // ==================== GUARDRAIL: Email ONLY after booking + calendar success ====================
            // Step 3: Only if eventId exists, mark booking complete and record upsells
            // PROOF LOG: [GCAL_INSERT_SUCCESS] eventId=...
            console.log(`[GCAL_INSERT_SUCCESS] correlationId=${correlationId} eventId=${bookingEventId}`);
            
            await updateSmsBookingState(tenantDb, conversation.id, {
              stage: 'booked',
            });
            
            // Store selected upsells in appointmentUpsells (if appointment was found)
            if (appointmentId && smsBookingState.selectedUpsells?.length) {
              try {
                const { createAppointmentUpsell } = await import('../upsellService');
                for (const offerId of smsBookingState.selectedUpsells) {
                  await createAppointmentUpsell(tenantDb, appointmentId, offerId);
                }
                console.log(`[UPSELL] recorded_to_appointment offerId_count=${smsBookingState.selectedUpsells.length}`);
              } catch (recordErr) {
                console.error('[UPSELL] failed to record appointment upsells:', recordErr);
              }
            }
            
            // Step 4: Persist booking record
            const bookingStartTime = new Date(slotSelection.chosenSlotIso || new Date().toISOString());
            const daysUntil = Math.floor((bookingStartTime.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
            const needsConfirmation = daysUntil >= 14;
            
            try {
              const { createSmsBookingRecord } = await import('../services/smsBookingRecordService');
              await createSmsBookingRecord(tenantId, {
                phone: From,
                eventId: bookingEventId,
                startTime: bookingStartTime,
                service: smsBookingState.service || 'Unknown Service',
                address: smsBookingState.address,
                needsConfirmation,
              });
              recordPersisted = true;
              // PROOF LOG: [BOOKING_CREATE_SUCCESS] bookingId=... (using eventId as booking identifier)
              console.log(`[BOOKING_CREATE_SUCCESS] correlationId=${correlationId} bookingId=${bookingEventId} persisted=true daysUntil=${daysUntil} confirmRequired=${needsConfirmation}`);
            } catch (recordErr) {
              console.error('[BOOKING RECORD] persisted=false error:', recordErr);
              // Still allow booking to proceed, record persistence is non-critical
              recordPersisted = false;
              console.log(`[BOOKING_CREATE_SUCCESS] correlationId=${correlationId} bookingId=${bookingEventId} persisted=false (non-critical, booking still valid)`);
            }
            
            // Step 5: Prepare confirmation SMS and check if customer has email for optional email confirmation
            const hasCustomerEmail = conversation.email && conversation.email.length > 0;
            
            if (needsConfirmation) {
              deterministicReply = `You're all set for ${slotSelection.chosenSlotLabel}! I'll text you closer to the date to confirm. Reply CHANGE to reschedule.`;
            } else {
              deterministicReply = `You're all set! ${smsBookingState.service} on ${slotSelection.chosenSlotLabel} at ${smsBookingState.address}. Reply CHANGE to reschedule.`;
            }
            
            // ==================== GUARDRAIL: Email collection ONLY AFTER both booking + calendar succeed ====================
            // Add email confirmation prompt if no email on record
            // This block is ONLY reached if: (1) bookingSuccess=true AND (2) bookingEventId is not empty
            if (!hasCustomerEmail) {
              const emailPrompt = truncateSmsResponse(`\nWant an email confirmation too? Reply with your email, or reply SKIP.`);
              deterministicReply += ` ${emailPrompt}`;
              // Mark email stage as asking - PROOF LOG: [EMAIL_COLLECT_PROMPT_SENT]
              await updateSmsBookingState(tenantDb, conversation.id, { emailStage: 'asking' });
              console.log(`[EMAIL_COLLECT_PROMPT_SENT] correlationId=${correlationId} phone=${From} eventId=${bookingEventId} hasEmail=false`);
            } else {
              // Already have email - send email now (booking already succeeded)
              try {
                const { sendBookingConfirmationEmail } = await import('../emailService');
                const subject = `Booking Confirmation - ${smsBookingState.service || 'Auto Detail'}`;
                const emailBody = `Hi! Your booking is confirmed:\n\nService: ${smsBookingState.service}\nTime: ${slotSelection.chosenSlotLabel}\nAddress: ${smsBookingState.address}\n\nThank you!`;
                await sendBookingConfirmationEmail(conversation.email, subject, emailBody);
                console.log(`[EMAIL] confirmation_sent=true email=${conversation.email} phone=${From} eventId=${bookingEventId}`);
              } catch (emailErr) {
                console.error(`[EMAIL] confirmation_failed:`, emailErr);
              }
            }
            // ==================== END GUARDRAIL ====================
            
            // Step 6: Send owner notification (ONLY if eventId exists)
            try {
              const ownerPhone = process.env.BUSINESS_OWNER_PERSONAL_PHONE || process.env.MAIN_PHONE_NUMBER;
              if (ownerPhone && ownerPhone !== From) {
                // Format appointment time to local "America/Chicago" time
                const bookingTimeStr = formatApptLocal(bookingStartTime);
                const vehicleStr = smsBookingState.vehicle ? ` • Vehicle: ${smsBookingState.vehicle}` : '';
                const confirmStr = needsConfirmation ? ' (needs confirm)' : '';
                const upsellsStr = (smsBookingState.selectedUpsells && smsBookingState.selectedUpsells.length > 0) 
                  ? ` • Upsells: ${smsBookingState.selectedUpsells.join(', ')}` 
                  : '';
                const ownerMsg = `📱 BOOKING${confirmStr}: ${smsBookingState.service}\n${bookingTimeStr} at ${smsBookingState.address}\nCustomer: ${From}${vehicleStr}${upsellsStr}`;
                
                const twilioClient = (await import('twilio')).default(
                  process.env.TWILIO_ACCOUNT_SID,
                  process.env.TWILIO_AUTH_TOKEN
                );
                await twilioClient.messages.create({
                  to: ownerPhone,
                  from: To,
                  body: ownerMsg,
                });
                ownerNotified = true;
                const ownerPhoneMasked = ownerPhone.slice(-4).padStart(ownerPhone.length, '*');
                console.log(`[OWNER NOTIFY] sent=true time_local="${bookingTimeStr}" time_raw="${bookingStartTime.toISOString()}" eventId=${bookingEventId} phone=${ownerPhoneMasked} upsells=${smsBookingState.selectedUpsells?.length || 0}`);
              } else if (!ownerPhone) {
                console.log('[OWNER NOTIFY] sent=false reason=no_phone_configured');
              } else {
                console.log('[OWNER NOTIFY] sent=false reason=owner_phone_equals_customer');
              }
            } catch (notifyErr) {
              console.error('[OWNER NOTIFY] sent=false error:', notifyErr);
              ownerNotified = false;
            }
            
            // Final result log
            console.log(`[BOOKING RESULT] success=true eventId=${bookingEventId} persisted=${recordPersisted} notifiedOwner=${ownerNotified} confirmRequired=${needsConfirmation}`);
          }
        } catch (bookingErr: any) {
          console.error('[BOOKING ERROR] exception:', bookingErr);
          console.log(`[BOOKING RESULT] success=false reason=exception eventId=null error="${bookingErr?.message || 'unknown'}"`);
          
          // P0-HOTFIX: MANDATORY OWNER ESCALATION ON BOOKING EXCEPTION
          let bookingExceptionEscalationFailed = false;
          try {
            const ownerPhone = process.env.BUSINESS_OWNER_PERSONAL_PHONE;
            if (ownerPhone) {
              const twilioClient = (await import('twilio')).default(
                process.env.TWILIO_ACCOUNT_SID,
                process.env.TWILIO_AUTH_TOKEN
              );
              const escalationMsg = `🚨 BOOKING EXCEPTION - NEEDS HUMAN:\nCustomer: ${From}\nService: ${smsBookingState.service || 'Unknown'}\nTime: ${slotSelection.chosenSlotLabel}\nAddress: ${smsBookingState.address || 'Not provided'}\nError: ${bookingErr?.message || 'Unknown exception'}`;
              await twilioClient.messages.create({
                to: ownerPhone,
                from: To,
                body: escalationMsg,
              });
              console.log(`[ESCALATION_SENT] phone=${From} reason=booking_exception owner=${ownerPhone.slice(-4).padStart(10, '*')}`);
            } else {
              console.error(`[ESCALATION_FAILED] reason=no_owner_phone_configured phone=${From}`);
              bookingExceptionEscalationFailed = true;
            }
          } catch (escalationErr) {
            console.error(`[ESCALATION_FAILED] phone=${From} error:`, escalationErr);
            bookingExceptionEscalationFailed = true;
          }
          
          // Mark conversation as needing human follow-up
          try {
            await tenantDb.update(conversations).set({ 
              needsHumanAttention: true,
              needsHumanReason: bookingExceptionEscalationFailed 
                ? 'Booking exception + escalation SMS failed' 
                : 'Booking exception - owner notified'
            }).where(eq(conversations.id, conversation.id));
            console.log(`[BOOKING HANDOFF] conversation=${conversation.id} needsHumanAttention=true escalation_failed=${bookingExceptionEscalationFailed}`);
          } catch (handoffErr) {
            console.error(`[BOOKING HANDOFF] failed to set needsHumanAttention:`, handoffErr);
          }
          
          // P0-HOTFIX: Send honest message - never claim "all set" when booking failed
          deterministicReply = `I'm still finalizing this on my end—someone will confirm shortly. We have your info for ${slotSelection.chosenSlotLabel}.`;
        }
        
        // Final: Truncate and send customer reply
        const truncatedSlotReply = truncateSmsResponse(deterministicReply);
        const charCount = truncatedSlotReply.length;
        const segmentsEstimate = Math.ceil(charCount / 160);
        console.log(`[SMS OUT] chars=${charCount} segmentsEstimate=${segmentsEstimate} message="${truncatedSlotReply.substring(0, 80)}..."`);
        
        await addMessage(tenantDb, conversation.id, truncatedSlotReply, 'ai');
        twimlResponse.message(truncatedSlotReply);
        
        const action = bookingSuccess && bookingEventId ? 'booked' : 'booking_failed';
        console.log(`[SMS TRACE] sid=${MessageSid} from=${From} service=${smsBookingState.service || 'unset'} stage=booked session_msgs=${conversationHistory.length} action=${action}`);
      }
      
      console.log('[SMS DRAFT] Deterministic slot response sent');
      res.type('text/xml').send(twimlResponse.toString());
      return;
    }
    
    // SP-22: Include language context in user message for AI
    const languageContext = customerLanguage === 'es' 
      ? '\n[SYSTEM: Customer prefers Spanish. Respond in Spanish.]' 
      : '';
    
    const aiReply = await generateAIResponse(
      Body + languageContext,
      From,
      'sms',
      undefined,
      conversationHistory,
      false,
      tenantId,
      conversation.controlMode || 'auto'
    );
    
    // === Persist offered slots if AI just sent availability + COMPACT SUMMARIZATION ===
    let finalReply = aiReply;
    if (aiReply) {
      const { extractSlotsFromMessage } = await import('../services/bookingDraftService');
      const offeredSlots = extractSlotsFromMessage(aiReply);
      if (offeredSlots.length > 0) {
        console.log('[SMS DRAFT] Persisting offered slots:', offeredSlots.length);
        // Also persist the current horizon days and metadata
        const currentHorizon = persistedState.horizonDays || 10;
        const includePreview = !!(offeredSlots.length > 0 && 
          offeredSlots[0].iso && 
          new Date(offeredSlots[0].iso) > new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
        
        await updateSmsBookingState(tenantDb, conversation.id, {
          lastOfferedSlots: offeredSlots,
          horizonDays: currentHorizon,
          lastAvailabilityMeta: {
            offeredAt: new Date().toISOString(),
            count: offeredSlots.length,
            hasPreview: includePreview,
          },
        });
        
        // === COMPACT SLOT SUMMARIZATION: Replace verbose slot list with concise format ===
        try {
          const compactSlots = offeredSlots.map(s => ({ isoStart: s.iso, isoEnd: undefined }));
          const compactSummary = getCompactSlotsSms(compactSlots, 'America/Chicago', truncateSmsResponse);
          finalReply = compactSummary;
          console.log(`[SLOT SUMMARIZER] compressed=${offeredSlots.length} slots→${compactSummary.length} chars (${Math.round((1 - compactSummary.length / truncateSmsResponse(aiReply).length) * 100)}% reduction)`);
        } catch (summarizerErr) {
          console.error('[SLOT SUMMARIZER] failed, using full AI response:', summarizerErr);
          // Fallback: use original AI reply if summarizer fails
        }
        
        // High-signal logging for slot offer tracking
        console.log(`[SLOT OFFER] horizonDays=${currentHorizon} primarySlots=${offeredSlots.length} preview=${includePreview} earliest=${offeredSlots[0]?.iso || 'unknown'} options=${Math.min(offeredSlots.length, 3)}`);
        console.log(`[SLOT OFFER] smsChars_before=${truncateSmsResponse(aiReply).length} smsChars_after=${finalReply.length}`);
      }
    }
    
    // Apply SMS length control to ensure response fits in safe segment count
    const truncatedReply = truncateSmsResponse(finalReply || "Thanks for your message!");
    
    await addMessage(tenantDb, conversation.id, truncatedReply, 'ai');
    
    twimlResponse.message(truncatedReply);
    
    // Trace for debugging
    const hasSlots = smsBookingState.lastOfferedSlots && smsBookingState.lastOfferedSlots.length > 0;
    const action = hasSlots ? 'offer_slots' : (smsBookingState.address ? 'offer_slots' : (smsBookingState.service ? 'ask_address' : 'ask_service'));
    console.log(`[SMS TRACE] sid=${MessageSid} from=${From} service=${smsBookingState.service || 'unset'} stage=${smsBookingState.stage || 'selecting_service'} session_msgs=${conversationHistory.length} action=${action}`);
    
    console.log('[TWILIO TEST SMS INBOUND] AI reply sent:', truncatedReply.substring(0, 100));
    console.log("[TWILIO TEST SMS INBOUND] Responding with TwiML:", twimlResponse.toString());
    
    res.type('text/xml').send(twimlResponse.toString());
  } catch (err) {
    console.error('[TWILIO TEST SMS INBOUND ERROR]', err);
    const errorResponse = new MessagingResponse();
    errorResponse.message("Sorry, I'm having trouble right now. A human will take a look and get back to you.");
    res.type('text/xml').send(errorResponse.toString());
  }
}

twilioTestSmsRouter.post('/inbound', async (req: Request, res: Response) => {
  // Extract MessageSid first for deduplication and logging
  const messageSid = req.body.MessageSid || req.body.SmsMessageSid;
  const from = req.body.From;
  const to = req.body.To;
  const body = req.body.Body?.substring(0, 80) || '(empty)';
  const tenantId = (req as any).tenant?.id || 'root';
  
  // CRITICAL: Inbound hit log for debugging route mismatches
  console.log(`[TWILIO INBOUND HIT] path=/api/twilio/sms/inbound tenant=${tenantId} from=${from} to=${to}`);
  
  // Diagnostic log at start
  console.log(`[SMS INBOUND] sid=${messageSid} from=${from} to=${to} body=${body}`);
  
  // === IDEMPOTENCY CHECK: Prevent duplicate processing for same MessageSid ===
  if (messageSid) {
    try {
      const isDuplicate = await isDuplicateInboundSms(messageSid);
      if (isDuplicate) {
        console.log(`[SMS DEDUPE] Duplicate inbound ignored sid=${messageSid}`);
        // Return 200 to stop Twilio retries, but don't process again
        res.type('text/xml').status(200).send(new MessagingResponse().toString());
        return;
      }
    } catch (dedupeError) {
      // If dedupe check fails (e.g., table missing), log and continue (fail-open)
      console.warn(`[SMS DEDUPE] Check failed, continuing anyway:`, dedupeError instanceof Error ? dedupeError.message.substring(0, 60) : 'unknown error');
    }
  }

  try {
    // HOTFIX-SMS-CM: Clean Machine production number now uses AI Behavior V2 brain
    // instead of legacy webhook forwarding. The legacy webhook was causing:
    // - Generic GPT tone instead of Clean Machine personality
    // - Context loss after address confirmation
    // - Not asking about services
    // - Inappropriate "we'll send this to our team" then re-listing availability
    //
    // To re-enable legacy routing for Clean Machine, set env var:
    // CLEAN_MACHINE_USE_LEGACY_SMS=true
    const useLegacySms = process.env.CLEAN_MACHINE_USE_LEGACY_SMS === 'true';
    
    if (useLegacySms && shouldRouteToLegacyCleanMachine(req)) {
      console.log("[TWILIO SMS INBOUND] Legacy mode enabled - routing to legacy Clean Machine app.");
      return forwardToLegacyCleanMachine(req, res);
    }
    
    // Log if we WOULD have routed to legacy but V2 is active
    if (shouldRouteToLegacyCleanMachine(req)) {
      console.log("[TWILIO SMS INBOUND] HOTFIX-SMS-CM: Bypassing legacy routing - using AI Behavior V2 for Clean Machine.");
    }

    console.log("[TWILIO SMS INBOUND] Routing to ServicePro AI Behavior V2 handler.");
    return handleServiceProInboundSms(req, res, messageSid);
  } catch (err: any) {
    console.error("[TWILIO SMS INBOUND] Unhandled error in router:", err);
    const twimlResponse = new MessagingResponse();
    twimlResponse.message(
      "We hit an error processing your message. Please try again shortly."
    );
    res.type("text/xml").status(200).send(twimlResponse.toString());
  }
});

console.log("[TWILIO TEST] Inbound SMS handler READY at /api/twilio/sms/inbound");
