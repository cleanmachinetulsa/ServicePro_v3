import express, { Request, Response } from 'express';
import { requireRole } from './rbacMiddleware';
import {
  getTrialSandboxStatus,
  addAllowedNumber,
  removeAllowedNumber,
  isTrialTenant,
  getOrCreateTrialProfile,
} from './services/trialTelephonyService';

const router = express.Router();

router.get('/api/settings/trial-telephony', requireRole(['owner', 'admin', 'manager']), async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Tenant context required' });
    }
    
    const status = await getTrialSandboxStatus(tenantId);
    
    res.json({
      success: true,
      ...status,
    });
  } catch (error: any) {
    console.error('[TRIAL TELEPHONY] Error fetching status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/api/settings/trial-telephony/allowed-numbers', requireRole(['owner', 'admin']), async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Tenant context required' });
    }
    
    const isTrial = await isTrialTenant(tenantId);
    if (!isTrial) {
      return res.status(400).json({ success: false, error: 'This feature is only available for trial accounts' });
    }
    
    const { phoneNumber } = req.body;
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return res.status(400).json({ success: false, error: 'Phone number is required' });
    }
    
    const result = await addAllowedNumber(tenantId, phoneNumber);
    
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }
    
    const status = await getTrialSandboxStatus(tenantId);
    
    res.json({
      success: true,
      message: 'Phone number added to whitelist',
      ...status,
    });
  } catch (error: any) {
    console.error('[TRIAL TELEPHONY] Error adding number:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/api/settings/trial-telephony/allowed-numbers', requireRole(['owner', 'admin']), async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Tenant context required' });
    }
    
    const { phoneNumber } = req.body;
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return res.status(400).json({ success: false, error: 'Phone number is required' });
    }
    
    const result = await removeAllowedNumber(tenantId, phoneNumber);
    
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }
    
    const status = await getTrialSandboxStatus(tenantId);
    
    res.json({
      success: true,
      message: 'Phone number removed from whitelist',
      ...status,
    });
  } catch (error: any) {
    console.error('[TRIAL TELEPHONY] Error removing number:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/api/settings/trial-telephony/check', requireRole(['owner', 'admin', 'manager', 'technician']), async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Tenant context required' });
    }
    
    const isTrial = await isTrialTenant(tenantId);
    
    res.json({
      success: true,
      isTrialTenant: isTrial,
    });
  } catch (error: any) {
    console.error('[TRIAL TELEPHONY] Error checking trial status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export function registerTrialTelephonyRoutes(app: express.Application) {
  app.use(router);
  console.log('[TRIAL TELEPHONY] Routes registered: /api/settings/trial-telephony/*');
}

export default router;
