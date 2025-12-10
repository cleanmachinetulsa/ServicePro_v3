import { eq, and, sql, or } from 'drizzle-orm';
import { giftCards, giftCardRedemptions, tenants, type GiftCard, type InsertGiftCard } from '@shared/schema';
import { wrapTenantDb } from '../tenantDb';
import { db } from '../db';
import { SquareClient, SquareEnvironment, GiftCardsApi } from 'square';

const LOG_PREFIX = '[GIFT CARD SQUARE]';

export interface SquareGiftCardSummary {
  providerCardId: string;
  gan: string;
  referenceCode: string;
  balanceCents: number;
  initialAmountCents?: number;
  currency: string;
  status: 'ACTIVE' | 'REDEEMED' | 'VOID' | 'EXPIRED' | 'PENDING';
  metadata?: Record<string, any>;
}

export interface GiftCardSyncResult {
  success: boolean;
  created: number;
  updated: number;
  errors: string[];
}

export interface GiftCardValidation {
  valid: boolean;
  giftCardId?: number;
  currentBalanceCents?: number;
  status?: string;
  currency?: string;
  referenceCode?: string;
  error?: string;
}

export interface GiftCardApplication {
  appliedCents: number;
  remainingCardBalanceCents: number;
  newBookingAmountCents: number;
}

interface TenantSquareConfig {
  accessToken: string;
  locationId: string;
}

async function getTenantSquareConfig(tenantId: string): Promise<TenantSquareConfig | null> {
  try {
    if (tenantId === 'root') {
      const accessToken = process.env.SQUARE_ACCESS_TOKEN;
      const locationId = process.env.SQUARE_LOCATION_ID;
      const appId = process.env.SQUARE_APPLICATION_ID;
      
      if (!accessToken || !locationId) {
        console.warn(`${LOG_PREFIX} Root tenant: Square env vars not configured`);
        return null;
      }
      
      // Debug: log token format and environment
      const tokenPrefix = accessToken ? accessToken.substring(0, 10) : 'MISSING';
      const env = process.env.SQUARE_ENVIRONMENT || 'sandbox (default)';
      console.log(`${LOG_PREFIX} Root tenant config: token=${tokenPrefix}..., locationId=${locationId}, appId=${appId?.substring(0, 10)}..., environment=${env}`);
      
      return { accessToken, locationId };
    }

    const tenant = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (tenant.length === 0) {
      console.warn(`${LOG_PREFIX} Tenant ${tenantId} not found`);
      return null;
    }

    const settings = tenant[0].settings as Record<string, any> || {};
    const accessToken = settings.squareAccessToken;
    const locationId = settings.squareLocationId;

    if (!accessToken || !locationId) {
      console.warn(`${LOG_PREFIX} Tenant ${tenantId}: Square credentials not configured in tenant settings`);
      return null;
    }

    return { accessToken, locationId };
  } catch (error) {
    console.error(`${LOG_PREFIX} Error getting tenant Square config:`, error);
    return null;
  }
}

function getSquareClientForTenant(config: TenantSquareConfig): SquareClient {
  const environment = process.env.SQUARE_ENVIRONMENT === 'production'
    ? SquareEnvironment.Production
    : SquareEnvironment.Sandbox;

  return new SquareClient({
    token: config.accessToken,
    environment,
  });
}

export function isSquareConfiguredForTenant(settings: Record<string, any> | null): boolean {
  if (!settings) return false;
  return !!(settings.squareAccessToken && settings.squareLocationId);
}

async function listGiftCardsFromSquare(config: TenantSquareConfig): Promise<SquareGiftCardSummary[]> {
  const client = getSquareClientForTenant(config);
  const cards: SquareGiftCardSummary[] = [];

  try {
    let cursor: string | undefined;
    
    do {
      const response = await client.giftCards.list({
        limit: 100,
        cursor,
        locationId: config.locationId,
      });

      if (response.giftCards) {
        for (const card of response.giftCards) {
          if (!card.locationId || card.locationId !== config.locationId) {
            continue;
          }

          const balanceAmount = card.balanceMoney?.amount ? Number(card.balanceMoney.amount) : 0;
          
          let status: SquareGiftCardSummary['status'] = 'ACTIVE';
          if (card.state === 'PENDING') status = 'PENDING';
          else if (card.state === 'DEACTIVATED') status = 'VOID';
          else if (balanceAmount === 0) status = 'REDEEMED';

          const gan = card.gan || '';
          
          cards.push({
            providerCardId: card.id!,
            gan,
            referenceCode: gan ? gan.slice(-4) : card.id!.slice(-4),
            balanceCents: balanceAmount,
            currency: card.balanceMoney?.currency || 'USD',
            status,
            metadata: {
              createdAt: card.createdAt,
              type: card.type,
              ganSource: card.ganSource,
              locationId: card.locationId,
            },
          });
        }
      }

      cursor = response.cursor;
    } while (cursor);

    console.log(`${LOG_PREFIX} Retrieved ${cards.length} gift cards from Square for location ${config.locationId}`);
    return cards;
  } catch (error: any) {
    console.error(`${LOG_PREFIX} Error listing gift cards from Square:`, error.message || error);
    throw new Error(`Failed to list gift cards from Square: ${error.message || 'Unknown error'}`);
  }
}

export async function syncGiftCardsForTenant(tenantId: string): Promise<GiftCardSyncResult> {
  const result: GiftCardSyncResult = {
    success: false,
    created: 0,
    updated: 0,
    errors: [],
  };

  const config = await getTenantSquareConfig(tenantId);
  if (!config) {
    result.errors.push('Square is not configured for this tenant. Please add Square credentials in tenant settings.');
    return result;
  }

  try {
    const squareCards = await listGiftCardsFromSquare(config);
    const tenantDb = wrapTenantDb(tenantId);

    for (const card of squareCards) {
      try {
        const existing = await tenantDb
          .select()
          .from(giftCards)
          .where(
            and(
              eq(giftCards.tenantId, tenantId),
              eq(giftCards.provider, 'square'),
              eq(giftCards.providerCardId, card.providerCardId)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          await tenantDb
            .update(giftCards)
            .set({
              currentBalanceCents: card.balanceCents,
              status: card.status,
              metadata: { ...card.metadata, gan: card.gan },
              updatedAt: new Date(),
            })
            .where(eq(giftCards.id, existing[0].id));
          result.updated++;
        } else {
          await tenantDb.insert(giftCards).values({
            tenantId,
            provider: 'square',
            providerCardId: card.providerCardId,
            referenceCode: card.referenceCode,
            initialAmountCents: card.balanceCents,
            currentBalanceCents: card.balanceCents,
            currency: card.currency,
            status: card.status,
            metadata: { ...card.metadata, gan: card.gan },
          });
          result.created++;
        }
      } catch (cardError: any) {
        result.errors.push(`Card ${card.providerCardId}: ${cardError.message}`);
      }
    }

    result.success = true;
    console.log(`${LOG_PREFIX} Sync complete for tenant ${tenantId}: ${result.created} created, ${result.updated} updated`);
    return result;
  } catch (error: any) {
    result.errors.push(error.message || 'Unknown sync error');
    console.error(`${LOG_PREFIX} Sync failed for tenant ${tenantId}:`, error);
    return result;
  }
}

export async function validateGiftCardCode(
  tenantId: string,
  giftCardCode: string
): Promise<GiftCardValidation> {
  if (!tenantId) {
    return { valid: false, error: 'Invalid tenant context' };
  }

  const normalizedCode = giftCardCode.trim().toUpperCase();
  const isFullGan = normalizedCode.length > 8;
  
  const tenantDb = wrapTenantDb(tenantId);

  try {
    const allTenantCards = await tenantDb
      .select()
      .from(giftCards)
      .where(eq(giftCards.tenantId, tenantId));

    let matchingCards: typeof allTenantCards = [];

    if (isFullGan) {
      matchingCards = allTenantCards.filter(card => {
        const metadata = card.metadata as Record<string, any> || {};
        const storedGan = (metadata.gan || '').toUpperCase();
        return storedGan === normalizedCode || card.providerCardId === normalizedCode;
      });
    } else {
      matchingCards = allTenantCards.filter(card => 
        card.referenceCode === normalizedCode || 
        card.providerCardId === normalizedCode
      );

      if (matchingCards.length > 1) {
        return { 
          valid: false, 
          error: 'Multiple cards match this code. Please enter the full 16-digit gift card number from the back of the card.' 
        };
      }
    }

    if (matchingCards.length === 0) {
      return { valid: false, error: 'Gift card not found' };
    }

    const card = matchingCards[0];

    if (card.status !== 'ACTIVE') {
      return { valid: false, error: `Gift card is ${card.status.toLowerCase()}` };
    }

    if (card.currentBalanceCents <= 0) {
      return { valid: false, error: 'Gift card has no remaining balance' };
    }

    return {
      valid: true,
      giftCardId: card.id,
      currentBalanceCents: card.currentBalanceCents,
      status: card.status,
      currency: card.currency,
      referenceCode: card.referenceCode,
    };
  } catch (error: any) {
    console.error(`${LOG_PREFIX} Error validating gift card:`, error);
    return { valid: false, error: 'Failed to validate gift card' };
  }
}

export function applyGiftCardToAmount(
  giftCardBalanceCents: number,
  bookingAmountCents: number
): GiftCardApplication {
  const appliedCents = Math.min(giftCardBalanceCents, bookingAmountCents);
  const remainingCardBalanceCents = giftCardBalanceCents - appliedCents;
  const newBookingAmountCents = bookingAmountCents - appliedCents;

  return {
    appliedCents,
    remainingCardBalanceCents,
    newBookingAmountCents,
  };
}

export async function recordRedemption(
  tenantId: string,
  giftCardId: number,
  amountCents: number,
  bookingId?: number,
  metadata?: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  if (!tenantId) {
    return { success: false, error: 'Invalid tenant context' };
  }

  const tenantDb = wrapTenantDb(tenantId);

  try {
    const cards = await tenantDb
      .select()
      .from(giftCards)
      .where(
        and(
          eq(giftCards.id, giftCardId),
          eq(giftCards.tenantId, tenantId)
        )
      )
      .limit(1);

    if (cards.length === 0) {
      return { success: false, error: 'Gift card not found for this tenant' };
    }

    const card = cards[0];
    const newBalance = card.currentBalanceCents - amountCents;

    if (newBalance < 0) {
      return { success: false, error: 'Insufficient gift card balance' };
    }

    await tenantDb.transaction(async (tx) => {
      await tx.insert(giftCardRedemptions).values({
        tenantId,
        giftCardId,
        bookingId,
        amountCents,
        metadata: metadata || {},
      });

      await tx
        .update(giftCards)
        .set({
          currentBalanceCents: newBalance,
          status: newBalance === 0 ? 'REDEEMED' : 'ACTIVE',
          updatedAt: new Date(),
        })
        .where(eq(giftCards.id, giftCardId));
    });

    console.log(`${LOG_PREFIX} Recorded redemption: $${(amountCents / 100).toFixed(2)} from card ${giftCardId} for tenant ${tenantId}`);
    return { success: true };
  } catch (error: any) {
    console.error(`${LOG_PREFIX} Error recording redemption:`, error);
    return { success: false, error: 'Failed to record redemption' };
  }
}

export async function getGiftCardsForTenant(tenantId: string): Promise<{
  cards: GiftCard[];
  summary: {
    totalCards: number;
    activeCards: number;
    redeemedCards: number;
    totalInitialCents: number;
    totalCurrentBalanceCents: number;
    totalRedeemedCents: number;
  };
}> {
  const tenantDb = wrapTenantDb(tenantId);

  const cards = await tenantDb
    .select()
    .from(giftCards)
    .where(eq(giftCards.tenantId, tenantId))
    .orderBy(giftCards.createdAt);

  const summary = {
    totalCards: cards.length,
    activeCards: cards.filter(c => c.status === 'ACTIVE').length,
    redeemedCards: cards.filter(c => c.status === 'REDEEMED').length,
    totalInitialCents: cards.reduce((sum, c) => sum + c.initialAmountCents, 0),
    totalCurrentBalanceCents: cards.reduce((sum, c) => sum + c.currentBalanceCents, 0),
    totalRedeemedCents: cards.reduce((sum, c) => sum + (c.initialAmountCents - c.currentBalanceCents), 0),
  };

  return { cards, summary };
}

export async function getSquareConfigStatus(tenantId: string): Promise<{
  provider: string;
  configured: boolean;
  message: string;
}> {
  const config = await getTenantSquareConfig(tenantId);
  
  if (!config) {
    const messageForRoot = tenantId === 'root' 
      ? 'Square is not configured. Set SQUARE_ACCESS_TOKEN and SQUARE_LOCATION_ID in environment.'
      : 'Square is not configured for this tenant. Add squareAccessToken and squareLocationId to tenant settings.';
    
    return {
      provider: 'square',
      configured: false,
      message: messageForRoot,
    };
  }

  return {
    provider: 'square',
    configured: true,
    message: 'Square is configured and ready to sync gift cards.',
  };
}
