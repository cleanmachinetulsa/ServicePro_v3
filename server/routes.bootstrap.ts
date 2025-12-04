import type { Express, Request, Response } from 'express';
import { db } from './db';
import { users, tenants, conversations, callEvents } from '@shared/schema';
import { eq, and, sql, isNull } from 'drizzle-orm';

interface BootstrapResponse {
  success: boolean;
  user: {
    id: number;
    username: string;
    role: string;
  } | null;
  tenant: {
    id: string;
    name: string;
    slug: string | null;
    logoUrl: string | null;
    primaryColor: string | null;
    industry: string | null;
  } | null;
  features: {
    messages: boolean;
    phone: boolean;
    website: boolean;
    loyalty: boolean;
    campaigns: boolean;
    analytics: boolean;
  };
  counts: {
    unreadConversations: number;
    newVoicemails: number;
  };
  impersonation: {
    isActive: boolean;
    tenantId: string | null;
    tenantName: string | null;
  };
}

export function registerBootstrapRoutes(app: Express) {
  app.get('/api/bootstrap', async (req: Request, res: Response) => {
    try {
      const session = req.session as any;
      
      if (!session?.userId) {
        return res.json({
          success: true,
          user: null,
          tenant: null,
          features: {
            messages: false,
            phone: false,
            website: false,
            loyalty: false,
            campaigns: false,
            analytics: false,
          },
          counts: {
            unreadConversations: 0,
            newVoicemails: 0,
          },
          impersonation: {
            isActive: false,
            tenantId: null,
            tenantName: null,
          },
        } as BootstrapResponse);
      }

      const tenantId = session.impersonatedTenantId || session.tenantId || 'root';

      const [user, tenant] = await Promise.all([
        db.query.users.findFirst({
          where: eq(users.id, session.userId),
          columns: {
            id: true,
            username: true,
            role: true,
          },
        }),
        db.query.tenants.findFirst({
          where: eq(tenants.id, tenantId),
          columns: {
            id: true,
            name: true,
            subdomain: true,
            logoUrl: true,
            primaryColor: true,
            industry: true,
          },
        }),
      ]);

      let unreadConversations = 0;
      let newVoicemails = 0;

      try {
        const [convResult, vmResult] = await Promise.all([
          db.select({ count: sql<number>`count(*)::int` })
            .from(conversations)
            .where(
              and(
                eq(conversations.tenantId, tenantId),
                sql`${conversations.unreadCount} > 0`
              )
            ),
          db.select({ count: sql<number>`count(*)::int` })
            .from(callEvents)
            .where(
              and(
                eq(callEvents.tenantId, tenantId),
                eq(callEvents.direction, 'inbound'),
                sql`${callEvents.recordingUrl} IS NOT NULL`,
                isNull(callEvents.readAt)
              )
            ),
        ]);

        unreadConversations = convResult[0]?.count || 0;
        newVoicemails = vmResult[0]?.count || 0;
      } catch (countError) {
        console.warn('[Bootstrap] Count queries failed, using defaults:', countError);
      }

      const isImpersonating = !!session.impersonatedTenantId;

      const response: BootstrapResponse = {
        success: true,
        user: user ? {
          id: user.id,
          username: user.username,
          role: user.role,
        } : null,
        tenant: tenant ? {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.subdomain,
          logoUrl: tenant.logoUrl,
          primaryColor: tenant.primaryColor,
          industry: tenant.industry,
        } : null,
        features: {
          messages: true,
          phone: true,
          website: true,
          loyalty: true,
          campaigns: true,
          analytics: true,
        },
        counts: {
          unreadConversations,
          newVoicemails,
        },
        impersonation: {
          isActive: isImpersonating,
          tenantId: isImpersonating ? session.impersonatedTenantId : null,
          tenantName: isImpersonating && tenant ? tenant.name : null,
        },
      };

      res.json(response);
    } catch (error) {
      console.error('[Bootstrap] Error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to load bootstrap data',
      });
    }
  });
}
