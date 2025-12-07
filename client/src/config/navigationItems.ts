import { 
  Home, 
  MessageSquare, 
  Phone,
  PhoneCall,
  Users, 
  Calendar, 
  TrendingUp, 
  Image, 
  Wrench, 
  Settings, 
  Shield,
  DollarSign,
  AlertCircle,
  Palette,
  BarChart3,
  UserCog,
  Building2,
  Bell,
  Clock,
  Activity,
  Megaphone,
  FileText,
  MessagesSquare,
  LayoutDashboard,
  Camera,
  Gift,
  Briefcase,
  FileQuestion,
  UserPlus,
  CalendarDays,
  Plane,
  MessageCircle,
  History,
  Wallet,
  Sparkles,
  RefreshCw,
  Lightbulb,
  MessageSquarePlus,
  HelpCircle,
  Headphones,
  Mail,
  Globe,
  SlidersHorizontal,
  CreditCard,
  FileArchive,
  LayoutGrid,
  Package,
} from 'lucide-react';
import { LucideIcon } from 'lucide-react';

// SP-21: Complexity levels for navigation items
export type ComplexityLevel = 'simple' | 'advanced' | 'expert';

// Legacy visibility type for backward compatibility
export type NavVisibility = 'always' | 'advancedOnly';

export interface NavigationItem {
  id: string;
  label: string;
  icon: LucideIcon;
  path: string;
  badge?: string;
  separator?: boolean;
  sectionHeader?: string;
  visibility?: NavVisibility;
  // SP-21: New complexity metadata
  complexity?: ComplexityLevel;
  simpleDefault?: boolean; // Whether shown in Simple mode by default
}

// SP-21: Simple mode config stored in user/tenant preferences
export interface SimpleModeConfig {
  visibleNavItems?: string[];
}

// SP-21: Owner-only nav item IDs that should never appear for non-owners
export const OWNER_ONLY_NAV_IDS = [
  'concierge-setup',
  'tenants',
  'phone-config',
  'parser-history',
  'root-admin-usage',
  'admin-usage',
];

/**
 * SP-21: Filter navigation items based on dashboard mode
 * @param mode - 'simple' or 'advanced'
 * @param config - Custom simple mode configuration (optional)
 * @param items - Navigation items to filter (defaults to navigationItems)
 * @param userRole - User's role for RBAC filtering (defaults to 'employee' for safety)
 */
export function filterNavForMode(
  mode: 'simple' | 'advanced',
  config?: SimpleModeConfig | null,
  items: NavigationItem[] = navigationItems,
  userRole?: string
): NavigationItem[] {
  // First, apply role-based filtering to remove owner-only items for non-owners
  // Default to 'employee' for safety - only owners can see owner-only items
  const effectiveRole = userRole || 'employee';
  let filteredItems = items;
  if (effectiveRole !== 'owner') {
    filteredItems = items.filter(item => !OWNER_ONLY_NAV_IDS.includes(item.id));
  }

  // Advanced mode shows everything (after role filtering)
  if (mode === 'advanced') {
    return filteredItems;
  }

  // Simple mode filtering logic
  // Get IDs of visible items based on custom config or defaults
  const customVisibleIds = new Set(config?.visibleNavItems || []);
  const hasCustomConfig = customVisibleIds.size > 0;

  return filteredItems.filter(item => {
    // Always include separators that precede visible items (handled later)
    if (item.separator) {
      return true; // We'll filter empty sections after
    }

    // If custom config exists, use it (but still exclude owner-only for non-owners)
    if (hasCustomConfig) {
      // Additional security: never show owner-only items even if in custom config
      if (effectiveRole !== 'owner' && OWNER_ONLY_NAV_IDS.includes(item.id)) {
        return false;
      }
      return customVisibleIds.has(item.id);
    }

    // Default simple mode: show items marked as simpleDefault or with simple complexity
    // Also respect legacy visibility field
    if (item.visibility === 'advancedOnly') {
      return false;
    }
    
    // Show if explicitly marked for simple mode
    if (item.simpleDefault === true) {
      return true;
    }
    
    // Show if complexity is simple
    if (item.complexity === 'simple') {
      return true;
    }
    
    // Hide expert items
    if (item.complexity === 'expert') {
      return false;
    }
    
    // Default: show items without complexity marking (backward compatibility)
    if (!item.complexity) {
      return item.visibility !== 'advancedOnly';
    }
    
    return false;
  });
}

/**
 * SP-21: Get all non-separator navigation items for customization UI
 * @param userRole - User's role for RBAC filtering - omits owner-only items for non-owners (defaults to 'employee')
 */
export function getCustomizableNavItems(userRole?: string): NavigationItem[] {
  let items = navigationItems.filter(item => !item.separator);
  
  // Default to 'employee' for safety - only owners can see owner-only items
  const effectiveRole = userRole || 'employee';
  
  // Exclude owner-only items from customization for non-owners
  if (effectiveRole !== 'owner') {
    items = items.filter(item => !OWNER_ONLY_NAV_IDS.includes(item.id));
  }
  
  return items;
}

/**
 * SP-21: Get default visible nav item IDs for simple mode
 * @param userRole - User's role for RBAC filtering (defaults to 'employee')
 */
export function getDefaultSimpleModeItems(userRole?: string): string[] {
  // Default to 'employee' for safety - only owners can see owner-only items
  const effectiveRole = userRole || 'employee';
  
  return navigationItems
    .filter(item => {
      // Exclude separators
      if (item.separator) return false;
      
      // Exclude owner-only items for non-owners
      if (effectiveRole !== 'owner' && OWNER_ONLY_NAV_IDS.includes(item.id)) {
        return false;
      }
      
      return (
        item.simpleDefault === true || 
        item.complexity === 'simple' ||
        (!item.complexity && item.visibility !== 'advancedOnly')
      );
    })
    .map(item => item.id);
}

/**
 * SP-21: Sanitize nav config to remove owner-only items for non-owners
 * Used when saving config to prevent persisting restricted items
 */
export function sanitizeNavConfig(config: SimpleModeConfig, userRole?: string): SimpleModeConfig {
  const effectiveRole = userRole || 'employee';
  
  if (effectiveRole === 'owner' || !config.visibleNavItems) {
    return config;
  }
  
  return {
    ...config,
    visibleNavItems: config.visibleNavItems.filter(id => !OWNER_ONLY_NAV_IDS.includes(id))
  };
}

export const navigationItems: NavigationItem[] = [
  // DASHBOARD
  {
    id: 'separator-dashboard',
    label: '',
    icon: Home,
    path: '',
    separator: true,
    sectionHeader: 'Dashboard',
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: Home,
    path: '/dashboard',
    complexity: 'simple',
    simpleDefault: true,
  },

  // COMMUNICATIONS
  {
    id: 'separator-communications',
    label: '',
    icon: MessageSquare,
    path: '',
    separator: true,
    sectionHeader: 'Communications',
  },
  {
    id: 'messages',
    label: 'Messages',
    icon: MessageSquare,
    path: '/messages',
    complexity: 'simple',
    simpleDefault: true,
  },
  {
    id: 'escalations',
    label: 'Escalations',
    icon: AlertCircle,
    path: '/escalations',
    complexity: 'advanced',
  },
  {
    id: 'phone',
    label: 'Phone',
    icon: Phone,
    path: '/phone',
    complexity: 'simple',
    simpleDefault: true,
  },

  // CUSTOMER MANAGEMENT
  {
    id: 'separator-customers',
    label: '',
    icon: Users,
    path: '',
    separator: true,
    sectionHeader: 'Customer Management',
  },
  {
    id: 'customers',
    label: 'Customer Database',
    icon: Users,
    path: '/customer-database',
    complexity: 'simple',
    simpleDefault: true,
  },
  {
    id: 'service-history',
    label: 'Service History',
    icon: History,
    path: '/service-history',
    visibility: 'advancedOnly',
    complexity: 'advanced',
  },
  {
    id: 'rewards',
    label: 'Rewards',
    icon: Gift,
    path: '/rewards',
    complexity: 'simple',
    simpleDefault: true,
  },

  // SCHEDULING & OPERATIONS
  {
    id: 'separator-scheduling',
    label: '',
    icon: Calendar,
    path: '',
    separator: true,
    sectionHeader: 'Scheduling & Operations',
  },
  {
    id: 'schedule',
    label: 'Scheduling',
    icon: Calendar,
    path: '/admin/scheduling',
    complexity: 'simple',
    simpleDefault: true,
  },
  {
    id: 'technician',
    label: 'Technician Hub',
    icon: Wrench,
    path: '/technician',
    complexity: 'advanced',
  },
  {
    id: 'damage-assessment',
    label: 'Damage Assessment',
    icon: Camera,
    path: '/damage-assessment',
    visibility: 'advancedOnly',
    complexity: 'advanced',
  },

  // MARKETING & CONTENT
  {
    id: 'separator-marketing',
    label: '',
    icon: Palette,
    path: '',
    separator: true,
    sectionHeader: 'Marketing & Content',
  },
  {
    id: 'website-design',
    label: 'Website Design',
    icon: Palette,
    path: '/admin/homepage-editor',
    complexity: 'advanced',
  },
  {
    id: 'public-site-settings',
    label: 'Public Site Settings',
    icon: Globe,
    path: '/admin/public-site-settings',
    complexity: 'advanced',
  },
  {
    id: 'gallery-management',
    label: 'Gallery Management',
    icon: Image,
    path: '/admin/gallery-management',
    complexity: 'advanced',
  },
  {
    id: 'gallery-public',
    label: 'Gallery Showcase',
    icon: LayoutDashboard,
    path: '/gallery',
    badge: 'Public',
    complexity: 'simple',
  },
  {
    id: 'banner-management',
    label: 'Banner Management',
    icon: Megaphone,
    path: '/admin/banner-management',
    visibility: 'advancedOnly',
    complexity: 'expert',
  },
  {
    id: 'referrals',
    label: 'Referral Management',
    icon: Gift,
    path: '/referrals',
    complexity: 'advanced',
  },

  // REPORTS & ANALYTICS
  {
    id: 'separator-analytics',
    label: '',
    icon: TrendingUp,
    path: '',
    separator: true,
    sectionHeader: 'Reports & Analytics',
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: TrendingUp,
    path: '/analytics',
    complexity: 'simple',
    simpleDefault: true,
  },
  {
    id: 'call-metrics',
    label: 'Call Metrics',
    icon: BarChart3,
    path: '/call-metrics',
    visibility: 'advancedOnly',
    complexity: 'expert',
  },

  // FINANCE
  {
    id: 'separator-finance',
    label: '',
    icon: DollarSign,
    path: '',
    separator: true,
    sectionHeader: 'Finance',
  },
  {
    id: 'billing',
    label: 'Billing',
    icon: DollarSign,
    path: '/billing',
    complexity: 'simple',
    simpleDefault: true,
  },
  {
    id: 'usage-dashboard',
    label: 'Usage Dashboard',
    icon: Wallet,
    path: '/admin/usage-dashboard',
    visibility: 'advancedOnly',
    complexity: 'advanced',
  },
  {
    id: 'billing-usage',
    label: 'Billing & Usage',
    icon: Activity,
    path: '/admin/billing-usage',
    visibility: 'advancedOnly',
    complexity: 'advanced',
  },

  // MULTI-TENANT MANAGEMENT (Owner Only) - Advanced Mode
  {
    id: 'separator-multi-tenant',
    label: '',
    icon: Building2,
    path: '',
    separator: true,
    sectionHeader: 'Multi-Tenant Management',
    visibility: 'advancedOnly',
  },
  {
    id: 'concierge-setup',
    label: 'Concierge Setup',
    icon: Sparkles,
    path: '/admin/concierge-setup',
    badge: 'Owner',
    visibility: 'advancedOnly',
  },
  {
    id: 'setup-copilot',
    label: 'Setup Copilot',
    icon: MessageCircle,
    path: '/admin/setup-copilot',
    badge: 'Beta',
    visibility: 'advancedOnly',
  },
  {
    id: 'tenants',
    label: 'Tenant Management',
    icon: Building2,
    path: '/admin/tenants',
    badge: 'Owner',
    visibility: 'advancedOnly',
  },
  {
    id: 'phone-config',
    label: 'Phone Config',
    icon: Phone,
    path: '/admin/phone-config',
    badge: 'Owner',
    visibility: 'advancedOnly',
  },
  {
    id: 'ivr-config',
    label: 'IVR Configurator',
    icon: PhoneCall,
    path: '/admin/ivr-config',
    badge: 'Owner',
    visibility: 'advancedOnly',
  },
  {
    id: 'system-usage',
    label: 'System Usage',
    icon: Activity,
    path: '/admin/system-usage',
    badge: 'Owner',
    visibility: 'advancedOnly',
  },
  {
    id: 'billing-overview',
    label: 'Usage Overview',
    icon: TrendingUp,
    path: '/admin/billing-overview',
    badge: 'Owner',
    visibility: 'advancedOnly',
  },
  {
    id: 'theme-gallery',
    label: 'Theme Gallery',
    icon: Palette,
    path: '/admin/theme-gallery',
    visibility: 'advancedOnly',
  },
  {
    id: 'migration-wizard',
    label: 'Migration Wizard',
    icon: Sparkles,
    path: '/admin/migration-wizard',
    badge: 'Owner',
    visibility: 'advancedOnly',
  },
  {
    id: 'import-history',
    label: 'Data Import',
    icon: FileArchive,
    path: '/admin/import-history',
    badge: 'Owner',
    visibility: 'advancedOnly',
  },
  {
    id: 'parser-history',
    label: 'Parser History',
    icon: History,
    path: '/admin/parser-history',
    badge: 'Owner',
    visibility: 'advancedOnly',
  },

  // WORKFORCE MANAGEMENT
  {
    id: 'separator-workforce',
    label: '',
    icon: Briefcase,
    path: '',
    separator: true,
    sectionHeader: 'Workforce Management',
  },
  {
    id: 'employees',
    label: 'Employees',
    icon: Briefcase,
    path: '/admin/employees',
  },
  {
    id: 'quote-requests',
    label: 'Quote Requests',
    icon: FileQuestion,
    path: '/admin/quote-requests',
  },
  {
    id: 'applications',
    label: 'Job Applications',
    icon: UserPlus,
    path: '/admin/applications',
  },
  {
    id: 'pto-management',
    label: 'PTO Management',
    icon: Plane,
    path: '/admin/pto',
  },

  // TECHNICIAN PORTAL
  {
    id: 'separator-tech-portal',
    label: '',
    icon: Wrench,
    path: '',
    separator: true,
    sectionHeader: 'Technician Portal',
  },
  {
    id: 'tech-schedule',
    label: 'My Schedule',
    icon: CalendarDays,
    path: '/tech/schedule',
  },
  {
    id: 'tech-pto',
    label: 'Request PTO',
    icon: Plane,
    path: '/tech/pto',
  },
  {
    id: 'tech-open-shifts',
    label: 'Open Shifts',
    icon: Calendar,
    path: '/tech/open-shifts',
  },
  {
    id: 'tech-shift-trades',
    label: 'Shift Trades',
    icon: Users,
    path: '/tech/shift-trades',
  },

  // SETTINGS & ADMINISTRATION
  {
    id: 'separator-admin',
    label: '',
    icon: Settings,
    path: '',
    separator: true,
    sectionHeader: 'Settings & Administration',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    path: '/settings',
    complexity: 'simple',
    simpleDefault: true,
  },
  {
    id: 'ui-mode',
    label: 'Interface Mode',
    icon: SlidersHorizontal,
    path: '/settings/ui-mode',
    complexity: 'simple',
    simpleDefault: true,
  },
  {
    id: 'dashboard-customize',
    label: 'Customize Dashboard',
    icon: LayoutDashboard,
    path: '/settings/dashboard/customize',
    complexity: 'advanced',
  },
  {
    id: 'settings-billing',
    label: 'Billing & Usage',
    icon: CreditCard,
    path: '/settings/billing',
    complexity: 'simple',
    simpleDefault: true,
  },
  {
    id: 'settings-addons',
    label: 'My Add-Ons',
    icon: Package,
    path: '/settings/billing/addons',
    complexity: 'advanced',
  },
  {
    id: 'settings-domains',
    label: 'Custom Domains',
    icon: Globe,
    path: '/settings/domains',
    visibility: 'advancedOnly',
    complexity: 'expert',
  },
  {
    id: 'business-settings',
    label: 'Business Settings',
    icon: Building2,
    path: '/business-settings',
    complexity: 'simple',
    simpleDefault: true,
  },
  {
    id: 'user-management',
    label: 'User Management',
    icon: UserCog,
    path: '/user-management',
    complexity: 'advanced',
  },
  {
    id: 'security',
    label: 'Security',
    icon: Shield,
    path: '/security-settings',
    complexity: 'advanced',
  },
  {
    id: 'notifications-settings',
    label: 'Notifications',
    icon: Bell,
    path: '/notifications-settings',
    complexity: 'advanced',
  },
  {
    id: 'phone-settings',
    label: 'Phone Settings',
    icon: Phone,
    path: '/phone-settings',
    visibility: 'advancedOnly',
    complexity: 'expert',
  },
  {
    id: 'email-settings',
    label: 'Email Settings',
    icon: Mail,
    path: '/settings/email',
    visibility: 'advancedOnly',
    complexity: 'expert',
  },
  {
    id: 'a2p-campaign',
    label: 'SMS Compliance',
    icon: Shield,
    path: '/settings/a2p',
    visibility: 'advancedOnly',
    complexity: 'expert',
  },
  {
    id: 'port-recovery',
    label: 'Port Recovery',
    icon: RefreshCw,
    path: '/admin/port-recovery',
    badge: 'Campaign',
    visibility: 'advancedOnly',
    complexity: 'expert',
  },
  {
    id: 'facebook-settings',
    label: 'Facebook Settings',
    icon: MessagesSquare,
    path: '/facebook-settings',
    visibility: 'advancedOnly',
    complexity: 'expert',
  },
  {
    id: 'quick-replies',
    label: 'Quick Replies',
    icon: MessageCircle,
    path: '/quick-replies',
    visibility: 'advancedOnly',
    complexity: 'advanced',
  },
  {
    id: 'reminders',
    label: 'Reminders',
    icon: Clock,
    path: '/reminders',
    visibility: 'advancedOnly',
  },
  {
    id: 'customer-suggestions',
    label: 'Customer Feedback',
    icon: MessageSquarePlus,
    path: '/admin/customer-suggestions',
  },
  
  // HELP & SUPPORT
  {
    id: 'separator-support',
    label: '',
    icon: HelpCircle,
    path: '',
    separator: true,
    sectionHeader: 'Help & Support',
  },
  {
    id: 'support-center',
    label: 'Help & Support',
    icon: HelpCircle,
    path: '/support',
  },
  {
    id: 'admin-support-tickets',
    label: 'Support Tickets',
    icon: Headphones,
    path: '/admin/support-tickets',
    badge: 'Owner',
  },
];
