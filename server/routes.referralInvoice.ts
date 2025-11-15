import { Express, Request, Response } from 'express';
import { db } from './db';
import { referrals, customers, invoices } from '@shared/schema';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { validateReferralCode } from './referralService';
import { getRefereeRewardDescriptor, formatRewardDescription } from './referralConfigService';
import { requireAuth } from './authMiddleware';

/**
 * Register referral invoice routes
 * Allows customers to view referral code properties and apply codes to invoices
 */
export function registerReferralInvoiceRoutes(app: Express) {
  
  /**
   * GET /api/referral/validate/:code
   * Validate a referral code and return its properties
   * Public endpoint - no auth required (customers need to check codes before booking)
   */
  app.get('/api/referral/validate/:code', async (req: Request, res: Response) => {
    try {
      const code = req.params.code.toUpperCase().trim();
      
      if (!code) {
        return res.status(400).json({
          success: false,
          message: 'Referral code is required'
        });
      }
      
      // Validate the code
      const validation = await validateReferralCode(code);
      
      if (!validation.valid) {
        return res.json({
          success: false,
          valid: false,
          message: validation.message || 'Invalid or expired referral code'
        });
      }
      
      // Get referrer information (safe to expose for display)
      const referral = validation.referral;
      let referrerName = 'a friend';
      
      if (referral) {
        const [referrer] = await db
          .select({ name: customers.name })
          .from(customers)
          .where(eq(customers.id, referral.referrerId))
          .limit(1);
        
        if (referrer) {
          referrerName = referrer.name.split(' ')[0]; // First name only
        }
      }
      
      // Get referee reward descriptor
      const rewardDescriptor = await getRefereeRewardDescriptor();
      const rewardDescription = rewardDescriptor ? formatRewardDescription(rewardDescriptor) : '$25 off';
      
      res.json({
        success: true,
        valid: true,
        code: code,
        referrerName,
        reward: rewardDescription,
        rewardType: rewardDescriptor?.rewardType || 'fixed_discount',
        rewardValue: rewardDescriptor?.value || 25,
        expiresAt: referral?.expiresAt || null,
        message: `Valid! Get ${rewardDescription} from ${referrerName}`
      });
    } catch (error) {
      console.error('[REFERRAL VALIDATE] Error:', error);
      res.status(500).json({
        success: false,
        valid: false,
        message: 'Failed to validate referral code'
      });
    }
  });
  
  /**
   * POST /api/invoices/:invoiceId/apply-referral
   * Apply a referral code to an existing invoice
   * Authenticated endpoint - requires user session
   */
  app.post('/api/invoices/:invoiceId/apply-referral', requireAuth, async (req: Request, res: Response) => {
    try {
      const invoiceId = Number(req.params.invoiceId);
      const { referralCode } = req.body;
      
      if (isNaN(invoiceId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid invoice ID'
        });
      }
      
      if (!referralCode || typeof referralCode !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Referral code is required'
        });
      }
      
      const code = referralCode.toUpperCase().trim();
      const user = (req as any).user;
      
      // Use transaction for atomic discount application
      const result = await db.transaction(async (tx) => {
        // Get and lock the invoice row
        const [invoice] = await tx
          .select()
          .from(invoices)
          .where(eq(invoices.id, invoiceId))
          .limit(1);
        
        if (!invoice) {
          throw new Error('Invoice not found');
        }
        
        // Security: Verify user has access to this invoice (customers can only modify their own)
        if (user.role === 'customer' && invoice.customerId !== user.customerId) {
          throw new Error('Unauthorized: You can only apply codes to your own invoices');
        }
        
        // Check if invoice is already paid
        if (invoice.paymentStatus === 'paid' || invoice.paymentStatus === 'refunded') {
          throw new Error('Cannot apply referral code to a paid or refunded invoice');
        }
        
        // Check if referral code already applied
        if (invoice.referralCode) {
          throw new Error(`A referral code has already been applied to this invoice: ${invoice.referralCode}`);
        }
        
        // Validate the referral code
        const validation = await validateReferralCode(code);
        
        if (!validation.valid) {
          throw new Error(validation.message || 'Invalid or expired referral code');
        }
        
        // Get reward configuration
        const rewardDescriptor = await getRefereeRewardDescriptor();
        
        if (!rewardDescriptor) {
          throw new Error('Referral program configuration not found');
        }
        
        // Calculate discount based on reward type
        let discountAmount = 0;
        const originalAmount = Number(invoice.amount);
        
        switch (rewardDescriptor.rewardType) {
          case 'fixed_discount':
            discountAmount = Number(rewardDescriptor.value);
            break;
          
          case 'percent_discount':
            const percentage = Number(rewardDescriptor.value);
            discountAmount = (originalAmount * percentage) / 100;
            break;
          
          default:
            // Other reward types (loyalty_points, service_credit, etc.) don't apply to invoice amount
            // Return success with informational message
            return {
              success: true,
              isInformational: true,
              message: `This referral code provides ${formatRewardDescription(rewardDescriptor)}, which will be applied after your first service is completed.`,
              rewardType: rewardDescriptor.rewardType,
              rewardValue: rewardDescriptor.value
            };
        }
        
        // Ensure discount doesn't exceed invoice amount
        discountAmount = Math.min(discountAmount, originalAmount);
        const newAmount = Math.max(0, originalAmount - discountAmount);
        
        // Recalculate all derived fields
        const updates: any = {
          referralCode: code,
          referralDiscount: discountAmount.toFixed(2),
          referralRewardType: rewardDescriptor.rewardType,
          referralRewardValue: rewardDescriptor.value.toString(),
          referralOriginalAmount: originalAmount.toFixed(2),
          amount: newAmount.toFixed(2),
          updatedAt: new Date(),
        };
        
        // Update totalAmount if it exists (for third-party billing)
        if (invoice.totalAmount) {
          const newTotalAmount = Math.max(0, Number(invoice.totalAmount) - discountAmount);
          updates.totalAmount = newTotalAmount.toFixed(2);
        }
        
        // Update balanceDue if it exists
        if (invoice.balanceDue) {
          const newBalanceDue = Math.max(0, Number(invoice.balanceDue) - discountAmount);
          updates.balanceDue = newBalanceDue.toFixed(2);
        }
        
        // Apply the referral code to the invoice
        await tx
          .update(invoices)
          .set(updates)
          .where(eq(invoices.id, invoiceId));
        
        console.log(`[REFERRAL INVOICE] Applied code ${code} to invoice ${invoiceId}: $${originalAmount} → $${newAmount} (saved $${discountAmount})`);
        
        return {
          success: true,
          isInformational: false,
          message: `Referral code applied! You saved $${discountAmount.toFixed(2)}`,
          originalAmount,
          discountAmount,
          newAmount,
          referralCode: code
        };
      });
      
      res.json(result);
    } catch (error) {
      console.error('[REFERRAL INVOICE] Error applying code:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to apply referral code',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
}
