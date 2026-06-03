/**
 * CM-3 pre-flight DB check.
 * Queries the live sms_suppression_list schema and row count.
 *
 * Run: npx tsx scripts/checkCM3DB.ts
 */

import { sql } from 'drizzle-orm';
import { db, pool } from '../server/db';

async function main() {
  console.log('\n=== CM-3 DB pre-flight check ===\n');

  // 1. Column list
  const cols = await db.execute(sql`
    SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'sms_suppression_list'
     ORDER BY ordinal_position
  `);

  console.log('sms_suppression_list columns:');
  for (const row of cols.rows as any[]) {
    console.log(`  ${row.column_name.padEnd(20)} ${row.data_type.padEnd(20)} nullable=${row.is_nullable}  default=${row.column_default ?? 'none'}`);
  }

  // 2. Row count
  const cnt = await db.execute(sql`
    SELECT COUNT(*) AS count FROM sms_suppression_list
  `);
  console.log(`\nsms_suppression_list row count: ${(cnt.rows[0] as any).count}`);

  // 3. Also confirm port_recovery_sms_sends has delivered_at (migration 0017)
  const prs = await db.execute(sql`
    SELECT column_name, data_type
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'port_recovery_sms_sends'
     ORDER BY ordinal_position
  `);
  console.log('\nport_recovery_sms_sends columns:');
  for (const row of prs.rows as any[]) {
    console.log(`  ${(row as any).column_name.padEnd(20)} ${(row as any).data_type}`);
  }

  await pool.end();
}

main().catch(async (e) => {
  console.error('UNCAUGHT:', e);
  try { await pool.end(); } catch {}
  process.exit(2);
});
