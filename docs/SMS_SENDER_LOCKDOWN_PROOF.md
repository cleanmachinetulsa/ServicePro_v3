# SMS Sender Lockdown - Proof Report

**Date:** 2025-12-18  
**Status:** ✅ COMPLETE

## Executive Summary

Customer-facing outbound SMS is now locked down to ONLY send from `MAIN_PHONE_NUMBER` (+19188565304). All dangerous fallbacks, hardcoded numbers, and scattered send paths have been addressed with a centralized security guard.

---

## 1. What Was Wrong (Before Fix)

### Critical Issues Identified:

| File | Line | Issue |
|------|------|-------|
| `server/config/phoneConfig.ts` | 27 | `DEFAULT_TWILIO_TEST = '+19189183265'` hardcoded - could be used as fallback |
| `server/notifications.ts` | 244 | Hardcoded `'+19188565711'` when backup was used for customer SMS |
| `server/seedPhoneLines.ts` | 27 | Main line defaulted to 5711 instead of 5304 |
| `server/routes.twilioVoiceIvr.ts` | 734, 773, 817 | Fallback to `TWILIO_TEST_SMS_NUMBER` for customer-facing SMS |
| `server/smsFailoverService.ts` | 175, 184 | Used phoneAdmin (5711) as backup for customer-facing SMS |

### Phone Number Roles (Correct Usage):

| Number | Variable | Allowed Use |
|--------|----------|-------------|
| +19188565304 | `MAIN_PHONE_NUMBER` | ✅ Customer-facing SMS (ONLY) |
| +19188565711 | `VIP_PHONE_NUMBER` | ⚠️ Admin-only alerts with `allowAdmin=true` |
| +19189183265 | `TWILIO_TEST_SMS_NUMBER` | ❌ DEV ONLY - never customer-facing |

---

## 2. What Was Changed

### Files Modified:

1. **`server/config/phoneConfig.ts`**
   - Changed `DEFAULT_TWILIO_TEST` from `'+19189183265'` to `''` (empty string)
   - Added security comments clarifying each number's purpose

2. **`server/seedPhoneLines.ts`**
   - Fixed main line default from `BUSINESS_PHONE_NUMBER || '+19188565711'` to `MAIN_PHONE_NUMBER || '+19188565304'`
   - Added security documentation

3. **`server/notifications.ts`**
   - Removed hardcoded `'+19188565711'` fallback at line 244
   - Now uses `failoverResult.fromNumber || actualFromNumber` (validated by guard)
   - **Added early guard validation** before calling failover
   - **Explicit purpose='customer_sms'** and **allowAdmin=false** passed to failover

4. **`server/smsFailoverService.ts`**
   - Integrated `smsSendGuard` validation before all sends
   - Customer-facing failover now FAILS CLOSED instead of using admin line
   - Admin-only notifications CAN still use admin line backup with `allowAdmin=true`

5. **`server/routes.twilioVoiceIvr.ts`**
   - Removed fallback to `TWILIO_TEST_SMS_NUMBER` at lines 734, 773, 817
   - Now requires `MAIN_PHONE_NUMBER` to be set for customer SMS

6. **`server/routes.ts`**
   - Gated test routes behind `TWILIO_TEST_ROUTES_ENABLED=1` env var
   - Added debug endpoints: `GET /api/debug/outbound-sms-sender`, `POST /api/debug/sms-send-dryrun`

7. **`server/services/alertService.ts`**
   - Removed fallback to `phoneConfig.twilioTest`
   - Now uses only `phoneConfig.twilioMain` (MAIN_PHONE_NUMBER) for FROM
   - Security comments added to clarify intent

### New Files Created:

7. **`server/services/smsSendGuard.ts`**
   - Centralized SMS sender validation
   - Blocks customer SMS from 5711 and 83265
   - Enforces MAIN_PHONE_NUMBER for all customer-facing purposes
   - Provides `validateSmsSender()` for dry-run testing

8. **`server/tests/smsSendGuard.test.ts`**
   - 33 comprehensive tests covering all scenarios
   - Tests all customer-facing purposes block 5711
   - Tests admin-only with/without allowAdmin flag

---

## 3. Verification Commands & Results

### Verify no real test number defaults remain:
```bash
$ rg -n "\\+19189183265|DEFAULT_TWILIO_TEST" server shared | grep -v ".test.ts" | grep -v "EMPTY"
```
**Result:** Only appears in:
- Comments explaining purpose
- `smsSendGuard.ts` blocked list (intentional)
- `portRecoveryService.ts` blocked list (intentional)

### Verify 5711 only in admin contexts:
```bash
$ rg -n "\\+19188565711" server shared | grep -v ".test.ts" | grep -v "[Aa]dmin" | grep -v "VIP"
```
**Result:** Only appears in:
- Schema comments (examples)
- Error message examples
- portMonitoring documentation

### Verify twilio.messages.create paths:
```bash
$ rg -n "twilio\\.messages\\.create\\(" server
```
**Result:** Found in:
- `routes.smsFallback.ts:79,88` - Uses `twilioPhoneNumber` (MAIN_PHONE_NUMBER)
- `smsFailoverService.ts:172,204,254` - Goes through smsSendGuard
- `routes.twilioVoiceIvr.ts:746,787,831` - Uses MAIN_PHONE_NUMBER (no fallback)

### Test Results:
```
✓ server/tests/smsSendGuard.test.ts (33 tests) 26ms
Test Files  1 passed (1)
Tests       33 passed (33)
```

---

## 4. How to Verify Live

### Check SMS sender configuration:
```bash
curl -X GET https://YOUR_DOMAIN/api/debug/outbound-sms-sender
```

**Expected Response:**
```json
{
  "success": true,
  "config": {
    "mainNumberMasked": "***5304",
    "testNumberPresent": false,
    "phoneAdminMasked": "***5711",
    "messagingServiceSidPresent": true,
    "testRoutesEnabled": false,
    "blockedCustomerNumbers": ["***5711", "***3265"]
  },
  "security": "Customer SMS only sends from MAIN_PHONE_NUMBER"
}
```

### Dry-run test (ALLOWED - main number):
```bash
curl -X POST https://YOUR_DOMAIN/api/debug/sms-send-dryrun \
  -H "Content-Type: application/json" \
  -d '{"to": "+15551234567", "from": "+19188565304", "purpose": "customer_sms"}'
```

**Expected Response:**
```json
{
  "success": true,
  "dryRun": true,
  "decision": {
    "allowed": true,
    "fromUsed": "***5304",
    "reason": "Customer-facing SMS using main number",
    "usedMessagingService": false,
    "error": null
  }
}
```

### Dry-run test (BLOCKED - admin number):
```bash
curl -X POST https://YOUR_DOMAIN/api/debug/sms-send-dryrun \
  -H "Content-Type: application/json" \
  -d '{"to": "+15551234567", "from": "+19188565711", "purpose": "customer_sms"}'
```

**Expected Response:**
```json
{
  "success": true,
  "dryRun": true,
  "decision": {
    "allowed": false,
    "fromUsed": "***5711",
    "reason": "[SMS BLOCK] Illegal FROM=...",
    "usedMessagingService": false,
    "error": "[SMS BLOCK] Illegal FROM=..."
  }
}
```

---

## 5. Remaining Risks

### Low Risk - Documented & Mitigated:

1. **IVR Direct Sends** (`routes.twilioVoiceIvr.ts`)
   - These 3 locations send SMS directly without going through notifications.ts
   - **Mitigation:** Fixed to use MAIN_PHONE_NUMBER only, no test fallback

2. **Alert Service** (`services/alertService.ts`)
   - Sends admin/urgent alerts using phoneConfig.twilioMain
   - **Risk Level:** Low - these are admin-only alerts to owner's phone
   - **Mitigation:** twilioTest now defaults to empty, so fallback is harmless

3. **Port Monitoring** (`portMonitoring.ts`)
   - Tests ported number availability
   - **Risk Level:** Low - only runs when PORT_MONITORING_ENABLED=1
   - **Mitigation:** Clearly documented as test-only in code

### Zero Risk:

- SMS campaigns go through `notifications.ts` → `smsFailoverService.ts` → `smsSendGuard`
- All booking confirmations go through same path
- All conversational replies go through same path
- Failover for customer SMS now fails closed (does not use admin line)

---

## 6. Test Routes Status

Test routes (`twilioTestSmsRouter`, `twilioTestVoiceRouter`) are now **disabled by default**.

To enable for development:
```bash
export TWILIO_TEST_ROUTES_ENABLED=1
```

Production should **NEVER** have this set.

---

## Conclusion

✅ **Customer-facing SMS is locked to MAIN_PHONE_NUMBER (+19188565304)**  
✅ **Hardcoded fallbacks removed**  
✅ **Centralized guard with logging**  
✅ **Test routes disabled by default**  
✅ **33 tests passing**  
✅ **Debug endpoints available for verification**
