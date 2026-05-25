#!/usr/bin/env tsx
/**
 * Consolidate Port Recovery Ledger (L1-4)
 *
 * Dry-run by default. Use --apply to execute writes.
 *
 * Collapses each customer's duplicate port_recovery transactions into
 * ONE canonical transaction whose amount equals their current trusted
 * loyalty_points balance (minus any non-port_recovery activity).
 *
 * loyalty_points.points is NEVER written. Non-port_recovery txns are
 * NEVER touched.
 */

import { db } from "../server/db";
import { pointsTransactions } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

const APPLY = process.argv.includes("--apply");
const DRY_RUN = !APPLY;

const CONSOLIDATED_DESC =
  "Port recovery grant — consolidated 2026-05 (supersedes duplicate Dec-2025 import runs)";

interface CustomerLedger {
  loyaltyPointsId: number;
  customerId: number;
  tenantId: string;
  trustedBalance: number;
  prCount: number;
  prSum: number;
  nonPrSum: number;
  earliestPrDate: Date | null;
  canonicalAmount: number;
  isAnomaly: boolean;
}

async function main() {
  console.log(
    `[${new Date().toISOString()}] Consolidate Port Recovery Ledger`
  );
  console.log(`Mode: ${DRY_RUN ? "DRY-RUN" : "APPLY"}`);
  console.log("");

  // Step 1: Aggregate all customer ledger data in one query
  const result = await db.execute(sql`
    SELECT
      lp.id AS loyalty_points_id,
      lp.customer_id,
      lp.tenant_id,
      lp.points AS trusted_balance,
      COUNT(pt.id) FILTER (WHERE pt.source = 'port_recovery') AS pr_count,
      COALESCE(SUM(pt.amount) FILTER (WHERE pt.source = 'port_recovery'), 0) AS pr_sum,
      COALESCE(SUM(pt.amount) FILTER (WHERE pt.source != 'port_recovery'), 0) AS non_pr_sum,
      MIN(pt.transaction_date) FILTER (WHERE pt.source = 'port_recovery') AS earliest_pr_date
    FROM loyalty_points lp
    LEFT JOIN points_transactions pt ON pt.loyalty_points_id = lp.id
    WHERE EXISTS (
      SELECT 1 FROM points_transactions pt2
      WHERE pt2.loyalty_points_id = lp.id AND pt2.source = 'port_recovery'
    )
    GROUP BY lp.id, lp.customer_id, lp.tenant_id, lp.points
    ORDER BY lp.id
  `);

  const rows = result.rows || [];

  const customers: CustomerLedger[] = [];
  let totalPrRowsToDelete = 0;
  let totalReplacementRows = 0;
  const anomalies: Array<{
    loyaltyPointsId: number;
    customerId: number;
    trustedBalance: number;
    nonPrSum: number;
    canonicalAmount: number;
  }> = [];

  for (const row of rows) {
    const lpId = Number(row.loyalty_points_id);
    const customerId = Number(row.customer_id);
    const tenantId = String(row.tenant_id);
    const trustedBalance = Number(row.trusted_balance);
    const prCount = Number(row.pr_count);
    const prSum = Number(row.pr_sum);
    const nonPrSum = Number(row.non_pr_sum);
    const earliestPrDate = row.earliest_pr_date
      ? new Date(String(row.earliest_pr_date))
      : null;
    const canonicalAmount = trustedBalance - nonPrSum;
    const isAnomaly = canonicalAmount <= 0;

    customers.push({
      loyaltyPointsId: lpId,
      customerId,
      tenantId,
      trustedBalance,
      prCount,
      prSum,
      nonPrSum,
      earliestPrDate,
      canonicalAmount,
      isAnomaly,
    });

    if (isAnomaly) {
      anomalies.push({
        loyaltyPointsId: lpId,
        customerId,
        trustedBalance,
        nonPrSum,
        canonicalAmount,
      });
    } else {
      totalPrRowsToDelete += prCount;
      totalReplacementRows += 1;
    }
  }

  // ── Report ─────────────────────────────────────────────────────────
  console.log(
    `Total customers in scope (have port_recovery txns): ${customers.length}`
  );
  console.log(
    `Total port_recovery rows that would be deleted: ${totalPrRowsToDelete}`
  );
  console.log(
    `Total replacement rows that would be inserted: ${totalReplacementRows}`
  );
  console.log(`Anomalies (canonical ≤ 0): ${anomalies.length}`);

  if (anomalies.length > 0) {
    console.log("\n--- ANOMALY LIST ---");
    for (const a of anomalies) {
      console.log(
        `  LP id=${a.loyaltyPointsId}, customer=${a.customerId}, balance=${a.trustedBalance}, nonPrSum=${a.nonPrSum}, canonical=${a.canonicalAmount}`
      );
    }
  } else {
    console.log("\nAnomalies: none");
  }

  // 10-customer sample
  console.log("\n--- 10-CUSTOMER SAMPLE ---");
  const sample = customers.slice(0, 10);
  for (const c of sample) {
    const check = c.isAnomaly
      ? "ANOMALY"
      : c.canonicalAmount + c.nonPrSum === c.trustedBalance
        ? "OK"
        : "MISMATCH";
    console.log(
      `  LP=${c.loyaltyPointsId} | balance=${c.trustedBalance} | prCount=${c.prCount} | prSum=${c.prSum} | nonPr=${c.nonPrSum} | canonical=${c.canonicalAmount} | ${check}`
    );
  }

  // Verify: for every non-anomaly, canonical + non_pr == balance
  const mismatches = customers.filter(
    (c) => !c.isAnomaly && c.canonicalAmount + c.nonPrSum !== c.trustedBalance
  );
  console.log(
    `\nBalance integrity check: ${mismatches.length} mismatches out of ${customers.length - anomalies.length} non-anomaly customers`
  );

  if (DRY_RUN) {
    console.log("\n--- DRY-RUN COMPLETE. No changes made. ---");
    console.log("Run with --apply to execute.");
    return;
  }

  // ── APPLY MODE ───────────────────────────────────────────────────
  console.log("\n--- APPLYING CHANGES ---");

  await db.transaction(async (tx) => {
    let processed = 0;
    let deletedTotal = 0;
    let insertedTotal = 0;

    for (const c of customers) {
      if (c.isAnomaly) continue;

      // Delete all port_recovery rows for this customer
      const deleteResult = await tx
        .delete(pointsTransactions)
        .where(
          and(
            eq(pointsTransactions.loyaltyPointsId, c.loyaltyPointsId),
            eq(pointsTransactions.source, "port_recovery")
          )
        )
        .returning();

      deletedTotal += deleteResult.length;

      // Insert canonical replacement row
      await tx.insert(pointsTransactions).values({
        tenantId: c.tenantId,
        loyaltyPointsId: c.loyaltyPointsId,
        amount: c.canonicalAmount,
        description: CONSOLIDATED_DESC,
        transactionType: "earn",
        source: "port_recovery",
        transactionDate: c.earliestPrDate || new Date(),
      });

      insertedTotal += 1;
      processed += 1;

      if (processed % 100 === 0) {
        console.log(
          `  Progress: ${processed}/${totalReplacementRows} customers processed...`
        );
      }
    }

    console.log(`\nAPPLY COMPLETE:`);
    console.log(`  Customers processed: ${processed}`);
    console.log(`  Rows deleted: ${deletedTotal}`);
    console.log(`  Rows inserted: ${insertedTotal}`);
  });
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
