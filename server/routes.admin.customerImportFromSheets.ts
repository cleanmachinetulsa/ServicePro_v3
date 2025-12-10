/**
 * SP-GSHEETS-CUSTOMER-RESYNC - Admin API Routes for Customer Import from Google Sheets
 * 
 * Exposes endpoints for tenant owners/admins to import customer data from Google Sheets
 * into their tenant's customer database.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { 
  importCustomersFromSheet, 
  previewCustomersFromSheet 
} from './services/customerImportFromSheetsService';

const router = Router();
const LOG_PREFIX = '[CUSTOMER SHEETS IMPORT API]';

function requireOwnerRole(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const role = req.session.role;
  if (role !== 'owner' && role !== 'admin') {
    return res.status(403).json({ error: 'Owner or admin access required' });
  }
  next();
}

function requireTenant(req: Request, res: Response, next: NextFunction) {
  const tenantId = req.session?.tenantId;
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant context required' });
  }
  next();
}

router.post(
  '/',
  requireOwnerRole,
  requireTenant,
  async (req: Request, res: Response) => {
    const tenantId = req.session!.tenantId as string;
    const { dryRun = true } = req.body;
    
    console.log(`${LOG_PREFIX} Import request from tenant "${tenantId}" (dryRun: ${dryRun})`);
    
    try {
      const summary = await importCustomersFromSheet(tenantId, { dryRun });
      
      res.json({
        success: true,
        dryRun,
        summary,
      });
    } catch (error: any) {
      console.error(`${LOG_PREFIX} Import error:`, error);
      res.status(500).json({
        error: 'Import failed',
        message: error.message,
      });
    }
  }
);

router.get(
  '/preview',
  requireOwnerRole,
  requireTenant,
  async (req: Request, res: Response) => {
    const tenantId = req.session!.tenantId as string;
    
    console.log(`${LOG_PREFIX} Preview request from tenant "${tenantId}"`);
    
    try {
      const preview = await previewCustomersFromSheet(tenantId);
      
      res.json({
        success: true,
        preview,
      });
    } catch (error: any) {
      console.error(`${LOG_PREFIX} Preview error:`, error);
      res.status(500).json({
        error: 'Preview failed',
        message: error.message,
      });
    }
  }
);

export default router;
