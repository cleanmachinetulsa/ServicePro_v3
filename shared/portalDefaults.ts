/**
 * Portal PWA v2 - Industry Pack Defaults
 * 
 * Provides default portal actions for each industry pack.
 * NO Clean Machine or root tenant data - only generic industry defaults.
 */

import type { IndustryPackId } from './industryPacks';

export interface PortalActionDefault {
  actionKey: string;
  displayName: string;
  description?: string;
  icon: string;
  category: string;
  actionType: 'navigate' | 'open_form' | 'trigger_workflow' | 'send_template' | 'external_link' | 'call_phone' | 'send_sms' | 'send_email';
  actionConfig: Record<string, any>;
  showOnHome: boolean;
  showInNav: boolean;
  sortOrder: number;
}

export interface PortalSettingsDefaults {
  pwaDisplayName: string;
  pwaShortName: string;
  portalTitle: string;
  portalWelcomeMessage: string;
  installPromptBannerText: string;
}

// Base actions available across all industries
export const BASE_PORTAL_ACTIONS: PortalActionDefault[] = [
  {
    actionKey: 'book_appointment',
    displayName: 'Book Appointment',
    description: 'Schedule a new service appointment',
    icon: 'Calendar',
    category: 'booking',
    actionType: 'navigate',
    actionConfig: { route: '/portal/book' },
    showOnHome: true,
    showInNav: true,
    sortOrder: 1,
  },
  {
    actionKey: 'view_appointments',
    displayName: 'My Appointments',
    description: 'View upcoming and past appointments',
    icon: 'CalendarDays',
    category: 'booking',
    actionType: 'navigate',
    actionConfig: { route: '/portal/appointments' },
    showOnHome: true,
    showInNav: true,
    sortOrder: 2,
  },
  {
    actionKey: 'send_message',
    displayName: 'Message Us',
    description: 'Send a message to our team',
    icon: 'MessageCircle',
    category: 'communication',
    actionType: 'navigate',
    actionConfig: { route: '/portal/messages' },
    showOnHome: true,
    showInNav: true,
    sortOrder: 3,
  },
  {
    actionKey: 'view_rewards',
    displayName: 'My Rewards',
    description: 'Check your loyalty points and rewards',
    icon: 'Trophy',
    category: 'loyalty',
    actionType: 'navigate',
    actionConfig: { route: '/portal/loyalty' },
    showOnHome: true,
    showInNav: true,
    sortOrder: 4,
  },
  {
    actionKey: 'call_business',
    displayName: 'Call Us',
    description: 'Call our business directly',
    icon: 'Phone',
    category: 'communication',
    actionType: 'call_phone',
    actionConfig: { useBusinessPhone: true },
    showOnHome: true,
    showInNav: false,
    sortOrder: 5,
  },
  {
    actionKey: 'edit_profile',
    displayName: 'My Profile',
    description: 'Update your contact information',
    icon: 'User',
    category: 'account',
    actionType: 'navigate',
    actionConfig: { route: '/portal/profile' },
    showOnHome: false,
    showInNav: true,
    sortOrder: 6,
  },
  {
    actionKey: 'view_history',
    displayName: 'Service History',
    description: 'View your past services',
    icon: 'History',
    category: 'booking',
    actionType: 'navigate',
    actionConfig: { route: '/portal/appointments?tab=past' },
    showOnHome: false,
    showInNav: false,
    sortOrder: 7,
  },
  {
    actionKey: 'request_quote',
    displayName: 'Request Quote',
    description: 'Get a custom quote for your needs',
    icon: 'FileText',
    category: 'booking',
    actionType: 'open_form',
    actionConfig: { formId: 'quote_request' },
    showOnHome: true,
    showInNav: false,
    sortOrder: 8,
  },
  {
    actionKey: 'leave_review',
    displayName: 'Leave a Review',
    description: 'Share your experience',
    icon: 'Star',
    category: 'engagement',
    actionType: 'open_form',
    actionConfig: { formId: 'review' },
    showOnHome: false,
    showInNav: false,
    sortOrder: 9,
  },
  {
    actionKey: 'refer_friend',
    displayName: 'Refer a Friend',
    description: 'Earn rewards by referring friends',
    icon: 'Users',
    category: 'loyalty',
    actionType: 'navigate',
    actionConfig: { route: '/portal/referral' },
    showOnHome: false,
    showInNav: false,
    sortOrder: 10,
  },
];

// Industry-specific additional actions
export const INDUSTRY_PORTAL_ACTIONS: Partial<Record<IndustryPackId, PortalActionDefault[]>> = {
  auto_detailing: [
    {
      actionKey: 'upload_vehicle_photos',
      displayName: 'Upload Vehicle Photos',
      description: 'Share photos for assessment',
      icon: 'Camera',
      category: 'booking',
      actionType: 'open_form',
      actionConfig: { formId: 'vehicle_photos' },
      showOnHome: true,
      showInNav: false,
      sortOrder: 11,
    },
    {
      actionKey: 'view_gallery',
      displayName: 'Our Work',
      description: 'See examples of our detailing work',
      icon: 'Image',
      category: 'info',
      actionType: 'navigate',
      actionConfig: { route: '/gallery' },
      showOnHome: false,
      showInNav: false,
      sortOrder: 12,
    },
    {
      actionKey: 'ceramic_coating_info',
      displayName: 'Ceramic Coating Info',
      description: 'Learn about our coating options',
      icon: 'Shield',
      category: 'info',
      actionType: 'navigate',
      actionConfig: { route: '/services/ceramic-coating' },
      showOnHome: false,
      showInNav: false,
      sortOrder: 13,
    },
  ],
  lawn_care: [
    {
      actionKey: 'view_lawn_plan',
      displayName: 'My Lawn Plan',
      description: 'View your seasonal lawn care plan',
      icon: 'Leaf',
      category: 'service',
      actionType: 'navigate',
      actionConfig: { route: '/portal/lawn-plan' },
      showOnHome: true,
      showInNav: false,
      sortOrder: 11,
    },
    {
      actionKey: 'pause_service',
      displayName: 'Pause Service',
      description: 'Temporarily pause recurring service',
      icon: 'PauseCircle',
      category: 'account',
      actionType: 'open_form',
      actionConfig: { formId: 'pause_service' },
      showOnHome: false,
      showInNav: false,
      sortOrder: 12,
    },
  ],
  house_cleaning: [
    {
      actionKey: 'special_instructions',
      displayName: 'Special Instructions',
      description: 'Update cleaning preferences',
      icon: 'ClipboardList',
      category: 'service',
      actionType: 'open_form',
      actionConfig: { formId: 'cleaning_preferences' },
      showOnHome: true,
      showInNav: false,
      sortOrder: 11,
    },
    {
      actionKey: 'access_instructions',
      displayName: 'Entry Instructions',
      description: 'Update home access info',
      icon: 'Key',
      category: 'account',
      actionType: 'open_form',
      actionConfig: { formId: 'access_info' },
      showOnHome: false,
      showInNav: false,
      sortOrder: 12,
    },
  ],
  mobile_pet_grooming: [
    {
      actionKey: 'pet_profiles',
      displayName: 'My Pets',
      description: 'Manage your pet profiles',
      icon: 'Heart',
      category: 'account',
      actionType: 'navigate',
      actionConfig: { route: '/portal/pets' },
      showOnHome: true,
      showInNav: false,
      sortOrder: 11,
    },
    {
      actionKey: 'grooming_notes',
      displayName: 'Grooming Preferences',
      description: 'Update grooming style notes',
      icon: 'Scissors',
      category: 'service',
      actionType: 'open_form',
      actionConfig: { formId: 'grooming_notes' },
      showOnHome: false,
      showInNav: false,
      sortOrder: 12,
    },
  ],
  photography: [
    {
      actionKey: 'view_gallery_proofs',
      displayName: 'My Photos',
      description: 'View and download your photos',
      icon: 'Image',
      category: 'service',
      actionType: 'navigate',
      actionConfig: { route: '/portal/gallery' },
      showOnHome: true,
      showInNav: true,
      sortOrder: 11,
    },
    {
      actionKey: 'order_prints',
      displayName: 'Order Prints',
      description: 'Order prints and products',
      icon: 'Printer',
      category: 'service',
      actionType: 'external_link',
      actionConfig: { url: '/prints', openInNewTab: false },
      showOnHome: true,
      showInNav: false,
      sortOrder: 12,
    },
  ],
  pressure_washing: [
    {
      actionKey: 'property_details',
      displayName: 'Property Details',
      description: 'Update property information',
      icon: 'Home',
      category: 'account',
      actionType: 'open_form',
      actionConfig: { formId: 'property_details' },
      showOnHome: false,
      showInNav: false,
      sortOrder: 11,
    },
  ],
  pool_service: [
    {
      actionKey: 'pool_report',
      displayName: 'Pool Report',
      description: 'View latest water quality report',
      icon: 'Droplets',
      category: 'service',
      actionType: 'navigate',
      actionConfig: { route: '/portal/pool-report' },
      showOnHome: true,
      showInNav: false,
      sortOrder: 11,
    },
    {
      actionKey: 'equipment_status',
      displayName: 'Equipment Status',
      description: 'Check pool equipment status',
      icon: 'Gauge',
      category: 'service',
      actionType: 'navigate',
      actionConfig: { route: '/portal/equipment' },
      showOnHome: false,
      showInNav: false,
      sortOrder: 12,
    },
  ],
  hvac_service: [
    {
      actionKey: 'maintenance_plan',
      displayName: 'Maintenance Plan',
      description: 'View your HVAC maintenance plan',
      icon: 'FileCheck',
      category: 'service',
      actionType: 'navigate',
      actionConfig: { route: '/portal/maintenance-plan' },
      showOnHome: true,
      showInNav: false,
      sortOrder: 11,
    },
    {
      actionKey: 'filter_reminder',
      displayName: 'Filter Reminder',
      description: 'Set filter change reminders',
      icon: 'Bell',
      category: 'service',
      actionType: 'open_form',
      actionConfig: { formId: 'filter_reminder' },
      showOnHome: false,
      showInNav: false,
      sortOrder: 12,
    },
  ],
  plumbing: [
    {
      actionKey: 'emergency_service',
      displayName: 'Emergency Service',
      description: 'Request emergency plumbing help',
      icon: 'AlertTriangle',
      category: 'booking',
      actionType: 'call_phone',
      actionConfig: { useBusinessPhone: true },
      showOnHome: true,
      showInNav: false,
      sortOrder: 11,
    },
  ],
  electrical: [
    {
      actionKey: 'safety_inspection',
      displayName: 'Safety Inspection',
      description: 'Schedule an electrical safety check',
      icon: 'ShieldCheck',
      category: 'booking',
      actionType: 'open_form',
      actionConfig: { formId: 'safety_inspection' },
      showOnHome: false,
      showInNav: false,
      sortOrder: 11,
    },
  ],
  handyman: [
    {
      actionKey: 'project_list',
      displayName: 'My Projects',
      description: 'View ongoing projects',
      icon: 'Hammer',
      category: 'service',
      actionType: 'navigate',
      actionConfig: { route: '/portal/projects' },
      showOnHome: true,
      showInNav: false,
      sortOrder: 11,
    },
  ],
  personal_training: [
    {
      actionKey: 'workout_log',
      displayName: 'Workout Log',
      description: 'View your workout history',
      icon: 'Dumbbell',
      category: 'service',
      actionType: 'navigate',
      actionConfig: { route: '/portal/workouts' },
      showOnHome: true,
      showInNav: false,
      sortOrder: 11,
    },
    {
      actionKey: 'progress_photos',
      displayName: 'Progress Photos',
      description: 'Upload progress photos',
      icon: 'Camera',
      category: 'service',
      actionType: 'open_form',
      actionConfig: { formId: 'progress_photos' },
      showOnHome: false,
      showInNav: false,
      sortOrder: 12,
    },
  ],
  massage_therapy: [
    {
      actionKey: 'intake_form',
      displayName: 'Health Intake',
      description: 'Update health information',
      icon: 'FileHeart',
      category: 'account',
      actionType: 'open_form',
      actionConfig: { formId: 'health_intake' },
      showOnHome: false,
      showInNav: false,
      sortOrder: 11,
    },
    {
      actionKey: 'preferred_therapist',
      displayName: 'Therapist Preference',
      description: 'Set preferred massage therapist',
      icon: 'UserCheck',
      category: 'account',
      actionType: 'open_form',
      actionConfig: { formId: 'therapist_preference' },
      showOnHome: false,
      showInNav: false,
      sortOrder: 12,
    },
  ],
};

// Default portal settings by industry
export const INDUSTRY_PORTAL_SETTINGS: Partial<Record<IndustryPackId, PortalSettingsDefaults>> = {
  auto_detailing: {
    pwaDisplayName: 'My Detailer',
    pwaShortName: 'Detailer',
    portalTitle: 'Customer Portal',
    portalWelcomeMessage: 'Welcome back! Ready to keep your vehicle looking its best?',
    installPromptBannerText: 'Install our app for quick booking and exclusive detailing rewards',
  },
  lawn_care: {
    pwaDisplayName: 'Lawn Care',
    pwaShortName: 'Lawn',
    portalTitle: 'Customer Portal',
    portalWelcomeMessage: 'Welcome! Let us help you maintain a beautiful lawn.',
    installPromptBannerText: 'Install our app for easy scheduling and lawn care updates',
  },
  house_cleaning: {
    pwaDisplayName: 'Cleaning Services',
    pwaShortName: 'Clean',
    portalTitle: 'Customer Portal',
    portalWelcomeMessage: 'Welcome back! Ready to schedule your next cleaning?',
    installPromptBannerText: 'Install our app for quick booking and cleaning reminders',
  },
  mobile_pet_grooming: {
    pwaDisplayName: 'Pet Grooming',
    pwaShortName: 'Grooming',
    portalTitle: 'Customer Portal',
    portalWelcomeMessage: 'Welcome! Time to pamper your furry friend?',
    installPromptBannerText: 'Install our app to easily book grooming appointments',
  },
  photography: {
    pwaDisplayName: 'Photo Studio',
    pwaShortName: 'Photos',
    portalTitle: 'Client Portal',
    portalWelcomeMessage: 'Welcome! View your photos and book your next session.',
    installPromptBannerText: 'Install our app to access your photos anytime',
  },
};

// Generic fallback for industries without specific defaults
export const DEFAULT_PORTAL_SETTINGS: PortalSettingsDefaults = {
  pwaDisplayName: 'Customer Portal',
  pwaShortName: 'Portal',
  portalTitle: 'Customer Portal',
  portalWelcomeMessage: 'Welcome! How can we help you today?',
  installPromptBannerText: 'Install our app for quick access to your appointments and rewards',
};

/**
 * Get portal actions for a specific industry pack
 * Returns base actions + industry-specific actions
 */
export function getPortalActionsForIndustry(industryPackId: IndustryPackId | null): PortalActionDefault[] {
  const industryActions = industryPackId ? INDUSTRY_PORTAL_ACTIONS[industryPackId] || [] : [];
  return [...BASE_PORTAL_ACTIONS, ...industryActions];
}

/**
 * Get portal settings defaults for a specific industry pack
 */
export function getPortalSettingsForIndustry(industryPackId: IndustryPackId | null): PortalSettingsDefaults {
  if (!industryPackId) return DEFAULT_PORTAL_SETTINGS;
  return INDUSTRY_PORTAL_SETTINGS[industryPackId] || DEFAULT_PORTAL_SETTINGS;
}

/**
 * Count total available actions for an industry
 */
export function countActionsForIndustry(industryPackId: IndustryPackId | null): number {
  return getPortalActionsForIndustry(industryPackId).length;
}
