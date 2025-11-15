import { Router, Express } from 'express';
import { requireAuth } from './authMiddleware';
import { requireRole } from './rbacMiddleware';
import { markInvoiceAsPaid } from './paymentHandler';
import { getUnpaidInvoicesWithDetails } from './invoiceService';

export function registerInvoiceRoutes(app: Express) {
  const router = Router();

  // Get all unpaid invoices with customer details (owner/manager only)
  router.get('/api/invoices/unpaid', requireAuth, requireRole('owner', 'manager'), async (req, res) => {
    try {
      const invoices = await getUnpaidInvoicesWithDetails();
      
      res.status(200).json({
        success: true,
        invoices: invoices
      });
    } catch (error) {
      console.error('Error fetching unpaid invoices:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch unpaid invoices'
      });
    }
  });

  router.post('/api/invoices/:invoiceId/pay', requireAuth, requireRole('owner', 'manager'), markInvoiceAsPaid);

  app.use(router);
}
