import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import { sessionMiddleware } from './sessionMiddleware';
import { tenantMiddleware } from './tenantMiddleware';
import { wrapTenantDb } from './tenantDb';
import { demoProtectionMiddleware } from "./demoProtection";
import { ensureTenantNotSuspended, isSuspendedRoute } from './middleware/suspensionGuard';
import { checkMaintenanceMode } from "./maintenanceMode";
import loyaltyRouter from "./loyaltyApi";
import techProfilesRouter from "./routes.techProfiles";
import aiBioCoachRouter from "./routes.aiBioCoach";
import adminEmployeesRouter from "./routes.adminEmployees";
import jobApplicationsRouter from "./routes.jobApplications";
import payerApprovalRouter from "./routes.payerApproval";
import { registerContactsRoutes } from "./routes.contacts";
import stripeWebhooksRouter from "./routes.stripeWebhooks";
import billingRouter from "./routes.billing";
import pushNotificationsRouter from "./routes.pushNotifications";
import { registerCallRoutes } from "./routes.calls";
import { registerBackupBookingRoutes } from "./routes.backupBookings";
import { registerBannerRoutes } from "./routes.banners";
import phoneSettingsRouter from "./routes.phoneSettings";
import sendgridWebhookRouter from "./routes.sendgridWebhook";
import twilioVoiceRouter from "./routes.twilioVoice";
import { twilioTestVoiceRouter } from "./routes/twilioTestVoice";
import campaignsRouter from "./routes.campaigns";
import smsTemplatesRouter from "./routes.smsTemplates";
import a2pCampaignRouter from "./routes.a2pCampaign";
import welcomeBackCampaignRouter from "./routes.welcomeBackCampaign";
import portRecoveryRouter from "./routes.portRecovery";
import { registerReferralInvoiceRoutes } from "./routes.referralInvoice";
import registerOnboardingIndustryRoutes from "./onboardingIndustryRoutes";
import { registerSuggestionRoutes } from "./routes.suggestions";
import { registerSupportRoutes } from "./routes.support";
import { registerIndustryPackRoutes } from "./routes.industryPacks";
import importHistoryRouter from "./routes.importHistory";
import importHistoryParserRouter from "./routes.importHistoryParser";
import adminUsageOverviewRouter from "./routes.adminUsageOverview";
import { setupGoogleOAuth } from "./googleOAuth";
import publicSiteRouter from "./routes.publicSite";
import publicPricingRouter from "./routes.publicPricing";
import publicSiteAdminRouter from "./routes.publicSiteAdmin";
import publicSiteThemeRouter from "./routes.publicSiteTheme";
import agentContextRouter from "./routes/agentContextRouter";
import setupAssistantRouter from "./routes/setupAssistantRouter";
import emailTestRouter from "./routes/emailTestRouter";
import tenantDomainsRouter from "./routes.tenantDomains";
import dashboardPreferencesRouter from "./routes.dashboardPreferences";
import usageLedgerRouter from "./routes.usageLedger";
import addonRouter from "./routes/addonRoutes";
import usageMeteringRouter from "./routes/usageMeteringRoutes";
import parserRoutes from "./routes/parserRoutes";
import path from "path";
import { runStartupHealthChecks } from "./healthChecks";
import { db } from './db';
import { businessSettings } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// CRITICAL: Trust proxy headers (required for Replit deployment)
// Replit uses multiple proxy layers (load balancer + Cloudflare)
// We must trust ALL proxies in the chain for secure cookies to work
// Setting to true ensures session authentication works on deployed sites
app.set('trust proxy', true);

// CM-DNS-3: HTTPS + Canonical redirect middleware
// Redirect http → https and www.cleanmachinetulsa.com → cleanmachinetulsa.com
import { CLEAN_MACHINE_ROOT, CLEAN_MACHINE_WWW } from '@shared/domainConfig';

app.use((req: Request, res: Response, next: NextFunction) => {
  const proto = req.headers['x-forwarded-proto'] as string | undefined;
  const host = req.headers.host?.toLowerCase() || '';
  
  // Skip redirects in development mode
  if (process.env.NODE_ENV === 'development') {
    return next();
  }
  
  // Check if this is a Clean Machine domain request
  const isCleanMachineDomain = host === CLEAN_MACHINE_ROOT || host === CLEAN_MACHINE_WWW;
  
  // 1. Force HTTPS for Clean Machine domain
  if (isCleanMachineDomain && proto === 'http') {
    const targetHost = host === CLEAN_MACHINE_WWW ? CLEAN_MACHINE_ROOT : host;
    const redirectUrl = `https://${targetHost}${req.originalUrl}`;
    log(`[CM-DNS-3] HTTP→HTTPS redirect: ${req.originalUrl} → ${redirectUrl}`);
    return res.redirect(301, redirectUrl);
  }
  
  // 2. Canonical www → root redirect for Clean Machine
  if (host === CLEAN_MACHINE_WWW) {
    const redirectUrl = `https://${CLEAN_MACHINE_ROOT}${req.originalUrl}`;
    log(`[CM-DNS-3] www→root redirect: ${req.originalUrl} → ${redirectUrl}`);
    return res.redirect(301, redirectUrl);
  }
  
  next();
});

// Serve uploaded media assets (MP3 voicemail greeting, PDFs, etc.)
// IMPORTANT: Use /media path to avoid conflicting with Vite's /assets build output
app.use('/media', express.static(path.join(__dirname, '../attached_assets')));

// SECURITY: Helmet middleware for security headers
// Disable all cross-origin policies for Replit preview compatibility
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false,
  frameguard: false,
}));

// SECURITY: Global rate limiting (1200 requests per IP per minute)
// Increased to 1200/min to support rapid automated testing and heavy admin usage
// Note: validate.trustProxy disabled because Replit's secure proxy chain is fully trusted
// See: https://express-rate-limit.github.io/ERR_ERL_PERMISSIVE_TRUST_PROXY/
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 1200, // Max 1200 requests per window per IP (20/sec)
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  validate: { trustProxy: false }, // Replit's proxy infrastructure is trusted - validation not needed
  message: {
    error: 'Too many requests',
    message: 'Rate limit exceeded. Please wait a moment and try again.',
    retryAfter: 60
  },
  skip: (req) => {
    // Skip rate limiting for webhooks (they have their own verification)
    return req.path.startsWith('/api/webhooks') || 
           req.path.startsWith('/api/voice') || 
           req.path.startsWith('/api/twilio');
  },
  handler: (req, res) => {
    log(`Rate limit exceeded for IP: ${req.ip} on path: ${req.path}`);
    res.status(429).json({
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please wait a moment and try again.',
      retryAfter: 60
    });
  }
});
app.use(limiter);

// Cookie parser middleware (required for reading custom cookies like customer session)
app.use(cookieParser());

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

// Serve manifest.json for PWA (must be served from root with correct MIME type)
app.get('/manifest.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.sendFile(path.join(process.cwd(), 'public', 'manifest.json'));
});

// Cache-busting middleware - prevent users from seeing stale code after deployments
app.use((req, res, next) => {
  const url = req.url;
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // DEVELOPMENT MODE: Aggressive no-cache for everything except static assets
  if (isDevelopment) {
    // API endpoints: Never cache in development
    if (url.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');
    }
    // HTML files and routes: Never cache in development
    else if (url.endsWith('.html') || url === '/' || !url.includes('.')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');
    }
    // JS/CSS files: Never cache in development (even hashed ones)
    else if (/\.(js|css)$/.test(url)) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    // Static assets: Short cache in development
    else if (/\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/.test(url)) {
      res.setHeader('Cache-Control', 'public, max-age=60');
    }
  }
  // PRODUCTION MODE: Smart caching based on resource type
  else {
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
  }
  
  next();
});

// SECURITY: Strict CORS with explicit origin whitelist
// NOTE: include both .repl.co (dev) and .replit.app (prod) origins so our own frontend is not blocked by CORS.
const allowedOrigins = [
  "https://servicepro-v-3-base-cleanmachinetul.repl.co",
  "https://servicepro-v-3-base-cleanmachinetul.replit.app",
  "https://cleanmachinetulsa.com",
  "https://www.cleanmachinetulsa.com",
  "https://cleanmachineintulsa.com",
  "https://www.cleanmachineintulsa.com",
  "https://clean-machine-auto-detail.replit.app",
  "http://localhost:3000",
  "http://localhost:5000",
  "http://localhost:5173",
  "http://localhost:4173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:4173",
];

function isAllowedOrigin(origin?: string | null): boolean {
  if (!origin) return true; // same-origin / curl / server calls

  try {
    const url = new URL(origin);
    const host = url.hostname;
    const port = url.port;
    const normalized = port ? `${url.protocol}//${host}:${port}` : `${url.protocol}//${host}`;

    // Exact matches first
    if (allowedOrigins.includes(normalized)) {
      return true;
    }

    // Also allow any repl.co / replit.app / replit.dev for this project as a fallback
    if (
      host.endsWith(".repl.co") ||
      host.endsWith(".replit.app") ||
      host.endsWith(".replit.dev")
    ) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

const corsOptions = {
  origin(origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }

    console.error("[SECURITY] Blocked request from unauthorized origin:", origin);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"],
  exposedHeaders: ["RateLimit-Limit", "RateLimit-Remaining", "RateLimit-Reset"],
};

// IMPORTANT: use CORS only for API-style routes, not static assets
app.use((req, res, next) => {
  const reqPath = req.path || "";

  // Let static assets / manifest / icons through with no CORS blocking
  if (
    reqPath.startsWith("/assets/") ||
    reqPath === "/manifest.json" ||
    reqPath === "/favicon.ico" ||
    reqPath.startsWith("/icon-") ||
    reqPath.startsWith("/media/")
  ) {
    return next();
  }

  // For everything else, run the normal CORS check
  return cors(corsOptions)(req, res, next);
});

// Use shared session middleware (also used by Socket.IO)
app.use(sessionMiddleware);

// Setup Google OAuth (must be after session middleware)
setupGoogleOAuth(app);

// Apply tenant middleware (must be after session, before routes)
app.use(tenantMiddleware);

// SP-6: Apply suspension guard middleware for non-exempt routes
app.use((req, res, next) => {
  if (isSuspendedRoute(req.path)) {
    return ensureTenantNotSuspended(req, res, next);
  }
  next();
});

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
// Register public site routes (Phase 9 - Website Generator)
app.use('/api/public', publicSiteRouter);
// Register public pricing routes (Phase 7B - Pricing & Tier Comparison)
app.use('/api/public', publicPricingRouter);
// Register public site admin routes (CM-4 - Public Site Entry Points)
app.use('/api/admin', publicSiteAdminRouter);
// Register public site theme routes (SP-24 - Themes + Template Library)
app.use('/api/admin', publicSiteThemeRouter);
// Register billing routes (Phase 7C - Stripe Billing & Subscriptions, requires tenant auth)
app.use(billingRouter);
// Register campaign management routes (requires auth)
app.use('/api/campaigns', campaignsRouter);
// Register Welcome Back Campaign routes (tenant admin, requires 'campaigns' feature)
app.use('/api/admin/campaigns', welcomeBackCampaignRouter);
// Register SMS templates routes (requires auth)
app.use('/api/sms-templates', smsTemplatesRouter);
// Register A2P Campaign Assistant routes (Phase - A2P 10DLC Registration)
app.use('/api/a2p', a2pCampaignRouter);
// Register Port Recovery Campaign routes (one-time recovery blast)
app.use('/api/port-recovery', portRecoveryRouter);
// Register agent context routes (Phase 10 - AI Setup & Support Agent)
app.use('/api/agent', agentContextRouter);
// Register setup assistant routes (Phase 12 - Setup & Support Copilot)
app.use('/api/ai', setupAssistantRouter);
// Register email test routes (Phase 11 - Email v1 SendGrid Plumbing)
app.use('/api/email', emailTestRouter);
// Register referral invoice routes (validation public, apply requires auth)
registerReferralInvoiceRoutes(app);
// Register industry onboarding routes (Phase 8B)
registerOnboardingIndustryRoutes(app);
// Register suggestion system routes (platform + customer suggestions)
registerSuggestionRoutes(app);
// Register support system routes (tickets, KB, AI context)
registerSupportRoutes(app);
// Register industry pack routes (Phase 5.2 - Industry Pack Editor + Clone-a-Tenant Factory)
registerIndustryPackRoutes(app);
// Register phone history import routes (INT-3 - Phone History Import Engine)
app.use('/api/admin/import-history', importHistoryRouter);
// Register parser tool hook (INT-5 - Parser Tool Hook Phase 1)
app.use('/api/import-history', importHistoryParserRouter);
// Register SP-18 Parser Integration routes (upload + apply knowledge)
app.use('/api/onboarding/parser', parserRoutes);
// Register root admin usage overview (SP-11 - Usage & Billing Foundation)
app.use(adminUsageOverviewRouter);

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
  
  // Backfill legacy phone lines with tenant_id (idempotent - safe to run multiple times)
  const { backfillPhoneLines } = await import('./backfillPhoneLines');
  await backfillPhoneLines();
  
  // Phase 2.2: Seed tenant phone configuration for multi-tenant telephony
  const { seedTenantPhone } = await import('./seed/seedTenantPhone');
  await seedTenantPhone(db);
  
  // Phase 3: Seed IVR menus for all tenants (idempotent - only seeds if missing)
  const { seedIvrMenus } = await import('./seed/seedIvrMenus');
  await seedIvrMenus(db);
  
  // Initialize SMS templates (idempotent - safe to run multiple times)
  const { initializeSmsTemplates } = await import('./initSmsTemplates');
  await initializeSmsTemplates();
  
  // Initialize referral program configuration (singleton - only runs once)
  const { initializeReferralConfig } = await import('./referralConfigService');
  const tenantDbForStartup = wrapTenantDb(db, 'root');
  await initializeReferralConfig(tenantDbForStartup);
  
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

  // SP-DOMAINS-1: Register tenant domain management routes
  app.use('/api/settings/domains', tenantDomainsRouter);
  console.log('[TENANT DOMAINS] Routes registered: /api/settings/domains');

  // SP-15: Register dashboard preferences routes
  app.use('/api/settings/dashboard/preferences', dashboardPreferencesRouter);
  console.log('[DASHBOARD PREFS] Routes registered: /api/settings/dashboard/preferences');

  // CM-Billing-Prep: Register usage ledger routes
  app.use('/api/billing/usage', usageLedgerRouter);
  console.log('[USAGE LEDGER] Routes registered: /api/billing/usage');

  // SP-18: Register usage metering v2 routes
  app.use('/api/billing/usage/v2', usageMeteringRouter);
  app.use('/api/admin/usage/v2', usageMeteringRouter);
  console.log('[USAGE METERING V2] Routes registered: /api/billing/usage/v2, /api/admin/usage/v2');

  // SP-16: Register add-on management routes
  app.use('/api/billing/addons', addonRouter);
  console.log('[ADDONS] Routes registered: /api/billing/addons');

  // Register Twilio Voice webhook (handles incoming calls to business number)
  app.use('/twilio', twilioVoiceRouter);

  // Register Twilio TEST Voice webhook (handles IVR for test number)
  app.use('/api/twilio/voice', twilioTestVoiceRouter);

  // Run startup health checks for external services
  await runStartupHealthChecks();
  
  // Log phone configuration status
  const { logPhoneConfigStatus } = await import('./config/phoneConfig');
  logPhoneConfigStatus();
  
  // Log SMS Agent model configuration
  const { SMS_AGENT_MODEL } = await import('./openai');
  console.log(`[AI] SMS agent model: ${SMS_AGENT_MODEL}`);
  
  // Log Twilio Test routing status
  const { TWILIO_TEST_SMS_NUMBER, isTwilioConfigured } = await import('./twilioClient');
  if (isTwilioConfigured()) {
    console.log(`[TWILIO TEST] Test SMS/Voice routing enabled - Number: ${TWILIO_TEST_SMS_NUMBER || 'not set'}`);
    console.log('[TWILIO TEST] Webhook URLs: /api/twilio/sms/inbound, /api/twilio/voice/inbound');
  } else {
    console.log('[TWILIO TEST] TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN not configured - test routes disabled');
  }

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
  await seedDefaultReminderRules(tenantDbForStartup);
  initializeProactiveReminderScheduler();
  console.log('[SERVER] Proactive reminder system initialized - scheduler running every 6 hours');
  
  // Start email campaign scheduler (hourly batch processor)
  const { initializeCampaignScheduler } = await import('./campaignScheduler');
  initializeCampaignScheduler();
  console.log('[SERVER] Email campaign scheduler started - processes campaigns hourly');
  
  // Start usage rollup scheduler (daily at midnight UTC)
  const { initializeUsageRollupScheduler } = await import('./services/usageRollupService');
  initializeUsageRollupScheduler();
  console.log('[SERVER] Usage rollup scheduler started - aggregates daily usage at midnight UTC');

  // Phase 2.3: Start monthly invoice generator (1st of each month at 6:00 AM UTC)
  const { initializeInvoiceGeneratorScheduler } = await import('./services/invoiceGeneratorService');
  initializeInvoiceGeneratorScheduler();
  console.log('[SERVER] Invoice generator scheduler started - runs on 1st of each month');

  // Phase 2.3: Start nightly dunning process (2:00 AM UTC daily)
  const { initializeNightlyDunningScheduler } = await import('./services/nightlyDunningService');
  initializeNightlyDunningScheduler();
  console.log('[SERVER] Nightly dunning scheduler started - runs at 2:00 AM UTC daily');

  // SP-9: Start trial telephony sandbox daily reset (midnight UTC)
  const { initializeTrialTelephonyScheduler } = await import('./services/trialTelephonyService');
  initializeTrialTelephonyScheduler();
  console.log('[SERVER] Trial telephony scheduler started - resets daily message counts at midnight UTC');
  
  // Start port monitoring (auto-disables when port completes)
  const { initializePortMonitoring } = await import('./portMonitoring');
  initializePortMonitoring();
  console.log('[SERVER] Port monitoring started - will notify when 918-856-5304 is fully ported');
  
  // Start unanswered message monitoring (checks every 5 minutes)
  const { unansweredMonitor } = await import('./unansweredMessageMonitor');
  setInterval(() => {
    unansweredMonitor.checkAndAlert().catch(err => 
      console.error('[SERVER] Unanswered monitor error:', err)
    );
  }, 5 * 60 * 1000); // 5 minutes
  // Run initial check after 1 minute
  setTimeout(() => {
    unansweredMonitor.checkAndAlert().catch(err => 
      console.error('[SERVER] Unanswered monitor initial check error:', err)
    );
  }, 60 * 1000);
  console.log('[SERVER] Unanswered message monitoring started - checks every 5 minutes for web chat messages without AI responses');

  // Start system health monitoring (checks every 5 minutes)
  const { startHealthMonitoring } = await import('./services/systemHealthMonitor');
  startHealthMonitoring();
  console.log('[SERVER] System health monitoring started - checks every 5 minutes, sends URGENT alerts for critical issues');

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    // PRODUCTION FIX: Explicitly serve built assets from dist/public
    // Symlinks don't survive Replit's deployment process, and server/vite.ts 
    // (forbidden to edit) looks for server/public which doesn't exist.
    const fs = await import('fs');
    const staticRoot = path.resolve(__dirname, '../dist/public');
    
    console.log(`[PRODUCTION] staticRoot = ${staticRoot}`);
    
    if (fs.existsSync(staticRoot)) {
      console.log('[PRODUCTION] Build directory found - serving static assets');
      
      // Serve ALL built static assets (JS, CSS, manifest, icons, images)
      app.use(express.static(staticRoot, {
        maxAge: '1y',
        immutable: true,
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
          } else if (filePath.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css; charset=UTF-8');
          } else if (filePath.endsWith('.html')) {
            // HTML should never be cached
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
          }
        }
      }));
      console.log('[PRODUCTION] Static file serving registered from', staticRoot);
      
      // SPA fallback - serve index.html for frontend routes (NOT API/media/twilio)
      app.get('*', (req, res, next) => {
        const reqPath = req.path || '';
        
        // Let API, Twilio, and media routes pass through to 404/error handlers
        if (
          reqPath.startsWith('/api/') ||
          reqPath.startsWith('/api') ||
          reqPath.startsWith('/twilio/') ||
          reqPath.startsWith('/twilio') ||
          reqPath.startsWith('/media/')
        ) {
          return next();
        }
        
        // Serve index.html for all frontend routes
        res.sendFile(path.join(staticRoot, 'index.html'), (err) => {
          if (err) {
            console.error('[SPA-FALLBACK] Failed to send index.html:', {
              path: reqPath,
              error: (err as any).message,
            });
            next(err);
          }
        });
      });
      console.log('[PRODUCTION] SPA fallback registered');
    } else {
      console.error('[PRODUCTION] ERROR: Build directory not found at', staticRoot);
      // Fall back to original serveStatic (may fail, but provides error message)
      serveStatic(app);
    }
  }

  // Error handler MUST be last (after all routes including SPA fallback)
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

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
// PHASE 11 – SMS AI Agent Parity
console.log(`
PHASE 11 – SMS AI Agent Parity:
- Created: server/ai/smsAgentPromptBuilder.ts
- Integrated into SMS handler: server/openai.ts (generateAIResponse)
- Uses tenant-specific business name, industry, services, and booking link
- System prompt aligned with OG SMS AI spec
- SMS responses optimized for ≤160 char when possible
`);
