import { db } from './db';
import { wrapTenantDb } from './tenantDb';
import { conversations, messages } from '@shared/schema';
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
  const tenantDb = wrapTenantDb(db, 'root');
  
  try {
    console.log('[TIMEOUT MONITOR] Checking for timed-out conversations...');

    const timeoutThreshold = new Date();
    timeoutThreshold.setHours(timeoutThreshold.getHours() - TIMEOUT_HOURS);

    // Find conversations in manual mode that haven't had activity in TIMEOUT_HOURS
    const timedOutConversations = await tenantDb
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.tenantId, 'root'),
          eq(conversations.controlMode, 'manual'),
          eq(conversations.status, 'active'),
          lt(conversations.lastMessageTime, timeoutThreshold)
        )
      );

    console.log(`[TIMEOUT MONITOR] Found ${timedOutConversations.length} timed-out conversations`);

    for (const conversation of timedOutConversations) {
      try {
        console.log(`[TIMEOUT MONITOR] Processing timeout for conversation ${conversation.id}`);

        // Return to AI
        const customerNotification = await returnToAI(conversation.id, 'system', true);

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

    if (timedOutConversations.length === 0) {
      console.log('[TIMEOUT MONITOR] No timed-out conversations found');
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
export async function updateLastActivity(conversationId: number) {
  const tenantDb = wrapTenantDb(db, 'root');
  
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
