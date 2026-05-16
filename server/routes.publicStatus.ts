/**
 * Audit T3 Task #23: Public per-tenant /status endpoint.
 * Stripe-style: SMS uptime over last 24h, last delivery timestamp, average
 * booking lead time in hours, real 7-day weather risk from Open-Meteo, 60s
 * in-memory cache per tenant. Resolves tenants by id, subdomain, or
 * customDomain (if configured via tenantConfig.websiteUrl).
 */

import { Router, type Request, type Response } from 'express';
import { db } from './db';
import { wrapTenantDb } from './tenantDb';
import {
  tenants,
  tenantConfig,
  messages,
  appointments,
  businessSettings,
} from '@shared/schema';
import { and, eq, gte, sql } from 'drizzle-orm';

const router = Router();

interface StatusPayload {
  tenantId: string;
  tenantName: string;
  smsUptimePct: number;
  lastDeliveryAt: string | null;
  bookingLeadTimeHours: number;
  weatherRisk7d: 'unknown' | 'low' | 'medium' | 'high';
  generatedAt: string;
}

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { at: number; payload: StatusPayload }>();

function normalizeHost(input: string): string {
  return String(input || '')
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .split(':')[0]
    .trim();
}

async function loadTenantBySlugOrHost(
  slug: string,
  fullHost?: string,
): Promise<{ id: string; name: string } | null> {
  const rootDb = wrapTenantDb(db, 'root');

  // 1. Exact match on tenant id.
  const [byId] = await rootDb
    .select({ id: tenants.id, name: tenants.name })
    .from(tenants).where(eq(tenants.id, slug)).limit(1);
  if (byId) return byId;

  // 2. Exact match on subdomain.
  const [bySub] = await rootDb
    .select({ id: tenants.id, name: tenants.name })
    .from(tenants).where(eq(tenants.subdomain, slug)).limit(1);
  if (bySub) return bySub;

  // 3. Exact custom-domain match. Prefer the explicitly passed full host
  //    over the slug because the slug may have been truncated by an
  //    upstream router. We match against the normalized host portion of
  //    tenantConfig.websiteUrl using SQL string functions, not LIKE.
  const candidateHosts = Array.from(
    new Set(
      [fullHost, slug]
        .filter((s): s is string => typeof s === 'string' && s.length > 0)
        .map(normalizeHost)
        .filter(Boolean),
    ),
  );
  if (candidateHosts.length === 0) return null;

  const rows = await rootDb
    .select({
      id: tenants.id,
      name: tenants.name,
      websiteUrl: tenantConfig.websiteUrl,
    })
    .from(tenants)
    .innerJoin(tenantConfig, eq(tenants.id, tenantConfig.tenantId))
    .where(sql`${tenantConfig.websiteUrl} is not null and ${tenantConfig.websiteUrl} <> ''`);

  for (const row of rows) {
    const rowHost = normalizeHost(row.websiteUrl || '');
    if (rowHost && candidateHosts.includes(rowHost)) {
      return { id: row.id, name: row.name };
    }
  }
  return null;
}

async function computeWeatherRisk7d(tenantId: string): Promise<'unknown' | 'low' | 'medium' | 'high'> {
  try {
    const tenantDb = wrapTenantDb(db, tenantId);
    const [bs] = await tenantDb
      .select({
        lat: businessSettings.serviceAreaCenterLat,
        lng: businessSettings.serviceAreaCenterLng,
      })
      .from(businessSettings).limit(1);
    if (!bs?.lat || !bs?.lng) return 'unknown';
    const { getDailyWeatherSummary } = await import('./weatherService');
    const summary = await getDailyWeatherSummary(Number(bs.lat), Number(bs.lng), 7);
    if (!summary || !Array.isArray(summary) || summary.length === 0) return 'unknown';
    let highRiskDays = 0;
    let mediumRiskDays = 0;
    for (const day of summary) {
      const rain = Number(day.chanceOfRain ?? 0);
      if (rain >= 70) highRiskDays++;
      else if (rain >= 40) mediumRiskDays++;
    }
    if (highRiskDays >= 2) return 'high';
    if (highRiskDays >= 1 || mediumRiskDays >= 3) return 'medium';
    return 'low';
  } catch (err) {
    console.warn('[STATUS] weather risk computation failed:', err);
    return 'unknown';
  }
}

export async function buildStatusPayload(tenantId: string, tenantName: string): Promise<StatusPayload> {
  const tenantDb = wrapTenantDb(db, tenantId);
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  let smsUptimePct = 100;
  let lastDeliveryAt: string | null = null;
  try {
    const [counts] = await tenantDb
      .select({
        total: sql<number>`count(*)::int`,
        delivered: sql<number>`sum(case when ${messages.deliveryStatus} in ('delivered','read','sent') then 1 else 0 end)::int`,
        lastAt: sql<Date | null>`max(${messages.timestamp})`,
      })
      .from(messages)
      .where(and(
        eq(messages.tenantId, tenantId),
        eq(messages.sender, 'ai'),
        gte(messages.timestamp, since),
      ));
    const total = counts?.total ?? 0;
    const delivered = counts?.delivered ?? 0;
    smsUptimePct = total === 0 ? 100 : Math.round((delivered / total) * 1000) / 10;
    lastDeliveryAt = counts?.lastAt ? new Date(counts.lastAt).toISOString() : null;
  } catch (err) {
    console.warn('[STATUS] sms uptime query failed:', err);
  }

  let bookingLeadTimeHours = 0;
  try {
    const sinceBookings = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [avg] = await tenantDb
      .select({
        avgHrs: sql<number>`coalesce(avg(extract(epoch from (${appointments.scheduledTime} - now()))/3600), 0)`,
      })
      .from(appointments)
      .where(and(
        eq(appointments.tenantId, tenantId),
        gte(appointments.scheduledTime, sinceBookings),
      ));
    bookingLeadTimeHours = Math.max(0, Math.round(Number(avg?.avgHrs ?? 0) * 10) / 10);
  } catch (err) {
    console.warn('[STATUS] lead time query failed:', err);
  }

  const weatherRisk7d = await computeWeatherRisk7d(tenantId);

  return {
    tenantId,
    tenantName,
    smsUptimePct,
    lastDeliveryAt,
    bookingLeadTimeHours,
    weatherRisk7d,
    generatedAt: new Date().toISOString(),
  };
}

router.get('/:tenantSlug', async (req: Request, res: Response) => {
  try {
    const slug = String(req.params.tenantSlug || '').toLowerCase();
    if (!slug || !/^[a-z0-9.-]{1,150}$/.test(slug)) {
      return res.status(400).json({ error: 'invalid tenant slug' });
    }
    const hostQuery = typeof req.query.host === 'string' ? req.query.host : undefined;
    const cacheKey = `${slug}|${hostQuery ? normalizeHost(hostQuery) : ''}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      return res.json(cached.payload);
    }
    const tenant = await loadTenantBySlugOrHost(slug, hostQuery);
    if (!tenant) return res.status(404).json({ error: 'tenant not found' });

    // Audit T3 Task #23 (review fix): respect tenant feature flag + plan gate.
    // Public status is a premium surface; an owner who hasn't opted in must
    // not expose operational metrics. We return 404 (not 403) so an attacker
    // cannot enumerate which tenants disabled the page.
    const { db } = await import('./db');
    const { hasFeature } = await import('@shared/features');
    const rootDb2 = wrapTenantDb(db, 'root');
    const [tcfg] = await rootDb2
      .select({ industryConfig: tenantConfig.industryConfig })
      .from(tenantConfig)
      .where(eq(tenantConfig.tenantId, tenant.id))
      .limit(1);
    const [trow] = await rootDb2
      .select({ planTier: tenants.planTier })
      .from(tenants)
      .where(eq(tenants.id, tenant.id))
      .limit(1);
    const flag = (tcfg?.industryConfig as { featureFlags?: { publicStatusEnabled?: unknown } } | null)
      ?.featureFlags?.publicStatusEnabled;
    const enabled = flag === true; // default OFF — must be explicitly opted in
    const planAllowed = hasFeature({ planTier: trow?.planTier }, 'aiSmsAgent');
    if (!enabled || !planAllowed) {
      return res.status(404).json({ error: 'tenant not found' });
    }

    const payload = await buildStatusPayload(tenant.id, tenant.name);
    cache.set(cacheKey, { at: Date.now(), payload });
    res.json(payload);
  } catch (err) {
    console.error('[STATUS] error:', err);
    res.status(500).json({ error: 'status unavailable' });
  }
});

export const _statusCache = cache;
export default router;
