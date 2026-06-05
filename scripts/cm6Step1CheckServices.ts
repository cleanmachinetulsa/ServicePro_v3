/**
 * CM-6 Step 1 — Confirm live service rows before any edits.
 * Run: npx tsx scripts/cm6Step1CheckServices.ts
 */
import { sql } from 'drizzle-orm';
import { db, pool } from '../server/db';

async function main() {
  console.log('\n=== CM-6 Step 1: Current services (tenant_id = root) ===\n');

  const services = await db.execute(sql`
    SELECT id, name, price_range
    FROM services
    WHERE tenant_id = 'root'
    ORDER BY id
  `);
  console.log('id | name | price_range');
  console.log('---|------|------------');
  for (const r of services.rows as any[]) {
    console.log(`${r.id} | ${r.name} | ${r.price_range}`);
  }

  console.log('\n=== Booking counts for candidate retirement IDs 13 and 15 ===\n');
  const bookings = await db.execute(sql`
    SELECT COUNT(*) as booking_count, service_id
    FROM appointments
    WHERE service_id IN (13, 15)
    GROUP BY service_id
  `);
  if (bookings.rows.length === 0) {
    console.log('No appointments found for service IDs 13 or 15 → safe to DELETE both.');
  } else {
    for (const r of bookings.rows as any[]) {
      console.log(`service_id=${r.service_id}  booking_count=${r.booking_count}`);
    }
  }

  await pool.end();
}

main().catch(async (e) => {
  console.error('UNCAUGHT:', e);
  try { await pool.end(); } catch {}
  process.exit(2);
});
