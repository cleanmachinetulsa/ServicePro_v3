import { db } from './db';
import { apiUsageLogs, serviceHealth } from '@shared/schema';
import { eq } from 'drizzle-orm';
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

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const sendgridApiKey = process.env.SENDGRID_API_KEY;

/**
 * Log API usage to database
 */
export async function logApiUsage(
  service: string,
  apiType: string,
  quantity: number,
  cost: number,
  metadata?: any
) {
  try {
    await db.insert(apiUsageLogs).values({
      service,
      apiType,
      quantity,
      cost: cost.toString(),
      metadata,
      timestamp: new Date(),
    });
    console.log(`[USAGE TRACKER] Logged ${service} ${apiType}: ${quantity} units, $${cost}`);
  } catch (error) {
    console.error('[USAGE TRACKER] Error logging usage:', error);
  }
}

/**
 * Fetch Twilio usage from API (last 24 hours)
 */
export async function fetchTwilioUsage() {
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const records = await twilioClient.usage.records.list({
      startDate: yesterday.toISOString().split('T')[0],
      category: 'all',
    });

    const smsRecords = records.filter((r: any) => r.category.includes('sms'));
    const voiceRecords = records.filter((r: any) => r.category.includes('calls'));

    // Log SMS usage
    for (const record of smsRecords) {
      await logApiUsage(
        'twilio',
        'sms',
        parseInt(record.count),
        parseFloat(record.price),
        { category: record.category, usage: record.usage }
      );
    }

    // Log voice usage
    for (const record of voiceRecords) {
      await logApiUsage(
        'twilio',
        'voice',
        parseInt(record.count),
        parseFloat(record.price),
        { category: record.category, usage: record.usage }
      );
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
    // OpenAI Usage API requires admin key
    const response = await fetch('https://api.openai.com/v1/organization/usage/completions', {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Calculate costs based on token usage
    // GPT-4o pricing: $2.50/1M input tokens, $10.00/1M output tokens
    for (const result of data.results || []) {
      const inputCost = (result.input_tokens / 1000000) * 2.50;
      const outputCost = (result.output_tokens / 1000000) * 10.00;
      const totalCost = inputCost + outputCost;

      await logApiUsage(
        'openai',
        'tokens',
        result.input_tokens + result.output_tokens,
        totalCost,
        {
          model: result.model,
          requests: result.num_model_requests,
          input_tokens: result.input_tokens,
          output_tokens: result.output_tokens,
        }
      );
    }

    await updateServiceHealth('openai', 'healthy');
    return { success: true };
  } catch (error: any) {
    console.error('[OPENAI USAGE] Error:', error);
    await updateServiceHealth('openai', 'down', error.message);
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

    for (const charge of charges.data) {
      if (charge.balance_transaction && typeof charge.balance_transaction !== 'string') {
        const fee = charge.balance_transaction.fee / 100; // Convert cents to dollars

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
      }
    }

    await updateServiceHealth('stripe', 'healthy');
    return { success: true, charges: charges.data.length };
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
    const startDate = yesterday.toISOString().split('T')[0];

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
      
      // SendGrid pricing: approximately $0.001 per email (varies by plan)
      const estimatedCost = requests * 0.001;

      await logApiUsage(
        'sendgrid',
        'email',
        requests,
        estimatedCost,
        {
          delivered: metrics.delivered,
          opens: metrics.opens,
          clicks: metrics.clicks,
          bounces: metrics.bounces,
        }
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
