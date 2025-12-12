import { db } from '../db';
import { tenants } from '@shared/schema';
import { eq } from 'drizzle-orm';
import {
  findBookingsNeedingReminders,
  updateReminderSent,
  markAutoCanceled,
  type BookingsNeedingReminder,
} from './smsBookingRecordService';
import { truncateSmsResponse } from '../utils/smsLength';
import { formatInTimeZone } from 'date-fns-tz';

/**
 * Booking Confirmation Monitor
 * Runs hourly to send confirmation reminders and auto-cancel unconfirmed bookings
 * 
 * Gated by PLATFORM_BG_JOBS_ENABLED env var
 */

let twilioClient: any = null;

async function getTwilioClient() {
  if (!twilioClient) {
    const twilio = (await import('twilio')).default;
    twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
  }
  return twilioClient;
}

async function sendReminderSms(
  phone: string,
  message: string,
  fromNumber: string
): Promise<boolean> {
  try {
    const client = await getTwilioClient();
    await client.messages.create({
      to: phone,
      from: fromNumber,
      body: truncateSmsResponse(message),
    });
    return true;
  } catch (error) {
    console.error('[CONFIRM MONITOR] Failed to send SMS:', error);
    return false;
  }
}

async function cancelCalendarEvent(eventId: string): Promise<boolean> {
  try {
    const { deleteCalendarEvent } = await import('../calendarApi');
    await deleteCalendarEvent(eventId);
    return true;
  } catch (error) {
    console.error('[CONFIRM MONITOR] Failed to cancel calendar event:', error);
    return false;
  }
}

export async function runConfirmationMonitor(): Promise<void> {
  const autoCancelEnabled = process.env.AUTO_CANCEL_UNCONFIRMED === '1';
  const fromNumber = process.env.MAIN_PHONE_NUMBER || process.env.TWILIO_PHONE_NUMBER;
  const ownerPhone = process.env.BUSINESS_OWNER_PERSONAL_PHONE;
  
  if (!fromNumber) {
    console.warn('[CONFIRM MONITOR] No MAIN_PHONE_NUMBER or TWILIO_PHONE_NUMBER configured, skipping');
    return;
  }
  
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    console.warn('[CONFIRM MONITOR] Twilio credentials not configured, skipping');
    return;
  }
  
  // Get all tenants
  const allTenants = await db.select().from(tenants);
  
  let totalDue7d = 0;
  let totalDue48h = 0;
  let totalAutocancel = 0;
  
  for (const tenant of allTenants) {
    const tenantId = tenant.id;
    
    try {
      const reminders = await findBookingsNeedingReminders(tenantId);
      
      // Process 7-day reminders
      for (const record of reminders.due7Days) {
        const bookingDay = formatInTimeZone(new Date(record.startTime), 'America/Chicago', 'EEEE MMM d');
        const bookingTime = formatInTimeZone(new Date(record.startTime), 'America/Chicago', 'h:mm a');
        const message = `Reminder: Your ${record.service} is scheduled for ${bookingDay} at ${bookingTime}. Reply CONFIRM to keep this appointment.`;
        
        const sent = await sendReminderSms(record.phone, message, fromNumber);
        if (sent) {
          await updateReminderSent(tenantId, record.id);
          totalDue7d++;
        }
      }
      
      // Process 48-hour reminders
      for (const record of reminders.due48Hours) {
        const bookingDay = formatInTimeZone(new Date(record.startTime), 'America/Chicago', 'EEEE MMM d');
        const bookingTime = formatInTimeZone(new Date(record.startTime), 'America/Chicago', 'h:mm a');
        const message = `Your ${record.service} is coming up ${bookingDay} at ${bookingTime}. Reply CONFIRM or RESCHEDULE.`;
        
        const sent = await sendReminderSms(record.phone, message, fromNumber);
        if (sent) {
          await updateReminderSent(tenantId, record.id);
          totalDue48h++;
        }
      }
      
      // Process auto-cancellations (only if enabled)
      if (autoCancelEnabled) {
        for (const record of reminders.dueAutoCancel) {
          // Cancel calendar event FIRST - only mark auto-canceled if deletion succeeds
          const calendarDeleted = await cancelCalendarEvent(record.eventId);
          
          if (calendarDeleted) {
            // Mark as auto-canceled only after successful calendar deletion
            await markAutoCanceled(tenantId, record.id);
            
            // Notify customer
            const cancelMessage = `Your ${record.service} appointment has been canceled because it wasn't confirmed. Reply to reschedule.`;
            await sendReminderSms(record.phone, cancelMessage, fromNumber);
            
            // Notify owner (only if different from customer phone and configured)
            if (ownerPhone && ownerPhone !== record.phone) {
              const ownerMessage = `AUTO-CANCEL: ${record.service} for ${record.phone} was canceled (unconfirmed 24h before).`;
              await sendReminderSms(ownerPhone, ownerMessage, fromNumber);
            }
            
            totalAutocancel++;
          } else {
            console.error(`[AUTO CANCEL] Failed to delete calendar event ${record.eventId} - booking NOT canceled`);
          }
        }
      }
    } catch (error) {
      console.error(`[CONFIRM MONITOR] Error processing tenant ${tenantId}:`, error);
    }
  }
  
  console.log(`[CONFIRM MONITOR] tenant=${allTenants.length} due7d=${totalDue7d} due48h=${totalDue48h} autocancel=${totalAutocancel}`);
}

export function startConfirmationMonitorCron(): void {
  // STRICT: Only run if explicitly enabled (matches quiet mode contract)
  const bgJobsEnabled = process.env.PLATFORM_BG_JOBS_ENABLED === '1';
  
  if (!bgJobsEnabled) {
    console.log('[CONFIRM MONITOR] Disabled (PLATFORM_BG_JOBS_ENABLED !== 1)');
    return;
  }
  
  // Run every hour
  const intervalMs = 60 * 60 * 1000; // 1 hour
  
  console.log('[CONFIRM MONITOR] Starting hourly confirmation monitor');
  
  setInterval(async () => {
    try {
      await runConfirmationMonitor();
    } catch (error) {
      console.error('[CONFIRM MONITOR] Error in cron:', error);
    }
  }, intervalMs);
  
  // Also run immediately on startup (after a short delay)
  setTimeout(() => {
    runConfirmationMonitor().catch((err) => {
      console.error('[CONFIRM MONITOR] Error in initial run:', err);
    });
  }, 30000); // 30 second delay after startup
}
