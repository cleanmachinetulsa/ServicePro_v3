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
  Globe
} from 'lucide-react';
import { LucideIcon } from 'lucide-react';

export interface NavigationItem {
  id: string;
  label: string;
  icon: LucideIcon;
  path: string;
  badge?: string;
  separator?: boolean;
  sectionHeader?: string;
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
  },
  {
    id: 'escalations',
    label: 'Escalations',
    icon: AlertCircle,
    path: '/escalations',
  },
  {
    id: 'phone',
    label: 'Phone',
    icon: Phone,
    path: '/phone',
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
  },
  {
    id: 'service-history',
    label: 'Service History',
    icon: History,
    path: '/service-history',
  },
  {
    id: 'rewards',
    label: 'Rewards',
    icon: Gift,
    path: '/rewards',
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
  },
  {
    id: 'technician',
    label: 'Technician Hub',
    icon: Wrench,
    path: '/technician',
  },
  {
    id: 'damage-assessment',
    label: 'Damage Assessment',
    icon: Camera,
    path: '/damage-assessment',
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
  },
  {
    id: 'public-site-settings',
    label: 'Public Site Settings',
    icon: Globe,
    path: '/admin/public-site-settings',
  },
  {
    id: 'gallery-management',
    label: 'Gallery Management',
    icon: Image,
    path: '/admin/gallery-management',
  },
  {
    id: 'gallery-public',
    label: 'Gallery Showcase',
    icon: LayoutDashboard,
    path: '/gallery',
    badge: 'Public',
  },
  {
    id: 'banner-management',
    label: 'Banner Management',
    icon: Megaphone,
    path: '/admin/banner-management',
  },
  {
    id: 'referrals',
    label: 'Referral Management',
    icon: Gift,
    path: '/referrals',
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
  },
  {
    id: 'call-metrics',
    label: 'Call Metrics',
    icon: BarChart3,
    path: '/call-metrics',
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
  },
  {
    id: 'usage-dashboard',
    label: 'Usage Dashboard',
    icon: Wallet,
    path: '/admin/usage-dashboard',
  },
  {
    id: 'billing-usage',
    label: 'Billing & Usage',
    icon: Activity,
    path: '/admin/billing-usage',
  },

  // MULTI-TENANT MANAGEMENT (Owner Only)
  {
    id: 'separator-multi-tenant',
    label: '',
    icon: Building2,
    path: '',
    separator: true,
    sectionHeader: 'Multi-Tenant Management',
  },
  {
    id: 'concierge-setup',
    label: 'Concierge Setup',
    icon: Sparkles,
    path: '/admin/concierge-setup',
    badge: 'Owner',
  },
  {
    id: 'setup-copilot',
    label: 'Setup Copilot',
    icon: MessageCircle,
    path: '/admin/setup-copilot',
    badge: 'Beta',
  },
  {
    id: 'tenants',
    label: 'Tenant Management',
    icon: Building2,
    path: '/admin/tenants',
    badge: 'Owner',
  },
  {
    id: 'phone-config',
    label: 'Phone Config',
    icon: Phone,
    path: '/admin/phone-config',
    badge: 'Owner',
  },
  {
    id: 'ivr-config',
    label: 'IVR Configurator',
    icon: PhoneCall,
    path: '/admin/ivr-config',
    badge: 'Owner',
  },
  {
    id: 'system-usage',
    label: 'System Usage',
    icon: Activity,
    path: '/admin/system-usage',
    badge: 'Owner',
  },
  {
    id: 'theme-gallery',
    label: 'Theme Gallery',
    icon: Palette,
    path: '/admin/theme-gallery',
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
  },
  {
    id: 'business-settings',
    label: 'Business Settings',
    icon: Building2,
    path: '/business-settings',
  },
  {
    id: 'user-management',
    label: 'User Management',
    icon: UserCog,
    path: '/user-management',
  },
  {
    id: 'security',
    label: 'Security',
    icon: Shield,
    path: '/security-settings',
  },
  {
    id: 'notifications-settings',
    label: 'Notifications',
    icon: Bell,
    path: '/notifications-settings',
  },
  {
    id: 'phone-settings',
    label: 'Phone Settings',
    icon: Phone,
    path: '/phone-settings',
  },
  {
    id: 'email-settings',
    label: 'Email Settings',
    icon: Mail,
    path: '/settings/email',
  },
  {
    id: 'a2p-campaign',
    label: 'SMS Compliance',
    icon: Shield,
    path: '/settings/a2p',
  },
  {
    id: 'port-recovery',
    label: 'Port Recovery',
    icon: RefreshCw,
    path: '/admin/port-recovery',
    badge: 'Campaign',
  },
  {
    id: 'facebook-settings',
    label: 'Facebook Settings',
    icon: MessagesSquare,
    path: '/facebook-settings',
  },
  {
    id: 'quick-replies',
    label: 'Quick Replies',
    icon: MessageCircle,
    path: '/quick-replies',
  },
  {
    id: 'reminders',
    label: 'Reminders',
    icon: Clock,
    path: '/reminders',
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
