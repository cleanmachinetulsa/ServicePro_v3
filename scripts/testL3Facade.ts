/**
 * Stage L3 Part 2 — functional test of the loyalty facade delegation.
 *
 * Proves the rebuilt facade routes correctly through loyaltyLedger.earn(),
 * .reserve(), and .adjust(), and that the LOY-1 / LOY-20 / L3-FACADE-1 fixes
 * behave correctly end-to-end.
 *
 * Runs against the REAL production DATABASE_URL using TWO synthetic throwaway
 * customers and ONE synthetic throwaway reward_services row. Every read,
 * write, and delete is scoped to tenantId='root' AND those synthetic ids;
 * the script NEVER touches any real customer or real reward.
 *
 * Run: npx tsx scripts/testL3Facade.ts
 */

import express from 'express';
import request from 'supertest';
import { and, eq, inArray } from 'drizzle-orm';
import { db, pool } from '../server/db';
import { wrapTenantDb } from '../server/tenantDb';
import {
  customers,
  loyaltyPoints,
  loyaltyTransactions,
  pointsTransactions,
  customerAchievements,
  redeemedRewards,
  rewardServices,
} from '@shared/schema';
import {
  addLoyaltyPointsFromInvoice,
  redeemPointsForReward,
} from '../server/loyaltyService';
import { adjust as ledgerAdjust } from '../server/services/loyaltyLedger';
import { getLoyaltyGuardrailSettings } from '../server/gamificationService';
import { registerLoyaltyRoutes } from '../server/routes.loyalty';

const TENANT_ID = 'root';
const SYNTH_NAME_A = '__LEDGER_TEST_L3FACADE__';
const SYNTH_PHONE_A = '+10000000003';
const SYNTH_NAME_B = '__LEDGER_TEST_L3FACADE_OPTOUT__';
const SYNTH_PHONE_B = '+10000000004';
const SYNTH_REWARD_NAME = '__LEDGER_TEST_L3FACADE_REWARD_300__';
const SYNTH_REWARD_COST = 300;
const INVOICE_ID = 88001;
const STAFF_ACTOR_ID = 999_999_001;

let passCount = 0;
let failCount = 0;

function assert(cond: boolean, label: string, detail?: unknown) {
  if (cond) {
    passCount++;
    console.log(`  PASS — ${label}`);
  } else {
    failCount++;
    console.log(
      `  FAIL — ${label}`,
      detail !== undefined ? `\n         got: ${JSON.stringify(detail)}` : '',
    );
  }
}

async function balance(customerId: number): Promise<number> {
  const [row] = await db
    .select({ p: loyaltyPoints.points })
    .from(loyaltyPoints)
    .where(and(eq(loyaltyPoints.tenantId, TENANT_ID), eq(loyaltyPoints.customerId, customerId)));
  return row?.p ?? 0;
}

async function getLpId(customerId: number): Promise<number | null> {
  const [row] = await db
    .select({ id: loyaltyPoints.id })
    .from(loyaltyPoints)
    .where(and(eq(loyaltyPoints.tenantId, TENANT_ID), eq(loyaltyPoints.customerId, customerId)));
  return row?.id ?? null;
}

async function countLt(customerId: number, source?: string, status?: string): Promise<number> {
  const conds = [
    eq(loyaltyTransactions.tenantId, TENANT_ID),
    eq(loyaltyTransactions.customerId, customerId),
  ];
  if (source) conds.push(eq(loyaltyTransactions.source, source));
  if (status) conds.push(eq(loyaltyTransactions.status, status));
  return (
    await db.select({ id: loyaltyTransactions.id }).from(loyaltyTransactions).where(and(...conds))
  ).length;
}

async function countPt(lpId: number): Promise<number> {
  return (
    await db
      .select({ id: pointsTransactions.id })
      .from(pointsTransactions)
      .where(
        and(eq(pointsTransactions.tenantId, TENANT_ID), eq(pointsTransactions.loyaltyPointsId, lpId)),
      )
  ).length;
}

async function countRr(customerId: number): Promise<number> {
  return (
    await db
      .select({ id: redeemedRewards.id })
      .from(redeemedRewards)
      .where(and(eq(redeemedRewards.tenantId, TENANT_ID), eq(redeemedRewards.customerId, customerId)))
  ).length;
}

async function main() {
  console.log('=== L3 Part 2 Facade — facade delegation end-to-end ===');
  console.log(`tenantId=${TENANT_ID}`);
  console.log(`synthetic A: name=${SYNTH_NAME_A} phone=${SYNTH_PHONE_A}`);
  console.log(`synthetic B: name=${SYNTH_NAME_B} phone=${SYNTH_PHONE_B}`);
  console.log(`synthetic reward: name=${SYNTH_REWARD_NAME} pointCost=${SYNTH_REWARD_COST}`);

  let custIdA: number | null = null;
  let custIdB: number | null = null;
  let synthRewardId: number | null = null;
  let cleanupResidue = false;

  const tenantDb = wrapTenantDb(db, TENANT_ID);

  try {
    // --- SETUP -------------------------------------------------------------
    console.log('\n[setup] Creating synthetic customer A (opted IN)...');
    const [insertedA] = await db
      .insert(customers)
      .values({
        tenantId: TENANT_ID,
        name: SYNTH_NAME_A,
        phone: SYNTH_PHONE_A,
        loyaltyProgramOptIn: true,
        loyaltyProgramJoinDate: new Date(),
      })
      .returning();
    if (!insertedA) throw new Error('Failed to create synthetic customer A');
    custIdA = insertedA.id;
    console.log(`  created customer A id=${custIdA}`);

    console.log('[setup] Creating synthetic customer B (opted OUT)...');
    const [insertedB] = await db
      .insert(customers)
      .values({
        tenantId: TENANT_ID,
        name: SYNTH_NAME_B,
        phone: SYNTH_PHONE_B,
        loyaltyProgramOptIn: false,
      })
      .returning();
    if (!insertedB) throw new Error('Failed to create synthetic customer B');
    custIdB = insertedB.id;
    console.log(`  created customer B id=${custIdB}`);

    console.log('[setup] Creating synthetic reward_services row...');
    const [insertedReward] = await db
      .insert(rewardServices)
      .values({
        tenantId: TENANT_ID,
        name: SYNTH_REWARD_NAME,
        description: 'L3 facade test synthetic reward (auto-deleted)',
        pointCost: SYNTH_REWARD_COST,
        tier: 'tier_500',
        active: true,
      })
      .returning();
    if (!insertedReward) throw new Error('Failed to create synthetic reward');
    synthRewardId = insertedReward.id;
    console.log(`  created reward id=${synthRewardId}`);

    // =====================================================================
    // TEST 1 — addLoyaltyPointsFromInvoice delegates to earn()
    // =====================================================================
    console.log('\n[test 1] addLoyaltyPointsFromInvoice → earn(): first call');
    const r1a = await addLoyaltyPointsFromInvoice(tenantDb, custIdA, INVOICE_ID, 500);
    const bal1 = await balance(custIdA);
    const lpIdA = await getLpId(custIdA);
    const ltCount1 = await countLt(custIdA, 'invoice', 'fulfilled');
    const ptCount1 = lpIdA !== null ? await countPt(lpIdA) : 0;
    console.log(`  balance=${bal1}, lt(invoice/fulfilled)=${ltCount1}, pt=${ptCount1}`);
    assert(r1a !== null, 'returns non-null loyaltyPoints row');
    assert(bal1 === 500, `balance == 500 (got ${bal1})`);
    assert(ltCount1 === 1, `exactly 1 loyalty_transactions row (got ${ltCount1})`);
    assert(ptCount1 === 1, `exactly 1 points_transactions mirror (got ${ptCount1})`);

    // Verify promoKey shape
    const [lt1] = await db
      .select()
      .from(loyaltyTransactions)
      .where(
        and(
          eq(loyaltyTransactions.tenantId, TENANT_ID),
          eq(loyaltyTransactions.customerId, custIdA),
          eq(loyaltyTransactions.source, 'invoice'),
        ),
      );
    const expectedKey = `invoice:${INVOICE_ID}:${custIdA}`;
    assert(
      lt1?.promoKey === expectedKey,
      `promoKey matches "${expectedKey}"`,
      { got: lt1?.promoKey },
    );
    assert(lt1?.status === 'fulfilled', `status == 'fulfilled'`, { got: lt1?.status });

    console.log('\n[test 1b] addLoyaltyPointsFromInvoice idempotency: same invoice again');
    const r1b = await addLoyaltyPointsFromInvoice(tenantDb, custIdA, INVOICE_ID, 500);
    const bal1b = await balance(custIdA);
    const ltCount1b = await countLt(custIdA, 'invoice', 'fulfilled');
    const ptCount1b = lpIdA !== null ? await countPt(lpIdA) : 0;
    console.log(`  balance=${bal1b}, lt(invoice/fulfilled)=${ltCount1b}, pt=${ptCount1b}`);
    assert(r1b !== null, 'returns non-null on idempotent retry');
    assert(bal1b === 500, `balance still 500 (no double-credit, got ${bal1b})`);
    assert(ltCount1b === 1, `still exactly 1 ledger row (got ${ltCount1b})`);
    assert(ptCount1b === 1, `still exactly 1 mirror row (got ${ptCount1b})`);

    // =====================================================================
    // TEST 2 — opt-in guard still works
    // =====================================================================
    console.log('\n[test 2] opt-in guard: customer B (loyaltyProgramOptIn=false)');
    const r2 = await addLoyaltyPointsFromInvoice(tenantDb, custIdB, 88002, 250);
    const lpIdB = await getLpId(custIdB);
    const ltCountB = await countLt(custIdB);
    console.log(`  result=${r2 === null ? 'null' : 'NON-NULL'}, lp row=${lpIdB ?? 'none'}, lt=${ltCountB}`);
    assert(r2 === null, 'returns null for opted-out customer');
    assert(lpIdB === null, 'no loyalty_points row created');
    assert(ltCountB === 0, 'no loyalty_transactions row written');

    // =====================================================================
    // TEST 3 — redemption delegates to reserve()
    // =====================================================================
    console.log('\n[test 3] redeemPointsForReward → reserve(): first call');
    const r3 = await redeemPointsForReward(tenantDb, custIdA, synthRewardId, 1, {
      tenantId: TENANT_ID,
      skipGuardrails: true,
      idempotencyToken: 'tok-redeem-A',
    });
    const bal3 = await balance(custIdA);
    const rrCount3 = await countRr(custIdA);
    const ltRedCount3 = await countLt(custIdA, 'redemption', 'pending');
    const ptCount3 = lpIdA !== null ? await countPt(lpIdA) : 0;
    console.log(
      `  balance=${bal3}, rr=${rrCount3}, lt(redemption/pending)=${ltRedCount3}, pt=${ptCount3}`,
    );
    assert(bal3 === 200, `balance == 200 after 300 deducted (got ${bal3})`);
    assert(rrCount3 === 1, `exactly 1 redeemed_rewards row (got ${rrCount3})`);
    assert(
      ltRedCount3 === 1,
      `exactly 1 loyalty_transactions row source=redemption status=pending (got ${ltRedCount3})`,
    );
    assert(ptCount3 === 2, `points_transactions mirror written (earn + redeem = 2, got ${ptCount3})`);
    assert(
      Array.isArray(r3.redeemedRewards) && r3.redeemedRewards.length === 1,
      `redeemedRewards array length 1`,
      { len: r3.redeemedRewards?.length },
    );
    assert(
      r3.redeemedRewards[0]?.status === 'pending',
      `redeemedRewards[0].status == 'pending'`,
      { got: r3.redeemedRewards[0]?.status },
    );

    // Verify ledger row has the per-unit idempotency key
    const [lt3] = await db
      .select()
      .from(loyaltyTransactions)
      .where(
        and(
          eq(loyaltyTransactions.tenantId, TENANT_ID),
          eq(loyaltyTransactions.customerId, custIdA),
          eq(loyaltyTransactions.source, 'redemption'),
          eq(loyaltyTransactions.promoKey, 'tok-redeem-A:0'),
        ),
      );
    assert(!!lt3, `ledger promoKey == "tok-redeem-A:0" (per-unit key)`, { found: !!lt3 });

    console.log('\n[test 3b] redemption idempotency: same idempotencyToken again');
    const r3b = await redeemPointsForReward(tenantDb, custIdA, synthRewardId, 1, {
      tenantId: TENANT_ID,
      skipGuardrails: true,
      idempotencyToken: 'tok-redeem-A',
    });
    const bal3b = await balance(custIdA);
    const rrCount3b = await countRr(custIdA);
    const ltRedCount3b = await countLt(custIdA, 'redemption');
    console.log(`  balance=${bal3b}, rr=${rrCount3b}, lt(redemption)=${ltRedCount3b}`);
    assert(bal3b === 200, `balance still 200 (no extra debit, got ${bal3b})`);
    assert(rrCount3b === 1, `still 1 redeemed_rewards row (got ${rrCount3b})`);
    assert(ltRedCount3b === 1, `still 1 redemption ledger row (got ${ltRedCount3b})`);
    assert(!!r3b, 'returned a result on idempotent retry (did not throw)');

    // =====================================================================
    // TEST 4 — multi-unit all-or-nothing pre-check
    // =====================================================================
    console.log('\n[test 4] multi-unit pre-check: quantity=2, 600 needed, only 200 available');
    const balBefore4 = await balance(custIdA);
    const rrBefore4 = await countRr(custIdA);
    const ltBefore4 = await countLt(custIdA);

    let threw4 = false;
    let err4: string | null = null;
    try {
      await redeemPointsForReward(tenantDb, custIdA, synthRewardId, 2, {
        tenantId: TENANT_ID,
        skipGuardrails: true,
        idempotencyToken: 'tok-redeem-B',
      });
    } catch (e) {
      threw4 = true;
      err4 = (e as Error).message;
    }
    const balAfter4 = await balance(custIdA);
    const rrAfter4 = await countRr(custIdA);
    const ltAfter4 = await countLt(custIdA);
    console.log(`  threw=${threw4}, message="${err4}"`);
    console.log(`  before: bal=${balBefore4} rr=${rrBefore4} lt=${ltBefore4}`);
    console.log(`  after:  bal=${balAfter4} rr=${rrAfter4} lt=${ltAfter4}`);
    assert(threw4, 'threw an error');
    assert(
      !!err4 && err4.startsWith('Not enough points.'),
      `error message starts with "Not enough points."`,
      { got: err4 },
    );
    assert(balAfter4 === balBefore4, `balance unchanged (still ${balBefore4})`);
    assert(rrAfter4 === rrBefore4, `redeemed_rewards count unchanged (still ${rrBefore4})`);
    assert(ltAfter4 === ltBefore4, `loyalty_transactions count unchanged (still ${ltBefore4})`);

    // =====================================================================
    // TEST 5 — POST /api/loyalty/add-points (LOY-20) via adjust()
    // =====================================================================
    console.log('\n[test 5a] /api/loyalty/add-points handler logic via ledgerAdjust');
    const idemKey5 = `staff-adjust:${STAFF_ACTOR_ID}:test-l3facade-add-points`;
    const r5 = await ledgerAdjust(tenantDb, {
      tenantId: TENANT_ID,
      customerId: custIdA,
      delta: 1000,
      reason: 'staff test grant',
      actorId: STAFF_ACTOR_ID,
      idempotencyKey: idemKey5,
      metadata: { source: 'manual', addedVia: 'staff-ui' },
    });
    const bal5 = await balance(custIdA);
    const ltAdj5 = await countLt(custIdA, 'adjustment', 'fulfilled');
    const ptCount5 = lpIdA !== null ? await countPt(lpIdA) : 0;
    console.log(`  balance=${bal5}, lt(adjustment/fulfilled)=${ltAdj5}, pt=${ptCount5}`);
    assert(r5.success === true, 'adjust returns success=true');
    assert(bal5 === 1200, `balance == 1200 (200 + 1000, got ${bal5})`);
    assert(ltAdj5 === 1, `exactly 1 adjustment ledger row (got ${ltAdj5})`);
    assert(ptCount5 === 3, `mirror row written (earn + redeem + adjust = 3, got ${ptCount5})`);

    const [ltAdjRow] = await db
      .select()
      .from(loyaltyTransactions)
      .where(
        and(
          eq(loyaltyTransactions.tenantId, TENANT_ID),
          eq(loyaltyTransactions.customerId, custIdA),
          eq(loyaltyTransactions.source, 'adjustment'),
        ),
      );
    const meta = (ltAdjRow?.metadata ?? {}) as Record<string, unknown>;
    console.log(`  metadata: ${JSON.stringify(meta)}`);
    assert(meta.actorId === STAFF_ACTOR_ID, `metadata.actorId == ${STAFF_ACTOR_ID}`, { got: meta.actorId });
    assert(meta.addedVia === 'staff-ui', `metadata.addedVia == 'staff-ui'`, { got: meta.addedVia });
    assert(meta.reason === 'staff test grant', `metadata.reason preserved`, { got: meta.reason });

    console.log('\n[test 5b] unauthenticated HTTP call to /api/loyalty/add-points → 401');
    const app = express();
    app.use(express.json());
    registerLoyaltyRoutes(app);

    const balBefore5b = await balance(custIdA);
    const ltBefore5b = await countLt(custIdA);
    const resp401 = await request(app)
      .post('/api/loyalty/add-points')
      .send({ customerId: custIdA, points: 500, source: 'manual', description: 'unauth attempt' });
    const balAfter5b = await balance(custIdA);
    const ltAfter5b = await countLt(custIdA);
    console.log(`  status=${resp401.status}, body=${JSON.stringify(resp401.body)}`);
    console.log(`  balance: before=${balBefore5b} after=${balAfter5b}`);
    assert(resp401.status === 401, `responds 401 (got ${resp401.status})`);
    assert(balAfter5b === balBefore5b, `balance unchanged on unauthenticated call`);
    assert(ltAfter5b === ltBefore5b, `no ledger rows written on unauthenticated call`);

    // =====================================================================
    // TEST 6 — L3-FACADE-1 guardrails response shape
    // =====================================================================
    console.log('\n[test 6] /api/loyalty/guardrails response shape (in-process)');
    const respG = await request(app).get('/api/loyalty/guardrails');
    const dataG = respG.body?.data;
    console.log(`  status=${respG.status}, body=${JSON.stringify(respG.body)}`);
    assert(respG.status === 200, `responds 200 (got ${respG.status})`);
    assert(respG.body?.success === true, 'success=true');
    assert(!!dataG, 'data object present');
    assert(
      typeof dataG?.minCartTotalEnabled === 'boolean',
      `data.minCartTotalEnabled is boolean`,
      { got: typeof dataG?.minCartTotalEnabled },
    );
    assert(
      typeof dataG?.minCartTotal === 'number',
      `data.minCartTotal is number`,
      { got: typeof dataG?.minCartTotal },
    );
    assert(
      typeof dataG?.requireCoreServiceEnabled === 'boolean',
      `data.requireCoreServiceEnabled is boolean`,
      { got: typeof dataG?.requireCoreServiceEnabled },
    );
    assert(
      Array.isArray(dataG?.coreServiceCategories),
      `data.coreServiceCategories is array`,
      { got: typeof dataG?.coreServiceCategories },
    );
    assert(
      typeof dataG?.loyaltyGuardrailMessage === 'string',
      `data.loyaltyGuardrailMessage is string`,
      { got: typeof dataG?.loyaltyGuardrailMessage },
    );

    // root has min_cart_total_cents = 7500 (migration 0012) → enabled should be true
    const rootSettings = await getLoyaltyGuardrailSettings(TENANT_ID);
    console.log(`  rootSettings: ${JSON.stringify(rootSettings)}`);
    if (rootSettings.minCartTotal && rootSettings.minCartTotal > 0) {
      assert(
        dataG?.minCartTotalEnabled === true,
        `minCartTotalEnabled == true (root has min_cart_total > 0)`,
        { got: dataG?.minCartTotalEnabled, minCartTotal: rootSettings.minCartTotal },
      );
    } else {
      console.log(
        `  SKIP — root tenant has minCartTotal=${rootSettings.minCartTotal}, cannot assert minCartTotalEnabled==true`,
      );
    }

    // =====================================================================
    // TEST 7 — invalid input never throws at facade level
    // =====================================================================
    console.log('\n[test 7a] addLoyaltyPointsFromInvoice with amount=0 → no throw, no write');
    const ltBefore7a = await countLt(custIdA);
    let threw7a = false;
    let r7a: Awaited<ReturnType<typeof addLoyaltyPointsFromInvoice>> = null;
    try {
      r7a = await addLoyaltyPointsFromInvoice(tenantDb, custIdA, 88003, 0);
    } catch (e) {
      threw7a = true;
      console.log(`  unexpected throw: ${(e as Error).message}`);
    }
    const ltAfter7a = await countLt(custIdA);
    console.log(`  threw=${threw7a}, result=${r7a === null ? 'null' : 'row'}, lt before=${ltBefore7a} after=${ltAfter7a}`);
    assert(!threw7a, 'did NOT throw on amount=0');
    assert(ltAfter7a === ltBefore7a, 'no new ledger rows written on amount=0');

    console.log('\n[test 7b] redeemPointsForReward with quantity=5 → throws 1-3 validation');
    let threw7b = false;
    let err7b: string | null = null;
    const ltBefore7b = await countLt(custIdA);
    try {
      await redeemPointsForReward(tenantDb, custIdA, synthRewardId, 5, {
        tenantId: TENANT_ID,
        skipGuardrails: true,
        idempotencyToken: 'tok-redeem-bad-qty',
      });
    } catch (e) {
      threw7b = true;
      err7b = (e as Error).message;
    }
    const ltAfter7b = await countLt(custIdA);
    console.log(`  threw=${threw7b}, message="${err7b}"`);
    assert(threw7b, 'threw on quantity=5');
    assert(
      !!err7b && err7b.includes('between 1 and 3'),
      `error mentions "between 1 and 3"`,
      { got: err7b },
    );
    assert(ltAfter7b === ltBefore7b, 'no ledger rows written on validation failure');
  } catch (uncaught) {
    failCount++;
    console.error('\nUNCAUGHT during tests:', (uncaught as Error).message);
    console.error((uncaught as Error).stack);
  } finally {
    // --- CLEANUP ---------------------------------------------------------
    console.log('\n[cleanup] Removing all rows for synthetic customers + reward...');
    try {
      const synthCustIds: number[] = [];
      if (custIdA !== null) synthCustIds.push(custIdA);
      if (custIdB !== null) synthCustIds.push(custIdB);

      let ptDel = 0;
      let lpDel = 0;
      let rrDel = 0;
      let ltDel = 0;
      let caDel = 0;
      let cDel = 0;
      let rwDel = 0;

      if (synthCustIds.length > 0) {
        // Collect loyalty_points ids first for points_transactions deletion
        const lpRows = await db
          .select({ id: loyaltyPoints.id })
          .from(loyaltyPoints)
          .where(
            and(
              eq(loyaltyPoints.tenantId, TENANT_ID),
              inArray(loyaltyPoints.customerId, synthCustIds),
            ),
          );
        const lpIds = lpRows.map((r) => r.id);

        if (lpIds.length > 0) {
          const d = await db
            .delete(pointsTransactions)
            .where(
              and(
                eq(pointsTransactions.tenantId, TENANT_ID),
                inArray(pointsTransactions.loyaltyPointsId, lpIds),
              ),
            )
            .returning({ id: pointsTransactions.id });
          ptDel = d.length;
        }

        const rr = await db
          .delete(redeemedRewards)
          .where(
            and(
              eq(redeemedRewards.tenantId, TENANT_ID),
              inArray(redeemedRewards.customerId, synthCustIds),
            ),
          )
          .returning({ id: redeemedRewards.id });
        rrDel = rr.length;

        const lt = await db
          .delete(loyaltyTransactions)
          .where(
            and(
              eq(loyaltyTransactions.tenantId, TENANT_ID),
              inArray(loyaltyTransactions.customerId, synthCustIds),
            ),
          )
          .returning({ id: loyaltyTransactions.id });
        ltDel = lt.length;

        const ca = await db
          .delete(customerAchievements)
          .where(
            and(
              eq(customerAchievements.tenantId, TENANT_ID),
              inArray(customerAchievements.customerId, synthCustIds),
            ),
          )
          .returning({ id: customerAchievements.id });
        caDel = ca.length;

        const lp = await db
          .delete(loyaltyPoints)
          .where(
            and(
              eq(loyaltyPoints.tenantId, TENANT_ID),
              inArray(loyaltyPoints.customerId, synthCustIds),
            ),
          )
          .returning({ id: loyaltyPoints.id });
        lpDel = lp.length;

        const c = await db
          .delete(customers)
          .where(
            and(
              eq(customers.tenantId, TENANT_ID),
              inArray(customers.id, synthCustIds),
              inArray(customers.name, [SYNTH_NAME_A, SYNTH_NAME_B]),
            ),
          )
          .returning({ id: customers.id });
        cDel = c.length;
      }

      if (synthRewardId !== null) {
        const rw = await db
          .delete(rewardServices)
          .where(
            and(
              eq(rewardServices.tenantId, TENANT_ID),
              eq(rewardServices.id, synthRewardId),
              eq(rewardServices.name, SYNTH_REWARD_NAME),
            ),
          )
          .returning({ id: rewardServices.id });
        rwDel = rw.length;
      }

      console.log(
        `  deleted: points_transactions=${ptDel}, redeemed_rewards=${rrDel}, ` +
          `loyalty_transactions=${ltDel}, customer_achievements=${caDel}, ` +
          `loyalty_points=${lpDel}, customers=${cDel}, reward_services=${rwDel}`,
      );

      // Residual scan
      let rPt = 0;
      let rRr = 0;
      let rLt = 0;
      let rLp = 0;
      let rCa = 0;
      let rC = 0;
      let rRw = 0;

      if (synthCustIds.length > 0) {
        const remainingLp = await db
          .select({ id: loyaltyPoints.id })
          .from(loyaltyPoints)
          .where(
            and(
              eq(loyaltyPoints.tenantId, TENANT_ID),
              inArray(loyaltyPoints.customerId, synthCustIds),
            ),
          );
        rLp = remainingLp.length;
        const remainingLpIds = remainingLp.map((r) => r.id);
        if (remainingLpIds.length > 0) {
          rPt = (
            await db
              .select({ id: pointsTransactions.id })
              .from(pointsTransactions)
              .where(
                and(
                  eq(pointsTransactions.tenantId, TENANT_ID),
                  inArray(pointsTransactions.loyaltyPointsId, remainingLpIds),
                ),
              )
          ).length;
        }
        rRr = (
          await db
            .select({ id: redeemedRewards.id })
            .from(redeemedRewards)
            .where(
              and(
                eq(redeemedRewards.tenantId, TENANT_ID),
                inArray(redeemedRewards.customerId, synthCustIds),
              ),
            )
        ).length;
        rLt = (
          await db
            .select({ id: loyaltyTransactions.id })
            .from(loyaltyTransactions)
            .where(
              and(
                eq(loyaltyTransactions.tenantId, TENANT_ID),
                inArray(loyaltyTransactions.customerId, synthCustIds),
              ),
            )
        ).length;
        rCa = (
          await db
            .select({ id: customerAchievements.id })
            .from(customerAchievements)
            .where(
              and(
                eq(customerAchievements.tenantId, TENANT_ID),
                inArray(customerAchievements.customerId, synthCustIds),
              ),
            )
        ).length;
        rC = (
          await db
            .select({ id: customers.id })
            .from(customers)
            .where(
              and(eq(customers.tenantId, TENANT_ID), inArray(customers.id, synthCustIds)),
            )
        ).length;
      }
      if (synthRewardId !== null) {
        rRw = (
          await db
            .select({ id: rewardServices.id })
            .from(rewardServices)
            .where(
              and(eq(rewardServices.tenantId, TENANT_ID), eq(rewardServices.id, synthRewardId)),
            )
        ).length;
      }

      console.log(
        `  remaining: points_transactions=${rPt}, redeemed_rewards=${rRr}, ` +
          `loyalty_transactions=${rLt}, loyalty_points=${rLp}, customer_achievements=${rCa}, ` +
          `customers=${rC}, reward_services=${rRw}`,
      );

      const allClean =
        rPt === 0 && rRr === 0 && rLt === 0 && rLp === 0 && rCa === 0 && rC === 0 && rRw === 0;
      if (allClean) {
        console.log('  CLEANUP OK — zero test rows remain');
      } else {
        cleanupResidue = true;
        console.log('  CLEANUP WARNING — some rows still present');
      }
    } catch (e) {
      cleanupResidue = true;
      console.error('  CLEANUP ERROR:', (e as Error).message);
    }
  }

  console.log(`\n=== SUMMARY: ${passCount} passed, ${failCount} failed ===`);
  if (cleanupResidue) console.log('=== CLEANUP RESIDUE DETECTED — exit non-zero ===');
  await pool.end();
  process.exit(failCount === 0 && !cleanupResidue ? 0 : 1);
}

main().catch(async (e) => {
  console.error('UNCAUGHT:', e);
  try {
    await pool.end();
  } catch {}
  process.exit(2);
});
