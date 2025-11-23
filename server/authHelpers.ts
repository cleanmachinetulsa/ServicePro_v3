import { Request } from 'express';

export function isImpersonating(req: Request): boolean {
  return !!(req.session?.impersonatingTenantId);
}

export function getEffectiveTenantId(req: Request): string {
  // Priority: impersonation > user's tenant > fallback to root
  if (req.session?.impersonatingTenantId) {
    return req.session.impersonatingTenantId;
  }
  
  return req.session?.tenantId || 'root';
}

export function getImpersonationContext(req: Request): {
  isImpersonating: boolean;
  tenantId: string | null;
  startedAt: string | null;
} {
  return {
    isImpersonating: isImpersonating(req),
    tenantId: req.session?.impersonatingTenantId || null,
    startedAt: req.session?.impersonationStartedAt || null,
  };
}
