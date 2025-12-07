import { Express, Request, Response } from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { readFileSync } from 'fs';
import { join } from 'path';
import crypto from 'crypto';
import multer from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import { sessionMiddleware } from './sessionMiddleware';
import { db } from './db';
import type { TenantDb } from './tenantDb';
import { eq, and, or, desc, asc, isNull, gte, sql } from 'drizzle-orm';
import { services as servicesTable, businessSettings, agentPreferences, criticalMonitoringSettings, insertCriticalMonitoringSettingsSchema, publicSheetServiceSchema, publicSheetAddonSchema, platformSettings, updatePlatformSettingsSchema } from '@shared/schema';
import { requireRole } from './rbacMiddleware';
import { criticalMonitor } from './criticalMonitoring';
import { registerLoyaltyRoutes } from './routes.loyalty';
import { registerReferralRoutes } from './routes.referral';
import { registerReferralConfigRoutes } from './routes.referralConfig';
import { registerSmsReferralRoutes } from './routes.smsReferral';
import { registerAdminReferralStatsRoutes } from './routes.adminReferralStats';
import { registerPublicCustomerLookupRoutes } from './routes.publicCustomerLookup';
import { registerAdminTenantRoutes } from './routes.adminTenants';
import { registerAdminPhoneConfigRoutes } from './routes.adminPhoneConfig';
import { registerTelephonySettingsRoutes } from './routes.telephonySettings';
import { registerBillingUsageRoutes } from './routes.billingUsage';
import { registerUiModeRoutes } from './routes.settings.uiMode';
import { registerBillingOverviewRoutes } from './routes.settings.billingOverview';
import { registerAdminConciergeSetupRoutes } from './routes.adminConciergeSetup';
import { registerAdminIvrRoutes } from './routes.adminIvr';
import adminTenantReadinessRouter from './routes/adminTenantReadinessRouter';
import adminImpersonationRoutes from './routes.adminImpersonation';
import adminBackfillRoutes from './routes.adminBackfill';
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
import { registerNotificationPreferencesRoutes } from './routes.notificationPreferences';
import { initializeWebSocket } from './websocketService';
import quickReplyRoutes from './routes.quickReplies';
import appointmentRoutes from './routes.appointments';
import smsFallbackRoutes from './routes.smsFallback';
import voiceWebhookRoutes from './routes.voiceWebhook';
import twilioVoiceRoutes from './routes.twilioVoice';
import twilmlRoutes from './routes.twiml';
import { registerCanonicalVoiceRoutes } from './routes.twilioVoiceCanonical';
import { registerTwilioVoiceAiRoutes } from './routes.twilioVoiceAi';
import techJobRoutes from './routes.techJobs';
import notificationRoutes from './routes.notifications';
import twilioStatusCallbackRoutes from './routes.twilioStatusCallback';
import { twilioTestSmsRouter } from './routes/twilioTestSms';
import { twilioTestVoiceRouter } from './routes/twilioTestVoice';
import { twilioMediaRouter } from './routes.twilioMedia';
import { debugEnvRouter } from './routes/debugEnv';
import { twilioDebugSmsRouter } from './routes/twilioDebugSms';
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
  sendInvoiceNotification,
  getDashboardLayout,
  saveDashboardLayout
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
import { registerBootstrapRoutes } from './routes.bootstrap';
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
import calendarAvailabilityShareRoutes from './routes.calendarAvailabilityShare';
import availabilityTemplatesRoutes from './routes.availabilityTemplates';
import { registerHealthRoutes } from './healthCheck';
import phoneSettingsRoutes from './routes.phoneSettings';
import { registerCallRoutes } from './routes.calls';
import { registerTechDepositRoutes } from './routes.techDeposits';
import { registerCallEventsRoutes } from './routes.callEvents';
import { registerCustomerIntelligenceRoutes } from './routes.customerIntelligence';
import { registerEscalationRoutes } from './routes.escalations';
import customerAuthRoutes from './routes.customerAuth';
import { placesRouter } from './routes/places';
import { suggestionsRouter } from './routes/suggestions';
import customerPortalRoutes from './routes.customerPortal';
import { blockDemoSMS, blockDemoEmail, blockDemoPayments, blockDemoVoice, blockDemoGoogleAPI, blockDemoFileUpload, isDemoSession, logDemoActivity } from './demoGuard';

// QR Code Signing Utilities
const QR_SECRET = process.env.QR_SECRET || 'your-secret-key-change-in-production';

function generateQRCodeId(customerId: number): string {
  const timestamp = Date.now();
  const data = `${customerId}:${timestamp}`;
  const signature = crypto
    .createHmac('sha256', QR_SECRET)
    .update(data)
    .digest('base64url');
  
  return `${customerId}:${timestamp}:${signature}`;
}

function verifyQRCodeId(qrCodeId: string): number | null {
  try {
    const parts = qrCodeId.split(':');
    if (parts.length !== 3) return null;
    
    const [customerIdStr, timestampStr, providedSignature] = parts;
    const customerId = parseInt(customerIdStr);
    const timestamp = parseInt(timestampStr);
    
    if (isNaN(customerId) || isNaN(timestamp)) return null;
    
    const data = `${customerId}:${timestamp}`;
    const expectedSignature = crypto
      .createHmac('sha256', QR_SECRET)
      .update(data)
      .digest('base64url');
    
    if (expectedSignature !== providedSignature) {
      console.warn(`Invalid QR code signature for customer ${customerId}`);
      return null;
    }
    
    return customerId;
  } catch (error) {
    console.error('QR code verification error:', error);
    return null;
  }
}

// Reminder API Input Validation Schemas
const reminderJobsQuerySchema = z.object({
  status: z.enum(['pending', 'sent', 'failed', 'snoozed', 'cancelled']).optional(),
  limit: z.coerce.number().int().positive().optional().default(50),
});

const analyticsQuerySchema = z.object({
  days: z.coerce.number().int().positive().optional().default(7),
});

const customerIdParamSchema = z.object({
  customerId: z.coerce.number().int().positive(),
});

const ruleIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const updateRuleBodySchema = z.object({
  enabled: z.boolean().optional(),
  triggerIntervalDays: z.coerce.number().int().positive().optional(),
  reminderWindowDays: z.coerce.number().int().positive().optional(),
});

// Main function to register all routes
export async function registerRoutes(app: Express) {
  const server = createServer(app);

  // Register health check routes (FIRST - no auth required)
  registerHealthRoutes(app);

  // Export download endpoint (no auth required for file downloads)
  app.get('/download/cleanmachine-export.zip', (req: Request, res: Response) => {
    const filePath = path.join(process.cwd(), 'cleanmachine-export.zip');
    if (fs.existsSync(filePath)) {
      res.download(filePath, 'cleanmachine-export.zip');
    } else {
      res.status(404).json({ success: false, message: 'File not found' });
    }
  });

  // SECURITY NOTE: Removed client-side error reporting endpoints to prevent abuse
  // All chatbot errors are now logged server-side in /api/web-chat endpoint

  // Register authentication routes
  registerAuthRoutes(app);
  
  // Register WebAuthn biometric authentication routes
  registerWebAuthnRoutes(app);
  
  // Register bootstrap endpoint (lightweight initial load data)
  registerBootstrapRoutes(app);

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
        await req.tenantDb!.insert(orgSettings).values({
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
        await req.tenantDb!.insert(orgSettings).values({
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
  
  // REMOVED: Legacy health check endpoint replaced by new critical monitoring system
  // See server/healthCheck.ts for the new implementation
  
  // Register error monitoring routes
  const { registerErrorMonitoringRoutes } = await import('./routes.errorMonitoring');
  registerErrorMonitoringRoutes(app);
  
  // Register AI-powered search routes
  registerSearchRoutes(app);

  // Register password change routes (must be accessible even when password change is required)
  app.use('/api/auth', passwordRoutes);

  // Phase 15: Register customer portal authentication routes (public, no auth required)
  app.use('/api/public/customer-auth', customerAuthRoutes);
  
  // Google Places API proxy for address autocomplete (public, no auth required)
  app.use('/api/places', placesRouter);
  
  // Suggestions/Feedback routes (platform + tenant + public)
  app.use('/api/suggestions', suggestionsRouter);
  
  // Phase 15: Register customer portal routes (protected by customer session)
  app.use('/api/portal', customerPortalRoutes);

  // CRITICAL: Apply password change requirement check BEFORE all protected routes
  // This ensures users with temporary passwords cannot access sensitive endpoints
  app.use(checkPasswordChangeRequired);

  // SECURITY: Global authentication middleware for ALL /api/* routes
  // Exceptions are explicitly listed below for public endpoints
  // NOTE: req.originalUrl includes the full path with /api prefix
  app.use('/api', (req, res, next) => {
    const publicPaths = [
      '/api/auth',              // Authentication endpoints
      '/api/public/customer-auth', // Phase 15: Customer portal OTP authentication
      '/api/health',            // Health check endpoint (for monitoring)
      '/api/webhooks',          // Twilio/Stripe webhooks (verified via signatures)
      '/api/voice',             // Twilio voice webhooks
      '/api/twilio',            // Twilio status callbacks
      '/api/quote-approval',    // Public quote approval pages
      '/api/payer-approval',    // Public payer approval pages  
      '/api/sms-consent',       // Public SMS consent page
      '/api/book',              // Public booking endpoints
      '/api/book-appointment',  // Public booking endpoints
      '/api/quick-booking',     // Public quick booking for returning customers
      '/api/get-available',     // Public availability check
      '/api/available-slots',   // Public availability check
      '/api/geocode',           // Public address geocoding for booking flow
      '/api/distance-check',    // Public distance/service area validation for booking
      '/api/appointment-weather', // Public weather check for appointment dates
      '/api/services',          // Public service listing (needed for booking)
      '/api/addon-services',    // Public addon services
      '/api/homepage-content',  // Public homepage CMS content
      '/api/google-reviews',    // Public Google reviews for homepage
      '/api/gallery',           // Public gallery photos (customer-facing showcase)
      '/api/web-chat',          // Public web chatbot (SECURITY: intent-restricted in conversationHandler.ts)
      '/api/privacy-policy',    // Public privacy policy
      '/api/recurring-service-booking', // Public recurring service booking
      '/api/referral/validate', // Public referral code validation (for booking flow)
      '/api/referral/signup',   // Public referral signup tracking (for booking flow)
      '/api/qr/scan',           // Allow anonymous QR code scans (tracking endpoint)
      '/api/customers/check-phone', // Public customer lookup for smart booking (Phase 3)
      '/api/leads',             // Public lead capture for trial requests
      '/api/admin/demo-settings', // Public demo mode status check (GET only - PUT remains owner-protected)
      '/api/demo',              // Public demo session management
      '/api/loyalty/points/phone', // Public loyalty points lookup by phone (Customer Rewards Portal V2)
      '/api/loyalty/points/email', // Public loyalty points lookup by email (Customer Rewards Portal V2)
      '/api/loyalty/rewards',   // Public rewards catalog (Customer Rewards Portal V2)
      '/api/loyalty/guardrails', // Public redemption guardrails (Customer Rewards Portal V2)
      '/api/loyalty/validate-redemption', // Loyalty Redemption Journey v2 - validate before booking
      '/api/public/site',           // CM-4: Public site data endpoint for generated websites
      '/api/public/pricing',        // Public pricing page data
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
  app.get('/api/dashboard/layout', requireAuth, getDashboardLayout);
  app.post('/api/dashboard/layout', requireAuth, saveDashboardLayout);
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

  // API Usage Dashboard - Get usage summary and health
  app.get('/api/usage-dashboard', requireAuth, async (req: Request, res: Response) => {
    if (req.user.role !== 'owner' && req.user.role !== 'manager') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    try {
      const { apiUsageLogs, serviceHealth } = await import('@shared/schema');
      const { sql } = await import('drizzle-orm');

      // Get last 30 days of usage
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const logs = await req.tenantDb!.select()
        .from(apiUsageLogs)
        .where(req.tenantDb!.withTenantFilter(apiUsageLogs, sql`${apiUsageLogs.timestamp} >= ${thirtyDaysAgo}`))
        .orderBy(sql`${apiUsageLogs.timestamp} DESC`)
        .limit(1000);

      // Get service health
      const health = await req.tenantDb!.select().from(serviceHealth);

      // Calculate summaries
      const totalCost = logs.reduce((sum, log) => sum + parseFloat(log.cost), 0);
      
      // Group by service
      const byService = logs.reduce((acc: any, log) => {
        if (!acc[log.service]) {
          acc[log.service] = { cost: 0, calls: 0 };
        }
        acc[log.service].cost += parseFloat(log.cost);
        acc[log.service].calls += log.quantity;
        return acc;
      }, {});

      return res.json({
        success: true,
        summary: {
          totalCost: totalCost.toFixed(2),
          period: '30 days',
          byService,
        },
        health,
        recentLogs: logs.slice(0, 100),
      });
    } catch (error) {
      console.error('[USAGE DASHBOARD] Error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });

  // API Usage Sync - Manually trigger usage sync
  app.post('/api/usage-sync', requireAuth, async (req: Request, res: Response) => {
    if (req.user.role !== 'owner' && req.user.role !== 'manager') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    try {
      const { syncAllUsage } = await import('./usageTracker');
      const results = await syncAllUsage();
      
      return res.json({ success: true, results });
    } catch (error) {
      console.error('[USAGE SYNC] Error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });

  // Business settings endpoints
  // NOTE: businessSettings is a GLOBAL table (no tenantId) - use db directly, not tenantDb
  app.get('/api/business-settings', requireAuth, async (req: Request, res: Response) => {
    try {
      const settings = await db.select().from(businessSettings).where(
        eq(businessSettings.id, 1)
      ).limit(1);
      
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
  // NOTE: businessSettings is a GLOBAL table (no tenantId) - use db directly
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

  // NOTE: businessSettings is a GLOBAL table (no tenantId) - use db directly
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

  // Homepage Content endpoints
  // NOTE: homepageContent is a GLOBAL/singleton table (no tenantId) - use db directly
  app.get('/api/homepage-content', async (req: Request, res: Response) => {
    try {
      const { homepageContent } = await import('@shared/schema');
      
      // Get the single row (or create default if doesn't exist)
      let [content] = await db.select().from(homepageContent).limit(1);
      
      if (!content) {
        // Create default content
        [content] = await db.insert(homepageContent).values({}).returning();
      }
      
      return res.json({ success: true, content });
    } catch (error) {
      console.error('[HOMEPAGE CONTENT] Error fetching:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });

  // NOTE: homepageContent is a GLOBAL/singleton table (no tenantId) - use db directly
  app.put('/api/homepage-content', requireAuth, async (req: Request, res: Response) => {
    if (req.user.role !== 'owner' && req.user.role !== 'manager') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    try {
      const { homepageContent, insertHomepageContentSchema } = await import('@shared/schema');
      
      const schema = insertHomepageContentSchema.partial();
      const parsed = schema.safeParse(req.body);
      
      if (!parsed.success) {
        return res.status(400).json({ success: false, message: 'Invalid input', errors: parsed.error.issues });
      }
      
      // Get existing row (using db directly - homepageContent is global)
      let [existing] = await db.select().from(homepageContent).limit(1);
      
      let updated;
      if (existing) {
        // Update existing
        [updated] = await db.update(homepageContent)
          .set({
            ...parsed.data,
            updatedAt: new Date(),
            updatedBy: req.user.id,
          })
          .where(eq(homepageContent.id, existing.id))
          .returning();
      } else {
        // Create new
        [updated] = await db.insert(homepageContent)
          .values({
            ...parsed.data,
            updatedBy: req.user.id,
          })
          .returning();
      }
      
      return res.json({ success: true, content: updated });
    } catch (error) {
      console.error('[HOMEPAGE CONTENT] Error updating:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });

  // Template switching endpoint - non-destructive update of only templateId
  // NOTE: homepageContent is a GLOBAL/singleton table (no tenantId) - use db directly
  app.put('/api/homepage-content/template', requireAuth, async (req: Request, res: Response) => {
    try {
      const { homepageContent } = await import('@shared/schema');
      
      // Validate templateId against available templates
      const templateIdSchema = z.object({
        templateId: z.enum([
          'current',
          'luminous_concierge',
          'dynamic_spotlight',
          'prestige_grid',
          'night_drive_neon',
          'executive_minimal',
          'quantum_concierge'
        ]),
      });
      
      const parsed = templateIdSchema.safeParse(req.body);
      
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: 'Invalid template ID',
          errors: parsed.error.issues
        });
      }
      
      // Get existing row (using db directly - homepageContent is global)
      let [existing] = await db.select().from(homepageContent).limit(1);
      
      let updated;
      if (existing) {
        // Update only the templateId field (non-destructive)
        [updated] = await db.update(homepageContent)
          .set({
            templateId: parsed.data.templateId,
            updatedAt: new Date(),
            updatedBy: req.user.id,
          })
          .where(eq(homepageContent.id, existing.id))
          .returning();
      } else {
        // Create new row with the selected template
        [updated] = await db.insert(homepageContent)
          .values({
            templateId: parsed.data.templateId,
            updatedBy: req.user.id,
          })
          .returning();
      }
      
      return res.json({
        success: true,
        content: updated,
        message: `Template switched to ${parsed.data.templateId}`
      });
    } catch (error) {
      console.error('[HOMEPAGE TEMPLATE] Error switching template:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });

  // Logo upload configuration
  const logoStorage = multer.diskStorage({
    destination: function (req, file, cb) {
      const uploadDir = path.join(process.cwd(), 'attached_assets', 'uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
      const ext = path.extname(file.originalname);
      cb(null, `logo${ext}`);
    }
  });

  const logoUpload = multer({
    storage: logoStorage,
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB max size
    },
    fileFilter: (req, file, cb) => {
      const allowedTypes = /jpeg|jpg|png|gif|webp|svg/;
      const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
      const mimetype = /image\/.+/.test(file.mimetype);
      
      if (extname && mimetype) {
        return cb(null, true);
      } else {
        cb(new Error('Only image files are allowed!'));
      }
    }
  });

  // POST /api/upload-logo - Upload logo file
  app.post('/api/upload-logo', requireAuth, blockDemoFileUpload, logoUpload.single('logo'), async (req: Request, res: Response) => {
    if (req.user.role !== 'owner' && req.user.role !== 'manager') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const logoUrl = `/media/uploads/${req.file.filename}`;
    return res.json({ success: true, logoUrl });
  });

  // Resume upload configuration for job applications
  const resumeStorage = multer.diskStorage({
    destination: function (req, file, cb) {
      const uploadDir = path.join(process.cwd(), 'attached_assets', 'uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
      const ext = path.extname(file.originalname);
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, `resume-${uniqueSuffix}${ext}`);
    }
  });

  const resumeUpload = multer({
    storage: resumeStorage,
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB max size
    },
    fileFilter: (req, file, cb) => {
      const allowedTypes = /pdf|doc|docx/;
      const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
      const mimetype = /application\/(pdf|msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document)/.test(file.mimetype);
      
      if (extname && mimetype) {
        return cb(null, true);
      } else {
        cb(new Error('Only PDF, DOC, and DOCX files are allowed!'));
      }
    }
  });

  // GET /api/jobs - Get active job postings (public)
  app.get('/api/jobs', async (req: Request, res: Response) => {
    try {
      const { jobPostings } = await import('@shared/schema');
      
      const jobs = await req.tenantDb!.select()
        .from(jobPostings)
        .where(req.tenantDb!.withTenantFilter(jobPostings, eq(jobPostings.isActive, true)))
        .orderBy(desc(jobPostings.createdAt));
      
      return res.json({ success: true, jobs });
    } catch (error) {
      console.error('[JOBS] Error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });

  // POST /api/jobs/apply - Submit job application (public)
  app.post('/api/jobs/apply', resumeUpload.single('resume'), async (req: Request, res: Response) => {
    try {
      const { jobApplications, insertJobApplicationSchema } = await import('@shared/schema');
      
      const schema = insertJobApplicationSchema.omit({ resumeUrl: true, reviewedBy: true, reviewedAt: true });
      const parsed = schema.safeParse(req.body);
      
      if (!parsed.success) {
        return res.status(400).json({ success: false, message: 'Invalid input', errors: parsed.error.issues });
      }
      
      let resumeUrl = null;
      if (req.file) {
        resumeUrl = `/media/uploads/${req.file.filename}`;
      }
      
      const [application] = await req.tenantDb!.insert(jobApplications).values({
        ...parsed.data,
        resumeUrl,
      }).returning();
      
      console.log(`[JOB APPLICATION] New application from ${application.firstName} ${application.lastName}`);
      
      return res.json({ success: true, application });
    } catch (error) {
      console.error('[JOB APPLICATION] Error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });

  // GET /api/admin/applications - Get all applications (admin only)
  app.get('/api/admin/applications', requireAuth, async (req: Request, res: Response) => {
    if (req.user.role !== 'owner' && req.user.role !== 'manager') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    try {
      const { jobApplications, jobPostings } = await import('@shared/schema');
      
      const applications = await req.tenantDb!.query.jobApplications.findMany({
        with: {
          jobPosting: true,
        },
        orderBy: (apps, { desc }) => [desc(apps.submittedAt)],
      });
      
      return res.json({ success: true, applications });
    } catch (error) {
      console.error('[ADMIN APPLICATIONS] Error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });

  // PUT /api/admin/applications/:id - Update application status
  app.put('/api/admin/applications/:id', requireAuth, async (req: Request, res: Response) => {
    if (req.user.role !== 'owner' && req.user.role !== 'manager') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    try {
      const applicationId = parseInt(req.params.id);
      const { status, notes } = req.body;
      
      const schema = z.object({
        status: z.enum(['new', 'reviewing', 'interviewing', 'rejected', 'hired']).optional(),
        notes: z.string().optional(),
      });
      
      const parsed = schema.safeParse({ status, notes });
      if (!parsed.success) {
        return res.status(400).json({ success: false, message: 'Invalid input' });
      }
      
      const { jobApplications } = await import('@shared/schema');
      const [updated] = await req.tenantDb!.update(jobApplications)
        .set({
          ...parsed.data,
          reviewedBy: req.user.id,
          reviewedAt: new Date(),
        })
        .where(req.tenantDb!.withTenantFilter(jobApplications, eq(jobApplications.id, applicationId)))
        .returning();
      
      return res.json({ success: true, application: updated });
    } catch (error) {
      console.error('[UPDATE APPLICATION] Error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });

  // Demo Mode Settings endpoints
  // GET is public (allows showcase to check if demo is available)
  // PUT is owner-only (admin toggle in dashboard)
  app.get('/api/admin/demo-settings', async (req: Request, res: Response) => {
    try {
      let [settings] = await req.tenantDb!.select().from(platformSettings).limit(1);
      
      // If no settings exist, create default settings
      if (!settings) {
        [settings] = await req.tenantDb!.insert(platformSettings).values({
          demoModeEnabled: false,
        }).returning();
      }
      
      return res.json({ 
        success: true, 
        demoModeEnabled: settings.demoModeEnabled 
      });
    } catch (error) {
      console.error('[DEMO SETTINGS] Error fetching settings:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });

  app.put('/api/admin/demo-settings', requireAuth, requireRole('owner'), async (req: Request, res: Response) => {
    try {
      const parsed = updatePlatformSettingsSchema.safeParse(req.body);
      
      if (!parsed.success) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid input', 
          errors: parsed.error.issues 
        });
      }
      
      // Get existing settings or create new
      let [settings] = await req.tenantDb!.select().from(platformSettings).limit(1);
      
      if (settings) {
        // Update existing
        [settings] = await req.tenantDb!.update(platformSettings)
          .set({
            demoModeEnabled: parsed.data.demoModeEnabled,
            updatedAt: new Date(),
          })
          .where(req.tenantDb!.withTenantFilter(platformSettings, eq(platformSettings.id, settings.id)))
          .returning();
      } else {
        // Create new
        [settings] = await req.tenantDb!.insert(platformSettings)
          .values({
            demoModeEnabled: parsed.data.demoModeEnabled,
          })
          .returning();
      }
      
      console.log(`[DEMO SETTINGS] Demo mode ${parsed.data.demoModeEnabled ? 'enabled' : 'disabled'} by user ${req.user.id}`);
      
      return res.json({ 
        success: true, 
        demoModeEnabled: settings.demoModeEnabled 
      });
    } catch (error) {
      console.error('[DEMO SETTINGS] Error updating settings:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });

  // Demo Mode Authentication endpoint (public - no auth required)
  app.post('/api/demo/start', async (req: Request, res: Response) => {
    try {
      // Check if demo mode is enabled
      const [settings] = await req.tenantDb!.select().from(platformSettings).limit(1);
      
      if (!settings || !settings.demoModeEnabled) {
        return res.status(403).json({ 
          success: false, 
          message: 'Demo mode is currently disabled. Please contact the administrator.' 
        });
      }
      
      // Create demo session
      req.session.isDemo = true;
      req.session.demoStartedAt = Date.now();
      
      // Save session before returning
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      console.log('[DEMO MODE] Demo session started');
      
      return res.json({ 
        success: true, 
        message: 'Demo session created',
        redirectUrl: '/dashboard',
        expiresIn: 7200000, // 2 hours in milliseconds
      });
    } catch (error) {
      console.error('[DEMO MODE] Error starting demo session:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });

  // Critical Monitoring Settings endpoints
  app.get('/api/critical-monitoring/settings', requireAuth, requireRole('manager', 'owner'), async (req: Request, res: Response) => {
    try {
      let [settings] = await req.tenantDb!.select().from(criticalMonitoringSettings).limit(1);
      
      // If no settings exist, create default settings
      if (!settings) {
        const defaultSettings = {
          alertChannels: { sms: true, push: true, email: false },
          smsRecipients: process.env.BUSINESS_PHONE_NUMBER ? [process.env.BUSINESS_PHONE_NUMBER] : [],
          emailRecipients: [],
          pushRoles: ['owner', 'manager'],
          failureThreshold: 3,
          cooldownMinutes: 30,
          updatedBy: req.user?.id,
        };
        
        [settings] = await req.tenantDb!.insert(criticalMonitoringSettings)
          .values(defaultSettings)
          .returning();
      }
      
      // Get current health status
      const healthStatus = criticalMonitor.getHealthStatus();
      const integrationsCount = Object.keys(healthStatus).length;
      
      res.json({ 
        success: true, 
        settings,
        monitoring: {
          integrationsCount,
          healthStatus,
        }
      });
    } catch (error) {
      console.error('Error fetching critical monitoring settings:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch critical monitoring settings' });
    }
  });

  app.put('/api/critical-monitoring/settings', requireAuth, requireRole('owner'), async (req: Request, res: Response) => {
    try {
      // Validate request body
      const validationResult = insertCriticalMonitoringSettingsSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid settings data',
          details: validationResult.error.errors 
        });
      }
      
      const updateData = {
        ...validationResult.data,
        updatedAt: new Date(),
        updatedBy: req.user?.id,
      };
      
      // Check if settings exist
      const [existingSettings] = await req.tenantDb!.select().from(criticalMonitoringSettings).limit(1);
      
      let updated;
      if (existingSettings) {
        // Update existing settings
        [updated] = await req.tenantDb!.update(criticalMonitoringSettings)
          .set(updateData)
          .where(req.tenantDb!.withTenantFilter(criticalMonitoringSettings, eq(criticalMonitoringSettings.id, existingSettings.id)))
          .returning();
      } else {
        // Insert new settings
        [updated] = await req.tenantDb!.insert(criticalMonitoringSettings)
          .values(updateData)
          .returning();
      }
      
      // Reload settings in the monitor
      await criticalMonitor.loadSettings();
      
      res.json({ 
        success: true, 
        settings: updated, 
        message: 'Critical monitoring settings updated successfully' 
      });
    } catch (error) {
      console.error('Error updating critical monitoring settings:', error);
      res.status(500).json({ success: false, error: 'Failed to update critical monitoring settings' });
    }
  });

  // Agent preferences endpoints
  app.get('/api/agent-preferences', requireAuth, async (req: Request, res: Response) => {
    try {
      const preferences = await req.tenantDb!.select().from(agentPreferences).where(
        req.tenantDb!.withTenantFilter(agentPreferences, eq(agentPreferences.id, 1))
      ).limit(1);
      
      // If no preferences exist, create default preferences
      if (preferences.length === 0) {
        const defaultPreferences = await req.tenantDb!.insert(agentPreferences).values({
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
      
      const updated = await req.tenantDb!.update(agentPreferences)
        .set(updateData)
        .where(req.tenantDb!.withTenantFilter(agentPreferences, eq(agentPreferences.id, 1)))
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
      const googleSheetServices = await getAllServices(req.tenantDb!);

      if (googleSheetServices && Array.isArray(googleSheetServices) && googleSheetServices.length > 0) {
        // Validate and sanitize Google Sheets data
        const validatedServices = googleSheetServices
          .map((service, index) => {
            const result = publicSheetServiceSchema.safeParse(service);
            if (!result.success) {
              console.warn(`Invalid service data at index ${index}:`, result.error);
              return null;
            }
            return { id: index + 1, ...result.data };
          })
          .filter(Boolean);

        if (validatedServices.length > 0) {
          console.log(`Successfully validated ${validatedServices.length}/${googleSheetServices.length} services from Google Sheet`);
          return res.json({ success: true, services: validatedServices });
        }
        console.warn('All services failed validation, using fallback');
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

      const services = await searchServices(req.tenantDb!, query);
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
    // Load from Google Sheets with validation
    try {
      const googleSheetAddons = await getAddonServices(req.tenantDb!);
      
      if (googleSheetAddons && Array.isArray(googleSheetAddons) && googleSheetAddons.length > 0) {
        // Validate and sanitize Google Sheets data
        const validatedAddons = googleSheetAddons
          .map((addon, index) => {
            const result = publicSheetAddonSchema.safeParse(addon);
            if (!result.success) {
              console.warn(`Invalid addon data at index ${index}:`, result.error);
              return null;
            }
            return result.data;
          })
          .filter(Boolean);

        if (validatedAddons.length > 0) {
          console.log(`Successfully validated ${validatedAddons.length}/${googleSheetAddons.length} add-ons from Google Sheet`);
          return res.json({ success: true, addOns: validatedAddons });
        }
        console.warn('All add-ons failed validation, using fallback');
      }
    } catch (error) {
      console.error('Failed to load add-ons from Google Sheet:', error);
    }

    // Fallback: Hardcoded add-on services that will always work
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

  // ==================== REMINDER ACTION ENDPOINTS (Phase 4D) ====================
  
  /**
   * PUBLIC endpoint: One-click booking from reminder SMS
   * Verifies token and redirects to booking page with prefilled customer data
   */
  app.get('/api/public/reminder/book', async (req: Request, res: Response) => {
    try {
      const { token } = req.query;
      
      if (!token || typeof token !== 'string') {
        return res.status(400).send(`
          <html>
            <body style="font-family: Arial; padding: 20px; text-align: center;">
              <h1>❌ Invalid Link</h1>
              <p>This booking link is invalid or has expired.</p>
            </body>
          </html>
        `);
      }
      
      const { verifyBookingToken } = await import('./reminderActionTokens');
      const payload = verifyBookingToken(token);
      
      if (!payload) {
        return res.status(400).send(`
          <html>
            <body style="font-family: Arial; padding: 20px; text-align: center;">
              <h1>⏰ Link Expired</h1>
              <p>This booking link has expired (links are valid for 24 hours).</p>
              <p><a href="/book">Click here to book manually</a></p>
            </body>
          </html>
        `);
      }
      
      // Fetch customer data for prefilling
      const { customers, reminderJobs, reminderEvents } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');
      
      const customer = await req.tenantDb!.query.customers.findFirst({
        where: req.tenantDb!.withTenantFilter(customers, eq(customers.id, payload.customerId)),
      });
      
      if (!customer) {
        return res.status(404).send(`
          <html>
            <body style="font-family: Arial; padding: 20px; text-align: center;">
              <h1>❌ Customer Not Found</h1>
              <p><a href="/book">Click here to book manually</a></p>
            </body>
          </html>
        `);
      }
      
      // Log event to reminder_events
      await req.tenantDb!.insert(reminderEvents).values({
        jobId: payload.jobId,
        eventType: 'clicked',
        eventData: { action: 'booking_link_clicked', timestamp: new Date().toISOString() },
      });
      
      console.log(`[REMINDER BOOK] Customer ${customer.id} clicked booking link for job ${payload.jobId}`);
      
      // Build prefilled booking URL with query params
      const params = new URLSearchParams();
      if (customer.name) params.append('name', customer.name);
      if (customer.phone) params.append('phone', customer.phone);
      
      const redirectUrl = `/book?${params.toString()}`;
      
      // Redirect to booking page
      return res.redirect(redirectUrl);
      
    } catch (error) {
      console.error('[REMINDER BOOK] Error processing booking link:', error);
      return res.status(500).send(`
        <html>
          <body style="font-family: Arial; padding: 20px; text-align: center;">
            <h1>❌ Error</h1>
            <p>Something went wrong. Please try again.</p>
            <p><a href="/book">Click here to book manually</a></p>
          </body>
        </html>
      `);
    }
  });
  
  /**
   * PUBLIC endpoint: One-click snooze from reminder SMS
   * Snoozes reminder for 7 days and creates new job
   */
  app.get('/api/public/reminder/snooze', async (req: Request, res: Response) => {
    try {
      const { token } = req.query;
      
      if (!token || typeof token !== 'string') {
        return res.status(400).send(`
          <html>
            <body style="font-family: Arial; padding: 20px; text-align: center;">
              <h1>❌ Invalid Link</h1>
              <p>This snooze link is invalid or has expired.</p>
            </body>
          </html>
        `);
      }
      
      const { verifySnoozeToken } = await import('./reminderActionTokens');
      const payload = verifySnoozeToken(token);
      
      if (!payload) {
        return res.status(400).send(`
          <html>
            <body style="font-family: Arial; padding: 20px; text-align: center;">
              <h1>⏰ Link Expired</h1>
              <p>This snooze link has expired (links are valid for 24 hours).</p>
            </body>
          </html>
        `);
      }
      
      const { reminderJobs, reminderSnoozes, reminderEvents } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');
      const { addDays } = await import('date-fns');
      
      // Get the original job
      const job = await req.tenantDb!.query.reminderJobs.findFirst({
        where: req.tenantDb!.withTenantFilter(reminderJobs, eq(reminderJobs.id, payload.jobId)),
      });
      
      if (!job) {
        return res.status(404).send(`
          <html>
            <body style="font-family: Arial; padding: 20px; text-align: center;">
              <h1>❌ Reminder Not Found</h1>
              <p>This reminder no longer exists.</p>
            </body>
          </html>
        `);
      }
      
      // BUG FIX #3: Validate job status - only pending jobs can be snoozed
      if (job.status !== 'pending') {
        return res.status(400).send(`
          <html>
            <body style="font-family: Arial; padding: 20px; text-align: center;">
              <h1>⚠️ Cannot Snooze Reminder</h1>
              <p>This reminder is no longer active (status: ${job.status}).</p>
              <p style="color: #666; margin-top: 20px;">You can only snooze pending reminders.</p>
            </body>
          </html>
        `);
      }
      
      // BUG FIX #3: Check for existing snooze - prevent duplicates
      const existingSnoozes = await req.tenantDb!.query.reminderSnoozes.findMany({
        where: req.tenantDb!.withTenantFilter(reminderSnoozes, eq(reminderSnoozes.jobId, payload.jobId)),
      });
      
      if (existingSnoozes.length > 0) {
        return res.status(400).send(`
          <html>
            <body style="font-family: Arial; padding: 20px; text-align: center;">
              <h1>⏰ Already Snoozed</h1>
              <p>This reminder has already been snoozed.</p>
              <p style="color: #666; margin-top: 20px;">You'll receive a new reminder on the scheduled date.</p>
            </body>
          </html>
        `);
      }
      
      // Create snooze record
      const snoozeDays = 7;
      const snoozedUntil = addDays(new Date(), snoozeDays);
      
      await req.tenantDb!.insert(reminderSnoozes).values({
        jobId: payload.jobId,
        customerId: payload.customerId,
        snoozedUntil,
        snoozeDuration: `${snoozeDays} days`,
      });
      
      // Update original job status
      await req.tenantDb!.update(reminderJobs)
        .set({ status: 'snoozed' })
        .where(req.tenantDb!.withTenantFilter(reminderJobs, eq(reminderJobs.id, payload.jobId)));
      
      // Create new job scheduled for snoozedUntil date
      await req.tenantDb!.insert(reminderJobs).values({
        ruleId: job.ruleId,
        customerId: job.customerId,
        scheduledFor: snoozedUntil,
        status: 'pending',
        messageContent: null, // Will be regenerated when sent
      });
      
      // Log event
      await req.tenantDb!.insert(reminderEvents).values({
        jobId: payload.jobId,
        eventType: 'snoozed',
        eventData: { 
          action: 'reminder_snoozed', 
          snoozeDays,
          newScheduledDate: snoozedUntil.toISOString(),
          timestamp: new Date().toISOString() 
        },
      });
      
      console.log(`[REMINDER SNOOZE] Job ${payload.jobId} snoozed for ${snoozeDays} days until ${snoozedUntil.toISOString()}`);
      
      // Return success page
      return res.send(`
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1">
          </head>
          <body style="font-family: Arial; padding: 20px; text-align: center; background: #f5f5f5;">
            <div style="max-width: 400px; margin: 40px auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <h1 style="color: #2563eb;">✅ Reminder Snoozed</h1>
              <p style="color: #666; font-size: 16px;">We'll remind you again in ${snoozeDays} days!</p>
              <p style="color: #999; font-size: 14px;">Next reminder: ${snoozedUntil.toLocaleDateString()}</p>
              <div style="margin-top: 30px;">
                <a href="/book" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">Book Now Instead</a>
              </div>
            </div>
          </body>
        </html>
      `);
      
    } catch (error) {
      console.error('[REMINDER SNOOZE] Error processing snooze:', error);
      return res.status(500).send(`
        <html>
          <body style="font-family: Arial; padding: 20px; text-align: center;">
            <h1>❌ Error</h1>
            <p>Something went wrong. Please try again.</p>
          </body>
        </html>
      `);
    }
  });

  // Web Chat endpoint (for homepage chatbot)
  // SECURITY: No Twilio signature required - this is for web clients only
  // Rate-limited to prevent abuse
  const webChatAttempts = new Map<string, number[]>();
  const WEB_CHAT_RATE_LIMIT = 20; // Max 20 messages per IP per 5 minutes
  const WEB_CHAT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
  
  app.post('/api/web-chat', async (req: Request, res: Response) => {
    try {
      const clientIp = req.ip || 'unknown';
      const now = Date.now();
      
      // Rate limiting check
      if (!webChatAttempts.has(clientIp)) {
        webChatAttempts.set(clientIp, []);
      }
      
      const attempts = webChatAttempts.get(clientIp)!;
      const recentAttempts = attempts.filter(timestamp => now - timestamp < WEB_CHAT_WINDOW_MS);
      
      if (recentAttempts.length >= WEB_CHAT_RATE_LIMIT) {
        console.warn(`[WEB CHAT] Rate limit exceeded for IP ${clientIp}`);
        return res.status(429).json({ 
          success: false, 
          error: 'Too many messages. Please slow down.' 
        });
      }
      
      recentAttempts.push(now);
      webChatAttempts.set(clientIp, recentAttempts);
      
      const { Body } = req.body;
      const message = Body || '';
      
      if (!message.trim()) {
        return res.status(400).json({ success: false, error: 'Message is required' });
      }
      
      // SECURITY: Generate a unique session-based identifier for web users
      // NEVER trust client-supplied phone numbers - prevents customer impersonation
      const sessionId = (req as any).session?.id || `web-${clientIp}-${Math.random().toString(36).substr(2, 9)}`;
      const webIdentifier = `web-chat-${sessionId}`;
      
      // Process the web chat message (isolated from SMS customers)
      const { getOrCreateConversation, addMessage } = await import('./conversationService');
      const { processConversation } = await import('./conversationHandler');
      
      const { conversation } = await getOrCreateConversation(
        req.tenantDb!,
        webIdentifier, // Use session-based ID, not client-supplied phone
        null, // customerName
        'web', // platform
        undefined, undefined, undefined, undefined, undefined, undefined
      );
      
      // Save incoming message
      await addMessage(req.tenantDb!, conversation.id, message, 'customer', 'web');
      
      // Process with AI
      const response = await processConversation(req.tenantDb!, webIdentifier, message, 'web');
      
      // Save AI response to database
      await addMessage(req.tenantDb!, conversation.id, response.response, 'ai', 'web');
      
      return res.json({
        success: true,
        message: response.response,
      });
    } catch (error: any) {
      console.error('[WEB CHAT] Error processing web chat message:', error);
      
      // Log critical chatbot errors server-side (triggers SMS alerts)
      try {
        const { logError } = await import('./errorMonitoring');
        await logError({
          type: 'api',
          severity: 'critical',
          message: `Homepage chatbot error: ${error.message || 'Unknown error'}`,
          endpoint: '/api/web-chat',
          metadata: {
            errorStack: error.stack,
            clientIp,
            timestamp: new Date().toISOString(),
          },
        });
      } catch (logErr) {
        console.error('[WEB CHAT] Failed to log error:', logErr);
      }
      
      return res.status(500).json({
        success: false,
        error: 'Failed to process message',
      });
    }
  });

  // SMS endpoint for chat and actual SMS
  // CRITICAL: Phone normalization for incoming Twilio SMS (field name: 'From')
  // SECURITY: Twilio signature verification enabled
  app.post('/sms', verifyTwilioSignature, normalizePhone('From', { required: false, skipValidation: false }), async (req: Request, res: Response) => {
    try {
      const { Body, From, To, customerName, NumMedia, MediaUrl0, MediaContentType0 } = req.body;
      const message = Body || '';
      // From is now in E.164 format thanks to middleware
      const phone = From || 'web-client';
      
      // ✅ Phase 3: Use centralized tenant router for inbound SMS
      const { resolveTenantFromInbound } = await import('./services/tenantCommRouter');
      const { wrapTenantDb } = await import('./tenantDb');
      const resolution = await resolveTenantFromInbound(req, db);
      
      // Set up tenant context for downstream handlers
      req.tenant = { id: resolution.tenantId } as any;
      req.tenantDb = wrapTenantDb(db, resolution.tenantId);
      (req as any).phoneConfig = resolution.phoneConfig;
      (req as any).tenantResolution = resolution;
      
      console.log(`[SMS WEBHOOK] Tenant resolved: ${resolution.tenantId} via ${resolution.resolvedBy}, ivrMode: ${resolution.ivrMode}`);
      
      // Detect which phone line received this SMS by looking up the To number
      let phoneLineId: number | undefined = undefined;
      if (To) {
        const { phoneLines } = await import('@shared/schema');
        const { eq } = await import('drizzle-orm');
        
        const [phoneLine] = await req.tenantDb!
          .select()
          .from(phoneLines)
          .where(req.tenantDb!.withTenantFilter(phoneLines, eq(phoneLines.phoneNumber, To)))
          .limit(1);
        
        if (phoneLine) {
          phoneLineId = phoneLine.id;
          console.log(`[SMS WEBHOOK] Incoming SMS to ${phoneLine.label} (${To})`);
        } else {
          console.warn(`[SMS WEBHOOK] Could not find phone line for ${To}, defaulting to Main Line`);
        }
      }
      
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

      // Check for interactive SMS keywords (RESCHEDULE, CANCEL, KEEP)
      const { normalizeIncomingSmsKeyword, SMS_KEYWORDS } = await import('./sms/interactiveKeywords');
      const keyword = normalizeIncomingSmsKeyword(message);
      
      if (keyword) {
        console.log(`[SMS KEYWORD] Detected interactive keyword: ${keyword}`);
        
        // TODO: Implement keyword-specific flows
        if (keyword === SMS_KEYWORDS.RESCHEDULE) {
          // TODO: Implement reschedule flow using existing scheduling tools
          console.log('[SMS KEYWORD] RESCHEDULE keyword detected - flow not yet implemented');
        } else if (keyword === SMS_KEYWORDS.CANCEL) {
          // TODO: Implement cancel flow using existing cancellation logic
          console.log('[SMS KEYWORD] CANCEL keyword detected - flow not yet implemented');
        } else if (keyword === SMS_KEYWORDS.KEEP) {
          // TODO: Confirm appointment remains scheduled
          console.log('[SMS KEYWORD] KEEP keyword detected - flow not yet implemented');
        }
        // For now, continue to normal conversation flow
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
      let { conversation } = await getOrCreateConversation(
        req.tenantDb!,
        phone,
        customerName || null,
        platform,
        undefined, // facebookSenderId
        undefined, // facebookPageId
        undefined, // emailAddress
        undefined, // emailThreadId
        undefined, // emailSubject
        phoneLineId // Pass detected phone line ID
      );

      // Handle SMS consent keywords (STOP/START/HELP) - SMS only
      if (!isWebClient && platform === 'sms') {
        const { processConsentKeyword } = await import('./smsConsentService');
        const consentResult = await processConsentKeyword(conversation.id, message);
        
        if (consentResult.isConsentKeyword && consentResult.autoResponse) {
          console.log(`[SMS CONSENT] Detected ${consentResult.keyword} keyword for conversation ${conversation.id}`);
          
          // Save the consent keyword message from customer
          await addMessage(req.tenantDb!, conversation.id, message, 'customer', platform, null, phoneLineId);
          
          // Save the auto-response message
          await addMessage(req.tenantDb!, conversation.id, consentResult.autoResponse, 'agent', platform, null, phoneLineId);
          
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
        conversation = await handoffConversation(req.tenantDb!, conversation.id);
        console.log(`[WEB CHAT] After handoff, controlMode is now: ${conversation.controlMode}`);
      }

      const savedMessage = await addMessage(req.tenantDb!, conversation.id, message, 'customer', platform, null, phoneLineId);

      // Check for escalation triggers (Phase 2: "Ask for Jody" VIP Escalation System)
      if (conversation.controlMode === 'auto' && !conversation.humanEscalationActive) {
        const { detectEscalationTrigger, createEscalationRequest } = await import('./escalationService');
        const { getConversationById } = await import('./conversationService');
        
        const escalationMatch = detectEscalationTrigger(message);
        
        if (escalationMatch) {
          console.log('[ESCALATION] Escalation trigger detected:', escalationMatch.tier, '-', escalationMatch.match);
          
          // Get full conversation for context
          const fullConversation = await getConversationById(req.tenantDb!, conversation.id);
          const messageHistory = fullConversation?.messages?.map(m => ({
            role: m.fromCustomer ? 'customer' : 'agent',
            content: m.content
          })) || [];
          
          // Get or create customer record
          const { customers } = await import('@shared/schema');
          const { eq } = await import('drizzle-orm');
          let customer = await req.tenantDb!.query.customers.findFirst({
            where: req.tenantDb!.withTenantFilter(customers, eq(customers.phone, phone))
          });
          
          // Create customer if doesn't exist
          if (!customer) {
            const [newCustomer] = await req.tenantDb!.insert(customers).values({
              phone: phone,
              name: conversation.customerName || undefined,
              isReturningCustomer: false,
            }).returning();
            customer = newCustomer;
          }
          
          // Create escalation request
          await createEscalationRequest({
            conversationId: conversation.id,
            customerId: customer.id,
            customerPhone: phone,
            triggerPhrase: escalationMatch.match,
            triggerMessageId: savedMessage?.id,
            recentMessages: messageHistory,
          });
          
          // Send confirmation to customer (don't call AI)
          const confirmationMessage = `Thank you! I've notified our owner, Jody. She'll respond to you directly very soon. In the meantime, I'm here if you need anything else.`;
          
          // Save and send confirmation message
          await addMessage(req.tenantDb!, conversation.id, confirmationMessage, 'agent', platform, null, phoneLineId);
          
          // Send TwiML response for SMS
          if (!isWebClient && platform === 'sms') {
            res.set('Content-Type', 'text/xml');
            return res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(confirmationMessage)}</Message></Response>`);
          }
          
          // For web client, return JSON
          return res.json({ success: true, message: confirmationMessage });
        }
      }

      // Check if conversation is currently escalated (AI paused)
      if (conversation.humanEscalationActive) {
        console.log('[ESCALATION] Conversation is escalated, AI paused');
        
        // Don't generate AI response - human is handling
        // Send gentle reminder only if last message wasn't already a paused message
        const { getConversationById } = await import('./conversationService');
        const fullConversation = await getConversationById(req.tenantDb!, conversation.id);
        const lastAgentMessage = fullConversation?.messages?.filter(m => !m.fromCustomer).pop();
        const shouldSendReminder = !lastAgentMessage || 
          !lastAgentMessage.content.includes('Jody has been notified');
        
        if (shouldSendReminder) {
          const pausedMessage = `Jody has been notified and will respond shortly. Feel free to wait here or she'll reach out directly!`;
          await addMessage(req.tenantDb!, conversation.id, pausedMessage, 'agent', platform, null, phoneLineId);
          
          if (!isWebClient && platform === 'sms') {
            res.set('Content-Type', 'text/xml');
            return res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(pausedMessage)}</Message></Response>`);
          }
          
          return res.json({ success: true, message: pausedMessage });
        }
        
        // Already sent reminder, just acknowledge receipt
        if (!isWebClient && platform === 'sms') {
          res.set('Content-Type', 'text/xml');
          return res.send(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`);
        }
        
        return res.json({ success: true });
      }

      // Check for handoff needs (only for auto mode conversations)
      if (conversation.controlMode === 'auto') {
        const { detectHandoffNeed, triggerHandoff } = await import('./handoffDetectionService');
        const { notifyHandoffRequest } = await import('./smsNotificationService');
        const { getConversationById } = await import('./conversationService');

        // Get message history for better detection
        const fullConversation = await getConversationById(req.tenantDb!, conversation.id);
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

      // PHASE 7: Feature gating for AI SMS Agent
      const { hasFeature } = await import('@shared/features');
      const { tenants: tenantsTable } = await import('@shared/schema');
      const { eq: eqOp } = await import('drizzle-orm');
      
      const tenantId = (req.tenant as any)?.id || 'root';
      const [tenantRecord] = await db.select().from(tenantsTable).where(eqOp(tenantsTable.id, tenantId));
      
      if (tenantRecord && !hasFeature(tenantRecord, 'aiSmsAgent')) {
        console.warn(`[AI SMS AGENT] Tenant '${tenantId}' with plan '${tenantRecord.planTier}' does not have access to AI SMS Agent`);
        
        // Send a fallback message indicating AI is not available
        const fallbackMessage = 'Thank you for your message. A team member will respond to you shortly.';
        
        await addMessage(req.tenantDb!, conversation.id, fallbackMessage, 'agent', platform, null, phoneLineId);
        
        if (!isWebClient && platform === 'sms') {
          res.set('Content-Type', 'text/xml');
          return res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(fallbackMessage)}</Message></Response>`);
        }
        
        return res.json({ success: true, message: fallbackMessage });
      }

      // Import the unified AI system (with scheduling tools integrated)
      const { generateAIResponse } = await import('./openai');
      const { getConversationById } = await import('./conversationService');

      // Get behavior settings from conversation
      const behaviorSettings = conversation.behaviorSettings as any || {};

      // Get full conversation history (excluding current message which is already in DB)
      const fullConversation = await getConversationById(req.tenantDb!, conversation.id);
      const allMessages = fullConversation?.messages || [];
      // Exclude the last message (current one we just added) from history
      const conversationHistory = allMessages.slice(0, -1);

      console.log(`[AI RESPONSE] Generating AI response for conversation ${conversation.id}, platform: ${platform}, history length: ${conversationHistory.length}`);

      // Use unified AI system - handles both general chat AND intelligent scheduling
      // PHASE 11: Pass tenantId for SMS-optimized prompts
      // AI BEHAVIOR V2: Pass controlMode for state-aware prompts
      const response = await generateAIResponse(
        message,
        phone,
        platform,
        behaviorSettings,
        conversationHistory,
        false, // isDemoMode
        tenantId, // PHASE 11: tenant-aware SMS prompts
        conversation.controlMode || 'auto' // AI BEHAVIOR V2: control mode awareness
      );

      // Save AI response
      await addMessage(req.tenantDb!, conversation.id, response, 'ai', platform);

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
      let { conversation } = await getOrCreateConversation(req.tenantDb!, phone, customerName || null, platform);

      console.log(`[API/CHAT] Conversation ${conversation.id}, controlMode: ${conversation.controlMode}`);

      // Web chat always uses auto mode
      if (conversation.controlMode !== 'auto') {
        console.log(`[API/CHAT] Resetting conversation ${conversation.id} to auto mode`);
        const { handoffConversation } = await import('./conversationService');
        conversation = await handoffConversation(req.tenantDb!, conversation.id);
      }

      // Save customer message
      await addMessage(req.tenantDb!, conversation.id, message, 'customer', platform);

      // Get behavior settings from conversation
      const behaviorSettings = conversation.behaviorSettings as any || {};

      // Get full conversation history (excluding current message which is already in DB)
      const { getConversationById } = await import('./conversationService');
      const fullConversation = await getConversationById(req.tenantDb!, conversation.id);
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
      await addMessage(req.tenantDb!, conversation.id, aiResponse, 'ai', platform);

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

  // Lead capture for 14-day trial requests
  app.post('/api/leads/trial-request', async (req: Request, res: Response) => {
    try {
      const { email, industry } = req.body;
      
      // Validate inputs
      if (!email || !industry) {
        return res.status(400).json({ 
          success: false, 
          message: 'Email and industry are required' 
        });
      }
      
      console.log('[LEAD CAPTURE] New trial request:', { email, industry });
      
      // Send notification email to admin
      const subject = 'New 14-Day Trial Request from Showcase';
      const textContent = `
New Trial Request

Email: ${email}
Industry: ${industry}
Submitted: ${new Date().toLocaleString()}

Follow up with this lead to set up their 14-day trial!
      `.trim();
      
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #7c3aed; border-bottom: 2px solid #7c3aed; padding-bottom: 10px;">New Trial Request</h2>
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 10px 0;"><strong>Email:</strong> ${email}</p>
            <p style="margin: 10px 0;"><strong>Industry:</strong> ${industry}</p>
            <p style="margin: 10px 0;"><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
          </div>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #4b5563;">Follow up with this lead to set up their 14-day trial!</p>
        </div>
      `;
      
      const emailResult = await sendBusinessEmail(
        'admin@cleanmachine.com',
        subject,
        textContent,
        htmlContent
      );
      
      if (emailResult.success) {
        console.log('[LEAD CAPTURE] Email sent successfully to admin@cleanmachine.com');
        res.json({ success: true, message: 'Lead captured successfully' });
      } else {
        console.error('[LEAD CAPTURE] Email send failed:', emailResult.error);
        res.status(500).json({ success: false, message: 'Failed to send notification email' });
      }
      
    } catch (error) {
      console.error('[LEAD CAPTURE] Error processing request:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to submit request' 
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
      // Use Main Line (ID 1) for business messages
      const smsResult = await sendSMS(customerPhone, message, undefined, undefined, 1);

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
  registerReferralRoutes(app);
  registerReferralConfigRoutes(app);
  registerSmsReferralRoutes(app);
  registerAdminReferralStatsRoutes(app);
  registerAdminTenantRoutes(app);
  registerAdminPhoneConfigRoutes(app);
  registerTelephonySettingsRoutes(app);
  registerBillingUsageRoutes(app);
  registerUiModeRoutes(app);
  registerBillingOverviewRoutes(app);
  registerAdminConciergeSetupRoutes(app);
  registerAdminIvrRoutes(app);
  app.use(adminTenantReadinessRouter);
  app.use('/api/admin/impersonate', adminImpersonationRoutes);
  app.use('/api/admin/backfill', adminBackfillRoutes);
  registerCustomerIntelligenceRoutes(app);
  registerPublicCustomerLookupRoutes(app);
  registerUpsellRoutes(app);
  registerInvoiceRoutes(app);

  // QR Code scan tracking redirect endpoint (PUBLIC - no auth required)
  // This endpoint tracks real QR code scans and redirects to configured action URL
  app.get('/api/qr/scan/:qrCodeId', async (req: Request, res: Response) => {
    try {
      // Verify and extract customer ID from signed QR code
      const customerId = verifyQRCodeId(req.params.qrCodeId);
      
      if (!customerId) {
        console.warn(`Invalid or tampered QR code: ${req.params.qrCodeId}`);
        return res.redirect('/'); // Graceful fallback for invalid QR codes
      }

      const { qrCodeActions, referrals, customers } = await import('@shared/schema');
      const { sql } = await import('drizzle-orm');
      
      // Find QR action for this customer
      const action = await req.tenantDb!.query.qrCodeActions.findFirst({
        where: req.tenantDb!.withTenantFilter(qrCodeActions, eq(qrCodeActions.customerId, customerId))
      });
      
      let redirectUrl: string;
      
      if (action) {
        // Track scan if tracking enabled
        if (action.trackingEnabled) {
          await req.tenantDb!.update(qrCodeActions)
            .set({
              scans: sql`${qrCodeActions.scans} + 1`,
              lastScannedAt: sql`now()`,
            })
            .where(req.tenantDb!.withTenantFilter(qrCodeActions, eq(qrCodeActions.id, action.id)));
          
          console.log(`QR scan tracked for customer ${customerId}: scan #${action.scans + 1}`);
        }
        
        redirectUrl = action.actionUrl;
      } else {
        // Default: find customer's referral code and redirect to booking
        const customer = await req.tenantDb!.query.customers.findFirst({
          where: req.tenantDb!.withTenantFilter(customers, eq(customers.id, customerId)),
        });
        
        if (!customer) {
          console.warn(`Customer ${customerId} not found or has no referral code`);
          return res.redirect('/');
        }

        // Get customer's referral code
        const referral = await req.tenantDb!.query.referrals.findFirst({
          where: req.tenantDb!.withTenantFilter(referrals, eq(referrals.referrerId, customerId)),
        });

        const referralCode = referral?.referralCode;
        
        if (!referralCode) {
          console.warn(`Customer ${customerId} has no referral code`);
          return res.redirect('/');
        }
        
        redirectUrl = `/book?ref=${referralCode}`;
      }
      
      // Detect URL type and redirect appropriately
      const isAbsoluteUrl = /^https?:\/\//i.test(redirectUrl);
      const isProtocolHandler = /^[a-z][a-z0-9+.-]*:/i.test(redirectUrl);
      
      if (isAbsoluteUrl || isProtocolHandler) {
        return res.redirect(redirectUrl);
      }
      
      const fullUrl = `${req.protocol}://${req.get('host')}${redirectUrl.startsWith('/') ? '' : '/'}${redirectUrl}`;
      res.redirect(fullUrl);
      
    } catch (error) {
      console.error('QR scan tracking error:', error);
      res.redirect('/');
    }
  });

  // Generate signed QR code ID for customer (requires auth)
  app.get('/api/qr/generate-id/:customerId', requireAuth, async (req: Request, res: Response) => {
    try {
      const customerId = parseInt(req.params.customerId);
      
      if (isNaN(customerId)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid customer ID' 
        });
      }
      
      const qrCodeId = generateQRCodeId(customerId);
      
      res.json({
        success: true,
        data: { qrCodeId, customerId }
      });
    } catch (error) {
      console.error('Error generating QR code ID:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate QR code ID'
      });
    }
  });

  // QR Code Action API endpoints
  app.get('/api/qr/action/:customerId', requireAuth, async (req: Request, res: Response) => {
    try {
      const customerId = parseInt(req.params.customerId);
      
      if (isNaN(customerId)) {
        return res.status(400).json({ success: false, message: 'Invalid customer ID' });
      }

      const { qrCodeActions, referrals, customers } = await import('@shared/schema');
      const { sql } = await import('drizzle-orm');
      
      // Check if customer exists and get their referral code
      const customer = await req.tenantDb!.query.customers.findFirst({
        where: req.tenantDb!.withTenantFilter(customers, eq(customers.id, customerId)),
      });

      if (!customer) {
        return res.status(404).json({ success: false, message: 'Customer not found' });
      }

      // Get customer's referral code
      const referral = await req.tenantDb!.query.referrals.findFirst({
        where: req.tenantDb!.withTenantFilter(referrals, eq(referrals.referrerId, customerId)),
      });

      const referralCode = referral?.referralCode;

      // Check for configured QR action
      const action = await req.tenantDb!.query.qrCodeActions.findFirst({
        where: req.tenantDb!.withTenantFilter(qrCodeActions, eq(qrCodeActions.customerId, customerId)),
      });

      if (!action) {
        // Default: booking with referral code
        const defaultUrl = referralCode 
          ? `/book?ref=${referralCode}`
          : `/book`;

        return res.json({
          success: true,
          data: {
            actionType: 'booking',
            actionUrl: defaultUrl,
            trackingEnabled: true,
            scans: 0,
          },
        });
      }

      // Return configuration only - scan tracking is handled by /api/qr/scan/:customerId endpoint
      res.json({
        success: true,
        data: {
          actionType: action.actionType,
          actionUrl: action.actionUrl,
          trackingEnabled: action.trackingEnabled,
          scans: action.scans,
        },
      });

    } catch (error) {
      console.error('Error fetching QR action:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch QR action configuration' });
    }
  });
  registerEnhancedCustomerRoutes(app);
  registerQuickBookingRoutes(app);
  registerContactsRoutes(app);
  registerNotificationPreferencesRoutes(app);

  app.post('/api/customers/update', async (req, res) => {
    const { updateCustomer } = await import('./updateCustomer');
    return updateCustomer(req, res);
  });

  // Check if customer is returning and fetch their data (public endpoint for booking flow)
  app.get('/api/customers/check-phone/:phone', async (req: Request, res: Response) => {
    try {
      const phone = req.params.phone;
      const normalizedPhone = phone.startsWith('+1') ? phone : `+1${phone.replace(/\D/g, '')}`;
      
      // Import schema
      const { customers, appointments, recurringServices, loyaltyPoints } = await import('@shared/schema');
      const { desc, and } = await import('drizzle-orm');
      
      // Find customer - use simple query, NO complex select
      const customerData = await req.tenantDb!.query.customers.findFirst({
        where: req.tenantDb!.withTenantFilter(customers, eq(customers.phone, normalizedPhone)),
      });
      
      if (!customerData) {
        return res.json({
          success: true,
          isReturning: false,
          customer: null,
          recentAppointment: null,
          pastAppointments: [],
          recurringServices: [],
        });
      }
      
      // Calculate loyalty tier from lifetimeValue
      const lifetimeValue = Number(customerData.lifetimeValue) || 0;
      let loyaltyTier = 'bronze';
      if (lifetimeValue >= 1000) loyaltyTier = 'platinum';
      else if (lifetimeValue >= 500) loyaltyTier = 'gold';
      else if (lifetimeValue >= 250) loyaltyTier = 'silver';
      
      // Fetch loyalty points from separate table
      const loyaltyPointsRecord = await req.tenantDb!.query.loyaltyPoints?.findFirst({
        where: req.tenantDb!.withTenantFilter(loyaltyPoints, eq(loyaltyPoints.customerId, customerData.id)),
      });
      
      // Build customer object
      const customer = {
        id: customerData.id,
        name: customerData.name,
        phone: customerData.phone,
        email: customerData.email,
        address: customerData.address,
        isReturning: customerData.isReturningCustomer || false,
        loyaltyPoints: loyaltyPointsRecord?.points || 0,
        loyaltyTier,
        lifetimeValue,
      };
      
      // Fetch recent appointment with service relation
      // Use ONLY "with", NO "select"
      const recentAppt = await req.tenantDb!.query.appointments.findFirst({
        where: req.tenantDb!.withTenantFilter(appointments, eq(appointments.customerId, customerData.id)),
        orderBy: (appointments, { desc }) => [desc(appointments.scheduledTime)],
        with: {
          service: true, // Drizzle will auto-join service table
        },
      });
      
      const recentAppointment = recentAppt ? {
        id: recentAppt.id,
        vehicleYear: recentAppt.vehicleYear,
        vehicleMake: recentAppt.vehicleMake,
        vehicleModel: recentAppt.vehicleModel,
        vehicleColor: recentAppt.vehicleColor,
        address: recentAppt.address,
        scheduledTime: recentAppt.scheduledTime,
        serviceId: recentAppt.serviceId,
        service: recentAppt.service, // Full service object from relation
      } : null;
      
      // Fetch past completed appointments with service relation
      const pastApptsRaw = await req.tenantDb!.query.appointments.findMany({
        where: req.tenantDb!.withTenantFilter(appointments, and(
          eq(appointments.customerId, customerData.id),
          eq(appointments.status, 'completed')
        )),
        orderBy: (appointments, { desc }) => [desc(appointments.scheduledTime)],
        limit: 5,
        with: {
          service: true, // Auto-join service table
        },
      });
      
      const pastAppointments = pastApptsRaw.map(appt => ({
        id: appt.id,
        vehicleYear: appt.vehicleYear,
        vehicleMake: appt.vehicleMake,
        vehicleModel: appt.vehicleModel,
        vehicleColor: appt.vehicleColor,
        address: appt.address,
        scheduledTime: appt.scheduledTime,
        serviceId: appt.serviceId,
        finalPrice: appt.finalPrice,
        status: appt.status,
        service: appt.service, // Full service object
      }));
      
      // Fetch active recurring services
      const recurringServicesRaw = await req.tenantDb!.query.recurringServices?.findMany({
        where: req.tenantDb!.withTenantFilter(recurringServices, and(
          eq(recurringServices.customerId, customerData.id),
          eq(recurringServices.status, 'active')
        )),
      }) || [];
      
      // Map frequency from database format to frontend format
      const frequencyMap: Record<string, string> = {
        'every_3_months': '3months',
        'quarterly': '3months',
        'every_6_months': '6months',
        'yearly': '12months',
      };
      
      const recurringServicesData = recurringServicesRaw.map(rs => ({
        id: rs.id,
        serviceId: rs.serviceId,
        frequency: frequencyMap[rs.frequency] || rs.frequency, // Map to frontend format
        nextServiceDate: rs.nextScheduledDate, // Correct field name
      }));
      
      res.json({
        success: true,
        isReturning: true,
        customer,
        recentAppointment,
        pastAppointments,
        recurringServices: recurringServicesData,
      });
      
    } catch (error) {
      console.error('[Customer Check] Error:', error);
      res.status(500).json({
        success: true, // Graceful degradation
        isReturning: false,
        customer: null,
        recentAppointment: null,
        pastAppointments: [],
        recurringServices: [],
      });
    }
  });

  // Get all customers for dropdown selector (authenticated endpoint)
  app.get('/api/customers', requireAuth, async (req: Request, res: Response) => {
    try {
      const { search } = req.query;
      const searchTerm = typeof search === 'string' ? search.toLowerCase() : '';

      const { customers } = await import('@shared/schema');
      const { desc, or, like } = await import('drizzle-orm');

      // Build query with optional search
      let query = req.tenantDb!.select({
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
          req.tenantDb!.withTenantFilter(customers, or(
            like(customers.name, `%${searchTerm}%`),
            like(customers.email, `%${searchTerm}%`),
            like(customers.phone, `%${searchTerm}%`)
          ))
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
  
  // PHASE 2.3: Canonical voice entry-point + IVR (registered first for priority routing)
  registerCanonicalVoiceRoutes(app);
  
  // Phase 2.3: IVR callback routes (menu selections, voicemail, etc.)
  const { registerIvrRoutes } = await import('./routes.twilioVoiceIvr');
  registerIvrRoutes(app);
  
  // PHASE 4: AI Voice route (provider-agnostic entry point)
  registerTwilioVoiceAiRoutes(app);
  
  // Register NEW Twilio Voice IVR system with business hours detection
  app.use('/twilio/voice', twilioVoiceRoutes);
  
  // Register OLD Twilio Voice webhook routes (legacy - for click-to-call and admin features)
  app.use('/api/voice', voiceWebhookRoutes);
  app.use('/api/twilio', twilioStatusCallbackRoutes);
  
  // Debug env route for Twilio environment verification
  app.use('/api/debug/env', debugEnvRouter);
  
  // Debug outbound SMS route (MUST be before inbound route for proper matching)
  app.use('/api/twilio/sms', twilioDebugSmsRouter);
  
  // Register TEST Twilio SMS and Voice routes (for TWILIO_TEST_SMS_NUMBER only)
  app.use('/api/twilio/sms', twilioTestSmsRouter);
  app.use('/api/twilio/voice', twilioTestVoiceRouter);
  console.log('[TWILIO TEST] Routes registered: /api/twilio/sms/inbound, /api/twilio/voice/inbound, /api/twilio/sms/debug-send, /api/debug/env/twilio');
  
  // Register Twilio media proxy (for voicemail recordings without exposing credentials)
  app.use('/api/twilio', twilioMediaRouter);
  console.log('[TWILIO MEDIA] Proxy route registered: /api/twilio/media/:recordingSid');
  
  // Register TwiML routes for technician WebRTC calling
  app.use('/twiml', twilmlRoutes);
  
  // Register technician job management routes
  app.use('/api/tech', techJobRoutes);
  
  // GET /api/tech/my-shifts - Get logged-in technician's upcoming shifts
  app.get('/api/tech/my-shifts', requireAuth, async (req: Request, res: Response) => {
    try {
      const { technicians, shifts, shiftTemplates } = await import('@shared/schema');
      const technician = await req.tenantDb!.query.technicians.findFirst({
        where: req.tenantDb!.withTenantFilter(technicians, eq(technicians.userId, req.user.id)),
      });

      if (!technician) {
        return res.status(404).json({ success: false, message: 'Technician profile not found' });
      }

      const today = new Date();
      const futureDate = new Date();
      futureDate.setDate(today.getDate() + 30);

      const myShifts = await req.tenantDb!.query.shifts.findMany({
        where: req.tenantDb!.withTenantFilter(shifts, and(
          eq(shifts.technicianId, technician.id),
          gte(shifts.shiftDate, today),
          sql`${shifts.shiftDate} <= ${futureDate}`
        )),
        with: {
          template: true,
        },
        orderBy: [asc(shifts.shiftDate)],
      });

      return res.json({ success: true, shifts: myShifts });
    } catch (error) {
      console.error('[TECH SHIFTS] Error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });

  // GET /api/tech/hours-summary - Get technician's hours for current week
  app.get('/api/tech/hours-summary', requireAuth, async (req: Request, res: Response) => {
    try {
      const { technicians, timeEntries } = await import('@shared/schema');
      const technician = await req.tenantDb!.query.technicians.findFirst({
        where: req.tenantDb!.withTenantFilter(technicians, eq(technicians.userId, req.user.id)),
      });

      if (!technician) {
        return res.status(404).json({ success: false, message: 'Technician profile not found' });
      }

      // Get current week's time entries
      const today = new Date();
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      const entries = await req.tenantDb!.query.timeEntries.findMany({
        where: req.tenantDb!.withTenantFilter(timeEntries, and(
          eq(timeEntries.technicianId, technician.id),
          gte(timeEntries.clockInTime, startOfWeek)
        )),
      });

      // Calculate total hours
      let totalHours = 0;
      entries.forEach(entry => {
        if (entry.clockOutTime) {
          const hours = (entry.clockOutTime.getTime() - entry.clockInTime.getTime()) / (1000 * 60 * 60);
          totalHours += hours;
        }
      });

      const isOvertime = totalHours >= 40;
      const hoursRemaining = Math.max(0, 40 - totalHours);

      return res.json({
        success: true,
        summary: {
          totalHours: Math.round(totalHours * 100) / 100,
          isOvertime,
          hoursRemaining: Math.round(hoursRemaining * 100) / 100,
        },
      });
    } catch (error) {
      console.error('[HOURS SUMMARY] Error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });

  // POST /api/admin/shifts-with-notification - Send SMS notification on shift assignment
  app.post('/api/admin/shifts-with-notification', requireAuth, async (req: Request, res: Response) => {
    if (req.user.role !== 'owner' && req.user.role !== 'manager') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    try {
      const { technicianId, shiftDate, shiftTemplateId } = req.body;
      
      const schema = z.object({
        technicianId: z.coerce.number().int().positive(),
        shiftDate: z.string(),
        shiftTemplateId: z.coerce.number().int().positive(),
      });

      const parsed = schema.safeParse({ technicianId, shiftDate, shiftTemplateId });
      if (!parsed.success) {
        return res.status(400).json({ success: false, message: 'Invalid input' });
      }

      const { shifts, technicians, shiftTemplates } = await import('@shared/schema');
      const { format } = await import('date-fns');
      
      // Get template details first
      const template = await req.tenantDb!.query.shiftTemplates.findFirst({
        where: req.tenantDb!.withTenantFilter(shiftTemplates, eq(shiftTemplates.id, parsed.data.shiftTemplateId)),
      });

      if (!template) {
        return res.status(404).json({ success: false, message: 'Shift template not found' });
      }

      // Create shift with template details
      const [newShift] = await req.tenantDb!.insert(shifts).values({
        technicianId: parsed.data.technicianId,
        shiftDate: new Date(parsed.data.shiftDate),
        templateId: parsed.data.shiftTemplateId,
        startTime: template.startTime,
        endTime: template.endTime,
        status: 'scheduled',
      }).returning();

      // Get technician details
      const technician = await req.tenantDb!.query.technicians.findFirst({
        where: req.tenantDb!.withTenantFilter(technicians, eq(technicians.id, parsed.data.technicianId)),
      });

      // Send SMS notification
      if (technician?.phone) {
        const { sendSMS } = await import('./notifications');
        const message = `New shift assigned: ${template.name} on ${format(new Date(parsed.data.shiftDate), 'MMM dd, yyyy')} (${template.startTime} - ${template.endTime})`;
        await sendSMS(technician.phone, message);
      }

      return res.json({ success: true, shift: newShift });
    } catch (error) {
      console.error('[SHIFTS NOTIFICATION] Error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });

  // POST /api/admin/link-shift-to-appointment - Link existing shift to appointment
  app.post('/api/admin/link-shift-to-appointment', requireAuth, async (req: Request, res: Response) => {
    if (req.user.role !== 'owner' && req.user.role !== 'manager') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    try {
      const { shiftId, appointmentId } = req.body;

      const schema = z.object({
        shiftId: z.coerce.number().int().positive(),
        appointmentId: z.coerce.number().int().positive(),
      });

      const parsed = schema.safeParse({ shiftId, appointmentId });
      if (!parsed.success) {
        return res.status(400).json({ success: false, message: 'Invalid input' });
      }

      const { shifts } = await import('@shared/schema');
      const [updated] = await req.tenantDb!.update(shifts)
        .set({ appointmentId: parsed.data.appointmentId })
        .where(req.tenantDb!.withTenantFilter(shifts, eq(shifts.id, parsed.data.shiftId)))
        .returning();

      return res.json({ success: true, shift: updated });
    } catch (error) {
      console.error('[LINK SHIFT] Error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });
  
  // Register technician deposit tracking routes
  registerTechDepositRoutes(app);
  
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
  
  // Phone settings routes (for phone line management)
  app.use('/api/phone-settings', phoneSettingsRoutes);
  
  // Register call and voicemail routes
  registerCallRoutes(app);
  
  // Register call events routes (recent callers)
  registerCallEventsRoutes(app);
  
  // Register escalation routes (human handoff system)
  registerEscalationRoutes(app);
  
  // PTO Request System Routes (S4)
  // POST /api/tech/pto - Submit PTO request
  app.post('/api/tech/pto', requireAuth, async (req: Request, res: Response) => {
    try {
      const { technicians, ptoRequests } = await import('@shared/schema');
      const technician = await req.tenantDb!.query.technicians.findFirst({
        where: req.tenantDb!.withTenantFilter(technicians, eq(technicians.userId, req.user!.id)),
      });

      if (!technician) {
        return res.status(404).json({ success: false, message: 'Technician profile not found' });
      }

      const schema = z.object({
        startDate: z.string().datetime(),
        endDate: z.string().datetime(),
        requestType: z.enum(['vacation', 'sick', 'personal', 'unpaid']),
        notes: z.string().optional(),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, message: 'Invalid input', errors: parsed.error.issues });
      }

      const start = new Date(parsed.data.startDate);
      const end = new Date(parsed.data.endDate);
      
      // Calculate total days (inclusive)
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

      const [request] = await req.tenantDb!.insert(ptoRequests).values({
        technicianId: technician.id,
        startDate: start,
        endDate: end,
        requestType: parsed.data.requestType,
        reason: parsed.data.notes || null,
        totalDays: totalDays.toString(),
        status: 'pending',
      }).returning();

      return res.json({ success: true, request });
    } catch (error) {
      console.error('[PTO REQUEST] Error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });

  // GET /api/admin/pto - Get all PTO requests
  app.get('/api/admin/pto', requireAuth, async (req: Request, res: Response) => {
    if (req.user!.role !== 'owner' && req.user!.role !== 'manager') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    try {
      const { ptoRequests } = await import('@shared/schema');
      const requests = await req.tenantDb!.query.ptoRequests.findMany({
        with: {
          technician: true,
        },
        orderBy: (ptoRequests, { desc }) => [desc(ptoRequests.requestedAt)],
      });

      return res.json({ success: true, requests });
    } catch (error) {
      console.error('[PTO GET] Error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });

  // PUT /api/admin/pto/:id - Approve/deny PTO request
  app.put('/api/admin/pto/:id', requireAuth, async (req: Request, res: Response) => {
    if (req.user!.role !== 'owner' && req.user!.role !== 'manager') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    try {
      const requestId = parseInt(req.params.id);
      const { status, adminNotes } = req.body;

      const schema = z.object({
        status: z.enum(['approved', 'denied']),
        adminNotes: z.string().optional(),
      });

      const parsed = schema.safeParse({ status, adminNotes });
      if (!parsed.success) {
        return res.status(400).json({ success: false, message: 'Invalid input' });
      }

      const { ptoRequests } = await import('@shared/schema');
      const [updated] = await req.tenantDb!.update(ptoRequests)
        .set({
          status: parsed.data.status,
          reviewNotes: parsed.data.adminNotes,
          reviewedBy: req.user!.id,
          reviewedAt: new Date(),
        })
        .where(req.tenantDb!.withTenantFilter(ptoRequests, eq(ptoRequests.id, requestId)))
        .returning();

      return res.json({ success: true, request: updated });
    } catch (error) {
      console.error('[PTO UPDATE] Error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });
  
  // Proactive Reminder System API Routes (Phase 4B)
  app.get('/api/reminders/pending', requireAuth, requireRole('manager', 'owner'), async (req: Request, res: Response) => {
    try {
      const { getReminderJobs } = await import('./reminderService');
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      
      const pendingJobs = await getReminderJobs('pending', limit);
      
      res.json({
        success: true,
        jobs: pendingJobs,
        count: pendingJobs.length,
      });
    } catch (error) {
      console.error('[API] Error fetching pending reminders:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch pending reminders',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.get('/api/reminders/rules', requireAuth, requireRole('manager', 'owner'), async (req: Request, res: Response) => {
    try {
      const { reminderRules } = await import('@shared/schema');
      
      const rules = await req.tenantDb!.query.reminderRules.findMany({
        with: {
          service: true,
        },
        orderBy: (reminderRules, { asc }) => [asc(reminderRules.id)],
      });
      
      res.json({
        success: true,
        rules,
        count: rules.length,
      });
    } catch (error) {
      console.error('[API] Error fetching reminder rules:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch reminder rules',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post('/api/reminders/trigger-manual/:customerId', requireAuth, requireRole('manager', 'owner'), async (req: Request, res: Response) => {
    try {
      const { createReminderJob } = await import('./reminderService');
      const { db } = await import('./db');
      const { reminderRules, customers } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');
      
      const customerId = parseInt(req.params.customerId);
      let { ruleId } = req.body;
      
      if (isNaN(customerId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid customer ID',
        });
      }
      
      // Verify customer exists
      const customer = await req.tenantDb!.query.customers.findFirst({
        where: req.tenantDb!.withTenantFilter(customers, eq(customers.id, customerId)),
      });
      
      if (!customer) {
        return res.status(404).json({
          success: false,
          message: 'Customer not found',
        });
      }
      
      // If ruleId provided, verify it exists
      if (ruleId) {
        const rule = await req.tenantDb!.query.reminderRules.findFirst({
          where: req.tenantDb!.withTenantFilter(reminderRules, eq(reminderRules.id, ruleId)),
        });
        
        if (!rule) {
          return res.status(404).json({
            success: false,
            message: 'Reminder rule not found',
          });
        }
      } else {
        // FIXED: If no ruleId provided, use default rule and assign its ID
        const defaultRule = await req.tenantDb!.query.reminderRules.findFirst({
          where: req.tenantDb!.withTenantFilter(reminderRules, eq(reminderRules.name, 'General Service Reminder - 6 Months')),
        });
        
        if (!defaultRule) {
          return res.status(404).json({
            success: false,
            message: 'Default reminder rule not found',
          });
        }
        
        // CRITICAL FIX: Assign the default rule ID to ruleId
        ruleId = defaultRule.id;
      }
      
      // Generate personalized message for manual reminder
      const { generateReminderMessage } = await import('./gptPersonalizationService');
      const { appointments, services } = await import('@shared/schema');
      const { desc } = await import('drizzle-orm');
      const { differenceInDays } = await import('date-fns');
      
      // Get customer's last appointment to generate context
      const lastAppointment = await req.tenantDb!.query.appointments.findFirst({
        where: req.tenantDb!.withTenantFilter(appointments, eq(appointments.customerId, customerId)),
        orderBy: [desc(appointments.scheduledTime)],
        with: { service: true },
      });
      
      const rule = await req.tenantDb!.query.reminderRules.findFirst({
        where: req.tenantDb!.withTenantFilter(reminderRules, eq(reminderRules.id, ruleId)),
        with: { service: true },
      });
      
      // PHASE 4D: Create job first, then generate personalized message with jobId for action links
      const fallbackMessage = `Hi ${customer.name}, we'd love to detail your vehicle again! Book online or call us at Clean Machine.`;
      const jobId = await createReminderJob(customerId, ruleId, new Date(), fallbackMessage);
      
      // Generate message with available context AND jobId for action links
      let reminderMessage: string = fallbackMessage;
      if (lastAppointment && rule) {
        try {
          const daysSinceService = lastAppointment.scheduledTime 
            ? differenceInDays(new Date(), new Date(lastAppointment.scheduledTime))
            : 90;
          
          // BUG FIX #2: Wrap weather fetch in try/catch to prevent 500 errors
          let weatherToday: string;
          try {
            const weatherResponse = await fetch(
              'https://api.open-meteo.com/v1/forecast?latitude=36.15&longitude=-95.99&current_weather=true&temperature_unit=fahrenheit'
            );
            const weatherData = weatherResponse.ok ? await weatherResponse.json() : null;
            weatherToday = weatherData?.current_weather 
              ? `${weatherData.current_weather.weathercode <= 3 ? 'clear' : 'partly cloudy'} and ${Math.round(weatherData.current_weather.temperature)}°F`
              : 'pleasant';
          } catch (error) {
            console.warn('[MANUAL REMINDER] Weather fetch failed, using defaults:', error);
            weatherToday = 'clear and 65°F';
          }
          
          reminderMessage = await generateReminderMessage(
            {
              id: customer.id,
              name: customer.name,
              phone: customer.phone || '',
              loyaltyTier: customer.loyaltyTier || 'bronze',
              lifetimeValue: customer.lifetimeValue || '0.00',
            },
            {
              lastServiceDate: lastAppointment.scheduledTime || new Date(),
              lastServiceName: lastAppointment.service?.name || 'detail service',
              daysSinceService,
              recommendedService: rule.service?.name || 'maintenance detail',
              recommendedServicePrice: rule.service?.priceRange || '$150-200',
              weatherToday,
            },
            jobId  // PHASE 4D: Pass jobId for action links
          );
          
          // Update job with personalized message
          const { reminderJobs } = await import('@shared/schema');
          await req.tenantDb!.update(reminderJobs)
            .set({ messageContent: reminderMessage })
            .where(req.tenantDb!.withTenantFilter(reminderJobs, eq(reminderJobs.id, jobId)));
            
        } catch (error) {
          console.error('[MANUAL REMINDER] Error generating personalized message:', error);
          // Job already created with fallback message
        }
      }
      
      res.json({
        success: true,
        message: `Manual reminder created for customer ${customer.name}`,
        jobId,
        generatedMessage: reminderMessage,
      });
    } catch (error) {
      console.error('[API] Error creating manual reminder:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create manual reminder',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post('/api/reminders/test', requireAuth, requireRole('manager', 'owner'), async (req: Request, res: Response) => {
    try {
      const { identifyCustomersNeedingReminders } = await import('./reminderService');
      
      // Run the identification logic without creating jobs
      const customersNeedingReminders = await identifyCustomersNeedingReminders();
      
      res.json({
        success: true,
        message: `Test complete: ${customersNeedingReminders.length} customers would receive reminders`,
        customers: customersNeedingReminders.map(c => ({
          customerId: c.customerId,
          customerName: c.customerName,
          serviceName: c.serviceName,
          ruleName: c.ruleName,
          daysSinceLastService: c.daysSinceLastService,
          lastAppointmentDate: c.lastAppointmentDate,
        })),
        count: customersNeedingReminders.length,
      });
    } catch (error) {
      console.error('[API] Error testing reminder system:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to test reminder system',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Phase 4E: Reminder Admin API Routes
  
  // 1. GET /api/reminders/jobs - Get reminder queue with filters and pagination
  app.get('/api/reminders/jobs', requireAuth, async (req: Request, res: Response) => {
    try {
      // Only admins and managers can access
      if (req.user.role !== 'owner' && req.user.role !== 'manager') {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }

      // Validate query parameters
      const queryParsed = reminderJobsQuerySchema.safeParse(req.query);
      if (!queryParsed.success) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid query parameters', 
          errors: queryParsed.error.issues 
        });
      }

      const { status, limit } = queryParsed.data;
      
      // Reuse existing getReminderJobs function from reminderService
      const { getReminderJobs } = await import('./reminderService');
      const jobs = await getReminderJobs(status, limit);
      
      return res.json({ success: true, jobs });
    } catch (error) {
      console.error('[REMINDER API] Error fetching reminder jobs:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  });

  // 2. POST /api/reminders/send-now/:customerId - Manually trigger reminder for specific customer
  app.post('/api/reminders/send-now/:customerId', requireAuth, async (req: Request, res: Response) => {
    try {
      // Only admins and managers
      if (req.user.role !== 'owner' && req.user.role !== 'manager') {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }

      // Validate customerId param
      const paramParsed = customerIdParamSchema.safeParse(req.params);
      if (!paramParsed.success) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid customer ID',
          errors: paramParsed.error.issues,
        });
      }

      const customerId = paramParsed.data.customerId;
      
      // Check if customer opted out
      const { reminderOptOuts } = await import('@shared/schema');
      const optOut = await req.tenantDb!.query.reminderOptOuts.findFirst({
        where: req.tenantDb!.withTenantFilter(reminderOptOuts, eq(reminderOptOuts.customerId, customerId)),
      });
      
      if (optOut) {
        return res.status(400).json({ 
          success: false, 
          message: 'Customer has opted out of reminders',
          optedOutAt: optOut.optedOutAt 
        });
      }
      
      // Get customer's most recent appointment
      const { appointments, customers } = await import('@shared/schema');
      const customer = await req.tenantDb!.query.customers.findFirst({
        where: req.tenantDb!.withTenantFilter(customers, eq(customers.id, customerId)),
      });
      
      if (!customer) {
        return res.status(404).json({ success: false, message: 'Customer not found' });
      }
      
      const lastAppt = await req.tenantDb!.query.appointments.findFirst({
        where: req.tenantDb!.withTenantFilter(appointments, and(
          eq(appointments.customerId, customerId),
          eq(appointments.completed, true)
        )),
        orderBy: [desc(appointments.scheduledTime)],
        with: {
          service: true,
        },
      });
      
      if (!lastAppt) {
        return res.status(400).json({ success: false, message: 'No completed appointments for customer' });
      }
      
      // Find applicable rule
      const { reminderRules } = await import('@shared/schema');
      const rule = await req.tenantDb!.query.reminderRules.findFirst({
        where: req.tenantDb!.withTenantFilter(reminderRules, and(
          eq(reminderRules.enabled, true),
          or(
            eq(reminderRules.serviceId, lastAppt.serviceId),
            isNull(reminderRules.serviceId)
          )
        )),
      });
      
      if (!rule) {
        return res.status(400).json({ success: false, message: 'No reminder rule found for this service' });
      }
      
      const daysSinceService = Math.floor((Date.now() - lastAppt.scheduledTime.getTime()) / (1000 * 60 * 60 * 24));
      
      // Fetch weather data
      let weatherToday: string;
      try {
        const weatherResponse = await fetch(
          'https://api.open-meteo.com/v1/forecast?latitude=36.15&longitude=-95.99&current_weather=true&temperature_unit=fahrenheit'
        );
        const weatherData = weatherResponse.ok ? await weatherResponse.json() : null;
        weatherToday = weatherData?.current_weather 
          ? `${weatherData.current_weather.weathercode <= 3 ? 'clear' : 'partly cloudy'} and ${Math.round(weatherData.current_weather.temperature)}°F`
          : 'pleasant';
      } catch (error) {
        console.warn('[SEND NOW] Weather fetch failed, using defaults:', error);
        weatherToday = 'clear and 65°F';
      }
      
      // Generate personalized message via GPT
      const { generateReminderMessage } = await import('./gptPersonalizationService');
      const message = await generateReminderMessage(
        {
          id: customer.id,
          name: customer.name,
          phone: customer.phone || '',
          loyaltyTier: customer.loyaltyTier || 'bronze',
          lifetimeValue: customer.lifetimeValue || '0.00',
        },
        {
          lastServiceDate: lastAppt.scheduledTime,
          lastServiceName: lastAppt.service?.name || 'detail service',
          daysSinceService,
          recommendedService: rule.service?.name || 'maintenance detail',
          recommendedServicePrice: rule.service?.priceRange || '$150-200',
          weatherToday,
        }
      );
      
      // Create reminder job with scheduledFor = NOW
      const { createReminderJob } = await import('./reminderService');
      const jobId = await createReminderJob(customerId, rule.id, new Date(), message);
      
      // Send immediately (don't wait for cron)
      const { sendSMS } = await import('./notifications');
      if (customer.phone && customer.smsConsent) {
        await sendSMS(customer.phone, message);
        
        // Mark job as sent
        const { markReminderSent } = await import('./reminderService');
        await markReminderSent(jobId, 'sms');
      }
      
      return res.json({ 
        success: true, 
        jobId,
        message: 'Reminder sent successfully',
        sentVia: customer.phone && customer.smsConsent ? 'sms' : 'none',
      });
    } catch (error) {
      console.error('[REMINDER API] Manual send error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  });

  // 3. GET /api/reminders/analytics - Get aggregated stats for reminder performance
  app.get('/api/reminders/analytics', requireAuth, async (req: Request, res: Response) => {
    try {
      // Only admins and managers
      if (req.user.role !== 'owner' && req.user.role !== 'manager') {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }

      // Validate query parameters
      const queryParsed = analyticsQuerySchema.safeParse(req.query);
      if (!queryParsed.success) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid query parameters', 
          errors: queryParsed.error.issues 
        });
      }

      const { days } = queryParsed.data;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      const { reminderJobs, reminderOptOuts } = await import('@shared/schema');
      
      // Count pending jobs
      const pendingCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(reminderJobs)
        .where(eq(reminderJobs.status, 'pending'));
      
      // Count sent in last N days
      const sentCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(reminderJobs)
        .where(and(
          eq(reminderJobs.status, 'sent'),
          gte(reminderJobs.sentAt, startDate)
        ));
      
      // Count failed in last N days
      const failedCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(reminderJobs)
        .where(and(
          eq(reminderJobs.status, 'failed'),
          gte(reminderJobs.lastAttemptAt, startDate)
        ));
      
      // Count opt-outs
      const optOutCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(reminderOptOuts);
      
      // Success rate = sent / (sent + failed)
      const totalAttempts = (sentCount[0]?.count || 0) + (failedCount[0]?.count || 0);
      const successRate = totalAttempts > 0 
        ? Math.round((sentCount[0]?.count || 0) / totalAttempts * 100) 
        : 0;
      
      return res.json({
        success: true,
        analytics: {
          pending: pendingCount[0]?.count || 0,
          sentLast7Days: sentCount[0]?.count || 0,
          failedLast7Days: failedCount[0]?.count || 0,
          successRate: successRate,
          totalOptOuts: optOutCount[0]?.count || 0,
          timeRange: `${days} days`,
        },
      });
    } catch (error) {
      console.error('[REMINDER API] Error fetching reminder analytics:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  });

  // 4. GET /api/reminders/rules - Get all reminder rules
  app.get('/api/reminders/rules', requireAuth, async (req: Request, res: Response) => {
    try {
      // Only admins and managers
      if (req.user.role !== 'owner' && req.user.role !== 'manager') {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }

      const { reminderRules } = await import('@shared/schema');
      const rules = await req.tenantDb!.query.reminderRules.findMany({
        with: {
          service: true,
        },
        orderBy: [desc(reminderRules.enabled), asc(reminderRules.name)],
      });
      
      return res.json({ success: true, rules });
    } catch (error) {
      console.error('[REMINDER API] Error fetching reminder rules:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  });

  // 5. PUT /api/reminders/rules/:id - Update reminder rule
  app.put('/api/reminders/rules/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      // Only admins and managers
      if (req.user.role !== 'owner' && req.user.role !== 'manager') {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }

      // Validate rule ID param
      const paramParsed = ruleIdParamSchema.safeParse(req.params);
      if (!paramParsed.success) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid rule ID', 
          errors: paramParsed.error.issues 
        });
      }

      // Validate request body
      const bodyParsed = updateRuleBodySchema.safeParse(req.body);
      if (!bodyParsed.success) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid request body', 
          errors: bodyParsed.error.issues 
        });
      }

      const ruleId = paramParsed.data.id;
      const updateData = bodyParsed.data;
      
      const { reminderRules } = await import('@shared/schema');
      
      // Update rule
      const [updated] = await req.tenantDb!
        .update(reminderRules)
        .set(updateData)
        .where(req.tenantDb!.withTenantFilter(reminderRules, eq(reminderRules.id, ruleId)))
        .returning();
      
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Rule not found' });
      }
      
      return res.json({ success: true, rule: updated });
    } catch (error) {
      console.error('[REMINDER API] Error updating reminder rule:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  });

  // Admin Shift Management Routes
  
  // GET /api/admin/shifts - Get all shifts for date range
  app.get('/api/admin/shifts', requireAuth, async (req: Request, res: Response) => {
    try {
      // RBAC check
      if (req.user.role !== 'owner' && req.user.role !== 'manager') {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }

      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ success: false, message: 'startDate and endDate are required' });
      }
      
      const { shifts, technicians, shiftTemplates } = await import('@shared/schema');
      const { lte } = await import('drizzle-orm');
      
      const shiftList = await req.tenantDb!
        .select({
          id: shifts.id,
          technicianId: shifts.technicianId,
          templateId: shifts.templateId,
          shiftDate: shifts.shiftDate,
          startTime: shifts.startTime,
          endTime: shifts.endTime,
          status: shifts.status,
          notes: shifts.notes,
          createdAt: shifts.createdAt,
          technician: {
            id: technicians.id,
            preferredName: technicians.preferredName,
            fullName: technicians.fullName,
          },
          template: {
            id: shiftTemplates.id,
            name: shiftTemplates.name,
            startTime: shiftTemplates.startTime,
            endTime: shiftTemplates.endTime,
          },
        })
        .from(shifts)
        .leftJoin(technicians, eq(shifts.technicianId, technicians.id))
        .leftJoin(shiftTemplates, eq(shifts.templateId, shiftTemplates.id))
        .where(
          req.tenantDb!.withTenantFilter(shifts, and(
            gte(shifts.shiftDate, startDate as string),
            lte(shifts.shiftDate, endDate as string)
          ))
        )
        .orderBy(asc(shifts.shiftDate));

      return res.json({ success: true, shifts: shiftList });
    } catch (error) {
      console.error('[ADMIN SHIFTS] Error fetching shifts:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  });

  // POST /api/admin/shifts - Create new shift assignment
  app.post('/api/admin/shifts', requireAuth, async (req: Request, res: Response) => {
    try {
      // RBAC check
      if (req.user.role !== 'owner' && req.user.role !== 'manager') {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }

      const { technicianId, shiftDate, shiftTemplateId } = req.body;
      
      // Validate input
      const schema = z.object({
        technicianId: z.coerce.number().int().positive(),
        shiftDate: z.string(),
        shiftTemplateId: z.coerce.number().int().positive(),
      });
      
      const parsed = schema.safeParse({ technicianId, shiftDate, shiftTemplateId });
      if (!parsed.success) {
        return res.status(400).json({ success: false, message: 'Invalid input', errors: parsed.error.issues });
      }

      const { shifts, shiftTemplates } = await import('@shared/schema');
      
      // Get template to populate shift times
      const template = await req.tenantDb!.query.shiftTemplates.findFirst({
        where: req.tenantDb!.withTenantFilter(shiftTemplates, eq(shiftTemplates.id, parsed.data.shiftTemplateId)),
      });
      
      if (!template) {
        return res.status(404).json({ success: false, message: 'Shift template not found' });
      }

      const [newShift] = await req.tenantDb!.insert(shifts).values({
        technicianId: parsed.data.technicianId,
        shiftDate: parsed.data.shiftDate,
        templateId: parsed.data.shiftTemplateId,
        startTime: template.startTime,
        endTime: template.endTime,
        status: 'scheduled',
        createdBy: req.user.id,
      }).returning();

      return res.json({ success: true, shift: newShift });
    } catch (error) {
      console.error('[ADMIN SHIFTS] Error creating shift:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  });

  // DELETE /api/admin/shifts/:id - Remove shift assignment
  app.delete('/api/admin/shifts/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      // RBAC check
      if (req.user.role !== 'owner' && req.user.role !== 'manager') {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }

      const shiftId = parseInt(req.params.id);
      
      if (isNaN(shiftId)) {
        return res.status(400).json({ success: false, message: 'Invalid shift ID' });
      }
      
      const { shifts } = await import('@shared/schema');
      await req.tenantDb!.delete(shifts).where(req.tenantDb!.withTenantFilter(shifts, eq(shifts.id, shiftId)));

      return res.json({ success: true });
    } catch (error) {
      console.error('[ADMIN SHIFTS] Error deleting shift:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  });

  // GET /api/admin/shift-templates - Get all shift templates
  app.get('/api/admin/shift-templates', requireAuth, async (req: Request, res: Response) => {
    try {
      const { shiftTemplates } = await import('@shared/schema');
      const templates = await req.tenantDb!.query.shiftTemplates.findMany({
        where: req.tenantDb!.withTenantFilter(shiftTemplates, eq(shiftTemplates.isActive, true)),
        orderBy: [asc(shiftTemplates.name)],
      });

      return res.json({ success: true, templates });
    } catch (error) {
      console.error('[ADMIN SHIFTS] Error fetching shift templates:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  });

  // GET /api/technicians - Get all active technicians
  app.get('/api/technicians', requireAuth, async (req: Request, res: Response) => {
    try {
      const { technicians } = await import('@shared/schema');
      const techList = await req.tenantDb!.query.technicians.findMany({
        where: req.tenantDb!.withTenantFilter(technicians, eq(technicians.employmentStatus, 'active')),
        orderBy: [asc(technicians.preferredName)],
      });

      return res.json({ success: true, technicians: techList });
    } catch (error) {
      console.error('[TECHNICIANS] Error fetching technicians:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  });
  
  // Register calendar availability routes
  app.use('/api/calendar', calendarAvailabilityRoutes);
  app.use('/api/calendar', calendarAvailabilityShareRoutes);
  
  // Register availability templates routes (admin CRUD for templates)
  app.use('/api/availability-templates', availabilityTemplatesRoutes);
  
  // Register quote requests routes
  app.use('/api/quote-requests', quoteRequestsRoutes);
  
  // Register quote approval routes (public, no auth required)
  app.use('/api/quote-approval', quoteApprovalRoutes);
  
  // Register voice testing routes (admin-only, for production readiness)
  const voiceTestingRoutes = await import('./routes.voiceTesting');
  app.use('/api/voice-testing', voiceTestingRoutes.default);

  // ===== SHIFT TRADING AND OPEN SHIFTS (S5 + S6) =====

  // GET /api/tech/shift-trades - View own shift trade requests
  app.get('/api/tech/shift-trades', requireAuth, async (req: Request, res: Response) => {
    try {
      const { technicians, shiftTrades } = await import('@shared/schema');
      const technician = await req.tenantDb!.query.technicians.findFirst({
        where: req.tenantDb!.withTenantFilter(technicians, eq(technicians.userId, req.user.id)),
      });

      if (!technician) {
        return res.status(404).json({ success: false, message: 'Technician profile not found' });
      }

      const trades = await req.tenantDb!.query.shiftTrades.findMany({
        where: req.tenantDb!.withTenantFilter(shiftTrades, or(
          eq(shiftTrades.offeringTechId, technician.id),
          eq(shiftTrades.requestingTechId, technician.id)
        )),
        with: {
          offeringTech: true,
          requestingTech: true,
          originalShift: {
            with: {
              template: true,
            },
          },
        },
        orderBy: [desc(shiftTrades.requestedAt)],
      });

      return res.json({ success: true, trades });
    } catch (error) {
      console.error('[TECH SHIFT TRADES] Error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });

  // POST /api/tech/shift-trade - Request shift trade/giveaway
  app.post('/api/tech/shift-trade', requireAuth, async (req: Request, res: Response) => {
    try {
      const { technicians, shiftTrades, shifts } = await import('@shared/schema');
      const technician = await req.tenantDb!.query.technicians.findFirst({
        where: req.tenantDb!.withTenantFilter(technicians, eq(technicians.userId, req.user.id)),
      });

      if (!technician) {
        return res.status(404).json({ success: false, message: 'Technician profile not found' });
      }

      const schema = z.object({
        shiftId: z.coerce.number().int().positive(),
        requestType: z.enum(['trade', 'giveaway']),
        targetTechnicianId: z.coerce.number().int().positive().optional(),
        reason: z.string().optional(),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, message: 'Invalid input', errors: parsed.error.issues });
      }

      const [trade] = await req.tenantDb!.insert(shiftTrades).values({
        offeringTechId: technician.id,
        requestingTechId: parsed.data.targetTechnicianId || null,
        originalShiftId: parsed.data.shiftId,
        tradeType: parsed.data.requestType,
        message: parsed.data.reason,
        status: 'pending',
      }).returning();

      return res.json({ success: true, trade });
    } catch (error) {
      console.error('[SHIFT TRADE] Error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });

  // GET /api/tech/open-shifts - Get all open/unassigned shifts
  app.get('/api/tech/open-shifts', requireAuth, async (req: Request, res: Response) => {
    try {
      const { shifts } = await import('@shared/schema');
      
      const openShifts = await req.tenantDb!.query.shifts.findMany({
        where: req.tenantDb!.withTenantFilter(shifts, and(
          isNull(shifts.technicianId),
          gte(shifts.shiftDate, new Date())
        )),
        with: {
          template: true,
        },
        orderBy: [asc(shifts.shiftDate)],
      });

      return res.json({ success: true, shifts: openShifts });
    } catch (error) {
      console.error('[OPEN SHIFTS] Error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });

  // POST /api/tech/claim-shift/:shiftId - Claim an open shift
  app.post('/api/tech/claim-shift/:shiftId', requireAuth, async (req: Request, res: Response) => {
    try {
      const { technicians, shifts } = await import('@shared/schema');
      const technician = await req.tenantDb!.query.technicians.findFirst({
        where: req.tenantDb!.withTenantFilter(technicians, eq(technicians.userId, req.user.id)),
      });

      if (!technician) {
        return res.status(404).json({ success: false, message: 'Technician profile not found. Please complete your profile first.' });
      }

      const shiftId = parseInt(req.params.shiftId);

      // Update shift to assign to technician
      const [updated] = await req.tenantDb!.update(shifts)
        .set({
          technicianId: technician.id,
          status: 'scheduled',
        })
        .where(req.tenantDb!.withTenantFilter(shifts, and(
          eq(shifts.id, shiftId),
          isNull(shifts.technicianId) // Ensure still open
        )))
        .returning();

      if (!updated) {
        return res.status(400).json({ success: false, message: 'Shift no longer available' });
      }

      return res.json({ success: true, shift: updated });
    } catch (error) {
      console.error('[CLAIM SHIFT] Error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });

  // GET /api/admin/shift-trades - View all shift trade requests
  app.get('/api/admin/shift-trades', requireAuth, async (req: Request, res: Response) => {
    if (req.user.role !== 'owner' && req.user.role !== 'manager') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    try {
      const { shiftTrades } = await import('@shared/schema');
      const trades = await req.tenantDb!.query.shiftTrades.findMany({
        with: {
          offeringTech: true,
          requestingTech: true,
          originalShift: {
            with: {
              template: true,
            },
          },
        },
        orderBy: [desc(shiftTrades.requestedAt)],
      });

      return res.json({ success: true, trades });
    } catch (error) {
      console.error('[SHIFT TRADES] Error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });

  // PUT /api/admin/shift-trades/:id - Approve/deny shift trade
  app.put('/api/admin/shift-trades/:id', requireAuth, async (req: Request, res: Response) => {
    if (req.user.role !== 'owner' && req.user.role !== 'manager') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    try {
      const tradeId = parseInt(req.params.id);
      const { status, reviewNotes } = req.body;

      const updateSchema = z.object({
        status: z.enum(['approved', 'denied']),
        reviewNotes: z.string().optional(),
      });

      const parsed = updateSchema.safeParse({ status, reviewNotes });
      if (!parsed.success) {
        return res.status(400).json({ success: false, message: 'Invalid input' });
      }

      const { shiftTrades, shifts, technicians } = await import('@shared/schema');
      
      // Update trade status
      const [updated] = await req.tenantDb!.update(shiftTrades)
        .set({
          status: parsed.data.status,
          reviewNotes: parsed.data.reviewNotes,
          reviewedBy: req.user.id,
          reviewedAt: new Date(),
        })
        .where(req.tenantDb!.withTenantFilter(shiftTrades, eq(shiftTrades.id, tradeId)))
        .returning();

      // If approved, update the shift assignment
      if (parsed.data.status === 'approved' && updated.requestingTechId) {
        // Verify target technician exists and is active
        const targetTech = await req.tenantDb!.query.technicians.findFirst({
          where: req.tenantDb!.withTenantFilter(technicians, and(
            eq(technicians.id, updated.requestingTechId),
            eq(technicians.employmentStatus, 'active')
          )),
        });

        if (!targetTech) {
          return res.status(400).json({
            success: false,
            message: 'Target technician not found or inactive. Cannot complete trade.',
          });
        }

        // Now safe to reassign shift
        console.log(`[SHIFT TRADES] Reassigning shift ${updated.originalShiftId} to technician ${updated.requestingTechId}`);
        await req.tenantDb!.update(shifts)
          .set({ technicianId: updated.requestingTechId })
          .where(req.tenantDb!.withTenantFilter(shifts, eq(shifts.id, updated.originalShiftId)));
      }

      return res.json({ success: true, trade: updated });
    } catch (error) {
      console.error('[SHIFT TRADES] Error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });

  // ============================================================
  // PROMO CODE MANAGEMENT (Platform Admin Only)
  // ============================================================

  // GET /api/admin/promos - List all promo codes
  app.get('/api/admin/promos', requireAuth, requireRole('owner'), async (req: Request, res: Response) => {
    try {
      const { getAllPromoCodes } = await import('./services/promoCodeService');
      const promos = await getAllPromoCodes();
      return res.json({ success: true, promos });
    } catch (error) {
      console.error('[ADMIN PROMOS] Error listing promos:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });

  // GET /api/admin/promos/:id - Get promo code details
  app.get('/api/admin/promos/:id', requireAuth, requireRole('owner'), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ success: false, message: 'Invalid promo ID' });
      }
      
      const { getPromoCodeById } = await import('./services/promoCodeService');
      const promo = await getPromoCodeById(id);
      
      if (!promo) {
        return res.status(404).json({ success: false, message: 'Promo code not found' });
      }
      
      return res.json({ success: true, promo });
    } catch (error) {
      console.error('[ADMIN PROMOS] Error getting promo:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });

  // POST /api/admin/promos - Create new promo code
  app.post('/api/admin/promos', requireAuth, requireRole('owner'), async (req: Request, res: Response) => {
    try {
      const createPromoSchema = z.object({
        code: z.string().min(3).max(50),
        label: z.string().min(1).max(255),
        description: z.string().optional(),
        isActive: z.boolean().optional().default(true),
        appliesToPlan: z.string().nullable().optional(),
        subscriptionDiscountPercent: z.number().min(0).max(100).optional().default(0),
        usageRateMultiplier: z.number().min(0).max(10).nullable().optional(),
        trialExtensionDays: z.number().min(0).max(365).optional().default(0),
        setOverrideType: z.enum(['friends_and_family', 'partner', 'internal_test', 'beta_user']).nullable().optional(),
        isReusable: z.boolean().optional().default(false),
        maxRedemptions: z.number().min(1).nullable().optional(),
        perTenantLimit: z.number().min(1).optional().default(1),
        lockedToEmail: z.string().email().nullable().optional(),
        startsAt: z.string().nullable().optional(),
        expiresAt: z.string().nullable().optional(),
      });

      const parsed = createPromoSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, message: 'Invalid input', errors: parsed.error.errors });
      }

      const { createPromoCode, getPromoCodeByCode } = await import('./services/promoCodeService');
      
      const existing = await getPromoCodeByCode(parsed.data.code);
      if (existing) {
        return res.status(400).json({ success: false, message: 'Promo code already exists' });
      }

      const promo = await createPromoCode({
        ...parsed.data,
        startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : null,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
        createdByAdminId: req.user.id,
      });

      return res.json({ success: true, promo });
    } catch (error) {
      console.error('[ADMIN PROMOS] Error creating promo:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });

  // PUT /api/admin/promos/:id - Update promo code
  app.put('/api/admin/promos/:id', requireAuth, requireRole('owner'), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ success: false, message: 'Invalid promo ID' });
      }

      const updatePromoSchema = z.object({
        code: z.string().min(3).max(50).optional(),
        label: z.string().min(1).max(255).optional(),
        description: z.string().nullable().optional(),
        isActive: z.boolean().optional(),
        appliesToPlan: z.string().nullable().optional(),
        subscriptionDiscountPercent: z.number().min(0).max(100).optional(),
        usageRateMultiplier: z.number().min(0).max(10).nullable().optional(),
        trialExtensionDays: z.number().min(0).max(365).optional(),
        setOverrideType: z.enum(['friends_and_family', 'partner', 'internal_test', 'beta_user']).nullable().optional(),
        isReusable: z.boolean().optional(),
        maxRedemptions: z.number().min(1).nullable().optional(),
        perTenantLimit: z.number().min(1).optional(),
        lockedToEmail: z.string().email().nullable().optional(),
        startsAt: z.string().nullable().optional(),
        expiresAt: z.string().nullable().optional(),
      });

      const parsed = updatePromoSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, message: 'Invalid input', errors: parsed.error.errors });
      }

      const { updatePromoCode, getPromoCodeById, getPromoCodeByCode } = await import('./services/promoCodeService');
      
      const existing = await getPromoCodeById(id);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Promo code not found' });
      }

      if (parsed.data.code && parsed.data.code !== existing.code) {
        const codeExists = await getPromoCodeByCode(parsed.data.code);
        if (codeExists) {
          return res.status(400).json({ success: false, message: 'Promo code already exists' });
        }
      }

      const updates = {
        ...parsed.data,
        startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : (parsed.data.startsAt === null ? null : undefined),
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : (parsed.data.expiresAt === null ? null : undefined),
      };

      const promo = await updatePromoCode(id, updates);
      return res.json({ success: true, promo });
    } catch (error) {
      console.error('[ADMIN PROMOS] Error updating promo:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });

  // DELETE /api/admin/promos/:id - Delete promo code
  app.delete('/api/admin/promos/:id', requireAuth, requireRole('owner'), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ success: false, message: 'Invalid promo ID' });
      }

      const { deletePromoCode, getPromoCodeById } = await import('./services/promoCodeService');
      
      const existing = await getPromoCodeById(id);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Promo code not found' });
      }

      await deletePromoCode(id);
      return res.json({ success: true, message: 'Promo code deleted' });
    } catch (error) {
      console.error('[ADMIN PROMOS] Error deleting promo:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });

  // ============================================================
  // PUBLIC PROMO CODE ENDPOINTS
  // ============================================================

  // POST /api/public/promos/apply - Validate and apply a promo code
  app.post('/api/public/promos/apply', async (req: Request, res: Response) => {
    try {
      const applyPromoSchema = z.object({
        code: z.string().min(1).max(50),
        email: z.string().email(),
        planTier: z.string(),
        currentTenantId: z.string().optional(),
      });

      const parsed = applyPromoSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ 
          ok: false, 
          errorCode: 'INVALID_INPUT',
          errorMessage: 'Invalid input',
        });
      }

      const { validatePromoForRequest, applyPromoToTenant } = await import('./services/promoCodeService');
      
      const validationResult = await validatePromoForRequest(parsed.data);
      
      if (!validationResult.valid) {
        return res.status(400).json({
          ok: false,
          errorCode: validationResult.errorCode,
          errorMessage: validationResult.errorMessage,
        });
      }

      if (parsed.data.currentTenantId && validationResult.promo) {
        const context = {
          source: 'public_apply_endpoint',
          path: req.path,
          userAgent: req.headers['user-agent'],
          ipAddress: req.ip,
        };
        
        const result = await applyPromoToTenant(
          parsed.data.currentTenantId, 
          validationResult.promo,
          parsed.data.email,
          context
        );
        
        return res.json(result);
      }

      return res.json({
        ok: true,
        applied: {
          promoId: validationResult.promo!.id,
          promoCode: validationResult.promo!.code,
          subscriptionDiscountPercent: validationResult.promo!.subscriptionDiscountPercent,
          usageRateMultiplier: validationResult.promo!.usageRateMultiplier ? parseFloat(validationResult.promo!.usageRateMultiplier) : null,
          trialExtensionDays: validationResult.promo!.trialExtensionDays,
          setOverrideType: validationResult.promo!.setOverrideType,
        },
      });
    } catch (error) {
      console.error('[PUBLIC PROMO APPLY] Error:', error);
      return res.status(500).json({ 
        ok: false, 
        errorCode: 'SERVER_ERROR',
        errorMessage: 'Internal server error',
      });
    }
  });

  // GET /api/public/promos/check/:code - Check if a promo code is valid (without applying)
  app.get('/api/public/promos/check/:code', async (req: Request, res: Response) => {
    try {
      const code = req.params.code;
      const email = req.query.email as string | undefined;
      const planTier = req.query.planTier as string || 'starter';

      if (!code) {
        return res.status(400).json({ valid: false, message: 'Code is required' });
      }

      const { validatePromoForRequest } = await import('./services/promoCodeService');
      
      const result = await validatePromoForRequest({
        code,
        email: email || 'check@example.com',
        planTier,
      });

      if (!result.valid) {
        return res.json({ 
          valid: false, 
          errorCode: result.errorCode,
          message: result.errorMessage,
        });
      }

      return res.json({
        valid: true,
        promo: {
          code: result.promo!.code,
          label: result.promo!.label,
          subscriptionDiscountPercent: result.promo!.subscriptionDiscountPercent,
          trialExtensionDays: result.promo!.trialExtensionDays,
        },
      });
    } catch (error) {
      console.error('[PUBLIC PROMO CHECK] Error:', error);
      return res.status(500).json({ valid: false, message: 'Internal server error' });
    }
  });

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