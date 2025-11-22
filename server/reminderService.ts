import type { TenantDb } from './tenantDb';
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
import { generateReminderMessage, appendActionLinks } from './gptPersonalizationService';

/**
 * Identify customers who need service reminders based on their last appointment
 * and enabled reminder rules
 */
export async function identifyCustomersNeedingReminders(tenantDb: TenantDb) {
  try {
    console.log('[REMINDER SERVICE] Identifying customers needing reminders...');

    // Get all enabled reminder rules (without relations to avoid Drizzle error)
    const enabledRules = await tenantDb.query.reminderRules.findMany({
      where: tenantDb.withTenantFilter(reminderRules, eq(reminderRules.enabled, true))
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
      const lastAppointmentsQuery = tenantDb
        .select({
          customerId: appointments.customerId,
          lastServiceDate: sql<Date>`MAX(${appointments.scheduledTime})`.as('last_service_date'),
          serviceId: appointments.serviceId,
        })
        .from(appointments)
        .where(
          tenantDb.withTenantFilter(appointments, and(
            eq(appointments.completed, true),
            rule.serviceId ? eq(appointments.serviceId, rule.serviceId) : sql`true`
          ))
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
        const customer = await tenantDb.query.customers.findFirst({
          where: tenantDb.withTenantFilter(customers, eq(customers.id, appt.customerId))
        });

        const service = await tenantDb.query.services.findFirst({
          where: tenantDb.withTenantFilter(services, eq(services.id, appt.serviceId))
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
        const existingJobs = await tenantDb.query.reminderJobs.findMany({
          where: tenantDb.withTenantFilter(reminderJobs, and(
            eq(reminderJobs.customerId, appt.customerId),
            eq(reminderJobs.ruleId, rule.id),
            or(
              eq(reminderJobs.status, 'pending'),
              eq(reminderJobs.status, 'sent')
            )
          ))
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
 * 
 * BUG FIX #1: Always appends action links after job creation
 * This ensures ALL reminders have booking, snooze, and opt-out links
 */
export async function createReminderJob(
  tenantDb: TenantDb,
  customerId: number,
  ruleId: number,
  scheduledFor: Date = new Date(),
  messageContent?: string
): Promise<number> {
  try {
    // BUG FIX #1: Use fallback WITHOUT ${data.link} placeholder
    if (!messageContent) {
      console.warn('[CREATE JOB] No message content provided, using generic fallback');
      messageContent = `Hi! It's time for your next auto detail service. Book online or call Clean Machine today!`;
    }

    // Create job with initial message
    const [job] = await tenantDb
      .insert(reminderJobs)
      .values({
        customerId,
        ruleId,
        scheduledFor,
        messageContent,
        status: 'pending',
        attemptsCount: 0,
      })
      .returning();

    console.log(`[REMINDER SERVICE] Created reminder job ${job.id} for customer ${customerId}`);

    // BUG FIX #1: ALWAYS append action links after job creation
    const messageWithLinks = appendActionLinks(messageContent, customerId, job.id);
    
    // Update job with links
    await tenantDb
      .update(reminderJobs)
      .set({ messageContent: messageWithLinks })
      .where(tenantDb.withTenantFilter(reminderJobs, eq(reminderJobs.id, job.id)));
    
    console.log(`[REMINDER SERVICE] ✅ Added action links to job ${job.id}`);

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
  tenantDb: TenantDb,
  status?: 'pending' | 'sent' | 'failed' | 'snoozed' | 'cancelled',
  limit: number = 100
) {
  try {
    const baseCondition = status ? eq(reminderJobs.status, status) : sql`true`;
    
    const jobs = await tenantDb.query.reminderJobs.findMany({
      where: tenantDb.withTenantFilter(reminderJobs, baseCondition),
      orderBy: desc(reminderJobs.scheduledFor),
      limit
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
  tenantDb: TenantDb,
  jobId: number,
  channel: 'sms' | 'email' | 'push'
): Promise<boolean> {
  try {
    // Update job status
    await tenantDb
      .update(reminderJobs)
      .set({
        status: 'sent',
        sentAt: new Date(),
        lastAttemptAt: new Date(),
      })
      .where(tenantDb.withTenantFilter(reminderJobs, eq(reminderJobs.id, jobId)));

    // Get job details for event logging
    const job = await tenantDb.query.reminderJobs.findFirst({
      where: tenantDb.withTenantFilter(reminderJobs, eq(reminderJobs.id, jobId))
    });

    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    // Create reminder event
    await tenantDb.insert(reminderEvents).values({
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
  tenantDb: TenantDb,
  jobId: number,
  errorMessage: string
): Promise<boolean> {
  try {
    // Get current job to increment attempts
    const job = await tenantDb.query.reminderJobs.findFirst({
      where: tenantDb.withTenantFilter(reminderJobs, eq(reminderJobs.id, jobId))
    });

    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    // Update job status
    await tenantDb
      .update(reminderJobs)
      .set({
        status: 'failed',
        errorMessage,
        lastAttemptAt: new Date(),
        attemptsCount: (job.attemptsCount || 0) + 1,
      })
      .where(tenantDb.withTenantFilter(reminderJobs, eq(reminderJobs.id, jobId)));

    // Create reminder event
    await tenantDb.insert(reminderEvents).values({
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
 * Fetch current weather for Tulsa, OK
 */
async function fetchWeather(): Promise<{ temperature: number; condition: string }> {
  try {
    const response = await fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=36.15&longitude=-95.99&current_weather=true&temperature_unit=fahrenheit'
    );
    
    if (!response.ok) {
      throw new Error(`Weather API returned ${response.status}`);
    }
    
    const data = await response.json();
    
    return {
      temperature: Math.round(data.current_weather?.temperature || 65),
      condition: mapWeatherCode(data.current_weather?.weathercode || 0),
    };
  } catch (error) {
    console.error('[REMINDER SERVICE] Error fetching weather:', error);
    return { temperature: 65, condition: 'clear' };
  }
}

/**
 * Map weather code to human-readable condition
 */
function mapWeatherCode(code: number): string {
  if (code === 0) return 'clear';
  if (code <= 3) return 'partly cloudy';
  if (code <= 49) return 'foggy';
  if (code <= 69) return 'rainy';
  if (code <= 79) return 'snowy';
  if (code <= 99) return 'stormy';
  return 'clear';
}

/**
 * Main function to process proactive reminders
 * Called by cron job every 6 hours
 */
export async function processProactiveReminders(tenantDb: TenantDb) {
  try {
    console.log('[PROACTIVE REMINDERS] Starting proactive reminder processing...');

    // Identify customers needing reminders
    const customersNeedingReminders = await identifyCustomersNeedingReminders(tenantDb);

    if (customersNeedingReminders.length === 0) {
      console.log('[PROACTIVE REMINDERS] No customers need reminders at this time');
      return { created: 0, errors: 0 };
    }

    // Fetch weather once for all reminders
    const weather = await fetchWeather();
    const weatherToday = `${weather.condition} and ${weather.temperature}°F`;

    let createdCount = 0;
    let errorCount = 0;

    // Create reminder jobs for each customer
    for (const customer of customersNeedingReminders) {
      // PHASE 4D: Skip customers who have opted out of reminders
      const { reminderOptOuts } = await import('@shared/schema');
      const optOut = await tenantDb.query.reminderOptOuts.findFirst({
        where: tenantDb.withTenantFilter(reminderOptOuts, eq(reminderOptOuts.customerId, customer.customerId))
      });
      
      if (optOut) {
        console.log(`[PROACTIVE REMINDERS] ⏭️ Skipping customer ${customer.customerId} - opted out on ${optOut.optedOutAt?.toISOString()}`);
        continue;
      }
      
      // PHASE 4D: Skip customers with active snoozes
      const { reminderSnoozes } = await import('@shared/schema');
      const { and: andOp, gte } = await import('drizzle-orm');
      
      const activeSnooze = await tenantDb.query.reminderSnoozes.findFirst({
        where: tenantDb.withTenantFilter(reminderSnoozes, andOp(
          eq(reminderSnoozes.customerId, customer.customerId),
          gte(reminderSnoozes.snoozedUntil, new Date())
        ))
      });
      
      if (activeSnooze) {
        console.log(`[PROACTIVE REMINDERS] ⏭️ Skipping customer ${customer.customerId} - snoozed until ${activeSnooze.snoozedUntil?.toISOString()}`);
        continue;
      }
      
      // Get full customer details with loyalty tier
      const customerData = await tenantDb.query.customers.findFirst({
        where: tenantDb.withTenantFilter(customers, eq(customers.id, customer.customerId))
      });

      if (!customerData) {
        console.error(`[PROACTIVE REMINDERS] Customer ${customer.customerId} not found`);
        errorCount++;
        continue;
      }

      // Get recommended service details
      const rule = await tenantDb.query.reminderRules.findFirst({
        where: tenantDb.withTenantFilter(reminderRules, eq(reminderRules.id, customer.ruleId))
      });

      // Get service details separately if serviceId exists
      let recommendedService = 'maintenance detail';
      let recommendedServicePrice = '$150-200';
      
      if (rule?.serviceId) {
        const service = await tenantDb.query.services.findFirst({
          where: tenantDb.withTenantFilter(services, eq(services.id, rule.serviceId))
        });
        if (service) {
          recommendedService = service.name;
          recommendedServicePrice = service.priceRange || '$150-200';
        }
      }

      // PHASE 4D: Create job first to get jobId for action links
      try {
        const scheduledFor = new Date();
        const fallbackMessage = `Hi! It's time for your next auto detail service. Book online or call Clean Machine today!`;
        
        // Create job with fallback message first
        const jobId = await createReminderJob(
          tenantDb,
          customer.customerId,
          customer.ruleId,
          scheduledFor,
          fallbackMessage
        );

        // Now generate personalized message WITH jobId for action links
        let reminderMessage: string;
        try {
          reminderMessage = await generateReminderMessage(
            {
              id: customerData.id,
              name: customerData.name,
              phone: customerData.phone || '',
              loyaltyTier: customerData.loyaltyTier || 'bronze',
              lifetimeValue: customerData.lifetimeValue || '0.00',
            },
            {
              lastServiceDate: customer.lastAppointmentDate,
              lastServiceName: customer.serviceName,
              daysSinceService: customer.daysSinceLastService,
              recommendedService,
              recommendedServicePrice,
              weatherToday,
            },
            jobId  // PHASE 4D: Pass jobId for action links
          );
          
          // Update job with personalized message
          await tenantDb.update(reminderJobs)
            .set({ messageContent: reminderMessage })
            .where(tenantDb.withTenantFilter(reminderJobs, eq(reminderJobs.id, jobId)));
            
        } catch (error) {
          console.error('[PROACTIVE REMINDERS] GPT error, keeping fallback message:', error);
          errorCount++;
          // Job already created with fallback message, no need to update
        }

        createdCount++;
        console.log(
          `[PROACTIVE REMINDERS] ✅ Created reminder job ${jobId} for ${customer.customerName} - ` +
          `${customer.serviceName} (${customer.daysSinceLastService} days since service)`
        );
      } catch (error) {
        errorCount++;
        console.error(
          `[PROACTIVE REMINDERS] Error creating job for customer ${customer.customerId}:`,
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
export async function seedDefaultReminderRules(tenantDb: TenantDb) {
  try {
    console.log('[REMINDER SERVICE] Skipping reminder rule seeding (temporarily disabled during tenant migration)');
    // TODO: Re-enable after Phase 1G completion
    // This function will be re-enabled in the next migration phase
    return;

    // Rule 1: Maintenance Detail Reminder (3 months)
    if (maintenanceDetail) {
      await tenantDb.insert(reminderRules).values({
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
      await tenantDb.insert(reminderRules).values({
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
      await tenantDb.insert(reminderRules).values({
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
    await tenantDb.insert(reminderRules).values({
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
