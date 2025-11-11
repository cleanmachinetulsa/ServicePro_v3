import { Router, Express } from 'express';
import { requireAuth } from './authMiddleware';
import { markInvoiceAsPaid } from './paymentHandler';

export function registerInvoiceRoutes(app: Express) {
  const router = Router();

  router.post('/api/invoices/:invoiceId/pay', requireAuth, markInvoiceAsPaid);

  app.use(router);
}
