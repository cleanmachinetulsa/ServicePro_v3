#!/usr/bin/env npx tsx
/**
 * Voice Configuration Diagnostic Script
 * 
 * Usage:
 *   npx tsx scripts/diagnoseVoiceConfig.ts --tenantSlug=cleanmachine
 *   npx tsx scripts/diagnoseVoiceConfig.ts --tenantId=root
 *   npx tsx scripts/diagnoseVoiceConfig.ts --tenantSlug=cleanmachine --json
 */

import { getVoiceDiagnostics, resolveTenantIdFromSlug } from '../server/services/voiceConfigService';

async function main() {
  const args = process.argv.slice(2);
  
  let tenantId: string | null = null;
  let tenantSlug: string | null = null;
  let jsonOutput = false;

  for (const arg of args) {
    if (arg.startsWith('--tenantId=')) {
      tenantId = arg.split('=')[1];
    } else if (arg.startsWith('--tenantSlug=')) {
      tenantSlug = arg.split('=')[1];
    } else if (arg === '--json') {
      jsonOutput = true;
    }
  }

  if (!tenantId && !tenantSlug) {
    console.error('Error: Please provide --tenantId or --tenantSlug');
    console.error('Usage: npx tsx scripts/diagnoseVoiceConfig.ts --tenantSlug=cleanmachine');
    process.exit(1);
  }

  // Resolve slug to ID if needed
  if (tenantSlug && !tenantId) {
    tenantId = await resolveTenantIdFromSlug(tenantSlug);
    if (!tenantId) {
      // Try treating slug as ID for root tenant
      if (tenantSlug === 'cleanmachine') {
        tenantId = 'root';
      } else {
        console.error(`Error: Could not find tenant with slug: ${tenantSlug}`);
        process.exit(1);
      }
    }
  }

  if (!tenantId) {
    console.error('Error: Could not resolve tenant ID');
    process.exit(1);
  }

  const diagnostics = await getVoiceDiagnostics(tenantId, tenantSlug || undefined);

  if (jsonOutput) {
    console.log(JSON.stringify(diagnostics, null, 2));
  } else {
    console.log('\n=== Voice Configuration Diagnostics ===\n');
    console.log(`Tenant ID: ${diagnostics.tenantId}`);
    console.log(`Tenant Slug: ${diagnostics.tenantSlug || 'N/A'}`);
    
    console.log('\n--- Environment Variables ---');
    console.log(`TWILIO_ACCOUNT_SID: ${diagnostics.env.TWILIO_ACCOUNT_SID_PRESENT ? '✓ Present' : '✗ Missing'}`);
    console.log(`TWILIO_AUTH_TOKEN: ${diagnostics.env.TWILIO_AUTH_TOKEN_PRESENT ? '✓ Present' : '✗ Missing'}`);
    console.log(`MAIN_PHONE_NUMBER: ${diagnostics.env.MAIN_PHONE_NUMBER || '✗ Not set'}`);
    console.log(`BUSINESS_OWNER_PERSONAL_PHONE: ${diagnostics.env.BUSINESS_OWNER_PERSONAL_PHONE || '✗ Not set'}`);
    
    console.log('\n--- Database Configuration ---');
    console.log(`Voice Config Row Found: ${diagnostics.db.voiceConfigRowFound ? '✓ Yes' : '✗ No'}`);
    console.log(`Phone Number: ${diagnostics.db.phoneNumber || 'N/A'}`);
    console.log(`Voice Enabled: ${diagnostics.db.voiceEnabled ? '✓ Yes' : '✗ No'}`);
    console.log(`Voice Webhook URL: ${diagnostics.db.voiceWebhookUrl || 'N/A'}`);
    console.log(`Forwarding Number: ${diagnostics.db.forwardingNumber || 'N/A'}`);
    console.log(`SIP Enabled: ${diagnostics.db.sipEnabled ? 'Yes' : 'No'}`);
    console.log(`SIP Domain: ${diagnostics.db.sipDomain || 'N/A'}`);
    console.log(`IVR Mode: ${diagnostics.db.ivrMode || 'N/A'}`);
    
    console.log('\n--- Status ---');
    console.log(`Voice Configured: ${diagnostics.computed.isVoiceConfigured ? '✓ YES' : '✗ NO'}`);
    
    if (diagnostics.computed.errors.length > 0) {
      console.log('\nErrors:');
      diagnostics.computed.errors.forEach(e => console.log(`  ✗ ${e}`));
    }
    
    if (diagnostics.computed.warnings.length > 0) {
      console.log('\nWarnings:');
      diagnostics.computed.warnings.forEach(w => console.log(`  ⚠ ${w}`));
    }
    
    console.log('\n');
  }

  process.exit(diagnostics.computed.isVoiceConfigured ? 0 : 1);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
