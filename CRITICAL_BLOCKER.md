# CRITICAL BLOCKER - RESOLVED ✅

## Issue: SQL Syntax Errors in Tenant Migration
**Status**: ✅ RESOLVED (November 22, 2025 8:50 AM)

## Root Cause
Missing `tenantId` column definitions in `shared/schema.ts` for 3 tables:
- `smsTemplates`
- `conversations`  
- `banners`

When Drizzle ORM tried to generate SQL for queries like `eq(smsTemplates.tenantId, 'root')`, the column reference was undefined, causing malformed SQL: `WHERE = $1` instead of `WHERE tenant_id = $1`.

## Symptoms
```
error: syntax error at or near "="
position: 220/264/725
code: '42601'
```

Affected files:
- `server/initSmsTemplates.ts:178`
- `server/timeoutMonitorService.ts:45`
- `server/routes.banners.ts:45`

## Resolution
Added missing `tenantId` column definitions to all 3 tables in `shared/schema.ts`:

```typescript
export const smsTemplates = pgTable("sms_templates", {
  id: serial("id").primaryKey(),
  tenantId: varchar("tenant_id", { length: 255 }).notNull().default('root'), // ← ADDED
  // ... rest of columns
});

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  tenantId: varchar("tenant_id", { length: 255 }).notNull().default('root'), // ← ADDED
  // ... rest of columns
});

export const banners = pgTable("banners", {
  id: serial("id").primaryKey(),
  tenantId: varchar("tenant_id", { length: 255 }).notNull().default('root'), // ← ADDED
  // ... rest of columns
});
```

## Verification
✅ Server starts without SQL syntax errors  
✅ Timeout monitor working: "Found 0 timed-out conversations"  
✅ SMS templates init running (only duplicate key error - expected)  
✅ Banner routes working with no errors  
✅ All API endpoints responding correctly

## Key Lessons
1. **tenantDb wrapper was NOT the problem** - tried 10+ different wrapper implementations before discovering the real issue
2. **Column definitions must exist in schema** - Drizzle requires explicit column objects to generate valid SQL
3. **TABLE_METADATA registration is not enough** - columns must be defined on the actual table schema
4. **Testing with raw `db` helped isolate the issue** - proved the wrapper wasn't the culprit

## Impact on Migration
Phase 1H migration is complete. All 49 files successfully migrated to use `req.tenantDb`.
Ready to proceed with Phase 1I verification and testing.
