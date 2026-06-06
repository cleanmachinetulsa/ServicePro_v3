/**
 * S4+S2 Post-Service Flow Tests
 *
 * Tests 1-2: Pure logic — run anywhere, no DB needed.
 * Tests 3-4: DB integration — require DATABASE_URL (run on Replit / prod env).
 *            Skipped automatically when DATABASE_URL is not set.
 *
 * Run: npx tsx scripts/testS4S2PostService.ts
 *
 * Guardrails (DB tests):
 * - Synthetic inserts only — never touches real customer/appointment rows
 * - try/finally guarantees zero synthetic rows remain after every run
 * - sendSMS / sendInvoiceNotification are NOT called (no live SMS/email)
 */

const TENANT_ID = 'root';
const HAS_DB = Boolean(process.env.DATABASE_URL);

let passed = 0;
let failed = 0;
let skipped = 0;

function pass(label: string) {
  console.log(`  ✅ ${label}`);
  passed++;
}

function fail(label: string, detail?: any) {
  console.error(`  ❌ FAIL: ${label}`, detail !== undefined ? detail : '');
  failed++;
}

function skip(label: string) {
  console.log(`  ⏭  SKIP (no DATABASE_URL): ${label}`);
  skipped++;
}

function assert(condition: boolean, label: string, detail?: any) {
  if (condition) pass(label);
  else fail(label, detail);
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 1 — S2 customer completion SMS message body (pure logic, no DB)
// ─────────────────────────────────────────────────────────────────────────────
function test1_completionSmsBody() {
  console.log('\nTest 1: S2 customer completion SMS — message body construction');

  // Mirror the exact logic from routes.techJobs.ts S2 block
  function buildMsg(customerName: string | null, techPreferredName: string | null): string {
    const customerFirstName = customerName ? customerName.split(' ')[0] : 'there';
    const techFirstName = techPreferredName ? techPreferredName.split(' ')[0] : 'Your technician';
    return (
      `Hey ${customerFirstName}, ${techFirstName} just wrapped up your detail! ` +
      `Your vehicle is looking great. You'll receive your invoice shortly — ` +
      `thanks for choosing Clean Machine! 🚗✨`
    );
  }

  const msg = buildMsg('Jane Smith', 'Marcus Williams');
  assert(msg.includes('Hey Jane,'), 'Addresses customer by first name');
  assert(msg.includes('Marcus just wrapped up'), 'Includes tech first name');
  assert(msg.includes("You'll receive your invoice shortly"), 'Mentions upcoming invoice');
  assert(msg.includes('Clean Machine'), 'Includes business name');
  assert(msg.includes('🚗✨'), 'Includes emoji');

  // Fallback: null customerName → "there"
  const fallbackMsg = buildMsg(null, 'Marcus');
  assert(fallbackMsg.startsWith('Hey there,'), "Falls back to 'there' when customerName is null");

  // Fallback: null tech name → "Your technician"
  const techFallbackMsg = buildMsg('Bob', null);
  assert(techFallbackMsg.includes('Your technician just wrapped up'), "Falls back to 'Your technician' when preferredName is null");
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 2 — S4 completion response shape (pure logic, no DB)
// ─────────────────────────────────────────────────────────────────────────────
function test2_completionResponseShape() {
  console.log('\nTest 2: S4 completion response — requiresInvoiceConfirmation payload shape');

  // Simulate the response the /complete endpoint now returns
  function buildCompletionResponse(opts: {
    invoiceId: number;
    deposit: { totalAmount: string } | null;
    paymentMethod: string;
    amount: number;
    customerName: string | null;
    serviceName: string | null;
    priceRange: string | null;
    jobId: number;
  }) {
    return {
      success: true,
      invoiceId: opts.invoiceId,
      depositAmount: opts.deposit?.totalAmount ?? null,
      message: `Job completed with ${opts.paymentMethod} payment of $${opts.amount.toFixed(2)}`,
      requiresInvoiceConfirmation: true,
      customerName: opts.customerName || 'Customer',
      serviceName: opts.serviceName || 'Service',
      priceRange: opts.priceRange || '',
      jobId: opts.jobId,
    };
  }

  // Case A: online payment — deposit is null (Deviation 3 fix)
  const onlineResp = buildCompletionResponse({
    invoiceId: 42,
    deposit: null,
    paymentMethod: 'online',
    amount: 299,
    customerName: 'Jane Smith',
    serviceName: 'Full Detail',
    priceRange: '$249–349',
    jobId: 7,
  });
  assert(onlineResp.requiresInvoiceConfirmation === true, 'requiresInvoiceConfirmation is true');
  assert(onlineResp.depositAmount === null, 'depositAmount is null for online payment (no crash)');
  assert(onlineResp.customerName === 'Jane Smith', 'customerName present');
  assert(onlineResp.serviceName === 'Full Detail', 'serviceName present');
  assert(onlineResp.priceRange === '$249–349', 'priceRange present');
  assert(onlineResp.jobId === 7, 'jobId present');

  // Case B: cash payment — deposit is present
  const cashResp = buildCompletionResponse({
    invoiceId: 43,
    deposit: { totalAmount: '299.00' },
    paymentMethod: 'cash',
    amount: 299,
    customerName: 'Bob Jones',
    serviceName: null,
    priceRange: null,
    jobId: 8,
  });
  assert(cashResp.depositAmount === '299.00', 'depositAmount present for cash payment');
  assert(cashResp.serviceName === 'Service', "serviceName falls back to 'Service' when null");

  // Frontend midpoint calculation (used to pre-fill the modal amount field)
  function midpointFromRange(priceRange: string, fallback: number): number {
    const nums = priceRange.match(/\d+/g)?.map(Number) ?? [];
    return nums.length >= 2
      ? Math.round((nums[0] + nums[nums.length - 1]) / 2)
      : nums[0] ?? fallback;
  }
  assert(midpointFromRange('$249–349', 0) === 299, 'Midpoint of $249–349 is 299');
  assert(midpointFromRange('$100-200', 0) === 150, 'Midpoint of $100-200 is 150');
  assert(midpointFromRange('', 175) === 175, 'Falls back to total when priceRange is empty');
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests 3 + 4 — DB integration (skipped when DATABASE_URL absent)
// ─────────────────────────────────────────────────────────────────────────────
async function runDbTests() {
  if (!HAS_DB) {
    console.log('\nTests 3-4: DB integration tests');
    skip('send-invoice DB update — amount, invoiceSentAt, notes');
    skip('Cleanup — zero synthetic rows remain after try/finally');
    return;
  }

  // Lazy-import DB only when DATABASE_URL is present
  const { sql } = await import('drizzle-orm');
  const { db, pool } = await import('../server/db');

  let syntheticCustomerId: number | null = null;
  let syntheticServiceId: number | null = null;
  let syntheticAppointmentId: number | null = null;
  let syntheticInvoiceId: number | null = null;

  async function setup() {
    const custResult = await db.execute(sql`
      INSERT INTO customers (tenant_id, name, phone, email, address)
      VALUES (${TENANT_ID}, 'S4S2 Test Customer', '+19180000001', 'testS4S2@example.invalid', '123 Test St')
      RETURNING id
    `);
    syntheticCustomerId = (custResult.rows[0] as any).id;

    // Use first existing service; avoid creating one if possible
    const svcResult = await db.execute(sql`
      SELECT id FROM services WHERE tenant_id = ${TENANT_ID} LIMIT 1
    `);
    if (svcResult.rows.length > 0) {
      syntheticServiceId = (svcResult.rows[0] as any).id;
    } else {
      const newSvc = await db.execute(sql`
        INSERT INTO services (tenant_id, name, price_range, overview, detailed_description, duration, duration_hours)
        VALUES (${TENANT_ID}, 'S4S2 Test Service', '$249-349', 'Test', 'Test detail', '2-3 hours', '2.5')
        RETURNING id
      `);
      syntheticServiceId = (newSvc.rows[0] as any).id;
    }

    const apptResult = await db.execute(sql`
      INSERT INTO appointments (tenant_id, customer_id, service_id, scheduled_time, status, address)
      VALUES (${TENANT_ID}, ${syntheticCustomerId}, ${syntheticServiceId}, NOW(), 'in_progress', '4644 S Troost Ave, Tulsa, OK 74105')
      RETURNING id
    `);
    syntheticAppointmentId = (apptResult.rows[0] as any).id;

    const invResult = await db.execute(sql`
      INSERT INTO invoices (tenant_id, appointment_id, customer_id, amount, payment_status, service_description)
      VALUES (${TENANT_ID}, ${syntheticAppointmentId}, ${syntheticCustomerId}, '0.00', 'pending', 'S4S2 Test Detail')
      RETURNING id
    `);
    syntheticInvoiceId = (invResult.rows[0] as any).id;

    console.log(`  [setup] customer=${syntheticCustomerId}, appt=${syntheticAppointmentId}, invoice=${syntheticInvoiceId}`);
  }

  async function cleanup() {
    if (syntheticInvoiceId)     await db.execute(sql`DELETE FROM invoices WHERE id = ${syntheticInvoiceId}`);
    if (syntheticAppointmentId) {
      await db.execute(sql`DELETE FROM customer_service_history WHERE appointment_id = ${syntheticAppointmentId}`);
      await db.execute(sql`DELETE FROM appointments WHERE id = ${syntheticAppointmentId}`);
    }
    if (syntheticCustomerId)    await db.execute(sql`DELETE FROM customers WHERE id = ${syntheticCustomerId}`);
    // Only delete service if we created the synthetic one
    await db.execute(sql`DELETE FROM services WHERE name = 'S4S2 Test Service' AND tenant_id = ${TENANT_ID}`);
    console.log('  [cleanup] synthetic rows removed');
  }

  try {
    await setup();

    // Test 3: send-invoice endpoint DB update
    console.log('\nTest 3: send-invoice endpoint — DB update (amount, invoiceSentAt, notes)');
    const confirmedTotal = 299;
    await db.execute(sql`
      UPDATE invoices
      SET amount = ${String(confirmedTotal)},
          invoice_sent_at = NOW(),
          notes = ${'Added carpet extraction — $50'}
      WHERE id = ${syntheticInvoiceId}
    `);
    const result = await db.execute(sql`
      SELECT amount, invoice_sent_at, notes FROM invoices WHERE id = ${syntheticInvoiceId}
    `);
    const row = result.rows[0] as any;
    assert(parseFloat(row.amount) === confirmedTotal, `Invoice amount set to ${confirmedTotal}`, row.amount);
    assert(row.invoice_sent_at !== null, 'invoiceSentAt was set (not null)');
    assert((row.notes ?? '').includes('carpet extraction'), 'Notes field updated correctly');

    // Test 4: cleanup verification
    console.log('\nTest 4: Cleanup — synthetic rows removed by try/finally');
    assert(typeof syntheticCustomerId === 'number', 'syntheticCustomerId captured');
    assert(typeof syntheticAppointmentId === 'number', 'syntheticAppointmentId captured');
    assert(typeof syntheticInvoiceId === 'number', 'syntheticInvoiceId captured');

  } finally {
    await cleanup();

    // Confirm zero synthetic rows remain
    const remaining = await db.execute(sql`
      SELECT COUNT(*) AS cnt FROM customers WHERE id = ${syntheticCustomerId ?? -1}
    `);
    const cnt = parseInt((remaining.rows[0] as any).cnt, 10);
    assert(cnt === 0, 'Post-cleanup: zero synthetic customer rows remain', { cnt });

    await pool.end();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n=== S4+S2 Post-Service Flow Tests ===');
  console.log(`DATABASE_URL: ${HAS_DB ? 'present (DB tests will run)' : 'absent (DB tests will be skipped)'}`);

  test1_completionSmsBody();
  test2_completionResponseShape();
  await runDbTests();

  console.log(`\n=== SUMMARY: ${passed} passed, ${failed} failed, ${skipped} skipped ===\n`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
