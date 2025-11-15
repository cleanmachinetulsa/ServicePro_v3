export interface SearchableItem {
  id: string;
  name: string;
  description: string;
  path: string;
  category: 'page' | 'setting' | 'action';
  section?: string;
  keywords: string[];
}

export const searchableItems: SearchableItem[] = [
  // Main Pages
  {
    id: 'dashboard',
    name: 'Dashboard',
    description: 'Overview of appointments, metrics, and quick actions',
    path: '/dashboard',
    category: 'page',
    keywords: ['home', 'overview', 'main', 'stats', 'metrics']
  },
  {
    id: 'messages',
    name: 'Messages',
    description: 'View and manage customer messages and conversations',
    path: '/messages',
    category: 'page',
    keywords: ['chat', 'conversations', 'sms', 'text', 'messaging', 'inbox']
  },
  {
    id: 'phone',
    name: 'Phone',
    description: 'Make calls, view call history, and manage voicemails',
    path: '/phone',
    category: 'page',
    keywords: ['call', 'voice', 'dialer', 'voicemail', 'calling']
  },
  {
    id: 'schedule',
    name: 'Schedule',
    description: 'View and manage appointments calendar',
    path: '/schedule',
    category: 'page',
    keywords: ['calendar', 'appointments', 'booking', 'dates', 'timeline']
  },
  {
    id: 'monitor',
    name: 'Monitor Dashboard',
    description: 'Real-time monitoring of system status and alerts',
    path: '/monitor',
    category: 'page',
    keywords: ['monitoring', 'alerts', 'status', 'system', 'health']
  },
  {
    id: 'analytics',
    name: 'Analytics',
    description: 'View business analytics and performance metrics',
    path: '/analytics',
    category: 'page',
    keywords: ['reports', 'stats', 'metrics', 'performance', 'insights', 'data']
  },
  {
    id: 'customer-database',
    name: 'Customer Database',
    description: 'Manage customer information and contact details',
    path: '/customer-database',
    category: 'page',
    keywords: ['customers', 'contacts', 'clients', 'database', 'crm']
  },
  {
    id: 'gallery',
    name: 'Gallery',
    description: 'View and manage service photos',
    path: '/gallery',
    category: 'page',
    keywords: ['photos', 'images', 'pictures', 'portfolio', 'showcase']
  },
  {
    id: 'reviews',
    name: 'Reviews',
    description: 'View customer reviews and ratings',
    path: '/reviews',
    category: 'page',
    keywords: ['ratings', 'feedback', 'testimonials', 'google reviews']
  },
  {
    id: 'live-conversations',
    name: 'Live Conversations',
    description: 'Monitor and manage active customer conversations',
    path: '/live-conversations',
    category: 'page',
    keywords: ['chat', 'active', 'real-time', 'support', 'messaging']
  },
  {
    id: 'conversation-insights',
    name: 'Conversation Insights',
    description: 'View conversation analytics and AI insights',
    path: '/conversation-insights',
    category: 'page',
    keywords: ['ai', 'analytics', 'insights', 'conversation analytics', 'chat insights']
  },
  {
    id: 'sms-monitoring',
    name: 'SMS Monitoring',
    description: 'Monitor SMS delivery status and compliance',
    path: '/sms-monitoring',
    category: 'page',
    keywords: ['sms', 'text', 'monitoring', 'delivery', 'messages']
  },
  {
    id: 'call-metrics',
    name: 'Call Metrics',
    description: 'View phone call analytics and statistics',
    path: '/call-metrics',
    category: 'page',
    keywords: ['calls', 'phone', 'analytics', 'stats', 'metrics']
  },
  {
    id: 'damage-assessment',
    name: 'Damage Assessment',
    description: 'Document and assess vehicle damage',
    path: '/damage-assessment',
    category: 'page',
    keywords: ['damage', 'inspection', 'assessment', 'vehicle']
  },
  {
    id: 'user-management',
    name: 'User Management',
    description: 'Manage user accounts and permissions',
    path: '/user-management',
    category: 'page',
    keywords: ['users', 'accounts', 'permissions', 'roles', 'access']
  },
  {
    id: 'admin-employees',
    name: 'Employee Management',
    description: 'Manage employee accounts and schedules',
    path: '/admin/employees',
    category: 'page',
    keywords: ['employees', 'staff', 'team', 'workers', 'technicians']
  },
  {
    id: 'admin-quote-requests',
    name: 'Quote Requests',
    description: 'View and manage customer quote requests',
    path: '/admin/quote-requests',
    category: 'page',
    keywords: ['quotes', 'estimates', 'requests', 'pricing']
  },
  {
    id: 'banner-management',
    name: 'Banner Management',
    description: 'Create and manage promotional banners',
    path: '/banner-management',
    category: 'page',
    keywords: ['banners', 'promotions', 'announcements', 'marketing']
  },
  {
    id: 'technician',
    name: 'Technician Portal',
    description: 'Technician workspace for job management',
    path: '/technician',
    category: 'page',
    keywords: ['tech', 'technician', 'jobs', 'workspace', 'field']
  },
  {
    id: 'referrals-page',
    name: 'Referrals',
    description: 'Manage referral program and track referrals',
    path: '/referrals',
    category: 'page',
    keywords: ['referral', 'referrals', 'rewards', 'program']
  },

  // Settings - Operations
  {
    id: 'settings-services',
    name: 'Services & Add-ons',
    description: 'Configure services, pricing, and add-on options',
    path: '/settings/operations/services',
    category: 'setting',
    section: 'Operations',
    keywords: ['services', 'pricing', 'add-ons', 'packages', 'offerings']
  },
  {
    id: 'settings-recurring',
    name: 'Recurring Services',
    description: 'Manage subscription and recurring service plans',
    path: '/settings/operations/recurring',
    category: 'setting',
    section: 'Operations',
    keywords: ['recurring', 'subscriptions', 'memberships', 'plans', 'repeat']
  },
  {
    id: 'settings-phone',
    name: 'Phone & Voice',
    description: 'Configure phone system and voice settings',
    path: '/settings/operations/phone-settings',
    category: 'setting',
    section: 'Operations',
    keywords: ['phone', 'voice', 'calling', 'twilio', 'voicemail']
  },

  // Settings - Customer Management
  {
    id: 'settings-customer-management',
    name: 'Customer Database',
    description: 'Manage customer information and settings',
    path: '/settings/customers/customer-management',
    category: 'setting',
    section: 'Customer Management',
    keywords: ['customers', 'database', 'contacts', 'crm']
  },
  {
    id: 'settings-loyalty',
    name: 'Loyalty Program',
    description: 'Configure loyalty points and rewards',
    path: '/settings/customers/loyalty',
    category: 'setting',
    section: 'Customer Management',
    keywords: ['loyalty', 'points', 'rewards', 'program', 'perks']
  },
  {
    id: 'settings-referrals',
    name: 'Referral Program',
    description: 'Configure referral rewards and tracking',
    path: '/settings/customers/referrals',
    category: 'setting',
    section: 'Customer Management',
    keywords: ['referral', 'referrals', 'rewards', 'program', 'tracking']
  },
  {
    id: 'settings-gallery',
    name: 'Gallery Photos',
    description: 'Manage gallery photos and portfolio images',
    path: '/settings/customers/gallery',
    category: 'setting',
    section: 'Customer Management',
    keywords: ['gallery', 'photos', 'images', 'portfolio']
  },

  // Settings - Communications
  {
    id: 'settings-notifications',
    name: 'Notifications',
    description: 'Configure notification preferences and settings',
    path: '/settings/communications/notifications',
    category: 'setting',
    section: 'Communications',
    keywords: ['notifications', 'alerts', 'settings', 'preferences']
  },
  {
    id: 'settings-sms-templates',
    name: 'SMS Templates',
    description: 'Manage SMS message templates',
    path: '/settings/communications/sms-templates',
    category: 'setting',
    section: 'Communications',
    keywords: ['sms', 'templates', 'messages', 'text']
  },
  {
    id: 'settings-email-templates',
    name: 'Email Templates',
    description: 'Manage email message templates',
    path: '/settings/communications/email-templates',
    category: 'setting',
    section: 'Communications',
    keywords: ['email', 'templates', 'messages']
  },
  {
    id: 'settings-email-campaigns',
    name: 'Email Campaigns',
    description: 'Create and manage email marketing campaigns',
    path: '/settings/communications/email-campaigns',
    category: 'setting',
    section: 'Communications',
    keywords: ['email', 'campaigns', 'marketing', 'newsletters']
  },
  {
    id: 'settings-upsell',
    name: 'Upsell Offers',
    description: 'Configure upsell and cross-sell offers',
    path: '/settings/communications/upsell',
    category: 'setting',
    section: 'Communications',
    keywords: ['upsell', 'cross-sell', 'offers', 'promotions']
  },
  {
    id: 'settings-cancellation',
    name: 'Cancellation Feedback',
    description: 'Configure cancellation feedback collection',
    path: '/settings/communications/cancellation',
    category: 'setting',
    section: 'Communications',
    keywords: ['cancellation', 'feedback', 'surveys']
  },

  // Settings - Business
  {
    id: 'settings-business-settings',
    name: 'Business Settings',
    description: 'Configure business information and hours',
    path: '/settings/business/business-settings',
    category: 'setting',
    section: 'Business',
    keywords: ['business', 'info', 'hours', 'location', 'company']
  },
  {
    id: 'settings-agent-settings',
    name: 'Agent Settings',
    description: 'Configure AI agent behavior and responses',
    path: '/settings/business/agent-settings',
    category: 'setting',
    section: 'Business',
    keywords: ['ai', 'agent', 'chatbot', 'automation']
  },
  {
    id: 'settings-subscriptions',
    name: 'Subscription Plans',
    description: 'Manage subscription plans and billing',
    path: '/settings/business/subscriptions',
    category: 'setting',
    section: 'Business',
    keywords: ['subscriptions', 'plans', 'billing', 'pricing']
  },

  // Common Actions
  {
    id: 'action-view-messages',
    name: 'View Messages',
    description: 'Open the messages inbox to view customer conversations',
    path: '/messages',
    category: 'action',
    keywords: ['open messages', 'check messages', 'inbox', 'conversations']
  },
  {
    id: 'action-make-call',
    name: 'Make a Call',
    description: 'Open the phone dialer to make a call',
    path: '/phone',
    category: 'action',
    keywords: ['call customer', 'phone call', 'dial', 'calling']
  },
  {
    id: 'action-check-schedule',
    name: 'Check Schedule',
    description: 'View today\'s appointments and schedule',
    path: '/schedule',
    category: 'action',
    keywords: ['view schedule', 'appointments today', 'calendar']
  },
  {
    id: 'action-manage-customers',
    name: 'Manage Customers',
    description: 'Access customer database and information',
    path: '/customer-database',
    category: 'action',
    keywords: ['find customer', 'customer info', 'lookup']
  },
  {
    id: 'action-view-analytics',
    name: 'View Analytics',
    description: 'Check business performance and metrics',
    path: '/analytics',
    category: 'action',
    keywords: ['check stats', 'reports', 'performance', 'metrics']
  },
  {
    id: 'action-configure-services',
    name: 'Configure Services',
    description: 'Update services and pricing',
    path: '/settings/operations/services',
    category: 'action',
    keywords: ['edit services', 'update pricing', 'change prices']
  },
  {
    id: 'action-setup-loyalty',
    name: 'Setup Loyalty Program',
    description: 'Configure loyalty points and rewards',
    path: '/settings/customers/loyalty',
    category: 'action',
    keywords: ['loyalty setup', 'rewards program', 'points']
  },
  {
    id: 'action-setup-referrals',
    name: 'Setup Referral Program',
    description: 'Configure referral rewards and settings',
    path: '/settings/customers/referrals',
    category: 'action',
    keywords: ['referral setup', 'referral program', 'configure referrals']
  },
  {
    id: 'action-manage-templates',
    name: 'Manage SMS Templates',
    description: 'Edit SMS message templates',
    path: '/settings/communications/sms-templates',
    category: 'action',
    keywords: ['edit templates', 'sms messages', 'message templates']
  },
  {
    id: 'action-business-info',
    name: 'Update Business Info',
    description: 'Edit business information and hours',
    path: '/settings/business/business-settings',
    category: 'action',
    keywords: ['business hours', 'company info', 'location']
  },
];
