import { Express, Request, Response } from 'express';
import crypto from 'crypto';
import { requireAuth } from './authMiddleware';
import {
  getLoyaltyPointsByPhone,
  getLoyaltyPointsByEmail,
  getAvailableRewardServices,
  redeemPointsForReward,
  optInToLoyaltyProgram,
  getRedeemedRewards,
  getAllLoyaltyPoints,
  getAllCustomers,
  getAllTransactions,
  getAllLoyaltyTiers,
  getAllAchievements,
  getAllCustomerAchievements,
  getAllRedeemedRewards,
  getRewardServicesForDashboard,
  LoyaltyGuardrailError,
  validateLoyaltyRedemption
} from './loyaltyService';
import { getLoyaltyGuardrailSettings } from './gamificationService';
import { adjust as ledgerAdjust } from './services/loyaltyLedger';
import { wrapTenantDb } from './tenantDb';
import { db } from './db';

const REWARDS_TOKEN_SECRET = process.env.REWARDS_TOKEN_SECRET || process.env.SESSION_SECRET;
if (!REWARDS_TOKEN_SECRET) {
  throw new Error('REWARDS_TOKEN_SECRET or SESSION_SECRET must be set in environment variables');
}
const DEFAULT_TOKEN_EXPIRY_DAYS = 30;

export function generateRewardsToken(phone: string, tenantId: string = 'root', expiryDays: number = DEFAULT_TOKEN_EXPIRY_DAYS): string {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + expiryDays);
  const expiryTimestamp = expiry.getTime();
  const payload = `${phone}:${tenantId}:${expiryTimestamp}`;
  const signature = crypto.createHmac('sha256', REWARDS_TOKEN_SECRET)
    .update(payload)
    .digest('hex');
  return Buffer.from(`${payload}:${signature}`).toString('base64url');
}

export function validateRewardsToken(token: string): { phone: string; tenantId: string; expired: boolean } | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf-8');
    const parts = decoded.split(':');
    if (parts.length !== 4) return null;
    const [phone, tenantId, expiryTimestamp, signature] = parts;
    const payload = `${phone}:${tenantId}:${expiryTimestamp}`;
    const expectedSignature = crypto.createHmac('sha256', REWARDS_TOKEN_SECRET)
      .update(payload)
      .digest('hex');
    if (signature !== expectedSignature) return null;
    const expired = Date.now() > parseInt(expiryTimestamp, 10);
    return { phone, tenantId, expired };
  } catch {
    return null;
  }
}

/**
 * Register loyalty program routes
 * 
 * Customer Rewards Portal V2 - Public endpoints for customer-facing rewards lookup:
 * - GET /api/loyalty/points/phone/:phone - Phone lookup (public)
 * - GET /api/loyalty/points/email/:email - Email lookup (public)
 * - GET /api/loyalty/rewards - Rewards catalog (public)
 * - GET /api/loyalty/guardrails - Redemption requirements (public)
 * 
 * Loyalty Redemption Journey v2 - Validation and redemption:
 * - POST /api/loyalty/validate-redemption - Validate before booking (public)
 * - POST /api/loyalty/redeem - Finalize redemption (requires customer context)
 */
export function registerLoyaltyRoutes(app: Express) {
  // CM-REWARDS-WELCOME-LANDING: Get loyalty points by token (PUBLIC)
  app.get('/api/loyalty/points/token/:token', async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      const validated = validateRewardsToken(token);
      
      if (!validated) {
        return res.status(401).json({
          success: false,
          message: 'This link is invalid. Please contact us for a new link.',
          expired: false
        });
      }
      
      if (validated.expired) {
        return res.status(401).json({
          success: false,
          message: 'This link has expired. Please contact us for a new link.',
          expired: true
        });
      }
      
      const { phone, tenantId } = validated;
      const tenantDb = wrapTenantDb(db, tenantId);
      
      const result = await getLoyaltyPointsByPhone(tenantDb, phone);
      
      if (!result) {
        return res.status(404).json({
          success: false,
          message: 'Customer not found',
          expired: false
        });
      }
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error getting loyalty points by token:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve loyalty points information',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Strips PII fields that should never appear in a public loyalty portal response.
  // The customer already knows their own name/points; we must not expose address,
  // email, vehicle details, or any internal database ID to an unauthenticated caller.
  function scrubLoyaltyCustomerPii(result: any) {
    if (!result || !result.customer) return result;
    const { address, email, vehicleInfo, lifetimeValue, ...safeCustomer } = result.customer;
    return { ...result, customer: safeCustomer };
  }

  // Get loyalty points by phone number (PUBLIC - Customer Rewards Portal V2)
  app.get('/api/loyalty/points/phone/:phone', async (req: Request, res: Response) => {
    try {
      const { phone } = req.params;
      // Use session tenantId if authenticated, otherwise default to root for public access
      const tenantId = (req.session as any)?.tenantId || 'root';
      const tenantDb = wrapTenantDb(db, tenantId);
      
      const result = await getLoyaltyPointsByPhone(tenantDb, phone);
      
      if (!result) {
        return res.status(404).json({ 
          success: false, 
          message: 'Customer not found with that phone number'
        });
      }
      
      res.json({ 
        success: true, 
        data: scrubLoyaltyCustomerPii(result)
      });
    } catch (error) {
      console.error('Error getting loyalty points by phone:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to retrieve loyalty points information',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Get loyalty points by email (PUBLIC - Customer Rewards Portal V2)
  app.get('/api/loyalty/points/email/:email', async (req: Request, res: Response) => {
    try {
      const { email } = req.params;
      // Use session tenantId if authenticated, otherwise default to root for public access
      const tenantId = (req.session as any)?.tenantId || 'root';
      const tenantDb = wrapTenantDb(db, tenantId);
      
      const result = await getLoyaltyPointsByEmail(tenantDb, email);
      
      if (!result) {
        return res.status(404).json({ 
          success: false, 
          message: 'Customer not found with that email address'
        });
      }
      
      res.json({ 
        success: true, 
        data: scrubLoyaltyCustomerPii(result)
      });
    } catch (error) {
      console.error('Error getting loyalty points by email:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to retrieve loyalty points information',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Get available loyalty offers (PUBLIC - Customer Rewards Portal V2)
  app.get('/api/loyalty/rewards', async (req: Request, res: Response) => {
    try {
      // Use session tenantId if authenticated, otherwise default to root for public access
      const tenantId = (req.session as any)?.tenantId || 'root';
      const tenantDb = wrapTenantDb(db, tenantId);
      
      const rewards = await getAvailableRewardServices(tenantDb);
      
      res.json({ 
        success: true, 
        data: rewards
      });
    } catch (error) {
      console.error('Error getting loyalty offers:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to retrieve loyalty offers',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Redeem loyalty points for an offer
  // Now includes guardrail checks for cart total and core service requirements
  app.post('/api/loyalty/redeem', requireAuth, async (req: Request, res: Response) => {
    try {
      const { customerId, rewardServiceId, quantity, cartTotal, lineItems, skipGuardrails } = req.body;
      
      if (!customerId || !rewardServiceId) {
        return res.status(400).json({ 
          success: false, 
          message: 'Customer ID and Reward Service ID are required'
        });
      }

      // RLOY-3: verify caller is authorized for this customer
      const sessionCustomerId = (req.session as any)?.customerId;
      const userRole = (req as any).user?.role;
      if (!['owner', 'manager'].includes(userRole) && sessionCustomerId !== customerId) {
        return res.status(403).json({ success: false, message: 'Not authorized' });
      }
      
      // Get tenant context
      const tenantId = (req as any).user?.tenantId || (req.session as any)?.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: 'Tenant context required' });
      }
      const tenantDb = wrapTenantDb(db, tenantId);
      
      // Check if user is admin (for skip guardrails permission)
      const isAdmin = (req.session as any)?.role === 'owner' || (req.session as any)?.role === 'admin';
      
      // One token per HTTP request → retries of the SAME request dedupe at the
      // ledger; separate requests get fresh tokens, so a customer can legitimately
      // redeem the same reward again later. Combined with per-unit suffix in the
      // facade (`${token}:${i}`), each unit gets a unique stable ledger key.
      const idempotencyToken = crypto.randomUUID();

      const result = await redeemPointsForReward(
        tenantDb,
        Number(customerId), 
        Number(rewardServiceId),
        quantity ? Number(quantity) : 1,
        {
          cartTotal: typeof cartTotal === 'number' ? cartTotal : undefined,
          lineItems: Array.isArray(lineItems) ? lineItems : undefined,
          skipGuardrails: isAdmin && skipGuardrails === true,
          tenantId,
          idempotencyToken,
        }
      );
      
      res.json({ 
        success: true, 
        data: result
      });
    } catch (error) {
      console.error('Error redeeming points:', error);
      
      // Handle guardrail blocks with specific error response
      if (error instanceof LoyaltyGuardrailError) {
        return res.status(400).json({ 
          success: false, 
          error: 'LOYALTY_GUARDRAIL_BLOCKED',
          code: error.code,
          message: error.message,
        });
      }
      
      res.status(400).json({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Failed to redeem points',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Get loyalty guardrail settings (for frontend to show requirements)
  // L3-FACADE-1 fix: server returns {minCartTotal, requireCoreService, guardrailMessage}
  // but client rewards.tsx expects {minCartTotalEnabled, requireCoreServiceEnabled,
  // coreServiceCategories, loyaltyGuardrailMessage}. Transform at the route boundary
  // so neither the underlying service nor the client need to change.
  app.get('/api/loyalty/guardrails', async (req: Request, res: Response) => {
    try {
      const tenantId = (req.session as any)?.tenantId || 'root';
      const settings = await getLoyaltyGuardrailSettings(tenantId);

      const minCartTotalEnabled =
        typeof settings.minCartTotal === 'number' && settings.minCartTotal > 0;

      res.json({
        success: true,
        data: {
          minCartTotalEnabled,
          minCartTotal: settings.minCartTotal ?? 0,
          requireCoreServiceEnabled: settings.requireCoreService === true,
          // coreServiceCategories is not modeled on the server yet — return an
          // empty array so the client's typed shape is satisfied. When category
          // selectivity ships, surface real values here.
          coreServiceCategories: [] as string[],
          loyaltyGuardrailMessage: settings.guardrailMessage ?? '',
        },
      });
    } catch (error) {
      console.error('Error fetching guardrail settings:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to retrieve guardrail settings',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // LOY-20: Staff manual points adjustment. Backs the "Add Points" dialog in
  // LoyaltyPointsSystem.tsx — which was POSTing to a 404 until now.
  // Delegates to loyaltyLedger.adjust() so audit trail, idempotency, and
  // negative-balance clamping all live in one place.
  app.post('/api/loyalty/add-points', requireAuth, async (req: Request, res: Response) => {
    try {
      const { customerId, points, source, description } = req.body ?? {};

      if (typeof customerId !== 'number' || !Number.isFinite(customerId) || customerId <= 0) {
        return res.status(400).json({ success: false, message: 'customerId (positive number) is required' });
      }
      if (typeof points !== 'number' || !Number.isFinite(points) || points === 0) {
        return res.status(400).json({ success: false, message: 'points (non-zero number) is required' });
      }
      if (typeof source !== 'string' || source.trim().length === 0) {
        return res.status(400).json({ success: false, message: 'source is required' });
      }

      // Tenant from session ONLY — never trust the request body, no fallback.
      const tenantId = (req as any).user?.tenantId || (req.session as any)?.tenantId;
      if (!tenantId) {
        return res.status(401).json({ success: false, message: 'Tenant context required' });
      }

      const actorId = (req as any).user?.id ?? null;
      const tenantDb = wrapTenantDb(db, tenantId);

      // Each HTTP request gets a fresh UUID — staff manual adjustments are NOT
      // expected to retry-dedupe across requests; the goal is that ONE click
      // produces ONE adjustment even if the network retries the same request.
      const idempotencyKey = `staff-adjust:${actorId ?? 'sys'}:${crypto.randomUUID()}`;
      const reason =
        typeof description === 'string' && description.trim().length > 0
          ? description.trim()
          : `Staff adjustment (${source})`;

      const result = await ledgerAdjust(tenantDb, {
        tenantId,
        customerId,
        delta: points,
        reason,
        actorId,
        idempotencyKey,
        metadata: { source, addedVia: 'staff-ui' },
      });

      if (!result.success) {
        return res.status(500).json({ success: false, message: 'Failed to adjust points' });
      }

      // Client (LoyaltyPointsSystem.tsx:316) only reads response.ok on success
      // and toasts a fixed string — no specific fields are consumed. Returning
      // the ledger's adjust-shape here is forward-compatible.
      res.json({
        success: true,
        data: {
          newBalance: result.newBalance,
          clamped: result.clamped,
          alreadyApplied: result.alreadyApplied,
        },
      });
    } catch (error) {
      console.error('Error adding points:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add points',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
  
  /**
   * Loyalty Redemption Journey v2 - Validate redemption eligibility
   * 
   * This endpoint checks if a reward can be redeemed given the current cart/service selection.
   * It does NOT actually redeem - that happens at booking submission time.
   * 
   * Used by the booking flow to show real-time eligibility status and guardrail messaging.
   */
  app.post('/api/loyalty/validate-redemption', async (req: Request, res: Response) => {
    try {
      const { customerId, rewardId, cartTotal, selectedServices } = req.body;
      
      if (!customerId || !rewardId) {
        return res.status(400).json({ 
          success: false, 
          message: 'Customer ID and Reward ID are required'
        });
      }
      
      const tenantId = (req.session as any)?.tenantId || 'root';
      const tenantDb = wrapTenantDb(db, tenantId);
      
      const result = await validateLoyaltyRedemption({
        tenantDb,
        tenantId,
        customerId: Number(customerId),
        rewardId: Number(rewardId),
        cartTotal: typeof cartTotal === 'number' ? cartTotal : 0,
        selectedServices: Array.isArray(selectedServices) ? selectedServices : [],
      });
      
      res.json({ 
        success: true, 
        data: result
      });
    } catch (error) {
      console.error('Error validating redemption:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to validate redemption',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Opt in to loyalty program
  app.post('/api/loyalty/opt-in', async (req: Request, res: Response) => {
    try {
      const { customerId } = req.body;
      
      if (!customerId) {
        return res.status(400).json({ 
          success: false, 
          message: 'Customer ID is required'
        });
      }
      
      const tenantId = (req.session as any)?.tenantId || 'root';
      const tenantDb = wrapTenantDb(db, tenantId);
      const result = await optInToLoyaltyProgram(tenantDb, Number(customerId));
      
      res.json({ 
        success: true, 
        data: result
      });
    } catch (error) {
      console.error('Error opting in to loyalty program:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to opt in to loyalty program',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Get redeemed loyalty offers for a customer
  app.get('/api/loyalty/redeemed/:customerId', async (req: Request, res: Response) => {
    try {
      const { customerId } = req.params;
      
      if (!customerId) {
        return res.status(400).json({ 
          success: false, 
          message: 'Customer ID is required'
        });
      }
      
      const tenantId = (req.session as any)?.tenantId || 'root';
      const tenantDb = wrapTenantDb(db, tenantId);
      const redeemedRewards = await getRedeemedRewards(tenantDb, Number(customerId));
      
      res.json({ 
        success: true, 
        data: redeemedRewards
      });
    } catch (error) {
      console.error('Error getting redeemed loyalty offers:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to retrieve redeemed loyalty offers',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Get all loyalty points (for dashboard)
  app.get('/api/loyalty/points', requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).user?.tenantId || (req.session as any)?.tenantId;
      if (!tenantId) return res.status(401).json({ error: 'Tenant context required' });
      const tenantDb = wrapTenantDb(db, tenantId);
      const points = await getAllLoyaltyPoints(tenantDb);
      res.json({ success: true, loyaltyPoints: points });
    } catch (error) {
      console.error('Error fetching all loyalty points:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to retrieve loyalty points',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Get all customers (for dashboard)
  app.get('/api/loyalty/customers', requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).user?.tenantId || (req.session as any)?.tenantId;
      if (!tenantId) return res.status(401).json({ error: 'Tenant context required' });
      const tenantDb = wrapTenantDb(db, tenantId);
      const customerList = await getAllCustomers(tenantDb);
      res.json({ success: true, customers: customerList });
    } catch (error) {
      console.error('Error fetching all customers:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to retrieve customers',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Get all transactions (for dashboard)
  app.get('/api/loyalty/transactions', requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).user?.tenantId || (req.session as any)?.tenantId;
      if (!tenantId) return res.status(401).json({ error: 'Tenant context required' });
      const tenantDb = wrapTenantDb(db, tenantId);
      const transactionList = await getAllTransactions(tenantDb);
      res.json({ success: true, transactions: transactionList });
    } catch (error) {
      console.error('Error fetching all transactions:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to retrieve transactions',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Get all loyalty tiers (for dashboard)
  app.get('/api/loyalty/tiers', requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).user?.tenantId || (req.session as any)?.tenantId;
      if (!tenantId) return res.status(401).json({ error: 'Tenant context required' });
      const tenantDb = wrapTenantDb(db, tenantId);
      const tierList = await getAllLoyaltyTiers(tenantDb);
      res.json({ success: true, tiers: tierList });
    } catch (error) {
      console.error('Error fetching all loyalty tiers:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to retrieve loyalty tiers',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Get all achievements (for dashboard)
  app.get('/api/loyalty/achievements', requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).user?.tenantId || (req.session as any)?.tenantId;
      if (!tenantId) return res.status(401).json({ error: 'Tenant context required' });
      const tenantDb = wrapTenantDb(db, tenantId);
      const achievementList = await getAllAchievements(tenantDb);
      res.json({ success: true, achievements: achievementList });
    } catch (error) {
      console.error('Error fetching all achievements:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to retrieve achievements',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Get all customer achievements (for dashboard)
  app.get('/api/loyalty/customer-achievements', requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).user?.tenantId || (req.session as any)?.tenantId;
      if (!tenantId) return res.status(401).json({ error: 'Tenant context required' });
      const tenantDb = wrapTenantDb(db, tenantId);
      const customerAchievementList = await getAllCustomerAchievements(tenantDb);
      res.json({ success: true, customerAchievements: customerAchievementList });
    } catch (error) {
      console.error('Error fetching all customer achievements:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to retrieve customer achievements',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Get all redeemed rewards (for dashboard)
  app.get('/api/loyalty/redeemed-rewards', requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).user?.tenantId || (req.session as any)?.tenantId;
      if (!tenantId) return res.status(401).json({ error: 'Tenant context required' });
      const tenantDb = wrapTenantDb(db, tenantId);
      const redeemed = await getAllRedeemedRewards(tenantDb);
      res.json({ success: true, redeemedRewards: redeemed });
    } catch (error) {
      console.error('Error fetching all redeemed rewards:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to retrieve redeemed rewards',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Get all reward services (for dashboard)
  app.get('/api/loyalty/reward-services', requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).user?.tenantId || (req.session as any)?.tenantId;
      if (!tenantId) return res.status(401).json({ error: 'Tenant context required' });
      const tenantDb = wrapTenantDb(db, tenantId);
      const services = await getRewardServicesForDashboard(tenantDb);
      res.json({ success: true, rewardServices: services });
    } catch (error) {
      console.error('Error fetching reward services:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to retrieve reward services',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
}