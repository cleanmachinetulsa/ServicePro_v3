import { db } from '../db';
import { wrapTenantDb } from '../tenantDb';
import { sql } from 'drizzle-orm';
import { trialTelephonyProfiles, tenants, TrialTelephonyProfile } from '@shared/schema';
import cron from 'node-cron';
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';

let resetSchedulerInitialized = false;

export interface TrialSandboxStatus {
  isTrialTenant: boolean;
  sandboxEnabled: boolean;
  allowedNumbers: string[];
  messagesSentToday: number;
  dailyMessageCap: number;
  totalMessagesSent: number;
  totalMessageCap: number;
  canSendMessage: boolean;
  remainingDaily: number;
  remainingTotal: number;
}

export function normalizeE164(phone: string): string | null {
  try {
    if (isValidPhoneNumber(phone, 'US')) {
      const parsed = parsePhoneNumber(phone, 'US');
      return parsed.format('E.164');
    }
    return null;
  } catch {
    return null;
  }
}

export async function isTrialTenant(tenantId: string): Promise<boolean> {
  const rootDb = wrapTenantDb(db, 'root');
  
  try {
    const result = await rootDb.execute(sql`
      SELECT status, plan_tier FROM tenants WHERE id = ${tenantId}
    `);
    
    if (result.rows.length === 0) {
      return false;
    }
    
    const tenant = result.rows[0] as any;
    return tenant.status === 'trialing';
  } catch (error) {
    console.error('[TRIAL TELEPHONY] Error checking trial status:', error);
    return false;
  }
}

export async function getOrCreateTrialProfile(tenantId: string): Promise<TrialTelephonyProfile | null> {
  const rootDb = wrapTenantDb(db, 'root');
  
  try {
    const existing = await rootDb.execute(sql`
      SELECT * FROM trial_telephony_profiles WHERE tenant_id = ${tenantId}
    `);
    
    if (existing.rows.length > 0) {
      return existing.rows[0] as TrialTelephonyProfile;
    }
    
    const isTrial = await isTrialTenant(tenantId);
    if (!isTrial) {
      return null;
    }
    
    const inserted = await rootDb.execute(sql`
      INSERT INTO trial_telephony_profiles (tenant_id)
      VALUES (${tenantId})
      ON CONFLICT (tenant_id) DO UPDATE SET updated_at = NOW()
      RETURNING *
    `);
    
    return inserted.rows[0] as TrialTelephonyProfile;
  } catch (error) {
    console.error('[TRIAL TELEPHONY] Error getting/creating profile:', error);
    return null;
  }
}

export async function getTrialSandboxStatus(tenantId: string): Promise<TrialSandboxStatus> {
  const isTrial = await isTrialTenant(tenantId);
  
  if (!isTrial) {
    return {
      isTrialTenant: false,
      sandboxEnabled: false,
      allowedNumbers: [],
      messagesSentToday: 0,
      dailyMessageCap: 0,
      totalMessagesSent: 0,
      totalMessageCap: 0,
      canSendMessage: true,
      remainingDaily: Infinity,
      remainingTotal: Infinity,
    };
  }
  
  const profile = await getOrCreateTrialProfile(tenantId);
  
  if (!profile) {
    return {
      isTrialTenant: true,
      sandboxEnabled: true,
      allowedNumbers: [],
      messagesSentToday: 0,
      dailyMessageCap: 30,
      totalMessagesSent: 0,
      totalMessageCap: 200,
      canSendMessage: false,
      remainingDaily: 30,
      remainingTotal: 200,
    };
  }
  
  const remainingDaily = profile.dailyMessageCap - profile.messagesSentToday;
  const remainingTotal = profile.totalMessageCap - profile.totalMessagesSent;
  const canSendMessage = profile.sandboxEnabled && remainingDaily > 0 && remainingTotal > 0;
  
  return {
    isTrialTenant: true,
    sandboxEnabled: profile.sandboxEnabled,
    allowedNumbers: profile.allowedNumbers || [],
    messagesSentToday: profile.messagesSentToday,
    dailyMessageCap: profile.dailyMessageCap,
    totalMessagesSent: profile.totalMessagesSent,
    totalMessageCap: profile.totalMessageCap,
    canSendMessage,
    remainingDaily: Math.max(0, remainingDaily),
    remainingTotal: Math.max(0, remainingTotal),
  };
}

export async function isNumberAllowedForTrial(tenantId: string, phoneNumber: string): Promise<{ allowed: boolean; reason?: string }> {
  const status = await getTrialSandboxStatus(tenantId);
  
  if (!status.isTrialTenant) {
    return { allowed: true };
  }
  
  if (!status.sandboxEnabled) {
    return { allowed: false, reason: 'Trial sandbox is disabled' };
  }
  
  const normalizedNumber = normalizeE164(phoneNumber);
  if (!normalizedNumber) {
    return { allowed: false, reason: 'Invalid phone number format' };
  }
  
  const allowedNormalized = status.allowedNumbers
    .map(n => normalizeE164(n))
    .filter(n => n !== null) as string[];
  
  if (!allowedNormalized.includes(normalizedNumber)) {
    return { 
      allowed: false, 
      reason: 'Phone number not in trial whitelist. Add it to your sandbox settings.' 
    };
  }
  
  return { allowed: true };
}

export async function canSendTrialMessage(tenantId: string, toNumber: string): Promise<{ canSend: boolean; reason?: string }> {
  const status = await getTrialSandboxStatus(tenantId);
  
  if (!status.isTrialTenant) {
    return { canSend: true };
  }
  
  if (!status.sandboxEnabled) {
    return { canSend: false, reason: 'Trial sandbox is disabled' };
  }
  
  const numberCheck = await isNumberAllowedForTrial(tenantId, toNumber);
  if (!numberCheck.allowed) {
    return { canSend: false, reason: numberCheck.reason };
  }
  
  if (status.remainingDaily <= 0) {
    return { canSend: false, reason: `Daily message limit reached (${status.dailyMessageCap}/day). Upgrade to send more.` };
  }
  
  if (status.remainingTotal <= 0) {
    return { canSend: false, reason: `Total message limit reached (${status.totalMessageCap} total). Upgrade to send more.` };
  }
  
  return { canSend: true };
}

export async function recordTrialMessageSent(tenantId: string): Promise<boolean> {
  const rootDb = wrapTenantDb(db, 'root');
  
  try {
    await rootDb.execute(sql`
      UPDATE trial_telephony_profiles
      SET 
        messages_sent_today = messages_sent_today + 1,
        total_messages_sent = total_messages_sent + 1,
        updated_at = NOW()
      WHERE tenant_id = ${tenantId}
    `);
    
    console.log(`[TRIAL TELEPHONY] Recorded message sent for tenant ${tenantId}`);
    return true;
  } catch (error) {
    console.error('[TRIAL TELEPHONY] Error recording message:', error);
    return false;
  }
}

export async function addAllowedNumber(tenantId: string, phoneNumber: string): Promise<{ success: boolean; error?: string }> {
  const rootDb = wrapTenantDb(db, 'root');
  
  const normalized = normalizeE164(phoneNumber);
  if (!normalized) {
    return { success: false, error: 'Invalid phone number format' };
  }
  
  try {
    const profile = await getOrCreateTrialProfile(tenantId);
    if (!profile) {
      return { success: false, error: 'Could not create trial profile' };
    }
    
    const currentNumbers = profile.allowedNumbers || [];
    if (currentNumbers.includes(normalized)) {
      return { success: true };
    }
    
    if (currentNumbers.length >= 5) {
      return { success: false, error: 'Maximum 5 numbers allowed in trial sandbox' };
    }
    
    const updatedNumbers = [...currentNumbers, normalized];
    
    await rootDb.execute(sql`
      UPDATE trial_telephony_profiles
      SET 
        allowed_numbers = ${JSON.stringify(updatedNumbers)}::jsonb,
        updated_at = NOW()
      WHERE tenant_id = ${tenantId}
    `);
    
    console.log(`[TRIAL TELEPHONY] Added ${normalized} to allowed numbers for tenant ${tenantId}`);
    return { success: true };
  } catch (error) {
    console.error('[TRIAL TELEPHONY] Error adding allowed number:', error);
    return { success: false, error: 'Failed to add number' };
  }
}

export async function removeAllowedNumber(tenantId: string, phoneNumber: string): Promise<{ success: boolean; error?: string }> {
  const rootDb = wrapTenantDb(db, 'root');
  
  const normalized = normalizeE164(phoneNumber);
  if (!normalized) {
    return { success: false, error: 'Invalid phone number format' };
  }
  
  try {
    const profile = await getOrCreateTrialProfile(tenantId);
    if (!profile) {
      return { success: false, error: 'Trial profile not found' };
    }
    
    const currentNumbers = profile.allowedNumbers || [];
    const updatedNumbers = currentNumbers.filter(n => normalizeE164(n) !== normalized);
    
    await rootDb.execute(sql`
      UPDATE trial_telephony_profiles
      SET 
        allowed_numbers = ${JSON.stringify(updatedNumbers)}::jsonb,
        updated_at = NOW()
      WHERE tenant_id = ${tenantId}
    `);
    
    console.log(`[TRIAL TELEPHONY] Removed ${normalized} from allowed numbers for tenant ${tenantId}`);
    return { success: true };
  } catch (error) {
    console.error('[TRIAL TELEPHONY] Error removing allowed number:', error);
    return { success: false, error: 'Failed to remove number' };
  }
}

export async function resetDailyMessageCounts(): Promise<void> {
  const rootDb = wrapTenantDb(db, 'root');
  
  console.log('[TRIAL TELEPHONY] Starting daily message count reset');
  
  try {
    const result = await rootDb.execute(sql`
      UPDATE trial_telephony_profiles
      SET 
        messages_sent_today = 0,
        last_reset_at = NOW(),
        updated_at = NOW()
      RETURNING tenant_id
    `);
    
    console.log(`[TRIAL TELEPHONY] Reset daily counts for ${result.rows.length} trial tenant(s)`);
  } catch (error) {
    console.error('[TRIAL TELEPHONY] Error resetting daily counts:', error);
  }
}

export function initializeTrialTelephonyScheduler(): void {
  if (resetSchedulerInitialized) {
    console.log('[TRIAL TELEPHONY] Scheduler already initialized, skipping...');
    return;
  }
  
  cron.schedule('0 0 * * *', async () => {
    console.log('[TRIAL TELEPHONY] Running scheduled daily reset');
    try {
      await resetDailyMessageCounts();
    } catch (error) {
      console.error('[TRIAL TELEPHONY] Scheduler error:', error);
    }
  }, {
    timezone: 'UTC'
  });
  
  resetSchedulerInitialized = true;
  console.log('[TRIAL TELEPHONY] Scheduler initialized - resets daily counts at midnight UTC');
}

export const TRIAL_REPLY_MESSAGE = 
  "Hi! This number is currently in trial mode. Please ask the business owner to add your number to their whitelist to continue the conversation.";

export const TRIAL_VOICE_MESSAGE = 
  "This line is in trial mode. Please visit the business website to book an appointment or leave a message.";
