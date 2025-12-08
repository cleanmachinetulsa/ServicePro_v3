import { useEffect, useState } from 'react';
import { useRoute, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import SettingsWorkspace from '@/components/SettingsWorkspace';
import BackNavigation from '@/components/BackNavigation';
import { Settings as SettingsIcon, Loader2 } from 'lucide-react';
import { settingsSections, findSectionForItem, isValidItem, isSectionValid } from '@/config/settingsSections';
import { isRootTenant } from '@/utils/tenantRouting';

/**
 * CM-ROUTE-RESTORE: Map settings workspace paths to legacy admin paths for root tenant.
 * Root tenant (Clean Machine) uses legacy admin pages with full functionality.
 * Other tenants use the simplified SettingsWorkspace.
 * 
 * IMPORTANT: Only include mappings to routes that actually exist in App.tsx!
 */
const SETTINGS_TO_LEGACY_MAP: Record<string, string> = {
  // Operations section - scheduling route exists at /admin/scheduling
  'recurring': '/admin/scheduling',
  // Website section - these legacy routes exist
  'homepage-editor': '/admin/homepage-editor',
  // Team section - employees route exists
  'employees': '/admin/employees',
  // Integrations section - phone settings route exists
  'phone-settings': '/phone-settings',
  // NOTE: Most settings items render in workspace as components (ServicesManagement, etc.)
  // Only redirect when there's a dedicated legacy page that provides better UX
};

export default function SettingsAdmin() {
  const [, params] = useRoute('/settings/:section?/:item?');
  const [location, setLocation] = useLocation();
  const [initialSection, setInitialSection] = useState<string | undefined>();
  const [initialItem, setInitialItem] = useState<string | undefined>();
  const [redirectChecked, setRedirectChecked] = useState(false);
  
  // CM-ROUTE-RESTORE: Get tenant context to redirect root tenant to legacy pages
  const { data: authContext, isLoading: authLoading } = useQuery<{ user?: { tenantId?: string } }>({
    queryKey: ['/api/auth/context'],
    staleTime: 5 * 60 * 1000,
  });

  // CM-ROUTE-FIX: Only redirect for specific items that have dedicated legacy pages
  // Do NOT redirect /settings to /dashboard - that breaks navigation!
  useEffect(() => {
    // Wait for auth context to load
    if (authLoading || !authContext) return;
    if (redirectChecked) return;
    
    // Only check redirects for root tenant
    if (!isRootTenant(authContext?.user?.tenantId)) {
      setRedirectChecked(true);
      return;
    }
    
    // Get the current settings item from URL params
    const item = params?.item || params?.section;
    
    // Only redirect if there's a specific legacy page for this item
    if (item && SETTINGS_TO_LEGACY_MAP[item]) {
      console.log(`[CM-ROUTE] Root tenant redirecting ${item} -> ${SETTINGS_TO_LEGACY_MAP[item]}`);
      setLocation(SETTINGS_TO_LEGACY_MAP[item], { replace: true });
      return;
    }
    
    // Otherwise let root tenant use the settings workspace - don't redirect to dashboard!
    setRedirectChecked(true);
  }, [authContext, authLoading, params, setLocation, redirectChecked]);

  useEffect(() => {
    if (!params) {
      // No params - use default (operations/services)
      setInitialSection('operations');
      setInitialItem('services');
      return;
    }

    const { section, item } = params;

    // Case 1: Both section and item provided
    if (section && item) {
      // Validate that the item exists in the section
      if (isValidItem(section, item)) {
        setInitialSection(section);
        setInitialItem(item);
      } else {
        // Invalid combination - redirect to default
        console.warn(`Invalid settings path: section=${section}, item=${item}`);
        setLocation('/settings', { replace: true });
      }
      return;
    }

    // Case 2: Only section provided (treat as item for backward compatibility)
    if (section && !item) {
      // First, check if it's a valid section ID
      if (isSectionValid(section)) {
        // It's a section - use the first item in that section
        const sectionData = settingsSections.find(s => s.id === section);
        if (sectionData && sectionData.items.length > 0) {
          setInitialSection(section);
          setInitialItem(sectionData.items[0].id);
        }
      } else {
        // Treat it as an item ID and find its section
        const foundSection = findSectionForItem(section);
        if (foundSection) {
          setInitialSection(foundSection);
          setInitialItem(section);
        } else {
          // Invalid - redirect to default
          console.warn(`Invalid settings path: ${section}`);
          setLocation('/settings', { replace: true });
        }
      }
      return;
    }

    // Default case
    setInitialSection('operations');
    setInitialItem('services');
  }, [params, setLocation]);
  
  // Show loading while checking auth for root tenant redirect
  if (authLoading) {
    return (
      <div className="container mx-auto p-6 max-w-7xl flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-4">
        <BackNavigation fallbackPath="/dashboard" />
      </div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <SettingsIcon className="h-8 w-8" />
          Settings
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage your business operations, customers, communications, and more
        </p>
      </div>

      <SettingsWorkspace 
        initialSection={initialSection}
        initialItem={initialItem}
      />
    </div>
  );
}
