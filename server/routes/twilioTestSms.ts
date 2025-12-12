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
  type SmsBookingState
} from '../services/bookingDraftService';
import { buildSmsLlmContext } from '../services/smsConversationContextService';
import { handleBook } from '../calendarApi';
import { truncateSmsResponse } from '../utils/smsLength';

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
  await tenantDb
    .insert(messagesTable)
    .values({
      conversationId,
      content,
      sender,
      fromCustomer: sender === 'customer',
      platform: 'sms',
      timestamp: new Date(),
    });
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
    
    console.log("[TWILIO TEST SMS INBOUND] Parsed fields:", {
      From: (req.body as any)?.From,
      To: (req.body as any)?.To,
      Body: (req.body as any)?.Body,
    });
    
    if (!Body || !From) {
      console.warn('[TWILIO TEST SMS INBOUND] Missing Body or From');
      twimlResponse.message("Sorry, I couldn't process your message. Please try again.");
      res.type('text/xml').send(twimlResponse.toString());
      return;
    }
    
    const tenantId = 'root';
    const tenantDb = wrapTenantDb(db, tenantId);
    
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
    const conversationHistory = smsContext.recentMessages;
    
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
      } else {
        // Have all required fields - CREATE REAL BOOKING
        console.log('[SCHEDULING] Attempting to create booking...', {
          service: smsBookingState.service,
          slot: slotSelection.chosenSlotLabel,
          address: smsBookingState.address,
          phone: From,
        });
        
        try {
          // Create mock request/response for handleBook
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
          
          let bookingSuccess = false;
          let bookingEventId = '';
          let bookingError = '';
          
          const bookingRes = {
            status: (code: number) => ({
              json: (data: any) => {
                // CRITICAL: Only claim success if code=200 AND eventId exists
                if (code === 200 && data.success && data.eventId) {
                  bookingSuccess = true;
                  bookingEventId = data.eventId;
                  console.log(`[SCHEDULING] Booking created eventId=${bookingEventId}`);
                } else {
                  bookingError = data.message || 'Missing eventId or error code';
                  console.log(`[SCHEDULING] Booking failed reason=${bookingError}`);
                }
              }
            }),
            json: (data: any) => {
              // CRITICAL: Only claim success if success=true AND eventId exists
              if (data.success && data.eventId) {
                bookingSuccess = true;
                bookingEventId = data.eventId;
                console.log(`[SCHEDULING] Booking created eventId=${bookingEventId}`);
              } else {
                bookingError = data.message || 'Missing eventId or error response';
              }
            }
          };
          
          await handleBook(bookingReq, bookingRes);
          
          // STRICT RULE: ONLY send confirmation if we have a real eventId
          if (bookingSuccess && bookingEventId) {
            // Mark booking as complete
            await updateSmsBookingState(tenantDb, conversation.id, {
              stage: 'booked',
            });
            
            // REAL confirmation SMS - only if eventId was created
            deterministicReply = `You're all set! ${smsBookingState.service} on ${slotSelection.chosenSlotLabel} at ${smsBookingState.address}. Reply CHANGE to reschedule.`;
            
            // Notify business owner
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
                  body: `NEW BOOKING: ${smsBookingState.service} on ${slotSelection.chosenSlotLabel}. Customer: ${From}. Address: ${smsBookingState.address}`,
                });
                console.log('[OWNER NOTIFY] sent=true eventId=' + bookingEventId);
              } else {
                console.log('[OWNER NOTIFY] sent=false reason=no_owner_phone');
              }
            } catch (notifyErr) {
              console.error('[OWNER NOTIFY] sent=false error:', notifyErr);
            }
          } else {
            // Booking failed - DO NOT claim it booked - offer alternatives
            console.log(`[SCHEDULING] Booking failed: no eventId received reason=${bookingError}`);
            deterministicReply = `I couldn't lock in that time automatically. Want me to try the next available slot?`;
          }
        } catch (bookingErr) {
          console.error('[SCHEDULING] Booking failed with exception:', bookingErr);
          deterministicReply = `I couldn't lock in that time automatically. Want me to try the next available slot?`;
        }
        
        const truncatedSlotReply = truncateSmsResponse(deterministicReply);
        await addMessage(tenantDb, conversation.id, truncatedSlotReply, 'ai');
        twimlResponse.message(truncatedSlotReply);
        
        const action = bookingSuccess && bookingEventId ? 'booked' : (deterministicReply.includes('lock') ? 'booking_failed' : 'offer_slots');
        console.log(`[SMS TRACE] sid=${MessageSid} from=${From} service=${smsBookingState.service || 'unset'} stage=${smsBookingState.stage || 'booked'} session_msgs=${conversationHistory.length} action=${action}`);
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
    
    // === Persist offered slots if AI just sent availability ===
    if (aiReply) {
      const { extractSlotsFromMessage } = await import('../services/bookingDraftService');
      const offeredSlots = extractSlotsFromMessage(aiReply);
      if (offeredSlots.length > 0) {
        console.log('[SMS DRAFT] Persisting offered slots:', offeredSlots.length);
        await updateSmsBookingState(tenantDb, conversation.id, {
          lastOfferedSlots: offeredSlots,
        });
      }
    }
    
    // Apply SMS length control to ensure response fits in safe segment count
    const truncatedReply = truncateSmsResponse(aiReply || "Thanks for your message!");
    
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
