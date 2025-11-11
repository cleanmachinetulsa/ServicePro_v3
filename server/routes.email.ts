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
import { z } from 'zod';

/**
 * Register email campaign routes
 */
export function registerEmailRoutes(app: Express) {
  // Get all campaigns
  app.get('/api/email-campaigns', async (_req: Request, res: Response) => {
    try {
      const campaigns = await getAllCampaigns();
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
      
      const campaign = await getCampaignById(id);
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
      
      const newCampaign = await createCampaign(campaignData);
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
      const updatedCampaign = await updateCampaign(id, campaignData);
      
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
      
      await deleteCampaign(id);
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
      
      const cancelledCampaign = await cancelCampaign(id);
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
      
      const sentCampaign = await sendCampaignNow(id);
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
  app.get('/api/email-templates', async (_req: Request, res: Response) => {
    try {
      const templates = await getAllTemplates();
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
      
      const newTemplate = await createTemplate(templateData);
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
      const updatedTemplate = await updateTemplate(id, templateData);
      
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
      
      await deleteTemplate(id);
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
  app.get('/api/customers-for-email', async (_req: Request, res: Response) => {
    try {
      const customers = await getEmailCustomers();
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
      
      const generatedContent = await generateEmailContent(prompt, template);
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
      
      await updateSubscription(email, subscribed !== false); // Default to subscribe if not specified
      
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
      
      await updateSubscription(email, false);
      
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
}