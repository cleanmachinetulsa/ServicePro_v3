import { db } from './db';
import { wrapTenantDb } from './tenantDb';
import { conversations, messages, tenants } from '@shared/schema';
import { eq, and, lt, sql } from 'drizzle-orm';
import { returnToAI } from './handoffDetectionService';
import { notifyTimeout } from './smsNotificationService';
import { sendSMS } from './notifications';

const TIMEOUT_HOURS = 12;
const CHECK_INTERVAL_MS = 30 * 60 * 1000; // Check every 30 minutes

let monitoringInterval: NodeJS.Timeout | null = null;

export function startTimeoutMonitoring() {
  if (monitoringInterval) {
    console.log('[TIMEOUT MONITOR] Already running');
    return;
  }

  console.log(`[TIMEOUT MONITOR] Starting - will check every ${CHECK_INTERVAL_MS / 1000 / 60} minutes`);
  
  // Run immediately on start
  checkTimeouts();
  
  // Then run on interval
  monitoringInterval = setInterval(checkTimeouts, CHECK_INTERVAL_MS);
}

export function stopTimeoutMonitoring() {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
    console.log('[TIMEOUT MONITOR] Stopped');
  }
}

async function checkTimeouts() {
  try {
    console.log('[TIMEOUT MONITOR] Checking for timed-out conversations...');

    // Get all tenants
    const allTenants = await db.select().from(tenants);
    console.log(`[TIMEOUT MONITOR] Checking ${allTenants.length} tenant(s)`);

    let totalTimedOut = 0;

    // Check timeouts for each tenant
    for (const tenant of allTenants) {
      const tenantDb = wrapTenantDb(db, tenant.id);

      const timeoutThreshold = new Date();
      timeoutThreshold.setHours(timeoutThreshold.getHours() - TIMEOUT_HOURS);

      // Find conversations in manual mode that haven't had activity in TIMEOUT_HOURS
      const timedOutConversations = await tenantDb
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.controlMode, 'manual'),
            eq(conversations.status, 'active'),
            lt(conversations.lastMessageTime, timeoutThreshold)
          )
        );

      if (timedOutConversations.length > 0) {
        console.log(`[TIMEOUT MONITOR] Tenant ${tenant.id}: Found ${timedOutConversations.length} timed-out conversations`);
        totalTimedOut += timedOutConversations.length;
      }

      for (const conversation of timedOutConversations) {
        try {
          console.log(`[TIMEOUT MONITOR] Tenant ${tenant.id}: Processing timeout for conversation ${conversation.id}`);

          // Return to AI (pass tenantDb as first argument)
          const customerNotification = await returnToAI(tenantDb, conversation.id, 'system', true);

          // Send notification to customer if they're on SMS
          if (conversation.platform === 'sms' && customerNotification && conversation.customerPhone) {
            const timeoutMessage = `Hi${conversation.customerName ? ' ' + conversation.customerName : ''}! I noticed we haven't heard back in a while. I'm back to help if you need anything! Or just text back if you'd like to continue.`;
            
            await sendSMS(conversation.customerPhone, timeoutMessage);
            console.log(`[TIMEOUT MONITOR] Sent timeout message to customer ${conversation.customerPhone}`);
          }

          // Notify business owner
          await notifyTimeout(
            conversation.id,
            conversation.customerName,
            conversation.customerPhone || 'Unknown'
          );

        } catch (error) {
          console.error(`[TIMEOUT MONITOR] Error processing conversation ${conversation.id}:`, error);
        }
      }
    }

    if (totalTimedOut === 0) {
      console.log('[TIMEOUT MONITOR] No timed-out conversations found across all tenants');
    } else {
      console.log(`[TIMEOUT MONITOR] Total: Found ${totalTimedOut} timed-out conversations across all tenants`);
    }

  } catch (error) {
    console.error('[TIMEOUT MONITOR] Error during timeout check:', error);
  }
}

// Manually trigger a timeout check (useful for testing)
export async function triggerTimeoutCheck() {
  await checkTimeouts();
}

// Update the last activity timestamp for a conversation
// NOTE: This function takes conversationId which doesn't include tenant context.
// It should be called from req.tenantDb context, or refactored to accept tenant ID.
export async function updateLastActivity(conversationId: number, tenantId: string = 'root') {
  const tenantDb = wrapTenantDb(db, tenantId);
  
  try {
    await tenantDb
      .update(conversations)
      .set({
        lastMessageTime: new Date(),
        lastAgentActivity: new Date(),
      })
      .where(eq(conversations.id, conversationId));
  } catch (error) {
    console.error('[TIMEOUT MONITOR] Error updating last activity:', error);
  }
}
