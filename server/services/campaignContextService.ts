import type { TenantDb } from '../tenantDb';
import { campaignSends, customers, loyaltyPoints } from '@shared/schema';
import { eq, and, desc, gte } from 'drizzle-orm';
import { subDays } from 'date-fns';

/**
 * Campaign context data for AI agents
 */
export interface CampaignContext {
  hasRecentCampaign: boolean;
  campaignKey?: string;          // e.g. 'welcome_back_v1_vip'
  campaignName?: string;         // e.g. 'Welcome Back: New System Launch'
  lastSentAt?: Date;
  bonusPointsFromCampaign?: number;
  currentPoints?: number;
}

/**
 * Map campaign keys to friendly names and bonus points
 */
function mapCampaignKeyToNameAndBonus(campaignKey: string): {
  name: string;
  bonusPoints: number | undefined;
} {
  switch (campaignKey) {
    case 'welcome_back_v1_vip':
      return { name: 'Welcome Back: New System Launch', bonusPoints: 500 };
    case 'welcome_back_v1_regular':
      return { name: 'Welcome Back: New System Launch', bonusPoints: 100 };
    default:
      return { name: 'Campaign', bonusPoints: undefined };
  }
}

/**
 * Get campaign context for a customer to enable AI campaign awareness
 * 
 * This service powers the AI agent's ability to understand and respond to
 * customers who received campaign messages. It looks up recent campaign sends
 * and returns structured context that can be injected into AI prompts.
 * 
 * @param options.tenantDb - Tenant database client for queries
 * @param options.tenantId - Tenant ID for multi-tenant isolation
 * @param options.customerId - Customer ID to check for campaigns
 * @param options.recentDays - How many days back to check (default 30)
 * @returns Campaign context including campaign details and current points
 */
export async function getCampaignContextForCustomer(options: {
  tenantDb: TenantDb;
  tenantId: string;
  customerId: number;
  recentDays?: number;
}): Promise<CampaignContext> {
  const { tenantDb, tenantId, customerId, recentDays = 30 } = options;

  try {
    // Calculate cutoff date for "recent" campaigns
    const cutoffDate = subDays(new Date(), recentDays);

    // Look up most recent campaign send for this customer
    const [recentCampaign] = await tenantDb
      .select()
      .from(campaignSends)
      .where(
        tenantDb.withTenantFilter(
          campaignSends,
          and(
            eq(campaignSends.customerId, customerId),
            gte(campaignSends.sentAt, cutoffDate)
          )
        )
      )
      .orderBy(desc(campaignSends.sentAt))
      .limit(1);

    // If no recent campaign, return empty context with current points
    if (!recentCampaign) {
      // Still try to get current points for general context
      const currentPoints = await getCurrentPoints(tenantDb, customerId);
      return {
        hasRecentCampaign: false,
        currentPoints,
      };
    }

    // Map campaign key to friendly name and bonus points
    const { name, bonusPoints } = mapCampaignKeyToNameAndBonus(recentCampaign.campaignKey);

    // Get current points
    const currentPoints = await getCurrentPoints(tenantDb, customerId);

    return {
      hasRecentCampaign: true,
      campaignKey: recentCampaign.campaignKey,
      campaignName: name,
      lastSentAt: recentCampaign.sentAt,
      bonusPointsFromCampaign: bonusPoints,
      currentPoints,
    };
  } catch (error) {
    console.error('[Campaign Context] Error fetching campaign context:', error);
    // Return safe fallback - don't break AI agent if campaign lookup fails
    return {
      hasRecentCampaign: false,
    };
  }
}

/**
 * Helper: Get current loyalty points for a customer
 */
async function getCurrentPoints(
  tenantDb: TenantDb,
  customerId: number
): Promise<number | undefined> {
  try {
    const [pointsRecord] = await tenantDb
      .select()
      .from(loyaltyPoints)
      .where(
        tenantDb.withTenantFilter(
          loyaltyPoints,
          eq(loyaltyPoints.customerId, customerId)
        )
      )
      .limit(1);

    return pointsRecord?.points ?? undefined;
  } catch (error) {
    console.error('[Campaign Context] Error fetching loyalty points:', error);
    return undefined;
  }
}

/**
 * Helper: Get customer ID from phone number (for SMS context)
 */
export async function getCustomerIdFromPhone(
  tenantDb: TenantDb,
  phone: string
): Promise<number | null> {
  try {
    const [customer] = await tenantDb
      .select({ id: customers.id })
      .from(customers)
      .where(
        tenantDb.withTenantFilter(
          customers,
          eq(customers.phone, phone)
        )
      )
      .limit(1);

    return customer?.id ?? null;
  } catch (error) {
    console.error('[Campaign Context] Error looking up customer by phone:', error);
    return null;
  }
}

/**
 * Helper: Get customer ID from email (for web chat context)
 */
export async function getCustomerIdFromEmail(
  tenantDb: TenantDb,
  email: string
): Promise<number | null> {
  try {
    const [customer] = await tenantDb
      .select({ id: customers.id })
      .from(customers)
      .where(
        tenantDb.withTenantFilter(
          customers,
          eq(customers.email, email)
        )
      )
      .limit(1);

    return customer?.id ?? null;
  } catch (error) {
    console.error('[Campaign Context] Error looking up customer by email:', error);
    return null;
  }
}
