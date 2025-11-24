1️⃣ PHASE_14_PROMO_ENGINE.md
# PHASE 14 – Unified Loyalty & Promo Engine (Anti-Abuse) – IMPLEMENTATION PLAYBOOK

## 0. Purpose

Build a **single, unified promo/loyalty engine** for ServicePro v3 that:

- Awards points **only** through a central function.
- Enforces **anti-abuse rules**:
  - Per-customer caps
  - Per-household caps (via address/householdId)
  - Per-time-period caps (e.g. per year)
  - Pending bonuses that only activate when a job completes
- Works for **all promos**, not just the Welcome Back campaign.
- Is **multi-tenant** and respects `tenantId`.

This will be used first by the **Welcome Back** campaign but must be generic:
- Future promos: referral bonuses, review bonuses, seasonal promos, etc.

---

## 1. Pre-Reqs / Assumptions

- Master plan: `MASTER_PLAN_v3.3.md` present at repo root.
- Tenant isolation is in place (`req.tenantDb` + `withTenantFilter`).
- There is an existing loyalty system with:
  - A way to store point balances and/or transaction history.
  - Existing code used by invoices/campaigns.

If something doesn’t exist exactly as assumed, **adapt** but keep the same architecture:
- Central `awardPromoPoints()` function
- Per-tenant, per-customer rules
- All promo-related awards go through that function.

---

## 2. Data Model Changes

### 2.1 Loyalty Tables (If Not Already Present)

**File:** `shared/schema.ts`

1. Ensure there is a table for **loyalty balances**, scoped by tenant:

```ts
export const loyaltyBalances = pgTable('loyalty_balances', {
  tenantId: varchar('tenant_id').notNull(),
  customerId: varchar('customer_id').notNull(),
  points: integer('points').notNull().default(0),
  updatedAt: timestamp('updated_at').defaultNow(),

  // Composite primary key ensures multi-tenant safety
  // and one balance row per {tenant, customer}.
}, (table) => ({
  pk: primaryKey({ columns: [table.tenantId, table.customerId] }),
}));


Add / confirm a loyalty transactions table:

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  tenantId: varchar('tenant_id').notNull(),
  customerId: varchar('customer_id').notNull(),
  deltaPoints: integer('delta_points').notNull(), // positive = earn, negative = redeem
  promoKey: varchar('promo_key'),                 // e.g. 'welcome_back_v1', 'referral_v1'
  source: varchar('source').notNull(),            // 'campaign', 'manual', 'invoice', etc.
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
});


Optionally add a households table and householdId to customers (if not already done in Phase 16; at minimum, plan for it):

export const households = pgTable('households', {
  id: serial('id').primaryKey(),
  tenantId: varchar('tenant_id').notNull(),
  normalizedAddress: text('normalized_address').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const customers = pgTable('customers', {
  // existing fields...
  householdId: integer('household_id').references(() => households.id),
  importSource: varchar('import_source'), // 'sheet', 'sms_history', 'portal', etc.
  // ...
});


NOTE: If Phase 16 handles households, you can just ensure householdId exists now; full population can come later.

3. Core Service: promoEngine.ts

File: server/services/promoEngine.ts (new)

3.1 Public API

Define a central function:

export interface AwardPromoPointsArgs {
  tenantId: string;
  customerId: string;
  promoKey: string;          // 'welcome_back_v1', 'referral_v1', etc.
  basePoints: number;        // "headline" points
  source: string;            // 'campaign', 'manual', 'invoice', etc.
  metadata?: Record<string, any>;
}

export interface AwardPromoPointsResult {
  awarded: boolean;
  pointsGranted: number;
  reason?: string;           // 'already_awarded', 'household_limit', 'not_eligible', etc.
}

export async function awardPromoPoints(
  db: TenantDb,              // req.tenantDb or equivalent
  args: AwardPromoPointsArgs,
): Promise<AwardPromoPointsResult>;


All promo-related point awards must eventually go through this function.

3.2 PROMO_RULES Config

In the same file or in server/config/promoRules.ts:

export const PROMO_RULES = {
  welcome_back_v1: {
    perCustomerLifetimeMax: 1,
    perHouseholdPerYearMax: 1,
    requireExistingJob: true,
    awardMode: 'pending_until_next_completed_job', // 'immediate' or 'pending_until_next_completed_job'
    basePointsVip: 500,
    basePointsRegular: 100,
  },
  referral_v1: {
    perCustomerPerYearMax: 5,
    awardMode: 'immediate',
  },
  // add more promo keys later
} as const;


The engine reads these rules to decide:

If the customer is eligible.

Whether points should be immediate or pending.

How to log the award.

3.3 Anti-Abuse Logic

Inside awardPromoPoints:

Load promo rules based on promoKey.
If there is no rule, assume a conservative default or reject.

Check per-customer caps:

Query loyaltyTransactions for this {tenantId, customerId, promoKey}:

Count how many times they’ve already received this promo.

If perCustomerLifetimeMax or perCustomerPerYearMax would be exceeded:

Return { awarded: false, pointsGranted: 0, reason: 'already_awarded' }.

Check per-household caps (if householdId present and a rule exists):

Look up householdId for this customer.

Query loyaltyTransactions for any customers with same householdId + promoKey in the last year.

If over limit:

Return { awarded: false, pointsGranted: 0, reason: 'household_limit' }.

Check eligibility (e.g. require existing job for Welcome Back):

If requireExistingJob: true:

Query appointments for this customer:

Completed jobs before promoLaunchDate or before this award.

If none:

Return { awarded: false, pointsGranted: 0, reason: 'not_existing_customer' }.

Apply award mode:

If awardMode === 'pending_until_next_completed_job':

Don’t immediately bump loyaltyBalances.points.

Instead:

Create a loyaltyTransactions record with:

deltaPoints = 0

metadata.pendingBonusPoints = basePoints

metadata.promoKey = promoKey

metadata.status = 'pending'

It’s then the job of the job completion flow to convert pending points into real ones.

Return something like { awarded: true, pointsGranted: 0, reason: 'pending' }.

If awardMode === 'immediate':

Wrap in a transaction:

Insert a loyaltyTransactions row with deltaPoints = basePoints.

Upsert loyaltyBalances and increment points by basePoints.

Return { awarded: true, pointsGranted: basePoints }.

Multi-tenant safety:

Always use tenantDb.withTenantFilter on loyaltyBalances, loyaltyTransactions, customers, appointments.

All queries must be scoped by tenantId.

4. Hook into Existing Flows
4.1 Welcome Back Campaign

Find the service that sends the Welcome Back SMS/email and grants points, for example:

server/services/welcomeBackCampaignService.ts

Or similar.

Replace any direct “add points” logic with calls to awardPromoPoints:

await awardPromoPoints(req.tenantDb, {
  tenantId: req.tenant.id,
  customerId,
  promoKey: 'welcome_back_v1',
  basePoints: isVip ? PROMO_RULES.welcome_back_v1.basePointsVip : PROMO_RULES.welcome_back_v1.basePointsRegular,
  source: 'campaign',
  metadata: {
    campaignKey: isVip ? 'welcome_back_v1_vip' : 'welcome_back_v1_regular',
    channel: 'sms',
  },
});


Also ensure you still log the campaign send (in campaign_sends or equivalent) so the AI can be “campaign aware” via campaignContextService.

4.2 Future Promos

For future Phase(s):

Referral promo: promoKey = 'referral_v1'

Review promo: promoKey = 'review_bonus_v1'

Seasonal promo, etc.

They should all call awardPromoPoints instead of writing loyalty directly.

5. Pending Bonus → Real Points (Job Completion Hook)

For promos that use pending_until_next_completed_job:

Extend your job completion logic (e.g. server/services/appointmentsService.ts) to:

Check if the customer has any pending promo transactions for that promoKey:

Use loyaltyTransactions with metadata.status = 'pending' for this customer.

If yes:

In a transaction:

Update that transaction metadata to mark it as status = 'fulfilled'.

Insert a new loyaltyTransactions row with deltaPoints = pendingBonusPoints.

Increment loyaltyBalances.points by pendingBonusPoints.

Consider marking a flag on customer:

e.g. hasReceivedWelcomeBackBonus = true, if you want to quickly check in the future.

6. Tests & QA
6.1 Unit Tests

File: server/tests/promoEngine.test.ts (new)

Test cases:

Award Welcome Back to a customer with no prior awards:

awarded === true, pointsGranted as expected, transaction logged.

Try to award Welcome Back again:

awarded === false, reason === 'already_awarded'.

Household limit:

Two customers with same householdId.

Only one can receive the big bonus.

Pending bonus:

awardMode = 'pending_until_next_completed_job':

Initially, no points added to balance.

After job completion hook, points appear.

6.2 Manual QA Plan

In dev:

Create a test tenant.

Seed one test customer with past jobs (existing customer).

Run Welcome Back campaign for them:

Confirm:

Transaction recorded.

Balance updated or pending logged.

Try rerunning:

Confirm no second award.

Verify logs:

No cross-tenant access in SQL (check queries, ensure tenantId present).

Confirm integration with campaignContextService still works:

Campaigns still log campaign_sends (or equivalent) for AI awareness.

7. Rollout Notes

This engine is initially for root tenant (Clean Machine) + ServicePro v3.

Make sure new code:

Does not alter behavior for tenants that don’t run any campaigns.

Does not break non-promo loyalty features.

Future phases will:

Add more promo keys.

Add admin UI for configuring PROMO_RULES per tenant or per tier.