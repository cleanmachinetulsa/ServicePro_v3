/**
 * Audit T3 Task #23: Productized /demo/:tenant route.
 * Returns a scripted, deterministic conversation that the public demo page
 * animates as if it were happening live. Each tenant may override the script
 * via an env var DEMO_SCRIPT_<TENANT_ID> containing JSON.
 */

import { Router, type Request, type Response } from 'express';
import { db } from './db';
import { wrapTenantDb } from './tenantDb';
import { tenants, tenantConfig } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { requireAuth } from './authMiddleware';

const router = Router();

export interface DemoStep {
  sender: 'customer' | 'ai';
  text: string;
  toolCalls?: string[];
  delayMs?: number;
}

export const DEFAULT_DEMO_SCRIPT: DemoStep[] = [
  { sender: 'customer', text: 'Hey, can I get my truck detailed Saturday?', delayMs: 700 },
  { sender: 'ai', text: 'Absolutely! What address should I put on the work order?', toolCalls: ['check_customer_database'], delayMs: 1100 },
  { sender: 'customer', text: '123 Main St, Tulsa', delayMs: 900 },
  { sender: 'ai', text: 'Got it — confirmed in our service area. I have Saturday 10am or 2pm open. Which works?', toolCalls: ['validate_address', 'get_available_slots'], delayMs: 1400 },
  { sender: 'customer', text: '10am please', delayMs: 700 },
  { sender: 'ai', text: 'Done — you\'re booked Saturday at 10am. Confirmation text is on the way.', toolCalls: ['create_appointment'], delayMs: 1200 },
];

function sanitizeScript(parsed: unknown): DemoStep[] | null {
  if (!Array.isArray(parsed)) return null;
  const cleaned = parsed
    .filter((s: any) => s && (s.sender === 'customer' || s.sender === 'ai') && typeof s.text === 'string')
    .slice(0, 40)
    .map((s: any) => ({
      sender: s.sender as 'customer' | 'ai',
      text: String(s.text).slice(0, 500),
      toolCalls: Array.isArray(s.toolCalls) ? s.toolCalls.slice(0, 6).map(String) : undefined,
      delayMs: typeof s.delayMs === 'number' ? Math.min(5000, Math.max(0, s.delayMs)) : undefined,
    }));
  return cleaned.length > 0 ? cleaned : null;
}

async function loadTenantScript(tenantId: string): Promise<DemoStep[] | null> {
  try {
    const rootDb = wrapTenantDb(db, 'root');
    const [cfg] = await rootDb
      .select({ industryConfig: tenantConfig.industryConfig })
      .from(tenantConfig)
      .where(eq(tenantConfig.tenantId, tenantId))
      .limit(1);
    const stored = (cfg?.industryConfig as any)?.featureFlags?.demoScript;
    if (stored) return sanitizeScript(stored);
  } catch {
    /* fall through */
  }
  return null;
}

function loadOverrideScript(tenantId: string): DemoStep[] | null {
  const key = `DEMO_SCRIPT_${tenantId.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
  const raw = process.env[key];
  if (!raw) return null;
  try {
    return sanitizeScript(JSON.parse(raw));
  } catch {
    return null;
  }
}

async function loadTenantBySlug(slug: string): Promise<{ id: string; name: string } | null> {
  const rootDb = wrapTenantDb(db, 'root');
  const [byId] = await rootDb.select({ id: tenants.id, name: tenants.name })
    .from(tenants).where(eq(tenants.id, slug)).limit(1);
  if (byId) return byId;
  const [bySub] = await rootDb.select({ id: tenants.id, name: tenants.name })
    .from(tenants).where(eq(tenants.subdomain, slug)).limit(1);
  return bySub ?? null;
}

router.get('/:tenantSlug', async (req: Request, res: Response) => {
  try {
    const slug = String(req.params.tenantSlug || '').toLowerCase();
    if (!slug || !/^[a-z0-9-]{1,100}$/.test(slug)) {
      return res.status(400).json({ error: 'invalid tenant slug' });
    }
    const tenant = await loadTenantBySlug(slug);
    if (!tenant) return res.status(404).json({ error: 'tenant not found' });
    // Resolution order: tenant-stored (admin editor) → env override → default.
    const script =
      (await loadTenantScript(tenant.id)) ||
      loadOverrideScript(tenant.id) ||
      DEFAULT_DEMO_SCRIPT;
    res.json({
      tenantId: tenant.id,
      tenantName: tenant.name,
      bannerText: `Live replay — ${tenant.name}`,
      script,
    });
  } catch (err) {
    console.error('[PUBLIC DEMO] error:', err);
    res.status(500).json({ error: 'demo unavailable' });
  }
});

// ---------------------------------------------------------------------------
// Admin editor endpoints — tenant-scoped, requireAuth. Stored on
// tenantConfig.industryConfig.featureFlags.demoScript (existing JSONB column,
// no schema migration required).
// ---------------------------------------------------------------------------

export const adminRouter = Router();

adminRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId as string | undefined;
    if (!tenantId) return res.status(400).json({ error: 'tenant context required' });
    const rootDb = wrapTenantDb(db, 'root');
    const [cfg] = await rootDb
      .select({ industryConfig: tenantConfig.industryConfig })
      .from(tenantConfig)
      .where(eq(tenantConfig.tenantId, tenantId))
      .limit(1);
    const stored = (cfg?.industryConfig as any)?.featureFlags?.demoScript;
    const sanitized = stored ? sanitizeScript(stored) : null;
    return res.json({
      script: sanitized ?? DEFAULT_DEMO_SCRIPT,
      isCustomized: !!sanitized,
      defaultScript: DEFAULT_DEMO_SCRIPT,
    });
  } catch (err) {
    console.error('[DEMO ADMIN] load error:', err);
    return res.status(500).json({ error: 'failed to load' });
  }
});

adminRouter.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId as string | undefined;
    if (!tenantId) return res.status(400).json({ error: 'tenant context required' });
    const body = req.body as { script?: unknown; reset?: boolean };
    const rootDb = wrapTenantDb(db, 'root');
    const [cfg] = await rootDb
      .select({ industryConfig: tenantConfig.industryConfig })
      .from(tenantConfig)
      .where(eq(tenantConfig.tenantId, tenantId))
      .limit(1);
    const current = (cfg?.industryConfig as any) || {};
    const featureFlags = { ...(current.featureFlags || {}) };
    if (body.reset) {
      delete featureFlags.demoScript;
    } else {
      const cleaned = sanitizeScript(body.script);
      if (!cleaned) return res.status(400).json({ error: 'invalid script' });
      featureFlags.demoScript = cleaned;
    }
    const next = { ...current, featureFlags };
    await rootDb
      .update(tenantConfig)
      .set({ industryConfig: next })
      .where(eq(tenantConfig.tenantId, tenantId));
    return res.json({ ok: true, isCustomized: !!featureFlags.demoScript });
  } catch (err) {
    console.error('[DEMO ADMIN] save error:', err);
    return res.status(500).json({ error: 'failed to save' });
  }
});

export default router;
