# Outbound SMS Send Paths Report

Generated: 2025-12-18

## Summary of Findings

This report documents all SMS sending paths in the ServicePro codebase to identify and lock down customer-facing outbound SMS senders.

---

## 1. twilio.messages.create() Locations

```
server/routes.smsFallback.ts:79    - twilio.messages.create()
server/routes.smsFallback.ts:88    - twilio.messages.create()
server/smsFailoverService.ts:144   - twilio.messages.create(smsParams)
server/smsFailoverService.ts:184   - twilio.messages.create(backupParams)  ⚠️ USES BACKUP NUMBER
server/smsFailoverService.ts:261   - twilio.messages.create()
```

**Risk Assessment:**
- `smsFailoverService.ts:184` uses `backupParams` which may default to phoneAdmin (+19188565711)
- Multiple scattered send points without centralized guard

---

## 2. Phone Number & Config References

### Hardcoded Defaults (DANGEROUS)
```
server/config/phoneConfig.ts:27    DEFAULT_TWILIO_TEST = '+19189183265'  ⚠️ REMOVE
server/config/phoneConfig.ts:28    DEFAULT_TWILIO_MAIN = '+19188565304'  ✅ Keep
server/config/phoneConfig.ts:29    DEFAULT_PHONE_ADMIN = '+19188565711'  ⚠️ Admin-only
```

### Environment Variable Usage
```
server/config/phoneConfig.ts:33    PHONE_TWILIO_TEST = env || DEFAULT_TWILIO_TEST
server/config/phoneConfig.ts:34    PHONE_TWILIO_MAIN = env || DEFAULT_TWILIO_MAIN
server/config/phoneConfig.ts:35    PHONE_ADMIN = env || DEFAULT_PHONE_ADMIN
```

### MAIN_PHONE_NUMBER References
```
server/routes.conversations.ts:469   - Check for MAIN_PHONE_NUMBER env
server/smsCampaignService.ts:577     - Uses MAIN_PHONE_NUMBER as fallback
server/routes.calls.ts:313           - Uses MAIN_PHONE_NUMBER
server/routes.twilioVoiceIvr.ts:734  - Falls back to TWILIO_TEST_SMS_NUMBER ⚠️
server/routes.twilioVoiceIvr.ts:773  - Falls back to TWILIO_TEST_SMS_NUMBER ⚠️
server/routes.twilioVoiceIvr.ts:817  - Falls back to TWILIO_TEST_SMS_NUMBER ⚠️
```

### +19188565711 (5711 - Admin Line) References
```
server/tests/tenantCommRouter.integration.test.ts - Test file references
server/routes.phoneSettings.ts:100   - Example in error message
```

### +19189183265 (83265 - Test Line) References
```
server/config/phoneConfig.ts:27      - DEFAULT_TWILIO_TEST hardcoded ⚠️
```

### MessagingServiceSid References
```
server/smsCampaignService.ts:12      - TWILIO_MESSAGING_SERVICE_SID env var
shared/schema.ts:384                 - Schema field
server/tests/*                       - Test mocks
```

---

## 3. SMS Service Entry Points

### Primary Services
```
server/notifications.ts              - Main notification dispatch
server/smsFailoverService.ts         - Failover/retry logic
server/smsCampaignService.ts         - Campaign bulk sends
server/criticalMonitoring.ts         - Admin alerts
```

### Routes
```
server/routes.smsFallback.ts         - Fallback SMS endpoint
server/routes/twilioTestVoice.ts     - Test voice routes with SMS
server/routes/twilioDebugSms.ts      - Debug SMS endpoint
server/routes/demoRoutes.ts          - Demo verification SMS
```

### Supporting Services
```
server/services/alertService.ts      - Alert notifications
server/portMonitoring.ts             - Port monitoring (testing)
server/services/portRecoveryService.ts - Port recovery
```

---

## 4. Critical Issues Identified

1. **DEFAULT_TWILIO_TEST hardcoded**: `phoneConfig.ts:27` has `+19189183265` as default
2. **notifications.ts hardcoded 5711**: Backup sender path uses admin number for customer SMS
3. **Scattered twilio.messages.create**: No single choke point for sender validation
4. **IVR fallbacks to test number**: `routes.twilioVoiceIvr.ts` falls back to TWILIO_TEST_SMS_NUMBER
5. **No sender guard**: Customer-facing SMS can be sent from any number

---

## 5. Required Changes

| File | Change Required |
|------|-----------------|
| server/config/phoneConfig.ts | Remove DEFAULT_TWILIO_TEST real number |
| server/smsFailoverService.ts | Add sender guard before all sends |
| server/notifications.ts | Remove hardcoded 5711 backup |
| server/smsCampaignService.ts | Route through guard |
| server/routes.smsFallback.ts | Lock to MAIN_PHONE_NUMBER |
| server/routes.twilioVoiceIvr.ts | Remove test number fallbacks |
| NEW: server/services/smsSendGuard.ts | Create centralized guard |

---

## 6. Phone Number Purpose Matrix

| Number | Variable | Purpose | Customer-Facing |
|--------|----------|---------|-----------------|
| +19188565304 | MAIN_PHONE_NUMBER | Primary customer line | ✅ YES |
| +19188565711 | VIP_PHONE_NUMBER | Admin/VIP alerts | ❌ NO |
| +19189183265 | TWILIO_TEST_SMS_NUMBER | Dev/testing only | ❌ NO |
