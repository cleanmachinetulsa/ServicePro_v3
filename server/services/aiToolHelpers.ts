/**
 * AI Tool Helpers — Audit T2 Task #19 (I-2 / I-3 / I-5)
 *
 * Centralizes the six new staff/AI actions:
 *   - send_invoice
 *   - send_gift_card_balance
 *   - send_rewards_link
 *   - send_referral_link
 *   - transfer_to_human
 *   - weather_check_for_appointment
 *
 * Each helper is tenant-scoped, fail-soft (never throws), and returns a
 * plain JSON-friendly result object. The same helpers back both the
 * gpt-4o tool dispatcher in `server/openai.ts` and the staff-facing
 * manual action buttons in `server/routes.aiActions.ts`.
 */

import { db } from '../db';
import { wrapTenantDb } from '../tenantDb';
import { invoices, customers, conversations } from '@shared/schema';
import { and, desc, eq } from 'drizzle-orm';
import { sendInvoiceNotification } from '../invoiceService';
import { getOrCreateReferralCode } from '../referralService';
import { validateGiftCardCode } from './giftCardSquareService';
import { generateRewardsToken } from '../routes.loyalty';
import { getTenantPublicBaseUrl } from './portRecoveryService';
import { evaluateWeatherRisk } from './weatherRisk';
import { getHourlyForecast } from '../weatherService';
import { sendSMS } from '../notifications';
import { findByPhone } from './customerRepository';
import { appointments } from '@shared/schema';
import { gte } from 'drizzle-orm';

const LOG = '[AI-TOOL-HELPER]';

function normalizePhone(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) return phone || '';
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return phone.startsWith('+') ? phone : `+${digits}`;
}

async function resolveCustomer(tenantId: string, phone: string) {
  const tenantDb = wrapTenantDb(db, tenantId);
  const normalized = normalizePhone(phone);
  let customer = await findByPhone(tenantDb, tenantId, normalized);
  if (!customer && normalized !== phone) {
    customer = await findByPhone(tenantDb, tenantId, phone);
  }
  return { tenantDb, customer, normalizedPhone: normalized };
}

// ---------------------------------------------------------------------------
// send_invoice
// ---------------------------------------------------------------------------
export async function sendInvoiceToCustomer(
  tenantId: string,
  phone: string,
  channel: 'sms' | 'email' | 'both' = 'sms',
  invoiceIdOverride?: number,
): Promise<{ success: boolean; invoiceId?: number; channel: string; error?: string }> {
  try {
    if (!tenantId) return { success: false, channel, error: 'Missing tenantId' };
    const { tenantDb, customer } = await resolveCustomer(tenantId, phone);
    if (!customer) return { success: false, channel, error: 'Customer not found in this tenant' };

    let invoiceId = invoiceIdOverride;
    if (!invoiceId) {
      const [latest] = await tenantDb
        .select({ id: invoices.id })
        .from(invoices)
        .where(and(eq(invoices.tenantId, tenantId), eq(invoices.customerId, customer.id)))
        .orderBy(desc(invoices.createdAt))
        .limit(1);
      if (!latest) return { success: false, channel, error: 'No invoice on file for this customer' };
      invoiceId = latest.id;
    }

    const ok = await sendInvoiceNotification(tenantDb, invoiceId, channel);
    return { success: ok, invoiceId, channel };
  } catch (err: any) {
    console.error(`${LOG} sendInvoiceToCustomer failed:`, err);
    return { success: false, channel, error: err?.message || 'send_invoice failed' };
  }
}

// ---------------------------------------------------------------------------
// send_gift_card_balance
// ---------------------------------------------------------------------------
export async function sendGiftCardBalance(
  tenantId: string,
  phone: string,
  giftCardCode: string,
): Promise<{
  success: boolean;
  balanceCents?: number;
  currency?: string;
  smsSent?: boolean;
  error?: string;
}> {
  try {
    if (!tenantId) return { success: false, error: 'Missing tenantId' };
    if (!giftCardCode) return { success: false, error: 'giftCardCode is required' };

    const validation = await validateGiftCardCode(tenantId, giftCardCode);
    if (!validation.valid) {
      return { success: false, error: validation.error || 'Gift card invalid' };
    }

    const balance = validation.currentBalanceCents ?? 0;
    const currency = validation.currency || 'USD';
    const dollars = (balance / 100).toFixed(2);
    const last4 = (giftCardCode || '').slice(-4);
    const body = `Your gift card ending in ${last4} has $${dollars} ${currency} remaining. Reply with any questions.`;

    const { tenantDb } = await resolveCustomer(tenantId, phone);
    const sms = await sendSMS(tenantDb, phone, body);
    return {
      success: true,
      balanceCents: balance,
      currency,
      smsSent: sms.success,
    };
  } catch (err: any) {
    console.error(`${LOG} sendGiftCardBalance failed:`, err);
    return { success: false, error: err?.message || 'send_gift_card_balance failed' };
  }
}

// ---------------------------------------------------------------------------
// send_rewards_link
// ---------------------------------------------------------------------------
export async function sendRewardsLinkToCustomer(
  tenantId: string,
  phone: string,
): Promise<{ success: boolean; link?: string; smsSent?: boolean; error?: string }> {
  try {
    if (!tenantId) return { success: false, error: 'Missing tenantId' };
    const { tenantDb, normalizedPhone } = await resolveCustomer(tenantId, phone);

    const baseUrl = await getTenantPublicBaseUrl(tenantId);
    const token = generateRewardsToken(normalizedPhone, tenantId, 30);
    const link = `${baseUrl}/rewards/welcome?token=${encodeURIComponent(token)}`;

    const body = `Here's your rewards portal — your points and perks: ${link}`;
    const sms = await sendSMS(tenantDb, normalizedPhone, body);
    return { success: true, link, smsSent: sms.success };
  } catch (err: any) {
    console.error(`${LOG} sendRewardsLinkToCustomer failed:`, err);
    return { success: false, error: err?.message || 'send_rewards_link failed' };
  }
}

// ---------------------------------------------------------------------------
// send_referral_link
// ---------------------------------------------------------------------------
export async function sendReferralLinkToCustomer(
  tenantId: string,
  phone: string,
): Promise<{ success: boolean; code?: string; link?: string; smsSent?: boolean; error?: string }> {
  try {
    if (!tenantId) return { success: false, error: 'Missing tenantId' };
    const { tenantDb, customer, normalizedPhone } = await resolveCustomer(tenantId, phone);
    if (!customer) return { success: false, error: 'Customer not found in this tenant' };

    const codeResult = await getOrCreateReferralCode(tenantDb, customer.id);
    if (!codeResult.success || !codeResult.code) {
      return { success: false, error: codeResult.message || 'Could not issue referral code' };
    }

    const baseUrl = await getTenantPublicBaseUrl(tenantId);
    const link = `${baseUrl}/refer/${encodeURIComponent(codeResult.code)}`;
    const body = `Share this referral link with friends — you both earn rewards: ${link}`;
    const sms = await sendSMS(tenantDb, normalizedPhone, body);
    return { success: true, code: codeResult.code, link, smsSent: sms.success };
  } catch (err: any) {
    console.error(`${LOG} sendReferralLinkToCustomer failed:`, err);
    return { success: false, error: err?.message || 'send_referral_link failed' };
  }
}

// ---------------------------------------------------------------------------
// transfer_to_human
// ---------------------------------------------------------------------------
export async function transferConversationToHuman(
  tenantId: string,
  phone: string,
  reason: string,
  urgency: 'low' | 'high' = 'low',
  conversationIdHint?: number,
): Promise<{
  success: boolean;
  conversationId?: number;
  handoffMessage: string;
  error?: string;
}> {
  const handoffMessage = urgency === 'high'
    ? `Got it — I'm flagging this for a teammate to jump in right now. You'll hear back shortly.`
    : `Thanks — I'll have a teammate take it from here and follow up with you soon.`;

  try {
    if (!tenantId) return { success: false, handoffMessage, error: 'Missing tenantId' };

    const tenantDb = wrapTenantDb(db, tenantId);
    const normalized = normalizePhone(phone);

    let convId = conversationIdHint;
    if (!convId) {
      const [conv] = await tenantDb
        .select({ id: conversations.id })
        .from(conversations)
        .where(and(eq(conversations.customerPhone, normalized), eq(conversations.platform, 'sms')))
        .orderBy(desc(conversations.lastMessageTime))
        .limit(1);
      convId = conv?.id;
    }

    if (!convId) {
      return { success: false, handoffMessage, error: 'No active conversation found to escalate' };
    }

    const { escalateSmsToHuman } = await import('./escalationService');
    const result = await escalateSmsToHuman({
      tenantId,
      reason: 'unknown',
      fromPhone: normalized,
      toPhone: normalized,
      conversationId: convId,
      additionalInfo: `${urgency.toUpperCase()}: ${reason}`,
    });

    return {
      success: result.success,
      conversationId: convId,
      handoffMessage,
    };
  } catch (err: any) {
    console.error(`${LOG} transferConversationToHuman failed:`, err);
    return { success: false, handoffMessage, error: err?.message || 'transfer_to_human failed' };
  }
}

// ---------------------------------------------------------------------------
// weather_check_for_appointment
// ---------------------------------------------------------------------------
// Default to Tulsa coords if tenant has none — matches existing googleMapsApi
// default service area until per-tenant coords land (audit W-5 / I-7).
const DEFAULT_LAT = 36.1540;
const DEFAULT_LON = -95.9928;

export async function weatherCheckForAppointment(
  tenantId: string,
  phone: string,
  coords?: { latitude?: number; longitude?: number },
): Promise<{
  success: boolean;
  hasAppointment: boolean;
  scheduledTime?: string;
  level?: 'low' | 'medium' | 'high' | 'extreme';
  severityText?: string;
  actionText?: string;
  error?: string;
}> {
  try {
    if (!tenantId) {
      return { success: false, hasAppointment: false, error: 'Missing tenantId' };
    }

    // Audit T2 Task #19 review fix: tenant-scoped appointment lookup.
    // Replaces the global `getExistingAppointment(phone)` call which did not
    // filter by tenant and could leak cross-tenant scheduling state.
    const { tenantDb, customer } = await resolveCustomer(tenantId, phone);
    if (!customer) return { success: true, hasAppointment: false };

    const now = new Date();
    const [appt] = await tenantDb
      .select()
      .from(appointments)
      .where(and(
        eq(appointments.tenantId, tenantId),
        eq(appointments.customerId, customer.id),
        gte(appointments.scheduledTime, now),
      ))
      .orderBy(appointments.scheduledTime)
      .limit(1);

    if (!appt) {
      return { success: true, hasAppointment: false };
    }

    const apptDate = new Date(appt.scheduledTime);
    const daysOut = Math.max(1, Math.ceil((apptDate.getTime() - Date.now()) / 86400000));
    const forecast = await getHourlyForecast(
      coords?.latitude ?? DEFAULT_LAT,
      coords?.longitude ?? DEFAULT_LON,
      Math.min(daysOut, 4),
    );

    // Pick the forecast row closest to the appointment hour (WeatherForecast
    // stores ISO date strings in `date`); fall back to first row available.
    const target = forecast.find((f) => {
      const t = new Date(f.date).getTime();
      return Math.abs(t - apptDate.getTime()) <= 60 * 60 * 1000;
    }) || forecast[0];

    const risk = evaluateWeatherRisk({
      precipitationChance: target?.chanceOfRain,
      temperatureF: target?.temperature,
      thunderstormRisk: target?.severity === 'severe',
      industryType: 'auto_detailing',
    });

    return {
      success: true,
      hasAppointment: true,
      scheduledTime: apptDate.toISOString(),
      level: risk.level,
      severityText: risk.severityText,
      actionText: risk.actionText,
    };
  } catch (err: any) {
    console.error(`${LOG} weatherCheckForAppointment failed:`, err);
    return {
      success: false,
      hasAppointment: false,
      error: err?.message || 'weather_check_for_appointment failed',
    };
  }
}
