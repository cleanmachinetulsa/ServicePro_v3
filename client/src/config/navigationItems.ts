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
  Palette
} from 'lucide-react';
import { LucideIcon } from 'lucide-react';

export interface NavigationItem {
  id: string;
  label: string;
  icon: LucideIcon;
  path: string;
  badge?: string;
  separator?: boolean;
}

export const navigationItems: NavigationItem[] = [
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
    label: 'Schedule',
    icon: Calendar,
    path: '/schedule',
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
    id: 'gallery',
    label: 'Gallery',
    icon: Image,
    path: '/gallery',
  },
  {
    id: 'technician',
    label: 'Technician',
    icon: Wrench,
    path: '/technician',
  },
  {
    id: 'separator',
    label: '',
    icon: Home,
    path: '',
    separator: true,
  },
  {
    id: 'homepage-editor',
    label: 'Website Design',
    icon: Palette,
    path: '/admin/homepage-editor',
    badge: 'Admin',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    path: '/settings',
    badge: 'Admin',
  },
  {
    id: 'security',
    label: 'Security',
    icon: Shield,
    path: '/security-settings',
  },
];
