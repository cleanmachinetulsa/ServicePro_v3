/**
 * Global Tables Configuration (Multi-Tenant Hardening)
 * 
 * This file defines which database tables are GLOBAL (shared across all tenants)
 * versus tenant-scoped. Global tables do NOT have a tenantId column.
 * 
 * CRITICAL: Never use tenantDb.withTenantFilter() on global tables!
 * Use `db` directly instead.
 * 
 * This configuration is used by:
 * 1. tenantDb.ts for runtime validation
 * 2. Audit scripts for static analysis
 * 3. Developer reference
 */

export const GLOBAL_TABLE_NAMES = [
  'business_settings',
  'org_settings', 
  'homepage_content',
  'daily_send_counters',
  'sessions',
] as const;

export type GlobalTableName = typeof GLOBAL_TABLE_NAMES[number];

/**
 * Check if a table name is a global table
 */
export function isGlobalTable(tableName: string): boolean {
  return GLOBAL_TABLE_NAMES.includes(tableName as GlobalTableName);
}

/**
 * Get the SQL table name from a Drizzle table object
 */
export function getTableName(table: { [key: symbol]: { name: string } } | any): string | null {
  // Drizzle tables have a symbol property that contains metadata
  const symbols = Object.getOwnPropertySymbols(table);
  for (const sym of symbols) {
    const meta = table[sym];
    if (meta && typeof meta === 'object' && 'name' in meta) {
      return meta.name;
    }
  }
  // Fallback: check if table has a direct name property
  if (table && typeof table === 'object' && '_' in table && table._.name) {
    return table._.name;
  }
  return null;
}

/**
 * Validate that a table is NOT a global table before using withTenantFilter
 * Throws an error with actionable guidance if it is
 */
export function validateNotGlobalTable(table: any, operation: string = 'withTenantFilter'): void {
  const tableName = getTableName(table);
  if (tableName && isGlobalTable(tableName)) {
    throw new Error(
      `[TENANT DB ERROR] Cannot use ${operation}() on global table "${tableName}". ` +
      `Global tables do not have a tenantId column. ` +
      `Use "db" directly instead of "tenantDb". ` +
      `See server/globalTables.ts for the list of global tables.`
    );
  }
}
