/**
 * Audit T3 Task #23: Weekly digest cron.
 * Runs hourly; only fires once on Monday between 08:00 and 08:59 tenant time
 * (currently the platform timezone). Gated by PLATFORM_BG_JOBS_ENABLED=1.
 */

import { runWeeklyDigestForAllTenants } from './weeklyDigestService';

const HOUR_MS = 60 * 60 * 1000;
let timer: NodeJS.Timeout | null = null;
let lastRunDate: string | null = null;

function shouldRunNow(now: Date = new Date()): boolean {
  // Use America/Chicago as platform default (matches replit.md timezone system).
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    weekday: 'short',
    hour: 'numeric',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = fmt.formatToParts(now);
  const weekday = parts.find((p) => p.type === 'weekday')?.value;
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? -1);
  const dateKey = `${parts.find((p) => p.type === 'year')?.value}-${parts.find((p) => p.type === 'month')?.value}-${parts.find((p) => p.type === 'day')?.value}`;
  if (weekday !== 'Mon') return false;
  if (hour !== 8) return false;
  if (lastRunDate === dateKey) return false;
  lastRunDate = dateKey;
  return true;
}

async function tick() {
  try {
    if (!shouldRunNow()) return;
    console.log('[WEEKLY DIGEST CRON] firing run');
    await runWeeklyDigestForAllTenants();
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
  console.log('[WEEKLY DIGEST CRON] starting; hourly check, fires Mondays 8am America/Chicago');
  timer = setInterval(() => void tick(), HOUR_MS);
  // Kick once on boot in case we missed the window minutes ago.
  void tick();
}

export function stopWeeklyDigestCron(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

// Test seam
export const _internals = { shouldRunNow };
