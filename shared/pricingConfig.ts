/**
 * SaaS Pricing Configuration
 * 
 * Defines pricing tiers, features, and marketing copy for the ServicePro platform.
 * Used for both the public pricing page and in-app upgrade flows.
 */

export type PricingPlanId = 'free' | 'starter' | 'pro' | 'elite';

export interface PricingPlanConfig {
  id: PricingPlanId;
  name: string;
  tagline: string;
  monthlyPrice: number;
  priceSuffix?: string;
  recommended?: boolean;
  highlight?: boolean;
  bulletPoints: string[];
  maxUsers?: number | null;
  usageNotes?: string | null;
}

/**
 * Main pricing plans configuration
 * 
 * Pricing structure:
 * - Free: $0/mo - Testing and small side hustles
 * - Starter: $39/mo - Solo operators going professional
 * - Pro: $89/mo - Growing teams with automation (RECOMMENDED)
 * - Elite: $199/mo - Established businesses with AI voice
 */
export const PRICING_PLANS: PricingPlanConfig[] = [
  {
    id: 'free',
    name: 'Free',
    tagline: 'Get organized and launch your first site',
    monthlyPrice: 0,
    priceSuffix: '/month',
    bulletPoints: [
      'Basic CRM with unlimited contacts',
      'Industry pack setup to get started fast',
      'Hosted website with watermark',
      'Manual appointment booking',
      'Email notifications',
    ],
    maxUsers: 1,
    usageNotes: 'Perfect for testing the platform or solo side hustles',
  },
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'Look professional with online booking',
    monthlyPrice: 39,
    priceSuffix: '/month',
    bulletPoints: [
      'Remove watermark from your site',
      'Custom domain support',
      'Online booking form & confirmations',
      'Automated email notifications',
      'SMS appointment reminders',
      'Data export tools',
    ],
    maxUsers: 2,
    usageNotes: 'Great for solo operators ready to go beyond manual texting',
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'Run your business on autopilot',
    monthlyPrice: 89,
    priceSuffix: '/month',
    recommended: true,
    highlight: true,
    bulletPoints: [
      'Full AI SMS assistant for 24/7 replies',
      'Dedicated phone number for your business',
      'Advanced website customization',
      'Automated reminders, follow-ups & campaigns',
      'Customer loyalty program',
      'Priority email support',
    ],
    maxUsers: 5,
    usageNotes: 'Best for growing teams that want fewer no-shows and more repeat customers',
  },
  {
    id: 'elite',
    name: 'Elite',
    tagline: 'Scale your team with AI voice & advanced tools',
    monthlyPrice: 199,
    priceSuffix: '/month',
    bulletPoints: [
      'AI voice receptionist & advanced IVR',
      'Multi-user support & technician routing',
      'Custom SMS templates & branding',
      'Advanced analytics & reporting',
      'White-label options available',
      'Priority phone & chat support',
    ],
    maxUsers: null, // Unlimited
    usageNotes: 'For established businesses and agencies managing multiple jobs per day',
  },
];

/**
 * Lookup map for quick access to plan configs by ID
 */
export const PRICING_PLAN_BY_ID: Record<PricingPlanId, PricingPlanConfig> = {
  free: PRICING_PLANS[0],
  starter: PRICING_PLANS[1],
  pro: PRICING_PLANS[2],
  elite: PRICING_PLANS[3],
};

/**
 * Marketing copy for the pricing page
 */
export const PRICING_MARKETING = {
  headline: 'Choose the plan that matches your business',
  subheadline: 'Start free, then upgrade when you\'re ready for AI automation and advanced tools',
  finePrint: 'All plans include secure hosting, automatic backups, and free updates. Cancel anytime, no contracts.',
};

/**
 * Feature definitions for the pricing comparison table
 * Maps feature keys to human-readable labels and descriptions
 */
export interface PricingFeature {
  key: string;
  label: string;
  description?: string;
  category?: 'core' | 'automation' | 'advanced' | 'support';
}

/**
 * Features displayed in the pricing comparison table
 * Ordered by importance/visibility
 */
export const PRICING_FEATURES: PricingFeature[] = [
  // Core features
  {
    key: 'websiteGenerator',
    label: 'Hosted website on ServicePro domain',
    description: 'Get online fast with a polished, mobile-responsive site',
    category: 'core',
  },
  {
    key: 'customDomain',
    label: 'Use your own custom domain',
    description: 'Look professional with your own URL (e.g., yourcompany.com)',
    category: 'core',
  },
  {
    key: 'crmBasic',
    label: 'Customer relationship management (CRM)',
    description: 'Track customers, appointments, and service history',
    category: 'core',
  },
  {
    key: 'dataExport',
    label: 'Data export tools',
    description: 'Export your customer and appointment data anytime',
    category: 'core',
  },
  
  // Automation features
  {
    key: 'aiSmsAgent',
    label: 'AI SMS assistant for 24/7 replies',
    description: 'Automated SMS responses powered by GPT-4',
    category: 'automation',
  },
  {
    key: 'campaigns',
    label: 'Email & SMS campaigns',
    description: 'Send automated follow-ups, promotions, and reminders',
    category: 'automation',
  },
  {
    key: 'dedicatedNumber',
    label: 'Dedicated business phone number',
    description: 'Your own phone number with call routing and voicemail',
    category: 'automation',
  },
  {
    key: 'loyalty',
    label: 'Customer loyalty program',
    description: 'Automated rewards and referral tracking',
    category: 'automation',
  },
  
  // Advanced features
  {
    key: 'aiVoiceAgent',
    label: 'AI voice receptionist & IVR',
    description: 'Answer calls automatically with intelligent routing',
    category: 'advanced',
  },
  {
    key: 'multiUser',
    label: 'Multi-user support',
    description: 'Add team members with role-based access',
    category: 'advanced',
  },
  {
    key: 'advancedAnalytics',
    label: 'Advanced analytics & reporting',
    description: 'Deep insights into revenue, retention, and performance',
    category: 'advanced',
  },
  
  // Support
  {
    key: 'prioritySupport',
    label: 'Priority support',
    description: 'Get help faster with dedicated support channels',
    category: 'support',
  },
];
