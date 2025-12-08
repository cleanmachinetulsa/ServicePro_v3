import { Router, Request, Response, NextFunction } from 'express';
import { 
  getAllCampaigns as getAllEmailCampaigns,
  createCampaign as createEmailCampaign,
  getCampaignById as getEmailCampaignById,
  updateCampaign as updateEmailCampaign,
  sendCampaignNow,
  cancelCampaign as cancelEmailCampaign
} from './emailCampaignService';
import {
  getAllSMSCampaigns,
  createSMSCampaign,
  getSMSCampaignById,
  sendSMSCampaignNow,
  cancelSMSCampaign
} from './smsCampaignService';
import { z } from 'zod';
import { hasFeature } from '@shared/features';
import { db } from './db';
import { tenants } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { requireAuth } from './authMiddleware';

const router = Router();

// PHASE 7: Feature gating for campaigns
async function requireCampaignsFeature(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = (req as any).tenant?.id || 'root';
    const [tenantRecord] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
    
    if (!tenantRecord) {
      return res.status(404).json({
        success: false,
        error: 'Tenant not found'
      });
    }

    if (!hasFeature(tenantRecord, 'campaigns')) {
      return res.status(403).json({
        success: false,
        error: 'Campaigns feature requires Pro plan or higher. Please upgrade your plan to access this feature.'
      });
    }

    next();
  } catch (error) {
    console.error('[CAMPAIGNS] Feature gating error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to verify feature access'
    });
  }
}

// Apply auth and feature gating middleware to all routes
router.use(requireAuth);
router.use(requireCampaignsFeature);

// Validation schemas
const emailCampaignSchema = z.object({
  name: z.string().min(1, 'Campaign name is required'),
  subject: z.string().min(1, 'Subject is required'),
  content: z.string().min(1, 'Content is required'),
  targetAudience: z.enum(['all', 'vip', 'loyalty']).default('all'),
  scheduledDate: z.string().optional()
});

const smsCampaignSchema = z.object({
  name: z.string().min(1, 'Campaign name is required'),
  message: z.string().min(1, 'Message is required').max(300, 'Message too long'),
  targetAudience: z.enum(['all', 'vip', 'loyalty']).default('all'),
  scheduledDate: z.string().optional(),
  fromNumber: z.string().optional()
});

// ==================== EMAIL CAMPAIGNS ====================

// Get all email campaigns
router.get('/email', async (req, res) => {
  try {
    const campaigns = await getAllEmailCampaigns((req as any).tenantDb!);
    res.json({ success: true, campaigns });
  } catch (error: any) {
    console.error('Error fetching email campaigns:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get email campaign by ID with stats
router.get('/email/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const campaign = await getEmailCampaignById((req as any).tenantDb!, id);
    res.json({ success: true, campaign });
  } catch (error: any) {
    console.error('Error fetching email campaign:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create email campaign
router.post('/email', async (req, res) => {
  try {
    const data = emailCampaignSchema.parse(req.body);
    
    const campaign = await createEmailCampaign((req as any).tenantDb!, {
      name: data.name,
      subject: data.subject,
      content: data.content,
      targetAudience: data.targetAudience,
      scheduledDate: data.scheduledDate,
      createdBy: (req as any).user?.id
    } as any);
    
    res.json({ success: true, campaign });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ success: false, error: error.errors[0].message });
    }
    console.error('Error creating email campaign:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update email campaign
router.put('/email/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const data = emailCampaignSchema.partial().parse(req.body);
    
    const campaign = await updateEmailCampaign((req as any).tenantDb!, id, {
      name: data.name,
      subject: data.subject,
      content: data.content,
      targetAudience: data.targetAudience,
      scheduledDate: data.scheduledDate
    } as any);
    
    res.json({ success: true, campaign });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ success: false, error: error.errors[0].message });
    }
    console.error('Error updating email campaign:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Send email campaign now
router.post('/email/:id/send', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const campaign = await sendCampaignNow((req as any).tenantDb!, id);
    res.json({ success: true, campaign, message: 'Campaign is being processed' });
  } catch (error: any) {
    console.error('Error sending email campaign:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Cancel email campaign
router.delete('/email/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const campaign = await cancelEmailCampaign((req as any).tenantDb!, id);
    res.json({ success: true, campaign });
  } catch (error: any) {
    console.error('Error cancelling email campaign:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== SMS CAMPAIGNS ====================

// Get all SMS campaigns
router.get('/sms', async (req, res) => {
  try {
    const campaigns = await getAllSMSCampaigns((req as any).tenantDb!);
    res.json({ success: true, campaigns });
  } catch (error: any) {
    console.error('Error fetching SMS campaigns:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get SMS campaign by ID with stats
router.get('/sms/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const campaign = await getSMSCampaignById((req as any).tenantDb!, id);
    res.json({ success: true, campaign });
  } catch (error: any) {
    console.error('Error fetching SMS campaign:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create SMS campaign
router.post('/sms', async (req, res) => {
  try {
    const data = smsCampaignSchema.parse(req.body);
    
    const campaign = await createSMSCampaign((req as any).tenantDb!, {
      name: data.name,
      message: data.message,
      targetAudience: data.targetAudience,
      scheduledDate: data.scheduledDate ? new Date(data.scheduledDate) : undefined,
      fromNumber: data.fromNumber,
      createdBy: (req as any).user?.id
    });
    
    res.json({ success: true, campaign });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ success: false, error: error.errors[0].message });
    }
    console.error('Error creating SMS campaign:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Send SMS campaign now
router.post('/sms/:id/send', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const campaign = await sendSMSCampaignNow((req as any).tenantDb!, id);
    res.json({ success: true, campaign, message: 'Campaign is being processed' });
  } catch (error: any) {
    console.error('Error sending SMS campaign:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Cancel SMS campaign
router.delete('/sms/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const campaign = await cancelSMSCampaign((req as any).tenantDb!, id);
    res.json({ success: true, campaign });
  } catch (error: any) {
    console.error('Error cancelling SMS campaign:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
