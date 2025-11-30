#!/usr/bin/env tsx
/**
 * Tenant Readiness CLI Script
 * 
 * Generates and prints a comprehensive readiness report for any tenant.
 * Supports both positional and named argument formats.
 * 
 * Usage:
 *   npx tsx scripts/printCleanMachineReadiness.ts [tenantSlug]
 *   npx tsx scripts/printCleanMachineReadiness.ts --tenantSlug=<slug>
 *   npm run tenant:readiness -- --tenantSlug=<slug>
 * 
 * Examples:
 *   npx tsx scripts/printCleanMachineReadiness.ts                    # defaults to 'root'
 *   npx tsx scripts/printCleanMachineReadiness.ts root               # positional arg
 *   npx tsx scripts/printCleanMachineReadiness.ts --tenantSlug=root  # named arg
 *   npx tsx scripts/printCleanMachineReadiness.ts cleanmachine
 * 
 * Output Modes:
 *   --json    Output only JSON (no pretty-print header)
 *   --quiet   Suppress banner, show only essential output
 */

import { getTenantReadinessReportBySlug } from '../server/services/tenantReadinessService';
import type { TenantReadinessReport, ReadinessCategory, ReadinessItem } from '../shared/readinessTypes';

function parseArgs(): { tenantSlug: string; jsonOnly: boolean; quiet: boolean } {
  const args = process.argv.slice(2);
  let tenantSlug = 'root';
  let jsonOnly = false;
  let quiet = false;

  for (const arg of args) {
    if (arg.startsWith('--tenantSlug=')) {
      tenantSlug = arg.split('=')[1] || 'root';
    } else if (arg === '--json') {
      jsonOnly = true;
    } else if (arg === '--quiet') {
      quiet = true;
    } else if (!arg.startsWith('--') && !arg.startsWith('-')) {
      tenantSlug = arg;
    }
  }

  if (!tenantSlug || tenantSlug.trim() === '') {
    console.error('[tenant:readiness] ERROR: Missing tenant slug.');
    console.error('');
    console.error('Usage:');
    console.error('  npx tsx scripts/printCleanMachineReadiness.ts --tenantSlug=<slug>');
    console.error('  npx tsx scripts/printCleanMachineReadiness.ts <slug>');
    console.error('');
    console.error('Examples:');
    console.error('  npx tsx scripts/printCleanMachineReadiness.ts --tenantSlug=root');
    console.error('  npx tsx scripts/printCleanMachineReadiness.ts cleanmachine');
    process.exit(1);
  }

  return { tenantSlug: tenantSlug.trim(), jsonOnly, quiet };
}

const STATUS_ICONS: Record<string, string> = {
  pass: '✅',
  warn: '⚠️',
  fail: '❌',
};

const OVERALL_STATUS_LABELS: Record<string, string> = {
  pass: 'PASS',
  warn: 'WARN',
  fail: 'FAIL',
};

function formatItem(item: ReadinessItem, indent: string = '  '): string {
  const icon = STATUS_ICONS[item.status] || '•';
  let line = `${indent}${icon} ${item.status.toUpperCase()}: ${item.label}`;
  
  if (item.details) {
    line += ` (${item.details})`;
  }
  
  if (item.suggestion && item.status !== 'pass') {
    line += `\n${indent}     → ${item.suggestion}`;
  }
  
  return line;
}

function formatCategory(category: ReadinessCategory): string {
  const lines: string[] = [];
  lines.push(`\n[${category.label}]`);
  
  for (const item of category.items) {
    lines.push(formatItem(item));
  }
  
  return lines.join('\n');
}

function formatReport(report: TenantReadinessReport): string {
  const lines: string[] = [];
  
  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push(`  TENANT READINESS REPORT: ${report.tenantSlug}`);
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push(`  Tenant Name: ${report.tenantName}`);
  lines.push(`  Tenant ID:   ${report.tenantId}`);
  lines.push(`  Generated:   ${new Date(report.generatedAt).toLocaleString()}`);
  lines.push('───────────────────────────────────────────────────────────────');
  
  const overallIcon = STATUS_ICONS[report.overallStatus] || '•';
  const overallLabel = OVERALL_STATUS_LABELS[report.overallStatus] || report.overallStatus;
  lines.push(`  Overall Status: ${overallIcon} ${overallLabel}`);
  lines.push(`  Summary: ${report.summary.passCount} pass, ${report.summary.warnCount} warn, ${report.summary.failCount} fail`);
  lines.push('═══════════════════════════════════════════════════════════════');
  
  for (const category of report.categories) {
    lines.push(formatCategory(category));
  }
  
  lines.push('');
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push('JSON OUTPUT:');
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push(JSON.stringify(report, null, 2));
  lines.push('');
  
  return lines.join('\n');
}

async function main() {
  const { tenantSlug, jsonOnly, quiet } = parseArgs();
  
  if (!quiet && !jsonOnly) {
    console.log(`\n🔍 Generating readiness report for tenant: ${tenantSlug}...\n`);
  }
  
  try {
    const report = await getTenantReadinessReportBySlug(tenantSlug);
    
    if (jsonOnly) {
      console.log(JSON.stringify({
        ok: true,
        tenantSlug,
        tenantId: report.tenantId,
        tenantName: report.tenantName,
        overallStatus: report.overallStatus,
        summary: report.summary,
        readiness: report,
      }, null, 2));
    } else {
      console.log(formatReport(report));
    }
    
    if (report.overallStatus === 'fail') {
      if (!quiet && !jsonOnly) {
        console.log('⚠️  There are FAILING items that need attention before going live.\n');
      }
      process.exit(1);
    } else if (report.overallStatus === 'warn') {
      if (!quiet && !jsonOnly) {
        console.log('⚠️  There are warnings to review, but no critical failures.\n');
      }
      process.exit(0);
    } else {
      if (!quiet && !jsonOnly) {
        console.log('✅ All readiness checks passed!\n');
      }
      process.exit(0);
    }
  } catch (error: any) {
    const errorOutput = {
      ok: false,
      tenantSlug,
      error: error.message,
    };
    
    if (jsonOnly) {
      console.log(JSON.stringify(errorOutput, null, 2));
    } else {
      console.error(`\n[tenant:readiness] ❌ Error: ${error.message}\n`);
      
      if (error.message.includes('not found')) {
        console.error(`Tenant "${tenantSlug}" was not found in the database.`);
        console.error('You can use either the subdomain or tenant ID to look up a tenant.');
        console.error('\nCommon tenant slugs:');
        console.error('  - root             (Clean Machine Auto Detail - the root tenant)');
        console.error('  - <subdomain>      (any tenant subdomain)');
        console.error('  - <tenantId>       (direct tenant ID)');
      }
    }
    
    process.exit(1);
  }
}

main();
