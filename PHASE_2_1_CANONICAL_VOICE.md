# Phase 2.1: Canonical Voice Entry-Point

## Overview
This phase implements a standardized voice webhook endpoint for multi-tenant telephony in ServicePro. The endpoint provides a clean separation from legacy IVR logic and establishes the foundation for per-tenant phone configuration.

## Endpoint Details

### URL
```
POST /twilio/voice/incoming
```

### Purpose
This is the canonical entry-point for all inbound voice calls in the ServicePro multi-tenant platform.

### Current Behavior (Phase 2.1)
- **Tenant Resolution**: Hardcoded to 'root' tenant (Clean Machine)
- **Call Routing**: Direct SIP forwarding to `jody@cleanmachinetulsa.sip.twilio.com`
- **Caller ID**: Passthrough enabled - owner sees customer's actual phone number
- **Security**: Twilio signature verification via `verifyTwilioSignature` middleware

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

**Test Coverage:**
- ✅ Returns 200 and valid TwiML XML
- ✅ Returns TwiML with `<Dial>` element
- ✅ Dials the Clean Machine SIP endpoint for root tenant
- ✅ Passes through caller ID in the Dial element
- ✅ Handles missing From/To/CallSid gracefully
- ✅ Resolves to root tenant for any incoming number (Phase 2.1)

### Implementation Files

1. **`server/routes.twilioVoiceCanonical.ts`**
   - Canonical voice router with tenant resolver middleware
   - Simple SIP forwarding logic
   - Comprehensive logging for debugging

2. **`server/tests/twilioVoiceCanonical.test.ts`**
   - 6 tests covering all core functionality
   - Validates TwiML structure and SIP routing

3. **`server/routes.ts`** (line 3339)
   - Canonical voice routes registered ahead of legacy IVR routes
   - Ensures new endpoint takes precedence

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

**Phase 2.1**: ✅ Complete
- Endpoint: `/twilio/voice/incoming`
- Tenant: Hardcoded to 'root'
- Routing: SIP forwarding to Clean Machine
- Tests: 6/6 passing
- Production-ready: Yes (for root tenant only)
