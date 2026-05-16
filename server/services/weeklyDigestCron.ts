/**
 * Audit T3 Task #23: Weekly digest cron.
 * Runs hourly; per-tenant timezone aware. The platform background loop iterates
 * every tenant and fires the digest for each tenant whose LOCAL time is
 * Monday 08:xx. Gated by PLATFORM_BG_JOBS_ENABLED=1. De-dupes per tenant per
 * local date so a tenant can't be re-emailed within the same Monday.
 */

import {
  isMondayMorningInTimezone,
  sendWeeklyDigestForTenant,
  defaultOptInResolver,
} from './weeklyDigestService';
import { db } from '../db';
import { wrapTenantDb } from '../tenantDb';
import { tenants } from '@shared/schema';

const HOUR_MS = 60 * 60 * 1000;
let timer: NodeJS.Timeout | null = null;
const lastRunByTenant: Map<string, string> = new Map();

function localDateKey(timezone: string, now: Date): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(now); // YYYY-MM-DD
}

async function tick(now: Date = new Date()): Promise<void> {
  try {
    const rootDb = wrapTenantDb(db, 'root');
    const rows = await rootDb
      .select({ id: tenants.id, name: tenants.name })
      .from(tenants);
    for (const t of rows) {
      try {
        const tz = await defaultOptInResolver.tenantTimezone(t.id);
        if (!isMondayMorningInTimezone(tz, now)) continue;
        const key = `${t.id}|${localDateKey(tz, now)}`;
        if (lastRunByTenant.get(t.id) === key) continue;
        lastRunByTenant.set(t.id, key);
        console.log(`[WEEKLY DIGEST CRON] firing tenant=${t.id} tz=${tz}`);
        await sendWeeklyDigestForTenant(t.id, t.name, defaultOptInResolver, now);
      } catch (err) {
        console.error(`[WEEKLY DIGEST CRON] tenant=${t.id} error:`, err);
      }
    }
  } catch (err) {
    console.error('[WEEKLY DIGEST CRON] tick error:', err);
  }
}

export function startWeeklyDigestCron(): void {
  if (process.env.PLATFORM_BG_JOBS_ENABLED !== '1') {
    console.log('[WEEKLY DIGEST CRON] PLATFORM_BG_JOBS_ENABLED!=1 — not starting');
    return;
  }
  if (timer) return;
  console.log('[WEEKLY DIGEST CRON] starting; hourly per-tenant tz check');
  timer = setInterval(() => void tick(), HOUR_MS);
  void tick();
}

export function stopWeeklyDigestCron(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

export const _internals = { tick, lastRunByTenant, isMondayMorningInTimezone };
