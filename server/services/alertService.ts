/**
 * ALERT SERVICE
 * 
 * Centralized service for sending alerts to admin and urgent contacts.
 * Uses the phoneConfig for all phone number references.
 * 
 * Alert Levels:
 * - Admin: Non-urgent notifications sent to phoneAdmin (+19188565711)
 * - Urgent: Critical system alerts sent to ownerUrgent (+19182820103) - bypasses Twilio if needed
 */

import twilio from 'twilio';
import { phoneConfig } from '../config/phoneConfig';

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

/**
 * Send an admin notification SMS
 * Used for: new voicemails, escalations, quote approvals, etc.
 * 
 * SECURITY: Uses twilioMain (MAIN_PHONE_NUMBER) as sender.
 * This is an admin-only notification (TO admin), but still uses main number for FROM.
 * 
 * @param message - The message body
 * @returns true if sent successfully
 */
export async function sendAdminNotification(message: string): Promise<boolean> {
  if (!phoneConfig.phoneAdmin) {
    console.warn('[ALERT] No phoneAdmin configured - cannot send admin notification');
    return false;
  }

  // SECURITY: Use MAIN phone number for all sends, even admin notifications
  const fromNumber = phoneConfig.twilioMain;
  if (!fromNumber) {
    console.error('[ALERT] MAIN_PHONE_NUMBER not configured - cannot send admin notification');
    return false;
  }

  try {
    await client.messages.create({
      to: phoneConfig.phoneAdmin,
      from: fromNumber,
      body: `[Admin] ${message}`,
    });
    console.log('[ALERT] Sent admin notification to', phoneConfig.phoneAdmin);
    return true;
  } catch (err) {
    console.error('[ALERT] Failed to send admin notification', err);
    return false;
  }
}

/**
 * Send an URGENT system alert SMS
 * Used for: critical failures, Twilio down, database issues, etc.
 * Sent to the owner's personal AT&T line to ensure delivery even if Twilio is degraded.
 * 
 * SECURITY: Uses twilioMain (MAIN_PHONE_NUMBER) as sender.
 * 
 * @param message - The urgent message
 * @returns true if sent successfully
 */
export async function sendUrgentAlert(message: string): Promise<boolean> {
  if (!phoneConfig.ownerUrgent) {
    console.error('[URGENT ALERT] Missing ownerUrgent phone number - cannot send urgent alert');
    return false;
  }

  // SECURITY: Use MAIN phone number for all sends, even urgent alerts
  const fromNumber = phoneConfig.twilioMain;
  if (!fromNumber) {
    console.error('[URGENT ALERT] MAIN_PHONE_NUMBER not configured - cannot send urgent alert');
    return false;
  }

  try {
    await client.messages.create({
      to: phoneConfig.ownerUrgent,
      from: fromNumber,
      body: `[URGENT][ServicePro] ${message}`,
    });
    console.log('[URGENT ALERT] Sent urgent SMS to', phoneConfig.ownerUrgent);
    return true;
  } catch (err) {
    console.error('[URGENT ALERT] Failed to send urgent SMS', err);
    
    // TODO: Implement fallback via SendGrid email-to-SMS or alternate carrier
    // for cases where Twilio itself is down
    
    return false;
  }
}

/**
 * Send both admin notification and urgent alert
 * Used for critical issues that need immediate attention
 * 
 * @param message - The message body
 */
export async function sendCriticalAlert(message: string): Promise<void> {
  // Send to both admin and urgent lines
  await Promise.all([
    sendAdminNotification(`[CRITICAL] ${message}`),
    sendUrgentAlert(message),
  ]);
}

/**
 * Get the main customer-facing phone number
 * For use in customer-facing SMS/email templates
 */
export function getMainCustomerPhone(): string | null {
  return phoneConfig.twilioMain;
}

/**
 * Get formatted main phone for display
 * Returns "(918) 856-5304" format
 */
export function getMainCustomerPhoneDisplay(): string {
  if (!phoneConfig.twilioMain) return '';
  
  const digits = phoneConfig.twilioMain.replace(/^\+1/, '').replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phoneConfig.twilioMain;
}
