/**
 * Audit T3 Task #23: Public per-tenant /status endpoint.
 * Stripe-style: SMS uptime over last 24h, last delivery timestamp, average
 * booking lead time in hours, 7-day weather risk placeholder. 60s in-memory
 * cache per tenant.
 */

import { Router, type Request, type Response } from 'express';
import { db } from './db';
import { wrapTenantDb } from './tenantDb';
import { tenants, messages, appointments } from '@shared/schema';
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

async function loadTenantBySlug(slug: string): Promise<{ id: string; name: string } | null> {
  const rootDb = wrapTenantDb(db, 'root');
  const [byId] = await rootDb.select({ id: tenants.id, name: tenants.name })
    .from(tenants).where(eq(tenants.id, slug)).limit(1);
  if (byId) return byId;
  const [bySub] = await rootDb.select({ id: tenants.id, name: tenants.name })
    .from(tenants).where(eq(tenants.subdomain, slug)).limit(1);
  return bySub ?? null;
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

  return {
    tenantId,
    tenantName,
    smsUptimePct,
    lastDeliveryAt,
    bookingLeadTimeHours,
    weatherRisk7d: 'unknown',
    generatedAt: new Date().toISOString(),
  };
}

router.get('/:tenantSlug', async (req: Request, res: Response) => {
  try {
    const slug = String(req.params.tenantSlug || '').toLowerCase();
    if (!slug || !/^[a-z0-9-]{1,100}$/.test(slug)) {
      return res.status(400).json({ error: 'invalid tenant slug' });
    }
    const cached = cache.get(slug);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      return res.json(cached.payload);
    }
    const tenant = await loadTenantBySlug(slug);
    if (!tenant) return res.status(404).json({ error: 'tenant not found' });
    const payload = await buildStatusPayload(tenant.id, tenant.name);
    cache.set(slug, { at: Date.now(), payload });
    res.json(payload);
  } catch (err) {
    console.error('[STATUS] error:', err);
    res.status(500).json({ error: 'status unavailable' });
  }
});

export const _statusCache = cache;
export default router;
