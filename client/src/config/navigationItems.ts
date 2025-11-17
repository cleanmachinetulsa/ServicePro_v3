import { 
  Home, 
  MessageSquare, 
  Phone, 
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
  Monitor,
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
  MessageCircle
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
  // CORE OPERATIONS
  {
    id: 'separator-core',
    label: '',
    icon: Home,
    path: '',
    separator: true,
    sectionHeader: 'Core Operations',
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: Home,
    path: '/dashboard',
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
  {
    id: 'customers',
    label: 'Customers',
    icon: Users,
    path: '/customer-database',
  },
  {
    id: 'schedule',
    label: 'Scheduling',
    icon: Calendar,
    path: '/admin/scheduling',
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: TrendingUp,
    path: '/analytics',
  },
  {
    id: 'billing',
    label: 'Billing',
    icon: DollarSign,
    path: '/billing',
  },
  {
    id: 'technician',
    label: 'Technician',
    icon: Wrench,
    path: '/technician',
  },

  // MARKETING & CONTENT
  {
    id: 'separator-marketing',
    label: '',
    icon: Home,
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
    id: 'damage-assessment',
    label: 'Damage Assessment',
    icon: Camera,
    path: '/damage-assessment',
  },
  {
    id: 'referrals',
    label: 'Referral Management',
    icon: Gift,
    path: '/referrals',
  },

  // WORKFORCE MANAGEMENT
  {
    id: 'separator-workforce',
    label: '',
    icon: Home,
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
    icon: Home,
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

  // SYSTEM MONITORING
  {
    id: 'separator-monitoring',
    label: '',
    icon: Home,
    path: '',
    separator: true,
    sectionHeader: 'System Monitoring',
  },
  {
    id: 'monitor',
    label: 'Monitor Dashboard',
    icon: Monitor,
    path: '/monitor',
  },
  {
    id: 'call-metrics',
    label: 'Call Metrics',
    icon: BarChart3,
    path: '/call-metrics',
  },
  {
    id: 'sms-monitoring',
    label: 'SMS Monitoring',
    icon: MessagesSquare,
    path: '/sms-monitoring',
  },
  {
    id: 'live-conversations',
    label: 'Live Conversations',
    icon: Activity,
    path: '/live-conversations',
  },
  {
    id: 'conversation-insights',
    label: 'Conversation Insights',
    icon: FileText,
    path: '/conversation-insights',
  },

  // ADMINISTRATION
  {
    id: 'separator-admin',
    label: '',
    icon: Home,
    path: '',
    separator: true,
    sectionHeader: 'Administration',
  },
  {
    id: 'user-management',
    label: 'User Management',
    icon: UserCog,
    path: '/user-management',
  },
  {
    id: 'business-settings',
    label: 'Business Settings',
    icon: Building2,
    path: '/business-settings',
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
    id: 'usage-dashboard',
    label: 'Usage Dashboard',
    icon: Activity,
    path: '/admin/usage-dashboard',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    path: '/settings',
  },
  {
    id: 'security',
    label: 'Security',
    icon: Shield,
    path: '/security-settings',
  },
];
