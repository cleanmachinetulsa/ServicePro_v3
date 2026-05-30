/**
 * CM-2 migration runner — adds delivered_at to port_recovery_sms_sends.
 * Use instead of psql when psql is not available on the machine.
 *
 * Run: npx tsx scripts/runMigration0017.ts
 */

import { sql } from 'drizzle-orm';
import { db, pool } from '../server/db';

async function main() {
  console.log('[migration 0017] Applying: ADD COLUMN IF NOT EXISTS delivered_at ...');

  await db.execute(sql`
    ALTER TABLE port_recovery_sms_sends
      ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ
  `);

  console.log('[migration 0017] Done. Verifying column exists...');

  const result = await db.execute(sql`
    SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'port_recovery_sms_sends'
       AND column_name  = 'delivered_at'
  `);

  if (result.rows.length === 1) {
    const col = result.rows[0] as any;
    console.log(`[migration 0017] VERIFIED: delivered_at exists — type=${col.data_type} nullable=${col.is_nullable}`);
  } else {
    console.error('[migration 0017] FAILED: column not found after ALTER');
    process.exit(1);
  }

  await pool.end();
  process.exit(0);
}

main().catch(async (e) => {
  console.error('[migration 0017] UNCAUGHT:', e);
  try { await pool.end(); } catch {}
  process.exit(2);
});
