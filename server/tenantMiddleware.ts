import { Request, Response, NextFunction } from 'express';
import { db } from './db';
import { tenants } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { createTenantDb, type TenantDb } from './tenantDb';
import { getEffectiveTenantId } from './authHelpers';

export interface TenantInfo {
  id: string;
  name: string;
  subdomain: string | null;
  isRoot: boolean;
}

declare global {
  namespace Express {
    interface Request {
      tenant: TenantInfo;
      tenantDb: TenantDb;
    }
  }
}

export async function tenantMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // Use single source of truth for tenant ID (supports impersonation and user's tenant)
    const tenantId = getEffectiveTenantId(req);
    
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (!tenant) {
      console.error(`[TENANT MIDDLEWARE] Tenant not found: ${tenantId}`);
      return res.status(500).json({ 
        error: 'Tenant configuration error. Please contact support.' 
      });
    }

    req.tenant = {
      id: tenant.id,
      name: tenant.name,
      subdomain: tenant.subdomain,
      isRoot: tenant.isRoot,
    };
    
    req.tenantDb = createTenantDb(req.tenant);
    next();
  } catch (error) {
    console.error('[TENANT MIDDLEWARE] Error loading tenant:', error);
    res.status(500).json({ 
      error: 'Failed to load tenant configuration' 
    });
  }
}
