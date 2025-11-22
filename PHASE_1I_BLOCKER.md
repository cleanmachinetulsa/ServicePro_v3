# Phase 1I Critical Blocker: SQL Syntax Errors

## Status: UNRESOLVED - Requires Architectural Investigation

### Affected Files:
1. `server/initSmsTemplates.ts` - Line 180
2. `server/timeoutMonitorService.ts` - Line 47  
3. `server/routes.banners.ts` - Line 45

### Error Pattern:
All three files fail with identical SQL syntax error:
```
error: syntax error at or near "="
```

Generated SQL appears to be malformed: `WHERE = $1`

### Root Cause:
The `createTenantDb` function's SELECT implementation conflicts with `withTenantFilter`, causing malformed SQL generation when using `wrapTenantDb(db, 'root')` for service-level queries.

### Attempted Fixes (ALL FAILED):
1. Using `withTenantFilter` in SELECT queries
2. Direct filtering with `eq(table.tenantId, tenantId)`
3. Caching tenantId in variable
4. Removing `.select()` override from `wrapTenantDb`
5. Changing `createTenantDb` select from arrow function to `.bind(db)`
6. Using raw `db.select` (crashes: "Cannot execute a query on a query builder")
7. Removing select property entirely (crashes: "tenantDb.select is not a function")

### Impact:
- Server starts but 3 initializations fail on every restart
- Features affected: SMS templates, timeout monitoring, banner system
- Does NOT block core functionality
- Partial tenant migration completed for these files

### Recommendation:
Requires deep architectural investigation of `tenantDb.ts` SELECT implementation and relationship with Drizzle query builders. May need complete rewrite of tenant-aware SELECT handling.

### Temporary Status:
Server runs with non-critical initialization errors. Core app functionality intact.
