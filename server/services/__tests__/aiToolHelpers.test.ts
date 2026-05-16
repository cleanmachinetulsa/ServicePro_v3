/**
 * Audit T2 Task #19 — aiToolHelpers tests
 *
 * Covers fail-soft contracts, per-tool side effects (DB lookups + outbound
 * channels), and an integration-style test proving an AI-shaped invocation
 * of transfer_to_human persists state via the escalation service and fires
 * the customer SMS + Slack alert just like the staff button path.
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

// Tenant DB stub: every chained query returns whatever rows the per-test
// override says (defaults to a single row with id 999 + a future scheduledTime).
let tenantDbRows: any[] = [{ id: 999, scheduledTime: new Date(Date.now() + 86400000) }];
vi.mock('../../tenantDb', () => ({
  wrapTenantDb: () => ({
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({ limit: async () => tenantDbRows }),
          limit: async () => tenantDbRows,
        }),
      }),
    }),
  }),
}));

const findByPhoneMock = vi.fn(async () => null as any);
vi.mock('../customerRepository', () => ({
  findByPhone: (...args: any[]) => findByPhoneMock(...args),
}));

const sendInvoiceNotificationMock = vi.fn(async () => true);
vi.mock('../../invoiceService', () => ({
  sendInvoiceNotification: (...args: any[]) => sendInvoiceNotificationMock(...args),
}));

const validateGiftCardCodeMock = vi.fn(async () => ({
  valid: true,
  currentBalanceCents: 5000,
  currency: 'USD',
}));
vi.mock('../giftCardSquareService', () => ({
  validateGiftCardCode: (...args: any[]) => validateGiftCardCodeMock(...args),
}));

const getOrCreateReferralCodeMock = vi.fn(async () => ({
  success: true,
  code: 'REF-TEST-123',
}));
vi.mock('../../referralService', () => ({
  getOrCreateReferralCode: (...args: any[]) => getOrCreateReferralCodeMock(...args),
}));

vi.mock('../../routes.loyalty', () => ({
  generateRewardsToken: () => 'tok-test-abc',
}));

vi.mock('./portRecoveryService', () => ({
  getTenantPublicBaseUrl: async () => 'https://tenant.example.com',
}));
vi.mock('../portRecoveryService', () => ({
  getTenantPublicBaseUrl: async () => 'https://tenant.example.com',
}));

vi.mock('../weatherRisk', () => ({
  evaluateWeatherRisk: () => ({ level: 'low', severityText: 'Clear.', actionText: 'Should be fine.' }),
}));
vi.mock('../../weatherService', () => ({
  getHourlyForecast: async () => [{ date: new Date().toISOString(), chanceOfRain: 5, temperature: 70, severity: 'none' }],
}));

import {
  sendInvoiceToCustomer,
  sendGiftCardBalance,
  sendRewardsLinkToCustomer,
  sendReferralLinkToCustomer,
  transferConversationToHuman,
  weatherCheckForAppointment,
  DEFAULT_TRANSFER_PAUSE_HOURS,
  HIGH_URGENCY_PAUSE_HOURS,
} from '../aiToolHelpers';

beforeEach(() => {
  sendSMSMock.mockClear();
  escalateMock.mockClear();
  notifySlackMock.mockClear();
  findByPhoneMock.mockReset();
  findByPhoneMock.mockResolvedValue(null);
  sendInvoiceNotificationMock.mockClear();
  sendInvoiceNotificationMock.mockResolvedValue(true);
  validateGiftCardCodeMock.mockClear();
  validateGiftCardCodeMock.mockResolvedValue({
    valid: true,
    currentBalanceCents: 5000,
    currency: 'USD',
  } as any);
  getOrCreateReferralCodeMock.mockClear();
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

describe('sendInvoiceToCustomer — side effects', () => {
  it('sends latest invoice when customer exists and no appointment_id given', async () => {
    findByPhoneMock.mockResolvedValueOnce({ id: 42 } as any);
    const r = await sendInvoiceToCustomer('tenant-1', { phone: '+15550001111', channel: 'sms' });
    expect(r.success).toBe(true);
    expect(r.invoiceId).toBe(999);
    expect(r.channel).toBe('sms');
    expect(sendInvoiceNotificationMock).toHaveBeenCalledTimes(1);
    const [, invoiceIdArg, channelArg] = sendInvoiceNotificationMock.mock.calls[0];
    expect(invoiceIdArg).toBe(999);
    expect(channelArg).toBe('sms');
  });

  it('returns explicit error when line_items provided but no invoice exists (ad-hoc creation not supported yet)', async () => {
    findByPhoneMock.mockResolvedValueOnce({ id: 42 } as any);
    const prev = tenantDbRows;
    tenantDbRows = [];
    try {
      const r = await sendInvoiceToCustomer('tenant-1', {
        phone: '+15550001111',
        line_items: [{ description: 'Detail', amount_cents: 12000 }],
      });
      expect(r.success).toBe(false);
      expect(r.error).toMatch(/ad-hoc/i);
    } finally {
      tenantDbRows = prev;
    }
  });
});

describe('sendGiftCardBalance — side effects', () => {
  it('texts the customer balance AND a redemption link', async () => {
    const r = await sendGiftCardBalance('tenant-1', '+15550001111', 'GIFT-7890');
    expect(r.success).toBe(true);
    expect(r.balanceCents).toBe(5000);
    expect(r.redeemLink).toContain('/gift-card/redeem');
    expect(r.redeemLink).toContain('GIFT-7890');

    expect(sendSMSMock).toHaveBeenCalledTimes(1);
    const body = sendSMSMock.mock.calls[0][2] as string;
    expect(body).toMatch(/\$50\.00/);
    expect(body).toContain('/gift-card/redeem');
    expect(body).toMatch(/7890/);
  });

  it('returns error result when gift card validation fails', async () => {
    validateGiftCardCodeMock.mockResolvedValueOnce({ valid: false, error: 'Card not found' } as any);
    const r = await sendGiftCardBalance('tenant-1', '+15550001111', 'BADCODE');
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/not found/i);
    expect(sendSMSMock).not.toHaveBeenCalled();
  });
});

describe('sendRewardsLinkToCustomer — side effects', () => {
  it('texts the customer a tokenized rewards link', async () => {
    const r = await sendRewardsLinkToCustomer('tenant-1', '+15550001111');
    expect(r.success).toBe(true);
    expect(r.link).toContain('/rewards/welcome?token=');
    expect(sendSMSMock).toHaveBeenCalledTimes(1);
    const body = sendSMSMock.mock.calls[0][2] as string;
    expect(body).toContain('/rewards/welcome');
  });
});

describe('sendReferralLinkToCustomer — side effects', () => {
  it('issues a referral code, texts the customer their share link', async () => {
    findByPhoneMock.mockResolvedValueOnce({ id: 42 } as any);
    const r = await sendReferralLinkToCustomer('tenant-1', '+15550001111');
    expect(r.success).toBe(true);
    expect(r.code).toBe('REF-TEST-123');
    expect(r.link).toContain('/refer/REF-TEST-123');
    expect(getOrCreateReferralCodeMock).toHaveBeenCalledTimes(1);
    expect(sendSMSMock).toHaveBeenCalledTimes(1);
    const body = sendSMSMock.mock.calls[0][2] as string;
    expect(body).toContain('/refer/REF-TEST-123');
  });

  it('returns error when customer is not found', async () => {
    findByPhoneMock.mockResolvedValue(null);
    const r = await sendReferralLinkToCustomer('tenant-1', '+15550009999');
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/not found/i);
    expect(sendSMSMock).not.toHaveBeenCalled();
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

  it('returns spec fields {risk, summary, suggest_reschedule} when an appointment is found', async () => {
    const r = await weatherCheckForAppointment('tenant-1', { appointmentId: 999 });
    expect(r.success).toBe(true);
    expect(r.hasAppointment).toBe(true);
    expect(['low', 'medium', 'high']).toContain(r.risk);
    expect(typeof r.summary).toBe('string');
    expect(typeof r.suggest_reschedule).toBe('boolean');
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
    expect(r.pauseHours).toBe(HIGH_URGENCY_PAUSE_HOURS);
    expect(HIGH_URGENCY_PAUSE_HOURS).toBe(12);
    expect(r.customerSmsSent).toBe(true);
    expect(r.slackNotified).toBe(true);

    expect(escalateMock).toHaveBeenCalledTimes(1);
    const escCall = escalateMock.mock.calls[0][0];
    expect(escCall.tenantId).toBe('tenant-1');
    expect(escCall.conversationId).toBe(42);
    expect(escCall.pauseHours).toBe(12);
    expect(escCall.customReasonLabel).toBe('customer asked for manager');

    expect(sendSMSMock).toHaveBeenCalledTimes(1);
    const smsBody = sendSMSMock.mock.calls[0][2] as string;
    expect(smsBody.length).toBeGreaterThan(0);

    expect(notifySlackMock).toHaveBeenCalledTimes(1);
    const slackCtx = notifySlackMock.mock.calls[0][1] as Record<string, any>;
    expect(slackCtx.tenantId).toBe('tenant-1');
    expect(slackCtx.conversationId).toBe(42);
    expect(slackCtx.pauseHours).toBe(12);
    expect(slackCtx.link).toContain('/messages?conversationId=42');
  });

  it('low urgency: uses the 6h default pause window per spec', async () => {
    const r = await transferConversationToHuman(
      'tenant-1',
      '+15551112222',
      'general question',
      'low',
      7,
    );
    expect(DEFAULT_TRANSFER_PAUSE_HOURS).toBe(6);
    expect(r.pauseHours).toBe(6);
    expect(escalateMock.mock.calls[0][0].pauseHours).toBe(6);
  });

  it('honors explicit pauseHoursOverride from caller', async () => {
    const r = await transferConversationToHuman(
      'tenant-1',
      '+15551112222',
      'manual override',
      'low',
      11,
      24,
    );
    expect(r.pauseHours).toBe(24);
    expect(escalateMock.mock.calls[0][0].pauseHours).toBe(24);
  });
});

describe('transferConversationToHuman — tenant scoping', () => {
  it('only escalates the conversation returned by the tenant-scoped lookup (no cross-tenant resolution)', async () => {
    // The shared tenantDb mock returns whatever tenantDbRows says. Simulating
    // "the tenant-scoped lookup found conversation 555 belonging to tenant-A"
    // by setting that row here; the helper must then pass tenant-A through to
    // escalateSmsToHuman with that conversationId.
    const prev = tenantDbRows;
    tenantDbRows = [{ id: 555, scheduledTime: new Date() }];
    try {
      await transferConversationToHuman(
        'tenant-A',
        '+15557770000',
        'cross-tenant check',
        'low',
        // no conversationIdHint -> forces the lookup path
      );
      expect(escalateMock).toHaveBeenCalledTimes(1);
      expect(escalateMock.mock.calls[0][0].tenantId).toBe('tenant-A');
      expect(escalateMock.mock.calls[0][0].conversationId).toBe(555);
    } finally {
      tenantDbRows = prev;
    }
  });

  it('source code asserts a tenantId equality predicate in the conversation lookup query', async () => {
    // Belt-and-suspenders regression: read the helper source and verify the
    // tenantId filter is present in the where(...) clause for the conversation
    // lookup. This protects against accidental removal of the scope filter.
    const fs = await import('node:fs/promises');
    const src = await fs.readFile(
      new URL('../aiToolHelpers.ts', import.meta.url),
      'utf8',
    );
    expect(src).toMatch(/eq\(conversations\.tenantId,\s*tenantId\)/);
  });
});

describe('AI-invoked transfer_to_human — integration', () => {
  it('exercises the same persisted-state + notification path the openai dispatcher uses', async () => {
    // Mirror the exact shape the openai dispatcher passes through.
    const dispatcherArgs = {
      phone: '+15553334444',
      reason: 'damaged trim during wash',
      urgency: 'high' as const,
    };
    const result = await transferConversationToHuman(
      'tenant-ai-1',
      dispatcherArgs.phone,
      dispatcherArgs.reason,
      dispatcherArgs.urgency,
      77,
    );

    // The AI path must produce identical observable effects to the staff path:
    expect(result.success).toBe(true);
    expect(result.conversationId).toBe(77);

    // Escalation persisted with the real reason and proper pause window.
    expect(escalateMock).toHaveBeenCalledTimes(1);
    const esc = escalateMock.mock.calls[0][0];
    expect(esc.tenantId).toBe('tenant-ai-1');
    expect(esc.conversationId).toBe(77);
    expect(esc.customReasonLabel).toBe('damaged trim during wash');
    expect(esc.pauseHours).toBe(12);

    // Customer notified.
    expect(sendSMSMock).toHaveBeenCalled();

    // Slack alert posted with deep link.
    expect(notifySlackMock).toHaveBeenCalledTimes(1);
    const ctx = notifySlackMock.mock.calls[0][1] as Record<string, any>;
    expect(ctx.link).toContain('/messages?conversationId=77');
    expect(ctx.reason).toBe('damaged trim during wash');
  });
});
