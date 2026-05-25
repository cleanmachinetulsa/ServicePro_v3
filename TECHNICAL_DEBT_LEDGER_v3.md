# ServicePro — Technical Debt Ledger (v3)
## Last updated: After complete Part 1 audits (1A-1E) under DAVP
## Supersedes v2
## Supersedes the original TECHNICAL_DEBT_LEDGER.md
## Upload alongside master plan and context dump at the start of every session.

---

## PRIORITY LEVELS
- 🔴 HIGH — data loss, security risk, or breaking real customers today
- 🟡 MEDIUM — breaks when second tenant goes live, or degrades experience
- 🟢 LOW — cosmetic, cleanup, or only matters at scale

## DEAD-CODE BUCKETS (new classification — see audit notes)
- **B1 — Delete now**, own commit: dead AND hazardous (loaded-gun mutators).
- **B2 — Delete with the rebuild**: outdated but still load-bearing today.
- **B3 — Leave, flag only**: harmless dead code; clean up opportunistically.

---

## ACTION REQUIRED NOW (before anything else)

| # | Item | Action |
|---|---|---|
| SEC-LOY-1 | 🔴 Unauthenticated loyalty dashboard endpoints | `routes.loyalty.ts` `/customers` `/points` etc. leak full customer list. Add `requireAuth` — Fixpack P0. |
| OPS-4 | 🔴 alertPhone may not be set | Settings → Business Profile → confirm populated. SMS bypass silent if blank. |
| DATA-1 | 🔴 Gallery photos on local disk | Do not encourage uploads until Stage 9A. |

---

## LOYALTY / REWARDS DEBT (from deep audit — the largest cluster)

### LOY-18 🔴 — Six accrual paths, two earn rates, two storage backends
Points awarded by 6 distinct code paths: `loyaltyService` (100%), `invoiceService`
(10%), `loyaltyApi` (100%, **Google Sheet**), `gamificationService`, `promoEngine`
(correct), dead `grantCampaignPoints`. Balances non-deterministic in value AND
location. **Fix:** Loyalty rebuild Stages L0–L4.

### LOY-1 🔴 — Invoice accrual arg mismatch (B2)
`addLoyaltyPointsFromInvoice` called without `tenantDb` at 2 sites. Stage L0.

### LOY-2 🔴 — Redeemed rewards never fulfilled
`redeemed_rewards` written `pending`; no booking/invoice flow consumes them. Stage L3.

### LOY-3 🔴 — Three loyalty engines + one credit ledger
`loyaltyService`, `gamificationService`, `promoEngine` + `creditLedgerService`.
`promoEngine` is canonical-quality. Consolidate in Stage L2/L4.

### LOY-13 🔴 — Referral `awardPoints` call uses wrong arg order (B2)
`referralService.ts:272` passes `customerId` where `tenantDb` expected → referral
points silently never award. Stage L0.

### LOY-14 🟡 — `gamificationService` phantom `TenantDb` import (B2)
`from "./db"` should be `"./tenantDb"`; masked by `skipLibCheck`. Stage L0.

### LOY-16 🔴 — Two parallel ledger tables
`points_transactions` vs `loyalty_transactions`. Migration — Stage L1.

### LOY-18-A / LAPI-1 🔴 — Sheets-based accrual writes points outside Postgres
`loyaltyApi.ts` + `googleLoyaltyIntegration.ts`. L1 migration must reconcile
Sheets→Postgres, then delete (B2).

### L1-3 ✅ RESOLVED — Sheets reconciliation no-op
Investigation confirmed: `Customer Database` tab in
`Complete_CleanMachine_AgentKnowledgeBase` has no loyalty columns.
The Sheets write path (`loyaltyApi.ts` + `googleLoyaltyIntegration.ts`) has
been returning 404/false on every invocation due to
`loyaltyPointsColIndex === -1`. No Sheet-based balances exist. All 2,572
loyalty balances are in Postgres, source: port_recovery, all backed by
`points_transactions` rows. No import needed.

### LAPI-6 🟡 — Sheets loyalty write path fails silently
`loyaltyApi.ts` and `googleLoyaltyIntegration.ts` return HTTP 404 / boolean
false when loyalty columns are not found in the Sheet tab, with no error
surfaced to the caller or logged to monitoring. This has masked the fact that
invoice accrual has never written a single row anywhere. The route and
integration are retired in Stage L4 (B2 dead-code deletion). Before L4: ensure
no caller expects a success response from this path.

### L1-4 🔴 — port_recovery duplicate transactions: 735 balance/ledger mismatches
`points_transactions` contains duplicate rows from multiple runs of the
port_recovery import script. Every individual transaction is 500 pts but the
script ran 2–11 times per customer without idempotency, creating 2–11 rows per
loyalty_points record while the `loyalty_points.points` balance was only
updated on the first run.
Pattern: 695 customers have 2 txns (balance=500, ledger_sum=1000); 39 have 11
txns (balance=500, ledger_sum=5500); 1 has 4 txns (balance=1500,
ledger_sum=2000). The `loyalty_points.points` column reflects the INTENDED
balance (set intentionally at first import). The extra transaction rows are
duplicates. Condition for L1 close (mismatched_rows=0) is NOT met.
Resolution options: (A) deduplicate points_transactions to 1 row per customer
per campaign run, restoring ledger integrity; (B) treat loyalty_points.points
as authoritative and accept that points_transactions is not a strict ledger.
Must resolve before L1 can close.

### LAPI-2 🔴 — `/award-loyalty-points` registered 2–3×
Live backend decided by Express mount order. Resolve in L0; questionnaire AA-Q1.

### GAM-1 ✅ RESOLVED (Stage L1-2) — Loyalty guardrails now per-tenant
`checkLoyaltyGuardrails` and `getLoyaltyGuardrailSettings` in
`server/gamificationService.ts` now read `tenant_loyalty_settings` filtered by
`tenant_id` instead of the global `business_settings` singleton. Verified for
Clean Machine (`tenant_id='root'`): $75 minimum still enforced (cart $50 →
denied with seeded message; cart $75/$100 → passes cart-total check). Legacy
`business_settings` loyalty columns (`loyaltyMinCartTotal`,
`loyaltyRequireCoreService`, `loyaltyGuardrailMessage`) are no longer read by
any server code; column drop deferred to a later cleanup stage.

### GAM-2 🔴 — `achievements` / `loyaltyTiers` globally shared (no `tenantId`)
Every tenant gets CM's auto-detailing achievements. Additive `tenantId` columns —
Stage L1 migration. (Confirm schema — questionnaire AA-Q3.)

### LOY-4 🟡 — No transaction atomicity in legacy accrual/redemption
`loyaltyService`, `gamificationService` read-modify-write. Race + drift. Stage L2.

### LOY-5 🟡 — No points reversal on refund/cancellation
Revenue leak. Stage L5.

### LOY-6 🟡 — Manual point adjustment (corrected)
Staff UI `LoyaltyPointsSystem.tsx` DOES call `/api/loyalty/add-points`. Verify the
route exists server-side (questionnaire AA — L-Q7). Stage L5.

### LOY-8 🟡 — `processExpiredPoints` never scheduled; expiry model muddled
Stage L5.

### LOY-9 🟡 — `loyalty` SMS campaign audience targets non-existent column
`customers.loyalty_points` does not exist. Also a 1E item.

### LOY-17 🟡 — `promoEngine` anti-abuse rules code-only, not per-tenant
`promoRules.ts`. Fine now, limits multi-tenant. Stage L2+.

### GAM-3 🟡 — `getCustomerLoyaltyPoints` not tenant-scoped
Most-called engine function. Stage L2.

### GAM-4 ✅ RESOLVED (Stage L1-2) — Loyalty guardrail check now fail-closed
`checkLoyaltyGuardrails` previously returned `{ok:true}` on caught exceptions
and on missing settings, silently allowing redemptions on a financial control.
Now returns `{ok:false}` in both cases with distinct codes:
`GUARDRAIL_CHECK_FAILED` (caught error) and `LOYALTY_NOT_CONFIGURED` (no
`tenant_loyalty_settings` row). `LoyaltyGuardrailResult.code` union and
`LoyaltyGuardrailError` extended additively. Verified: unknown tenant returns
`{ok:false, code:'LOYALTY_NOT_CONFIGURED'}`.

### GAM-6 🟢 (NEW, Stage L1-2) — `/api/loyalty/guardrails` `|| 'root'` fallback
`server/routes.loyalty.ts:290` resolves tenant via
`(req.session as any)?.tenantId || 'root'`. Low severity: exposes only loyalty
configuration metadata (min cart total, message, core-service flag), no
customer data. Clean up during multi-tenancy hardening (replace with strict
tenant middleware + 401 on missing context).

### L3-FACADE-1 🟢 (NEW, Stage L1-2) — `/api/loyalty/guardrails` field-name contract mismatch
Server returns `{minCartTotal, requireCoreService, guardrailMessage}`
(`server/gamificationService.ts:getLoyaltyGuardrailSettings`). Client
`rewards.tsx:124–130` defines `GuardrailSettings` with
`minCartTotalEnabled`, `requireCoreServiceEnabled`, `coreServiceCategories`,
`loyaltyGuardrailMessage`. Render guard at `rewards.tsx:749` is always falsy
because `guardrails.minCartTotalEnabled` and
`guardrails.requireCoreServiceEnabled` are `undefined`. The guardrail-config
banner card never renders for any tenant. Pre-existing, not caused by L1-2.
Fix during Stage L3 facade rebuild: reconcile field-name contract on the
server side. ~1hr.

### RLOY-3 🟡 — `/api/loyalty/redeem` IDOR
No auth; `customerId` from body — redeem anyone's points. Fixpack with SEC-LOY-1.

### WBC-1 🟡 — Dead non-transactional `grantCampaignPoints` (B1 — DELETE NOW)
Welcome-back service; live path uses `promoEngine`. Loaded gun.

### WBC-2 🟡 — Two idempotency systems on different tables
Dead `hasReceivedCampaign` (points_transactions) vs live `awardPromoPoints`
(loyalty_transactions). Resolved by deleting WBC-1.

### LOY-19 🟡 — `creditLedgerService` is a 4th value system
Monetary credit. Keep separate (money ≠ points) but share the transactional
pattern. Note in rebuild.

### LOY-20 🟡 — Verify `/api/loyalty/add-points` staff route exists
Corrects original LOY-6. Questionnaire.

### LOY-21 🟡 — Customer portal reads `loyalty_transactions` directly
Bypasses service layer. Repoint in Stage L4.

### LAPI-4 🟢 — Tier thresholds disagree across 3 engines
gamification (Gold 2500) vs loyaltyApi/googleLoyalty (Gold 2000). Unify in L2.

### LAPI-5 / GLOY-1 🟢 — Sheets accrual non-atomic
Dies with the Sheets path (B2).

### RLOY-4 🟢 — `REWARDS_TOKEN_SECRET` hardcoded fallback
`|| 'rewards-fallback-secret'`. Make a hard fail. Questionnaire AA-Q4.

### GAM-5 🟢 — `awardCampaignPointsOnce` idempotency is advisory
Check-then-insert, no constraint. Add unique constraint in L1/L2.

### LOY-10 🟢 — Reward-eligibility email no dedup guard
### LOY-11 🟢 — N+1 queries in loyalty dashboard reads
### LOY-12 🟢 — Duplicate `award-loyalty-points` route; hardcoded branding in `rewards.tsx`
### LOY-15 🟢 — Dead `gamificationService` code (B1 — DELETE NOW)
`redeemPoints` + 4 `awardPointsFor*` helpers — zero callers, loaded guns.
### LOY-22 🟢 — Referral subsystem under-audited
6 routes, config table, multi-type rewards. Needs dedicated audit pass.

---

## ANTI-ABUSE / WEBCHAT DEBT (from deep audit)

### SEC-LOY-1 🔴 — Unauthenticated loyalty dashboard endpoints
(See ACTION REQUIRED.) `routes.loyalty.ts` — 8 endpoints, no `requireAuth`.

### SEC-LOY-2 🔴 — `|| 'root'` tenant fallback on 14 loyalty endpoints
Unauthenticated → Clean Machine data. Cross-tenant read primitive. Fixpack.

### PR-1 🟡 — `findCustomerByPhone` not tenant-scoped
Port-recovery cross-tenant point/customer binding. Fix in port-recovery hardening.

### PR-2 🟡 — `findCustomerByName` fuzzy fallback compounds PR-1

### WCAP-1 🟡 — WebChat captcha verified-session state in-memory
Lost on restart; invisible across instances. Move to DB/Redis at scale.

### WSSE-1 🟡 — WebChat SSE client registry in-process
Breaks multi-instance. Honestly documented in-file. Scale-stage item.

### WCLN-1 🟡 — WebChat cleanup is cross-tenant; hard-deletes customers
`webChatCustomerCleanup.ts` uses raw `db`, no tenant filter, despite header
claiming "tenant-aware." Hard-deletes stub customers across all tenants per run.

### OTP-1 🟡 — OTP code from `Math.random()` not `crypto.randomInt`
`customerOtpService.ts:64`. Predictable PRNG for a security code.

### OTP-2 🟡 — Session validate/revoke not tenant-aware
`validateSession`/`revokeSession` take only a token.

### DEDUP-1 🟡 — `smsInboundDedup` comment references banned `db:push`
Stale comment contradicts platform migration rules. Comment fix.

### DEDUP-2 🟡 — `recordProcessedInboundSms` defaults `tenantId='root'`
Same `|| 'root'` pattern. Cosmetic today.

### DEMO-1 🟢 — `demoProtection.ts` is entirely inert (`DEMO_MODE=false`)
Non-functional security feature. If revived, in-memory limiter + `Math.random()`
tokens. Decide: rebuild honestly or delete (B1/B3).

### DEMO-2 🟢 — `applyCodeProtection` is fake security (B1 — DELETE)
Comment admits it "simulates the concept." Delete — false confidence.

### WCAP-2 🟢 — Captcha provider `fetch` has no timeout
### WCLN-2 🟢 — WebChat cleanup header text contradicts query logic (doc nit)
### WCLN-3 🟢 — WebChat cleanup Pass 2 hard-deletes `customers` (env-gated, dry-run default)
### OTP-3 🟢 — Email OTP + magic-link are stubs (= FEAT-13)
### UPLOAD-1 🟢 — `uploadQuotaService` in-memory → 5×N uploads on multi-instance
Deliberate, documented choice. Note for scale only — NOT a defect.

### Positive findings (no action — recorded as the quality bar)
- `webChatCookie.ts` — exemplary: fail-closed, no hardcoded secret, `timingSafeEqual`.
- `customerOtpService.ts` — real rate limiting, correctly tenant-scoped.
- `promoEngine.ts` — transactional, idempotent, anti-abuse — the rebuild model.
- `uploadQuotaService.getAnonymousSessionKey` — server-trusted key, ignores client.

---

## SECURITY (original items retained)

### SEC-1 🟡 — No role gate on `PUT /api/business-settings` — Stage 6A
### SEC-2 🟡 — No role gate on `PUT /api/admin/telephony-settings` — Stage 6A
### SEC-3 🟢 — Stale push subscriptions not pruned on 410 — Stage 11
### SEC-4 🟡 — Rate limiting missing on public endpoints — Stage 11

---

## MULTI-TENANCY & ISOLATION (original items retained)

### MT-1 🟡 — validateAddress root fallback (2 call sites)
### MT-8 🟡 — Clean Machine still root tenant — Stage 10
### MT-9 🟡 — `updateAppointmentAddress` hardcodes "26 minutes of Tulsa"
### MT-10 🟡 — `business_settings` global single-row table — Stage 10
### MT-11 🟡 — 40+ server files hardcode "Clean Machine" — Stage 1C-a Part 2
### MT-12 🟢 — Showcase.tsx hardcodes "Clean Machine Showcase"
### MT-2..7 ✅ — resolved

---

## TECHNICIAN VIEW DEBT (from Audit 1B)

### TECH-1 🔴 — Quick Photo posts to wrong endpoint (always 400s)
### TECH-2 🔴 — Demo mode auto-activates on live technician page (fake data)
### TECH-3 🟡 — Client/server/brief job-status models disagree
### TECH-4 🟡 — No `en_route` customer SMS (extends FEAT-1)
### TECH-5 🟡 — NavigationPod ETA/distance hardcoded fake values
### TECH-6 🟡 — Hardcoded CM office number / SMS fallback / "Technician" name
### TECH-7 🟡 — `/jobs/today` coupled to Google Calendar as job source
### TECH-8..11 🟢 — canned replies; JobCompletionDialog un-audited; auto-save race; offline queue retry

---

## COMMS HUB / DATA / CODE QUALITY / INTEGRATIONS / OPERATIONAL
(Original items retained unchanged: COMMS-4..6, DATA-1..3, TS-1..4, FEAT-1..14,
INT-1..5, OPS-1..7. See prior ledger; no changes from this audit except FEAT-13
now cross-linked to OTP-3.)

---

## SUMMARY

| Priority | Count | Change |
|---|---|---|
| 🔴 HIGH | 17 | +13 (loyalty/anti-abuse audit) |
| 🟡 MEDIUM | ~48 | +22 |
| 🟢 LOW | ~28 | +18 |
| ✅ Resolved | 9 | — |

**Biggest single risk:** SEC-LOY-1 (unauthenticated customer-list endpoint) — treat
as immediate Fixpack P0.
**Biggest structural problem:** LOY-18 — six accrual paths / two backends — addressed
by the loyalty rebuild (Stages L0–L5).

---

---

## WEATHER DEBT (Audit 1C)

### WX-1 🔴 — Daily weather check never scheduled; `weatherScheduler.ts` is an orphan
Nothing imports or invokes it. The automated weather feature does not run.
**Fix in:** Stage W.

### WX-2 🔴 — `checkAndAlertForUpcomingAppointments` uses hardcoded fake appointments
"John Smith"/"Jane Doe" test data baked in; zero callers. **Fix in:** Stage W.

### WX-4 🔴 — `sendWeatherAlertNotification` has two mismatched signatures
Scheduler call vs `notifications.ts` definition disagree. Part of the FIX-2 sweep.

### WX-3 🟡 — "Weather-aware rescheduling" never moves the appointment
Only sends an SMS with a link. Feature name overpromises. **Fix in:** Stage W (C2).

### WX-5 🟡 — No weather/reschedule table — no persistence/idempotency/audit
### WX-6 🟡 — Coordinate resolution inconsistent; 2 paths hardcode Tulsa
### WX-7 🟡 — `weatherScheduler` hardcoded to `root` tenant + one calendar
### WX-8 🟡 — Two parallel risk engines (legacy vs Phase 13)
### WX-9 🟡 — The two risk engines use inconsistent thresholds
### WX-10 🟢 — Dead code after return in risk-text helpers
### WX-11 🟢 — `weatherScheduler` `process.exit` would kill server if imported as-is

---

## AUTOMATED SEND-PATH DEBT (Audit 1D)

### SEND-1 🔴 — Proactive reminder system disabled (cron body commented out)
`reminderService.ts` — registers a cron that does nothing; seeding early-returns.
**Fix in:** Stage S (gated on D3).

### SEND-2 🔴 — 3-day & 1-day reminder `sendSMS` calls missing `tenantDb` — throw
`recurringServicesScheduler.ts:283,297`. Part of the FIX-2 sweep.

### SEND-3 🔴 — `sendBookingConfirmation` called with 1 arg — throws
`calendarApi.ts:861`. Booking confirmations do not send. Part of the FIX-2 sweep.

### SEND-5 🟡 — All automated jobs gated behind `PLATFORM_BG_JOBS_ENABLED`
If unset in prod, no automated send runs. **Confirm:** FIX-9 / questionnaire D1.

### SEND-6 🟡 — ETA `sendOnTheWayNotification` call signature unverified
Also disconnected from the technician "En Route" button (TECH-4).

### SEND-7 🟡 — Automated send templates fall back to hardcoded Clean Machine branding
### SEND-8 🟡 — "Morning-of" reminder path does not exist
### SEND-9 🟡 — Post-service follow-up + review-request automated sends not found
### SEND-10 🟡 — Two overlapping reminder systems (recurring 3d/1d vs monitor 7d/48h)
### SEND-11 🟢 — `reminderService.fetchWeather` hardcodes Tulsa coords (4th weather impl)
### SEND-12 🟢 — Recurring deposit/escalation crons hardcoded to `root` tenant

---

## BLAST CAMPAIGN DEBT (Audit 1E)

### CAMP-1 🔴 — SMS campaign counter broken (REVISED per ChatGPT questionnaire)
TWO bugs: (a) `incrementSmsCounterAtomic` queries `WHERE counter_date` but the
schema column is `date` → the UPDATE throws. (b) the row is never seeded. **Fix:**
FIX-3 — correct the column name + self-seeding upsert. Verify live DB column first.

### CAMP-2 🔴 — SMS campaign queries unscoped (raw `tenantDb.execute`) — cross-tenant blast
**Fix:** FIX-4. Must ship before tenant #2.

### CAMP-3 🟡 — Scheduled SMS campaigns hardcoded to `root` tenant
### CAMP-4 🟡 — "Send Now" flushes only 50/run → multi-hour drip, looks broken
### CAMP-5 🟡 — STOP between campaign-populate and send not honored
### CAMP-6 🟡 — Campaign `fromNumber` ignored; hardcoded `phoneLineId:1`
### CAMP-7 🟡 — `loyalty` audience query targets non-existent column (= LOY-9)
### CAMP-8 🟢 — Dead shadow-schema string-maps in `smsCampaignService.ts`
### CAMP-9 🟢 — `daily_send_counters` global (no tenant_id) — platform-wide caps

### CAMP-10 🔴 — `sms_suppression_list` table does not exist (live DB confirmed)
`smsCampaignService.ts:402,713,726` query a non-existent table — second guaranteed
runtime error in the campaign path. FIX-3/FIX-4 must create it.

**Positive:** `emailCampaignService.ts` is the reference implementation — correct
counter seeding, tenant scoping, suppression, atomic increments. SMS should mirror it.

---

## TECHNICIAN DEBT — ADDITIONS FROM 1B RE-AUDIT

### TECH-12 🔴 — Technician identity ambiguous (`users.id` vs `technicians.id` vs `-1`)
Job-ownership guards may fail open. **Gated on:** questionnaire B1.

### TPROF-2 🔴 — Mass-assignment self-approval in `POST /api/tech/profile`
**Fix:** FIX-7.

### TPROF-1 🔴 — Inconsistent/missing auth middleware on profile endpoints
### TECH-19 🟡 — Quick Photo broken; MediaPod is the correct pattern (FIX-5)
### MEDIA-1 🟡 — MediaPod photo category never sent to server
### TECH-24 🟡 — Two divergent job-completion UIs
### TECH-20 🟡 — No loyalty-redemption touchpoint in completion flow
### TPROF-3 🟡 — Tech profile photos on ephemeral local disk
### TPROF-4 🟡 — `orgSettings` global table, owner-writable cross-tenant
### JOBAPP-1 🟡 — Public `/api/jobs/apply` unprotected (no rate-limit/captcha)
### SHIFT-1 🟡 — `/api/admin/applications` registered twice
### TECH-16 🟡 — Owner-override `allowAllJobs` unenforced in job filter
### TECH-13/14/15 🟡🟢 — Deposit identity FK; non-atomic mark-deposited; float money
### TECH-21/22/23, MEDIA-2/3, SHIFT-2, PAY-1 🟢 — completion/media/shift hygiene

**Positive:** the technician core (jobs, deposits, shift/PTO) is well-built;
shift/PTO `claim-shift` is correctly race-safe — a reference pattern.

---

## UPDATED SUMMARY (after complete Part 1)

| Priority | Approx count |
|---|---|
| 🔴 HIGH | ~28 |
| 🟡 MEDIUM | ~70 |
| 🟢 LOW | ~40 |

**Top Fixpack priorities:** FIX-1 (loyalty auth), FIX-2 (tenantDb-signature sweep
— unblocks booking confirmations, reminders, referral points), FIX-3 (campaign
counter — unsticks all blasts).

**Cross-cutting classes (see master plan v4):** tenantDb-signature mismatch;
`|| 'root'` fallback; schema-level global tables; older-shadow-code; float money.

---
*Technical Debt Ledger v3. Supersedes v2. Complete through Part 1 audits (1A-1E).*



---

## PARTS 3-8 DEBT (audits + designs)

### Part 3 — Onboarding Wizard
- **ONB-1 🔴** — Wizard sets self-attested boolean flags; configures nothing
- **ONB-6 🔴** — Onboarding API routes have no auth middleware
- **ONB-2/3/4/5/7/8 🟡** — no catalog/payment/booking-test steps; no <10min design;
  OnboardingIndustry & SetupWizard disconnected; industry select doesn't provision;
  raw `db` not `tenantDb`; six competing onboarding surfaces
- **ONB-9 🟢** — SetupCopilot/AdminConciergeSetup substantial but orphaned

### Part 4 — Data Parser (ServicePro-side)
- **PAR-1 🔴** — Parser core is an external Replit service — needs its own audit (done: see moat doc); CM-branded default URL; no fallback
- **PAR-2/3/4/5/6 🟡🟢** — parser routes no auth; 500MB memory buffering; three apply paths; tone-append stacks; "connect phone" is really file upload

### Moat / Parser repo / Industry Packs (= Part 2)
- **PARSE-1 🔴** — Parser has no AI — regex/keyword, single-industry hardcoded
- **PARSE-2..6 🟡🟢** — extract endpoint unauthenticated; in-memory rate limit; fragile sender classification; Streamlit dup; format parsers good (keep)
- **PACK-1 🟡** — Two parallel industry-pack systems (static config vs DB tables)
- **MOAT-1..6 / PACK-2/3 design** — build businessIntelligenceService, customerGraphService (NO L1 dependency — Replit-verified), siteBlueprintService; confidence/evidence model; researched packs; manual escape hatch

### Part 5 — Employee Lifecycle
- **TECH-12 🔴** — (also Part 1B) employee identity split `users` vs `technicians`
- **TPROF-2 🔴** — mass-assignment self-approval (PROVEN — live verified)
- **TPROF-1 🔴** — inconsistent/missing auth on profile endpoints
- **EMP-1..6 / JOBAPP-1 🟡** — no employee-facing portal; non-tech staff have none;
  CM-hardcoded provisioning (tenant #2 blocker); 1,340-line monolith; public job-apply unprotected
- **EMP-7 🟢** — (positive) provisioning pipeline well-built

### Part 6 — Customer Portal
- **CP-1 🔴** — Portal loyalty balance always 0 (reads non-existent `loyalty_transactions.points`)
- **CP-2..7 🟡🟢** — profile pics on ephemeral disk; `||'root'` fallback; `/appointments` leaks raw rows; no magic-link; no vehicle garage; truncated-query balance

### Part 7 — App Store / Marketplace
- **APP-1 🔴** — Three competing add-on tables — consolidate
- **APP-2..5 🟡** — catalog code-defined not DB; `wrapTenantDb('root')`; hardcoded flag map; toggle-list not marketplace
- **APP-6 🟢** — (positive) activation lifecycle + auth + Stripe linkage sound
- **MKT-1..4 design** — build /app-store experience; content-driven catalog; industry-relevant surfacing; third-party extensibility (Phase 2+ decision)

### Part 8 — Tier & Pricing
- **TIER-1 🟡** — (was 🔴; corrected) `planLimits.ts` has stale $29/$79 in an
  unused `baseMonthlyPrice` field. Public page + Stripe billing both = $39/$89 and
  AGREE. Not a live conflict — just delete the dead field.
- **TIER-2 🔴** — AI request limits unusably low (Pro = 25/mo)
- **TIER-3/4/5 🟡** — usage caps unenforced (cost leak); 3+ billing concepts; hidden tiers in one source
- **TIER-6 🟢** — (positive) billing enforcement/dunning/suspension well-built
- **PRICE-1..5 design** — canonical DB-backed tiers; AI metering redesign; hybrid enforcement; unified billing; pricing-positioning decision (room to raise Pro to $99-129)

---

## UPDATED SUMMARY (complete — Part 1 + Parts 3-8)

| Priority | Approx count |
|---|---|
| 🔴 HIGH | ~40 |
| 🟡 MEDIUM | ~95 |
| 🟢 LOW | ~50 |

Counting note: several 🔴 are cross-cutting (TECH-12 appears in 1B + Part 5;
the tenantDb-signature class spans 1A/1C/1D). De-duplicated, the distinct
🔴 count is ~33.


---

## GROUND-TRUTH NOTES (live DB via Replit — severity corrections)

- **LOY-18 / 10% earn rate:** reclassified 🔴→🟡. The `amount*0.1` path
  (`dashboardApi.ts:1051`) is DISPLAY-ONLY in the invoice SMS preview; it never
  writes the DB. Customer-trust bug, not balance corruption.
- **`loyalty_transactions` is empty (0 rows ever).** The two-ledger problem is one
  used ledger + one empty one — L1 migration is simpler than stated.
- **TPROF-2:** proven (not just "likely") — `routes.techProfiles.ts:246,268` spread
  raw `req.body`; `insertTechnicianSchema` imported but unused. Privileged-user
  mass assignment (route is `requireRole('manager','owner')`).
- **Invoice accrual:** 0 rows ever written to Postgres — invoice loyalty has never
  worked; Sheets is the current balance source of truth.
- **Production `PLATFORM_BG_JOBS_ENABLED`:** still UNKNOWN — dev is OFF; the
  deployment secrets pane must be checked.

---

## DEAD-CODE DELETION QUEUE (B1 — delete now, own commit, after final grep)
- `gamificationService.redeemPoints` + `awardPointsForAppointment/Review/Anniversary` (LOY-15)
- `tenantWelcomeBackCampaignService.grantCampaignPoints` + `hasReceivedCampaign` (WBC-1/2)
- `demoProtection.applyCodeProtection` (DEMO-2)

## HOW TO KEEP THIS CURRENT
After every session: add new items, mark resolved ✅, update counts, re-bucket
dead code. Upload alongside master plan at every new Claude session.
