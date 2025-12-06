/**
 * Telephony Settings Service
 * 
 * Phase: Telephony Mode Selector
 * Provides get/update operations for tenant telephony mode settings.
 * Controls how calls are routed: FORWARD_ALL_CALLS, AI_FIRST, AI_ONLY, TEXT_ONLY_BUSINESS
 */

import { eq } from "drizzle-orm";
import { db } from '../db';
import { tenantPhoneConfig, type TelephonyMode } from '../../shared/schema';

export interface TelephonySettings {
  telephonyMode: TelephonyMode;
  forwardingNumber: string | null;
  allowVoicemailInTextOnly: boolean;
  ivrMode: string | null;
}

export interface UpdateTelephonySettings {
  telephonyMode?: TelephonyMode;
  forwardingNumber?: string | null;
  allowVoicemailInTextOnly?: boolean;
}

/**
 * Get telephony settings for a tenant
 * Returns the telephony mode and related settings
 */
export async function getTelephonySettings(tenantId: string): Promise<TelephonySettings | null> {
  const config = await db.query.tenantPhoneConfig.findFirst({
    where: eq(tenantPhoneConfig.tenantId, tenantId),
  });

  if (!config) {
    return null;
  }

  return {
    telephonyMode: (config.telephonyMode as TelephonyMode) || 'AI_FIRST',
    forwardingNumber: config.forwardingNumber || null,
    allowVoicemailInTextOnly: config.allowVoicemailInTextOnly || false,
    ivrMode: config.ivrMode || 'simple',
  };
}

/**
 * Update telephony settings for a tenant
 * Persists telephony mode and related settings
 */
export async function updateTelephonySettings(
  tenantId: string, 
  updates: UpdateTelephonySettings
): Promise<TelephonySettings | null> {
  const config = await db.query.tenantPhoneConfig.findFirst({
    where: eq(tenantPhoneConfig.tenantId, tenantId),
  });

  if (!config) {
    console.error(`[TELEPHONY SETTINGS] No phone config found for tenant ${tenantId}`);
    return null;
  }

  const updateData: Record<string, any> = {
    updatedAt: new Date(),
  };

  if (updates.telephonyMode !== undefined) {
    updateData.telephonyMode = updates.telephonyMode;
    console.log(`[TELEPHONY SETTINGS] Updating telephonyMode for tenant ${tenantId}: ${updates.telephonyMode}`);
  }

  if (updates.forwardingNumber !== undefined) {
    updateData.forwardingNumber = updates.forwardingNumber;
    console.log(`[TELEPHONY SETTINGS] Updating forwardingNumber for tenant ${tenantId}: ${updates.forwardingNumber}`);
  }

  if (updates.allowVoicemailInTextOnly !== undefined) {
    updateData.allowVoicemailInTextOnly = updates.allowVoicemailInTextOnly;
    console.log(`[TELEPHONY SETTINGS] Updating allowVoicemailInTextOnly for tenant ${tenantId}: ${updates.allowVoicemailInTextOnly}`);
  }

  await db
    .update(tenantPhoneConfig)
    .set(updateData)
    .where(eq(tenantPhoneConfig.id, config.id));

  return getTelephonySettings(tenantId);
}

/**
 * Get telephony mode for a tenant by phone number
 * Used during inbound call routing
 */
export async function getTelephonyModeByPhoneNumber(phoneNumber: string): Promise<TelephonyMode> {
  const config = await db.query.tenantPhoneConfig.findFirst({
    where: eq(tenantPhoneConfig.phoneNumber, phoneNumber),
  });

  if (!config) {
    console.log(`[TELEPHONY SETTINGS] No config for phone ${phoneNumber}, defaulting to AI_FIRST`);
    return 'AI_FIRST';
  }

  return (config.telephonyMode as TelephonyMode) || 'AI_FIRST';
}

/**
 * Get full phone config with telephony mode
 * Used during inbound call routing for all necessary data
 */
export async function getFullTelephonyConfig(tenantId: string) {
  const config = await db.query.tenantPhoneConfig.findFirst({
    where: eq(tenantPhoneConfig.tenantId, tenantId),
  });

  if (!config) {
    return null;
  }

  return {
    ...config,
    telephonyMode: (config.telephonyMode as TelephonyMode) || 'AI_FIRST',
  };
}
