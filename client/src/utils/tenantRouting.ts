/**
 * CM-DASH-ROUTES-RESTORE: Tenant-aware routing utilities
 * 
 * For the root tenant (Clean Machine), routes to legacy admin pages with rich content.
 * For other tenants, routes to new /settings workspace pages.
 */

// CM-ROUTE-MAP (root tenant):
// Dashboard: legacy = /dashboard (DashboardPage.tsx)
// Services: legacy = uses ServicesManagement component directly (no separate admin page exists)
// SMS Templates: legacy = /settings/communications/sms-templates (SmsTemplatesManager)
// Email Templates: legacy = /settings/communications/email-templates (EmailTemplatesManager)
// Rewards: legacy = /rewards (RewardsPage.tsx)
// Scheduling: legacy = /admin/scheduling (AdminScheduling.tsx)
// Employees: legacy = /admin/employees (AdminEmployees.tsx)
// Quote Requests: legacy = /admin/quote-requests (AdminQuoteRequests.tsx)
// Gallery: legacy = /admin/gallery-management (AdminGalleryManagement.tsx)
// Homepage Editor: legacy = /admin/homepage-editor (HomepageEditor.tsx)

/**
 * Route mappings for root tenant (Clean Machine) legacy pages vs generic workspace pages.
 * Format: { legacyPath: workspacePath }
 */
export const LEGACY_ROUTE_MAP: Record<string, string> = {
  // These are paths where root tenant should use legacy pages
  // and other tenants should use workspace pages
  '/dashboard': '/dashboard', // Both use same path
  '/rewards': '/rewards', // Legacy rewards page
  '/admin/scheduling': '/settings/operations/recurring', // Legacy scheduling
  '/admin/employees': '/settings/operations/services', // Legacy employees
  '/admin/quote-requests': '/settings/operations/services', // Legacy quote requests
  '/admin/gallery-management': '/settings/website/homepage-editor', // Legacy gallery
  '/admin/homepage-editor': '/settings/website/homepage-editor', // Legacy homepage editor
};

/**
 * Determines if the current tenant is the root tenant (Clean Machine)
 * 
 * @param tenantId - The tenant ID from auth context
 * @param hostname - Optional hostname for additional check
 * @returns true if this is the root tenant
 */
export function isRootTenant(tenantId?: string | null, hostname?: string): boolean {
  // Check by tenantId first
  if (tenantId === 'root') {
    return true;
  }
  
  // Fallback: check by hostname
  if (hostname) {
    const rootDomains = ['cleanmachinetulsa.com', 'www.cleanmachinetulsa.com'];
    return rootDomains.some(domain => hostname.includes(domain));
  }
  
  return false;
}

/**
 * Returns the appropriate path based on tenant context.
 * For root tenant (Clean Machine), returns the legacy path.
 * For other tenants, returns the default (workspace) path.
 * 
 * @param legacyPath - Path for root tenant (legacy admin pages)
 * @param defaultPath - Path for other tenants (new workspace pages)
 * @param tenantId - Current tenant ID from auth context
 * @returns The appropriate path based on tenant
 */
export function cmOrDefault(legacyPath: string, defaultPath: string, tenantId?: string | null): string {
  if (isRootTenant(tenantId)) {
    return legacyPath;
  }
  return defaultPath;
}

/**
 * Gets tenant-aware navigation path for a given navigation item ID.
 * Used by AppShell to override static navigation paths based on tenant context.
 * 
 * @param navItemId - The navigation item ID
 * @param staticPath - The static path defined in navigationItems
 * @param tenantId - Current tenant ID from auth context
 * @returns The appropriate path based on tenant and navigation item
 */
export function getTenantAwarePath(
  navItemId: string, 
  staticPath: string, 
  tenantId?: string | null
): string {
  // For non-root tenants, always use the static path (which points to workspace)
  if (!isRootTenant(tenantId)) {
    return staticPath;
  }
  
  // For root tenant (Clean Machine), check if there's a legacy path override
  // Most items already point to the correct legacy paths in navigationItems
  // This is mainly to ensure we DON'T redirect to workspace pages
  return staticPath;
}

/**
 * Checks if a path should skip URL normalization for root tenant.
 * This prevents SettingsWorkspace from auto-redirecting root tenant to workspace pages.
 * 
 * @param path - The current URL path
 * @param tenantId - Current tenant ID from auth context
 * @returns true if normalization should be skipped
 */
export function shouldSkipPathNormalization(path: string, tenantId?: string | null): boolean {
  // Skip normalization for root tenant entirely
  if (isRootTenant(tenantId)) {
    return true;
  }
  
  return false;
}
