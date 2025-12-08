import { Express, Request, Response } from 'express';
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
import { wrapTenantDb } from './tenantDb';
import { db } from './db';

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
        data: result
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
        data: result
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
  app.post('/api/loyalty/redeem', async (req: Request, res: Response) => {
    try {
      const { customerId, rewardServiceId, quantity, cartTotal, lineItems, skipGuardrails } = req.body;
      
      if (!customerId || !rewardServiceId) {
        return res.status(400).json({ 
          success: false, 
          message: 'Customer ID and Reward Service ID are required'
        });
      }
      
      // Get tenant context
      const tenantId = (req.session as any)?.tenantId || 'root';
      const tenantDb = wrapTenantDb(db, tenantId);
      
      // Check if user is admin (for skip guardrails permission)
      const isAdmin = (req.session as any)?.role === 'owner' || (req.session as any)?.role === 'admin';
      
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
  app.get('/api/loyalty/guardrails', async (req: Request, res: Response) => {
    try {
      const tenantId = (req.session as any)?.tenantId || 'root';
      const settings = await getLoyaltyGuardrailSettings(tenantId);
      res.json({ 
        success: true, 
        data: settings
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
  app.get('/api/loyalty/points', async (req: Request, res: Response) => {
    try {
      const tenantId = (req.session as any)?.tenantId || 'root';
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
  app.get('/api/loyalty/customers', async (req: Request, res: Response) => {
    try {
      const tenantId = (req.session as any)?.tenantId || 'root';
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
  app.get('/api/loyalty/transactions', async (req: Request, res: Response) => {
    try {
      const tenantId = (req.session as any)?.tenantId || 'root';
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
  app.get('/api/loyalty/tiers', async (req: Request, res: Response) => {
    try {
      const tenantId = (req.session as any)?.tenantId || 'root';
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
  app.get('/api/loyalty/achievements', async (req: Request, res: Response) => {
    try {
      const tenantId = (req.session as any)?.tenantId || 'root';
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
  app.get('/api/loyalty/customer-achievements', async (req: Request, res: Response) => {
    try {
      const tenantId = (req.session as any)?.tenantId || 'root';
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
  app.get('/api/loyalty/redeemed-rewards', async (req: Request, res: Response) => {
    try {
      const tenantId = (req.session as any)?.tenantId || 'root';
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
  app.get('/api/loyalty/reward-services', async (req: Request, res: Response) => {
    try {
      const tenantId = (req.session as any)?.tenantId || 'root';
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