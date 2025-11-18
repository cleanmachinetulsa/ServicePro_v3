import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { sessionMiddleware } from './sessionMiddleware';
import { demoProtectionMiddleware } from "./demoProtection";
import { checkMaintenanceMode } from "./maintenanceMode";
import loyaltyRouter from "./loyaltyApi";
import techProfilesRouter from "./routes.techProfiles";
import aiBioCoachRouter from "./routes.aiBioCoach";
import adminEmployeesRouter from "./routes.adminEmployees";
import jobApplicationsRouter from "./routes.jobApplications";
import payerApprovalRouter from "./routes.payerApproval";
import { registerContactsRoutes } from "./routes.contacts";
import stripeWebhooksRouter from "./routes.stripeWebhooks";
import pushNotificationsRouter from "./routes.pushNotifications";
import { registerCallRoutes } from "./routes.calls";
import { registerBackupBookingRoutes } from "./routes.backupBookings";
import { registerBannerRoutes } from "./routes.banners";
import phoneSettingsRouter from "./routes.phoneSettings";
import sendgridWebhookRouter from "./routes.sendgridWebhook";
import campaignsRouter from "./routes.campaigns";
import smsTemplatesRouter from "./routes.smsTemplates";
import { registerReferralInvoiceRoutes } from "./routes.referralInvoice";
import { setupGoogleOAuth } from "./googleOAuth";
import path from "path";
import { runStartupHealthChecks } from "./healthChecks";
import { db } from './db';
import { businessSettings } from '@shared/schema';
import { eq } from 'drizzle-orm';

const app = express();

// CRITICAL: Trust proxy headers (required for Replit deployment)
// Configure to trust only the first hop (Replit's reverse proxy)
// This prevents IP spoofing while allowing proper client IP identification
// For Replit: Trust 1 hop (Replit's proxy adds X-Forwarded-For)
app.set('trust proxy', 1);

// SECURITY: Helmet middleware for security headers
// Disable all cross-origin policies for Replit preview compatibility
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false,
  frameguard: false,
}));

// SECURITY: Global rate limiting (300 requests per IP per minute)
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300, // Max 300 requests per window per IP
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  message: 'Too many requests from this IP, please try again later.',
  skip: (req) => {
    // Skip rate limiting for webhooks (they have their own verification)
    return req.path.startsWith('/api/webhooks') || 
           req.path.startsWith('/api/voice') || 
           req.path.startsWith('/api/twilio');
  },
});
app.use(limiter);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Serve uploaded files from public directory
app.use('/uploads', express.static(path.join(process.cwd(), 'public', 'uploads')));
// Serve technician profile photos
app.use('/tech_profiles', express.static(path.join(process.cwd(), 'public', 'tech_profiles')));
// Serve service worker for PWA (must be served from root)
app.get('/service-worker.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Service-Worker-Allowed', '/');
  res.sendFile(path.join(process.cwd(), 'public', 'service-worker.js'));
});

// Cache-busting middleware - prevent users from seeing stale code after deployments
app.use((req, res, next) => {
  const url = req.url;
  
  // HTML files: Never cache (always get latest version)
  if (url.endsWith('.html') || url === '/' || !url.includes('.')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  // Hashed assets (e.g., main-abc123.js from Vite build): Cache forever
  else if (/\.(js|css)$/.test(url) && /[a-f0-9]{8,}/.test(url)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }
  // Other static assets: Cache for 1 hour
  else if (/\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/.test(url)) {
    res.setHeader('Cache-Control', 'public, max-age=3600');
  }
  
  next();
});

// SECURITY: Strict CORS with explicit origin whitelist
// Environment-based origin configuration for production security
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : [
      'https://cleanmachinetulsa.com',
      'http://cleanmachinetulsa.com',
      'https://www.cleanmachinetulsa.com',
      'http://www.cleanmachinetulsa.com',
      'https://cleanmachineintulsa.com',
      'http://cleanmachineintulsa.com',
      'https://www.cleanmachineintulsa.com',
      'http://www.cleanmachineintulsa.com',
      'https://clean-machine-auto-detail.replit.app',
      'https://*.replit.dev',
      'http://*.replit.dev',
      ...(process.env.NODE_ENV === 'development' ? [
        'http://localhost:5000',
        'http://localhost:5173',
        'http://127.0.0.1:5000',
        'http://127.0.0.1:5173'
      ] : []),
    ];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // Check if origin is in whitelist
    const isAllowed = allowedOrigins.some(allowed => {
      if (allowed.includes('*')) {
        // Handle wildcard domains like *.replit.dev
        const pattern = new RegExp('^' + allowed.replace(/\*/g, '.*') + '$');
        return pattern.test(origin);
      }
      return allowed === origin;
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn(`[SECURITY] Blocked request from unauthorized origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // Allow cookies
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"],
  exposedHeaders: ["RateLimit-Limit", "RateLimit-Remaining", "RateLimit-Reset"],
}));

// Use shared session middleware (also used by Socket.IO)
app.use(sessionMiddleware);

// Setup Google OAuth (must be after session middleware)
setupGoogleOAuth(app);

// Apply demo protection middleware
app.use(demoProtectionMiddleware);

// Apply maintenance mode middleware (must be after session, before routes)
app.use(checkMaintenanceMode);

// Register loyalty API routes
app.use('/api/invoice', loyaltyRouter);
// Register technician profiles routes
app.use(techProfilesRouter);
// Register AI Bio Coach routes
app.use(aiBioCoachRouter);
// Register admin employees routes
app.use(adminEmployeesRouter);
// Register job applications routes
app.use(jobApplicationsRouter);
// Register push notification routes
app.use('/api/push', pushNotificationsRouter);
// Register payer approval routes (public, no auth)
app.use(payerApprovalRouter);
// Register backup booking routes (exempt from maintenance middleware)
registerBackupBookingRoutes(app);
// Register banner management routes
registerBannerRoutes(app);
// Register Stripe webhook routes (public, verified via signature)
app.use(stripeWebhooksRouter);
// Register SendGrid webhook routes (public, verified via signature)
app.use(sendgridWebhookRouter);
// Register campaign management routes (requires auth)
app.use('/api/campaigns', campaignsRouter);
// Register SMS templates routes (requires auth)
app.use('/api/sms-templates', smsTemplatesRouter);
// Register referral invoice routes (validation public, apply requires auth)
registerReferralInvoiceRoutes(app);

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Initialize push notifications table
  const { initializePushNotificationsTable } = await import('./initPushNotifications');
  await initializePushNotificationsTable();
  
  // Seed phone lines and business hours (idempotent - only runs once)
  const { seedPhoneLines } = await import('./seedPhoneLines');
  await seedPhoneLines();
  
  // Backfill phone line IDs for existing conversations (idempotent - safe to run multiple times)
  const { backfillPhoneLineIds } = await import('./backfillPhoneLines');
  await backfillPhoneLineIds();
  
  // Initialize SMS templates (idempotent - safe to run multiple times)
  const { initializeSmsTemplates } = await import('./initSmsTemplates');
  await initializeSmsTemplates();
  
  // Initialize referral program configuration (singleton - only runs once)
  const { initializeReferralConfig } = await import('./referralConfigService');
  await initializeReferralConfig();
  
  // Migrate SMS fallback settings - auto-disable if enabled without phone (safety migration)
  async function migrateSmsFallbackSettings() {
    try {
      // Find settings with enabled=true but phone=null (broken state)
      const [settings] = await db.select().from(businessSettings).limit(1);
      
      if (settings && settings.smsFallbackEnabled && (!settings.smsFallbackPhone || settings.smsFallbackPhone.trim() === '')) {
        console.warn('[STARTUP MIGRATION] Detected SMS fallback enabled without phone - AUTO-DISABLING for safety');
        
        await db.update(businessSettings)
          .set({ smsFallbackEnabled: false })
          .where(eq(businessSettings.id, settings.id));
        
        console.log('[STARTUP MIGRATION] SMS fallback auto-disabled - system cleaned up');
      } else {
        console.log('[STARTUP MIGRATION] SMS fallback settings are valid or fallback already disabled');
      }
    } catch (error) {
      console.error('[STARTUP MIGRATION] Error checking SMS fallback settings:', error);
      throw error;
    }
  }
  
  // Run SMS fallback migration on startup
  await migrateSmsFallbackSettings();
  
  const server = await registerRoutes(app);
  
  // Register contacts routes
  registerContactsRoutes(app);
  
  // Register call routes (voice/phone functionality)
  registerCallRoutes(app);
  
  // Register phone settings routes (phone line configuration)
  app.use('/api/phone-settings', phoneSettingsRouter);

  // Run startup health checks for external services
  await runStartupHealthChecks();

  // Start timeout monitoring for manual mode conversations
  const { startTimeoutMonitoring } = await import('./timeoutMonitorService');
  startTimeoutMonitoring();
  console.log('[SERVER] Timeout monitoring started');
  
  // Start damage assessment auto-approval monitoring
  const { startDamageAssessmentMonitoring } = await import('./damageAssessmentMonitor');
  startDamageAssessmentMonitoring();
  console.log('[SERVER] Damage assessment monitoring started');
  
  // Start recurring services scheduler and deposit reminders
  const { initializeRecurringServicesScheduler, initializeRecurringServiceReminders, initializeDepositReminders, initializeEscalationExpiry } = await import('./recurringServicesScheduler');
  initializeRecurringServicesScheduler();
  initializeRecurringServiceReminders();
  initializeDepositReminders();
  initializeEscalationExpiry();
  console.log('[SERVER] Recurring services scheduler, reminders, deposit reminders, and escalation expiry started');
  
  // Initialize proactive reminder system (Phase 4B)
  const { seedDefaultReminderRules, initializeProactiveReminderScheduler } = await import('./reminderService');
  await seedDefaultReminderRules();
  initializeProactiveReminderScheduler();
  console.log('[SERVER] Proactive reminder system initialized - scheduler running every 6 hours');
  
  // Start email campaign scheduler (hourly batch processor)
  const { initializeCampaignScheduler } = await import('./campaignScheduler');
  initializeCampaignScheduler();
  console.log('[SERVER] Email campaign scheduler started - processes campaigns hourly');
  
  // Start port monitoring (auto-disables when port completes)
  const { initializePortMonitoring } = await import('./portMonitoring');
  initializePortMonitoring();
  console.log('[SERVER] Port monitoring started - will notify when 918-856-5304 is fully ported');

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();