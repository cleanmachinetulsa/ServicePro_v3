import { customerMemory } from './customerMemory';
import { sendBookingConfirmationEmail, sendReminderEmail } from './emailService';
import { WeatherCheckResult } from './weatherService';
import { smsDeliveryStatus } from '@shared/schema';
import type { TenantDb } from './tenantDb';
import { phoneConfig } from './config/phoneConfig';

// Set to true if you want to enable demo mode restrictions
const DEMO_MODE = process.env.DEMO_MODE === 'true';

/**
 * Notification Service for Clean Machine Auto Detail
 * Handles SMS and email notifications for appointments and reminders
 */

// Use environment variables for Twilio credentials
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.MAIN_PHONE_NUMBER;
const twilioMessagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;

// Import Twilio if credentials are available
import * as Twilio from 'twilio';

let twilio: any = null;
if (twilioAccountSid && twilioAuthToken) {
  try {
    twilio = Twilio.default(twilioAccountSid, twilioAuthToken);
    console.log('Twilio client initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Twilio client:', error);
  }
}

// Required Service Reminders
const SERVICE_REMINDERS = `
Please ensure the vehicle is available and personal items are removed if possible. Anything not obviously trash will be placed into a bag and left in the vehicle for your review.

First I'll pull the vehicle under my pop-up canopy. I'll just need to connect to a power outlet and a water spigot (for exteriors). I'll have 100ft of extension/hose to reach your hookups. For apartments/condos, I can run the power cable through a door or window if needed. When I finish up I'll send a text message with payment links through Venmo, Cashapp & PayPal.
`;

/**
 * Send SMS opt-in confirmation to new users
 */
export async function sendSMSOptInConfirmation(
  tenantDb: TenantDb,
  phoneNumber: string
): Promise<{ success: boolean; error?: any }> {
  const confirmationMessage = "Clean Machine Auto Detail: You are now opted in for appointment updates and service reminders. Reply HELP for help. Reply STOP to opt out anytime.";

  // Use Main Line (ID 1) for automated opt-in confirmations
  return await sendSMS(tenantDb, phoneNumber, confirmationMessage, undefined, undefined, 1);
}

/**
 * Send an SMS notification with delivery tracking and opt-out enforcement
 */
export async function sendSMS(
  tenantDb: TenantDb,
  phoneNumber: string,
  message: string,
  conversationId?: number,
  messageId?: number,
  phoneLineId?: number
): Promise<{ success: boolean; error?: any; messageSid?: string }> {
  if (DEMO_MODE) {
    // In demo mode, log the message but don't actually send it
    console.log(`[DEMO MODE] SMS would be sent to ${phoneNumber}: ${message}`);
    return { success: true };
  }

  if (!twilio) {
    console.error('Twilio client not initialized');
    return { success: false, error: 'SMS service not configured' };
  }

  if (!phoneNumber || !message) {
    return { success: false, error: 'Phone number and message are required' };
  }

  try {
    // Format phone number to E.164 format if not already
    const formattedPhone = formatPhoneNumber(phoneNumber);
    
    // Get the tenant's SMS configuration for proper FROM number
    const { getSmsConfig } = await import('./services/smsConfigService');
    const tenantId = tenantDb.tenantId || 'root';
    const smsConfig = await getSmsConfig(tenantId);
    
    // Default to tenant's configured FROM number
    let fromPhoneNumber = smsConfig.fromNumber || twilioPhoneNumber;
    let messagingServiceSidToUse = smsConfig.messagingServiceSid || twilioMessagingServiceSid;
    
    console.log(`[SMS] Tenant ${tenantId}: Configured FROM=${smsConfig.fromNumber}, MessagingSvc=${smsConfig.messagingServiceSid || 'none'}`);
    
    // Override with specific phone line if phoneLineId provided
    if (phoneLineId) {
      const { phoneLines } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');
      
      const [phoneLine] = await tenantDb
        .select()
        .from(phoneLines)
        .where(eq(phoneLines.id, phoneLineId))
        .limit(1);
      
      if (phoneLine) {
        fromPhoneNumber = phoneLine.phoneNumber;
        messagingServiceSidToUse = null; // Don't use messaging service when specific line is requested
        console.log(`[SMS] Using specific phone line ${phoneLine.label} (${phoneLine.phoneNumber})`);
      } else {
        console.warn(`[SMS] Phone line ID ${phoneLineId} not found, using tenant default: ${fromPhoneNumber}`);
      }
    }
    
    // SMS OPT-OUT ENFORCEMENT (TCPA/CTIA Compliance)
    // Check if customer has opted out via STOP keyword
    let effectiveConversationId = conversationId;
    
    // If conversationId not provided, look up active conversation by phone
    // Uses tenantDb for proper multi-tenant scoping
    if (!effectiveConversationId) {
      const { conversations } = await import('@shared/schema');
      const { eq, and, desc } = await import('drizzle-orm');
      
      const [existingConversation] = await tenantDb
        .select({ id: conversations.id })
        .from(conversations)
        .where(
          and(
            eq(conversations.customerPhone, formattedPhone),
            eq(conversations.platform, 'sms')
          )
        )
        .orderBy(desc(conversations.lastMessageTime))
        .limit(1);
      
      effectiveConversationId = existingConversation?.id;
    }
    
    // Check opt-out status if we have a conversation
    if (effectiveConversationId) {
      const { isOptedOut } = await import('./smsConsentService');
      const optedOut = await isOptedOut(tenantDb, effectiveConversationId);
      
      if (optedOut) {
        console.warn(`[SMS COMPLIANCE] ⚠️ Blocked SMS to ${formattedPhone} - Customer opted out via STOP keyword (Conversation ID: ${effectiveConversationId})`);
        console.log(`[SMS COMPLIANCE] Compliance audit: Prevented unlawful message send to opted-out number`);
        
        return { 
          success: false, 
          error: 'sms_opted_out',
          messageSid: undefined
        };
      }
    }

    // SP-19: BILLING ENFORCEMENT - Block suspended tenants
    const { isTenantSuspended } = await import('./middleware/billingEnforcement');
    const isSuspended = await isTenantSuspended(tenantId);
    
    if (isSuspended) {
      console.warn(`[BILLING ENFORCEMENT] ⚠️ Blocked SMS to ${formattedPhone} - Tenant ${tenantId} is suspended`);
      return { 
        success: false, 
        error: 'account_suspended',
        messageSid: undefined
      };
    }

    // SP-9: TRIAL TELEPHONY SANDBOX ENFORCEMENT
    // Check if tenant is trial and enforce whitelist/cap restrictions
    const { canSendTrialMessage, recordTrialMessageSent, isTrialTenant } = await import('./services/trialTelephonyService');
    const isTrialTenantFlag = await isTrialTenant(tenantId);
    const trialCheck = await canSendTrialMessage(tenantId, formattedPhone);
    
    if (!trialCheck.canSend) {
      console.warn(`[TRIAL SANDBOX] ⚠️ Blocked SMS to ${formattedPhone} - ${trialCheck.reason} (Tenant: ${tenantId})`);
      return { 
        success: false, 
        error: `trial_sandbox_${trialCheck.reason?.includes('whitelist') ? 'not_whitelisted' : 'cap_exceeded'}`,
        messageSid: undefined
      };
    }

    // Get the status callback URL (uses the current deployment URL)
    const statusCallbackUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}/api/twilio/status-callback`
      : undefined;

    // Prepare SMS parameters
    const smsParams: any = {
      body: message,
      to: formattedPhone,
      statusCallback: statusCallbackUrl, // Twilio will POST updates to this URL
    };

    // Use Messaging Service SID if available (better A2P compliance/deliverability)
    // Fall back to direct FROM number if no messaging service is configured
    if (messagingServiceSidToUse && !phoneLineId) {
      smsParams.messagingServiceSid = messagingServiceSidToUse;
      console.log(`[SMS] Sending via Messaging Service: ${messagingServiceSidToUse}`);
    } else {
      smsParams.from = fromPhoneNumber;
      console.log(`[SMS] Sending via FROM number: ${fromPhoneNumber}`);
    }

    // EMERGENCY FIX: Use failover service for Error 30024 (ported number not provisioned)
    // Import failover service
    const { sendSMSWithFailover } = await import('./smsFailoverService');
    
    // Determine which number to use for sending
    let actualFromNumber = fromPhoneNumber;
    
    // If using Messaging Service, we need a fallback number for the failover logic
    if (smsParams.messagingServiceSid && !smsParams.from) {
      actualFromNumber = twilioPhoneNumber || '';
    } else if (smsParams.from) {
      actualFromNumber = smsParams.from;
    }
    
    // Send SMS with automatic failover (retry with backup line if Error 30024)
    const failoverResult = await sendSMSWithFailover(
      tenantDb,
      formattedPhone,
      message,
      actualFromNumber,
      phoneLineId,
      statusCallbackUrl
    );
    
    if (!failoverResult.success) {
      console.error('[SMS] Failover also failed:', failoverResult.error);
      return { success: false, error: failoverResult.error };
    }
    
    const messageSid = failoverResult.messageSid!;
    console.log(`SMS sent to ${phoneNumber}, SID: ${messageSid}${failoverResult.usedBackup ? ' (via BACKUP line)' : ''}`);
    
    // Determine actual sender (might be backup line if failover occurred)
    const actualSender = failoverResult.usedBackup ? '+19188565711' : actualFromNumber;

    // Log to delivery tracking database
    try {
      await tenantDb.insert(smsDeliveryStatus).values({
        messageSid: messageSid,
        conversationId: conversationId || null,
        messageId: messageId || null,
        to: formattedPhone,
        from: actualSender,
        body: message,
        status: 'queued', // Initial status
        direction: 'outbound-api',
        numSegments: null, // We don't have this from failover service
        tenantId: 'root', // Required field for multi-tenancy support
      });
      console.log(`[SMS TRACKING] Logged message to database: ${messageSid} from ${actualSender}${failoverResult.usedBackup ? ' (FAILOVER)' : ''}`);
    } catch (dbError) {
      console.error('[SMS TRACKING] Failed to log to database:', dbError);
      // Don't fail the SMS send if database logging fails
    }

    // SP-9: Track trial message usage after successful send
    // Only track if this is a trial tenant
    if (isTrialTenantFlag) {
      try {
        await recordTrialMessageSent(tenantId);
        console.log(`[TRIAL SANDBOX] Recorded message for tenant ${tenantId}`);
      } catch (trackError) {
        console.error('[TRIAL SANDBOX] Failed to record message:', trackError);
        // Don't fail the SMS send if tracking fails
      }
    }

    // CM-Billing-Prep: Record usage event for billing
    try {
      const { recordSmsOutbound } = await import('./usage/usageRecorder');
      void recordSmsOutbound(tenantId, {
        messageSid,
        to: formattedPhone,
        from: actualSender,
        usedBackup: failoverResult.usedBackup,
      });
    } catch (usageError) {
      console.error('[USAGE] Failed to record SMS outbound:', usageError);
    }

    return { success: true, messageSid: messageSid };
  } catch (error) {
    console.error('Error sending SMS:', error);
    return { success: false, error };
  }
}

/**
 * Smart notification system with intelligent fallback
 * Tries SMS first, falls back to email if SMS fails, alerts to emergency number if both fail
 * Works for both 5304 and 5711 phone lines
 */
export async function smartSendNotification(
  tenantDb: TenantDb,
  customerPhone: string,
  customerEmail: string | undefined,
  message: string,
  emailSubject: string,
  conversationId?: number,
  messageId?: number,
  phoneLineId?: number
): Promise<{ success: boolean; method: 'sms' | 'email' | 'emergency'; error?: any }> {
  // Step 1: Try SMS first
  console.log(`[SMART NOTIFY] Attempting SMS to ${customerPhone}`);
  const smsResult = await sendSMS(tenantDb, customerPhone, message, conversationId, messageId, phoneLineId);
  
  if (smsResult.success) {
    console.log(`[SMART NOTIFY] ✅ SMS sent successfully via line ${phoneLineId || 'default'}`);
    return { success: true, method: 'sms' };
  }
  
  // Step 2: SMS failed - try email as fallback
  console.log(`[SMART NOTIFY] ⚠️ SMS failed (${smsResult.error}) - attempting email fallback to ${customerEmail}`);
  
  if (customerEmail && customerEmail.trim()) {
    try {
      const emailResult = await sendBusinessEmail(customerEmail, emailSubject, message);
      if (emailResult.success) {
        console.log(`[SMART NOTIFY] ✅ Email sent as fallback to ${customerEmail}`);
        return { success: true, method: 'email' };
      }
    } catch (emailError) {
      console.error(`[SMART NOTIFY] Email fallback also failed:`, emailError);
    }
  } else {
    console.warn(`[SMART NOTIFY] No email provided - cannot use email fallback`);
  }
  
  // Step 3: Both SMS and email failed - alert urgent number via alertService
  const urgentPhone = phoneConfig.ownerUrgent;
  console.error(`[SMART NOTIFY] 🚨 CRITICAL: Both SMS and email failed! Alerting to urgent line: ${urgentPhone}`);
  
  try {
    const { sendUrgentAlert } = await import('./services/alertService');
    const emergencyMessage = `NOTIFICATION DELIVERY FAILURE - Failed to send to ${customerPhone} / ${customerEmail || 'no email'}: ${message.substring(0, 100)}`;
    
    await sendUrgentAlert(emergencyMessage);
    
    console.log(`[SMART NOTIFY] 📱 Urgent alert sent to ${urgentPhone}`);
    return { success: false, method: 'emergency', error: 'SMS and email both failed - alert sent to urgent line' };
  } catch (emergencyError) {
    console.error(`[SMART NOTIFY] 🔴 CRITICAL: Urgent alert also failed!`, emergencyError);
    return { success: false, method: 'emergency', error: 'All notification methods failed' };
  }
}

/**
 * Send an email notification
 * @deprecated Use sendBusinessEmail from emailService.ts instead
 */
export async function sendEmail(
  tenantDb: TenantDb,
  email: string,
  subject: string,
  message: string,
): Promise<{ success: boolean; error?: any }> {
  // Import and use the proper email service
  const { sendBusinessEmail } = await import('./emailService');
  return sendBusinessEmail(email, subject, message);
}

/**
 * Send booking confirmation notifications
 */
export async function sendBookingConfirmation(
  tenantDb: TenantDb,
  appointmentDetails: {
    name: string;
    phone: string;
    email?: string;
    address: string;
    isExtendedAreaRequest: boolean;
    service: string;
    addOns: string[];
    time: string;
    formattedTime: string;
    vehicleInfo?: string;
  }
): Promise<{ sms: boolean; email: boolean }> {
  const {
    name,
    phone,
    email,
    address,
    service,
    addOns,
    formattedTime,
    vehicleInfo,
  } = appointmentDetails;

  // Get customer information from memory
  const customerInfo = customerMemory.getCustomer(phone);
  const vehicle = vehicleInfo || (customerInfo?.vehicleInfo || 'your vehicle');
  const servicesList = [service, ...(addOns || [])].join(', ');

  // Render SMS from template with fallback to legacy message
  const { renderSmsTemplateOrFallback } = await import('./templateRenderer');
  const firstName = name.split(' ')[0];
  
  // Parse date and time from formattedTime (e.g., "December 15 at 2:00 PM")
  const dateMatch = formattedTime.match(/^(.+?) at (.+)$/);
  const date = dateMatch ? dateMatch[1] : formattedTime.split(' at ')[0];
  const time = dateMatch ? dateMatch[2] : formattedTime.split(' at ')[1] || formattedTime;

  const templateResult = await renderSmsTemplateOrFallback(
    tenantDb,
    'booking_confirmation',
    {
      firstName,
      serviceName: servicesList,
      date,
      time,
    },
    () => `
Hi ${name}, this is Clean Machine Auto Detail confirming your appointment for ${formattedTime} at ${address}.

Services: ${servicesList}
Vehicle: ${vehicle}

${SERVICE_REMINDERS}

Need to reschedule? Reply to this message or call us.

Directions to your location: https://cleanmachine.app/directions?address=${encodeURIComponent(address)}
`
  );

  const confirmationMessage = templateResult.message;

  // Send SMS confirmation using Main Line (ID 1) for automated booking confirmations
  const smsResult = await sendSMS(tenantDb, phone, confirmationMessage, undefined, undefined, 1);

  // Send email confirmation if email is provided
  let emailResult = { success: false };
  if (email) {
    // Use the SendGrid email service
    try {
      emailResult = await sendBookingConfirmationEmail(
        email,
        name,
        service,
        formattedTime,
        address,
        addOns,
        vehicle
      );
    } catch (emailError) {
      console.error('Error sending confirmation email:', emailError);
      emailResult = { success: false };
    }

    if (emailResult.success) {
      console.log(`Booking confirmation email sent to ${email}`);
    } else {
      console.error(`Failed to send booking confirmation email to ${email}`);
    }
  }

  return {
    sms: smsResult.success,
    email: emailResult.success,
  };
}

/**
 * Schedule a day-before reminder for an appointment
 */
export function scheduleDayBeforeReminder(
  tenantDb: TenantDb,
  appointmentDetails: {
    name: string;
    phone: string;
    email?: string;
    address: string;
    service: string;
    addOns: string[];
    time: string;
    formattedTime: string;
    vehicleInfo?: string;
  }
): { success: boolean; scheduledTime?: Date } {
  try {
    const appointmentTime = new Date(appointmentDetails.time);

    // Schedule for 4pm the day before
    const reminderTime = new Date(appointmentTime);
    reminderTime.setDate(appointmentTime.getDate() - 1);
    reminderTime.setHours(16, 0, 0, 0);

    // If the appointment is tomorrow and it's already past 4pm, send immediately
    const now = new Date();
    if (reminderTime < now) {
      // Appointment is less than 24 hours away, send reminder now
      sendReminderNotifications(tenantDb, appointmentDetails);
      return { success: true, scheduledTime: now };
    }

    // Calculate ms until the reminder should be sent
    const msUntilReminder = reminderTime.getTime() - now.getTime();

    // Schedule the reminder
    setTimeout(() => {
      sendReminderNotifications(tenantDb, appointmentDetails);
    }, msUntilReminder);

    console.log(`Reminder scheduled for ${reminderTime.toLocaleString()} (${msUntilReminder}ms from now)`);
    return { success: true, scheduledTime: reminderTime };
  } catch (error) {
    console.error('Error scheduling reminder:', error);
    return { success: false };
  }
}

/**
 * Send day-before reminder notifications
 */
async function sendReminderNotifications(
  tenantDb: TenantDb,
  appointmentDetails: {
    name: string;
    phone: string;
    email?: string;
    address: string;
    service: string;
    addOns: string[];
    time: string;
    formattedTime: string;
    vehicleInfo?: string;
  }
): Promise<{ sms: boolean; email: boolean }> {
  const {
    name,
    phone,
    email,
    address,
    service,
    addOns,
    formattedTime,
    vehicleInfo,
  } = appointmentDetails;

  // Get customer information from memory
  const customerInfo = customerMemory.getCustomer(phone);
  const vehicle = vehicleInfo || (customerInfo?.vehicleInfo || 'your vehicle');
  const servicesList = [service, ...(addOns || [])].join(', ');

  // Render SMS from template with fallback to legacy message
  const { renderSmsTemplateOrFallback } = await import('./templateRenderer');
  const firstName = name.split(' ')[0];
  
  // Parse time from formattedTime (e.g., "December 15 at 2:00 PM" -> "2:00 PM")
  const timeMatch = formattedTime.match(/at\s+(.+)$/);
  const time = timeMatch ? timeMatch[1] : formattedTime;

  const templateResult = await renderSmsTemplateOrFallback(
    tenantDb,
    'appointment_reminder_24h',
    {
      firstName,
      serviceName: servicesList,
      time,
    },
    () => `
Hi ${name}, this is Clean Machine Auto Detail reminding you of your appointment tomorrow at ${formattedTime} at ${address}.

Services: ${servicesList}
Vehicle: ${vehicle}

${SERVICE_REMINDERS}

To reschedule: Reply "RESCHEDULE" and we'll help you find a new time.
To cancel: Reply "CANCEL" and we'll confirm your cancellation.
Questions? Text back or call (918) 856-5304

Directions to your location: https://cleanmachine.app/directions?address=${encodeURIComponent(address)}
`
  );

  const reminderMessage = templateResult.message;

  // Send SMS reminder using Main Line (ID 1) for automated reminders
  const smsResult = await sendSMS(tenantDb, phone, reminderMessage, undefined, undefined, 1);

  // Send email reminder if email is provided
  let emailResult = { success: false };
  if (email) {
    emailResult = await sendReminderEmail(
      email,
      name,
      service,
      formattedTime,
      address,
      addOns,
      vehicle
    );

    if (emailResult.success) {
      console.log(`Reminder email sent to ${email}`);
    } else {
      console.error(`Failed to send reminder email to ${email}`);
    }
  }

  return {
    sms: smsResult.success,
    email: emailResult.success,
  };
}

/**
 * Send an "on the way" notification with estimated arrival time
 */
export async function sendOnTheWayNotification(
  tenantDb: TenantDb,
  phoneNumber: string,
  address: string,
  estimatedMinutes: number
): Promise<{ success: boolean; error?: any }> {
  // Get customer information
  const customerInfo = customerMemory.getCustomer(phoneNumber);
  const name = customerInfo?.name || 'there';

  // Add a 10-minute buffer to the estimated time
  const minTime = estimatedMinutes;
  const maxTime = estimatedMinutes + 10;

  // Create the message
  const message = `
Hey ${name}, it's Jody with Clean Machine Auto Detail. Just wanted to let you know we're on the way and should arrive in ${minTime}-${maxTime} minutes.

See you soon!
`;

  // Send the SMS using Main Line (ID 1) for automated ETA notifications
  return await sendSMS(tenantDb, phoneNumber, message, undefined, undefined, 1);
}

/**
 * Send weather alert notifications for upcoming appointments with inclement weather
 * @param appointmentDetails Appointment details including contact information
 * @param weatherResult Weather check result with severity information
 */
export async function sendWeatherAlertNotification(
  tenantDb: TenantDb,
  appointmentDetails: {
    name: string;
    phone: string;
    email?: string;
    address: string;
    service: string;
    addOns?: string[];
    time: string;
    formattedTime: string;
    vehicleInfo?: string;
  },
  weatherResult: WeatherCheckResult
): Promise<{ sms: boolean; email: boolean }> {
  const {
    name,
    phone,
    email,
    address,
    formattedTime,
    service,
  } = appointmentDetails;

  // Generate message based on weather severity
  let severityText = '';
  let actionText = '';

  switch (weatherResult.weatherRiskLevel) {
    case 'severe':
      severityText = 'severe weather (80-100% chance of rain)';
      actionText = 'We strongly recommend rescheduling to ensure quality service.';
      break;
    case 'very-high':
      severityText = 'very high chance of rain (60-80%)';
      actionText = 'We recommend rescheduling to ensure quality service.';
      break;
    case 'high':
      severityText = 'high chance of rain (25-60%)';
      actionText = 'Consider rescheduling for better detailing results.';
      break;
    case 'moderate':
      severityText = 'moderate chance of rain (15-25%)';
      actionText = 'We can still perform service, but exterior detailing might be affected.';
      break;
    default:
      severityText = 'potential inclement weather';
      actionText = 'Please consider your options.';
  }

  // Create the weather alert message with booking link
  // Use REPLIT_DOMAINS (production domain) or fall back to REPL_SLUG
  const domain = process.env.REPLIT_DOMAINS 
    ? process.env.REPLIT_DOMAINS.split(',')[0] 
    : `${process.env.REPL_SLUG || 'cleanmachine'}.replit.app`;
  const rescheduleLink = `https://${domain}/schedule?phone=${encodeURIComponent(phone)}&name=${encodeURIComponent(name)}&service=${encodeURIComponent(service)}`;

  const weatherAlertMessage = `
Hi ${name}, Clean Machine Auto Detail weather alert for ${formattedTime}:

${severityText} forecasted. ${actionText}

Reschedule easily: ${rescheduleLink}

Or reply RESCHEDULE for help, or KEEP to continue.

Questions? Text back or call (918) 856-5304
`;

  // Send SMS weather alert using Main Line (ID 1) for automated weather alerts
  const smsResult = await sendSMS(tenantDb, phone, weatherAlertMessage, undefined, undefined, 1);

  // Send email weather alert if email is provided
  let emailResult = { success: false };
  if (email) {
    // Create email subject based on severity
    const subject = `Weather Alert for Your Clean Machine Appointment - ${formattedTime}`;

    // Basic email content (this would be replaced with a proper HTML template)
    const emailContent = {
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Weather Update for Your Appointment</h2>
          <p>Hi ${name},</p>
          <p>${severityText} for your scheduled appointment time.</p>

          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Weather Forecast</h3>
            <p><strong>Date:</strong> ${formattedTime}</p>
            <p><strong>Service:</strong> ${service}</p>
            <p><strong>Precipitation Chance:</strong> ${severityText}</p>
            <p><strong>Action:</strong> ${actionText}</p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="https://${process.env.REPL_SLUG || 'your-repl'}.replit.app/schedule" 
               style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              View Available Dates
            </a>
          </div>

          <p>If you have any questions, please don't hesitate to reach out.</p>

          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            Best regards,<br>
            Clean Machine Tulsa
          </p>
        </div>
      `,
    };

    try {
      // For now, just use a basic email send until we create a weather alert email template
      emailResult = await sendEmail(email, subject, emailContent.html);
    } catch (error) {
      console.error('Error sending weather alert email:', error);
    }
  }

  return {
    sms: smsResult.success,
    email: emailResult.success
  };
}

/**
 * Format a phone number to E.164 format for Twilio
 */
function formatPhoneNumber(phoneNumber: string): string {
  // Remove any non-digit characters
  let cleaned = phoneNumber.replace(/\D/g, '');

  // Handle test phone numbers for development
  if (cleaned === '5551234567') {
    return process.env.MAIN_PHONE_NUMBER || '+15551234567'; // Use our own number for testing
  }

  // If the number doesn't start with a country code, add US country code (1)
  if (cleaned.length === 10) {
    cleaned = '1' + cleaned;
  }

  // Add the plus sign for E.164 format
  if (!cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }

  return cleaned;
}