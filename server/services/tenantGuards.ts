import { CLEAN_MACHINE_TENANT_SLUG } from '@shared/domainConfig';

const LOG_PREFIX = '[TENANT GUARDS]';

export interface TenantInfo {
  id?: string;
  slug?: string;
  name?: string;
}

export function isCleanMachineTenant(tenant: TenantInfo | string | null | undefined): boolean {
  if (!tenant) return false;
  
  if (typeof tenant === 'string') {
    const tenantLower = tenant.toLowerCase();
    return tenantLower === 'root' || 
           tenantLower === 'cleanmachine' || 
           tenantLower === 'clean-machine' ||
           tenantLower === CLEAN_MACHINE_TENANT_SLUG;
  }
  
  const tenantId = (tenant.id || '').toLowerCase();
  const tenantSlug = (tenant.slug || '').toLowerCase();
  
  const isCleanMachine = 
    tenantId === 'root' ||
    tenantSlug === 'cleanmachine' ||
    tenantSlug === 'clean-machine' ||
    tenantSlug === CLEAN_MACHINE_TENANT_SLUG ||
    tenantId === 'cleanmachine';
    
  return isCleanMachine;
}

export function getTenantDisplayName(tenant: TenantInfo | string | null | undefined): string {
  if (!tenant) return 'Unknown Tenant';
  
  if (typeof tenant === 'string') {
    return tenant;
  }
  
  return tenant.name || tenant.slug || tenant.id || 'Unknown Tenant';
}

export function logTenantGuardCheck(tenantId: string, action: string, blocked: boolean): void {
  if (blocked) {
    console.warn(`${LOG_PREFIX} Blocked ${action} for tenant ${tenantId} (Clean Machine protection)`);
  }
}
