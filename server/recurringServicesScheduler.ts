import cron from 'node-cron';
import { db } from './db';
import { wrapTenantDb } from './tenantDb';
import { recurringServices, appointments, customers, services } from '@shared/schema';
import { eq, and, lte, gte } from 'drizzle-orm';
import { addDays, addWeeks, addMonths, addYears, format } from 'date-fns';
import { processDepositReminders } from './depositManager';
import { recordAppointmentCreated } from './customerBookingStats';
import { getTenantTimezone, setLocalTimeAndConvertToUtc } from './timezoneUtils';

/**
 * Calculate the next scheduled date based on frequency
 */
function calculateNextDate(currentDate: Date, frequency: string): Date {
  const date = new Date(currentDate);
  
  switch (frequency) {
    case 'weekly':
      return addWeeks(date, 1);
    case 'biweekly':
      return addWeeks(date, 2);
    case 'monthly':
      return addMonths(date, 1);
    case 'quarterly':
      return addMonths(date, 3);
    case 'every_3_months':
      return addMonths(date, 3);
    case 'every_6_months':
      return addMonths(date, 6);
    case 'yearly':
      return addYears(date, 1);
    default:
      return addMonths(date, 1); // Default to monthly
  }
}

/**
 * Process recurring services and create appointments for due services
 */
async function processRecurringServices() {
  const tenantDb = wrapTenantDb(db, 'root');
  
  try {
    console.log('[RECURRING] Starting recurring services processing...');
    
    // Get today's date (start of day)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find all active recurring services that are due (nextScheduledDate <= today)
    const dueServices = await tenantDb
      .select({
        recurringService: recurringServices,
        customer: customers,
        service: services,
      })
      .from(recurringServices)
      .leftJoin(customers, eq(recurringServices.customerId, customers.id))
      .leftJoin(services, eq(recurringServices.serviceId, services.id))
      .where(
        tenantDb.withTenantFilter(recurringServices,
          and(
            eq(recurringServices.status, 'active'),
            lte(recurringServices.nextScheduledDate, today.toISOString().split('T')[0])
          )
        )
      );

    if (dueServices.length === 0) {
      console.log('[RECURRING] No due recurring services found');
      return;
    }

    console.log(`[RECURRING] Found ${dueServices.length} due recurring services`);

    let createdCount = 0;
    let errorCount = 0;

    for (const { recurringService, customer, service } of dueServices) {
      try {
        if (!customer || !service) {
          console.error(`[RECURRING] Missing customer or service for recurring service ${recurringService.id}`);
          errorCount++;
          continue;
        }

        // Create the scheduled time for the appointment
        // Use preferred time if provided, otherwise default to 9:00 AM
        // TIMEZONE FIX: Convert tenant-local time to UTC for storage
        const timezone = await getTenantTimezone(tenantDb);
        const baseDate = new Date(recurringService.nextScheduledDate);
        let hours = 9; // Default to 9:00 AM local time
        let minutes = 0;
        
        if (recurringService.preferredTime) {
          // Parse preferred time (e.g., "9:00 AM", "2:30 PM")
          const timeMatch = recurringService.preferredTime.match(/(\d{1,2}):?(\d{2})?\s*(AM|PM)?/i);
          if (timeMatch) {
            hours = parseInt(timeMatch[1]);
            minutes = parseInt(timeMatch[2] || '0');
            const meridiem = timeMatch[3]?.toUpperCase();

            if (meridiem === 'PM' && hours !== 12) hours += 12;
            if (meridiem === 'AM' && hours === 12) hours = 0;
          }
        }
        
        // Convert tenant-local time to UTC for database storage
        const scheduledDate = setLocalTimeAndConvertToUtc(baseDate, hours, minutes, timezone);

        // Create the appointment - wrap in transaction with stats update and recurring service update
        await tenantDb.transaction(async (tx) => {
          const txTenantDb = wrapTenantDb(tx, 'root');
          
          const [newAppointment] = await txTenantDb
            .insert(appointments)
            .values({
              customerId: customer.id,
              serviceId: service.id,
              scheduledTime: scheduledDate,
              address: customer.address || '',
              completed: false,
              reminderSent: false,
            })
            .returning();

          console.log(`[SCHEDULING] Booking created eventId=${newAppointment.id} (stats_write=attempting)`);

          // Track booking stats for customer - in same transaction (fail-open)
          const statsRecorded = await recordAppointmentCreated(customer.id, scheduledDate, tx, {
            tenantId: 'root',
            phone: customer.phone,
            service: service.name,
            eventId: String(newAppointment.id)
          });
          
          const statsMsg = statsRecorded ? 'recorded=true' : 'recorded=false reason=transaction-failed';
          console.log(`[BOOKING STATS] ${statsMsg} eventId=${newAppointment.id}`);

          console.log(`[RECURRING] Created appointment ${newAppointment.id} for ${customer.name} - ${service.name}`);

          // Calculate next scheduled date
          const nextDate = calculateNextDate(
            new Date(recurringService.nextScheduledDate),
            recurringService.frequency
          );

          // Update the recurring service - in same transaction
          await txTenantDb
            .update(recurringServices)
            .set({
              nextScheduledDate: nextDate.toISOString().split('T')[0],
              lastAppointmentCreatedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(txTenantDb.withTenantFilter(recurringServices, eq(recurringServices.id, recurringService.id)));

          console.log(`[RECURRING] Updated recurring service ${recurringService.id}, next date: ${nextDate.toISOString().split('T')[0]}`);
        });
        
        createdCount++;
      } catch (error) {
        console.error(`[RECURRING] Error processing recurring service ${recurringService.id}:`, error);
        errorCount++;
      }
    }

    console.log(`[RECURRING] Processing complete: ${createdCount} appointments created, ${errorCount} errors`);
  } catch (error) {
    console.error('[RECURRING] Error in processRecurringServices:', error);
  }
}

// Singleton guard to prevent duplicate cron job registration
let schedulerInitialized = false;

/**
 * Initialize recurring services scheduler
 * Runs every day at midnight (00:00)
 */
export function initializeRecurringServicesScheduler() {
  if (schedulerInitialized) {
    console.log('[RECURRING] Scheduler already initialized, skipping...');
    return;
  }

  // Run every day at midnight
  cron.schedule('0 0 * * *', async () => {
    console.log('[RECURRING] Running scheduled task: processing recurring services');
    await processRecurringServices();
  });

  schedulerInitialized = true;
  console.log('[RECURRING] Scheduler initialized - will run daily at midnight');
  
  // Also run immediately on startup for testing (optional - can be removed in production)
  // processRecurringServices();
}

/**
 * Process recurring service reminders
 * Sends reminders 3 days before and 1 day before appointments
 */
async function processRecurringServiceReminders() {
  const tenantDb = wrapTenantDb(db, 'root');
  
  try {
    console.log('[RECURRING] Checking for appointments needing reminders...');
    
    const now = new Date();
    
    // Calculate dates for 3-day and 1-day reminders
    const threeDaysFromNow = new Date(now);
    threeDaysFromNow.setDate(now.getDate() + 3);
    threeDaysFromNow.setHours(0, 0, 0, 0);
    
    const threeDaysEnd = new Date(threeDaysFromNow);
    threeDaysEnd.setHours(23, 59, 59, 999);
    
    const oneDayFromNow = new Date(now);
    oneDayFromNow.setDate(now.getDate() + 1);
    oneDayFromNow.setHours(0, 0, 0, 0);
    
    const oneDayEnd = new Date(oneDayFromNow);
    oneDayEnd.setHours(23, 59, 59, 999);

    // Import notification service
    const { sendSMS } = await import('./notifications');
    const { sendReminderEmail } = await import('./emailService');

    // Get appointments that need 3-day reminders
    const threeDayReminders = await tenantDb
      .select({
        appointment: appointments,
        customer: customers,
        service: services,
      })
      .from(appointments)
      .leftJoin(customers, eq(appointments.customerId, customers.id))
      .leftJoin(services, eq(appointments.serviceId, services.id))
      .where(
        tenantDb.withTenantFilter(appointments,
          and(
            eq(appointments.completed, false),
            gte(appointments.scheduledTime, threeDaysFromNow),
            lte(appointments.scheduledTime, threeDaysEnd)
          )
        )
      );

    // Get appointments that need 1-day reminders
    const oneDayReminders = await tenantDb
      .select({
        appointment: appointments,
        customer: customers,
        service: services,
      })
      .from(appointments)
      .leftJoin(customers, eq(appointments.customerId, customers.id))
      .leftJoin(services, eq(appointments.serviceId, services.id))
      .where(
        tenantDb.withTenantFilter(appointments,
          and(
            eq(appointments.completed, false),
            eq(appointments.reminderSent, false),
            gte(appointments.scheduledTime, oneDayFromNow),
            lte(appointments.scheduledTime, oneDayEnd)
          )
        )
      );

    let remindersCount = 0;

    // Send 3-day reminders
    for (const { appointment, customer, service } of threeDayReminders) {
      if (!customer || !service) continue;

      const formattedTime = format(new Date(appointment.scheduledTime), 'EEEE, MMM d, yyyy \'at\' h:mm a');
      
      const message = `Hi ${customer.name}, this is Clean Machine Auto Detail. Just a reminder that you have a ${service.name} appointment in 3 days on ${formattedTime} at ${appointment.address}.\n\nLooking forward to servicing your vehicle!\n\nTo reschedule or cancel, reply to this message or call (918) 856-5304.`;

      // Use Main Line (ID 1) for automated 3-day reminders
      await sendSMS(customer.phone, message, undefined, undefined, 1);
      console.log(`[RECURRING] Sent 3-day reminder to ${customer.name} for appointment ${appointment.id}`);
      remindersCount++;
    }

    // Send 1-day reminders
    for (const { appointment, customer, service } of oneDayReminders) {
      if (!customer || !service) continue;

      const formattedTime = format(new Date(appointment.scheduledTime), 'EEEE, MMM d, yyyy \'at\' h:mm a');
      
      const smsMessage = `Hi ${customer.name}, this is Clean Machine Auto Detail reminding you of your ${service.name} appointment tomorrow at ${formattedTime} at ${appointment.address}.\n\nWe're ready to make your vehicle shine!\n\nQuestions? Reply or call (918) 856-5304.\n\nDirections: https://cleanmachine.app/directions?address=${encodeURIComponent(appointment.address)}`;

      // Use Main Line (ID 1) for automated 1-day reminders
      await sendSMS(customer.phone, smsMessage, undefined, undefined, 1);

      // Send email if available
      if (customer.email) {
        await sendReminderEmail(
          customer.email,
          customer.name,
          service.name,
          formattedTime,
          appointment.address,
          appointment.additionalRequests || [],
          'your vehicle'
        );
      }

      // Mark reminder as sent
      await tenantDb
        .update(appointments)
        .set({ reminderSent: true })
        .where(tenantDb.withTenantFilter(appointments, eq(appointments.id, appointment.id)));

      console.log(`[RECURRING] Sent 1-day reminder to ${customer.name} for appointment ${appointment.id}`);
      remindersCount++;
    }

    console.log(`[RECURRING] Reminders processing complete: ${remindersCount} reminders sent`);
  } catch (error) {
    console.error('[RECURRING] Error in processRecurringServiceReminders:', error);
  }
}

// Singleton guard for reminders to prevent duplicate cron job registration
let reminderSchedulerInitialized = false;
let depositReminderSchedulerInitialized = false;
let escalationExpirySchedulerInitialized = false;

/**
 * Initialize recurring services reminder scheduler
 * Runs every 2 hours to check for appointments needing reminders
 */
export function initializeRecurringServiceReminders() {
  if (reminderSchedulerInitialized) {
    console.log('[RECURRING] Reminder scheduler already initialized, skipping...');
    return;
  }

  // Run every 2 hours
  cron.schedule('0 */2 * * *', async () => {
    console.log('[RECURRING] Running scheduled task: checking appointment reminders');
    await processRecurringServiceReminders();
  });

  reminderSchedulerInitialized = true;
  console.log('[RECURRING] Reminder scheduler initialized - will run every 2 hours');
}

/**
 * Initialize deposit reminder scheduler
 * Runs every 4 hours to check for unpaid deposits needing reminders
 */
export function initializeDepositReminders() {
  if (depositReminderSchedulerInitialized) {
    console.log('[DEPOSIT] Reminder scheduler already initialized, skipping...');
    return;
  }

  // Run every 4 hours
  cron.schedule('0 */4 * * *', async () => {
    console.log('[DEPOSIT] Running scheduled task: checking deposit reminders');
    const { wrapTenantDb } = await import('./tenantDb');
    const { db } = await import('./db');
    const tenantDb = wrapTenantDb(db, 'root');
    await processDepositReminders(tenantDb);
  });

  depositReminderSchedulerInitialized = true;
  console.log('[DEPOSIT] Reminder scheduler initialized - will run every 4 hours');
}

/**
 * Initialize escalation expiry scheduler
 * Runs every hour to expire old escalation requests
 */
export function initializeEscalationExpiry() {
  if (escalationExpirySchedulerInitialized) {
    console.log('[ESCALATION] Expiry scheduler already initialized, skipping...');
    return;
  }

  // Run every hour
  cron.schedule('0 * * * *', async () => {
    console.log('[ESCALATION] Running scheduled task: checking for expired escalations');
    const { expireOldEscalations } = await import('./escalationService');
    const { wrapTenantDb } = await import('./tenantDb');
    const { db } = await import('./db');
    const tenantDb = wrapTenantDb(db, 'root');
    await expireOldEscalations(tenantDb);
  });

  escalationExpirySchedulerInitialized = true;
  console.log('[ESCALATION] Expiry scheduler initialized - will run every hour');
}

// Export for manual testing
export { processRecurringServices, processRecurringServiceReminders };
