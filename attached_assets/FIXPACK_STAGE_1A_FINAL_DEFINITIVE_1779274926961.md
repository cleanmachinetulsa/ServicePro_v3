# SERVICEPRO — FIXPACK STAGE 1A (DEFINITIVE — DO NOT REVISE AGAIN)
## P0 Production Safety — 4 Verified Gaps
## Namespace: FIXPACK (not Comms Hub)
### Paste GUARDRAILS_PRE_PROMPT_FINAL.md first, then this entire file.

---

## CONTEXT

Four confirmed P0 gaps, verified against the actual repo. Everything in the "already done" list was confirmed in source — do not rebuild it.

**Already done — do not touch:**
- `customer_threads` schema + `customerThreadService.ts` + SMS linkage
- iMessage tapback full-match regex in `twilioTestSms.ts`
- "Needs you" tab in `NightOpsConversationList.tsx`
- Web chat SSE — hub + route + `EventSource` in `EnhancedChatbotUI.tsx`
- DEMO_MODE boot guard and PLATFORM_BG_JOBS warning in `server/index.ts`
- Facebook `x-hub-signature-256` in `server/routes.facebook.ts`
- `server/services/aiTokenBudget.ts` — fully built
- `conversationHandler.ts` web chat budget path (~line 139) — already correct
- Dedup gate at `twilioTestSms.ts` ~line 244 — already exists and correct

---

## CLEAN MACHINE IS RULE #1

Clean Machine (tenant: `root`) is live. Before any change ask: could this break Clean Machine?

- **Task 1:** Their Tulsa lat/lng lives in `business_settings`, read by `getServiceAreaConfig(tenantDb)` — untouched. Removing Tulsa strings removes a global bias that isn't needed. Health check becomes env-configurable — CM sets `MAPS_HEALTH_CHECK_ADDRESS=Tulsa, OK` and nothing changes for them.
- **Task 2:** Budget check fails-open. If `resolveBudgetDecision` errors, falls through to normal LLM call. CM unaffected.
- **Task 3:** Uniqueness constraint is global on `messageSid`. The existing `'root'` gate is safe. Only the second redundant check is removed. No behavior change.
- **Task 4:** After fix, CM's `validateAddress` uses their own `business_settings` — same Tulsa coordinates, correct code path.

---

## VERIFICATION LOCK — COMPLETE THIS BEFORE WRITING ANY CODE

Run these searches first. Do not rely on prompt line numbers or memory. The repo is the source of truth.

```bash
# Confirm twilioTestSms.ts location
find server -name "twilioTestSms.ts"

# Confirm escalation exports and EscalationContext shape
rg -n "export.*escalateSmsToHuman|interface EscalationContext|type EscalationReason|customReasonLabel" server/services/escalationService.ts

# Count validate_address cases in openai.ts — patch ALL active ones
rg -n "case [\"']validate_address[\"']" server/openai.ts

# Confirm executeFunctionCall signature
rg -n "function executeFunctionCall|tenantId\?:" server/openai.ts | head -5

# Confirm wrapTenantDb pattern
rg -n "export.*wrapTenantDb|wrapTenantDb(" server/tenantDb.ts | head -5

# Confirm validateAddress current signature
rg -n "export.*function validateAddress|async function validateAddress" server/schedulingTools.ts

# Confirm all validateAddress call sites
rg -n "validateAddress\(" server/schedulingTools.ts server/openai.ts server/conversationalScheduling.ts

# Confirm dedup pattern
rg -n "recordProcessedInboundSms|isDuplicateInboundSms" server/routes/twilioTestSms.ts server/services/smsInboundDedup.ts

# Confirm budget service exports
rg -n "export.*resolveBudgetDecision|export.*notifyOwnerBudgetExhausted" server/services/aiTokenBudget.ts

# Confirm SMS model constant
rg -n "^export const SMS_AGENT_MODEL|^const SMS_AGENT_MODEL" server/openai.ts

# Confirm recordAiUsage call for SMS path
rg -n "recordAiUsage" server/openai.ts

# Inspect businessSettings columns
rg -n "businessSettings = pgTable|city|state|serviceCity|serviceState|businessAddress" shared/schema.ts | grep -A2 "businessSettings = pgTable"

# Confirm handleConversationalScheduling signature
rg -n "export.*function handleConversationalScheduling|async function handleConversationalScheduling" server/conversationalScheduling.ts
```

Also read these spans:
```bash
sed -n '1,15p' server/routes/twilioTestSms.ts          # confirm imports
sed -n '238,258p' server/routes/twilioTestSms.ts        # confirm existing dedup gate
sed -n '1430,1445p' server/routes/twilioTestSms.ts      # confirm redundant dedup call
sed -n '1295,1320p' server/routes/twilioTestSms.ts      # confirm generateAIResponse call
sed -n '640,685p' server/openai.ts                      # confirm executeFunctionCall + validate_address
sed -n '985,1040p' server/openai.ts                     # confirm SMS model usage + recordAiUsage
sed -n '1,15p' server/schedulingTools.ts                # confirm current imports
sed -n '155,175p' server/schedulingTools.ts             # confirm validateAddress + checkDistance call
sed -n '105,115p' server/conversationalScheduling.ts    # confirm validateAddress call site
sed -n '60,100p' server/googleMapsApi.ts                # confirm preprocessAddress function start
sed -n '140,190p' server/googleMapsApi.ts               # confirm geocodeAddress + components filter
sed -n '1,20p' server/services/smsInboundDedup.ts       # confirm insert pattern
```

**Before writing code, confirm all of the following from actual repo text:**

1. `twilioTestSms.ts` is under `server/routes/` → all dynamic imports must be `../services/`
2. `escalateSmsToHuman` is the exact export name
3. `EscalationContext` field names match what you're about to pass
4. `EscalationReason` does not include `ai_budget_exhausted` → use `'unknown'` + `customReasonLabel`
5. `generateAIResponse` returns `string`, already accepts `modelOverride?: string`
6. `executeFunctionCall` receives `tenantId?: string`
7. `handleConversationalScheduling` does NOT receive `tenantId` → conversationalScheduling.ts is deferred
8. Exact number of `case "validate_address"` entries in `openai.ts` → patch every active one
9. `wrapTenantDb(db, tenantId)` is the correct wrapper pattern
10. `schedulingTools.ts` has no `TenantDb` import → must add it

**If anything contradicts this prompt: stop that subtask, report the exact conflict and file evidence, apply the safest minimal fix or defer it. Do not guess or invent replacements.**

---

## SEARCH BLOCK — FILES TO READ IN FULL BEFORE WRITING

```
server/googleMapsApi.ts
shared/schema.ts               (businessSettings table only)
server/schedulingTools.ts
server/services/aiTokenBudget.ts
server/openai.ts
server/routes/twilioTestSms.ts
server/services/smsInboundDedup.ts
server/conversationHandler.ts  (budget pattern to mirror)
server/services/escalationService.ts
server/conversationalScheduling.ts
server/tenantDb.ts             (wrapTenantDb export)
```

---

## TASK 1 — Remove all Tulsa hardcoding from address preprocessing

**File:** `server/googleMapsApi.ts`

Confirmed strings to remove:
- `/tulsa/i` city regex
- `/\b(ok|oklahoma)\b/i` state regex
- `/\b74\d{3}\b/` zip regex
- `` `${address}, Tulsa, OK` `` primary append
- `` `${address}, OK` `` secondary append (in `else if (hasCity && !hasState)` branch)
- `components: 'locality:Tulsa|administrative_area:OK|country:US'` geocode param
- `'Tulsa, OK'` in the Maps health check function

**Step 1 — Add `escapeRegExp` helper (before any function that uses it):**
```typescript
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
```

**Step 2 — Change `preprocessAddress` signature:**
```typescript
function preprocessAddress(
  address: string,
  tenantCity?: string,
  tenantState?: string,
  tenantZipPrefix?: string,
): string
```

**Step 3 — Replace every hardcoded detection:**
```typescript
const cityPattern = tenantCity
  ? new RegExp(`\\b${escapeRegExp(tenantCity)}\\b`, 'i')
  : null;
const hasCity = cityPattern ? cityPattern.test(address) : false;

const statePattern = tenantState
  ? new RegExp(`\\b${escapeRegExp(tenantState)}\\b`, 'i')
  : null;
const hasState = statePattern ? statePattern.test(address) : false;

const hasZip = tenantZipPrefix
  ? new RegExp(`\\b${escapeRegExp(tenantZipPrefix)}\\d+\\b`).test(address)
  : false;
```

**Step 4 — Replace both append branches:**
```typescript
// Primary — no city, no state, no zip:
if (tenantCity && tenantState) {
  address = `${address}, ${tenantCity}, ${tenantState}`;
}
// If no tenant config: leave as-is — Google geocodes without bias

// Secondary — has city, missing state:
} else if (hasCity && !hasState && tenantState) {
  address = `${address}, ${tenantState}`;
}
```

**Step 5 — Delete the Google geocode `components` filter line entirely:**
```
components: 'locality:Tulsa|administrative_area:OK|country:US'
```
Delete it. Do not replace with anything.

**Step 6 — Add `getTenantAddressContext` helper (same file):**

First inspect `shared/schema.ts` for actual `businessSettings` columns. Use columns that exist. Do not add columns.

```typescript
async function getTenantAddressContext(tenantDb: TenantDb): Promise<{
  city?: string;
  state?: string;
  zipPrefix?: string;
}> {
  try {
    const rows = await tenantDb.select().from(businessSettings).limit(1);
    const row = rows[0];
    if (!row) return {};

    // Use direct columns if they exist in schema:
    const directCity = (row as any).city || (row as any).serviceCity;
    const directState = (row as any).state || (row as any).serviceState;
    if (directCity && directState) {
      return { city: directCity.trim(), state: directState.trim() };
    }

    // Parse from businessAddress text field as fallback:
    const addr: string = (row as any).businessAddress || (row as any).address || '';
    if (!addr) return {};

    const match = addr.match(/,\s*([^,]+),\s*([A-Z]{2})\b/);
    const zipMatch = addr.match(/\b(\d{3})\d{2}\b/);
    if (match) {
      return {
        city: match[1].trim(),
        state: match[2].trim(),
        zipPrefix: zipMatch?.[1],
      };
    }
    return {};
  } catch (err) {
    console.warn('[MAPS] getTenantAddressContext fail-open:', err);
    return {};
  }
}
```

**Step 7 — Update every caller of `preprocessAddress` in `googleMapsApi.ts`:**
```typescript
const addrCtx = await getTenantAddressContext(tenantDb);
const processed = preprocessAddress(rawAddress, addrCtx.city, addrCtx.state, addrCtx.zipPrefix);
```

**Step 8 — Update the Maps health check function:**
Find the function (likely named `checkMapsHealth` — confirm with repo search). Change:
```typescript
const testAddress = 'Tulsa, OK';
```
to:
```typescript
const testAddress = process.env.MAPS_HEALTH_CHECK_ADDRESS || 'United States';
```

---

## TASK 2 — Wire AI token budget to the SMS inbound path

**Confirmed facts:**
- `twilioTestSms.ts` is in `server/routes/` → dynamic imports use `../services/`
- `generateAIResponse` returns `string`, already has `modelOverride?: string` — do not change signature or return type
- `SMS_AGENT_MODEL` is the exported constant from `openai.ts`
- SMS OpenAI call (~line 994) uses `SMS_AGENT_MODEL` directly, ignoring `modelOverride`
- `recordAiUsage` SMS call (~line 1032) logs `SMS_AGENT_MODEL` not effective model
- `escalateSmsToHuman` is the correct export from `escalationService.ts`
- `EscalationReason` does not include `ai_budget_exhausted` → use `reason: 'unknown'` + `customReasonLabel`

**Part A — `server/routes/twilioTestSms.ts`**

Find the `generateAIResponse` call (~line 1307). Replace it:

```typescript
// FIXPACK-1A: per-tenant AI token budget guard before LLM call.
// Mirrors conversationHandler.ts web chat path. Fails open on error.
const SMS_BASE_MODEL = process.env.SMS_AGENT_MODEL || 'gpt-4o';

try {
  const { resolveBudgetDecision, notifyOwnerBudgetExhausted } =
    await import('../services/aiTokenBudget');
  const budget = await resolveBudgetDecision(tenantDb, tenantId, SMS_BASE_MODEL);

  if (budget.status === 'exhausted') {
    aiReply =
      budget.cannedReply ||
      "Thanks for reaching out! We'll get back to you as soon as possible.";

    notifyOwnerBudgetExhausted(tenantId, budget.tokensUsedToday, budget.budget)
      .catch(() => {});

    try {
      const { escalateSmsToHuman } = await import('../services/escalationService');
      await escalateSmsToHuman({
        tenantId,
        reason: 'unknown',
        customReasonLabel: 'ai_budget_exhausted',
        fromPhone: From,
        toPhone: To,
        conversationId: conversation.id,
        messageSid: MessageSid,
        additionalInfo: `AI budget exhausted: ${budget.tokensUsedToday}/${budget.budget} tokens used today.`,
      });
    } catch (escErr) {
      console.warn('[SMS BUDGET] Escalation failed (continuing):', escErr);
    }

  } else {
    const smsModelOverride = budget.status === 'downgrade' ? budget.model : undefined;
    if (budget.status === 'downgrade') {
      console.log(`[SMS BUDGET] Downgrading to ${budget.model} for tenant ${tenantId}`);
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
  console.warn('[SMS BUDGET] Budget check failed, using base model (fail-open):', budgetErr);
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

Do not add top-of-file imports. Use dynamic `await import('../services/...')` as shown.

**Part B — `server/openai.ts` (two targeted lines only)**

Find the SMS `chat.completions.create` call (~line 994). Add `smsEffectiveModel` just before it:

```typescript
const smsEffectiveModel = modelOverride || SMS_AGENT_MODEL;
completion = await openai!.chat.completions.create({
  model: smsEffectiveModel,   // was SMS_AGENT_MODEL
  // ... rest unchanged
});
```

Find the `recordAiUsage` SMS call (~line 1032):
```typescript
// Before:
await recordAiUsage(tenantId, 'ai_sms', inputTokens, outputTokens, SMS_AGENT_MODEL, conversationId);
// After:
await recordAiUsage(tenantId, 'ai_sms', inputTokens, outputTokens, smsEffectiveModel, conversationId);
```

Nothing else in `openai.ts` changes.

---

## TASK 3 — Consolidate SMS inbound dedup to one gate

**Confirmed:** `sms_inbound_dedup` has a global unique index on `messageSid` alone. The gate at ~line 244 using `recordProcessedInboundSms(messageSid, From, To, 'root')` is correct and stays.

1. Confirm `smsInboundDedup.ts` uses `INSERT ... ON CONFLICT DO NOTHING RETURNING *`, returns `true` for new, `false` for conflict. If it uses select-then-insert, fix it to the atomic pattern.

2. In `twilioTestSms.ts`:
   - Gate at ~line 244: **leave it exactly as-is**
   - Find `isDuplicateInboundSms` at ~line 1435: **remove this call** and its surrounding conditional
   - Remove `isDuplicateInboundSms` from the import at line ~11
   - Keep `recordProcessedInboundSms` import

Result: one dedup gate, top of handler, insert-first, atomic.

---

## TASK 4 — Fix `validateAddress` to use tenant service area

**Confirmed:**
- `schedulingTools.ts` has NO `TenantDb` import — must add it
- `validateAddress` currently passes only `address` to `checkDistanceToBusinessLocation` (no tenantDb) — falls back to Clean Machine's coordinates for every tenant
- `executeFunctionCall` in `openai.ts` receives `tenantId?: string` — can construct tenantDb
- `handleConversationalScheduling` in `conversationalScheduling.ts` receives NO `tenantId` — **deferred, do not change its signature**

**Primary file: `server/schedulingTools.ts`**

**Step 1 — Add TenantDb type import at top:**
```typescript
import type { TenantDb } from './tenantDb';
```
Check that this import does not already exist before adding it.

**Step 2 — Add `tenantDb` optional parameter to `validateAddress`:**
```typescript
export async function validateAddress(
  phone: string,
  address: string | undefined | null,
  tenantDb?: TenantDb,               // new optional parameter
): Promise<AddressValidationResult>
```

**Step 3 — Pass `tenantDb` to `checkDistanceToBusinessLocation`:**
```typescript
// Before:
const result = await checkDistanceToBusinessLocation(address);

// After:
const result = tenantDb
  ? await checkDistanceToBusinessLocation(tenantDb, address)
  : await checkDistanceToBusinessLocation(address); // legacy fallback
```

**Step 4 — Update all `validateAddress` call sites in `schedulingTools.ts`:**
Run `rg -n "validateAddress(" server/schedulingTools.ts` to find every call site. Pass `tenantDb` where it is in scope.

**Step 5 — Update every active `case "validate_address"` in `server/openai.ts`:**

First run:
```bash
rg -n "case [\"']validate_address[\"']" server/openai.ts
```

For every active case that calls `validateAddress`, apply this pattern. `executeFunctionCall` receives `tenantId?: string` — use it:

```typescript
case "validate_address": {
  let tenantDbForValidation: TenantDb | undefined;
  if (tenantId) {
    const { db } = await import('./db');
    const { wrapTenantDb } = await import('./tenantDb');
    tenantDbForValidation = wrapTenantDb(db, tenantId);
  }
  const result = await validateAddress(args.phone, args.address, tenantDbForValidation);
  return JSON.stringify(result);
}
```

Confirm `wrapTenantDb(db, tenantId)` matches the actual export from `server/tenantDb.ts` before using it. If the repo pattern differs, follow the repo and report the difference.

Report the exact number of `validate_address` cases found and how many were patched.

**Step 6 — `server/conversationalScheduling.ts` (~line 110): DEFERRED**

`handleConversationalScheduling` receives no `tenantId`. Threading it requires a signature change — out of scope for this fixpack. Record this as deferred in the completion report.

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

## COMPLETION REPORT REQUIRED

```
## FIXPACK 1A COMPLETION REPORT

### Verification Ledger
twilioTestSms.ts actual path: [server/routes/twilioTestSms.ts confirmed Y/N]
Service import prefix confirmed as: [../services/]
escalateSmsToHuman export confirmed: [Y/N]
EscalationContext fields used: [list exactly]
EscalationReason for budget exhaustion: [unknown]
customReasonLabel exists: [Y/N]
validate_address cases found in openai.ts: [number]
validate_address cases patched: [number]
executeFunctionCall tenantId?: string confirmed: [Y/N]
wrapTenantDb pattern confirmed from tenantDb.ts: [Y/N — exact call used]
TenantDb import path in schedulingTools.ts: [exact string]
No new DB wrapper layer created: [Y/N]
No guessed paths/names used: [Y/N]

### Task 1 — Tulsa hardcoding removal
Files changed:
escapeRegExp added: [Y/N]
businessSettings columns found: [list actual column names from schema]
getTenantAddressContext reads from: [columns / businessAddress parse]
Fail-open confirmed: [Y/N]
Strings removed:
  tulsa regex: [Y/N]
  ok/oklahoma regex: [Y/N]
  74 zip prefix: [Y/N]
  Tulsa, OK primary append: [Y/N]
  , OK secondary append → tenantState: [Y/N]
  Google components filter: [Y/N]
  Health check → MAPS_HEALTH_CHECK_ADDRESS env var: [Y/N]
No new schema columns: [Y/N]

### Task 2 — AI token budget wired
Files changed:
Budget block location in twilioTestSms.ts: [approx line]
Import paths use ../services/: [Y/N — CRITICAL]
escalateSmsToHuman called with correct shape: [Y/N]
reason: 'unknown' + customReasonLabel: 'ai_budget_exhausted': [Y/N]
Exhausted path skips LLM: [Y/N]
Downgrade path passes smsModelOverride: [Y/N]
Fail-open on budget error: [Y/N]
generateAIResponse signature unchanged: [Y/N]
generateAIResponse return type unchanged: [Y/N]
openai.ts smsEffectiveModel added: [Y/N — line]
openai.ts recordAiUsage logs smsEffectiveModel: [Y/N — line]

### Task 3 — Dedup consolidated
smsInboundDedup.ts: insert-on-conflict atomic pattern: [Y/N]
Gate at ~line 244 preserved unchanged: [Y/N]
isDuplicateInboundSms import removed: [Y/N]
isDuplicateInboundSms call removed: [Y/N]
recordProcessedInboundSms calls remaining in file: [must be 1]

### Task 4 — validateAddress tenantDb threading
TenantDb import added to schedulingTools.ts: [Y/N]
validateAddress signature updated: [Y/N]
checkDistanceToBusinessLocation receives tenantDb when available: [Y/N]
schedulingTools.ts internal call sites updated: [list line numbers]
openai.ts validate_address case(s) updated: [Y/N — how many]
conversationalScheduling.ts: [DEFERRED — tenantId not in scope]

### Tests
smsSendGuard: [pass/fail]
tenantCommRouter: [pass/fail]
aiTokenBudgetDowngrade: [pass/fail]
smsBookingStateSourceOfTruth: [pass/fail]

### Unresolved issues
[List anything found but not fixable in scope]
```
