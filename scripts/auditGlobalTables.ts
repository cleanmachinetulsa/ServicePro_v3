#!/usr/bin/env npx tsx
/**
 * Global Tables Audit Script
 * 
 * This script scans the codebase for incorrect usage of tenantDb.withTenantFilter()
 * on global tables that don't have a tenantId column.
 * 
 * Run: npx tsx scripts/auditGlobalTables.ts
 * 
 * Exit codes:
 * - 0: No issues found
 * - 1: Issues found (should fail CI)
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Global tables that should NEVER use withTenantFilter
const GLOBAL_TABLES = [
  'businessSettings',
  'business_settings',
  'orgSettings',
  'org_settings',
  'homepageContent', 
  'homepage_content',
  'dailySendCounters',
  'daily_send_counters',
  'sessions',
];

// TenantInfo fields that ARE available on req.tenant
const TENANT_INFO_FIELDS = ['id', 'name', 'subdomain', 'isRoot'];

// Fields that require fetching full tenant from database
const TENANT_DB_ONLY_FIELDS = [
  'planTier',
  'status',
  'stripeCustomerId',
  'stripeSubscriptionId',
  'industry',
  'email',
  'phone',
  'logoUrl',
  'settings',
  'config',
  'createdAt',
  'updatedAt',
];

interface Issue {
  file: string;
  line: number;
  pattern: string;
  message: string;
  severity: 'error' | 'warning';
}

const issues: Issue[] = [];

console.log('🔍 Auditing codebase for global table misuse...\n');

// Check 1: withTenantFilter on global tables
console.log('Check 1: Scanning for withTenantFilter on global tables...');
for (const tableName of GLOBAL_TABLES) {
  try {
    const result = execSync(
      `grep -rn "withTenantFilter.*${tableName}" server/ 2>/dev/null || true`,
      { encoding: 'utf-8' }
    );
    
    if (result.trim()) {
      const lines = result.trim().split('\n');
      for (const line of lines) {
        const match = line.match(/^(.+):(\d+):(.+)$/);
        if (match) {
          issues.push({
            file: match[1],
            line: parseInt(match[2]),
            pattern: `withTenantFilter.*${tableName}`,
            message: `Global table "${tableName}" should not use withTenantFilter(). Use db directly.`,
            severity: 'error',
          });
        }
      }
    }
  } catch (e) {
    // grep returns non-zero when no matches found
  }
}

// Check 2: req.tenant accessing fields not in TenantInfo
console.log('Check 2: Scanning for req.tenant accessing unavailable fields...');
for (const field of TENANT_DB_ONLY_FIELDS) {
  try {
    const result = execSync(
      `grep -rn "req\\.tenant\\.${field}" server/ 2>/dev/null || true`,
      { encoding: 'utf-8' }
    );
    
    if (result.trim()) {
      const lines = result.trim().split('\n');
      for (const line of lines) {
        const match = line.match(/^(.+):(\d+):(.+)$/);
        if (match) {
          // Skip test files
          if (match[1].includes('.test.') || match[1].includes('__tests__')) continue;
          
          issues.push({
            file: match[1],
            line: parseInt(match[2]),
            pattern: `req.tenant.${field}`,
            message: `Field "${field}" is not available on req.tenant. Fetch full tenant from database.`,
            severity: 'error',
          });
        }
      }
    }
  } catch (e) {
    // grep returns non-zero when no matches found
  }
}

// Check 3: tenant.planTier or tenant.status without DB fetch
console.log('Check 3: Scanning for direct tenant field access patterns...');
const dangerousPatterns = [
  { pattern: 'tenant\\.planTier', field: 'planTier' },
  { pattern: 'tenant\\.stripeCustomerId', field: 'stripeCustomerId' },
];

for (const { pattern, field } of dangerousPatterns) {
  try {
    const result = execSync(
      `grep -rn "${pattern}" server/ 2>/dev/null || true`,
      { encoding: 'utf-8' }
    );
    
    if (result.trim()) {
      const lines = result.trim().split('\n');
      for (const line of lines) {
        const match = line.match(/^(.+):(\d+):(.+)$/);
        if (match) {
          // Skip test files and the globalTables.ts file itself
          if (match[1].includes('.test.') || match[1].includes('globalTables.ts')) continue;
          
          // Check if it's in a context where tenant was fetched from DB
          const content = match[3];
          if (!content.includes('fullTenant') && !content.includes('await db')) {
            issues.push({
              file: match[1],
              line: parseInt(match[2]),
              pattern: `tenant.${field}`,
              message: `Accessing tenant.${field} - verify this comes from DB fetch, not req.tenant`,
              severity: 'warning',
            });
          }
        }
      }
    }
  } catch (e) {
    // grep returns non-zero when no matches found
  }
}

// Print results
console.log('\n' + '='.repeat(60));

const errors = issues.filter(i => i.severity === 'error');
const warnings = issues.filter(i => i.severity === 'warning');

if (errors.length > 0) {
  console.log('\n❌ ERRORS FOUND:\n');
  for (const issue of errors) {
    console.log(`  ${issue.file}:${issue.line}`);
    console.log(`    Pattern: ${issue.pattern}`);
    console.log(`    Message: ${issue.message}\n`);
  }
}

if (warnings.length > 0) {
  console.log('\n⚠️  WARNINGS (manual review recommended):\n');
  for (const issue of warnings) {
    console.log(`  ${issue.file}:${issue.line}`);
    console.log(`    Pattern: ${issue.pattern}`);
    console.log(`    Message: ${issue.message}\n`);
  }
}

if (errors.length === 0 && warnings.length === 0) {
  console.log('\n✅ No issues found! All global table access patterns look correct.\n');
}

console.log('='.repeat(60));
console.log(`Summary: ${errors.length} errors, ${warnings.length} warnings`);

// Exit with error code if errors found
if (errors.length > 0) {
  console.log('\n💡 Tip: See server/globalTables.ts and replit.md for correct patterns.\n');
  process.exit(1);
}

process.exit(0);
