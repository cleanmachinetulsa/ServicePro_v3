/**
 * Phase 16.5 - Portal Welcome Config Service
 * 
 * Provides tenant-agnostic configuration for the /portal/welcome landing page.
 * Returns heading, subheading, reward tiers, CTAs, and trust messaging.
 */

import { db } from '../db';
import type { TenantDb } from '../tenantDb';
import { tenantConfig, tenants, type PortalWelcomeConfig } from '@shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Get portal welcome configuration for a tenant
 * Returns tenant-specific or default configuration
 */
export async function getPortalWelcomeConfig(
  tenantDb: TenantDb,
  tenantId: string
): Promise<PortalWelcomeConfig> {
  // Load tenant information
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!tenant) {
    throw new Error('Tenant not found');
  }

  // Load tenant config for business name
  const [config] = await tenantDb
    .select()
    .from(tenantConfig)
    .where(eq(tenantConfig.tenantId, tenantId))
    .limit(1);

  const businessName = config?.businessName || 'Our Business';

  // For Clean Machine root tenant, use specific configuration
  if (tenantId === 'root' || businessName.toLowerCase().includes('clean machine')) {
    return getCleanMachineWelcomeConfig(businessName);
  }

  // For other tenants, return generic configuration
  return getDefaultWelcomeConfig(businessName);
}

/**
 * Clean Machine specific welcome configuration
 */
function getCleanMachineWelcomeConfig(businessName: string): PortalWelcomeConfig {
  return {
    heading: `Welcome to ${businessName} Rewards`,
    subheading: 'Earn 1 point for every dollar you spend and redeem points for free detailing services and upgrades.',
    badge: 'New • Hassle-Free Booking & Rewards',
    bullets: [
      'Book faster with our new hassle-free online portal.',
      'Track your detailing history and upcoming appointments in one place.',
      'Earn points automatically with every visit or gift card purchase.',
    ],
    tiers: [
      {
        points: 500,
        label: 'Free Leather/Upholstery Protector or Engine Bay Cleaning',
        description: 'Protect your interior or get a spotless engine bay',
      },
      {
        points: 1000,
        label: 'Free Maintenance Detail',
        description: 'Complete exterior wash and interior refresh',
      },
      {
        points: 2000,
        label: 'Free Paint Enhancement',
        description: 'Professional paint correction and protection',
      },
      {
        points: 3000,
        label: 'Free 1-Year Ceramic Coating',
        description: 'Ultimate long-term paint protection',
      },
    ],
    welcomeOffer: {
      points: 500,
      label: 'Get 500 bonus points when you sign in and book a service or buy a holiday gift card.',
      finePrint:
        'One-time welcome bonus per customer. Bonus points are granted when your first service is completed or your gift card purchase is confirmed. You can redeem them for a free Leather Protector or Engine Bay Cleaning, or save them toward bigger rewards.',
    },
    ctas: {
      primary: {
        label: 'Sign In & Claim 500 Points',
        href: '/portal/login',
      },
      secondary: {
        label: 'Book a Service',
        href: 'https://cleanmachinetulsa.com/booking', // TODO: Make this configurable per tenant
      },
      giftCard: {
        label: 'Buy a Holiday Gift Card',
        href: 'https://square.link/u/BZOd34dT', // TODO: Make this configurable per tenant
      },
      learnMore: {
        label: 'See Full Rewards Breakdown',
        href: '#rewards',
      },
    },
    trust: {
      heading: 'No spam. Just perks.',
      bullets: [
        'You can opt out of promotional messages any time by replying STOP.',
        "You'll still receive important updates about scheduled services.",
        'Your points and booking history are stored securely in your customer portal.',
      ],
    },
  };
}

/**
 * Default welcome configuration for generic tenants
 */
function getDefaultWelcomeConfig(businessName: string): PortalWelcomeConfig {
  return {
    heading: `Welcome to ${businessName} Rewards`,
    subheading: 'Earn points with every purchase and redeem them for exclusive rewards.',
    badge: 'New Customer Portal & Rewards',
    bullets: [
      'Book and manage appointments online.',
      'Track your service history and upcoming bookings.',
      'Earn loyalty points automatically with every purchase.',
    ],
    tiers: [
      {
        points: 500,
        label: 'Tier 1 Reward',
        description: 'Redeem for basic services or discounts',
      },
      {
        points: 1000,
        label: 'Tier 2 Reward',
        description: 'Unlock premium services',
      },
      {
        points: 2000,
        label: 'Tier 3 Reward',
        description: 'Get advanced features',
      },
      {
        points: 3000,
        label: 'Tier 4 Reward',
        description: 'Access exclusive top-tier benefits',
      },
    ],
    welcomeOffer: {
      points: 500,
      label: 'Get 500 bonus points when you sign in and complete your first booking.',
      finePrint:
        'One-time welcome bonus per customer. Bonus points are granted when your first service is completed.',
    },
    ctas: {
      primary: {
        label: 'Sign In & Claim Bonus',
        href: '/portal/login',
      },
      secondary: {
        label: 'Book a Service',
        href: '/booking', // Generic placeholder
      },
      learnMore: {
        label: 'Learn More',
        href: '#rewards',
      },
    },
    trust: {
      heading: 'Your data is secure',
      bullets: [
        'Manage your communication preferences anytime.',
        'Receive important service updates only.',
        'Your information is stored securely and never shared.',
      ],
    },
  };
}
