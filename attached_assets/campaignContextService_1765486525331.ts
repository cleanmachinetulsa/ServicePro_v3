import { db } from './db';
import { campaignGrants, customers, loyaltyPoints } from '@shared/schema';
import { eq, and, gte, inArray, desc } from 'drizzle-orm';
import { subDays } from 'date-fns';

/**
 * Campaign context for customer-facing AI agents
 * Helps AI recognize when customers reply to campaign messages
 */
export interface CampaignContext {
  hasRecentCampaign: boolean;
  campaignKey?: string;
  campaignName?: string;
  lastSentAt?: Date;
  bonusPointsFromCampaign?: number;
  currentPoints?: number;
}

/**
 * Map campaign keys to human-readable names and bonus points
 */
function mapCampaignKeyToNameAndBonus(campaignKey: string): { name: string; bonusPoints: number | undefined } {
  switch (campaignKey) {
    case 'welcome_back_v1_vip':
    case 'welcome_back':  // VIP customers might have this generic key with higher points
      return { name: 'Welcome Back: New System Launch', bonusPoints: 500 };
    case 'welcome_back_v1_regular':
      return { name: 'Welcome Back: New System Launch', bonusPoints: 100 };
    default:
      return { name: 'Campaign', bonusPoints: undefined };
  }
}

/**
 * Get campaign context for a customer
 * Used by AI agents to recognize campaign replies
 */
export async function getCampaignContextForCustomer(options: {
  customerId?: number;
  phone?: string;
  recentDays?: number;
}): Promise<CampaignContext> {
  const { customerId: providedCustomerId, phone, recentDays = 30 } = options;

  try {
    // Resolve customer ID from phone if not provided
    let customerId = providedCustomerId;
    
    if (!customerId && phone) {
      const [customer] = await db
        .select({ id: customers.id })
        .from(customers)
        .where(eq(customers.phone, phone))
        .limit(1);
      
      if (customer) {
        customerId = customer.id;
      }
    }

    if (!customerId) {
      console.log('[CAMPAIGN CONTEXT] No customer ID found');
      return { hasRecentCampaign: false };
    }

    // Calculate the date threshold for "recent" campaigns
    const recentDate = subDays(new Date(), recentDays);

    // Find most recent Welcome Back campaign grant (newest first)
    const [recentGrant] = await db
      .select()
      .from(campaignGrants)
      .where(
        and(
          eq(campaignGrants.customerId, customerId),
          eq(campaignGrants.campaignType, 'welcome_back'),
          gte(campaignGrants.createdAt, recentDate)
        )
      )
      .orderBy(desc(campaignGrants.createdAt))
      .limit(1);

    // Get current loyalty points
    let currentPoints: number | undefined;
    try {
      const [loyaltyRecord] = await db
        .select()
        .from(loyaltyPoints)
        .where(eq(loyaltyPoints.customerId, customerId))
        .limit(1);
      
      if (loyaltyRecord) {
        currentPoints = loyaltyRecord.points;
      }
    } catch (error) {
      console.warn('[CAMPAIGN CONTEXT] Error fetching loyalty points:', error);
    }

    // No recent campaign found
    if (!recentGrant) {
      return {
        hasRecentCampaign: false,
        currentPoints
      };
    }

    // Determine campaign key based on points awarded
    // VIP gets 500, Regular gets 100
    const isVIP = recentGrant.pointsAwarded >= 400; // Allow for config variations
    const campaignKey = isVIP ? 'welcome_back_v1_vip' : 'welcome_back_v1_regular';
    const { name: campaignName, bonusPoints } = mapCampaignKeyToNameAndBonus(campaignKey);

    console.log(`[CAMPAIGN CONTEXT] Found recent campaign for customer ${customerId}: ${campaignKey}`);

    return {
      hasRecentCampaign: true,
      campaignKey,
      campaignName,
      lastSentAt: recentGrant.createdAt,
      bonusPointsFromCampaign: recentGrant.pointsAwarded,
      currentPoints
    };

  } catch (error) {
    console.error('[CAMPAIGN CONTEXT] Error getting campaign context:', error);
    return { hasRecentCampaign: false };
  }
}

/**
 * Get campaign context by phone number (convenience method)
 */
export async function getCampaignContextByPhone(
  phone: string,
  recentDays: number = 30
): Promise<CampaignContext> {
  return getCampaignContextForCustomer({ phone, recentDays });
}

/**
 * Get campaign context by customer ID (convenience method)
 */
export async function getCampaignContextByCustomerId(
  customerId: number,
  recentDays: number = 30
): Promise<CampaignContext> {
  return getCampaignContextForCustomer({ customerId, recentDays });
}
