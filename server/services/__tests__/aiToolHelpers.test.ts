/**
 * Audit T2 Task #19 — aiToolHelpers smoke tests
 *
 * These verify the fail-soft contract of the new staff/AI action helpers:
 *   - missing tenantId always returns { success: false, error } and never throws
 *   - weatherCheckForAppointment returns { hasAppointment: false } when there's
 *     no customer / no upcoming appointment, instead of throwing.
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('../../db', () => ({ db: {} }));
vi.mock('../../notifications', () => ({
  sendSMS: vi.fn(async () => ({ success: true })),
}));

import {
  sendInvoiceToCustomer,
  sendGiftCardBalance,
  sendRewardsLinkToCustomer,
  sendReferralLinkToCustomer,
  transferConversationToHuman,
  weatherCheckForAppointment,
} from '../aiToolHelpers';

describe('aiToolHelpers — missing tenant fail-soft', () => {
  it('sendInvoiceToCustomer returns error without throwing', async () => {
    const r = await sendInvoiceToCustomer('', '+15551234567');
    expect(r.success).toBe(false);
    expect(r.error).toBeTruthy();
  });

  it('sendGiftCardBalance returns error without throwing', async () => {
    const r = await sendGiftCardBalance('', '+15551234567', 'ABCD1234');
    expect(r.success).toBe(false);
    expect(r.error).toBeTruthy();
  });

  it('sendRewardsLinkToCustomer returns error without throwing', async () => {
    const r = await sendRewardsLinkToCustomer('', '+15551234567');
    expect(r.success).toBe(false);
    expect(r.error).toBeTruthy();
  });

  it('sendReferralLinkToCustomer returns error without throwing', async () => {
    const r = await sendReferralLinkToCustomer('', '+15551234567');
    expect(r.success).toBe(false);
    expect(r.error).toBeTruthy();
  });

  it('transferConversationToHuman returns error without throwing', async () => {
    const r = await transferConversationToHuman('', '+15551234567', 'test');
    expect(r.success).toBe(false);
    expect(r.error).toBeTruthy();
    expect(r.handoffMessage).toBeTruthy();
  });
});

describe('weatherCheckForAppointment', () => {
  it('returns error without throwing when tenantId is missing', async () => {
    const r = await weatherCheckForAppointment('', '+15550000000');
    expect(r.success).toBe(false);
    expect(r.hasAppointment).toBe(false);
    expect(r.error).toBeTruthy();
  });
});
