import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { hasFeature } from '@shared/features';
import { db } from './db';
import { tenants } from '@shared/schema';
import { eq } from 'drizzle-orm';
import {
  getTenantWelcomeBackCampaignConfig,
  updateTenantWelcomeBackCampaignConfig,
  sendTenantWelcomeBackCampaign,
  type TenantWelcomeBackCampaignConfig,
  type CampaignAudience,
} from './services/tenantWelcomeBackCampaignService';

const router = Router();

/**
 * ServicePro v3 - Welcome Back Campaign Routes
 * Multi-tenant, white-label loyalty bonus campaign system
 */

// SECURITY: Require authentication for all campaign routes
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }
  next();
}

// Feature gating: campaigns feature required
async function requireCampaignsFeature(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = (req as any).tenant?.id || 'root';
    const [tenantRecord] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
    
    if (!tenantRecord) {
      return res.status(404).json({
        success: false,
        error: 'Tenant not found'
      });
    }

    if (!hasFeature(tenantRecord, 'campaigns')) {
      return res.status(403).json({
        success: false,
        error: 'Campaigns feature requires Pro plan or higher'
      });
    }

    // Attach tenant to request for downstream use
    (req as any).tenantRecord = tenantRecord;
    next();
  } catch (error) {
    console.error('[WELCOME_BACK] Feature gating error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to verify feature access'
    });
  }
}

// Apply middleware to all routes
router.use(requireAuth);
router.use(requireCampaignsFeature);

/**
 * GET /api/admin/campaigns/welcome-back
 * Get campaign configuration for current tenant
 */
router.get('/welcome-back', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenant?.id || 'root';
    const tenantDb = (req as any).tenantDb!;
    
    const config = await getTenantWelcomeBackCampaignConfig(tenantDb, tenantId);
    
    res.json({
      success: true,
      config,
    });
  } catch (error) {
    console.error('[WELCOME_BACK] Error fetching config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch campaign configuration'
    });
  }
});

/**
 * PUT /api/admin/campaigns/welcome-back
 * Update campaign configuration for current tenant
 */
const updateConfigSchema = z.object({
  vipPointsBonus: z.number().int().min(0).max(10000).optional(),
  regularPointsBonus: z.number().int().min(0).max(10000).optional(),
  smsTemplateVip: z.string().min(10).max(1600).optional(),
  smsTemplateRegular: z.string().min(10).max(1600).optional(),
  emailTemplateVip: z.string().optional(),
  emailTemplateRegular: z.string().optional(),
  bookingBaseUrl: z.string().url().optional(),
  rewardsBaseUrl: z.string().url().optional(),
  qrUrlVip: z.string().url().optional().or(z.literal('')),
  qrUrlRegular: z.string().url().optional().or(z.literal('')),
});

router.put('/welcome-back', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenant?.id || 'root';
    const tenantDb = (req as any).tenantDb!;
    
    // Validate request body
    const validation = updateConfigSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid campaign configuration',
        details: validation.error.errors,
      });
    }

    const updated = await updateTenantWelcomeBackCampaignConfig(
      tenantDb,
      tenantId,
      validation.data
    );
    
    res.json({
      success: true,
      config: updated,
    });
  } catch (error) {
    console.error('[WELCOME_BACK] Error updating config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update campaign configuration'
    });
  }
});

/**
 * POST /api/admin/campaigns/welcome-back/send
 * Send campaign to VIP or Regular audience
 */
const sendCampaignSchema = z.object({
  audience: z.enum(['vip', 'regular']),
  previewOnly: z.boolean().optional().default(false),
});

router.post('/welcome-back/send', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenant?.id || 'root';
    const tenantDb = (req as any).tenantDb!;
    
    // Validate request body
    const validation = sendCampaignSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid send request',
        details: validation.error.errors,
      });
    }

    const { audience, previewOnly } = validation.data;
    
    console.log(`[WELCOME_BACK] ${previewOnly ? 'Previewing' : 'Sending'} ${audience} campaign for tenant ${tenantId}`);

    const result = await sendTenantWelcomeBackCampaign(tenantDb, {
      tenantId,
      audience,
      previewOnly,
    });
    
    res.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error('[WELCOME_BACK] Error sending campaign:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send campaign'
    });
  }
});

export default router;
