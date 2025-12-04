# Phase 2.2: Canonical Voice Entry-Point with Dynamic Tenant Lookup ✅ COMPLETE

## Overview
This phase implements dynamic multi-tenant telephony routing via the `tenantPhoneConfig` table. The canonical voice endpoint now looks up tenants by phone number and uses per-tenant SIP configuration from the database.

## Endpoint Details

### URL
```
POST /twilio/voice/incoming
```

### Purpose
This is the canonical entry-point for all inbound voice calls in the ServicePro multi-tenant platform with full multi-tenant support.

### Current Behavior (Phase 2.2) ✅
- **Tenant Resolution**: ✅ Dynamic lookup via `tenantPhoneConfig` table by Twilio 'To' number
- **Call Routing**: ✅ Per-tenant SIP configuration from database
- **Fallback**: ✅ Falls back to 'root' tenant for unconfigured numbers
- **Caller ID**: ✅ Passthrough enabled - owner sees customer's actual phone number
- **Security**: ✅ Twilio signature verification via `verifyTwilioSignature` middleware

### Twilio Configuration

To use this endpoint, configure your Twilio phone number's voice webhook:

1. Log into Twilio Console
2. Navigate to Phone Numbers → Manage → Active Numbers
3. Select your phone number (e.g., +19188565304)
4. Set **Voice & Fax** → **A Call Comes In** to:
   ```
   https://your-domain.replit.app/twilio/voice/incoming
   ```
5. Method: **POST**
6. Save changes

### Testing

Run the test suite to verify functionality:

```bash
npx vitest run server/tests/twilioVoiceCanonical.test.ts
```

**Test Coverage (Phase 2.2):**
- ✅ Returns 200 and valid TwiML XML
- ✅ Returns TwiML with `<Dial>` element
- ✅ Uses database SIP config for configured phone numbers
- ✅ Passes through caller ID in the Dial element
- ✅ Handles missing From/To/CallSid gracefully and falls back to root
- ✅ Falls back to root tenant for unconfigured phone numbers
- ✅ Dynamic tenant lookup by phone number works correctly

**All 7 tests passing!**

### Implementation Files

1. **`server/routes.twilioVoiceCanonical.ts`**
   - Canonical voice router with dynamic tenant resolver middleware
   - Database-driven SIP forwarding logic
   - Comprehensive logging for debugging (shows "Using database SIP config" vs "Using hardcoded root fallback")

2. **`server/tests/twilioVoiceCanonical.test.ts`**
   - 7 tests covering all core functionality including dynamic tenant lookup
   - Validates TwiML structure and SIP routing from database
   - Tests fallback behavior for unconfigured numbers

3. **`server/routes.ts`** (line 3339)
   - Canonical voice routes registered ahead of legacy IVR routes
   - Ensures new endpoint takes precedence

4. **`shared/schema.ts`** (line 210)
   - `tenantPhoneConfig` table definition with phone number, SIP settings, IVR mode
   - Unique index on phone_number for fast lookups

5. **`server/services/tenantPhone.ts`**
   - `getTenantByPhoneNumber()` - Reverse lookup tenant by phone number
   - `getTenantPhoneConfig()` - Get phone config by tenant ID
   - `getAllTenantPhoneConfigs()` - Admin dashboard support

6. **`server/seed/seedTenantPhone.ts`**
   - Seeds root tenant phone configuration on startup
   - Idempotent - safe to run multiple times

7. **`server/migrations/20251122_add_tenant_phone_config.sql`**
   - Database migration for tenant_phone_config table
   - Creates indexes for efficient lookups

## Future Phases

### Phase 2.2: Tenant Phone Config Table
Will add `tenantPhoneConfig` table with:
- `tenantId` (foreign key to tenants)
- `phoneNumber` (Twilio number, unique)
- `sipDomain` (e.g., `cleanmachinetulsa.sip.twilio.com`)
- `sipUsername` (e.g., `jody`)
- `ivrMode` ('simple' | 'ivr' | 'ai-voice')
- `forwardingNumber` (fallback for PSTN forwarding)

### Phase 2.3: Dynamic Tenant Lookup
The `tenantResolverForTwilio` middleware will:
1. Extract `req.body.To` (Twilio number called)
2. Query `tenantPhoneConfig` by phone number
3. Resolve `tenantId` and attach to `req.tenant`
4. Populate `req.tenantDb` with tenant-scoped database

### Phase 2.4: IVR Mode Support
The handler will support multiple IVR modes:
- **simple**: Direct SIP/PSTN forwarding (current behavior)
- **ivr**: Interactive voice menu (existing IVR logic)
- **ai-voice**: AI-powered voice agent (future)

## Architecture Decisions

### Why a Separate File?
- **Non-breaking**: Legacy IVR endpoints (`/twilio/voice` and `/api/voice`) remain untouched
- **Clean slate**: No complex IVR logic to work around
- **Testable**: Isolated functionality makes testing straightforward
- **Scalable**: Easy to extend for multi-tenant features

### Why Register First?
The canonical router is registered **before** legacy routes in `server/routes.ts` to ensure:
- New Twilio webhooks use the canonical endpoint
- Existing integrations continue working with legacy endpoints
- Clear migration path: point Twilio webhooks to `/twilio/voice/incoming`

### Security Considerations
- Twilio signature verification prevents unauthorized webhook calls
- Tenant isolation enforced via `wrapTenantDb`
- No hardcoded credentials (SIP endpoint will come from database in Phase 2.3)

## Migration Path

1. **Now (Phase 2.1)**: New endpoint live, hardcoded to root tenant
2. **Phase 2.2**: Add `tenantPhoneConfig` table and admin UI
3. **Phase 2.3**: Enable dynamic tenant lookup
4. **Phase 2.4**: Gradually migrate Twilio webhooks from legacy endpoints
5. **Phase 3+**: Deprecate legacy IVR endpoints once all tenants migrated

## Logging & Debugging

All canonical voice calls log with `[CANONICAL VOICE]` prefix:
```
[CANONICAL VOICE] Tenant resolved: root for incoming call to +19188565304
[CANONICAL VOICE] Incoming call from +19185551234 to +19188565304, CallSid: CAxxxxx
[CANONICAL VOICE] Forwarding to SIP: jody@cleanmachinetulsa.sip.twilio.com
```

Filter logs:
```bash
grep "[CANONICAL VOICE]" /tmp/logs/start_application_*.log
```

## Status

**Phase 2.2**: ✅ Complete
- Endpoint: `/twilio/voice/incoming`
- Tenant: ✅ Dynamic lookup via `tenantPhoneConfig` table
- Routing: ✅ Per-tenant SIP configuration from database
- Database: ✅ `tenant_phone_config` table created and seeded
- Tests: ✅ 7/7 passing
- Production-ready: ✅ Yes (full multi-tenant support)
