/**
 * L4 Step 2 — Daily Loyalty Reconciliation Alarm
 *
 * Verifies the invariant the L1-L4 ledger rebuild established:
 *   loyalty_points.points == signed SUM(points_transactions.amount)
 *                            per loyalty_points row (i.e. per customer per tenant).
 *
 * pointsTransactions.amount is already signed by the canonical writer
 * (server/services/loyaltyLedger.ts) — earn/credit/adjustment positive,
 * redeem/expire negative — so reconciliation is a plain SUM with no
 * sign-flip per transactionType. This matches the verification queries
 * used in L1-L4.
 *
 * This function does NOT auto-correct. It detects drift and logs loudly
 * so monitoring picks it up. Manual investigation + ledger.adjust() is
 * the only sanctioned remediation path.
 */

import { sql } from 'drizzle-orm';
import { loyaltyPoints, pointsTransactions } from '@shared/schema';
import { db } from '../db';
import { wrapTenantDb, type TenantDb } from '../tenantDb';
import { tenants } from '@shared/schema';

export interface LoyaltyMismatch {
  loyaltyPointsId: number;
  customerId: number;
  storedBalance: number;
  computedLedgerSum: number;
  delta: number; // stored - computed; positive = stored too high (over-credit)
}

export interface ReconciliationResult {
  tenantId: string;
  checkedAt: string; // ISO timestamp
  totalCustomersChecked: number;
  mismatchCount: number;
  mismatches: LoyaltyMismatch[];
  durationMs: number;
}

/**
 * Run reconciliation for a single tenant. Single SQL LEFT JOIN aggregation —
 * does not load every transaction into memory.
 *
 * tenantDb is REQUIRED and must already be scoped (wrapTenantDb) — this is
 * the same contract every other loyalty function in this codebase follows.
 */
export async function reconcileLoyaltyBalances(
  tenantDb: TenantDb,
  tenantId: string,
): Promise<ReconciliationResult> {
  const start = Date.now();

  // TENANT SCOPING: tenantDb.select is a pass-through (see server/tenantDb.ts —
  // "no magic for SELECT"), so every SELECT must use withTenantFilter or an
  // explicit eq(table.tenantId, ...). The correlated subquery is also
  // tenant-scoped via points_transactions.tenant_id to defend against a
  // hypothetical loyalty_points row whose transactions span tenants.
  //
  // COALESCE handles loyalty_points rows with zero transactions
  // (e.g. opt-in created the row but no points have ever been awarded).
  const rows = await tenantDb
    .select({
      loyaltyPointsId: loyaltyPoints.id,
      customerId: loyaltyPoints.customerId,
      storedBalance: loyaltyPoints.points,
      computedLedgerSum: sql<number>`
        COALESCE(
          (SELECT SUM(${pointsTransactions.amount})
           FROM ${pointsTransactions}
           WHERE ${pointsTransactions.loyaltyPointsId} = ${loyaltyPoints.id}
             AND ${pointsTransactions.tenantId} = ${tenantId}),
          0
        )::int
      `.as('computed_ledger_sum'),
    })
    .from(loyaltyPoints)
    .where(tenantDb.withTenantFilter(loyaltyPoints));

  const mismatches: LoyaltyMismatch[] = [];
  for (const r of rows) {
    const stored = Number(r.storedBalance ?? 0);
    const computed = Number(r.computedLedgerSum ?? 0);
    if (stored !== computed) {
      mismatches.push({
        loyaltyPointsId: r.loyaltyPointsId,
        customerId: r.customerId,
        storedBalance: stored,
        computedLedgerSum: computed,
        delta: stored - computed,
      });
    }
  }

  const result: ReconciliationResult = {
    tenantId,
    checkedAt: new Date().toISOString(),
    totalCustomersChecked: rows.length,
    mismatchCount: mismatches.length,
    mismatches,
    durationMs: Date.now() - start,
  };

  if (mismatches.length > 0) {
    console.error(
      `[LOYALTY RECONCILIATION] DRIFT DETECTED tenant=${tenantId} ` +
        `checked=${rows.length} mismatches=${mismatches.length} ` +
        `durationMs=${result.durationMs}`,
    );
    for (const m of mismatches) {
      console.error(
        `[LOYALTY RECONCILIATION] DRIFT tenant=${tenantId} ` +
          `loyaltyPointsId=${m.loyaltyPointsId} customerId=${m.customerId} ` +
          `stored=${m.storedBalance} ledgerSum=${m.computedLedgerSum} ` +
          `delta=${m.delta}`,
      );
    }
  } else {
    console.log(
      `[LOYALTY RECONCILIATION] OK tenant=${tenantId} ` +
        `checked=${rows.length} durationMs=${result.durationMs}`,
    );
  }

  return result;
}

/**
 * Run reconciliation across every tenant. Used by the daily cron.
 */
export async function reconcileAllTenants(): Promise<ReconciliationResult[]> {
  const rootDb = wrapTenantDb(db, 'root');
  const tenantRows = await rootDb
    .select({ id: tenants.id })
    .from(tenants);

  const results: ReconciliationResult[] = [];
  for (const t of tenantRows) {
    try {
      const tenantDb = wrapTenantDb(db, t.id);
      const r = await reconcileLoyaltyBalances(tenantDb, t.id);
      results.push(r);
    } catch (err) {
      console.error(
        `[LOYALTY RECONCILIATION] tenant=${t.id} reconciliation threw:`,
        err,
      );
    }
  }
  return results;
}

// ============================================================
// Daily cron — follows the PLATFORM_BG_JOBS_ENABLED pattern
// (see server/services/weeklyDigestCron.ts for the template).
// Runs hourly; fires the full sweep once per UTC date.
// ============================================================

const HOUR_MS = 60 * 60 * 1000;
let timer: NodeJS.Timeout | null = null;
let lastRunUtcDate: string | null = null;

function utcDateKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10); // YYYY-MM-DD
}

async function tick(now: Date = new Date()): Promise<void> {
  try {
    const key = utcDateKey(now);
    // Only fire once per UTC day, at the first hourly tick at/after 03:00 UTC
    // (off-peak; loyalty traffic is bursty around invoice-finalize calls).
    if (now.getUTCHours() < 3) return;
    if (lastRunUtcDate === key) return;
    lastRunUtcDate = key;
    console.log(`[LOYALTY RECONCILIATION CRON] firing date=${key}`);
    await reconcileAllTenants();
  } catch (err) {
    console.error('[LOYALTY RECONCILIATION CRON] tick error:', err);
  }
}

export function startLoyaltyReconciliationCron(): void {
  if (process.env.PLATFORM_BG_JOBS_ENABLED !== '1') {
    console.log(
      '[LOYALTY RECONCILIATION CRON] PLATFORM_BG_JOBS_ENABLED!=1 — not starting',
    );
    return;
  }
  if (timer) return;
  console.log('[LOYALTY RECONCILIATION CRON] starting; hourly UTC-date check');
  timer = setInterval(() => void tick(), HOUR_MS);
  // Do not run immediately on boot — wait for the first hourly tick so the
  // "first tick at/after 03:00 UTC" rule actually gates the run. Boots that
  // happen after 03:00 UTC will get caught on the next interval tick.
}

export function stopLoyaltyReconciliationCron(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

export const _internals = { tick, utcDateKey };
