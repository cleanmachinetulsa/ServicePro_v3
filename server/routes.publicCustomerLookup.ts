import { Express, Request, Response } from 'express';
import { requireRole } from './rbacMiddleware';
import { db } from './db';
import { customers } from '@shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Admin customer lookup routes for referral management  
 * Requires manager/owner role to prevent PII disclosure
 */
export function registerPublicCustomerLookupRoutes(app: Express) {
  
  /**
   * Look up customer by phone number
   * Returns minimal customer data (id, name) for admin referral management
   * Auth required - manager/owner only (not employees or customers)
   */
  app.get('/api/customers/lookup/phone/:phone', requireRole('manager'), async (req: Request, res: Response) => {
    try {
      const { phone } = req.params;
      
      if (!phone) {
        return res.status(400).json({
          success: false,
          message: 'Phone number is required'
        });
      }

      // Normalize phone number (remove spaces, dashes, parentheses, plus signs)
      const normalizedPhone = phone.replace(/[\s\-\(\)\+]/g, '');

      // Query all customers and filter by normalized phone on both sides
      const allCustomers = await db
        .select({
          id: customers.id,
          name: customers.name,
          phone: customers.phone,
        })
        .from(customers);

      // Find customer by comparing normalized phone numbers
      const customer = allCustomers.find(c => 
        c.phone.replace(/[\s\-\(\)\+]/g, '') === normalizedPhone
      );

      if (!customer) {
        return res.status(404).json({
          success: false,
          message: 'No customer found with this phone number'
        });
      }

      // Return minimal data (id and name only, not phone for extra security)
      res.json({
        success: true,
        customer: {
          id: customer.id,
          name: customer.name,
        }
      });
    } catch (error) {
      console.error('[PUBLIC CUSTOMER LOOKUP] Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to lookup customer',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
}
