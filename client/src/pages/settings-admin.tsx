import { useEffect, useState } from 'react';
import { useRoute, useLocation, Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import SettingsWorkspace from '@/components/SettingsWorkspace';
import BackNavigation from '@/components/BackNavigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { 
  Settings as SettingsIcon, 
  Loader2, 
  Users, 
  Calendar, 
  Palette, 
  Phone, 
  Gift, 
  UserPlus, 
  MessageSquare,
  Bell,
  Shield,
  Building2,
  ChevronRight
} from 'lucide-react';
import { settingsSections, findSectionForItem, isValidItem, isSectionValid } from '@/config/settingsSections';
import { isRootTenant } from '@/utils/tenantRouting';

/**
 * CM-ROUTE-RESTORE: Legacy admin pages for root tenant (Clean Machine).
 * Root tenant gets dedicated admin pages with full functionality.
 * Other tenants use the simplified SettingsWorkspace.
 */
const ROOT_TENANT_SETTINGS_SECTIONS = [
  {
    title: 'Operations',
    description: 'Manage services, scheduling, and appointments',
    items: [
      { path: '/settings/operations/services', label: 'Services & Add-ons', icon: Building2 },
      { path: '/settings/operations/recurring', label: 'Recurring Services', icon: Calendar },
      { path: '/settings/operations/phone-settings', label: 'Phone & Voice', icon: Phone },
    ]
  },
  {
    title: 'Customer Management',
    description: 'Customers, loyalty, and referrals',
    items: [
      { path: '/settings/customers/customer-management', label: 'Customer Database', icon: Users },
      { path: '/settings/customers/loyalty', label: 'Loyalty Program', icon: Gift },
      { path: '/settings/customers/referrals', label: 'Referral Program', icon: UserPlus },
    ]
  },
  {
    title: 'Communications',
    description: 'Messaging, notifications, and campaigns',
    items: [
      { path: '/settings/communications/notifications', label: 'Notifications', icon: Bell },
      { path: '/settings/communications/sms-templates', label: 'SMS Templates', icon: MessageSquare },
      { path: '/settings/communications/email-templates', label: 'Email Templates', icon: MessageSquare },
      { path: '/settings/communications/campaigns', label: 'Campaigns', icon: MessageSquare },
      { path: '/settings/communications/upsell', label: 'Upsell Offers', icon: Gift },
    ]
  },
  {
    title: 'Business',
    description: 'Business settings, billing, and AI agent',
    items: [
      { path: '/settings/business/business-settings', label: 'Business Settings', icon: Building2 },
      { path: '/settings/business/agent-settings', label: 'AI Agent Settings', icon: Shield },
      { path: '/settings/business/subscriptions', label: 'Subscription Plans', icon: Users },
      { path: '/settings/business/billing-status', label: 'Billing & Usage', icon: Building2 },
    ]
  },
  {
    title: 'Website & Branding',
    description: 'Homepage, appearance, and public pages',
    items: [
      { path: '/settings/website/homepage-editor', label: 'Homepage Editor', icon: Palette },
    ]
  },
  {
    title: 'Team & Security',
    description: 'Employees and access management',
    items: [
      { path: '/admin/employees', label: 'Employees', icon: Users },
      { path: '/settings/security/demo-mode', label: 'Demo Mode', icon: Shield },
    ]
  },
];

/**
 * Root tenant settings hub - shows links to all legacy admin pages
 */
function RootTenantSettingsHub() {
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
          Manage your Clean Machine operations, customers, and communications
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {ROOT_TENANT_SETTINGS_SECTIONS.map((section) => (
          <Card key={section.title} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">{section.title}</CardTitle>
              <CardDescription>{section.description}</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <ul className="space-y-2">
                {section.items.map((item) => {
                  const testId = `settings-link-${item.label.toLowerCase().replace(/\s+/g, '-')}`;
                  return (
                    <li key={item.path}>
                      <Link 
                        href={item.path}
                        data-testid={testId}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-muted transition-colors group"
                      >
                        <span className="flex items-center gap-2">
                          <item.icon className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{item.label}</span>
                        </span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

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

  // CM-ROUTE-FIX: Root tenant gets settings hub, other tenants get workspace
  // Only redirect if there's a specific section/item that needs special handling
  useEffect(() => {
    // Wait for auth context to load
    if (authLoading || !authContext) return;
    if (redirectChecked) return;
    
    setRedirectChecked(true);
  }, [authContext, authLoading, redirectChecked]);
  
  // Determine if we're on the root settings path (no section/item specified)
  const isRootSettingsPath = !params?.section && !params?.item;

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

  // CM-ROUTE-RESTORE: Root tenant gets settings hub on /settings
  // Shows organized links to all legacy admin pages
  if (isRootSettingsPath && isRootTenant(authContext?.user?.tenantId)) {
    return <RootTenantSettingsHub />;
  }

  // Other tenants (or root tenant with specific path) get the settings workspace
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
