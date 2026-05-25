import { Express, Request, Response } from 'express';
import { addLoyaltyPointsFromInvoice } from './loyaltyService';
import { updateLoyaltyPointsInSheets } from './googleLoyaltyIntegration';
import { wrapTenantDb } from './tenantDb';
import { db } from './db';

/**
 * Register invoice-related loyalty routes
 */
export function registerInvoiceLoyaltyRoutes(app: Express) {
  // Award loyalty points after invoice is sent
  app.post('/api/invoice/award-loyalty-points', async (req: Request, res: Response) => {
    try {
      const { customerId, customerPhone, invoiceId, amount } = req.body;
      
      if (!invoiceId || !amount || (!customerId && !customerPhone)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Missing required fields for awarding loyalty points' 
        });
      }
      
      // Calculate points to add (1:1 ratio with dollars spent)
      const pointsToAdd = Math.floor(Number(amount));
      let dbResult = null;
      
      // If we have a database customerId, update points in PostgreSQL.
      // LOY-1 fix: addLoyaltyPointsFromInvoice requires tenantDb as the FIRST
      // arg. Prior to this fix the call passed customerId in the tenantDb slot,
      // which caused a runtime throw on the first table access. This route is
      // unauthenticated (server-to-server / automation), so we resolve tenant
      // from session if present, otherwise fall back to 'root' (Clean Machine)
      // — matching the implicit pre-multitenancy assumption this route ran on.
      if (customerId) {
        const tenantId = (req.session as any)?.tenantId || 'root';
        const tenantDb = wrapTenantDb(db, tenantId);
        dbResult = await addLoyaltyPointsFromInvoice(
          tenantDb,
          Number(customerId), 
          Number(invoiceId), 
          Number(amount)
        );
      }
      
      // If we have a phone number, also update Google Sheets 
      // (this ensures both systems stay in sync)
      let sheetsResult = false;
      if (customerPhone) {
        sheetsResult = await updateLoyaltyPointsInSheets(
          customerPhone,
          pointsToAdd,
          invoiceId.toString(),
          Number(amount)
        );
      }
      
      res.json({
        success: true,
        message: `Successfully awarded ${pointsToAdd} loyalty points`,
        dbResult,
        sheetsUpdated: sheetsResult
      });
    } catch (error) {
      console.error('Error awarding loyalty points:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to award loyalty points',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
}