# ServicePro — Deferred Items Parking Lot (live repo copy)

This is the live, repo-versioned copy of the parking lot. The full historical
version (DEF-1 through DEF-38, as of the loyalty rebuild close 2026-05-25) lives
in docs/ServicePro_Loyalty_Rebuild_Kit.zip → DEFERRED_ITEMS_PARKING_LOT.md.
That kit copy is the reference for DEF-1 through DEF-12 and DEF-15 through DEF-38.

This file tracks status changes and new items added after the loyalty rebuild
closed. It is the document to update as CM-sprint stages complete.

---

## Status key
- PARKED — captured, not yet designed or built
- DESIGN-PENDING — ready for a dedicated design session
- IN A TRACK — folded into an existing master-plan track
- PARTIAL — partially complete; see completion note for what remains
- RESOLVED — fully addressed; logged for the record

---

## DEF-13 — Engine consolidation: repoint all loyalty writers to loyaltyLedger
Status: PARTIAL — CM-1 (gamification/port-recovery slice) COMPLETE 2026-05-30.
Full consolidation (3 writers → 1) continues in a dedicated stage after the
Clean Machine rescue sprint (CM-1 through CM-7).

Original entry: kit DEFERRED_ITEMS_PARKING_LOT.md § DEF-13. Audit map embedded
there — no repo re-discovery needed when picking this up.

### CM-1 COMPLETION (2026-05-30)

The gamificationService.awardPoints / awardCampaignPointsOnce call path from
the port-recovery campaign award is now retired. grantPortRecoveryPoints() in
server/services/portRecoveryService.ts was rewritten to route through the
canonical loyaltyLedger.earn() instead of the legacy non-transactional writer.

The fix addresses two distinct defects at once:

(1) THE CRASH / SILENT NON-AWARD (DEF-33, Dec 2025 blast root cause).
awardPoints had a non-atomic check-then-insert against a UNIQUE(tenant_id,
customer_id) constraint — concurrent or retry awards for a new customer hit
the unique violation; pre-hotfix this caused a TypeError reading .points on
undefined; post-hotfix a null-guard converted it to a silent { success:false }.
Either way, promised bonus points never landed. earn() fixes this with a single
db.transaction() doing get-or-create + atomic SQL increment (points = points +
amount) — no race, no silent failure.

(2) THE DUPLICATION BUG (L1-4, Dec 2025 blast root cause #2).
awardCampaignPointsOnce keyed idempotency on source + sourceId(campaignId).
When port_recovery ran 18× under regenerating campaign IDs, each run got a new
key, the dedup missed, and customers were re-awarded every run — requiring the
L1-4 reconciliation to collapse 6,323 wreckage rows. The new idempotency key is
port_recovery_apology:${customerId} — stable, per-customer, campaign-ID-agnostic.
The apology award lands exactly once per customer, ever, regardless of how many
times the campaign is rebuilt under a new ID.

Functional test: scripts/testCM1PortRecoveryPoints.ts (3 assertions: first award,
re-run under different campaign ID, invalid amount). Typecheck: change is
type-neutral vs. pre-existing TYPECHK-1 baseline (proven by stash-and-diff).

### Remaining for full DEF-13 consolidation

WRITER 2 — gamificationService.awardPoints callers still on the legacy path:
  - referralService.ts:272 — repoint to loyaltyLedger.earn()/adjust().
  - routes.adminBackfill.ts:404 — repoint to loyaltyLedger.earn()/adjust().
  After repointing: awardPoints + awardCampaignPointsOnce can be deleted.
  KEEP (do NOT touch): checkLoyaltyGuardrails, getLoyaltyGuardrailSettings,
  getCustomerLoyaltyTier, checkForNewAchievements, getCustomerLoyaltyPoints,
  getPortRecoveryTransactionsByCampaignIds.

WRITER 3 — promoEngine.ts (DO NOT DELETE):
  Owns the anti-abuse rule layer (PROMO_RULES: lifetime/annual/household caps,
  pending-until-next-job mode, 90-day stale cleanup, eligibility gate).
  Should delegate the actual point WRITE to loyaltyLedger.earn()/adjust() instead
  of writing loyalty_points/points_transactions/loyalty_transactions directly.
  Refactor, not deletion. After: promoEngine = rules; ledger = the only writer.

WRITER 4 — smsCampaignService.ts (UNCONFIRMED):
  FIRST ACTION of this stage: read smsCampaignService.ts and determine if it
  is a 4th writer. If so, repoint it too.

END STATE: loyaltyLedger is the SOLE writer of loyalty_points / points_transactions
/ loyalty_transactions / redeemed_rewards. Engine count genuinely 3 → 1.

---

## DEF-33 — Welcome-back blast (Dec 2025) ran on 3 broken subsystems
Status: PARTIAL — CM-1 (points-award fix) COMPLETE 2026-05-30.
Remaining blockers before a second blast: CM-2 (send-tracking table), CM-3
(number validation + suppression). See CLEAN_MACHINE_RESCUE_SPRINT.md.

### CM-1 COMPLETION (2026-05-30)

The points-award failure (broken subsystem #1) is fixed. See DEF-13 CM-1 note
above for detail. The blast can now deliver on the "bonus points" promise it makes.

Remaining DEF-33 prerequisites before sending:
  (b) CM-2 — port_recovery_sms_sends table must be created (additive migration)
      and the send pipeline wired to write/check it. Without this, dedup and
      send-status tracking continue to fail.
  (c) CM-3 — number validation (non-E.164 / fake / to==from guard) and
      suppression-list check (the 73 STOP'd numbers from the Twilio audit import)
      must run before every send.

---

## DEF-14 — Points expiry (L5-C)
Status: DECIDED — policy now confirmed (per DEF-24 in kit). Rolling per-transaction
expiry, 12 months. expiryDate columns already exist in loyalty_points and
points_transactions; no expiry cron runs. Build: a PLATFORM_BG_JOBS_ENABLED-gated
scheduled job calling loyaltyLedger.adjust() for each expired earn row, idempotent
key expiry:customer:${customerId}:${yyyyMMdd}. Not in the CM rescue sprint — own
stage after Clean Machine operational excellence. See kit DEF-14 for full shape.

---

## Items added after loyalty rebuild close (DEF-23 through DEF-38)

Full detail in kit DEFERRED_ITEMS_PARKING_LOT.md. Status as of 2026-05-30:

DEF-23 — Abuse / cost-control defense: PARKED. 6-layer design in kit DEF-23
expansion. Own "Abuse & Cost Control" stage in v5, after CM sprint.

DEF-24 — v5 planning decisions: DECIDED — fold into master plan v5 (not yet
written). Key decisions locked: earn rate $1=1pt, expiry 12-month rolling,
creditLedger separate, referral gets own audit stage (A12), app-store catalog
scrapped for v1, pricing pass deferred.

DEF-25 — Pro email + custom domain provisioning: PARKED — v2, not v1.

DEF-26 — Login fix + auth audit: PARTIALLY RESOLVED. Login root cause fixed
(routes.aiActions.ts mounted at /api, gating all requests including /api/auth/login).
Auth audit sweep (DEF-9 + this) still pending as own session.

DEF-27 — Owner-confirmed features: CAPTURED — fold into v5 master plan.

DEF-28 — Analytics / visitor-data: CAPTURED — own v5 stage (Layer 1 behavioral
analytics, Layer 2 retargeting pixels; Layer 3 de-anonymization deferred post-launch).

DEF-29 — Dev/partner architecture talking points: REFERENCE.

DEF-30 — Library/provider-first build standard: STANDARD — every v5 prompt
must reference this.

DEF-31 — Re-engagement after STOP: DESIGN DECIDED — fold into v5 (Clean Machine
ops + multi-tenant hardening stages).

DEF-32 — Clean Machine welcome-back campaign + copy/pricing restructure:
SCOPED — for the Clean Machine rescue sprint (CM-7).

DEF-33 — Dec 2025 blast ran on 3 broken subsystems: PARTIAL (see above).

DEF-34 — Technician Hub (field cockpit): VISION CAPTURED — design + build as
real v5 stage. Mockup-first, then build.

DEF-35 — Settings / navigation IA overhaul: DESIGN NEEDED.

DEF-36 — Full feature inventory confirmed: REFERENCE.

DEF-37 — Role-based app architecture: DESIGN NEEDED — core v5 decision.

DEF-38 — Dashboard / landing page rethink: DESIGN NEEDED — role-aware home.

---

## How to use this file
- Review at the start of each new build session for items now in scope.
- Append new deferred items as they surface.
- When an item moves into active work, mark it PARTIAL or RESOLVED and add a
  completion note with the date and session reference.
- Full historical context for each item: kit DEFERRED_ITEMS_PARKING_LOT.md.
