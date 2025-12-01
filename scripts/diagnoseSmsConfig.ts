#!/usr/bin/env npx tsx
/**
 * SMS Configuration Diagnostic Script
 * 
 * Usage:
 *   npx tsx scripts/diagnoseSmsConfig.ts --tenantSlug=cleanmachine
 *   npx tsx scripts/diagnoseSmsConfig.ts --tenantId=root
 * 
 * This script diagnoses SMS configuration for a given tenant and reports:
 * - Tenant identity (ID, slug, name)
 * - SMS from number and messaging service SID
 * - Environment variables status
 * - Phone lines configured
 * - Overall SMS readiness
 */

import { db } from '../server/db';
import { tenants, tenantPhoneConfig, phoneLines } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { getSmsDiagnostics, getSmsConfig } from '../server/services/smsConfigService';

// ANSI colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color?: keyof typeof colors) {
  if (color) {
    console.log(`${colors[color]}${message}${colors.reset}`);
  } else {
    console.log(message);
  }
}

function logSection(title: string) {
  console.log('\n' + '='.repeat(60));
  log(title, 'bright');
  console.log('='.repeat(60));
}

function logStatus(label: string, value: string | null | undefined, isGood?: boolean) {
  const status = value || 'NOT SET';
  const color = isGood === undefined ? 'reset' : isGood ? 'green' : 'red';
  console.log(`  ${label}: ${colors[color]}${status}${colors.reset}`);
}

async function resolveTenantId(slug?: string, tenantId?: string): Promise<string | null> {
  if (tenantId) {
    return tenantId;
  }

  if (!slug) {
    return null;
  }

  // Handle special cases
  if (slug === 'cleanmachine' || slug === 'clean-machine' || slug === 'root') {
    return 'root';
  }

  // Look up tenant by slug
  const [tenant] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);

  return tenant?.id || null;
}

async function main() {
  const args = process.argv.slice(2);
  let tenantSlug: string | undefined;
  let tenantId: string | undefined;

  // Parse command line arguments
  for (const arg of args) {
    if (arg.startsWith('--tenantSlug=')) {
      tenantSlug = arg.split('=')[1];
    } else if (arg.startsWith('--tenantId=')) {
      tenantId = arg.split('=')[1];
    }
  }

  if (!tenantSlug && !tenantId) {
    log('Usage: npx tsx scripts/diagnoseSmsConfig.ts --tenantSlug=cleanmachine', 'yellow');
    log('   or: npx tsx scripts/diagnoseSmsConfig.ts --tenantId=root', 'yellow');
    process.exit(1);
  }

  logSection('SMS Configuration Diagnostic');
  log(`Requested: ${tenantSlug ? `slug=${tenantSlug}` : `id=${tenantId}`}`, 'cyan');

  // Resolve tenant ID
  const resolvedTenantId = await resolveTenantId(tenantSlug, tenantId);

  if (!resolvedTenantId) {
    log(`\nERROR: Could not resolve tenant from slug "${tenantSlug}"`, 'red');
    process.exit(1);
  }

  log(`Resolved tenant ID: ${resolvedTenantId}`, 'green');

  // Get full diagnostics
  const diagnostics = await getSmsDiagnostics(resolvedTenantId);
  const config = diagnostics.config;

  logSection('Tenant Identity');
  logStatus('Tenant ID', config.tenantId, true);
  logStatus('Tenant Name', config.tenantName, true);

  logSection('SMS Configuration');
  logStatus('FROM Number', config.fromNumber, !!config.fromNumber);
  logStatus('Messaging Service SID', config.messagingServiceSid || 'NOT CONFIGURED', !!config.messagingServiceSid);
  logStatus('Mode', config.mode, config.mode === 'production');
  logStatus('Source', config.source, true);

  logSection('Environment Variables');
  for (const [key, value] of Object.entries(diagnostics.envVars)) {
    const isSet = value !== 'NOT SET';
    logStatus(key, value, isSet);
  }

  logSection('Phone Lines');
  if (diagnostics.phoneLines.length === 0) {
    log('  No phone lines configured for this tenant', 'yellow');
  } else {
    for (const line of diagnostics.phoneLines) {
      const isMain = line.id === 1 ? ' [MAIN]' : '';
      console.log(`  Line #${line.id}: ${line.label} (${line.phoneNumber})${isMain}`);
    }
  }

  logSection('Tenant Phone Config (Raw)');
  if (diagnostics.tenantPhoneConfig) {
    const tpc = diagnostics.tenantPhoneConfig;
    logStatus('phone_number', tpc.phoneNumber);
    logStatus('messaging_service_sid', tpc.messagingServiceSid);
    logStatus('voice_enabled', String(tpc.voiceEnabled));
    logStatus('ivr_mode', tpc.ivrMode);
  } else {
    log('  No tenant_phone_config row found', 'yellow');
  }

  logSection('Validation Results');
  
  if (config.errors.length > 0) {
    log('ERRORS:', 'red');
    for (const error of config.errors) {
      log(`  ✗ ${error}`, 'red');
    }
  }

  if (config.warnings.length > 0) {
    log('WARNINGS:', 'yellow');
    for (const warning of config.warnings) {
      log(`  ⚠ ${warning}`, 'yellow');
    }
  }

  console.log('\n' + '='.repeat(60));
  if (config.isConfigured) {
    log('SMS Configured: YES ✓', 'green');
    log(`Outbound SMS will use: ${config.fromNumber}`, 'green');
  } else {
    log('SMS Configured: NO ✗', 'red');
    log('Fix the errors above to enable SMS sending', 'yellow');
  }
  console.log('='.repeat(60) + '\n');

  process.exit(config.isConfigured ? 0 : 1);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
