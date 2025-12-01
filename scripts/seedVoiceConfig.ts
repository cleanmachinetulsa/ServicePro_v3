#!/usr/bin/env npx tsx
/**
 * Seed Voice Configuration for Clean Machine (root tenant)
 * 
 * Usage: npx tsx scripts/seedVoiceConfig.ts
 * 
 * This script ensures the root tenant has a voice configuration row.
 * It is idempotent - running it multiple times will not create duplicates.
 */

import { db } from '../server/db';
import { tenantPhoneConfig } from '@shared/schema';
import { eq } from 'drizzle-orm';

async function main() {
  console.log('[SEED VOICE CONFIG] Starting...');

  const tenantId = 'root';
  const phoneNumber = process.env.MAIN_PHONE_NUMBER || '+19188565304';
  const forwardingNumber = process.env.BUSINESS_OWNER_PERSONAL_PHONE || null;
  
  // Get base URL for webhooks
  const baseUrl = process.env.REPLIT_DEV_DOMAIN 
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : process.env.PUBLIC_URL || 'https://cleanmachine.app';

  // Check if config already exists
  const [existing] = await db
    .select()
    .from(tenantPhoneConfig)
    .where(eq(tenantPhoneConfig.tenantId, tenantId))
    .limit(1);

  if (existing) {
    console.log(`[SEED VOICE CONFIG] Config already exists for tenant ${tenantId}`);
    console.log(`  Phone: ${existing.phoneNumber}`);
    console.log(`  Voice Enabled: ${existing.voiceEnabled}`);
    console.log(`  Voice Webhook: ${existing.voiceWebhookUrl || 'Not set'}`);
    
    // Update if voice fields are missing
    if (!existing.voiceWebhookUrl || existing.voiceEnabled === null) {
      console.log('[SEED VOICE CONFIG] Updating voice fields...');
      await db
        .update(tenantPhoneConfig)
        .set({
          voiceEnabled: true,
          voiceWebhookUrl: `${baseUrl}/api/twilio/voice/inbound`,
          voiceStatusCallbackUrl: `${baseUrl}/api/twilio/voice/status`,
          forwardingNumber: forwardingNumber || existing.forwardingNumber,
          updatedAt: new Date(),
        })
        .where(eq(tenantPhoneConfig.id, existing.id));
      console.log('[SEED VOICE CONFIG] Voice fields updated successfully');
    }
    
    return;
  }

  // Create new config
  const configId = `phone_${tenantId}_main`;
  
  await db.insert(tenantPhoneConfig).values({
    id: configId,
    tenantId,
    phoneNumber,
    voiceEnabled: true,
    voiceWebhookUrl: `${baseUrl}/api/twilio/voice/inbound`,
    voiceStatusCallbackUrl: `${baseUrl}/api/twilio/voice/status`,
    forwardingNumber,
    ringDuration: 20,
    ivrMode: 'simple',
  });

  console.log(`[SEED VOICE CONFIG] Created voice config for tenant ${tenantId}`);
  console.log(`  ID: ${configId}`);
  console.log(`  Phone: ${phoneNumber}`);
  console.log(`  Voice Webhook: ${baseUrl}/api/twilio/voice/inbound`);
  console.log(`  Forwarding: ${forwardingNumber || 'Not set'}`);
}

main()
  .then(() => {
    console.log('[SEED VOICE CONFIG] Complete');
    process.exit(0);
  })
  .catch(err => {
    console.error('[SEED VOICE CONFIG] Error:', err);
    process.exit(1);
  });
