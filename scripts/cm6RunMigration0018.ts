/**
 * CM-6 migration runner — applies 0018_cm6_service_pricing.sql
 * Run: npx tsx scripts/cm6RunMigration0018.ts
 *
 * IMPORTANT: run scripts/cm6Step1CheckServices.ts FIRST and confirm IDs match
 * the manifest before running this migration.
 */
import { sql } from 'drizzle-orm';
import { db, pool } from '../server/db';

async function main() {
  console.log('\n=== CM-6 migration 0018: service pricing update ===\n');
  console.log('Running as a single transaction — rolls back entirely on any error.\n');

  try {
    await db.execute(sql`BEGIN`);

    // ── UPDATES ─────────────────────────────────────────────────────────────

    await db.execute(sql`
      UPDATE services SET
        name = 'Pit Stop',
        price_range = '$179',
        overview = 'For vehicles already in great shape. A professional refresh to keep your car looking its best.',
        detailed_description = 'The Pit Stop is designed for vehicles that are already in good shape and just need a professional refresh. In 1.5–2 hours we hand wash, apply ceramic spray wax, clean wheels and tires, do a quick interior wipedown, treat any small stains, and clean all glass.' || chr(10) || chr(10) ||
        'Recommended every 90 days to protect your prior detail investment.' || chr(10) || chr(10) ||
        'Important: The Pit Stop is for regularly maintained vehicles. If your car has heavy soil, pet hair, or hasn''t been detailed in over a year, our Deep Clean is the right starting point — and worth every penny.',
        duration = '1.5–2 hours',
        min_duration_hours = '1',
        max_duration_hours = '2'
      WHERE id = 5 AND tenant_id = 'root'
    `);
    console.log('✓ ID 5: Pit Stop');

    await db.execute(sql`
      UPDATE services SET
        name = 'The Deep Clean',
        price_range = '$249',
        overview = 'A thorough deep clean of every interior surface. Our most popular service — because life happens inside your car.',
        detailed_description = 'The Deep Clean is a thorough, multi-hour restoration of your vehicle''s interior to the best possible condition. This is the right service for vehicles that haven''t been detailed recently, have visible soiling, pet hair, stains, or simply need a proper reset.' || chr(10) || chr(10) ||
        'Includes: deep vacuum of all surfaces, upholstery and carpet shampoo with steam, leather cleaned and conditioned with premium product, headliner spot treatment, all interior glass cleaned, and all plastics dressed with UV protectant.' || chr(10) || chr(10) ||
        'Pricing: Standard vehicles $249. Heavily soiled vehicles $299–349 depending on condition — we always let you know before we begin. Extreme conditions (pet waste, biological soiling, severe mold) quoted after inspection.' || chr(10) || chr(10) ||
        'Add-on: Fabric & Leather Protector available for $79.',
        duration = '2–4 hours',
        min_duration_hours = '2',
        max_duration_hours = '4'
      WHERE id = 4 AND tenant_id = 'root'
    `);
    console.log('✓ ID 4: The Deep Clean');

    await db.execute(sql`
      UPDATE services SET
        name = 'Showroom',
        price_range = '$349',
        overview = 'The complete package. Interior and exterior restored to showroom condition.',
        detailed_description = 'The Showroom is our signature full detail — everything inside and out, done right.' || chr(10) || chr(10) ||
        'Interior: carpet and upholstery shampooed, leather cleaned and conditioned, headliner spot treated, all glass cleaned, plastics dressed with UV protectant.' || chr(10) || chr(10) ||
        'Exterior: hand wash, clay bar decontamination, ceramic spray wax, wheels cleaned, tires dressed.' || chr(10) || chr(10) ||
        'We aim to make your vehicle look and feel like new. Most vehicles complete in 3–5 hours. Our most popular full-service detail.',
        duration = '3–5 hours',
        min_duration_hours = '3',
        max_duration_hours = '5'
      WHERE id = 3 AND tenant_id = 'root'
    `);
    console.log('✓ ID 3: Showroom');

    await db.execute(sql`
      UPDATE services SET
        name = 'Paint Revival',
        price_range = '$249',
        overview = 'Single-stage machine polish. Removes light swirls, water spots, and oxidation — restores deep shine.',
        detailed_description = 'Paint Revival uses a machine polisher with a finishing polish to remove light swirl marks, water spots, minor scratches, and oxidation from your vehicle''s paint. The result is noticeably improved clarity and gloss.' || chr(10) || chr(10) ||
        'Includes: hand wash, bug and tar removal, iron decontamination, clay bar, single-stage machine polish, window sealant, wheel sealant, trim and tip polish.' || chr(10) || chr(10) ||
        'Exterior service only — no interior work included. Takes 2–4 hours. Best suited for vehicles in good condition with light paint defects. For more significant defects, see Paint Restoration.',
        duration = '2–4 hours',
        min_duration_hours = '2',
        max_duration_hours = '4'
      WHERE id = 6 AND tenant_id = 'root'
    `);
    console.log('✓ ID 6: Paint Revival');

    await db.execute(sql`
      UPDATE services SET
        name = 'Force Field',
        price_range = '$499',
        overview = 'Protection that lasts. True SiO2 ceramic coating with 1–2 year durability and exceptional gloss.',
        detailed_description = 'Force Field is Clean Machine''s entry ceramic protection package. A genuine SiO2 coating is applied to your paint and wheels, delivering hydrophobic water-beading, enhanced gloss, and a durable protective barrier rated for 1–2 years.' || chr(10) || chr(10) ||
        'Includes: full wash and decontamination, clay bar, single-stage correction as needed, Nasial SiO2 coating applied to paint and wheels, window sealant, black trim conditioning, and exhaust tip polish.' || chr(10) || chr(10) ||
        'Sedans start at $499. SUVs and trucks add $75–150 — confirmed at booking. All Force Field coatings are applied by hand with precision care.',
        duration = '4–6 hours',
        min_duration_hours = '4',
        max_duration_hours = '6'
      WHERE id = 7 AND tenant_id = 'root'
    `);
    console.log('✓ ID 7: Force Field');

    await db.execute(sql`
      UPDATE services SET
        name = 'Force Field Pro',
        price_range = '$950',
        overview = 'Serious long-term protection. Two-stage polished, professionally guaranteed SiO2 coating built to last 3 years.',
        detailed_description = 'Force Field Pro is built for vehicles that deserve lasting protection and a concours-level finish. A full 2-stage machine polish achieves up to 90% paint correction before the ceramic is applied — so your coating sits on truly corrected paint.' || chr(10) || chr(10) ||
        'Includes: thorough wash and decontamination, 2-stage machine polish, Nasial SiO2 ceramic coating on all painted surfaces, trim conditioning, and exhaust tip polish.' || chr(10) || chr(10) ||
        'Guaranteed by Clean Machine. Results: exceptional gloss, hydrophobic protection, and dramatically reduced maintenance for up to 3 years.' || chr(10) || chr(10) ||
        'Sedans start at $950. SUVs and trucks quoted individually.',
        duration = '6–10 hours',
        min_duration_hours = '6',
        max_duration_hours = '10'
      WHERE id = 8 AND tenant_id = 'root'
    `);
    console.log('✓ ID 8: Force Field Pro');

    await db.execute(sql`
      UPDATE services SET
        name = 'Motorcycle Detail',
        price_range = '$199',
        overview = 'Your motorcycle, detailed right. Machine polished, hand washed, waxed, and fully protected.',
        detailed_description = 'Clean Machine''s Motorcycle Detail delivers the same premium care your bike deserves. We machine polish for gloss restoration, hand wash all surfaces, apply wax protection, clean and condition seats, and dress trim throughout.' || chr(10) || chr(10) ||
        'Takes 1–2 hours. Please note any special finishes, custom paint, or existing ceramic coatings when booking so we use appropriate products.',
        duration = '1–2 hours',
        min_duration_hours = '1',
        max_duration_hours = '2'
      WHERE id = 9 AND tenant_id = 'root'
    `);
    console.log('✓ ID 9: Motorcycle Detail');

    await db.execute(sql`
      UPDATE services SET
        name = 'Premium Wash',
        price_range = '$99',
        overview = 'A proper hand wash. Not a drive-through — thorough exterior cleaning with ceramic wax protection.',
        detailed_description = 'Our Premium Wash is a real hand wash done the right way — no tunnel, no brushes, no shortcuts. We hand wash all exterior surfaces, clean and dress wheels and tires, clean all exterior glass, and finish with a ceramic spray wax for lasting protection and shine.' || chr(10) || chr(10) ||
        'Takes 45–60 minutes. Ideal for maintaining a previously detailed vehicle between full services.',
        duration = '45–60 minutes',
        min_duration_hours = '0.75',
        max_duration_hours = '1'
      WHERE id = 10 AND tenant_id = 'root'
    `);
    console.log('✓ ID 10: Premium Wash');

    await db.execute(sql`
      UPDATE services SET
        name = 'Carpet & Upholstery Shampoo',
        price_range = '$100',
        overview = 'Deep carpet and seat cleaning. Steam, shampoo, and extraction for a truly fresh interior.',
        detailed_description = 'For carpets, floor mats, and fabric seats that need more than a vacuum. We apply professional shampoo, agitate with steam, and extract with a high-powered system to lift deep-set dirt, stains, and odors. Leather seats receive gentle steam cleaning and premium conditioner.' || chr(10) || chr(10) ||
        'Takes 1–2 hours. Can be added to any detail service or booked standalone.',
        duration = '1–2 hours',
        min_duration_hours = '1',
        max_duration_hours = '2'
      WHERE id = 11 AND tenant_id = 'root'
    `);
    console.log('✓ ID 11: Carpet & Upholstery Shampoo');

    await db.execute(sql`
      UPDATE services SET
        name = 'Fabric & Leather Protector',
        price_range = '$79',
        overview = 'A nano-coating for your interior. Repels liquids and stains before they can set.',
        detailed_description = 'We apply a professional-grade nano-ceramic protectant to fabric seats, carpet, or leather surfaces. The coating creates an invisible barrier that repels water, oil, and stains — making future spills easy to wipe away before they become permanent.' || chr(10) || chr(10) ||
        'Lasts up to 12 months with normal use. Takes 30–45 minutes. Pairs well with The Deep Clean or Showroom.',
        duration = '30–45 minutes',
        min_duration_hours = '0.5',
        max_duration_hours = '0.75'
      WHERE id = 12 AND tenant_id = 'root'
    `);
    console.log('✓ ID 12: Fabric & Leather Protector');

    // IDs 13 and 15: retire via rename (safe — preserves FK refs)
    await db.execute(sql`UPDATE services SET name = '[Retired] Light Polish' WHERE id = 13 AND tenant_id = 'root'`);
    console.log('✓ ID 13: [Retired] Light Polish');

    await db.execute(sql`
      UPDATE services SET
        name = 'Headlight Restore',
        price_range = '$90',
        overview = 'Clear, bright lenses. We restore foggy or yellowed headlights to factory clarity.',
        detailed_description = 'Oxidized headlights reduce visibility and make your vehicle look aged. Our process sands away oxidation, polishes the lens to clarity, and applies a UV sealant to slow re-oxidation.' || chr(10) || chr(10) ||
        'Results typically last 1–2 years. Takes 30–60 minutes. Can be added to any service.',
        duration = '30–60 minutes',
        min_duration_hours = '0.5',
        max_duration_hours = '1'
      WHERE id = 14 AND tenant_id = 'root'
    `);
    console.log('✓ ID 14: Headlight Restore');

    await db.execute(sql`UPDATE services SET name = '[Retired] 12-Month Ceramic' WHERE id = 15 AND tenant_id = 'root'`);
    console.log('✓ ID 15: [Retired] 12-Month Ceramic');

    await db.execute(sql`
      UPDATE services SET
        name = 'Plastic Trim Restore',
        price_range = '$65',
        overview = 'Bring back the black. We restore faded plastic trim to its original deep, rich finish.',
        detailed_description = 'Sun-faded gray trim is one of the easiest ways a vehicle looks neglected — and one of the easiest things to fix. We apply a premium trim restorer that revives color, adds lasting shine, and provides UV protection to slow re-fading.' || chr(10) || chr(10) ||
        'Takes 30–45 minutes. Can be added to any detail service.',
        duration = '30–45 minutes',
        min_duration_hours = '0.5',
        max_duration_hours = '0.75'
      WHERE id = 16 AND tenant_id = 'root'
    `);
    console.log('✓ ID 16: Plastic Trim Restore');

    await db.execute(sql`
      UPDATE services SET
        name = 'Engine Bay Detail',
        price_range = '$75',
        overview = 'Clean under the hood. Cosmetic degreasing and dressing for a showroom-ready engine bay.',
        detailed_description = 'A clean engine bay is the mark of a truly detailed vehicle. We carefully degrease, rinse, and dress all engine bay surfaces for a clean, finished appearance. Safe for all modern engines.' || chr(10) || chr(10) ||
        'Takes approximately 30–45 minutes. Pairs well with any detail package.',
        duration = '30–45 minutes',
        min_duration_hours = '0.5',
        max_duration_hours = '0.75'
      WHERE id = 17 AND tenant_id = 'root'
    `);
    console.log('✓ ID 17: Engine Bay Detail');

    await db.execute(sql`
      UPDATE services SET
        name = 'Glass & Windshield Protector',
        price_range = '$49',
        overview = 'Hydrophobic glass treatment. Rain beads and rolls off so you can see clearly.',
        detailed_description = 'We apply a professional hydrophobic glass sealant to your windshield and all windows. Water beads and clears at highway speeds — dramatically improving visibility in rain.' || chr(10) || chr(10) ||
        'Rated for 1+ year of protection. Takes 20–30 minutes. Frequently paired with ceramic packages or added to any wash or detail.',
        duration = '20–30 minutes',
        min_duration_hours = '0.33',
        max_duration_hours = '0.5'
      WHERE id = 18 AND tenant_id = 'root'
    `);
    console.log('✓ ID 18: Glass & Windshield Protector');

    await db.execute(sql`
      UPDATE services SET
        name = 'Ozone Odor Removal',
        price_range = '$75',
        overview = 'Eliminate stubborn odors at the source. Ozone treatment reaches where cleaning cannot.',
        detailed_description = 'Some odors — pet smells, smoke, food, mildew — survive even a thorough cleaning. Ozone treatment generates O3 molecules that neutralize odor-causing compounds throughout the vehicle, including in the HVAC system, headliner, and seating.' || chr(10) || chr(10) ||
        'Vehicle must be unoccupied during treatment. Takes 30–60 minutes after cleaning. Works best alongside The Deep Clean or Carpet & Upholstery Shampoo.',
        duration = '30–60 minutes',
        min_duration_hours = '0.5',
        max_duration_hours = '1'
      WHERE id = 19 AND tenant_id = 'root'
    `);
    console.log('✓ ID 19: Ozone Odor Removal');

    // ── INSERTS ──────────────────────────────────────────────────────────────

    await db.execute(sql`
      INSERT INTO services (
        tenant_id, name, price_range, overview, detailed_description,
        duration, duration_hours, min_duration_hours, max_duration_hours
      ) VALUES (
        'root',
        'Showstopper',
        '$549',
        'The best we do. Full interior and exterior detail plus single-stage paint enhancement.',
        'The Showstopper is for vehicles that deserve the full treatment — pre-sale preparation, show-ready results, or simply the best available in a single visit.' || chr(10) || chr(10) ||
        'Everything in the Showroom detail, plus single-stage machine paint enhancement to remove light swirls and water spots and restore maximum gloss.' || chr(10) || chr(10) ||
        'Interior: deep shampoo, leather cleaned and conditioned, headliner treated, all glass cleaned, plastics dressed. Exterior: hand wash, full decontamination, clay bar, machine polish, ceramic spray wax, wheels cleaned, tires dressed.' || chr(10) || chr(10) ||
        'Takes 5–7 hours. Best suited for vehicles in good-to-excellent condition. Engine Bay Detail and Headlight Restore available as add-ons.',
        '5–7 hours', '6', '5', '7'
      )
    `);
    console.log('✓ INSERT: Showstopper ($549)');

    await db.execute(sql`
      INSERT INTO services (
        tenant_id, name, price_range, overview, detailed_description,
        duration, duration_hours, min_duration_hours, max_duration_hours
      ) VALUES (
        'root',
        'Paint Restoration',
        '$399',
        'Two-stage paint correction. Removes moderate scratches, heavy swirls, and significant oxidation.',
        'Paint Restoration is for vehicles with more serious paint defects — deeper swirl marks, heavier scratches, pronounced oxidation, or paint that has lost its clarity over time.' || chr(10) || chr(10) ||
        'We use a two-step machine polish process: a cutting stage to remove defects, followed by a finishing stage to restore maximum gloss and clarity.' || chr(10) || chr(10) ||
        'Includes: hand wash, full decontamination, clay bar, two-stage machine polish, window sealant, wheel sealant, trim and tip polish.' || chr(10) || chr(10) ||
        'Exterior service only — no interior work included. Takes 3–5 hours. For vehicles with severe defects or as preparation before ceramic coating, this is the right starting point.',
        '3–5 hours', '4', '3', '5'
      )
    `);
    console.log('✓ INSERT: Paint Restoration ($399)');

    await db.execute(sql`COMMIT`);
    console.log('\n✅ Migration 0018 committed successfully.\n');

    // ── VERIFY ───────────────────────────────────────────────────────────────
    console.log('=== Final service list ===\n');
    const final = await db.execute(sql`
      SELECT id, name, price_range FROM services
      WHERE tenant_id = 'root'
      ORDER BY name
    `);
    for (const r of final.rows as any[]) {
      console.log(`${String(r.id).padStart(3)} | ${String(r.name).padEnd(32)} | ${r.price_range}`);
    }

  } catch (err: any) {
    await db.execute(sql`ROLLBACK`);
    console.error('\n❌ Migration FAILED — rolled back:', err.message);
    process.exit(1);
  }

  await pool.end();
}

main().catch(async (e) => {
  console.error('UNCAUGHT:', e);
  try { await pool.end(); } catch {}
  process.exit(2);
});
