import { db } from './db';
import { apiUsageLogs, serviceHealth } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';
import Stripe from 'stripe';
import OpenAI from 'openai';

// Initialize API clients
const twilioClient = require('twilio')(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-04-30.basil',
});

const OPENAI_ENABLED = !!process.env.OPENAI_API_KEY;
const openai = OPENAI_ENABLED ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

if (!OPENAI_ENABLED) {
  console.warn('[USAGE TRACKER] OpenAI API key not configured - OpenAI usage tracking will be skipped');
}

const sendgridApiKey = process.env.SENDGRID_API_KEY;

/**
 * Log API usage to database
 */
export async function logApiUsage(
  service: string,
  apiType: string,
  quantity: number,
  cost: number,
  metadata?: any,
  timestamp?: Date
) {
  try {
    await db.insert(apiUsageLogs).values({
      service,
      apiType,
      quantity,
      cost: cost.toString(),
      metadata,
      timestamp: timestamp || new Date(),
    });
    console.log(`[USAGE TRACKER] Logged ${service} ${apiType}: ${quantity} units, $${cost}`);
  } catch (error) {
    console.error('[USAGE TRACKER] Error logging usage:', error);
  }
}

/**
 * Check if usage already logged with specific unique identifier for a specific date
 */
async function isAlreadyLoggedWithMetadata(
  service: string,
  apiType: string,
  date: Date,
  metadataKey: string,
  metadataValue: string
): Promise<boolean> {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  const existing = await db.select()
    .from(apiUsageLogs)
    .where(sql`
      ${apiUsageLogs.service} = ${service} 
      AND ${apiUsageLogs.apiType} = ${apiType}
      AND ${apiUsageLogs.timestamp} >= ${startOfDay}
      AND ${apiUsageLogs.timestamp} <= ${endOfDay}
      AND ${apiUsageLogs.metadata}->>${metadataKey} = ${metadataValue}
    `)
    .limit(1);
  
  return existing.length > 0;
}

/**
 * Fetch Twilio usage from API (last 24 hours)
 */
export async function fetchTwilioUsage() {
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(12, 0, 0, 0); // Noon yesterday for timestamp

    const records = await twilioClient.usage.records.list({
      startDate: yesterday.toISOString().split('T')[0],
      category: 'all',
    });

    const smsRecords = records.filter((r: any) => r.category.includes('sms'));
    const voiceRecords = records.filter((r: any) => r.category.includes('calls'));

    // Log SMS usage - use category as unique identifier
    for (const record of smsRecords) {
      const alreadyLogged = await isAlreadyLoggedWithMetadata(
        'twilio',
        'sms',
        yesterday,
        'category',
        record.category
      );
      
      if (!alreadyLogged) {
        await logApiUsage(
          'twilio',
          'sms',
          parseInt(record.count),
          parseFloat(record.price),
          { category: record.category, usage: record.usage },
          yesterday
        );
      }
    }

    // Log voice usage - use category as unique identifier
    for (const record of voiceRecords) {
      const alreadyLogged = await isAlreadyLoggedWithMetadata(
        'twilio',
        'voice',
        yesterday,
        'category',
        record.category
      );
      
      if (!alreadyLogged) {
        await logApiUsage(
          'twilio',
          'voice',
          parseInt(record.count),
          parseFloat(record.price),
          { category: record.category, usage: record.usage },
          yesterday
        );
      }
    }

    await updateServiceHealth('twilio', 'healthy');
    return { success: true, records: records.length };
  } catch (error: any) {
    console.error('[TWILIO USAGE] Error:', error);
    await updateServiceHealth('twilio', 'down', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Fetch OpenAI usage from API
 */
export async function fetchOpenAIUsage() {
  try {
    // OpenAI Usage API requires organization admin key (different from regular API key)
    // For now, we'll mark as healthy but skip tracking
    // To enable: Get admin key from https://platform.openai.com/settings/organization/admin-keys
    
    console.log('[OPENAI USAGE] Skipping - requires admin API key');
    await updateServiceHealth('openai', 'healthy', 'Usage tracking not configured (requires admin key)');
    return { success: true, skipped: true };
  } catch (error: any) {
    console.error('[OPENAI USAGE] Error:', error);
    await updateServiceHealth('openai', 'degraded', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Fetch Stripe fees from balance transactions
 */
export async function fetchStripeUsage() {
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const charges = await stripe.charges.list({
      limit: 100,
      created: { gte: Math.floor(yesterday.getTime() / 1000) },
      expand: ['data.balance_transaction'],
    });

    let logged = 0;
    for (const charge of charges.data) {
      if (charge.balance_transaction && typeof charge.balance_transaction !== 'string') {
        const fee = charge.balance_transaction.fee / 100;
        
        // Check if this specific charge was already logged (use charge ID)
        const existing = await db.select()
          .from(apiUsageLogs)
          .where(sql`
            ${apiUsageLogs.service} = 'stripe' 
            AND ${apiUsageLogs.metadata}->>'charge_id' = ${charge.id}
          `)
          .limit(1);
        
        if (existing.length === 0) {
          await logApiUsage(
            'stripe',
            'payment_processing',
            1,
            fee,
            {
              charge_id: charge.id,
              amount: charge.amount / 100,
              net: charge.balance_transaction.net / 100,
            }
          );
          logged++;
        }
      }
    }

    await updateServiceHealth('stripe', 'healthy');
    return { success: true, charges: logged };
  } catch (error: any) {
    console.error('[STRIPE USAGE] Error:', error);
    await updateServiceHealth('stripe', 'down', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Fetch SendGrid email usage
 */
export async function fetchSendGridUsage() {
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(12, 0, 0, 0); // Noon yesterday
    const startDate = yesterday.toISOString().split('T')[0];

    // Check by date string
    const alreadyLogged = await isAlreadyLoggedWithMetadata(
      'sendgrid',
      'email',
      yesterday,
      'date',
      startDate
    );
    
    if (alreadyLogged) {
      console.log('[SENDGRID USAGE] Already logged for', startDate);
      await updateServiceHealth('sendgrid', 'healthy');
      return { success: true, skipped: true };
    }

    const response = await fetch(
      `https://api.sendgrid.com/v3/stats?start_date=${startDate}&aggregated_by=day`,
      {
        headers: {
          'Authorization': `Bearer ${sendgridApiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`SendGrid API error: ${response.statusText}`);
    }

    const stats = await response.json();

    for (const dayStat of stats) {
      const metrics = dayStat.stats[0]?.metrics || {};
      const requests = metrics.requests || 0;
      
      const estimatedCost = requests * 0.001;

      await logApiUsage(
        'sendgrid',
        'email',
        requests,
        estimatedCost,
        {
          date: startDate,
          delivered: metrics.delivered,
          opens: metrics.opens,
          clicks: metrics.clicks,
          bounces: metrics.bounces,
        },
        yesterday
      );
    }

    await updateServiceHealth('sendgrid', 'healthy');
    return { success: true };
  } catch (error: any) {
    console.error('[SENDGRID USAGE] Error:', error);
    await updateServiceHealth('sendgrid', 'down', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Update service health status
 */
async function updateServiceHealth(
  service: string,
  status: 'healthy' | 'degraded' | 'down',
  lastError?: string
) {
  const now = new Date();
  
  try {
    const existing = await db.query.serviceHealth.findFirst({
      where: (health, { eq }) => eq(health.service, service),
    });

    if (existing) {
      await db.update(serviceHealth)
        .set({
          status,
          lastCheck: now,
          lastSuccess: status === 'healthy' ? now : existing.lastSuccess,
          lastError: lastError || null,
          consecutiveFailures: status === 'healthy' ? 0 : (existing.consecutiveFailures + 1),
          updatedAt: now,
        })
        .where(eq(serviceHealth.service, service));
    } else {
      await db.insert(serviceHealth).values({
        service,
        status,
        lastCheck: now,
        lastSuccess: status === 'healthy' ? now : null,
        lastError: lastError || null,
        consecutiveFailures: status === 'healthy' ? 0 : 1,
      });
    }
  } catch (error) {
    console.error('[SERVICE HEALTH] Error updating:', error);
  }
}

/**
 * Run all usage trackers (call this on a schedule)
 */
export async function syncAllUsage() {
  console.log('[USAGE TRACKER] Starting usage sync...');
  
  const results = await Promise.allSettled([
    fetchTwilioUsage(),
    fetchOpenAIUsage(),
    fetchStripeUsage(),
    fetchSendGridUsage(),
  ]);

  console.log('[USAGE TRACKER] Sync complete:', results);
  return results;
}
