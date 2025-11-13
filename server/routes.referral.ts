import { Express, Request, Response } from 'express';
import { requireAuth } from './authMiddleware';
import {
  generateReferralCode,
  getReferralsByReferrer,
  getReferralStats,
  validateReferralCode,
  trackReferralSignup,
  getOrCreateReferralCode,
} from './referralService';

/**
 * Register referral program routes
 * Status flow: pending → signed_up → first_service_completed → rewarded
 */
export function registerReferralRoutes(app: Express) {
  
  /**
   * Get or create referral code for a customer
   * Returns existing pending code or generates new one
   * Auth: Requires authenticated customer or admin
   */
  app.get('/api/referral/code/:customerId', requireAuth, async (req: Request, res: Response) => {
    try {
      const customerId = Number(req.params.customerId);
      
      if (isNaN(customerId)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid customer ID'
        });
      }
      
      const result = await getOrCreateReferralCode(customerId);
      
      if (!result.success) {
        return res.status(400).json(result);
      }
      
      res.json({ 
        success: true, 
        data: { code: result.code },
        message: result.message
      });
    } catch (error) {
      console.error('Error getting referral code:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to retrieve referral code',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  /**
   * Get referral statistics for a customer
   * Returns total referrals, pending, completed, and points earned
   * Auth: Requires authenticated customer or admin
   */
  app.get('/api/referral/stats/:customerId', requireAuth, async (req: Request, res: Response) => {
    try {
      const customerId = Number(req.params.customerId);
      
      if (isNaN(customerId)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid customer ID'
        });
      }
      
      const stats = await getReferralStats(customerId);
      
      if (!stats) {
        return res.status(404).json({ 
          success: false, 
          message: 'Failed to retrieve referral stats'
        });
      }
      
      res.json({ 
        success: true, 
        data: stats
      });
    } catch (error) {
      console.error('Error getting referral stats:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to retrieve referral statistics',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  /**
   * Get list of all referrals made by a customer
   * Returns array of referral records with status and timestamps
   * Auth: Requires authenticated customer or admin
   */
  app.get('/api/referral/list/:customerId', requireAuth, async (req: Request, res: Response) => {
    try {
      const customerId = Number(req.params.customerId);
      
      if (isNaN(customerId)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid customer ID'
        });
      }
      
      const referrals = await getReferralsByReferrer(customerId);
      
      res.json({ 
        success: true, 
        data: referrals
      });
    } catch (error) {
      console.error('Error getting referral list:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to retrieve referral list',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  /**
   * Validate a referral code
   * Checks if code exists, is not expired, and is available to use
   * Public endpoint - no auth required
   */
  app.post('/api/referral/validate', async (req: Request, res: Response) => {
    try {
      const { code } = req.body;
      
      if (!code || typeof code !== 'string') {
        return res.status(400).json({ 
          success: false, 
          message: 'Referral code is required'
        });
      }
      
      // Normalize code to uppercase
      const normalizedCode = code.trim().toUpperCase();
      
      const result = await validateReferralCode(normalizedCode);
      
      res.json({ 
        success: result.valid,
        message: result.message,
        data: result.valid ? { valid: true } : null
      });
    } catch (error) {
      console.error('Error validating referral code:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to validate referral code',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  /**
   * Track referral signup when a new customer uses a referral code
   * Marks code as used and records referee contact information
   * Public endpoint - called during signup/booking flow
   */
  app.post('/api/referral/signup', async (req: Request, res: Response) => {
    try {
      const { code, phone, email, name, customerId } = req.body;
      
      if (!code || typeof code !== 'string') {
        return res.status(400).json({ 
          success: false, 
          message: 'Referral code is required'
        });
      }
      
      // Require at least phone or email
      if (!phone && !email) {
        return res.status(400).json({ 
          success: false, 
          message: 'Phone or email is required'
        });
      }
      
      // Normalize code to uppercase
      const normalizedCode = code.trim().toUpperCase();
      
      const result = await trackReferralSignup(normalizedCode, {
        phone: phone?.trim(),
        email: email?.trim().toLowerCase(),
        name: name?.trim(),
        customerId: customerId ? Number(customerId) : undefined,
      });
      
      if (!result.success) {
        return res.status(400).json(result);
      }
      
      res.json({ 
        success: true, 
        message: result.message,
        data: { referralId: result.referralId }
      });
    } catch (error) {
      console.error('Error tracking referral signup:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to track referral signup',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
}
