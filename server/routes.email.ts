import { Express, Request, Response } from 'express';
import {
  getAllCampaigns,
  getCampaignById,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  cancelCampaign,
  sendCampaignNow,
  getAllTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getEmailCustomers,
  generateEmailContent,
  updateSubscription
} from './emailCampaignService';
import { sendBusinessEmail } from './emailService';
import { 
  sendTenantEmail, 
  createTenantEmailProfile, 
  hasGlobalSendGridConfig,
  getGlobalEmailFromAddress
} from './services/tenantEmailService';
import { tenantEmailProfiles, tenantConfig, tenants } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

/**
 * Register email campaign routes
 */
export function registerEmailRoutes(app: Express) {
  // Get all campaigns
  app.get('/api/email-campaigns', async (req: Request, res: Response) => {
    try {
      const campaigns = await getAllCampaigns(req.tenantDb!);
      res.json({ success: true, campaigns });
    } catch (error) {
      console.error('Error getting email campaigns:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to retrieve email campaigns',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Get campaign by ID
  app.get('/api/email-campaigns/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ success: false, message: 'Invalid campaign ID' });
      }
      
      const campaign = await getCampaignById(req.tenantDb!, id);
      if (!campaign) {
        return res.status(404).json({ success: false, message: 'Campaign not found' });
      }
      
      res.json({ success: true, campaign });
    } catch (error) {
      console.error('Error getting email campaign:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to retrieve email campaign',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Create new campaign
  app.post('/api/email-campaigns', async (req: Request, res: Response) => {
    try {
      const campaignData = req.body;
      
      if (!campaignData.name || !campaignData.subject || !campaignData.content) {
        return res.status(400).json({ 
          success: false, 
          message: 'Missing required fields: name, subject, and content are required' 
        });
      }
      
      const newCampaign = await createCampaign(req.tenantDb!, campaignData);
      res.status(201).json({ success: true, campaign: newCampaign });
    } catch (error) {
      console.error('Error creating email campaign:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to create email campaign',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Update campaign
  app.put('/api/email-campaigns/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ success: false, message: 'Invalid campaign ID' });
      }
      
      const campaignData = req.body;
      const updatedCampaign = await updateCampaign(req.tenantDb!, id, campaignData);
      
      res.json({ success: true, campaign: updatedCampaign });
    } catch (error) {
      console.error('Error updating email campaign:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to update email campaign',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Delete campaign
  app.delete('/api/email-campaigns/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ success: false, message: 'Invalid campaign ID' });
      }
      
      await deleteCampaign(req.tenantDb!, id);
      res.json({ success: true, message: 'Campaign deleted successfully' });
    } catch (error) {
      console.error('Error deleting email campaign:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to delete email campaign',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Cancel a scheduled campaign
  app.post('/api/email-campaigns/:id/cancel', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ success: false, message: 'Invalid campaign ID' });
      }
      
      const cancelledCampaign = await cancelCampaign(req.tenantDb!, id);
      res.json({ success: true, campaign: cancelledCampaign });
    } catch (error) {
      console.error('Error cancelling email campaign:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to cancel email campaign',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Send a campaign immediately
  app.post('/api/email-campaigns/:id/send', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ success: false, message: 'Invalid campaign ID' });
      }
      
      const sentCampaign = await sendCampaignNow(req.tenantDb!, id);
      res.json({ success: true, campaign: sentCampaign });
    } catch (error) {
      console.error('Error sending email campaign:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to send email campaign',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Get all email templates
  app.get('/api/email-templates', async (req: Request, res: Response) => {
    try {
      const templates = await getAllTemplates(req.tenantDb!);
      res.json({ success: true, templates });
    } catch (error) {
      console.error('Error getting email templates:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to retrieve email templates',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Create a new template
  app.post('/api/email-templates', async (req: Request, res: Response) => {
    try {
      const templateData = req.body;
      
      if (!templateData.name || !templateData.subject || !templateData.content) {
        return res.status(400).json({ 
          success: false, 
          message: 'Missing required fields: name, subject, and content are required' 
        });
      }
      
      const newTemplate = await createTemplate(req.tenantDb!, templateData);
      res.status(201).json({ success: true, template: newTemplate });
    } catch (error) {
      console.error('Error creating email template:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to create email template',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Update a template
  app.put('/api/email-templates/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ success: false, message: 'Invalid template ID' });
      }
      
      const templateData = req.body;
      const updatedTemplate = await updateTemplate(req.tenantDb!, id, templateData);
      
      res.json({ success: true, template: updatedTemplate });
    } catch (error) {
      console.error('Error updating email template:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to update email template',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Delete a template
  app.delete('/api/email-templates/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ success: false, message: 'Invalid template ID' });
      }
      
      await deleteTemplate(req.tenantDb!, id);
      res.json({ success: true, message: 'Template deleted successfully' });
    } catch (error) {
      console.error('Error deleting email template:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to delete email template',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Get customers for email targeting
  app.get('/api/customers-for-email', async (req: Request, res: Response) => {
    try {
      const customers = await getEmailCustomers(req.tenantDb!);
      res.json({ success: true, customers });
    } catch (error) {
      console.error('Error getting customers for email:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to retrieve customers for email',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Generate email content using AI
  app.post('/api/generate-email-content', async (req: Request, res: Response) => {
    try {
      const { prompt, template } = req.body;
      
      if (!prompt) {
        return res.status(400).json({ 
          success: false, 
          message: 'Missing required field: prompt' 
        });
      }
      
      const generatedContent = await generateEmailContent(req.tenantDb!, prompt, template);
      res.json({ 
        success: true, 
        data: generatedContent
      });
    } catch (error) {
      console.error('Error generating email content:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to generate email content',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Update subscription status (subscribe/unsubscribe)
  app.post('/api/email-subscription', async (req: Request, res: Response) => {
    try {
      const { email, subscribed } = req.body;
      
      if (!email) {
        return res.status(400).json({ 
          success: false, 
          message: 'Missing required field: email' 
        });
      }
      
      await updateSubscription(req.tenantDb!, email, subscribed !== false); // Default to subscribe if not specified
      
      res.json({ 
        success: true, 
        message: subscribed !== false 
          ? 'Successfully subscribed to emails' 
          : 'Successfully unsubscribed from emails'
      });
    } catch (error) {
      console.error('Error updating subscription:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to update subscription status',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Unsubscribe route (used in email links)
  app.get('/api/unsubscribe', async (req: Request, res: Response) => {
    try {
      const { email } = req.query;
      
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ 
          success: false, 
          message: 'Missing required query parameter: email' 
        });
      }
      
      await updateSubscription(req.tenantDb!, email, false);
      
      // Redirect to a confirmation page or return a success response
      res.json({ 
        success: true, 
        message: 'Successfully unsubscribed from emails'
      });
    } catch (error) {
      console.error('Error unsubscribing:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to unsubscribe',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Test email endpoint - send a quick test email to verify SendGrid configuration
  const testEmailSchema = z.object({
    to: z.string().email('Invalid email address'),
    subject: z.string().min(1, 'Subject is required'),
    message: z.string().min(1, 'Message is required')
  });

  app.post('/api/email/test', async (req: Request, res: Response) => {
    try {
      // Validate request body
      const validation = testEmailSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validation.error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        });
      }

      const { to, subject, message } = validation.data;

      console.log(`[EMAIL TEST] Sending test email to: ${to}`);
      console.log(`[EMAIL TEST] Subject: ${subject}`);
      console.log(`[EMAIL TEST] From: ${process.env.SENDGRID_FROM_EMAIL || 'info@cleanmachinetulsa.com'}`);

      // Send the email using the email service
      const result = await sendBusinessEmail(to, subject, message);

      if (result.success) {
        console.log(`[EMAIL TEST] ✅ Email sent successfully to ${to}`);
        return res.json({
          success: true,
          message: 'Test email sent successfully',
          details: {
            to,
            subject,
            from: process.env.SENDGRID_FROM_EMAIL || 'info@cleanmachinetulsa.com'
          }
        });
      } else {
        console.error(`[EMAIL TEST] ❌ Email failed:`, result.error);
        return res.status(500).json({
          success: false,
          message: 'Failed to send test email',
          error: result.error instanceof Error ? result.error.message : String(result.error)
        });
      }
    } catch (error) {
      console.error('[EMAIL TEST] Unexpected error:', error);
      return res.status(500).json({
        success: false,
        message: 'Unexpected error sending test email',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // =========================================================================
  // TENANT EMAIL SETTINGS ROUTES (Phase 10)
  // =========================================================================

  const emailSettingsSchema = z.object({
    fromName: z.string().min(1, 'From name is required').max(255),
    replyToEmail: z.string().email('Invalid email address').max(255).optional().nullable(),
  });

  // GET /api/settings/email - Get tenant email settings
  app.get('/api/settings/email', async (req: Request, res: Response) => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      // Get email profile
      const [emailProfile] = await req.tenantDb!.raw
        .select()
        .from(tenantEmailProfiles)
        .where(eq(tenantEmailProfiles.tenantId, tenantId))
        .limit(1);

      // Get tenant info for defaults
      const [tenantInfo] = await req.tenantDb!.raw
        .select({
          tenantName: tenants.name,
          businessName: tenantConfig.businessName,
          primaryContactEmail: tenantConfig.primaryContactEmail,
        })
        .from(tenants)
        .leftJoin(tenantConfig, eq(tenants.id, tenantConfig.tenantId))
        .where(eq(tenants.id, tenantId))
        .limit(1);

      const displayName = tenantInfo?.businessName || tenantInfo?.tenantName || 'Your Business';

      res.json({
        success: true,
        data: {
          fromName: emailProfile?.fromName || displayName,
          replyToEmail: emailProfile?.replyToEmail || tenantInfo?.primaryContactEmail || null,
          status: emailProfile?.status || 'not_configured',
          lastVerifiedAt: emailProfile?.lastVerifiedAt || null,
          lastError: emailProfile?.lastError || null,
          globalFromEmail: getGlobalEmailFromAddress(),
          isConfigured: hasGlobalSendGridConfig(),
        }
      });
    } catch (error) {
      console.error('[EMAIL SETTINGS] Error getting email settings:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve email settings',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // PUT /api/settings/email - Update tenant email settings
  app.put('/api/settings/email', async (req: Request, res: Response) => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const validation = emailSettingsSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validation.error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        });
      }

      const { fromName, replyToEmail } = validation.data;

      const result = await createTenantEmailProfile(req.tenantDb!, tenantId, {
        fromName,
        replyToEmail: replyToEmail || undefined,
      });

      if (!result.ok) {
        return res.status(500).json({
          success: false,
          message: 'Failed to update email settings',
          error: result.error
        });
      }

      console.log(`[EMAIL SETTINGS] Updated for tenant ${tenantId}: fromName="${fromName}", replyTo="${replyToEmail}"`);

      res.json({
        success: true,
        message: 'Email settings updated successfully',
        data: {
          fromName,
          replyToEmail,
        }
      });
    } catch (error) {
      console.error('[EMAIL SETTINGS] Error updating email settings:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update email settings',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // POST /api/settings/email/test - Send test email using tenant profile
  app.post('/api/settings/email/test', async (req: Request, res: Response) => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const { to } = req.body;
      if (!to || !z.string().email().safeParse(to).success) {
        return res.status(400).json({
          success: false,
          message: 'Valid email address is required'
        });
      }

      if (!hasGlobalSendGridConfig()) {
        return res.status(503).json({
          success: false,
          message: 'Email service is not configured. Please contact support.'
        });
      }

      // Get tenant display name for the test email
      const [tenantInfo] = await req.tenantDb!.raw
        .select({
          businessName: tenantConfig.businessName,
          tenantName: tenants.name,
        })
        .from(tenants)
        .leftJoin(tenantConfig, eq(tenants.id, tenantConfig.tenantId))
        .where(eq(tenants.id, tenantId))
        .limit(1);

      const businessName = tenantInfo?.businessName || tenantInfo?.tenantName || 'Your Business';

      const testHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333; margin-bottom: 20px;">Test Email from ${businessName}</h2>
          <p style="font-size: 16px; color: #555; line-height: 1.6;">
            This is a test email to verify your email settings are configured correctly.
          </p>
          <div style="background: #f4f4f4; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #666;">
              <strong>Sent via:</strong> ServicePro Email System<br>
              <strong>From:</strong> ${businessName}<br>
              <strong>Timestamp:</strong> ${new Date().toISOString()}
            </p>
          </div>
          <p style="font-size: 14px; color: #999;">
            If you received this email, your settings are working correctly!
          </p>
        </div>
      `;

      const result = await sendTenantEmail(req.tenantDb!, tenantId, {
        to,
        subject: `Test Email - ${businessName}`,
        html: testHtml,
        category: 'test_email',
      });

      if (result.ok) {
        console.log(`[EMAIL SETTINGS] Test email sent successfully for tenant ${tenantId} to ${to}`);
        return res.json({
          success: true,
          message: 'Test email sent successfully'
        });
      } else {
        console.error(`[EMAIL SETTINGS] Test email failed for tenant ${tenantId}:`, result.errorMessage);
        return res.status(500).json({
          success: false,
          message: 'Failed to send test email',
          error: result.errorMessage
        });
      }
    } catch (error) {
      console.error('[EMAIL SETTINGS] Error sending test email:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send test email',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
}