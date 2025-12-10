import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  syncGiftCardsForTenant,
  validateGiftCardCode,
  applyGiftCardToAmount,
  getGiftCardsForTenant,
  recordRedemption,
  getSquareConfigStatus,
} from './services/giftCardSquareService';

const router = Router();
const LOG_PREFIX = '[GIFT CARDS API]';

const applyGiftCardSchema = z.object({
  tenantId: z.string().min(1, 'Tenant ID is required'),
  giftCardCode: z.string().min(1),
  currentAmountCents: z.number().int().min(0),
});

const redeemGiftCardSchema = z.object({
  tenantId: z.string().min(1, 'Tenant ID is required'),
  giftCardId: z.number().int(),
  amountCents: z.number().int().min(1),
  bookingId: z.number().int().optional(),
  metadata: z.record(z.any()).optional(),
});

// ==================== ADMIN ROUTES ====================

router.get('/admin/gift-cards/config', async (req: Request, res: Response) => {
  try {
    const tenantId = req.session?.tenantId;
    
    if (!tenantId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const status = await getSquareConfigStatus(tenantId);
    return res.json(status);
  } catch (error: any) {
    console.error(`${LOG_PREFIX} Error checking config:`, error);
    return res.status(500).json({ error: 'Failed to check configuration' });
  }
});

router.post('/admin/gift-cards/sync', async (req: Request, res: Response) => {
  try {
    const tenantId = req.session?.tenantId;
    
    if (!tenantId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    console.log(`${LOG_PREFIX} POST /admin/gift-cards/sync - tenant="${tenantId}"`);

    const result = await syncGiftCardsForTenant(tenantId);
    
    return res.json({
      success: result.success,
      created: result.created,
      updated: result.updated,
      errors: result.errors,
    });
  } catch (error: any) {
    console.error(`${LOG_PREFIX} Sync error:`, error);
    return res.status(500).json({ error: error.message || 'Failed to sync gift cards' });
  }
});

router.get('/admin/gift-cards', async (req: Request, res: Response) => {
  try {
    const tenantId = req.session?.tenantId;
    
    if (!tenantId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    console.log(`${LOG_PREFIX} GET /admin/gift-cards - tenant="${tenantId}"`);

    const { cards, summary } = await getGiftCardsForTenant(tenantId);

    return res.json({
      cards,
      summary,
    });
  } catch (error: any) {
    console.error(`${LOG_PREFIX} Error fetching gift cards:`, error);
    return res.status(500).json({ error: 'Failed to fetch gift cards' });
  }
});

// ==================== PUBLIC ROUTES ====================

router.post('/public/gift-cards/apply', async (req: Request, res: Response) => {
  try {
    const parsed = applyGiftCardSchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json({ 
        valid: false, 
        error: parsed.error.errors[0]?.message || 'Invalid request body' 
      });
    }

    const { tenantId, giftCardCode, currentAmountCents } = parsed.data;

    if (tenantId === 'root') {
      return res.status(400).json({ valid: false, error: 'Invalid tenant context' });
    }

    console.log(`${LOG_PREFIX} POST /public/gift-cards/apply - code="${giftCardCode}", tenant="${tenantId}"`);

    const validation = await validateGiftCardCode(tenantId, giftCardCode);

    if (!validation.valid) {
      return res.json({
        valid: false,
        error: validation.error,
      });
    }

    const application = applyGiftCardToAmount(
      validation.currentBalanceCents!,
      currentAmountCents
    );

    return res.json({
      valid: true,
      giftCardId: validation.giftCardId,
      referenceCode: validation.referenceCode,
      originalBalanceCents: validation.currentBalanceCents,
      appliedCents: application.appliedCents,
      remainingCardBalanceCents: application.remainingCardBalanceCents,
      newAmountCents: application.newBookingAmountCents,
      currency: validation.currency,
    });
  } catch (error: any) {
    console.error(`${LOG_PREFIX} Apply error:`, error);
    return res.status(500).json({ valid: false, error: 'Failed to apply gift card' });
  }
});

router.post('/public/gift-cards/redeem', async (req: Request, res: Response) => {
  try {
    const parsed = redeemGiftCardSchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json({ 
        success: false, 
        error: parsed.error.errors[0]?.message || 'Invalid request body' 
      });
    }

    const { tenantId, giftCardId, amountCents, bookingId, metadata } = parsed.data;

    if (tenantId === 'root') {
      return res.status(400).json({ success: false, error: 'Invalid tenant context' });
    }

    console.log(`${LOG_PREFIX} POST /public/gift-cards/redeem - cardId=${giftCardId}, amount=${amountCents}, tenant="${tenantId}"`);

    const result = await recordRedemption(tenantId, giftCardId, amountCents, bookingId, metadata);

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    return res.json({ success: true });
  } catch (error: any) {
    console.error(`${LOG_PREFIX} Redeem error:`, error);
    return res.status(500).json({ success: false, error: 'Failed to redeem gift card' });
  }
});

export function registerGiftCardRoutes(app: any) {
  app.use('/api', router);
  console.log(`${LOG_PREFIX} Routes registered: /api/admin/gift-cards, /api/public/gift-cards`);
}

export default router;
