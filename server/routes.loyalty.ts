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
  getRewardServicesForDashboard
} from './loyaltyService';

/**
 * Register loyalty program routes
 */
export function registerLoyaltyRoutes(app: Express) {
  // Get loyalty points by phone number
  app.get('/api/loyalty/points/phone/:phone', async (req: Request, res: Response) => {
    try {
      const { phone } = req.params;
      const result = await getLoyaltyPointsByPhone(phone);
      
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
  
  // Get loyalty points by email
  app.get('/api/loyalty/points/email/:email', async (req: Request, res: Response) => {
    try {
      const { email } = req.params;
      const result = await getLoyaltyPointsByEmail(email);
      
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
  
  // Get available loyalty offers
  app.get('/api/loyalty/rewards', async (_req: Request, res: Response) => {
    try {
      const rewards = await getAvailableRewardServices();
      
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
  app.post('/api/loyalty/redeem', async (req: Request, res: Response) => {
    try {
      const { customerId, rewardServiceId, quantity } = req.body;
      
      if (!customerId || !rewardServiceId) {
        return res.status(400).json({ 
          success: false, 
          message: 'Customer ID and Reward Service ID are required'
        });
      }
      
      const result = await redeemPointsForReward(
        Number(customerId), 
        Number(rewardServiceId),
        quantity ? Number(quantity) : 1
      );
      
      res.json({ 
        success: true, 
        data: result
      });
    } catch (error) {
      console.error('Error redeeming points:', error);
      res.status(400).json({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Failed to redeem points',
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
      
      const result = await optInToLoyaltyProgram(Number(customerId));
      
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
      
      const redeemedRewards = await getRedeemedRewards(Number(customerId));
      
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
  app.get('/api/loyalty/points', async (_req: Request, res: Response) => {
    try {
      const points = await getAllLoyaltyPoints();
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
  app.get('/api/loyalty/customers', async (_req: Request, res: Response) => {
    try {
      const customerList = await getAllCustomers();
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
  app.get('/api/loyalty/transactions', async (_req: Request, res: Response) => {
    try {
      const transactionList = await getAllTransactions();
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
  app.get('/api/loyalty/tiers', async (_req: Request, res: Response) => {
    try {
      const tierList = await getAllLoyaltyTiers();
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
  app.get('/api/loyalty/achievements', async (_req: Request, res: Response) => {
    try {
      const achievementList = await getAllAchievements();
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
  app.get('/api/loyalty/customer-achievements', async (_req: Request, res: Response) => {
    try {
      const customerAchievementList = await getAllCustomerAchievements();
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
  app.get('/api/loyalty/redeemed-rewards', async (_req: Request, res: Response) => {
    try {
      const redeemed = await getAllRedeemedRewards();
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
  app.get('/api/loyalty/reward-services', async (_req: Request, res: Response) => {
    try {
      const services = await getRewardServicesForDashboard();
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