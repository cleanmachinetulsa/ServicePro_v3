import { useEffect } from 'react';
import { useBootstrap } from './useBootstrap';

/**
 * Stage 1C-b: Side-effect-only hook that updates the browser tab title and
 * favicon from the authenticated tenant's branding.
 *
 * Source of truth: GET /api/bootstrap (already fetched by useBootstrap()).
 *   - tenant.name    -> document.title
 *   - tenant.logoUrl -> <link rel="icon"> href (only when non-empty)
 *
 * Rules:
 *   - No placeholderData / initialData -- only real server data drives updates.
 *   - If businessName is null/undefined/empty, leave the existing title alone
 *     (which is "Loading..." until data arrives, per client/index.html).
 *   - If logoUrl is null/undefined/empty, leave the existing favicon alone
 *     (the ServicePro default declared via <link rel="icon"> in index.html or
 *     manifest) -- never blank it.
 *   - When unauthenticated, useBootstrap returns no data, so neither effect
 *     fires. Public pages keep the default favicon and the "Loading..." title
 *     until they navigate to an authenticated context.
 */
export function useTenantMeta(): void {
  const { data } = useBootstrap();
  const businessName = data?.tenant?.name;
  const logoUrl = data?.tenant?.logoUrl;

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!businessName) return;
    document.title = businessName;
  }, [businessName]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!logoUrl) return;
    const link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) return;
    link.href = logoUrl;
  }, [logoUrl]);
}
