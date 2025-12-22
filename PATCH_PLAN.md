# PATCH PLAN: Fix SMS Tenant Mixing and Escalation

**Status:** READY FOR IMPLEMENTATION  
**Estimated Impact:** CRITICAL FIX  
**Estimated Effort:** 2-3 turns (Autonomous mode recommended)  
**Risk Level:** LOW (scoped changes, existing patterns)

---

## SUMMARY

Fix the hardcoded `tenantId='root'` issue by implementing proper **phone-to-tenant resolution** for SMS inbound, then **tenant-aware escalation** for owner alerts.

---

## PATCH 1: Implement Phone-to-Tenant Resolution

### GOAL
Replace hardcoded `tenantId='root'` with a real lookup that:
1. Takes the incoming `To` phone number
2. Queries phone_lines table for matching tenant_id
3. Gracefully falls back to 'root' if no match (safety net)
4. Logs the resolution strategy for debugging

### FILES TO MODIFY
- **`server/routes/twilioTestSms.ts`** (Line 143)

### CHANGES

**Before (Line 143):**
```typescript
const tenantId = 'root';
```

**After:**
```typescript
// Resolve tenant from incoming phone number
const incomingTo = (req.body?.To || '').trim();
const tenantId = await resolveTenantFromPhoneNumber(incomingTo) || 'root';
console.log(`[SMS INBOUND] phone=${From} to=${incomingTo} tenantId=${tenantId} resolved_via=phone_lookup`);
```

### NEW HELPER FUNCTION
**Location:** `server/services/tenantPhoneResolver.ts` (NEW FILE)

```typescript
/**
 * Resolve tenant from incoming SMS To number
 * Queries phone_lines table to find which tenant owns this number
 * Falls back to 'root' if not found
 */
export async function resolveTenantFromPhoneNumber(toPhone: string): Promise<string | null> {
  if (!toPhone || toPhone.trim() === '') {
    return null;
  }

  try {
    const normalized = toPhone.replace(/[^\d+]/g, '');
    
    // Query phone_lines table (global, not tenant-scoped)
    const [line] = await db
      .select({ tenantId: phoneLines.tenantId })
      .from(phoneLines)
      .where(eq(phoneLines.phoneNumber, normalized))
      .limit(1);
    
    if (line?.tenantId) {
      console.log(`[TENANT RESOLVER] Resolved ${toPhone} → tenant=${line.tenantId}`);
      return line.tenantId;
    }
  } catch (error) {
    console.error(`[TENANT RESOLVER] Error resolving tenant from phone:`, error);
  }
  
  return null;  // Will fallback to 'root'
}
```

### VERIFICATION
- [ ] Phone line config exists in schema
- [ ] Root phone line is seeded in `seedPhoneLines.ts`
- [ ] Clean Machine phone line (+19188565304) is mapped to 'root' tenant
- [ ] Test: SMS to +19188565304 resolves to 'root'
- [ ] Test: SMS to unknown number falls back to 'root' (gracefully)

---

## PATCH 2: Tenant-Aware Escalation Configuration

### GOAL
Replace global `process.env.BUSINESS_OWNER_PERSONAL_PHONE` with **tenant-specific owner phone lookup** so escalations go to the right owner.

### FILES TO MODIFY
- **`server/routes/twilioTestSms.ts`** (Lines 306, 359, 734)

### APPROACH

**BEFORE:** 
```typescript
const ownerPhone = process.env.BUSINESS_OWNER_PERSONAL_PHONE;
```

**AFTER:**
```typescript
const ownerPhone = await getTenantOwnerPhone(tenantId);
if (!ownerPhone) {
  console.warn(`[ESCALATION] No owner phone configured for tenant=${tenantId}`);
  // Still escalate but flag as undeliverable
}
```

### NEW HELPER FUNCTION
**Location:** `server/services/tenantPhoneResolver.ts` (same file)

```typescript
/**
 * Get owner's phone number for a specific tenant
 * Searches phone_lines for "admin" role, or falls back to env var for root
 */
export async function getTenantOwnerPhone(tenantId: string): Promise<string | null> {
  try {
    // For root tenant, use legacy env var (backward compatibility)
    if (tenantId === 'root') {
      return process.env.BUSINESS_OWNER_PERSONAL_PHONE || null;
    }

    // For other tenants, look up owner phone in tenantConfig or phoneLines
    const tenantDb = wrapTenantDb(db, tenantId);
    const config = await tenantDb
      .select({ ownerPhone: tenantConfig.ownerPhone })
      .from(tenantConfig)
      .limit(1);
    
    if (config?.[0]?.ownerPhone) {
      return config[0].ownerPhone;
    }

    // Fallback: check if tenantConfig has ownerPhone field
    // If not, return null (alert won't send, but won't block customer message)
    return null;
  } catch (error) {
    console.error(`[TENANT PHONE] Error getting owner phone for ${tenantId}:`, error);
    return null;
  }
}
```

### SCHEMA ADDITION (if needed)
**Check:** Does `tenantConfig` table have an `ownerPhone` column?  
**If NO:** Add it:
```typescript
ownerPhone: varchar("owner_phone", { length: 20 }),  // e.g. +19188565711
```

### VERIFICATION
- [ ] Root tenant owner phone comes from env var
- [ ] Other tenants get owner phone from database
- [ ] Missing owner phone doesn't crash escalation (graceful degradation)
- [ ] Escalation message includes tenant name/context

---

## PATCH 3: Loop Detection for Escalation

### GOAL
Prevent infinite loops where AI keeps asking the same question. If bot asks same question 2+ times, escalate to human.

### FILES TO MODIFY
- **`server/routes/twilioTestSms.ts`** (Around line 263 SMS DRAFT section)
- **`shared/schema.ts`** (smsBookingState or new field)

### APPROACH

**Track in SMS booking state:**
```typescript
// In smsBookingState:
lastAiQuestion: string | null;  // e.g., "What service?"
questionRepeatCount: number;    // 0, 1, 2, ...
```

**Check before sending AI response:**
```typescript
// Line ~263, after building conversationHistory
if (detectRepeatQuestion(deterministicReply, persistedState.lastAiQuestion)) {
  persistedState.questionRepeatCount = (persistedState.questionRepeatCount || 0) + 1;
  
  if (persistedState.questionRepeatCount >= 2) {
    console.log(`[LOOP DETECTED] Same Q asked 2+ times, escalating to human`);
    // Don't send AI response, escalate to human instead
    await escalateToHuman(tenantId, From, "Loop detected: bot stuck asking same question");
    const humanReply = "I'm not understanding your needs clearly. Let me get a human to help. They'll reach out shortly.";
    twimlResponse.message(humanReply);
    res.type('text/xml').send(twimlResponse.toString());
    return;
  }
}

persistedState.lastAiQuestion = deterministicReply;
await updateSmsBookingState(tenantDb, conversation.id, persistedState);
```

**Helper function:**
```typescript
function detectRepeatQuestion(newResponse: string, lastResponse: string | null): boolean {
  if (!lastResponse) return false;
  
  // Simple check: same first 50 chars = same question
  const normalize = (s: string) => s.substring(0, 50).toLowerCase();
  return normalize(newResponse) === normalize(lastResponse);
}
```

### VERIFICATION
- [ ] Bot tracks last question asked
- [ ] Bot counts repeated questions
- [ ] After 2 repeats, escalation triggers (not sent to customer)
- [ ] Test: Simulate loop, verify escalation alert sent to owner

---

## PATCH 4: Dedicated Escalation Helper

### GOAL
Create a **single, reusable escalation function** that:
1. Checks if escalation is needed
2. Gets tenant's owner phone
3. Sends alert with full context (tenant, customer, reason, conversation snippet)
4. Marks conversation as needsHumanAttention
5. Logs all results clearly

### FILES TO MODIFY
- **`server/services/tenantPhoneResolver.ts`** (add new function)
- **`server/routes/twilioTestSms.ts`** (replace inline escalation code)

### NEW FUNCTION

```typescript
/**
 * Escalate SMS conversation to human owner
 * Sends alert SMS and marks conversation for human review
 * Ensures context is preserved even if escalation SMS fails
 */
export async function escalateSmsToHuman(opts: {
  tenantId: string;
  fromPhone: string;
  toPhone: string;
  conversationId: number;
  reason: string;  // "booking_failed", "loop_detected", "tool_error", etc.
  context?: string;  // Last customer message or error details
  tenantDb: any;
}) {
  const { tenantId, fromPhone, conversationId, reason, context } = opts;
  
  console.log(`[ESCALATION] Initiating for tenant=${tenantId} reason=${reason}`);
  
  let escalationSmsSucceeded = false;
  let ownerPhone: string | null = null;

  try {
    // Step 1: Get owner phone
    ownerPhone = await getTenantOwnerPhone(tenantId);
    if (!ownerPhone) {
      console.warn(`[ESCALATION] No owner phone for tenant=${tenantId} - alert will not send`);
    }

    // Step 2: Send alert if owner phone exists
    if (ownerPhone) {
      const twilioClient = (await import('twilio')).default(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );

      const alertMessage = 
        `🚨 ESCALATION REQUIRED [${tenantId}]\n` +
        `Reason: ${reason}\n` +
        `Customer: ${fromPhone}\n` +
        `${context ? `Context: ${context.substring(0, 100)}...` : ''}\n` +
        `Conversation: #${conversationId}\n` +
        `Dashboard: [link to conversation]`;

      await twilioClient.messages.create({
        to: ownerPhone,
        from: opts.toPhone,
        body: alertMessage,
      });
      escalationSmsSucceeded = true;
      console.log(`[ESCALATION_SENT] tenant=${tenantId} reason=${reason} to=${ownerPhone.slice(-4)}`);
    }
  } catch (error) {
    console.error(`[ESCALATION_FAILED] tenant=${tenantId} reason=${reason}:`, error);
  }

  // Step 3: ALWAYS mark conversation for human attention (even if SMS failed)
  try {
    await opts.tenantDb
      .update(conversations)
      .set({
        needsHumanAttention: true,
        needsHumanReason: escalationSmsSucceeded 
          ? reason 
          : `${reason} (escalation SMS failed)`,
      })
      .where(eq(conversations.id, conversationId));

    console.log(`[ESCALATION_MARKED] conversation=${conversationId} needsHumanAttention=true`);
  } catch (error) {
    console.error(`[ESCALATION_MARK_FAILED]`, error);
  }

  return {
    success: escalationSmsSucceeded,
    ownerPhone: ownerPhone ? ownerPhone.slice(-4).padStart(10, '*') : null,
    reason,
  };
}
```

### VERIFICATION
- [ ] Function handles missing owner phone gracefully
- [ ] Conversation marked for human attention even if SMS fails
- [ ] Alert includes tenant, reason, and context
- [ ] All code paths log their result

---

## PATCH 5: Update SMS Inbound Handler

### FILES TO MODIFY
- **`server/routes/twilioTestSms.ts`** (Replace all inline escalation code)

### CHANGES
Replace three separate escalation blocks (lines ~305, ~360, ~735) with:

```typescript
import { escalateSmsToHuman } from '../services/tenantPhoneResolver';

// Anywhere escalation is needed:
await escalateSmsToHuman({
  tenantId,
  fromPhone: From,
  toPhone: To,
  conversationId: conversation.id,
  reason: "booking_failed",
  context: `Service: ${smsBookingState.service}, Error: ${bookingError}`,
  tenantDb,
});
```

**Removed code:** All the try/catch/escalation logic scattered throughout the file

### VERIFICATION
- [ ] All escalation paths use new function
- [ ] No duplicate escalation logic
- [ ] Error messages consistent

---

## PATCH 6: Add Feature Flag for Debug Tracing

### GOAL
Add optional `DEBUG_SMS_TRACE=1` flag for detailed single-request tracing without polluting prod logs

### FILES TO MODIFY
- **`server/routes/twilioTestSms.ts`** (Line ~115, at entry point)

### IMPLEMENTATION

```typescript
const DEBUG_SMS_TRACE = process.env.DEBUG_SMS_TRACE === '1';
const correlationId = crypto.randomUUID().substring(0, 8);

function logSmsTrace(stage: string, payload: Record<string, any>) {
  if (DEBUG_SMS_TRACE) {
    console.log(`[SMS TRACE] cid=${correlationId} stage=${stage} ${JSON.stringify(payload)}`);
  }
}

// Then use at each stage:
logSmsTrace('inbound_received', { from: From, to: To, messageSid });
logSmsTrace('tenant_resolved', { tenantId, resolvedVia: 'phone_lookup' });
logSmsTrace('ai_start', { model: SMS_AGENT_MODEL, promptSize: smsContext.systemPrompt.length });
logSmsTrace('ai_output', { toolCalls: responseMessage.tool_calls?.length || 0, textLength: finalText.length });
logSmsTrace('final_response', { to: From, body: deterministicReply });
```

### VERIFICATION
- [ ] `DEBUG_SMS_TRACE=1 npm run dev` produces per-request traces
- [ ] Production (no flag) has no extra logging
- [ ] Correlation ID ties logs together for single request

---

## IMPLEMENTATION ORDER

### Phase 1: Tenant Resolution (CRITICAL)
1. Create `server/services/tenantPhoneResolver.ts`
2. Implement `resolveTenantFromPhoneNumber()`
3. Update line 143 in `twilioTestSms.ts`
4. Test: SMS to different numbers resolves correctly

### Phase 2: Escalation Helpers (CRITICAL)
1. Implement `getTenantOwnerPhone()` in tenantPhoneResolver
2. Implement `escalateSmsToHuman()` in tenantPhoneResolver
3. Replace all inline escalation code in `twilioTestSms.ts` (3 locations)
4. Test: Escalation sends to correct owner

### Phase 3: Loop Detection (IMPORTANT)
1. Add `lastAiQuestion` and `questionRepeatCount` to smsBookingState schema
2. Implement `detectRepeatQuestion()` helper
3. Add loop detection check before AI response
4. Test: Loop triggers escalation

### Phase 4: Debug Tracing (NICE-TO-HAVE)
1. Add correlation ID and `logSmsTrace()` function
2. Test: `DEBUG_SMS_TRACE=1` produces traces

---

## TESTING CHECKLIST

### Unit Tests
- [ ] `resolveTenantFromPhoneNumber('+19188565304')` returns 'root'
- [ ] `getTenantOwnerPhone('root')` returns env var
- [ ] `escalateSmsToHuman()` handles missing owner phone
- [ ] `detectRepeatQuestion()` identifies repeat questions

### Integration Tests
- [ ] SMS to +19188565304 uses 'root' tenant AI
- [ ] Booking failure → escalation to BUSINESS_OWNER_PERSONAL_PHONE
- [ ] Loop detection after 2 repeats → escalation
- [ ] needsHumanAttention flag set even if escalation SMS fails

### Manual Test Cases

**Test 1: Tenant Resolution**
```bash
# Send SMS to +19188565304 (Clean Machine)
# Check logs: [SMS INBOUND] tenantId=root resolved_via=phone_lookup
# Verify: AI uses Clean Machine behavior rules
```

**Test 2: Escalation on Booking Failure**
```bash
# Send: "I need a wash"
# System attempts booking but fails
# Verify owner alert SMS sent to BUSINESS_OWNER_PERSONAL_PHONE
# Check: Alert includes reason and customer context
```

**Test 3: Loop Detection**
```bash
# Send: "What service?"
# Bot responds: "What service do you need?"
# Send: "Can you help me?"
# Bot responds: "What service do you need?" (REPEAT)
# Send: "Hello?"
# Bot should escalate instead of repeating question
# Verify: Escalation sent with reason="loop_detected"
```

**Test 4: Graceful Degradation**
```bash
# Temporarily delete owner phone config for test tenant
# Send SMS to test tenant number
# System should:
#   1. Resolve correct tenant
#   2. Attempt escalation (find no phone)
#   3. Log warning (not crash)
#   4. Still mark conversation for human attention
#   5. Send customer a helpful message
```

---

## RISK ASSESSMENT

### LOW RISK ✓
- **Hardcoded tenantId replacement:** Straightforward query + fallback
- **Existing patterns:** Phone resolution similar to voice routing (tenantCommRouter)
- **Backward compatibility:** Falls back to 'root' for unknown numbers
- **Scope:** Changes isolated to SMS pipeline

### MITIGATIONS
- ✓ Phone lookup has null/fallback path
- ✓ Global env var still used for root tenant
- ✓ No schema changes to critical tables
- ✓ All escalations logged with reason codes
- ✓ Can be rolled back by reverting 2 files

### VERIFICATION GATES
- [ ] All grep searches for 'root' in smsRouter show intentional cases
- [ ] Phone line config seeded correctly
- [ ] No new data loss/migration risks

---

## METRICS TO MONITOR POST-PATCH

1. **Tenant Resolution Success Rate**
   - Target: 100% of SMS resolved to correct tenant
   - Metric: Count `[SMS INBOUND] tenantId=<actual>` logs

2. **Escalation Delivery**
   - Target: 95%+ of escalations deliver to owner
   - Metric: `[ESCALATION_SENT]` count vs `[ESCALATION_FAILED]` count

3. **Loop Detection Accuracy**
   - Target: <5% false positives
   - Metric: `[LOOP_DETECTED]` count vs false escalations

4. **Owner Alert Latency**
   - Target: <5 seconds from event to SMS delivery
   - Metric: Log timestamp `[ESCALATION_SENT]` vs Twilio receipt

---

## SUCCESS CRITERIA

✅ **PATCH IS COMPLETE WHEN:**
1. SMS to +19188565304 loads Clean Machine AI behavior (not root's)
2. Escalation SMS goes to BUSINESS_OWNER_PERSONAL_PHONE with context
3. Loop detection prevents bot from repeating same question
4. Missing owner phone doesn't crash system
5. All 4 manual tests pass
6. DEBUG_SMS_TRACE=1 produces readable per-request traces

---

## NEXT STEPS (DO NOT IMPLEMENT YET)

This plan is ready for:
1. **Code review** — Confirm architecture matches existing patterns
2. **Schema review** — Verify tenantConfig.ownerPhone exists or needs adding
3. **Implementation** — Use Autonomous mode to execute all 6 patches in parallel
4. **Testing** — Run all 4 manual tests + integration tests
5. **Deployment** — Monitor metrics for 24h before declaring success

