/**
 * SMS Smoke Test - Non-destructive verification of SMS booking infrastructure
 * Run with: npm run smoke:sms
 * 
 * Checks:
 * - DB connectivity & dedup table
 * - Module imports (no syntax errors)
 * - truncateSmsResponse function
 * - bookingDraftService state logic
 */

import { db } from '../server/db.js';
import { smsInboundDedup } from '../shared/schema.js';

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<void> | void): Promise<void> {
  try {
    const result = fn();
    if (result instanceof Promise) {
      await result;
      results.push({ name, passed: true, message: 'PASS' });
      console.log(`✓ ${name}: PASS`);
    } else {
      results.push({ name, passed: true, message: 'PASS' });
      console.log(`✓ ${name}: PASS`);
    }
  } catch (err) {
    results.push({ name, passed: false, message: String(err) });
    console.error(`✗ ${name}: FAIL - ${String(err)}`);
  }
}

// Run all tests
(async () => {
  console.log('\n🔍 SMS Booking Smoke Test\n');

  // Test 1: DB connectivity
  await test('DB Connectivity', async () => {
    const result = await db.query.users.findFirst({ limit: 1 });
    if (!result) {
      throw new Error('No users found - database accessible but possibly empty');
    }
  });

  // Test 2: Dedup table exists
  await test('SMS Dedup Table Exists', async () => {
    const rows = await db.select().from(smsInboundDedup).limit(1);
    if (!Array.isArray(rows)) {
      throw new Error('sms_inbound_dedup table not accessible');
    }
  });

  // Test 3: Import SMS handler modules
  await test('SMS Handler Modules Import', async () => {
    const mod1 = await import('../server/routes/twilioTestSms.js');
    const mod2 = await import('../server/services/bookingDraftService.js');
    if (!mod1 || !mod2) {
      throw new Error('Failed to import required modules');
    }
  });

  // Test 4: truncateSmsResponse function
  await test('truncateSmsResponse Function', async () => {
    const { truncateSmsResponse } = await import('../server/utils/smsLength.js');
    if (typeof truncateSmsResponse !== 'function') {
      throw new Error('truncateSmsResponse not exported as function');
    }
    
    // Test: 600-char string → <=300 chars
    const longStr = 'a'.repeat(600);
    const result = truncateSmsResponse(longStr);
    if (result.length > 300) {
      throw new Error(`Expected <=300 chars, got ${result.length}`);
    }
    if (result.length === 0) {
      throw new Error('Result is empty after truncation');
    }
  });

  // Test 5: bookingDraftService state logic
  await test('bookingDraftService State Logic', async () => {
    const { detectSlotSelection } = await import('../server/services/bookingDraftService.js');
    if (typeof detectSlotSelection !== 'function') {
      throw new Error('detectSlotSelection not exported as function');
    }
    
    // Test: detect slot with dummy state
    const dummyState = {
      lastOfferedSlots: [
        { label: 'Dec 15, 2:30 PM', iso: '2025-12-15T14:30:00Z' },
        { label: 'Dec 16, 9:00 AM', iso: '2025-12-16T09:00:00Z' },
      ],
    };
    const result = detectSlotSelection('I want the first one', dummyState);
    if (!result) {
      throw new Error('Failed to detect "first one" slot selection');
    }
  });

  // Test 6: SMS booking record service
  await test('SMS Booking Record Service', async () => {
    const { createSmsBookingRecord } = await import('../server/services/smsBookingRecordService.js');
    if (typeof createSmsBookingRecord !== 'function') {
      throw new Error('createSmsBookingRecord not exported as function');
    }
  });

  // Summary
  console.log('\n' + '='.repeat(50));
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(50) + '\n');

  if (failed > 0) {
    console.log('FAILED TESTS:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.message}`);
    });
    process.exit(1);
  } else {
    console.log('✅ All smoke tests passed!');
    process.exit(0);
  }
})();
