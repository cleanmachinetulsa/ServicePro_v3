import { db } from './db';
import { 
  reminderRules, 
  reminderJobs, 
  reminderEvents,
  appointments,
  customers,
  services,
  type ReminderRule,
  type ReminderJob,
  type InsertReminderJob,
  type InsertReminderEvent
} from '@shared/schema';
import { eq, and, sql, desc, lte, gte, isNull, or } from 'drizzle-orm';
import { addDays, subDays, differenceInDays } from 'date-fns';
import cron from 'node-cron';

/**
 * Identify customers who need service reminders based on their last appointment
 * and enabled reminder rules
 */
export async function identifyCustomersNeedingReminders() {
  try {
    console.log('[REMINDER SERVICE] Identifying customers needing reminders...');

    // Get all enabled reminder rules
    const enabledRules = await db.query.reminderRules.findMany({
      where: eq(reminderRules.enabled, true),
      with: {
        service: true,
      },
    });

    if (enabledRules.length === 0) {
      console.log('[REMINDER SERVICE] No enabled reminder rules found');
      return [];
    }

    console.log(`[REMINDER SERVICE] Found ${enabledRules.length} enabled rules`);

    const customersNeedingReminders: Array<{
      customerId: number;
      customerName: string;
      customerEmail: string | null;
      customerPhone: string | null;
      lastAppointmentDate: Date;
      serviceId: number;
      serviceName: string;
      ruleId: number;
      ruleName: string;
      daysSinceLastService: number;
    }> = [];

    // For each rule, find customers who need reminders
    for (const rule of enabledRules) {
      console.log(`[REMINDER SERVICE] Processing rule: ${rule.name} (ID: ${rule.id})`);

      // Calculate the trigger parameters for this rule
      // triggerIntervalDays = days after last service to send reminder
      // reminderWindowDays = how many days before due date to start sending
      const triggerDays = rule.triggerIntervalDays || 90;
      const windowDays = rule.reminderWindowDays || 7;

      // CORRECT APPROACH: Find latest appointment FIRST (without date filtering),
      // THEN check if it falls in the trigger window
      const lastAppointmentsQuery = db
        .select({
          customerId: appointments.customerId,
          lastServiceDate: sql<Date>`MAX(${appointments.scheduledTime})`.as('last_service_date'),
          serviceId: appointments.serviceId,
        })
        .from(appointments)
        .where(
          and(
            eq(appointments.completed, true),
            rule.serviceId ? eq(appointments.serviceId, rule.serviceId) : sql`true`
          )
        )
        .groupBy(appointments.customerId, appointments.serviceId);

      const lastAppointments = await lastAppointmentsQuery;

      // Filter to find customers whose LATEST service date is in the trigger window
      const eligibleAppointments = lastAppointments.filter(appt => {
        const daysSinceService = differenceInDays(new Date(), new Date(appt.lastServiceDate));
        // Customer is eligible if their last service was >= triggerDays ago
        // and <= (triggerDays + windowDays) ago (within the reminder window)
        return daysSinceService >= triggerDays && daysSinceService <= (triggerDays + windowDays);
      });

      console.log(`[REMINDER SERVICE] Found ${eligibleAppointments.length} eligible customers for rule ${rule.name}`);

      // Now fetch customer and service details for each eligible appointment
      const matchingAppointments = [];
      for (const appt of eligibleAppointments) {
        const customer = await db.query.customers.findFirst({
          where: eq(customers.id, appt.customerId),
        });

        const service = await db.query.services.findFirst({
          where: eq(services.id, appt.serviceId),
        });

        if (!customer || !service) {
          console.log(`[REMINDER SERVICE] Skipping - customer or service not found for appointment`);
          continue;
        }

        matchingAppointments.push({
          customerId: customer.id,
          customerName: customer.name,
          customerEmail: customer.email,
          customerPhone: customer.phone,
          lastAppointmentDate: new Date(appt.lastServiceDate),
          serviceId: service.id,
          serviceName: service.name,
          smsConsent: customer.smsConsent,
        });
      }

      // For each matching customer, check if they already have a pending reminder
      for (const appt of matchingAppointments) {
        // Skip customers who haven't opted into SMS (if we're planning to send SMS)
        if (!appt.smsConsent && !appt.customerEmail) {
          console.log(`[REMINDER SERVICE] Skipping customer ${appt.customerId} - no SMS consent and no email`);
          continue;
        }

        // Check if customer already has a pending/sent reminder for this service
        const existingJobs = await db.query.reminderJobs.findMany({
          where: and(
            eq(reminderJobs.customerId, appt.customerId),
            eq(reminderJobs.ruleId, rule.id),
            or(
              eq(reminderJobs.status, 'pending'),
              eq(reminderJobs.status, 'sent')
            )
          ),
        });

        if (existingJobs.length > 0) {
          console.log(`[REMINDER SERVICE] Customer ${appt.customerId} already has reminder for rule ${rule.id}`);
          continue;
        }

        const daysSinceService = differenceInDays(new Date(), new Date(appt.lastAppointmentDate));

        customersNeedingReminders.push({
          customerId: appt.customerId,
          customerName: appt.customerName,
          customerEmail: appt.customerEmail,
          customerPhone: appt.customerPhone,
          lastAppointmentDate: new Date(appt.lastAppointmentDate),
          serviceId: appt.serviceId,
          serviceName: appt.serviceName,
          ruleId: rule.id,
          ruleName: rule.name,
          daysSinceLastService: daysSinceService,
        });
      }
    }

    console.log(`[REMINDER SERVICE] Total customers needing reminders: ${customersNeedingReminders.length}`);
    return customersNeedingReminders;
  } catch (error) {
    console.error('[REMINDER SERVICE] Error identifying customers:', error);
    throw error;
  }
}

/**
 * Create a new reminder job for a customer
 */
export async function createReminderJob(
  customerId: number,
  ruleId: number,
  scheduledFor: Date = new Date()
): Promise<number> {
  try {
    const [job] = await db
      .insert(reminderJobs)
      .values({
        customerId,
        ruleId,
        scheduledFor,
        status: 'pending',
        attemptsCount: 0,
      })
      .returning();

    console.log(`[REMINDER SERVICE] Created reminder job ${job.id} for customer ${customerId}`);
    return job.id;
  } catch (error) {
    console.error('[REMINDER SERVICE] Error creating reminder job:', error);
    throw error;
  }
}

/**
 * Get reminder jobs filtered by status
 */
export async function getReminderJobs(
  status?: 'pending' | 'sent' | 'failed' | 'snoozed' | 'cancelled',
  limit: number = 100
) {
  try {
    const jobs = await db.query.reminderJobs.findMany({
      where: status ? eq(reminderJobs.status, status) : undefined,
      with: {
        customer: true,
        rule: {
          with: {
            service: true,
          },
        },
      },
      orderBy: [desc(reminderJobs.scheduledFor)],
      limit,
    });

    return jobs;
  } catch (error) {
    console.error('[REMINDER SERVICE] Error getting reminder jobs:', error);
    throw error;
  }
}

/**
 * Mark a reminder job as successfully sent
 */
export async function markReminderSent(
  jobId: number,
  channel: 'sms' | 'email' | 'push'
): Promise<boolean> {
  try {
    // Update job status
    await db
      .update(reminderJobs)
      .set({
        status: 'sent',
        sentAt: new Date(),
        lastAttemptAt: new Date(),
      })
      .where(eq(reminderJobs.id, jobId));

    // Get job details for event logging
    const job = await db.query.reminderJobs.findFirst({
      where: eq(reminderJobs.id, jobId),
    });

    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    // Create reminder event
    await db.insert(reminderEvents).values({
      jobId,
      customerId: job.customerId,
      eventType: 'sent',
      channel,
      messageContent: null, // Can be populated if we track message content
      metadata: { sentAt: new Date().toISOString() },
    });

    console.log(`[REMINDER SERVICE] Marked job ${jobId} as sent via ${channel}`);
    return true;
  } catch (error) {
    console.error('[REMINDER SERVICE] Error marking reminder as sent:', error);
    return false;
  }
}

/**
 * Mark a reminder job as failed
 */
export async function markReminderFailed(
  jobId: number,
  errorMessage: string
): Promise<boolean> {
  try {
    // Get current job to increment attempts
    const job = await db.query.reminderJobs.findFirst({
      where: eq(reminderJobs.id, jobId),
    });

    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    // Update job status
    await db
      .update(reminderJobs)
      .set({
        status: 'failed',
        errorMessage,
        lastAttemptAt: new Date(),
        attemptsCount: (job.attemptsCount || 0) + 1,
      })
      .where(eq(reminderJobs.id, jobId));

    // Create reminder event
    await db.insert(reminderEvents).values({
      jobId,
      customerId: job.customerId,
      eventType: 'failed',
      channel: 'sms', // Default to SMS, could be parameterized
      messageContent: null,
      metadata: { error: errorMessage, attemptCount: (job.attemptsCount || 0) + 1 },
    });

    console.log(`[REMINDER SERVICE] Marked job ${jobId} as failed: ${errorMessage}`);
    return true;
  } catch (error) {
    console.error('[REMINDER SERVICE] Error marking reminder as failed:', error);
    return false;
  }
}

/**
 * Main function to process proactive reminders
 * Called by cron job every 6 hours
 */
export async function processProactiveReminders() {
  try {
    console.log('[PROACTIVE REMINDERS] Starting proactive reminder processing...');

    // Identify customers needing reminders
    const customersNeedingReminders = await identifyCustomersNeedingReminders();

    if (customersNeedingReminders.length === 0) {
      console.log('[PROACTIVE REMINDERS] No customers need reminders at this time');
      return { created: 0, errors: 0 };
    }

    let createdCount = 0;
    let errorCount = 0;

    // Create reminder jobs for each customer
    for (const customer of customersNeedingReminders) {
      try {
        // Schedule for immediate sending (can be customized)
        const scheduledFor = new Date();

        await createReminderJob(
          customer.customerId,
          customer.ruleId,
          scheduledFor
        );

        createdCount++;
        console.log(
          `[PROACTIVE REMINDERS] Created reminder for ${customer.customerName} - ` +
          `${customer.serviceName} (${customer.daysSinceLastService} days since service)`
        );
      } catch (error) {
        errorCount++;
        console.error(
          `[PROACTIVE REMINDERS] Failed to create reminder for customer ${customer.customerId}:`,
          error
        );
      }
    }

    console.log(
      `[PROACTIVE REMINDERS] Processing complete: ${createdCount} reminders created, ${errorCount} errors`
    );

    return { created: createdCount, errors: errorCount };
  } catch (error) {
    console.error('[PROACTIVE REMINDERS] Error in processProactiveReminders:', error);
    return { created: 0, errors: 1 };
  }
}

/**
 * Seed default reminder rules
 * This is idempotent - only creates rules if they don't exist
 */
export async function seedDefaultReminderRules() {
  try {
    console.log('[REMINDER SERVICE] Seeding default reminder rules...');

    // Check if rules already exist
    const existingRules = await db.query.reminderRules.findMany();
    if (existingRules.length > 0) {
      console.log('[REMINDER SERVICE] Reminder rules already exist, skipping seed');
      return;
    }

    // Get service IDs for the default rules
    const maintenanceDetail = await db.query.services.findFirst({
      where: sql`LOWER(${services.name}) LIKE '%maintenance%detail%'`,
    });

    const fullDetail = await db.query.services.findFirst({
      where: sql`LOWER(${services.name}) LIKE '%full%detail%'`,
    });

    const ceramicCoating = await db.query.services.findFirst({
      where: sql`LOWER(${services.name}) LIKE '%ceramic%coating%'`,
    });

    // Rule 1: Maintenance Detail Reminder (3 months)
    if (maintenanceDetail) {
      await db.insert(reminderRules).values({
        name: 'Maintenance Detail - 3 Month Reminder',
        serviceId: maintenanceDetail.id,
        triggerType: 'time_since_last',
        triggerIntervalDays: 90, // 3 months
        reminderWindowDays: 7, // Send 7 days before due
        enabled: true,
      });
      console.log('[REMINDER SERVICE] Created Maintenance Detail reminder rule');
    }

    // Rule 2: Full Detail Annual Reminder (1 year)
    if (fullDetail) {
      await db.insert(reminderRules).values({
        name: 'Full Detail - Annual Reminder',
        serviceId: fullDetail.id,
        triggerType: 'time_since_last',
        triggerIntervalDays: 365, // 1 year
        reminderWindowDays: 14, // Send 14 days before due
        enabled: true,
      });
      console.log('[REMINDER SERVICE] Created Full Detail annual reminder rule');
    }

    // Rule 3: Ceramic Coating Check-in (6 months)
    if (ceramicCoating) {
      await db.insert(reminderRules).values({
        name: 'Ceramic Coating - 6 Month Check-in',
        serviceId: ceramicCoating.id,
        triggerType: 'time_since_last',
        triggerIntervalDays: 180, // 6 months
        reminderWindowDays: 7, // Send 7 days before due
        enabled: true,
      });
      console.log('[REMINDER SERVICE] Created Ceramic Coating check-in rule');
    }

    // Generic rule for all other services (6 months)
    await db.insert(reminderRules).values({
      name: 'General Service Reminder - 6 Months',
      serviceId: null, // Applies to all services
      triggerType: 'time_since_last',
      triggerIntervalDays: 180, // 6 months
      reminderWindowDays: 7,
      enabled: false, // Disabled by default to avoid spam
    });
    console.log('[REMINDER SERVICE] Created general service reminder rule (disabled)');

    console.log('[REMINDER SERVICE] Default reminder rules seeded successfully');
  } catch (error) {
    console.error('[REMINDER SERVICE] Error seeding reminder rules:', error);
    throw error;
  }
}

/**
 * Initialize proactive reminder scheduler
 * Runs every 6 hours to identify and create reminder jobs
 */
let schedulerInitialized = false;

export function initializeProactiveReminderScheduler() {
  if (schedulerInitialized) {
    console.log('[PROACTIVE REMINDERS] Scheduler already initialized, skipping...');
    return;
  }

  // Run every 6 hours to check for customers needing reminders
  cron.schedule('0 */6 * * *', async () => {
    console.log('[PROACTIVE REMINDERS] Running scheduled task');
    await processProactiveReminders();
  });

  schedulerInitialized = true;
  console.log('[PROACTIVE REMINDERS] Scheduler initialized - will run every 6 hours');
}
