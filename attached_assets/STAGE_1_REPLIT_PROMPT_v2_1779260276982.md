# SERVICEPRO — STAGE 1 DROP-IN PROMPT (v2) FOR REPLIT AGENT
## P0 Production Safety: 3 Verified Gaps
### Paste the GUARDRAILS PRE-PROMPT first, then this. Both go in the same Replit chat message.

---

## CONTEXT

This stage fixes **three confirmed P0 gaps** identified by full code audit and verified against the actual repo. Every item marked "already done" below was confirmed in the source — do not rebuild those systems.

**Already done — confirmed in code, do not touch:**
- `customer_threads` schema + `customerThreadService.ts` + SMS inbound linkage in `twilioTestSms.ts`
- iMessage tapback regex (already full-match anchored at `twilioTestSms.ts` ~line 265)
- "Needs you" tab in `NightOpsConversationList.tsx`
- Web chat SSE — hub, route, and `EventSource` subscription in `EnhancedChatbotUI.tsx`
- DEMO_MODE production boot guard in `server/index.ts` (~line 82–93)
- PLATFORM_BG_JOBS_ENABLED Slack warning in `server/index.ts`
- Facebook `x-hub-signature-256` verification in `server/routes.facebook.ts`
- `server/services/aiTokenBudget.ts` — the service is complete
- `conversationHandler.ts` already calls `resolveBudgetDecision` for the **web chat** path (~line 139–207)

---

## SEARCH BLOCK — READ THESE FILES BEFORE WRITING ANYTHING

```
server/googleMapsApi.ts
server/services/aiTokenBudget.ts          (read fully — understand BudgetDecision type)
server/openai.ts                          (find generateAIResponse — note: returns string, not object)
server/routes/twilioTestSms.ts            (find the generateAIResponse call ~line 1307)
server/services/smsInboundDedup.ts
server/conversationHandler.ts             (find the existing resolveBudgetDecision call ~line 139)
```

---

## TASK 1 — Remove all Tulsa hardcoding from address preprocessing

**File:** `server/googleMapsApi.ts`

**What the audit found in this file:**
The `preprocessAddress()` function contains:
- `const hasCity = /tulsa/i.test(address)` — hardcoded city
- `const hasState = /\b(ok|oklahoma)\b/i.test(address)` — hardcoded state  
- `const hasZip = /\b74\d{3}\b/.test(address)` — hardcoded Oklahoma zip range
- Primary branch: `address = \`${address}, Tulsa, OK\`` — hardcodes city + state
- **Secondary branch** (`else if (hasCity && !hasState)`): `address = \`${address}, OK\`` — also hardcodes state
- Google geocode `components` filter: `'locality:Tulsa|administrative_area:OK|country:US'`
- `checkMapsHealth()` test address: `const testAddress = 'Tulsa, OK'` (~line 473)

**The fix — no schema changes, no new columns:**

1. Change the function signature from:
   ```typescript
   function preprocessAddress(address: string)
   ```
   to:
   ```typescript
   function preprocessAddress(address: string, tenantCity?: string, tenantState?: string, tenantZipPrefix?: string)
   ```

2. Replace every hardcoded string inside the function:

   **City detection:**
   ```typescript
   // Before:
   const hasCity = /tulsa/i.test(address);
   // After:
   const hasCity = tenantCity ? new RegExp(tenantCity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(address) : false;
   ```

   **State detection:**
   ```typescript
   // Before:
   const hasState = /\b(ok|oklahoma)\b/i.test(address);
   // After:
   const hasState = tenantState ? new RegExp(`\\b${tenantState.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(address) : false;
   ```

   **Zip detection:**
   ```typescript
   // Before:
   const hasZip = /\b74\d{3}\b/.test(address);
   // After:
   const hasZip = tenantZipPrefix ? new RegExp(`\\b${tenantZipPrefix}\\d+\\b`).test(address) : false;
   ```

   **Primary append branch (no city, no state, no zip):**
   ```typescript
   // Before:
   address = `${address}, Tulsa, OK`;
   // After:
   if (tenantCity && tenantState) {
     address = `${address}, ${tenantCity}, ${tenantState}`;
   }
   // If no tenant config, leave address as-is — Google geocodes without city bias
   ```

   **Secondary append branch (has city, missing state):**
   ```typescript
   // Before:
   address = `${address}, OK`;
   // After:
   if (tenantState) {
     address = `${address}, ${tenantState}`;
   }
   ```

3. **Remove the Google geocode `components` filter entirely.** Find the line:
   ```
   components: 'locality:Tulsa|administrative_area:OK|country:US'
   ```
   Delete it. The address itself provides enough context for Google's geocoder. Do not replace it with a dynamic version — just remove it.

4. **Add a tenant address context helper** (new function, same file):
   ```typescript
   async function getTenantAddressContext(tenantDb: TenantDb): Promise<{
     city?: string;
     state?: string;
     zipPrefix?: string;
   }> {
     try {
       const { businessSettings } = await import('@shared/schema');
       const { eq } = await import('drizzle-orm');
       const rows = await tenantDb.select().from(businessSettings).where(eq(businessSettings.id, 1)).limit(1);
       const row = rows[0];
       if (!row) return {};
       // Parse city/state from businessAddress text field if it exists.
       // Expected format: "123 Main St, Tulsa, OK 74103" or similar.
       const addr = (row as any).businessAddress || (row as any).address || '';
       const cityStateMatch = addr.match(/,\s*([^,]+),\s*([A-Z]{2})\s*\d*/);
       if (cityStateMatch) {
         const city = cityStateMatch[1].trim();
         const state = cityStateMatch[2].trim();
         return { city, state };
       }
       return {};
     } catch (err) {
       console.warn('[MAPS] Could not load tenant address context (fail-open):', err);
       return {};
     }
   }
   ```

5. **Update callers of `preprocessAddress` inside `googleMapsApi.ts`** to pass tenant context. Each call site should:
   ```typescript
   const addrCtx = await getTenantAddressContext(tenantDb);
   const processed = preprocessAddress(rawAddress, addrCtx.city, addrCtx.state, addrCtx.zipPrefix);
   ```

6. **Update `checkMapsHealth()`** — change:
   ```typescript
   const testAddress = 'Tulsa, OK';
   ```
   to:
   ```typescript
   const testAddress = 'Oklahoma City, OK'; // generic test — not tenant-specific
   ```

**Guardrail:** Do NOT add new columns to `shared/schema.ts`. Do NOT run any migration. If `businessAddress` doesn't exist on `businessSettings`, return `{}` and move on.

---

## TASK 2 — Wire AI token budget into the SMS inbound path

**What the audit found:**
- `server/services/aiTokenBudget.ts`: fully built — `resolveBudgetDecision(tenantDb, tenantId, baseModel)` returns `BudgetDecision` with `{ status, model, cannedReply? }`
- `server/conversationHandler.ts` (~line 139): **already calls `resolveBudgetDecision`** for the web chat path and passes `decision.model` as `modelOverride` to `generateAIResponse`
- `server/routes/twilioTestSms.ts` (~line 1307): calls `generateAIResponse(...)` with `modelOverride: undefined` — the budget is **never consulted for SMS**
- `generateAIResponse` returns a **string**, not an object. Do not change its return type.

**The correct fix — edit `server/routes/twilioTestSms.ts` only:**

Find the `generateAIResponse` call (~line 1307). It looks like:
```typescript
aiReply = await generateAIResponse(
  Body + languageContext,
  From,
  'sms',
  undefined,
  conversationHistory,
  false,
  tenantId,
  conversation.controlMode || 'auto',
  undefined,   // ← this is the modelOverride — currently always undefined
  conversation.id,
);
```

Replace this block with:

```typescript
// Audit T1 S-10: consult per-tenant AI token budget before calling the LLM.
// Pattern mirrors conversationHandler.ts ~line 139 which already does this for web chat.
const SMS_BASE_MODEL = process.env.SMS_AGENT_MODEL || 'gpt-4o';
let smsModelOverride: string | undefined;

try {
  const { resolveBudgetDecision, notifyOwnerBudgetExhausted } = await import('./services/aiTokenBudget');
  const budget = await resolveBudgetDecision(tenantDb, tenantId, SMS_BASE_MODEL);

  if (budget.status === 'exhausted') {
    // Budget exhausted: return canned reply, escalate, skip LLM entirely
    aiReply = budget.cannedReply || "Thanks for reaching out! We'll get back to you as soon as possible.";
    notifyOwnerBudgetExhausted(tenantId, budget.tokensUsedToday, budget.budget).catch(() => {});
    // Escalate conversation so owner sees it
    try {
      const { escalateConversation } = await import('./services/escalationService');
      await escalateConversation(tenantDb, conversation.id, 'ai_budget_exhausted');
    } catch (escErr) {
      console.warn('[SMS AI BUDGET] Escalation failed (continuing):', escErr);
    }
  } else {
    smsModelOverride = budget.status === 'downgrade' ? budget.model : undefined;
    if (budget.status === 'downgrade') {
      console.log(`[SMS AI BUDGET] Downgrading to ${budget.model} for tenant ${tenantId}`);
    }
    aiReply = await generateAIResponse(
      Body + languageContext,
      From,
      'sms',
      undefined,
      conversationHistory,
      false,
      tenantId,
      conversation.controlMode || 'auto',
      smsModelOverride,
      conversation.id,
    );
  }
} catch (budgetErr) {
  // Fail open: if budget check errors, proceed with base model
  console.warn('[SMS AI BUDGET] Budget check failed, using base model (fail-open):', budgetErr);
  aiReply = await generateAIResponse(
    Body + languageContext,
    From,
    'sms',
    undefined,
    conversationHistory,
    false,
    tenantId,
    conversation.controlMode || 'auto',
    undefined,
    conversation.id,
  );
}
```

**Do not:**
- Change `generateAIResponse` signature or return type
- Change `conversationHandler.ts` — it already works correctly
- Add imports at the top of the file — use dynamic `await import()` as shown above to avoid circular dependency issues

**Do check:** Confirm `escalateConversation` is the correct function name in `escalationService.ts` before using it. If the function has a different name, use the correct one.

---

## TASK 3 — Consolidate SMS inbound dedup into a single synchronous gate

**Files:** `server/routes/twilioTestSms.ts`, `server/services/smsInboundDedup.ts`

**What the audit found:**
The file has two separate dedup calls in different code paths. A Twilio retry arriving within ~50ms can pass both. `recordProcessedInboundSms` in `smsInboundDedup.ts` already uses `INSERT ... ON CONFLICT DO NOTHING` and returns a boolean — this is the correct primitive to use as the single gate.

**The fix:**

1. Read `smsInboundDedup.ts`. Confirm `recordProcessedInboundSms` returns `true` for a new message and `false` if already processed. If it currently does a `select`-then-`insert` pattern instead, fix it to a single atomic `INSERT ... ON CONFLICT DO NOTHING RETURNING *` — the `returning` rows length tells you if the insert won the race.

2. In `twilioTestSms.ts`, find where `messageSid` is first extracted from `req.body`. Immediately after extraction (before any business logic, conversation creation, or AI work), add:

```typescript
// DEDUP GATE: single synchronous check before any LLM or booking work.
// recordProcessedInboundSms uses INSERT ON CONFLICT DO NOTHING — atomic and race-safe.
if (messageSid) {
  const isNew = await recordProcessedInboundSms(messageSid, From, To, tenantId);
  if (!isNew) {
    console.log(`[TWILIO SMS] Duplicate MessageSid ${messageSid} — returning empty 200`);
    const dupResponse = new MessagingResponse();
    res.type('text/xml');
    return res.send(dupResponse.toString());
  }
}
```

3. Remove every other call to `isDuplicateInboundSms` and `recordProcessedInboundSms` in the file. There must be exactly **one** dedup gate and it must use `recordProcessedInboundSms` (insert-first), not `isDuplicateInboundSms` (select-first).

**Guardrail:** Do not change `smsInboundDedup.ts` schema. Do not add a new table. Only touch `twilioTestSms.ts` and the dedup service.

---

## TESTS REQUIRED

```bash
npx vitest run server/tests/smsSendGuard.test.ts
npx vitest run server/tests/tenantCommRouter.test.ts
npx vitest run server/tests/aiTokenBudgetDowngrade.test.ts
npx vitest run server/tests/smsBookingStateSourceOfTruth.test.ts
```

Do not comment out failing tests. Fix the code.

---

## COMPLETION SUMMARY REQUIRED

```
## STAGE 1 COMPLETION REPORT

### Task 1 — Tulsa hardcoding removal
Files changed:
Changes made (list every modified function/block):
Removed strings (list every hardcoded string deleted):
checkMapsHealth() test address updated: [Y/N]
Google components filter removed: [Y/N]
Tests passing: [Y/N + names]

### Task 2 — AI token budget wired to SMS path
Files changed:
Location of new budget block: [approx line in twilioTestSms.ts]
escalateConversation function name confirmed: [actual name used]
Exhausted path (canned reply + skip LLM): [Y/N]
Downgrade path (pass budget.model as modelOverride): [Y/N]
Fail-open on budget error: [Y/N]
generateAIResponse signature unchanged: [Y/N]

### Task 3 — Dedup consolidated
Files changed:
smsInboundDedup.ts insert-first pattern confirmed: [Y/N — describe]
Single gate location: [approx line]
Old redundant dedup calls removed: [list line numbers removed]

### Unresolved issues
[Anything found but not fixable in scope — record here]
```
