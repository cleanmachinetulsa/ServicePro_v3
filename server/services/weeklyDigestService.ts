/**
 * Audit T3 Task #23: Weekly owner digest.
 * Aggregates last 7 days of activity per tenant and builds an HTML digest.
 *
 * Business metrics included:
 *  - Messages handled (SMS + MMS in usage rollups)
 *  - Bookings created (appointments in window)
 *  - Bookings completed
 *  - Escalations (conversations flagged needsHumanAttention in window)
 *  - Money collected (sum of completed appointments' totalPrice)
 *  - Hours saved (estimated from messages handled at 1.5min each)
 *  - New conversations
 *  - Emails sent / voice minutes / AI tokens / estimated platform spend
 *
 * Opt-out: stored on tenantConfig.industryConfig.featureFlags.weeklyDigestOptIn
 * (true = opted out). Also respects WEEKLY_DIGEST_OPT_OUT_TENANTS env CSV.
 *
 * Plan gating: requires aiSmsAgent feature (Pro/Elite/Internal). Free/starter
 * tenants are skipped because the digest depends on AI-handled volume that
 * those plans don't have.
 */

import { db } from '../db';
import { wrapTenantDb } from '../tenantDb';
import {
  tenants,
  tenantConfig,
  usageRollupsDaily,
  appointments,
  conversations,
} from '@shared/schema';
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { sendBusinessEmail } from '../emailService';
import { hasFeature } from '@shared/features';

export interface WeeklyDigestStats {
  tenantId: string;
  tenantName: string;
  windowStart: Date;
  windowEnd: Date;
  appointmentsBooked: number;
  appointmentsCompleted: number;
  conversationsStarted: number;
  escalations: number;
  messagesHandled: number;
  moneyCollectedUsd: number;
  hoursSaved: number;
  emailTotal: number;
  voiceMinutes: number;
  aiTokens: number;
  estimatedSpendUsd: number;
  topIntents: Array<{ intent: string; count: number }>;
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

  const messagesHandled = rollups.reduce(
    (acc, r) => acc + (r.smsTotal ?? 0) + (r.mmsTotal ?? 0),
    0,
  );
  const emailTotal = rollups.reduce((acc, r) => acc + (r.emailTotal ?? 0), 0);
  const voiceMinutes = rollups.reduce(
    (acc, r) => acc + (r.voiceTotalMinutes ?? 0),
    0,
  );
  const aiTokens = rollups.reduce(
    (acc, r) => acc + (r.aiTotalTokens ?? 0),
    0,
  );
  const estimatedSpendUsd = rollups.reduce(
    (acc, r) => acc + Number(r.estimatedCostUsd ?? 0),
    0,
  );
  // Hours saved = ~1.5 min per AI-handled message (avg owner reply time).
  const hoursSaved = Math.round(((messagesHandled * 1.5) / 60) * 10) / 10;

  let appointmentsBooked = 0;
  let appointmentsCompleted = 0;
  let moneyCollectedUsd = 0;
  try {
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
      .select({
        c: sql<number>`count(*)::int`,
        // finalTotalCents preferred; fall back to estimatedPrice (dollars).
        revenueCents: sql<number>`coalesce(sum(coalesce(${appointments.finalTotalCents}, (${appointments.estimatedPrice} * 100)::int, 0)), 0)::int`,
      })
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
    moneyCollectedUsd = Math.round(Number(completed[0]?.revenueCents ?? 0)) / 100;
  } catch (err) {
    console.warn('[WEEKLY DIGEST] appointments query failed:', err);
  }

  let conversationsStarted = 0;
  let escalations = 0;
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

    const esc = await tenantDb
      .select({ c: sql<number>`count(*)::int` })
      .from(conversations)
      .where(
        and(
          eq(conversations.tenantId, tenantId),
          eq(conversations.needsHumanAttention, true),
          gte(conversations.lastMessageTime, start),
          lte(conversations.lastMessageTime, end),
        ),
      );
    escalations = esc[0]?.c ?? 0;
  } catch (err) {
    console.warn('[WEEKLY DIGEST] conversations query failed:', err);
  }

  // Audit T3 Task #23 (review fix): top intents over the digest window.
  // Aggregates conversations.intent for threads with activity in the last 7
  // days so owners can see what customers are actually asking about.
  let topIntents: Array<{ intent: string; count: number }> = [];
  try {
    const rows = await tenantDb
      .select({
        intent: conversations.intent,
        c: sql<number>`count(*)::int`,
      })
      .from(conversations)
      .where(
        and(
          eq(conversations.tenantId, tenantId),
          gte(conversations.lastMessageTime, start),
          lte(conversations.lastMessageTime, end),
        ),
      )
      .groupBy(conversations.intent)
      .orderBy(sql`count(*) desc`)
      .limit(5);
    topIntents = rows
      .map((r) => ({ intent: String(r.intent || 'Unknown'), count: Number(r.c || 0) }))
      .filter((r) => r.count > 0);
  } catch (err) {
    console.warn('[WEEKLY DIGEST] top-intents query failed:', err);
  }

  return {
    tenantId,
    tenantName,
    windowStart: start,
    windowEnd: end,
    appointmentsBooked,
    appointmentsCompleted,
    conversationsStarted,
    escalations,
    messagesHandled,
    moneyCollectedUsd,
    hoursSaved,
    emailTotal,
    voiceMinutes,
    aiTokens,
    estimatedSpendUsd,
    topIntents,
  };
}

export function renderWeeklyDigestHtml(stats: WeeklyDigestStats): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `${stats.tenantName} — Your week at a glance`;
  const startStr = stats.windowStart.toLocaleDateString();
  const endStr = stats.windowEnd.toLocaleDateString();
  const money = `$${stats.moneyCollectedUsd.toFixed(2)}`;
  const spend = `$${stats.estimatedSpendUsd.toFixed(2)}`;
  const rows: Array<[string, string | number]> = [
    ['Messages handled', stats.messagesHandled],
    ['Bookings created', stats.appointmentsBooked],
    ['Bookings completed', stats.appointmentsCompleted],
    ['Escalations to you', stats.escalations],
    ['Money collected', money],
    ['Hours saved (est.)', stats.hoursSaved],
    ['New conversations', stats.conversationsStarted],
    ['Emails sent', stats.emailTotal],
    ['Voice minutes', stats.voiceMinutes],
    ['AI tokens used', stats.aiTokens.toLocaleString()],
    ['Estimated platform spend', spend],
  ];
  const intents = stats.topIntents || [];
  const intentLines = intents.length
    ? intents.map((i) => `  • ${i.intent} (${i.count})`)
    : ['  • (no intents this week)'];
  const text = [
    `${stats.tenantName} — weekly digest (${startStr} → ${endStr})`,
    '',
    ...rows.map(([k, v]) => `${k.padEnd(28)} ${v}`),
    '',
    'Top intents this week:',
    ...intentLines,
    '',
    `Manage digest: tenantConfig.industryConfig.featureFlags.weeklyDigestOptIn=true to opt out.`,
    '— ServicePro',
  ].join('\n');
  const html = `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#111">
    <h2 style="margin:0 0 4px">Your week at a glance</h2>
    <div style="color:#666;font-size:12px;margin-bottom:16px">${startStr} → ${endStr}</div>
    <table style="width:100%;border-collapse:collapse">
      ${rows
        .map(
          ([k, v]) =>
            `<tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#666">${k}</td><td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;font-weight:600">${v}</td></tr>`,
        )
        .join('')}
    </table>
    <h3 style="margin:24px 0 8px;font-size:14px">Top intents this week</h3>
    <ul style="margin:0;padding-left:18px;color:#333">
      ${
        intents.length
          ? intents
              .map(
                (i) =>
                  `<li style="padding:2px 0"><span>${i.intent}</span> <span style="color:#888">(${i.count})</span></li>`,
              )
              .join('')
          : '<li style="padding:2px 0;color:#888">No intents recorded this week</li>'
      }
    </ul>
    <p style="color:#888;font-size:11px;margin-top:24px">
      You're receiving this because weekly digests are enabled for ${stats.tenantName}.
      Set <code>weeklyDigestOptIn=true</code> in your business settings to stop these emails.
    </p>
  </div>`;
  return { subject, html, text };
}

export interface DigestOptInResolver {
  isOptedOut(tenantId: string): Promise<boolean>;
  ownerEmail(tenantId: string): Promise<string | null>;
  tenantTimezone(tenantId: string): Promise<string>;
  planTier(tenantId: string): Promise<string>;
}

const envOptOutSet = new Set(
  (process.env.WEEKLY_DIGEST_OPT_OUT_TENANTS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
);

export const defaultOptInResolver: DigestOptInResolver = {
  async isOptedOut(tenantId: string) {
    if (envOptOutSet.has(tenantId)) return true;
    try {
      const rootDb = wrapTenantDb(db, 'root');
      const [cfg] = await rootDb
        .select({ industryConfig: tenantConfig.industryConfig })
        .from(tenantConfig)
        .where(eq(tenantConfig.tenantId, tenantId))
        .limit(1);
      const flag = (cfg?.industryConfig as any)?.featureFlags?.weeklyDigestOptIn;
      return flag === true;
    } catch {
      return false;
    }
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
  async tenantTimezone(tenantId: string) {
    try {
      const tenantDb = wrapTenantDb(db, tenantId);
      const { businessSettings } = await import('@shared/schema');
      const [row] = await tenantDb
        .select({ tz: businessSettings.timezone })
        .from(businessSettings)
        .limit(1);
      return row?.tz || 'America/Chicago';
    } catch {
      return 'America/Chicago';
    }
  },
  async planTier(tenantId: string) {
    try {
      const rootDb = wrapTenantDb(db, 'root');
      const [t] = await rootDb
        .select({ tier: tenants.planTier })
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);
      return t?.tier || 'starter';
    } catch {
      return 'starter';
    }
  },
};

export async function sendWeeklyDigestForTenant(
  tenantId: string,
  tenantName: string,
  resolver: DigestOptInResolver = defaultOptInResolver,
  now: Date = new Date(),
): Promise<{ sent: boolean; reason?: string; stats?: WeeklyDigestStats }> {
  const planTier = await resolver.planTier(tenantId);
  if (!hasFeature({ planTier }, 'aiSmsAgent')) {
    return { sent: false, reason: 'plan_gated' };
  }
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

/**
 * Helper used by the cron: checks if "now" is Monday 08:xx in the tenant's
 * business timezone. The cron iterates tenants and only fires for those whose
 * local time matches the window.
 */
export function isMondayMorningInTimezone(timezone: string, now: Date = new Date()): boolean {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
      hour: 'numeric',
      hour12: false,
    });
    const parts = fmt.formatToParts(now);
    const weekday = parts.find((p) => p.type === 'weekday')?.value;
    const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? -1);
    return weekday === 'Mon' && hour === 8;
  } catch {
    return false;
  }
}

export async function runWeeklyDigestForAllTenants(
  now: Date = new Date(),
  options: { respectTenantTimezone?: boolean } = {},
): Promise<{ attempted: number; sent: number; skipped: number }> {
  const rootDb = wrapTenantDb(db, 'root');
  const rows = await rootDb
    .select({ id: tenants.id, name: tenants.name })
    .from(tenants);
  let sent = 0;
  let skipped = 0;
  let attempted = 0;
  for (const t of rows) {
    try {
      if (options.respectTenantTimezone) {
        const tz = await defaultOptInResolver.tenantTimezone(t.id);
        if (!isMondayMorningInTimezone(tz, now)) {
          skipped++;
          continue;
        }
      }
      attempted++;
      const result = await sendWeeklyDigestForTenant(
        t.id,
        t.name,
        defaultOptInResolver,
        now,
      );
      if (result.sent) sent++;
    } catch (err) {
      console.error(`[WEEKLY DIGEST] tenant=${t.id} failed:`, err);
    }
  }
  console.log(
    `[WEEKLY DIGEST] attempted=${attempted} sent=${sent} skipped=${skipped}`,
  );
  return { attempted, sent, skipped };
}
