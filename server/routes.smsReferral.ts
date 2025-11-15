import { Express, Request, Response } from 'express';
import { requireAuth } from './authMiddleware';
import { db } from './db';
import { customers } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { sendSMS } from './notifications';
import { renderSmsTemplateOrFallback } from './templateRenderer';
import { getReferrerRewardDescriptor, getRefereeRewardDescriptor, formatRewardDescription } from './referralConfigService';

/**
 * Register SMS referral invite routes
 */
export function registerSmsReferralRoutes(app: Express) {
  
  /**
   * Send SMS referral invite to a friend
   * Uses referral_invite template from SMS template system
   */
  app.post('/api/sms/send-referral-invite', requireAuth, async (req: Request, res: Response) => {
    try {
      const { customerId, friendPhone, referralCode } = req.body;
      
      if (!customerId || !friendPhone || !referralCode) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: customerId, friendPhone, or referralCode'
        });
      }
      
      // Get customer name for personalization
      const [customer] = await db
        .select({ name: customers.name })
        .from(customers)
        .where(eq(customers.id, Number(customerId)))
        .limit(1);
      
      if (!customer) {
        return res.status(404).json({
          success: false,
          message: 'Customer not found'
        });
      }
      
      const referrerName = customer.name ? customer.name.split(' ')[0] : 'your friend';
      const bookingUrl = `${process.env.REPLIT_DEV_DOMAIN || 'https://cleanmachinetulsa.com'}/book?ref=${referralCode}`;
      
      // Get dynamic reward descriptions from configuration
      const referrerDescriptor = await getReferrerRewardDescriptor();
      const refereeDescriptor = await getRefereeRewardDescriptor();
      
      const referrerReward = referrerDescriptor ? formatRewardDescription(referrerDescriptor) : '500 loyalty points';
      const refereeReward = refereeDescriptor ? formatRewardDescription(refereeDescriptor) : '$25 off';
      
      // Render SMS from template with fallback to dynamic message
      const templateResult = await renderSmsTemplateOrFallback(
        'referral_invite',
        { 
          referrerName, 
          referralCode,
          bookingUrl,
          referrerReward, // Dynamic reward from config
          refereeReward   // Dynamic reward from config
        },
        () => `Hey! ${referrerName} thinks you'd love Clean Machine Auto Detail! 🚗✨\n\nUse code ${referralCode} to get ${refereeReward} your first detail, and we'll both get ${referrerReward}!\n\nBook now: ${bookingUrl}`
      );
      
      // Send SMS
      await sendSMS(friendPhone, templateResult.message);
      
      console.log(`[SMS REFERRAL] Sent invite from customer ${customerId} to ${friendPhone} with code ${referralCode}`);
      
      res.json({
        success: true,
        message: 'Referral invite sent successfully',
        data: {
          usedTemplate: templateResult.usedTemplateKey,
          fallbackUsed: templateResult.fallbackUsed
        }
      });
    } catch (error) {
      console.error('[SMS REFERRAL] Error sending invite:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send referral invite',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
}
