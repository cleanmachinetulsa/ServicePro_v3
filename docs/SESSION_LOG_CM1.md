# ServicePro — Clean Machine Rescue Sprint
## Stage CM-1 — Fix the points-award bug — CLOSED (2026-05-30)

Durable record of CM-1. Part of CLEAN_MACHINE_RESCUE_SPRINT.md (first sprint of
master plan v5). Handoff to CM-2.

---

## Why CM-1 existed

The Dec 2025 welcome-back blast (DEF-33) silently failed to award bonus points to
a large chunk of ~2,300 recipients. The campaign's emotional core — "we've credited
bonus loyalty points to your account" — promised something that never arrived.
Production logs showed repeated `points_attempted=true points_ok=false` and
"Error awarding points: TypeError: Cannot read properties of undefined (reading
'points')" at gamificationService.ts, in the call chain:
  runPortRecoveryBatch
  → grantPortRecoveryPoints
  → awardCampaignPointsOnce
  → awardPoints (gamificationService.ts)

A hotfix commit (058ecd8, 2025-12-13) added null-guards that converted the hard
crash to a silent `{ success: false }` return — which silenced the stacktrace but
did not fix the underlying problem. The award still failed for affected customers;
the failure just stopped being visible as a TypeError.

## Root cause (three layers)

1. NON-ATOMIC CHECK-THEN-INSERT. loyalty_points has UNIQUE(tenant_id, customer_id).
   The get-or-create path was: SELECT (no row) → INSERT (separate statement). Two
   concurrent awards for the same new customer — or a retry — both see !customerPoints,
   both INSERT, the second hits the unique violation. Pre-hotfix: the thrown error
   propagated up and customerPoints remained undefined, causing `.points` to throw.
   Post-hotfix: the catch returns { success: false }. Either way, points not awarded.

2. READ-MODIFY-WRITE, NOT TRANSACTIONAL (LOY-4 class). newPointsTotal was computed
   as `customerPoints.points + amount` then written in a separate UPDATE — no
   transaction wrapping the read + write. Concurrent awards race and lose updates.
   This is the same structural defect the loyalty rebuild (L2) fixed for the invoice
   and redemption paths.

3. NON-STABLE IDEMPOTENCY KEY (the L1-4 duplication bug). awardCampaignPointsOnce
   keyed idempotency on source + sourceId(campaignId). When port_recovery ran 18×
   under regenerating campaign IDs, each run created a new idempotency key, the
   dedup check missed, and the same customers were re-awarded on every run. The
   L1-4 reconciliation (loyalty rebuild) had to collapse 6,323 wreckage rows back
   to 1 canonical row per customer. This fix ensures it can never happen again for
   this award type.

## What CM-1 built

ONE file changed: server/services/portRecoveryService.ts

- Removed import of { awardPoints, awardCampaignPointsOnce } from gamificationService.
- Added import of { earn } from ./loyaltyLedger (the canonical transactional engine).
- Rewrote grantPortRecoveryPoints() to delegate to loyaltyLedger.earn() instead of
  the legacy non-transactional path.
- earn() provides: db.transaction() wrapping get-or-create + atomic SQL increment
  (points = points + amount — no read-modify-write race) + idempotency check on
  loyalty_transactions.promoKey + canonical loyalty_transactions row + mirror
  points_transactions row + achievement check. Never throws.
- Idempotency key: port_recovery_apology:${customerId} — STABLE, PER-CUSTOMER,
  campaign-ID-agnostic. The apology award lands exactly once per customer, ever,
  regardless of how many times the campaign is rebuilt under a new ID.
- Return contract unchanged ({ success, currentPoints, wasSkipped }) so the three
  batch call sites (portRecoveryService.ts:1239, 1377, 1824) are untouched.
- Function exported (was private) for the functional test.

ONE new file: scripts/testCM1PortRecoveryPoints.ts (functional test, not committed
to the compiled app — in scripts/ which is excluded from tsconfig).

## Typecheck

Full-project `tsc --noEmit` (Node 24, npm install on fresh clone):
- 1,091 pre-existing errors (documented TYPECHK-1 baseline — project does not
  cleanly compile; errors concentrated in client-side components).
- portRecoveryService.ts: identical (error-code, column) set with vs. without my
  change — proven by stash-and-diff. 8 pre-existing errors, 0 introduced by CM-1.
  None in the edited function region.
- scripts/testCM1PortRecoveryPoints.ts: type-clean (verified by temporarily
  adding scripts/ to tsconfig include).

## Functional test

scripts/testCM1PortRecoveryPoints.ts — 3 cases:
1. First award → success:true, wasSkipped:false, balance=500, exactly 1
   loyalty_transactions row (promoKey='port_recovery_apology:${id}',
   status='fulfilled', source='port_recovery'), exactly 1 points_transactions
   mirror row.
2. Re-run under a DIFFERENT campaign ID → success:true, wasSkipped:true, balance
   still 500, still 1 ledger row (the L1-4 duplication-proof case).
3. Invalid points (0) → no throw, success:false, balance unchanged.
Run: npx tsx scripts/testCM1PortRecoveryPoints.ts (requires DATABASE_URL).
Test not yet executed against production DB — pending owner authorization.

## DEF-13 status after CM-1

DEF-13 (engine consolidation — 3 writers → 1) is PARTIALLY COMPLETE.
DONE (this stage): gamificationService.awardPoints/awardCampaignPointsOnce no
longer called from the port-recovery award path.
REMAINING:
- smsCampaignService.ts — WRITER 4, not yet read in detail; may award directly.
  First action of next DEF-13 stage: read and determine.
- gamificationService.awardPoints callers: referralService.ts:272 and
  routes.adminBackfill.ts:404 — both still call the legacy writer.
- promoEngine.ts — WRITER 3, keeps its rule layer but should delegate the actual
  point WRITE to loyaltyLedger.earn()/adjust(). Refactor, not deletion.
After all of the above, loyaltyLedger is the SOLE writer of loyalty tables.

## Not done in CM-1 (deliberately deferred)

- awardCampaignPointsOnce / awardPoints remain in gamificationService.ts. Now
  have zero callers from port-recovery, but still called by referralService.ts
  and routes.adminBackfill.ts. Deletion belongs to full DEF-13, not CM-1.
- CM-2 through CM-7 not started.

## Carried into CM-2

CM-2: Build the campaign send-tracking table (port_recovery_sms_sends) +
dedup. Logs from Dec 2025 blast: "relation 'port_recovery_sms_sends' does not
exist" — the table that records who was texted is missing, so dedup and
send-status tracking fail. Additive migration + wiring the send pipeline to
write and check the table. See CLEAN_MACHINE_RESCUE_SPRINT.md CM-2 for scope.
