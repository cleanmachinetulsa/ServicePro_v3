/**
 * Audit T2 Task #19 — aiToolHelpers smoke tests
 *
 * These verify the fail-soft contract of the new staff/AI action helpers:
 *   - missing tenantId always returns { success: false, error } and never throws
 *   - weatherCheckForAppointment returns { hasAppointment: false } when there's
 *     no customer / no upcoming appointment, instead of throwing.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db', () => ({ db: {} }));

const sendSMSMock = vi.fn(async () => ({ success: true }));
vi.mock('../../notifications', () => ({
  sendSMS: (...args: any[]) => sendSMSMock(...args),
}));

const escalateMock = vi.fn(async () => ({
  success: true,
  ownerNotified: true,
  conversationFlagged: true,
}));
vi.mock('../escalationService', () => ({
  escalateSmsToHuman: (...args: any[]) => escalateMock(...args),
}));

const notifySlackMock = vi.fn(async () => undefined);
vi.mock('../slackNotifyAudit', () => ({
  notifySlackAudit: (...args: any[]) => notifySlackMock(...args),
}));

vi.mock('../../tenantDb', () => ({
  wrapTenantDb: () => ({
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({ limit: async () => [{ id: 999 }] }),
          limit: async () => [{ id: 999 }],
        }),
      }),
    }),
  }),
}));

vi.mock('../customerRepository', () => ({
  findByPhone: vi.fn(async () => null),
}));

import {
  sendInvoiceToCustomer,
  sendGiftCardBalance,
  sendRewardsLinkToCustomer,
  sendReferralLinkToCustomer,
  transferConversationToHuman,
  weatherCheckForAppointment,
} from '../aiToolHelpers';

beforeEach(() => {
  sendSMSMock.mockClear();
  escalateMock.mockClear();
  notifySlackMock.mockClear();
});

describe('aiToolHelpers — missing tenant fail-soft', () => {
  it('sendInvoiceToCustomer returns error without throwing', async () => {
    const r = await sendInvoiceToCustomer('', { phone: '+15551234567' });
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

  it('returns error when neither appointmentId nor phone are provided', async () => {
    const r = await weatherCheckForAppointment('tenant-1', {});
    expect(r.success).toBe(false);
    expect(r.hasAppointment).toBe(false);
    expect(r.error).toMatch(/required/i);
  });
});

describe('transferConversationToHuman — side effects', () => {
  it('high urgency: pauses 12h, escalates with custom reason label, sends customer SMS, posts Slack alert', async () => {
    const r = await transferConversationToHuman(
      'tenant-1',
      '+15551112222',
      'customer asked for manager',
      'high',
      42,
    );

    expect(r.success).toBe(true);
    expect(r.conversationId).toBe(42);
    expect(r.pauseHours).toBe(12);
    expect(r.customerSmsSent).toBe(true);
    expect(r.slackNotified).toBe(true);

    // escalation call carries the real reason + 12h pause, not "unknown"
    expect(escalateMock).toHaveBeenCalledTimes(1);
    const escCall = escalateMock.mock.calls[0][0];
    expect(escCall.tenantId).toBe('tenant-1');
    expect(escCall.conversationId).toBe(42);
    expect(escCall.pauseHours).toBe(12);
    expect(escCall.customReasonLabel).toBe('customer asked for manager');

    // customer-facing handoff SMS goes out
    expect(sendSMSMock).toHaveBeenCalledTimes(1);
    const smsBody = sendSMSMock.mock.calls[0][2] as string;
    expect(smsBody.length).toBeGreaterThan(0);

    // Slack alert includes the conversation deep link + tenant context
    expect(notifySlackMock).toHaveBeenCalledTimes(1);
    const slackCtx = notifySlackMock.mock.calls[0][1] as Record<string, any>;
    expect(slackCtx.tenantId).toBe('tenant-1');
    expect(slackCtx.conversationId).toBe(42);
    expect(slackCtx.pauseHours).toBe(12);
    expect(slackCtx.link).toContain('/messages?conversationId=42');
  });

  it('low urgency: pauses 2h instead of 12h', async () => {
    const r = await transferConversationToHuman(
      'tenant-1',
      '+15551112222',
      'general question',
      'low',
      7,
    );
    expect(r.pauseHours).toBe(2);
    expect(escalateMock.mock.calls[0][0].pauseHours).toBe(2);
  });
});
