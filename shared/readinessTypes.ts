/**
 * Tenant Readiness Engine - Shared Types
 * 
 * These types are used by the backend readiness service and can be consumed
 * by the frontend or Agent Context for unified readiness reporting.
 */

export type ReadinessStatus = "pass" | "warn" | "fail";

export interface ReadinessItem {
  key: string;
  label: string;
  status: ReadinessStatus;
  details?: string;
  suggestion?: string;
  fixUrl?: string;
}

export interface ReadinessCategory {
  id: string;
  label: string;
  items: ReadinessItem[];
}

export interface TenantReadinessReport {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  generatedAt: string;
  overallStatus: ReadinessStatus;
  categories: ReadinessCategory[];
  summary: {
    totalItems: number;
    passCount: number;
    warnCount: number;
    failCount: number;
  };
}

export function computeOverallStatus(categories: ReadinessCategory[]): ReadinessStatus {
  let hasFail = false;
  let hasWarn = false;
  
  for (const category of categories) {
    for (const item of category.items) {
      if (item.status === 'fail') {
        hasFail = true;
      } else if (item.status === 'warn') {
        hasWarn = true;
      }
    }
  }
  
  if (hasFail) return 'fail';
  if (hasWarn) return 'warn';
  return 'pass';
}

export function computeSummary(categories: ReadinessCategory[]): TenantReadinessReport['summary'] {
  let totalItems = 0;
  let passCount = 0;
  let warnCount = 0;
  let failCount = 0;
  
  for (const category of categories) {
    for (const item of category.items) {
      totalItems++;
      if (item.status === 'pass') passCount++;
      else if (item.status === 'warn') warnCount++;
      else if (item.status === 'fail') failCount++;
    }
  }
  
  return { totalItems, passCount, warnCount, failCount };
}
