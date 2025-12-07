import { CLEAN_MACHINE_TENANT_SLUG } from '@shared/domainConfig';

const LOG_PREFIX = '[TENANT GUARDS]';

const CLEAN_MACHINE_IDENTIFIERS = [
  'root',
  'cleanmachine',
  'clean-machine',
  'clean machine',
  'clean machine auto detail',
  'cleanmachinetulsa',
  CLEAN_MACHINE_TENANT_SLUG,
];

export interface TenantInfo {
  id?: string;
  slug?: string;
  name?: string;
}

function normalizeIdentifier(value: string): string {
  return value.toLowerCase().trim();
}

function matchesCleanMachine(value: string | undefined | null): boolean {
  if (!value) return false;
  const normalized = normalizeIdentifier(value);
  return CLEAN_MACHINE_IDENTIFIERS.some(id => normalized === id || normalized.includes(id));
}

export function isCleanMachineTenant(tenant: TenantInfo | string | null | undefined): boolean {
  if (!tenant) return false;
  
  if (typeof tenant === 'string') {
    return matchesCleanMachine(tenant);
  }
  
  return matchesCleanMachine(tenant.id) || 
         matchesCleanMachine(tenant.slug) || 
         matchesCleanMachine(tenant.name);
}

export function isCleanMachineTenantFromRequest(req: any): boolean {
  const tenantId = req.tenantId;
  const tenantSlug = req.tenantSlug || req.tenant?.slug;
  const tenantName = req.tenantName || req.tenant?.name;
  
  return isCleanMachineTenant(tenantId) || 
         isCleanMachineTenant(tenantSlug) || 
         isCleanMachineTenant(tenantName);
}

export function getTenantDisplayName(tenant: TenantInfo | string | null | undefined): string {
  if (!tenant) return 'Unknown Tenant';
  
  if (typeof tenant === 'string') {
    return tenant;
  }
  
  return tenant.name || tenant.slug || tenant.id || 'Unknown Tenant';
}

export function logTenantGuardCheck(tenantIdentifier: string, action: string, blocked: boolean): void {
  if (blocked) {
    console.warn(`${LOG_PREFIX} Blocked ${action} for tenant "${tenantIdentifier}" (Clean Machine protection)`);
  }
}

export function logTenantGuardCheckDetailed(
  req: any, 
  action: string, 
  blocked: boolean
): void {
  if (blocked) {
    const tenantId = req.tenantId || 'none';
    const tenantSlug = req.tenantSlug || req.tenant?.slug || 'none';
    const tenantName = req.tenantName || req.tenant?.name || 'none';
    console.warn(`${LOG_PREFIX} Blocked ${action} (Clean Machine protection) - id:${tenantId}, slug:${tenantSlug}, name:${tenantName}`);
  }
}
