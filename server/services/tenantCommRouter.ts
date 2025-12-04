/**
 * PHASE 3 - TENANT COMMUNICATION ROUTING ENGINE
 * 
 * This service provides centralized tenant resolution for all inbound communications
 * (SMS, Voice, IVR callbacks, future AI-voice integrations).
 * 
 * Purpose:
 * - Single source of truth for tenant routing logic
 * - Eliminates duplicated tenant resolution across routes
 * - Prevents tenant misrouting and edge-case failures
 * - Enables scaling to 50+ tenants with confidence
 * 
 * Resolution Strategy:
 * 1. Try MessagingServiceSid match (most specific for SMS)
 * 2. Try To number match via tenantPhoneConfig (phone number lookup)
 * 3. Fallback to 'root' tenant for graceful degradation
 * 
 * Usage:
 * ```typescript
 * const resolution = await resolveTenantFromInbound(req);
 * req.tenant = { id: resolution.tenantId };
 * req.tenantDb = wrapTenantDb(db, resolution.tenantId);
 * req.phoneConfig = resolution.phoneConfig;
 * ```
 */

import { eq, desc } from 'drizzle-orm';
import { tenantPhoneConfig } from '../../shared/schema';
import type { DB } from '../db';
import { Request } from 'express';

export interface TenantResolution {
  tenantId: string;
  phoneConfig: any | null;
  ivrMode: 'simple' | 'ivr' | 'ai-voice';
  resolvedBy: 'messagingServiceSid' | 'phoneNumber' | 'fallback';
}

/**
 * Resolve tenant from inbound Twilio webhook request
 * 
 * Accepts standard Twilio webhook parameters:
 * - From: Caller/sender phone number (E.164)
 * - To: Destination phone number (E.164) - primary lookup field
 * - Body: Message content (for SMS)
 * - MessagingServiceSid: Twilio Messaging Service identifier (for SMS)
 * - CallSid: Twilio call identifier (for Voice)
 * 
 * @param req - Express request object with Twilio webhook body
 * @param db - Database instance
 * @returns Tenant resolution with tenantId, phoneConfig, ivrMode, and resolution method
 */
export async function resolveTenantFromInbound(
  req: Request,
  db: DB
): Promise<TenantResolution> {
  const { To, MessagingServiceSid } = req.body;
  
  // Normalize phone number to E.164 format (+1NNNNNNNNN)
  const normalizedTo = normalizePhoneNumber(To);

  // Strategy 1: Try MessagingServiceSid match (most specific for SMS)
  // This allows multiple phone numbers to route to the same tenant via Messaging Service
  // NOTE: MessagingServiceSid should be unique per tenant in practice, but we order
  // by id desc to ensure deterministic results if duplicates exist
  if (MessagingServiceSid) {
    const configs = await db
      .select()
      .from(tenantPhoneConfig)
      .where(eq(tenantPhoneConfig.messagingServiceSid, MessagingServiceSid))
      .orderBy(desc(tenantPhoneConfig.id))
      .limit(1);

    const config = configs[0];
    if (config) {
      console.log(`[TENANT ROUTER] Resolved tenant '${config.tenantId}' via MessagingServiceSid: ${MessagingServiceSid}`);
      return {
        tenantId: config.tenantId,
        phoneConfig: config,
        ivrMode: (config.ivrMode as 'simple' | 'ivr' | 'ai-voice') || 'simple',
        resolvedBy: 'messagingServiceSid',
      };
    }
  }

  // Strategy 2: Try To number match via tenantPhoneConfig (standard lookup)
  // This is the primary lookup for voice calls and SMS without Messaging Service
  // Phone numbers should be unique per the schema, but we order for consistency
  if (normalizedTo) {
    console.log(`[TENANT ROUTER] Looking up phoneNumber: ${normalizedTo} (original: ${To})`);
    const configs = await db
      .select()
      .from(tenantPhoneConfig)
      .where(eq(tenantPhoneConfig.phoneNumber, normalizedTo))
      .orderBy(desc(tenantPhoneConfig.id))
      .limit(1);

    const config = configs[0];
    if (config) {
      console.log(`[TENANT ROUTER] Resolved tenant '${config.tenantId}' via phoneNumber: ${normalizedTo}, ivrMode: ${config.ivrMode}`);
      return {
        tenantId: config.tenantId,
        phoneConfig: config,
        ivrMode: (config.ivrMode as 'simple' | 'ivr' | 'ai-voice') || 'simple',
        resolvedBy: 'phoneNumber',
      };
    }
  }

  // Strategy 3: Fallback to root tenant with phone config lookup
  // Look up root tenant's phone config for IVR settings
  console.warn(`[TENANT ROUTER] No tenant config found for To=${normalizedTo} (original: ${To}), MessagingServiceSid=${MessagingServiceSid}, trying root fallback`);
  
  // Try to get root tenant's default phone config
  const rootConfigs = await db
    .select()
    .from(tenantPhoneConfig)
    .where(eq(tenantPhoneConfig.tenantId, 'root'))
    .orderBy(desc(tenantPhoneConfig.id))
    .limit(1);
  
  const rootConfig = rootConfigs[0];
  if (rootConfig) {
    console.log(`[TENANT ROUTER] Using root tenant fallback with ivrMode: ${rootConfig.ivrMode}`);
    return {
      tenantId: 'root',
      phoneConfig: rootConfig,
      ivrMode: (rootConfig.ivrMode as 'simple' | 'ivr' | 'ai-voice') || 'simple',
      resolvedBy: 'fallback',
    };
  }
  
  console.warn(`[TENANT ROUTER] No root tenant config found, using defaults`);
  return {
    tenantId: 'root',
    phoneConfig: null,
    ivrMode: 'simple',
    resolvedBy: 'fallback',
  };
}

/**
 * Normalize phone number to E.164 format (+1NNNNNNNNN for US numbers)
 * Handles common Twilio formats:
 * - "+19188565304" (already E.164)
 * - "19188565304" (missing +)
 * - " 19188565304" (leading space)
 * - "9188565304" (missing country code)
 */
function normalizePhoneNumber(phone: string | undefined): string | null {
  if (!phone) return null;
  
  // Remove all non-digit characters except leading +
  let cleaned = phone.trim();
  const hasPlus = cleaned.startsWith('+');
  cleaned = cleaned.replace(/\D/g, '');
  
  if (!cleaned) return null;
  
  // If 10 digits, assume US and add country code
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }
  
  // If 11 digits starting with 1, add +
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+${cleaned}`;
  }
  
  // Already has + prefix from original, return with it
  if (hasPlus) {
    return `+${cleaned}`;
  }
  
  // Return as-is with + if it looks like a valid number
  if (cleaned.length >= 10) {
    return `+${cleaned}`;
  }
  
  return null;
}

/**
 * Route IVR mode to appropriate handler response
 * 
 * This function determines how to respond based on the tenant's IVR mode:
 * - simple: Return standard text responses (existing logic)
 * - ivr: Return TwiML referencing stored IVR config records
 * - ai-voice: Pass through to AI Voice endpoint (Phase 4, falls back to simple for now)
 * 
 * @param ivrMode - IVR mode from tenant phone config
 * @param tenantId - Resolved tenant ID
 * @returns Handler type for routing logic
 */
export function getIvrHandler(
  ivrMode: 'simple' | 'ivr' | 'ai-voice',
  tenantId: string
): 'simple' | 'ivr' | 'ai-voice' {
  if (ivrMode === 'ivr') {
    console.log(`[TENANT ROUTER] Using IVR mode for tenant '${tenantId}'`);
    return 'ivr';
  } else if (ivrMode === 'ai-voice') {
    // TODO: Phase 4 - Implement AI Voice mode
    console.log(`[TENANT ROUTER] AI-voice mode not yet implemented for tenant '${tenantId}', falling back to simple`);
    return 'simple';
  }
  
  // Default: simple mode
  console.log(`[TENANT ROUTER] Using simple mode for tenant '${tenantId}'`);
  return 'simple';
}
