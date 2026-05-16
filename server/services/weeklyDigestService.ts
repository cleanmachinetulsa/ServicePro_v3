/**
 * Audit T3 Task #23: Weekly owner digest.
 * Aggregates last 7 days of activity per tenant and builds an HTML digest.
 */

import { db } from '../db';
import { wrapTenantDb } from '../tenantDb';
import { tenants, tenantConfig, usageRollupsDaily, appointments, conversations } from '@shared/schema';
// Audit T3 Task #23: schema uses appointments.scheduledTime and appointments.completed (boolean)
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { sendBusinessEmail } from '../emailService';

export interface WeeklyDigestStats {
  tenantId: string;
  tenantName: string;
  windowStart: Date;
  windowEnd: Date;
  appointmentsBooked: number;
  appointmentsCompleted: number;
  conversationsStarted: number;
  smsTotal: number;
  emailTotal: number;
  voiceMinutes: number;
  aiTokens: number;
  estimatedSpendUsd: number;
}

export async function buildWeeklyDigestStats(
  tenantId: string,
  tenantName: string,
  end: Date = new Date(),
): Promise<WeeklyDigestStats> {
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
  const tenantDb = wrapTenantDb(db, tenantId);

  // Usage rollups (root scoped table; query by tenantId).
  const rootDb = wrapTenantDb(db, 'root');
  const rollups = await rootDb
    .select()
    .from(usageRollupsDaily)
    .where(
      and(
        eq(usageRollupsDaily.tenantId, tenantId),
        gte(usageRollupsDaily.date, start.toISOString().slice(0, 10)),
        lte(usageRollupsDaily.date, end.toISOString().slice(0, 10)),
      ),
    );

  const smsTotal = rollups.reduce((acc, r) => acc + (r.smsTotal ?? 0) + (r.mmsTotal ?? 0), 0);
  const emailTotal = rollups.reduce((acc, r) => acc + (r.emailTotal ?? 0), 0);
  const voiceMinutes = rollups.reduce((acc, r) => acc + (r.voiceTotalMinutes ?? 0), 0);
  const aiTokens = rollups.reduce((acc, r) => acc + (r.aiTotalTokens ?? 0), 0);
  const estimatedSpendUsd = rollups.reduce((acc, r) => acc + Number(r.estimatedCostUsd ?? 0), 0);

  // Appointments — booked (created_at) and completed (status='completed').
  let appointmentsBooked = 0;
  let appointmentsCompleted = 0;
  try {
    // Schema has no createdAt — use scheduledTime in window as a proxy for "booked this week".
    const booked = await tenantDb
      .select({ c: sql<number>`count(*)::int` })
      .from(appointments)
      .where(
        and(
          eq(appointments.tenantId, tenantId),
          gte(appointments.scheduledTime, start),
          lte(appointments.scheduledTime, end),
        ),
      );
    appointmentsBooked = booked[0]?.c ?? 0;

    const completed = await tenantDb
      .select({ c: sql<number>`count(*)::int` })
      .from(appointments)
      .where(
        and(
          eq(appointments.tenantId, tenantId),
          eq(appointments.completed, true),
          gte(appointments.scheduledTime, start),
          lte(appointments.scheduledTime, end),
        ),
      );
    appointmentsCompleted = completed[0]?.c ?? 0;
  } catch (err) {
    console.warn('[WEEKLY DIGEST] appointments query failed:', err);
  }

  let conversationsStarted = 0;
  try {
    const started = await tenantDb
      .select({ c: sql<number>`count(*)::int` })
      .from(conversations)
      .where(
        and(
          eq(conversations.tenantId, tenantId),
          gte(conversations.createdAt, start),
          lte(conversations.createdAt, end),
        ),
      );
    conversationsStarted = started[0]?.c ?? 0;
  } catch (err) {
    console.warn('[WEEKLY DIGEST] conversations query failed:', err);
  }

  return {
    tenantId,
    tenantName,
    windowStart: start,
    windowEnd: end,
    appointmentsBooked,
    appointmentsCompleted,
    conversationsStarted,
    smsTotal,
    emailTotal,
    voiceMinutes,
    aiTokens,
    estimatedSpendUsd,
  };
}

export function renderWeeklyDigestHtml(stats: WeeklyDigestStats): { subject: string; html: string; text: string } {
  const subject = `${stats.tenantName} — Your week at a glance`;
  const startStr = stats.windowStart.toLocaleDateString();
  const endStr = stats.windowEnd.toLocaleDateString();
  const spend = `$${stats.estimatedSpendUsd.toFixed(2)}`;
  const text = [
    `${stats.tenantName} — weekly digest (${startStr} → ${endStr})`,
    ``,
    `Appointments booked:   ${stats.appointmentsBooked}`,
    `Appointments done:     ${stats.appointmentsCompleted}`,
    `New conversations:     ${stats.conversationsStarted}`,
    `SMS sent/received:     ${stats.smsTotal}`,
    `Emails sent:           ${stats.emailTotal}`,
    `Voice minutes:         ${stats.voiceMinutes}`,
    `AI tokens used:        ${stats.aiTokens.toLocaleString()}`,
    `Estimated spend:       ${spend}`,
    ``,
    `— ServicePro`,
  ].join('\n');
  const html = `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#111">
    <h2 style="margin:0 0 4px">Your week at a glance</h2>
    <div style="color:#666;font-size:12px;margin-bottom:16px">${startStr} → ${endStr}</div>
    <table style="width:100%;border-collapse:collapse">
      ${[
        ['Appointments booked', stats.appointmentsBooked],
        ['Appointments completed', stats.appointmentsCompleted],
        ['New conversations', stats.conversationsStarted],
        ['SMS messages', stats.smsTotal],
        ['Emails sent', stats.emailTotal],
        ['Voice minutes', stats.voiceMinutes],
        ['AI tokens', stats.aiTokens.toLocaleString()],
        ['Estimated spend', spend],
      ].map(
        ([k, v]) =>
          `<tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#666">${k}</td><td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;font-weight:600">${v}</td></tr>`,
      ).join('')}
    </table>
    <p style="color:#888;font-size:11px;margin-top:24px">You're receiving this because weekly digests are enabled for ${stats.tenantName}. Reply to opt out.</p>
  </div>`;
  return { subject, html, text };
}

export interface DigestOptInResolver {
  isOptedOut(tenantId: string): Promise<boolean>;
  ownerEmail(tenantId: string): Promise<string | null>;
}

const envOptOutSet = new Set(
  (process.env.WEEKLY_DIGEST_OPT_OUT_TENANTS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
);

export const defaultOptInResolver: DigestOptInResolver = {
  async isOptedOut(tenantId: string) {
    return envOptOutSet.has(tenantId);
  },
  async ownerEmail(tenantId: string) {
    try {
      const rootDb = wrapTenantDb(db, 'root');
      const [cfg] = await rootDb
        .select({ ownerEmail: tenantConfig.primaryContactEmail })
        .from(tenantConfig)
        .where(eq(tenantConfig.tenantId, tenantId))
        .limit(1);
      return cfg?.ownerEmail ?? null;
    } catch {
      return null;
    }
  },
};

export async function sendWeeklyDigestForTenant(
  tenantId: string,
  tenantName: string,
  resolver: DigestOptInResolver = defaultOptInResolver,
  now: Date = new Date(),
): Promise<{ sent: boolean; reason?: string; stats?: WeeklyDigestStats }> {
  if (await resolver.isOptedOut(tenantId)) {
    return { sent: false, reason: 'opted_out' };
  }
  const email = await resolver.ownerEmail(tenantId);
  if (!email) return { sent: false, reason: 'no_owner_email' };
  const stats = await buildWeeklyDigestStats(tenantId, tenantName, now);
  const { subject, html, text } = renderWeeklyDigestHtml(stats);
  const result = await sendBusinessEmail(email, subject, text, html);
  if (!result.success) {
    return { sent: false, reason: 'send_failed', stats };
  }
  return { sent: true, stats };
}

export async function runWeeklyDigestForAllTenants(now: Date = new Date()): Promise<{
  attempted: number;
  sent: number;
}> {
  const rootDb = wrapTenantDb(db, 'root');
  const rows = await rootDb.select({ id: tenants.id, name: tenants.name }).from(tenants);
  let sent = 0;
  for (const t of rows) {
    try {
      const result = await sendWeeklyDigestForTenant(t.id, t.name, defaultOptInResolver, now);
      if (result.sent) sent++;
    } catch (err) {
      console.error(`[WEEKLY DIGEST] tenant=${t.id} failed:`, err);
    }
  }
  console.log(`[WEEKLY DIGEST] attempted=${rows.length} sent=${sent}`);
  return { attempted: rows.length, sent };
}
