/**
 * CM-Billing-Prep: Usage Ledger API Routes
 * 
 * GET  /api/billing/usage/summary - Last 30 days usage grouped by category
 * GET  /api/billing/usage/events  - Paginated ledger rows for tenant
 */

import { Router, Request, Response } from 'express';
import { db } from './db';
import { usageLedger, UsageSource, UsageEventType } from '@shared/schema';
import { eq, and, gte, lte, desc, sql, count } from 'drizzle-orm';

const router = Router();

interface AuthenticatedRequest extends Request {
  session: {
    tenantId?: string;
    userId?: number;
    passport?: {
      user?: {
        id: number;
        username: string;
        role: string;
      };
    };
  } & Request['session'];
}

function getTenantId(req: AuthenticatedRequest): string | null {
  return req.session?.tenantId || 'root';
}

function isAuthenticated(req: AuthenticatedRequest): boolean {
  return !!(req.session?.passport?.user || req.session?.userId);
}

router.get('/summary', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    
    if (!isAuthenticated(authReq)) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const tenantId = getTenantId(authReq);
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Tenant ID not found' });
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const usageBySource = await db
      .select({
        source: usageLedger.source,
        totalUnits: sql<number>`sum(${usageLedger.units})::int`,
        eventCount: count(),
      })
      .from(usageLedger)
      .where(
        and(
          eq(usageLedger.tenantId, tenantId),
          gte(usageLedger.occurredAt, thirtyDaysAgo)
        )
      )
      .groupBy(usageLedger.source);

    const usageByEventType = await db
      .select({
        eventType: usageLedger.eventType,
        source: usageLedger.source,
        totalUnits: sql<number>`sum(${usageLedger.units})::int`,
        eventCount: count(),
      })
      .from(usageLedger)
      .where(
        and(
          eq(usageLedger.tenantId, tenantId),
          gte(usageLedger.occurredAt, thirtyDaysAgo)
        )
      )
      .groupBy(usageLedger.eventType, usageLedger.source);

    const dailyUsage = await db
      .select({
        date: sql<string>`date(${usageLedger.occurredAt})`,
        source: usageLedger.source,
        totalUnits: sql<number>`sum(${usageLedger.units})::int`,
        eventCount: count(),
      })
      .from(usageLedger)
      .where(
        and(
          eq(usageLedger.tenantId, tenantId),
          gte(usageLedger.occurredAt, thirtyDaysAgo)
        )
      )
      .groupBy(sql`date(${usageLedger.occurredAt})`, usageLedger.source)
      .orderBy(sql`date(${usageLedger.occurredAt})`);

    const totals = await db
      .select({
        totalEvents: count(),
        totalUnits: sql<number>`coalesce(sum(${usageLedger.units}), 0)::int`,
      })
      .from(usageLedger)
      .where(
        and(
          eq(usageLedger.tenantId, tenantId),
          gte(usageLedger.occurredAt, thirtyDaysAgo)
        )
      );

    return res.json({
      success: true,
      summary: {
        period: {
          start: thirtyDaysAgo.toISOString(),
          end: new Date().toISOString(),
        },
        totals: totals[0] || { totalEvents: 0, totalUnits: 0 },
        bySource: usageBySource,
        byEventType: usageByEventType,
        daily: dailyUsage,
      },
    });
  } catch (error) {
    console.error('[USAGE LEDGER] Error fetching summary:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch usage summary' });
  }
});

router.get('/events', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    
    if (!isAuthenticated(authReq)) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const tenantId = getTenantId(authReq);
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Tenant ID not found' });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = (page - 1) * limit;

    const sourceFilter = req.query.source as UsageSource | undefined;
    const eventTypeFilter = req.query.eventType as UsageEventType | undefined;
    const startDateParam = req.query.startDate as string | undefined;
    const endDateParam = req.query.endDate as string | undefined;

    let conditions = [eq(usageLedger.tenantId, tenantId)];

    if (sourceFilter) {
      conditions.push(eq(usageLedger.source, sourceFilter));
    }

    if (eventTypeFilter) {
      conditions.push(eq(usageLedger.eventType, eventTypeFilter));
    }

    if (startDateParam) {
      conditions.push(gte(usageLedger.occurredAt, new Date(startDateParam)));
    }

    if (endDateParam) {
      conditions.push(lte(usageLedger.occurredAt, new Date(endDateParam)));
    }

    const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

    const events = await db
      .select()
      .from(usageLedger)
      .where(whereClause)
      .orderBy(desc(usageLedger.occurredAt))
      .limit(limit)
      .offset(offset);

    const [totalResult] = await db
      .select({ count: count() })
      .from(usageLedger)
      .where(whereClause);

    const total = totalResult?.count || 0;
    const totalPages = Math.ceil(total / limit);

    return res.json({
      success: true,
      events,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    });
  } catch (error) {
    console.error('[USAGE LEDGER] Error fetching events:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch usage events' });
  }
});

export default router;
