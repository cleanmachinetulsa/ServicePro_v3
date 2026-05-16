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
export interface SendInvoiceArgs {
  /** Required: customer phone in any format */
  phone: string;
  /** Optional: target a specific appointment's invoice (DB id or Google Calendar event id) */
  appointmentId?: string | number;
  /** Optional: line items used when creating a manual invoice (NOT YET FULLY WIRED — currently surfaced for future use; today the helper picks the latest invoice for the appointment/customer). */
  line_items?: Array<{ description: string; amount_cents: number; quantity?: number }>;
  channel?: 'sms' | 'email' | 'both';
  /** Explicit override (admin path) */
  invoiceId?: number;
}

export async function sendInvoiceToCustomer(
  tenantId: string,
  args: SendInvoiceArgs,
): Promise<{ success: boolean; invoiceId?: number; appointmentId?: number; channel: string; error?: string }> {
  const channel = args.channel || 'sms';
  try {
    if (!tenantId) return { success: false, channel, error: 'Missing tenantId' };
    if (!args.phone) return { success: false, channel, error: 'phone is required' };

    const { tenantDb, customer } = await resolveCustomer(tenantId, args.phone);
    if (!customer) return { success: false, channel, error: 'Customer not found in this tenant' };

    let invoiceId = args.invoiceId;
    let resolvedAppointmentId: number | undefined;

    if (!invoiceId && args.appointmentId !== undefined && args.appointmentId !== null && args.appointmentId !== '') {
      const raw = String(args.appointmentId);
      const numeric = /^\d+$/.test(raw) ? parseInt(raw, 10) : null;

      let appt: { id: number } | undefined;
      if (numeric !== null) {
        const rows = await tenantDb
          .select({ id: appointments.id })
          .from(appointments)
          .where(and(eq(appointments.tenantId, tenantId), eq(appointments.id, numeric)))
          .limit(1);
        appt = rows[0];
      }
      if (!appt) {
        const rows = await tenantDb
          .select({ id: appointments.id })
          .from(appointments)
          .where(and(eq(appointments.tenantId, tenantId), eq(appointments.calendarEventId, raw)))
          .limit(1);
        appt = rows[0];
      }

      if (!appt) {
        return { success: false, channel, error: `Appointment ${raw} not found in this tenant` };
      }
      resolvedAppointmentId = appt.id;

      const [byAppt] = await tenantDb
        .select({ id: invoices.id })
        .from(invoices)
        .where(and(eq(invoices.tenantId, tenantId), eq(invoices.appointmentId, appt.id)))
        .orderBy(desc(invoices.createdAt))
        .limit(1);

      if (!byAppt) {
        return {
          success: false,
          channel,
          appointmentId: appt.id,
          error: 'No invoice exists for that appointment yet. Create the invoice in the dashboard first.',
        };
      }
      invoiceId = byAppt.id;
    }

    if (!invoiceId) {
      const [latest] = await tenantDb
        .select({ id: invoices.id })
        .from(invoices)
        .where(and(eq(invoices.tenantId, tenantId), eq(invoices.customerId, customer.id)))
        .orderBy(desc(invoices.createdAt))
        .limit(1);
      if (!latest) {
        // Ad-hoc invoice creation from line_items is not yet wired (see
        // followup #29 / future work). Be explicit instead of silently
        // sending the wrong invoice.
        if (args.line_items && args.line_items.length > 0) {
          return {
            success: false,
            channel,
            error: 'Ad-hoc invoice creation from line_items is not yet supported. Create the invoice in the dashboard first, then re-send.',
          };
        }
        return { success: false, channel, error: 'No invoice on file for this customer' };
      }
      invoiceId = latest.id;
    }

    if (args.line_items && args.line_items.length > 0) {
      console.warn(`${LOG} sendInvoiceToCustomer: line_items received but ad-hoc invoice creation is not implemented; sending existing invoice ${invoiceId} instead.`);
    }

    const ok = await sendInvoiceNotification(tenantDb, invoiceId, channel);
    return { success: ok, invoiceId, appointmentId: resolvedAppointmentId, channel };
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
  redeemLink?: string;
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

    // Spec: include a redemption link so the customer can apply the card at
    // checkout. Tenant base URL + standard /gift-card/redeem entry point.
    const baseUrl = await getTenantPublicBaseUrl(tenantId);
    const redeemLink = `${baseUrl}/gift-card/redeem?code=${encodeURIComponent(giftCardCode)}`;
    const body = `Your gift card ending in ${last4} has $${dollars} ${currency} remaining. Redeem it at checkout: ${redeemLink}`;

    const { tenantDb } = await resolveCustomer(tenantId, phone);
    const sms = await sendSMS(tenantDb, phone, body);
    return {
      success: true,
      balanceCents: balance,
      currency,
      redeemLink,
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
/** Spec default pause window after a handoff (Audit T2 #19). */
export const DEFAULT_TRANSFER_PAUSE_HOURS = 6;
/** High-urgency override: pause longer so a human has breathing room. */
export const HIGH_URGENCY_PAUSE_HOURS = 12;

export async function transferConversationToHuman(
  tenantId: string,
  phone: string,
  reason: string,
  urgency: 'low' | 'high' = 'low',
  conversationIdHint?: number,
  /** Optional explicit override; falls back to urgency-based default. */
  pauseHoursOverride?: number,
): Promise<{
  success: boolean;
  conversationId?: number;
  handoffMessage: string;
  customerSmsSent?: boolean;
  slackNotified?: boolean;
  pauseHours?: number;
  error?: string;
}> {
  const handoffMessage = urgency === 'high'
    ? `Got it — I'm flagging this for a teammate to jump in right now. You'll hear back shortly.`
    : `Thanks — I'll have a teammate take it from here and follow up with you soon.`;

  // Pause window: default 6h per spec. High urgency bumps to 12h. Callers can
  // override explicitly when they have product-specific needs.
  const pauseHours = pauseHoursOverride !== undefined && pauseHoursOverride > 0
    ? pauseHoursOverride
    : (urgency === 'high' ? HIGH_URGENCY_PAUSE_HOURS : DEFAULT_TRANSFER_PAUSE_HOURS);

  try {
    if (!tenantId) return { success: false, handoffMessage, pauseHours, error: 'Missing tenantId' };

    const { tenantDb } = await resolveCustomer(tenantId, phone);
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
      return { success: false, handoffMessage, pauseHours, error: 'No active conversation found to escalate' };
    }

    // 1. Flag conversation + pause automation (urgency-driven) and notify owner.
    //    `customReasonLabel` lets the real free-form reason show up in the alert
    //    instead of being collapsed to "unknown".
    const { escalateSmsToHuman } = await import('./escalationService');
    const escalation = await escalateSmsToHuman({
      tenantId,
      reason: 'unknown',
      fromPhone: normalized,
      toPhone: normalized,
      conversationId: convId,
      additionalInfo: `${urgency.toUpperCase()}: ${reason}`,
      customReasonLabel: reason,
      pauseHours,
    });

    // 2. Send the customer-facing handoff SMS so they know a human is coming.
    let customerSmsSent = false;
    try {
      const sms = await sendSMS(tenantDb, normalized, handoffMessage);
      customerSmsSent = sms.success;
    } catch (smsErr) {
      console.warn(`${LOG} transferConversationToHuman: customer SMS failed:`, smsErr);
    }

    // 3. Post a Slack alert with the conversation deep link.
    let slackNotified = false;
    try {
      const { notifySlackAudit } = await import('./slackNotifyAudit');
      await notifySlackAudit(
        `:rotating_light: Conversation handed off to human (${urgency.toUpperCase()})`,
        {
          tenantId,
          conversationId: convId,
          customerPhone: normalized,
          reason,
          pauseHours,
          link: `/messages?conversationId=${convId}`,
        },
      );
      slackNotified = true;
    } catch (slackErr) {
      console.warn(`${LOG} transferConversationToHuman: Slack notify failed:`, slackErr);
    }

    return {
      success: escalation.success || customerSmsSent,
      conversationId: convId,
      handoffMessage,
      customerSmsSent,
      slackNotified,
      pauseHours,
    };
  } catch (err: any) {
    console.error(`${LOG} transferConversationToHuman failed:`, err);
    return { success: false, handoffMessage, pauseHours, error: err?.message || 'transfer_to_human failed' };
  }
}

// ---------------------------------------------------------------------------
// weather_check_for_appointment
// ---------------------------------------------------------------------------
// Default to Tulsa coords if tenant has none — matches existing googleMapsApi
// default service area until per-tenant coords land (audit W-5 / I-7).
const DEFAULT_LAT = 36.1540;
const DEFAULT_LON = -95.9928;

export interface WeatherCheckArgs {
  /** Customer phone (fallback lookup for next upcoming appointment) */
  phone?: string;
  /** Preferred: explicit appointment id (DB id or Google Calendar event id) */
  appointmentId?: string | number;
  coords?: { latitude?: number; longitude?: number };
}

export async function weatherCheckForAppointment(
  tenantId: string,
  args: WeatherCheckArgs | string,  // backward-compat: old signature accepted phone string
  legacyPhone?: string,
  legacyCoords?: { latitude?: number; longitude?: number },
): Promise<{
  success: boolean;
  hasAppointment: boolean;
  scheduledTime?: string;
  /** Spec field: simplified risk bucket */
  risk?: 'low' | 'medium' | 'high';
  /** Spec field: short human summary suitable for SMS */
  summary?: string;
  /** Spec field: should the staff offer to reschedule? */
  suggest_reschedule?: boolean;
  /** Legacy detail fields (kept for existing callers / tests) */
  level?: 'low' | 'medium' | 'high' | 'extreme';
  severityText?: string;
  actionText?: string;
  error?: string;
}> {
  // Normalize the args (supports both new object form and old positional form).
  let phone: string | undefined;
  let appointmentId: string | number | undefined;
  let coords: { latitude?: number; longitude?: number } | undefined;
  if (typeof args === 'string') {
    phone = args || legacyPhone;
    coords = legacyCoords;
  } else if (args) {
    phone = args.phone;
    appointmentId = args.appointmentId;
    coords = args.coords;
  }

  try {
    if (!tenantId) {
      return { success: false, hasAppointment: false, error: 'Missing tenantId' };
    }

    const tenantDb = wrapTenantDb(db, tenantId);
    let appt: typeof appointments.$inferSelect | undefined;

    if (appointmentId !== undefined && appointmentId !== null && appointmentId !== '') {
      const raw = String(appointmentId);
      const numeric = /^\d+$/.test(raw) ? parseInt(raw, 10) : null;
      if (numeric !== null) {
        const rows = await tenantDb
          .select()
          .from(appointments)
          .where(and(eq(appointments.tenantId, tenantId), eq(appointments.id, numeric)))
          .limit(1);
        appt = rows[0];
      }
      if (!appt) {
        const rows = await tenantDb
          .select()
          .from(appointments)
          .where(and(eq(appointments.tenantId, tenantId), eq(appointments.calendarEventId, raw)))
          .limit(1);
        appt = rows[0];
      }
    } else if (phone) {
      const { customer } = await resolveCustomer(tenantId, phone);
      if (!customer) return { success: true, hasAppointment: false };
      const now = new Date();
      const rows = await tenantDb
        .select()
        .from(appointments)
        .where(and(
          eq(appointments.tenantId, tenantId),
          eq(appointments.customerId, customer.id),
          gte(appointments.scheduledTime, now),
        ))
        .orderBy(appointments.scheduledTime)
        .limit(1);
      appt = rows[0];
    } else {
      return { success: false, hasAppointment: false, error: 'appointmentId or phone is required' };
    }

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

    // Map detailed level -> simplified spec risk bucket.
    const riskBucket: 'low' | 'medium' | 'high' =
      risk.level === 'low' ? 'low'
      : risk.level === 'medium' ? 'medium'
      : 'high';

    const suggest_reschedule = riskBucket === 'high';
    const summary = `${risk.severityText} ${risk.actionText}`.trim();

    return {
      success: true,
      hasAppointment: true,
      scheduledTime: apptDate.toISOString(),
      risk: riskBucket,
      summary,
      suggest_reschedule,
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
