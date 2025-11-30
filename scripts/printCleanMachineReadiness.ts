#!/usr/bin/env tsx
/**
 * Clean Machine Readiness Report Script
 * 
 * Generates and prints a human-readable readiness report for the
 * Clean Machine tenant (or any tenant specified via CLI argument).
 * 
 * Usage:
 *   npx tsx scripts/printCleanMachineReadiness.ts [tenantSlug]
 *   npm run check:readiness [tenantSlug]
 * 
 * Examples:
 *   npx tsx scripts/printCleanMachineReadiness.ts
 *   npx tsx scripts/printCleanMachineReadiness.ts cleanmachine
 *   npx tsx scripts/printCleanMachineReadiness.ts my-other-tenant
 */

import { getTenantReadinessReportBySlug } from '../server/services/tenantReadinessService';
import type { TenantReadinessReport, ReadinessCategory, ReadinessItem } from '../shared/readinessTypes';

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
  const identifier = process.argv[2] || 'root';
  
  console.log(`\n🔍 Generating readiness report for tenant: ${identifier}...\n`);
  
  try {
    const report = await getTenantReadinessReportBySlug(identifier);
    console.log(formatReport(report));
    
    if (report.overallStatus === 'fail') {
      console.log('⚠️  There are FAILING items that need attention before going live.\n');
      process.exit(1);
    } else if (report.overallStatus === 'warn') {
      console.log('⚠️  There are warnings to review, but no critical failures.\n');
      process.exit(0);
    } else {
      console.log('✅ All readiness checks passed!\n');
      process.exit(0);
    }
  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}\n`);
    
    if (error.message.includes('not found')) {
      console.error(`Tenant "${identifier}" was not found in the database.`);
      console.error('You can use either the subdomain or tenant ID to look up a tenant.');
    }
    
    process.exit(1);
  }
}

main();
