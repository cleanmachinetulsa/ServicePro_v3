import { Express, Request, Response } from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { readFileSync } from 'fs';
import { join } from 'path';
import { sessionMiddleware } from './sessionMiddleware';
import { db } from './db';
import { eq } from 'drizzle-orm';
import { services as servicesTable, businessSettings, agentPreferences } from '@shared/schema';
import { registerLoyaltyRoutes } from './routes.loyalty';
import { registerUpsellRoutes } from './routes.upsell';
import { registerInvoiceRoutes } from './routes.invoices';
import { registerEnhancedCustomerRoutes } from './enhancedCustomerRoutes';
import { registerFileUploadRoutes } from './fileUpload';
import { registerEmailRoutes } from './routes.email';
import { registerCancellationRoutes } from './routes.cancellation';
import { registerConversationRoutes } from './routes.conversations';
import { registerServiceManagementRoutes } from './serviceManagement';
import { registerServiceLimitsRoutes } from './routes.serviceLimits';
import { registerMaintenanceRoutes } from './routes.maintenance';
import { initializeWebSocket } from './websocketService';
import quickReplyRoutes from './routes.quickReplies';
import appointmentRoutes from './routes.appointments';
import smsFallbackRoutes from './routes.smsFallback';
import voiceWebhookRoutes from './routes.voiceWebhook';
import twilmlRoutes from './routes.twiml';
import techJobRoutes from './routes.techJobs';
import notificationRoutes from './routes.notifications';
import twilioStatusCallbackRoutes from './routes.twilioStatusCallback';
import facebookRoutes from './routes.facebook';
import tagRoutes from './routes.tags';
import { verifyTwilioSignature } from './twilioSignatureMiddleware';
import { getLoyaltyPointsByPhone, getLoyaltyPointsByEmail, addLoyaltyPointsFromInvoice } from './loyaltyService';
import { updateLoyaltyPointsInSheets } from './googleLoyaltyIntegration';
import {
  handleGetAvailable,
  handleBook,
} from './calendarApi';
import {
  getAllServices,
  searchServices,
  getAddonServices
} from './services';
import {
  getUpcomingAppointments,
  getTodaysAppointments,
  getMonthlyAppointmentCounts,
  getMonthlyStatistics,
  getRecentMessages,
  updateService,
  getCalendarWeather,
  navigateAndSendETA,
  sendInvoiceNotification
} from './dashboardApi';
import {
  getGoogleReviews,
  getGoogleBusinessPhotos
} from './googleIntegration';
import {
  getWeatherForecast
} from './weatherService';
import {
  geocodeAddress,
  checkDistanceToBusinessLocation
} from './googleMapsApi';
import { responseFormatter } from './responseFormatter';
import { getFormatterSettings, updateFormatterSettings, resetFormatterSettings } from './formatterConfig';
import axios from 'axios';
import {
  sendBookingConfirmationEmail,
  sendReminderEmail,
  sendBusinessEmail,
} from './emailService';
import { registerAuthRoutes } from './routes.auth';
import { registerWebAuthnRoutes } from './routes.webauthn';
import { registerSearchRoutes } from './routes.search';
import { requireAuth } from './authMiddleware';
import { checkPasswordChangeRequired } from './rbacMiddleware';
import { normalizePhone, normalizePhoneQuery } from './phoneValidationMiddleware';
import userRoutes from './routes.users';
import passwordRoutes from './routes.password';
import { registerQuickBookingRoutes } from './routes.quickbooking';
import galleryRoutes from './routes.gallery';
import subscriptionRoutes from './routes.subscriptions';
import analyticsRoutes from './routes.analytics';
import { registerSMSConsentRoutes } from './routes.smsConsent';
import recurringServicesRoutes from './routes.recurringServices';
import { registerContactsRoutes } from './routes.contacts';
import quoteRequestsRoutes from './routes.quoteRequests';
import quoteApprovalRoutes from './routes.quoteApproval';
import calendarAvailabilityRoutes from './routes.calendarAvailability';

// Main function to register all routes
export async function registerRoutes(app: Express) {
  const server = createServer(app);

  // Register authentication routes
  registerAuthRoutes(app);
  
  // Register WebAuthn biometric authentication routes
  registerWebAuthnRoutes(app);

  // Port monitoring SMS delivery status callback (receives delivery confirmation from Twilio)
  app.post('/api/test/port-sms-status', async (req: Request, res: Response) => {
    try {
      const { MessageStatus, MessageSid, Body } = req.body;
      
      console.log('[PORT MONITOR STATUS] Delivery status received');
      console.log('[PORT MONITOR STATUS] Message SID:', MessageSid);
      console.log('[PORT MONITOR STATUS] Status:', MessageStatus);
      console.log('[PORT MONITOR STATUS] Body:', Body);

      // Extract test ID from message body
      const testIdMatch = Body?.match(/\[PORT TEST ([a-f0-9]+)\]/);
      
      if (!testIdMatch) {
        console.log('[PORT MONITOR STATUS] Not a port test message, ignoring');
        return res.sendStatus(200);
      }

      const testId = testIdMatch[1];

      // Check if message was delivered successfully
      if (MessageStatus === 'delivered' || MessageStatus === 'sent') {
        console.log('[PORT MONITOR STATUS] ✅ Test SMS delivered successfully! Test ID:', testId);

        // Mark test as confirmed in database
        await db.insert(orgSettings).values({
          settingKey: 'port_monitoring_test_status',
          settingValue: {
            testId,
            awaitingConfirmation: false,
            confirmed: true,
            confirmedAt: new Date().toISOString(),
            messageSid: MessageSid,
            status: MessageStatus,
          },
          description: 'Port monitoring SMS test confirmed',
        }).onConflictDoUpdate({
          target: orgSettings.settingKey,
          set: {
            settingValue: {
              testId,
              awaitingConfirmation: false,
              confirmed: true,
              confirmedAt: new Date().toISOString(),
              messageSid: MessageSid,
              status: MessageStatus,
            },
          },
        });

        console.log('[PORT MONITOR STATUS] ✅ Delivery confirmation saved to database');
      } else if (MessageStatus === 'failed' || MessageStatus === 'undelivered') {
        console.log('[PORT MONITOR STATUS] ❌ Test SMS failed to deliver:', MessageStatus);
        
        // Mark as failed
        await db.insert(orgSettings).values({
          settingKey: 'port_monitoring_test_status',
          settingValue: {
            testId,
            awaitingConfirmation: false,
            confirmed: false,
            failedAt: new Date().toISOString(),
            messageSid: MessageSid,
            status: MessageStatus,
          },
          description: 'Port monitoring SMS test failed',
        }).onConflictDoUpdate({
          target: orgSettings.settingKey,
          set: {
            settingValue: {
              testId,
              awaitingConfirmation: false,
              confirmed: false,
              failedAt: new Date().toISOString(),
              messageSid: MessageSid,
              status: MessageStatus,
            },
          },
        });
      }

      res.sendStatus(200);
      
    } catch (error) {
      console.error('[PORT MONITOR STATUS] Error processing status callback:', error);
      res.sendStatus(500);
    }
  });
  
  // Health check endpoint (no auth required, for monitoring tools)
  app.get('/api/health', async (req: Request, res: Response) => {
    const services: Record<string, string> = {
      api: 'operational'
    };
    let overallStatus = 'healthy';
    const errors: string[] = [];

    // Get version from package.json
    let version = '1.0.0';
    try {
      const packageJson = JSON.parse(
        readFileSync(join(process.cwd(), 'package.json'), 'utf-8')
      );
      version = packageJson.version || version;
    } catch (versionError) {
      // Use fallback version
    }

    // Check database connectivity
    try {
      await db.select().from(businessSettings).limit(1);
      services.database = 'connected';
    } catch (dbError) {
      services.database = 'disconnected';
      overallStatus = 'unhealthy';
      errors.push(`Database: ${dbError instanceof Error ? dbError.message : 'Connection failed'}`);
    }

    // Check Twilio connectivity
    try {
      const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
      const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
      
      if (twilioAccountSid && twilioAuthToken) {
        const twilio = await import('twilio');
        const client = twilio.default(twilioAccountSid, twilioAuthToken);
        // Test API connectivity by fetching account info
        await client.api.accounts(twilioAccountSid).fetch();
        services.twilio = 'connected';
      } else {
        services.twilio = 'not_configured';
      }
    } catch (twilioError) {
      services.twilio = 'disconnected';
      overallStatus = 'unhealthy';
      errors.push(`Twilio: ${twilioError instanceof Error ? twilioError.message : 'API error'}`);
    }

    // Check SendGrid connectivity
    try {
      const sendgridKey = process.env.SENDGRID_API_KEY;
      
      if (sendgridKey) {
        const sgMail = await import('@sendgrid/mail');
        sgMail.default.setApiKey(sendgridKey);
        // Test by making a real API request to validate the key
        await sgMail.default.send({
          to: 'test@example.com',
          from: process.env.SENDGRID_FROM_EMAIL || 'noreply@example.com',
          subject: 'Health Check',
          text: 'This is a test',
        }).catch((err) => {
          // SendGrid returns 400 for invalid recipient, but key is valid
          // Only fail on authentication errors (401)
          if (err.code === 401 || err.code === 403) {
            throw err;
          }
          // Any other error (like 400 for test email) means API is reachable
        });
        services.sendgrid = 'connected';
      } else {
        services.sendgrid = 'not_configured';
      }
    } catch (sendgridError) {
      services.sendgrid = 'disconnected';
      overallStatus = 'unhealthy';
      errors.push(`SendGrid: ${sendgridError instanceof Error ? sendgridError.message : 'API error'}`);
    }

    // Check OpenAI connectivity
    try {
      const openaiKey = process.env.OPENAI_API_KEY;
      
      if (openaiKey) {
        const OpenAI = await import('openai');
        const openai = new OpenAI.default({ apiKey: openaiKey });
        // Test by listing models (lightweight API call)
        await openai.models.list();
        services.openai = 'connected';
      } else {
        services.openai = 'not_configured';
      }
    } catch (openaiError) {
      services.openai = 'disconnected';
      overallStatus = 'unhealthy';
      errors.push(`OpenAI: ${openaiError instanceof Error ? openaiError.message : 'API error'}`);
    }

    // Determine HTTP status code
    const statusCode = overallStatus === 'healthy' ? 200 : 503;

    res.status(statusCode).json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      services,
      version,
      ...(errors.length > 0 && { errors })
    });
  });
  
  // Register error monitoring routes
  const { registerErrorMonitoringRoutes } = await import('./routes.errorMonitoring');
  registerErrorMonitoringRoutes(app);
  
  // Register AI-powered search routes
  registerSearchRoutes(app);

  // Register password change routes (must be accessible even when password change is required)
  app.use('/api/auth', passwordRoutes);

  // CRITICAL: Apply password change requirement check BEFORE all protected routes
  // This ensures users with temporary passwords cannot access sensitive endpoints
  app.use(checkPasswordChangeRequired);

  // SECURITY: Global authentication middleware for ALL /api/* routes
  // Exceptions are explicitly listed below for public endpoints
  // NOTE: req.originalUrl includes the full path with /api prefix
  app.use('/api', (req, res, next) => {
    const publicPaths = [
      '/api/auth',              // Authentication endpoints
      '/api/health',            // Health check endpoint (for monitoring)
      '/api/webhooks',          // Twilio/Stripe webhooks (verified via signatures)
      '/api/voice',             // Twilio voice webhooks
      '/api/twilio',            // Twilio status callbacks
      '/api/quote-approval',    // Public quote approval pages
      '/api/payer-approval',    // Public payer approval pages  
      '/api/sms-consent',       // Public SMS consent page
      '/api/book',              // Public booking endpoints
      '/api/book-appointment',  // Public booking endpoints
      '/api/get-available',     // Public availability check
      '/api/available-slots',   // Public availability check
      '/api/services',          // Public service listing (needed for booking)
      '/api/addon-services',    // Public addon services
      '/api/privacy-policy',    // Public privacy policy
      '/api/recurring-service-booking', // Public recurring service booking
    ];

    // CRITICAL: Use req.originalUrl (includes /api) instead of req.path (stripped)
    const isPublicPath = publicPaths.some(path => req.originalUrl.startsWith(path));
    
    if (isPublicPath) {
      return next(); // Skip auth for public endpoints
    }

    // All other /api/* routes require authentication
    return requireAuth(req, res, next);
  });

  // Register user management routes (now protected by password change check)
  app.use('/api/users', userRoutes);

  // Dashboard routes - protected by authentication
  app.get('/api/dashboard/today', requireAuth, getTodaysAppointments);
  app.get('/api/dashboard/upcoming', requireAuth, getUpcomingAppointments);
  app.get('/api/dashboard/appointment-counts', requireAuth, getMonthlyAppointmentCounts);
  app.get('/api/dashboard/monthly-stats', requireAuth, getMonthlyStatistics);
  app.get('/api/dashboard/messages', requireAuth, getRecentMessages);
  app.get('/api/dashboard/weather', requireAuth, getCalendarWeather);
  app.post('/api/dashboard/navigate-and-send-eta', requireAuth, navigateAndSendETA);
  app.post('/api/dashboard/send-invoice', requireAuth, sendInvoiceNotification);
  app.put('/api/dashboard/services/:id', requireAuth, updateService);

  // Dashboard actionable notifications endpoint
  app.get('/api/dashboard/actionable-items', requireAuth, async (req: Request, res: Response) => {
    try {
      const { quoteRequests, conversations, appointments, callEvents } = await import('@shared/schema');
      const { and, or, isNull, gt, inArray, desc } = await import('drizzle-orm');
      
      // Get pending quote requests
      const pendingQuotes = await db
        .select({
          id: quoteRequests.id,
          customerName: quoteRequests.customerName,
          issueDescription: quoteRequests.issueDescription,
          damageType: quoteRequests.damageType,
          createdAt: quoteRequests.createdAt,
          status: quoteRequests.status,
        })
        .from(quoteRequests)
        .where(eq(quoteRequests.status, 'pending'));
      
      // Get conversations with unread messages
      const unreadConversations = await db
        .select({
          id: conversations.id,
          customerName: conversations.customerName,
          platform: conversations.platform,
          lastMessageTime: conversations.lastMessageTime,
          unreadCount: conversations.unreadCount,
        })
        .from(conversations)
        .where(
          and(
            gt(conversations.unreadCount, 0),
            eq(conversations.status, 'active')
          )
        )
        .limit(10);
      
      // Get appointments awaiting deposit payment
      const pendingDeposits = await db
        .select({
          id: appointments.id,
          scheduledTime: appointments.scheduledTime,
          depositAmount: appointments.depositAmount,
          status: appointments.status,
        })
        .from(appointments)
        .where(
          and(
            eq(appointments.status, 'pending'),
            eq(appointments.depositPaid, false)
          )
        );
      
      // Get recent missed calls (inbound calls that weren't answered)
      const missedCalls = await db
        .select({
          id: callEvents.id,
          callSid: callEvents.callSid,
          from: callEvents.from,
          to: callEvents.to,
          status: callEvents.status,
          createdAt: callEvents.createdAt,
          conversationId: callEvents.conversationId,
        })
        .from(callEvents)
        .where(
          and(
            eq(callEvents.direction, 'inbound'),
            inArray(callEvents.status, ['no-answer', 'busy', 'failed', 'canceled'])
          )
        )
        .orderBy(desc(callEvents.createdAt))
        .limit(10);
      
      res.json({
        success: true,
        data: {
          pendingQuotes: pendingQuotes || [],
          unreadCount: unreadConversations?.length || 0,
          unreadConversations: unreadConversations || [],
          pendingConfirmations: pendingDeposits || [],
          missedCalls: missedCalls || [],
          totalActionableItems: (pendingQuotes?.length || 0) + (unreadConversations?.length || 0) + (pendingDeposits?.length || 0) + (missedCalls?.length || 0),
        },
      });
    } catch (error) {
      console.error('[DASHBOARD] Error fetching actionable items:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch actionable items',
      });
    }
  });

  // Business settings endpoints
  app.get('/api/business-settings', requireAuth, async (req: Request, res: Response) => {
    try {
      const settings = await db.select().from(businessSettings).where(eq(businessSettings.id, 1)).limit(1);
      
      // If no settings exist, create default settings
      if (settings.length === 0) {
        const defaultSettings = await db.insert(businessSettings).values({
          id: 1,
          startHour: 9,
          startMinute: 0,
          endHour: 15,
          endMinute: 0,
          enableLunchBreak: true,
          lunchHour: 12,
          lunchMinute: 0,
          daysOfWeek: [1, 2, 3, 4, 5],
          allowWeekendBookings: false,
          halfHourIncrements: true,
          minimumNoticeHours: 24,
          etaPadding: 15,
          googlePlaceId: "",
          updatedBy: req.user?.id,
        }).returning();
        return res.json({ success: true, settings: defaultSettings[0] });
      }
      
      res.json({ success: true, settings: settings[0] });
    } catch (error) {
      console.error('Error fetching business settings:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch business settings' });
    }
  });

  // Switch seasonal schedule
  app.post('/api/business-settings/switch-schedule', requireAuth, async (req: Request, res: Response) => {
    try {
      const { scheduleType } = req.body;
      
      if (!['regular', 'summer', 'winter'].includes(scheduleType)) {
        return res.status(400).json({ success: false, message: 'Invalid schedule type' });
      }
      
      const [settings] = await db.select().from(businessSettings).limit(1);
      
      if (!settings) {
        return res.status(404).json({ success: false, message: 'Business settings not found' });
      }
      
      // Determine which hours to apply
      let startHour, startMinute, endHour, endMinute;
      
      if (scheduleType === 'summer') {
        startHour = settings.summerStartHour;
        startMinute = settings.summerStartMinute;
        endHour = settings.summerEndHour;
        endMinute = settings.summerEndMinute;
      } else if (scheduleType === 'winter') {
        startHour = settings.winterStartHour;
        startMinute = settings.winterStartMinute;
        endHour = settings.winterEndHour;
        endMinute = settings.winterEndMinute;
      } else {
        // For regular, we don't change the hours - just update the active type
        startHour = settings.startHour;
        startMinute = settings.startMinute;
        endHour = settings.endHour;
        endMinute = settings.endMinute;
      }
      
      // Update the settings
      const [updated] = await db
        .update(businessSettings)
        .set({
          activeScheduleType: scheduleType,
          startHour,
          startMinute,
          endHour,
          endMinute,
        })
        .where(eq(businessSettings.id, 1))
        .returning();
      
      res.json({ 
        success: true, 
        settings: updated,
        message: `Switched to ${scheduleType} schedule`
      });
    } catch (error: any) {
      console.error('Error switching schedule:', error);
      res.status(500).json({ success: false, message: error.message || 'Failed to switch schedule' });
    }
  });

  app.put('/api/business-settings', requireAuth, async (req: Request, res: Response) => {
    try {
      const updateData = {
        ...req.body,
        updatedAt: new Date(),
        updatedBy: req.user?.id,
      };
      
      const updated = await db.update(businessSettings)
        .set(updateData)
        .where(eq(businessSettings.id, 1))
        .returning();
      
      res.json({ success: true, settings: updated[0], message: 'Business settings updated successfully' });
    } catch (error) {
      console.error('Error updating business settings:', error);
      res.status(500).json({ success: false, error: 'Failed to update business settings' });
    }
  });

  // Agent preferences endpoints
  app.get('/api/agent-preferences', requireAuth, async (req: Request, res: Response) => {
    try {
      const preferences = await db.select().from(agentPreferences).where(eq(agentPreferences.id, 1)).limit(1);
      
      // If no preferences exist, create default preferences
      if (preferences.length === 0) {
        const defaultPreferences = await db.insert(agentPreferences).values({
          id: 1,
          updatedBy: req.user?.id,
        }).returning();
        return res.json({ success: true, preferences: defaultPreferences[0] });
      }
      
      res.json({ success: true, preferences: preferences[0] });
    } catch (error) {
      console.error('Error fetching agent preferences:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch agent preferences' });
    }
  });

  app.put('/api/agent-preferences', requireAuth, async (req: Request, res: Response) => {
    try {
      // Validate request body against schema
      const validationResult = insertAgentPreferencesSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid agent preferences data',
          details: validationResult.error.errors 
        });
      }
      
      const updateData = {
        ...validationResult.data,
        updatedAt: new Date(),
        updatedBy: req.user?.id,
      };
      
      const updated = await db.update(agentPreferences)
        .set(updateData)
        .where(eq(agentPreferences.id, 1))
        .returning();
      
      res.json({ success: true, preferences: updated[0], message: 'Agent preferences updated successfully' });
    } catch (error) {
      console.error('Error updating agent preferences:', error);
      res.status(500).json({ success: false, error: 'Failed to update agent preferences' });
    }
  });

  // Formatter configuration endpoints
  app.get('/api/formatter/settings', (req: Request, res: Response) => {
    try {
      const settings = getFormatterSettings();
      res.json({ success: true, settings });
    } catch (error) {
      console.error('Error getting formatter settings:', error);
      res.status(500).json({ success: false, error: 'Failed to get formatter settings' });
    }
  });

  app.post('/api/formatter/settings', (req: Request, res: Response) => {
    try {
      const { settings } = req.body;
      updateFormatterSettings(settings);
      res.json({ success: true, message: 'Formatter settings updated successfully' });
    } catch (error) {
      console.error('Error updating formatter settings:', error);
      res.status(500).json({ success: false, error: 'Failed to update formatter settings' });
    }
  });

  app.post('/api/formatter/reset', (req: Request, res: Response) => {
    try {
      resetFormatterSettings();
      const settings = getFormatterSettings();
      res.json({ success: true, settings, message: 'Formatter settings reset to defaults' });
    } catch (error) {
      console.error('Error resetting formatter settings:', error);
      res.status(500).json({ success: false, error: 'Failed to reset formatter settings' });
    }
  });

  app.post('/api/test-formatting', async (req: Request, res: Response) => {
    try {
      const baseMessage = "Thanks for contacting Clean Machine Auto Detail. We offer Full Detail services starting at $150. Our business hours are Monday-Friday 9am-5pm. Would you like to schedule an appointment?";

      const responses = {
        sms: responseFormatter.formatSmsResponse(baseMessage, '+1234567890'),
        web: responseFormatter.formatWebResponse(baseMessage, '+1234567890'),
        email: responseFormatter.formatEmailResponse(baseMessage, '+1234567890'),
        smsAppointment: responseFormatter.formatAppointmentResponse(baseMessage, 'sms', '+1234567890'),
        webAppointment: responseFormatter.formatAppointmentResponse(baseMessage, 'web', '+1234567890'),
        emailAppointment: responseFormatter.formatAppointmentResponse(baseMessage, 'email', '+1234567890'),
        smsService: responseFormatter.formatServiceInfoResponse(baseMessage, 'sms', '+1234567890'),
        webService: responseFormatter.formatServiceInfoResponse(baseMessage, 'web', '+1234567890'),
        emailService: responseFormatter.formatServiceInfoResponse(baseMessage, 'email', '+1234567890')
      };

      res.json(responses);
    } catch (error) {
      console.error('Error testing formatter:', error);
      res.status(500).json({ success: false, error: 'Failed to test formatter' });
    }
  });

  app.post('/api/test-email/booking', async (req: Request, res: Response) => {
    try {
      const result = await sendBookingConfirmationEmail(
        'info@cleanmachinetulsa.com',
        'Test Customer',
        'Full Detail Service',
        new Date(Date.now() + 86400000).toLocaleString(),
        '123 Test Street, Tulsa, OK 74105',
        ['Interior Shampoo', 'Headlight Restoration'],
        '2020 Honda Civic'
      );
      res.json(result);
    } catch (error) {
      console.error('Error sending test booking email:', error);
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  app.post('/api/test-email/reminder', async (req: Request, res: Response) => {
    try {
      const result = await sendReminderEmail(
        'info@cleanmachinetulsa.com',
        'Test Customer',
        'Full Detail Service',
        new Date(Date.now() + 86400000).toLocaleString(),
        '123 Test Street, Tulsa, OK 74105'
      );
      res.json(result);
    } catch (error) {
      console.error('Error sending test reminder email:', error);
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  app.post('/api/test-email/business', async (req: Request, res: Response) => {
    try {
      const result = await sendBusinessEmail(
        'info@cleanmachinetulsa.com',
        'Test Email - Communications Hub',
        'This is a test email from the Clean Machine Communications Hub. If you receive this, the SendGrid integration is working correctly!'
      );
      res.json(result);
    } catch (error) {
      console.error('Error sending test business email:', error);
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  app.post('/api/email-stress-test', async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ 
          success: false, 
          error: 'Email address is required' 
        });
      }
      
      console.log(`[EMAIL STRESS TEST] Sending all email types to: ${email}`);
      
      const { sendAllStressTestEmails } = await import('./emailStressTest');
      const result = await sendAllStressTestEmails(email);
      
      console.log(`[EMAIL STRESS TEST] Results: ${result.totalSent} sent, ${result.totalFailed} failed`);
      
      res.json({
        success: result.success,
        message: `Sent ${result.totalSent} emails, ${result.totalFailed} failed`,
        results: result.results,
        totalSent: result.totalSent,
        totalFailed: result.totalFailed
      });
    } catch (error) {
      console.error('[EMAIL STRESS TEST] Error:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  app.post('/api/test-formatting-custom', async (req: Request, res: Response) => {
    try {
      const { sms, web, email, baseMessage } = req.body;

      // Update the formatter settings
      updateFormatterSettings({ sms, web, email });

      // Test with the custom base message
      const testMessage = baseMessage || "Thanks for contacting Clean Machine Auto Detail. We offer Full Detail services starting at $150. Our business hours are Monday-Friday 9am-5pm. Would you like to schedule an appointment?";

      const responses = {
        sms: responseFormatter.formatSmsResponse(testMessage, '+1234567890'),
        web: responseFormatter.formatWebResponse(testMessage, '+1234567890'),
        email: responseFormatter.formatEmailResponse(testMessage, '+1234567890'),
        smsAppointment: responseFormatter.formatAppointmentResponse(testMessage, 'sms', '+1234567890'),
        webAppointment: responseFormatter.formatAppointmentResponse(testMessage, 'web', '+1234567890'),
        emailAppointment: responseFormatter.formatAppointmentResponse(testMessage, 'email', '+1234567890'),
        smsService: responseFormatter.formatServiceInfoResponse(testMessage, 'sms', '+1234567890'),
        webService: responseFormatter.formatServiceInfoResponse(testMessage, 'web', '+1234567890'),
        emailService: responseFormatter.formatServiceInfoResponse(testMessage, 'email', '+1234567890'),
        configurationSaved: true
      };

      res.json(responses);
    } catch (error) {
      console.error('Error testing custom formatter:', error);
      res.status(500).json({ success: false, error: 'Failed to test custom formatter' });
    }
  });

  // Set up routes
  app.get('/api/services', async (req, res) => {
    // Load from Google Sheets (which merges image URLs from database)
    try {
      const googleSheetServices = await getAllServices();

      if (googleSheetServices && Array.isArray(googleSheetServices) && googleSheetServices.length > 0) {
        console.log(`Successfully loaded ${googleSheetServices.length} services from Google Sheet`);
        // Add temporary IDs to Google Sheet services for compatibility
        const servicesWithIds = googleSheetServices.map((service, index) => ({
          id: index + 1,
          ...service,
        }));
        return res.json({ success: true, services: servicesWithIds });
      }
    } catch (error) {
      console.error('Failed to load services from Google Sheet:', error);
    }

    // Last fallback: Hardcoded services with IDs
    console.log('Using hardcoded service data');
    const fallbackServices = [
      {
        id: 1,
        name: "Full Detail",
        priceRange: "$299",
        overview: "Complete interior and exterior detailing",
        detailedDescription: "Complete interior and exterior detailing that restores your vehicle to showroom condition. Includes clay bar treatment, wax protection, interior deep cleaning, and leather/vinyl conditioning.",
        duration: "4-5 hours",
        durationHours: "4.5"
      },
      {
        id: 2,
        name: "Interior Detail",
        priceRange: "$179",
        overview: "Deep interior cleansing",
        detailedDescription: "Deep interior cleansing with steam cleaning, thorough vacuuming, stain removal, and conditioning of all interior surfaces including leather and plastics.",
        duration: "2-3 hours",
        durationHours: "2.5"
      },
      {
        id: 3,
        name: "Exterior Detail",
        priceRange: "$169",
        overview: "Premium exterior wash and protection",
        detailedDescription: "Premium exterior wash, decontamination, polish, and protection with high-grade carnauba wax. Includes wheels, tires, and all exterior trim.",
        duration: "1.5-2 hours",
        durationHours: "1.75"
      },
    ];
    res.json({ success: true, services: fallbackServices });
  });

  app.get('/api/services/search', async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.status(400).json({ success: false, message: 'Search query is required' });
      }

      const services = await searchServices(query);
      res.json({ success: true, services });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to search services',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.get('/api/addon-services', async (req, res) => {
    // Hardcoded add-on services that will always work
    const addOns = [
      {
        name: 'Paint Protection',
        priceRange: '$199',
        description: 'Premium ceramic-based paint protection that guards against UV damage, minor scratches, and environmental contaminants for up to 12 months.',
        duration: '1-2 hours',
        durationHours: 1.5
      },
      {
        name: 'Headlight Restoration',
        priceRange: '$89',
        description: 'Complete restoration of foggy or yellowed headlights to like-new clarity with UV protection to prevent future oxidation.',
        duration: '1 hour',
        durationHours: 1
      },
      {
        name: 'Engine Bay Cleaning',
        priceRange: '$75',
        description: 'Thorough cleaning and degreasing of your engine bay, followed by dressing of all plastic and rubber components for a showroom finish.',
        duration: '1 hour',
        durationHours: 1
      },
      {
        name: 'Leather/Upholstery Protection',
        priceRange: '$99',
        description: 'Premium fabric or leather protectant that repels liquids, prevents staining, and extends the life of your interior surfaces.',
        duration: '45 minutes',
        durationHours: 0.75
      },
      {
        name: 'Odor Elimination',
        priceRange: '$79',
        description: 'Professional-grade odor removal using ozone treatment and steam cleaning to eliminate even the toughest smells from your vehicle.',
        duration: '1-2 hours',
        durationHours: 1.5
      },
      {
        name: 'Pet Hair Removal',
        priceRange: '$45',
        description: 'Specialized treatment to remove embedded pet hair from carpet and upholstery using professional-grade tools and techniques.',
        duration: '30-45 minutes',
        durationHours: 0.5
      },
      {
        name: 'Clay Bar Treatment',
        priceRange: '$65',
        description: 'Deep cleaning of your paint surface to remove embedded contaminants that regular washing cannot remove, leaving a glass-smooth finish.',
        duration: '1 hour',
        durationHours: 1
      },
      {
        name: 'Wheel & Caliper Detailing',
        priceRange: '$85',
        description: 'Comprehensive cleaning and protection of wheels, wheel wells, and brake calipers with specialized products for maximum shine and protection.',
        duration: '1 hour',
        durationHours: 1
      }
    ];

    // Try to get add-ons from Google Sheet first
    try {
      const googleSheetAddOns = await getAddonServices();

      // Only use Google Sheet data if it's valid and has entries
      if (googleSheetAddOns && Array.isArray(googleSheetAddOns) && googleSheetAddOns.length > 0) {
        console.log(`Successfully loaded ${googleSheetAddOns.length} add-on services from Google Sheet`);
        return res.json({ success: true, addOns: googleSheetAddOns });
      }
    } catch (error) {
      console.error('Failed to load add-on services from Google Sheet, using defaults:', error);
    }

    // Fallback to hardcoded add-on services
    console.log('Using hardcoded add-on service data');
    res.json({ success: true, addOns });
  });

  // Helper function to escape XML special characters
  const escapeXml = (unsafe: string): string => {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  // SMS endpoint for chat and actual SMS
  // CRITICAL: Phone normalization for incoming Twilio SMS (field name: 'From')
  // SECURITY: Twilio signature verification enabled
  app.post('/sms', verifyTwilioSignature, normalizePhone('From', { required: false, skipValidation: false }), async (req: Request, res: Response) => {
    try {
      const { Body, From, customerName, NumMedia, MediaUrl0, MediaContentType0 } = req.body;
      const message = Body || '';
      // From is now in E.164 format thanks to middleware
      const phone = From || 'web-client';
      
      // Handle photo uploads from SMS
      if (NumMedia && parseInt(NumMedia) > 0 && MediaUrl0) {
        console.log(`[SMS PHOTO] Received ${NumMedia} photo(s) from ${phone}`);
        
        // Check if this is a damage assessment photo
        const { conversationState } = await import('./conversationState');
        const { handleDamagePhotoUpload } = await import('./damageAssessment');
        const { processCustomerPhoto } = await import('./googleIntegration');
        
        const state = conversationState.getState(phone);
        const isDamageAssessment = (state as any).damageAssessmentRequested;
        
        try {
          // Process photo and store in Google Drive
          const customerName = state.customerName || 'Customer';
          const vehicleInfo = state.vehicles?.[0] ? 
            `${state.vehicles[0].year || ''} ${state.vehicles[0].make || ''} ${state.vehicles[0].model || ''}`.trim() : 
            'Unknown Vehicle';
          
          const result = await processCustomerPhoto(
            MediaUrl0,
            phone,
            customerName,
            vehicleInfo,
            state.customerEmail || ''
          );
          
          if (isDamageAssessment) {
            // Send damage assessment alert
            await handleDamagePhotoUpload(phone, result || MediaUrl0, MediaContentType0 || 'image/jpeg');
            
            // Send confirmation to customer
            const confirmMessage = "Thanks for the photo! I've sent it to the business owner for review. They'll reach out shortly. Let's continue with your appointment...";
            res.set('Content-Type', 'text/xml');
            return res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(confirmMessage)}</Message></Response>`);
          } else {
            // Regular photo upload - send standard confirmation
            const confirmMessage = "Photo received! I've saved it to your customer folder. What else can I help you with?";
            res.set('Content-Type', 'text/xml');
            return res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(confirmMessage)}</Message></Response>`);
          }
        } catch (photoError) {
          console.error('[SMS PHOTO] Error processing photo:', photoError);
          // Continue to normal message flow
        }
      }

      if (!message.trim()) {
        return res.status(400).send('Message is required');
      }

      // Determine if this is a web client or SMS
      // Web clients send isWebClient in the body, SMS comes from Twilio webhook
      const platform = req.headers['x-client-type'] === 'web' ? 'web' : 'sms';
      const isWebClient = req.body.isWebClient === true ||
                          req.body.isWebClient === 'true' ||
                          platform === 'web';

      console.log(`[PLATFORM DETECTION] isWebClient: ${isWebClient}, req.body.isWebClient: ${req.body.isWebClient}, platform: ${platform}`);

      // Get or create conversation first (needed for consent keyword processing)
      const { getOrCreateConversation, addMessage } = await import('./conversationService');
      let conversation = await getOrCreateConversation(phone, customerName || null, platform);

      // Handle SMS consent keywords (STOP/START/HELP) - SMS only
      if (!isWebClient && platform === 'sms') {
        const { processConsentKeyword } = await import('./smsConsentService');
        const consentResult = await processConsentKeyword(conversation.id, message);
        
        if (consentResult.isConsentKeyword && consentResult.autoResponse) {
          console.log(`[SMS CONSENT] Detected ${consentResult.keyword} keyword for conversation ${conversation.id}`);
          
          // Save the consent keyword message from customer
          await addMessage(conversation.id, message, 'customer', platform);
          
          // Save the auto-response message
          await addMessage(conversation.id, consentResult.autoResponse, 'agent', platform);
          
          // Send the auto-response via TwiML
          res.set('Content-Type', 'text/xml');
          return res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(consentResult.autoResponse)}</Message></Response>`);
        }
      }

      console.log(`[SMS/CHAT] Received message. isWebClient: ${isWebClient}, platform: ${platform}, controlMode: ${conversation.controlMode}, conversationId: ${conversation.id}`);

      // For web chat, ALWAYS reset to auto mode regardless of current state
      // Web chat should always get AI responses - manual control is only for SMS
      if (isWebClient && conversation.controlMode !== 'auto') {
        console.log(`[WEB CHAT] Auto-resetting conversation ${conversation.id} to auto mode (was ${conversation.controlMode})`);
        const { handoffConversation } = await import('./conversationService');
        // Update the conversation in the database and get the refreshed object
        conversation = await handoffConversation(conversation.id);
        console.log(`[WEB CHAT] After handoff, controlMode is now: ${conversation.controlMode}`);
      }

      await addMessage(conversation.id, message, 'customer', platform);

      // Check for handoff needs (only for auto mode conversations)
      if (conversation.controlMode === 'auto') {
        const { detectHandoffNeed, triggerHandoff } = await import('./handoffDetectionService');
        const { notifyHandoffRequest } = await import('./smsNotificationService');
        const { getConversationById } = await import('./conversationService');

        // Get message history for better detection
        const fullConversation = await getConversationById(conversation.id);
        const messageHistory = fullConversation?.messages || [];

        const handoffDetection = await detectHandoffNeed(message, conversation.id, messageHistory);

        if (handoffDetection.shouldHandoff && platform === 'sms') {
          console.log(`[HANDOFF DETECTION] Triggering handoff for conversation ${conversation.id}. Reason: ${handoffDetection.reason}`);

          // Trigger the handoff
          await triggerHandoff(conversation.id, handoffDetection.reason);

          // Send notification to business owner
          await notifyHandoffRequest(
            conversation.id,
            conversation.customerName,
            conversation.customerPhone || phone,
            handoffDetection.reason,
            message
          );

          // Update local conversation object
          conversation.controlMode = 'manual';
          conversation.needsHumanAttention = true;
        }
      }

      // SMS-ONLY: Check if conversation is in manual or paused mode
      // Web chat should NEVER hit this block
      console.log(`[MODE CHECK] About to check mode. isWebClient: ${isWebClient}, controlMode: ${conversation.controlMode}`);

      if (!isWebClient && (conversation.controlMode === 'manual' || conversation.controlMode === 'paused')) {
        console.log(`[SMS] Conversation in ${conversation.controlMode} mode - sending holding message`);
        // Don't generate AI response for SMS in manual/paused mode
        const holdingMessage = conversation.controlMode === 'manual'
          ? 'Thank you for your message. One of our team members will respond shortly.'
          : 'We\'re currently reviewing your message. Please wait for a response.';

        res.set('Content-Type', 'text/xml');
        res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(holdingMessage)}</Message></Response>`);
        return;
      }

      // Import the unified AI system (with scheduling tools integrated)
      const { generateAIResponse } = await import('./openai');
      const { getConversationById } = await import('./conversationService');

      // Get behavior settings from conversation
      const behaviorSettings = conversation.behaviorSettings as any || {};

      // Get full conversation history (excluding current message which is already in DB)
      const fullConversation = await getConversationById(conversation.id);
      const allMessages = fullConversation?.messages || [];
      // Exclude the last message (current one we just added) from history
      const conversationHistory = allMessages.slice(0, -1);

      console.log(`[AI RESPONSE] Generating AI response for conversation ${conversation.id}, platform: ${platform}, history length: ${conversationHistory.length}`);

      // Use unified AI system - handles both general chat AND intelligent scheduling
      const response = await generateAIResponse(
        message,
        phone,
        platform,
        behaviorSettings,
        conversationHistory
      );

      // Save AI response
      await addMessage(conversation.id, response, 'ai', platform);

      // Return appropriate format
      if (isWebClient) {
        // For web chat, return JSON
        res.json({ success: true, message: response });
      } else {
        // For actual SMS, return TwiML with escaped XML
        res.set('Content-Type', 'text/xml');
        res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(response)}</Message></Response>`);
      }

    } catch (error) {
      console.error('SMS endpoint error:', error);
      res.status(500).send('Sorry, I encountered an error processing your message. Please try again.');
    }
  });

  // Chat API endpoint - unified AI system for /chat page and popup chat
  // Phone normalization optional - web clients may not have a phone number
  app.post('/api/chat', normalizePhone('customerPhone', { required: false }), async (req: Request, res: Response) => {
    try {
      const { message, channel, customerPhone, customerName } = req.body;

      if (!message || !message.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Message is required'
        });
      }

      // customerPhone is now in E.164 format (if provided)
      const phone = customerPhone || 'web-anonymous-' + Date.now();
      const platform = channel || 'web';

      console.log(`[API/CHAT] Received message from ${phone}, platform: ${platform}`);

      // Get or create conversation
      const { getOrCreateConversation, addMessage } = await import('./conversationService');
      let conversation = await getOrCreateConversation(phone, customerName || null, platform);

      console.log(`[API/CHAT] Conversation ${conversation.id}, controlMode: ${conversation.controlMode}`);

      // Web chat always uses auto mode
      if (conversation.controlMode !== 'auto') {
        console.log(`[API/CHAT] Resetting conversation ${conversation.id} to auto mode`);
        const { handoffConversation } = await import('./conversationService');
        conversation = await handoffConversation(conversation.id);
      }

      // Save customer message
      await addMessage(conversation.id, message, 'customer', platform);

      // Get behavior settings from conversation
      const behaviorSettings = conversation.behaviorSettings as any || {};

      // Get full conversation history (excluding current message which is already in DB)
      const { getConversationById } = await import('./conversationService');
      const fullConversation = await getConversationById(conversation.id);
      const allMessages = fullConversation?.messages || [];
      // Exclude the last message (current one we just added) from history
      const conversationHistory = allMessages.slice(0, -1);

      console.log(`[API/CHAT] Generating AI response for conversation ${conversation.id}, history length: ${conversationHistory.length}`);

      // Use unified AI system with scheduling tools
      const { generateAIResponse } = await import('./openai');
      const aiResponse = await generateAIResponse(
        message,
        phone,
        platform,
        behaviorSettings,
        conversationHistory
      );

      // Save AI response
      await addMessage(conversation.id, aiResponse, 'ai', platform);

      // Return JSON format expected by frontend
      res.json({
        success: true,
        response: aiResponse
      });

    } catch (error) {
      console.error('[API/CHAT] Error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process message',
        message: 'Sorry, I encountered an error. Please try again.'
      });
    }
  });

  // Calendar API routes
  app.get('/api/get-available', handleGetAvailable);
  app.get('/api/available-slots', handleGetAvailable);
  app.post('/api/book', handleBook);
  app.post('/api/book-appointment', handleBook);

  // Dashboard API routes
  app.get('/api/dashboard/upcoming', getUpcomingAppointments);
  app.get('/api/dashboard/today', getTodaysAppointments);
  app.get('/api/dashboard/appointment-counts', getMonthlyAppointmentCounts);
  app.get('/api/dashboard/messages', getRecentMessages);
  app.put('/api/services/update', updateService);

  // Google reviews
  app.get('/api/google-reviews', async (req, res) => {
    try {
      const placeId = req.query.placeId as string | undefined;
      const reviews = await getGoogleReviews(placeId);
      res.json({ success: true, reviews });
    } catch (error) {
      console.error('Error fetching Google reviews:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch Google reviews',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Save Google Maps API key
  app.post('/api/google-maps-api-key', async (req, res) => {
    try {
      const { apiKey } = req.body;
      
      if (!apiKey || apiKey.trim() === '') {
        return res.status(400).json({
          success: false,
          error: 'API key is required'
        });
      }
      
      // Store in environment variable (only persists for current session)
      process.env.GOOGLE_MAPS_API_KEY = apiKey;
      
      console.log('Google Maps API key has been updated');
      
      res.json({
        success: true,
        message: 'Google Maps API key saved successfully (session only - add to environment for persistence)'
      });
    } catch (error) {
      console.error('Error saving Google Maps API key:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to save API key'
      });
    }
  });

  // Test Google Reviews connection
  app.get('/api/test-google-reviews', async (req, res) => {
    try {
      const reviews = await getGoogleReviews();
      
      res.json({
        success: true,
        reviewCount: reviews.length,
        message: `Successfully fetched ${reviews.length} review(s)`
      });
    } catch (error) {
      console.error('Error testing Google Reviews connection:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to connect to Google Reviews API',
        reviewCount: 0
      });
    }
  });

  app.get('/api/google-places/search', async (req, res) => {
    try {
      const { query, location } = req.query;

      if (!query) {
        return res.status(400).json({
          success: false,
          message: 'Query parameter is required'
        });
      }

      const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

      if (!GOOGLE_API_KEY) {
        return res.status(500).json({
          success: false,
          message: 'Google API key not configured'
        });
      }

      const searchQuery = location ? `${query} in ${location}` : query;
      const url = 'https://places.googleapis.com/v1/places:searchText';

      const response = await axios.post(url, {
        textQuery: searchQuery
      }, {
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_API_KEY,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount'
        }
      });

      const places = (response.data.places || []).map((place: any) => ({
        placeId: place.id,
        name: place.displayName?.text || '',
        address: place.formattedAddress || '',
        rating: place.rating || 0,
        totalReviews: place.userRatingCount || 0
      }));

      res.json({
        success: true,
        places,
        message: places.length > 0 ? `Found ${places.length} place(s)` : 'No places found'
      });
    } catch (error: any) {
      console.error('Error searching for place:', error.message);
      res.status(500).json({
        success: false,
        message: 'Failed to search for place',
        error: error.message
      });
    }
  });

  app.get('/api/google-business-photos', async (req, res) => {
    try {
      const placeId = req.query.placeId as string | undefined;
      const photos = await getGoogleBusinessPhotos(placeId);
      res.json({ success: true, photos });
    } catch (error) {
      console.error('Error fetching Google Business photos:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch Google Business photos',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.get('/api/weather', async (req, res) => {
    try {
      const { lat, lon } = req.query;

      if (!lat || !lon) {
        return res.status(400).json({
          success: false,
          message: 'Latitude and longitude are required'
        });
      }

      const weatherData = await getWeatherForecast(
        parseFloat(lat as string),
        parseFloat(lon as string)
      );

      res.json({ success: true, data: weatherData });
    } catch (error) {
      console.error('Error fetching weather data:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch weather data',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.get('/api/weather-forecast', async (req, res) => {
    try {
      const { latitude, longitude, days } = req.query;

      if (!latitude || !longitude) {
        return res.status(400).json({
          success: false,
          message: 'Latitude and longitude are required'
        });
      }

      const forecastDays = days ? parseInt(days as string) : 3;
      const weatherData = await getWeatherForecast(
        parseFloat(latitude as string),
        parseFloat(longitude as string),
        forecastDays
      );

      res.json({ success: true, forecast: weatherData });
    } catch (error) {
      console.error('Error fetching weather forecast:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch weather forecast',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.get('/api/appointment-weather', async (req, res) => {
    try {
      const { latitude, longitude, date } = req.query;

      if (!latitude || !longitude || !date) {
        return res.status(400).json({
          success: false,
          message: 'Latitude, longitude, and date are required'
        });
      }

      const { checkAppointmentWeather } = await import('./weatherService');
      const weatherCheck = await checkAppointmentWeather(
        parseFloat(latitude as string),
        parseFloat(longitude as string),
        date as string
      );

      res.json({ success: true, ...weatherCheck });
    } catch (error) {
      console.error('Error checking appointment weather:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to check appointment weather',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.get('/api/geocode', async (req: Request, res: Response) => {
    try {
      const { address } = req.query;

      if (!address) {
        return res.status(400).json({
          success: false,
          message: 'Address is required'
        });
      }

      const result = await geocodeAddress(address as string);
      res.json(result);
    } catch (error) {
      console.error('Error geocoding address:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.get('/api/distance-check', async (req: Request, res: Response) => {
    try {
      const { address } = req.query;

      if (!address) {
        return res.status(400).json({
          success: false,
          message: 'Address is required'
        });
      }

      const result = await checkDistanceToBusinessLocation(address as string);
      res.json(result);
    } catch (error) {
      console.error('Error checking distance:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.post('/api/calculate-travel-time', normalizePhone('customerPhone', { required: true }), async (req: Request, res: Response) => {
    try {
      const { origin, destination, customerPhone, etaPaddingMinutes } = req.body;

      // customerPhone is already validated and normalized to E.164 by middleware
      if (!origin || !destination || !customerPhone) {
        return res.status(400).json({
          success: false,
          message: 'Origin, destination, and customer phone are required'
        });
      }

      const { calculateAndNotifyOnTheWay } = await import('./navigationService');
      const padding = etaPaddingMinutes || 0;
      const result = await calculateAndNotifyOnTheWay(origin, destination, customerPhone, padding);

      if (result.success) {
        res.json({
          success: true,
          durationMinutes: result.paddedDurationMinutes || result.durationMinutes,
          baseDurationMinutes: result.durationMinutes,
          paddingApplied: padding,
          notificationSent: result.notificationSent
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error || 'Failed to calculate travel time and notify customer'
        });
      }
    } catch (error) {
      console.error('Error in calculate-travel-time route:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  });

  // Query parameter phone normalization
  app.get('/api/chat/history', normalizePhoneQuery('phone', { required: true }), async (req: Request, res: Response) => {
    try {
      const { phone } = req.query;

      // Phone is already validated and normalized to E.164 by middleware
      if (!phone) {
        return res.status(400).json({
          success: false,
          message: 'Phone number is required'
        });
      }

      res.json({
        success: true,
        messages: []
      });
    } catch (error) {
      console.error('Error fetching chat history:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch chat history'
      });
    }
  });

  app.post('/api/chat/send-business-message', normalizePhone('customerPhone', { required: true }), async (req: Request, res: Response) => {
    try {
      const { customerPhone, message, messageId } = req.body;

      // customerPhone is already validated and normalized to E.164 by middleware
      if (!customerPhone || !message) {
        return res.status(400).json({
          success: false,
          message: 'Customer phone and message are required'
        });
      }

      const { sendSMS } = await import('./notifications');
      const smsResult = await sendSMS(customerPhone, message);

      if (smsResult.success) {
        res.json({
          success: true,
          messageId,
          message: 'Message sent successfully'
        });
      } else {
        res.status(500).json({
          success: false,
          error: smsResult.error || 'Failed to send SMS'
        });
      }
    } catch (error) {
      console.error('Error sending business message:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send message'
      });
    }
  });

  // customerPhone is optional - can use customerId instead
  app.post('/api/invoice/award-loyalty-points', normalizePhone('customerPhone', { required: false }), async (req: Request, res: Response) => {
    try {
      const { customerId, customerPhone, invoiceId, amount } = req.body;

      if (!invoiceId || !amount || (!customerId && !customerPhone)) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields for awarding loyalty points'
        });
      }

      const pointsToAdd = Math.floor(Number(amount));
      let dbResult = null;

      if (customerId) {
        dbResult = await addLoyaltyPointsFromInvoice(
          Number(customerId),
          Number(invoiceId),
          Number(amount)
        );
      }

      let sheetsResult = false;
      // customerPhone is now in E.164 format (if provided)
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

  app.post('/api/reload-sheets', async (req: Request, res: Response) => {
    try {
      const { forceReloadSheets } = await import('./knowledge');
      const success = await forceReloadSheets();

      if (success) {
        res.json({
          success: true,
          message: 'Google Sheets data reloaded successfully'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to reload Google Sheets data'
        });
      }
    } catch (error) {
      console.error('Error reloading sheets:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to reload sheets data'
      });
    }
  });

  app.get('/api/google-photos', async (req: Request, res: Response) => {
    try {
      const { getGooglePlacePhotos } = await import('./googleIntegration');
      const photos = await getGooglePlacePhotos();

      res.json({
        success: true,
        photos
      });
    } catch (error) {
      console.error('Error fetching Google Photos:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch photos from Google Places'
      });
    }
  });

  // New endpoint to test sending a business email
  app.post('/api/test-email', async (req: Request, res: Response) => {
    try {
      const recipient = 'info@cleanmachinetulsa.com';
      const subject = 'Test Email from Clean Machine Auto Detail';
      const body = 'This is a test email to verify that email sending is working correctly.';

      await sendBusinessEmail(recipient, subject, body);

      res.json({
        success: true,
        message: `Test email sent successfully to ${recipient}.`
      });
    } catch (error) {
      console.error('Error sending test email:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to send test email.',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  registerLoyaltyRoutes(app);
  registerUpsellRoutes(app);
  registerInvoiceRoutes(app);
  registerEnhancedCustomerRoutes(app);
  registerQuickBookingRoutes(app);
  registerContactsRoutes(app);

  app.post('/api/customers/update', async (req, res) => {
    const { updateCustomer } = await import('./updateCustomer');
    return updateCustomer(req, res);
  });

  // Get all customers for dropdown selector (authenticated endpoint)
  app.get('/api/customers', requireAuth, async (req: Request, res: Response) => {
    try {
      const { search } = req.query;
      const searchTerm = typeof search === 'string' ? search.toLowerCase() : '';

      const { customers } = await import('@shared/schema');
      const { desc, or, like } = await import('drizzle-orm');

      // Build query with optional search
      let query = db.select({
        id: customers.id,
        name: customers.name,
        email: customers.email,
        phone: customers.phone,
        address: customers.address,
        vehicleInfo: customers.vehicleInfo,
        lastInteraction: customers.lastInteraction
      }).from(customers);

      // Apply search filter if provided
      if (searchTerm) {
        query = query.where(
          or(
            like(customers.name, `%${searchTerm}%`),
            like(customers.email, `%${searchTerm}%`),
            like(customers.phone, `%${searchTerm}%`)
          )
        );
      }

      // Sort by most recent interaction
      const customerList = await query.orderBy(desc(customers.lastInteraction)).limit(200);

      res.json({
        success: true,
        customers: customerList
      });
    } catch (error) {
      console.error('Error fetching customers:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch customers'
      });
    }
  });

  // Query parameter phone normalization for customer lookup
  app.get('/api/customer-info', normalizePhoneQuery('phone', { required: true }), async (req: Request, res: Response) => {
    try {
      const { phone } = req.query;

      // Phone is already validated and normalized to E.164 by middleware
      if (!phone || typeof phone !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Phone number is required'
        });
      }

      console.log(`Looking up customer info for phone: ${phone}`);

      const { getEnhancedCustomerServiceHistory } = await import('./enhancedCustomerSearch');
      const customerData = await getEnhancedCustomerServiceHistory(phone);

      if (!customerData.found) {
        return res.json({
          success: false,
          error: 'No customer found with this phone number'
        });
      }

      const customerInfo = {
        name: customerData.name || 'Unknown Customer',
        phone: customerData.phone,
        address: customerData.address || '',
        email: customerData.email || '',
        vehicleInfo: customerData.vehicleInfo || '',
        serviceHistory: customerData.serviceHistory || [],
        lastInteraction: customerData.lastInvoiceDate || 'Unknown'
      };

      res.json({
        success: true,
        customerInfo
      });
    } catch (error) {
      console.error('Error fetching customer info:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve customer information'
      });
    }
  });

  registerFileUploadRoutes(app);
  registerEmailRoutes(app);
  registerCancellationRoutes(app);
  registerConversationRoutes(app);
  registerServiceManagementRoutes(app);
  registerServiceLimitsRoutes(app);
  registerMaintenanceRoutes(app);

  // Register quick reply templates routes
  app.use('/api/quick-replies', quickReplyRoutes);

  // Register customer tag management routes
  app.use('/api/tags', tagRoutes);

  // Register Facebook/Instagram Messenger integration routes
  app.use('/api/facebook', facebookRoutes);

  // Register appointment management routes
  app.use('/api', appointmentRoutes);

  // Register SMS fallback routes
  app.use(smsFallbackRoutes);
  
  // Register Twilio Voice webhook routes for missed call auto-response
  app.use('/api/voice', voiceWebhookRoutes);
  app.use('/api/twilio', twilioStatusCallbackRoutes);
  
  // Register TwiML routes for technician WebRTC calling
  app.use('/twiml', twilmlRoutes);
  
  // Register technician job management routes
  app.use('/api/tech', techJobRoutes);
  
  // Register notification settings routes
  app.use('/api/notifications', notificationRoutes);
  
  // Register gallery photo management routes
  app.use('/api/gallery', galleryRoutes);
  
  // Register subscription cost management routes
  app.use('/api/subscriptions', subscriptionRoutes);
  
  // Register business analytics routes
  app.use('/api/analytics', analyticsRoutes);
  
  // SMS Consent routes
  registerSMSConsentRoutes(app);
  
  // Register recurring services routes
  app.use('/api/recurring-services', recurringServicesRoutes);
  
  // Register calendar availability routes
  app.use('/api/calendar', calendarAvailabilityRoutes);
  
  // Register quote requests routes
  app.use('/api/quote-requests', quoteRequestsRoutes);
  
  // Register quote approval routes (public, no auth required)
  app.use('/api/quote-approval', quoteApprovalRoutes);
  
  // Register voice testing routes (admin-only, for production readiness)
  const voiceTestingRoutes = await import('./routes.voiceTesting');
  app.use('/api/voice-testing', voiceTestingRoutes.default);

  const io = new Server(server, {
    cors: {
      origin: true, // More restrictive than '*'
      credentials: true, // Allow credentials (cookies)
      methods: ['GET', 'POST']
    }
  });

  // Share express-session with Socket.IO for authenticated connections
  // This makes socket.request.session accessible in websocketService.ts
  io.engine.use(sessionMiddleware as any);
  console.log('[SOCKET.IO] Session middleware enabled for WebSocket connections');

  initializeWebSocket(io);

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });

    socket.on('customer_message', (data) => {
      console.log('Received customer message:', data);
      io.emit('new_customer_message', {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        ...data
      });
    });

    socket.on('staff_response', (data) => {
      console.log('Staff responded:', data);
      io.emit('new_staff_response', {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        ...data
      });
    });
  });

  return server;
}