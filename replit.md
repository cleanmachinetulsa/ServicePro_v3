# Clean Machine Auto Detail / ServicePro Platform

## Overview
ServicePro is a multi-tenant, white-label SaaS platform designed to transform service businesses into AI-powered web applications. It provides comprehensive management for customers, appointments, loyalty programs, and payments, integrating multi-channel communication (SMS, web chat, email, Facebook Messenger, Instagram DMs) and leveraging AI (OpenAI) and Google Workspace APIs for intelligent automation. The platform aims to enhance efficiency and customer engagement, with a strategic vision to become "The Shopify of service businesses."

## User Preferences
- Preferred communication style: Simple, everyday language
- AI Agent Behavior: Keep customer conversations focused on auto detailing topics and services. Steer discussions away from irrelevant topics back to Clean Machine Auto Detail services, scheduling, and business-related inquiries.

## System Architecture

### UI/UX Decisions
The application features a modern, mobile-responsive 3-column layout built with shadcn/ui, including a hexagonal shield logo, visual channel indicators, gradient backgrounds, and gamification elements. PWA enhancements provide branded install prompts, app shortcuts, badge notifications, and offline mode. The public website features a glassmorphism design with gradients, animations, industry-specific content, and mobile responsiveness. SEO components dynamically set titles and meta tags.

### Technical Implementations
The system supports production-ready message attachments with Google Drive, TCPA/CTIA-compliant SMS consent, and AI-powered features for damage assessment, scheduling, and message rephrasing using GPT-4o. Twilio Voice integration provides voicemail, missed call auto-SMS, and comprehensive call logging. Security is enforced through Twilio webhook verification, E.164 normalization, request validation, and RBAC middleware. An iMessage-quality messaging suite offers read receipts, typing indicators, reactions, and search. The platform includes service limits, maintenance mode, dynamic banner management, and auto-failover protection. A branded invoice email system offers professional, mobile-responsive invoices with upsell recommendations and HMAC-signed payment links. A centralized SMS template system allows dynamic editing with versioning and variable interpolation. Smart address validation with interactive map confirmation uses Google Maps. A comprehensive referral system with 9 reward types is implemented, including admin tools for code generation, tracking, and SMS invites. A dual phone line switching system supports two numbers with Google Voice-style UI and Twilio routing. A QR Code Security System with HMAC-SHA256 tokens is used for secure customer identification. Customer intelligence includes returning customer tracking and a GPT personalization service. Cash payment tracking includes manual entry and daily deposit widgets. A customizable dashboard system with drag-and-drop widgets is implemented for personalized user layouts. The platform also includes a Phone History Import Engine, Migration Wizard, and Parser Tool Hook for importing customer data, conversations, and messages. An optional "Import Your Phone History" step is integrated into the Setup Wizard. A usage and billing foundation provides visibility into current usage against plan limits for both tenant owners and root admins. Billing features include a tenant-facing page with Stripe integration, usage visibility, automated dunning for overdue accounts, and server-side proxy for secure voicemail playback. A Simple vs Advanced UI Mode system provides per-user interface complexity preferences, with a visible toggle in the app header. Tenant-level dashboard preferences control which navigation panels are visible in Simple mode. A comprehensive usage metering system records all billable events (SMS, AI, email, voice) to a centralized ledger for billing preparation.

### Feature Specifications
Key features include multi-platform messaging (Facebook Messenger, Instagram DMs), real-time SMS delivery monitoring, and an AI-powered chatbot (GPT-4o) for conversational AI, intent detection, and service recommendations. A quote-first workflow for specialty jobs uses AI for keyword detection. A loyalty program with referral rewards, appointment scheduling with weather checking and conflict detection, an upselling system with context-aware offers, and email marketing capabilities are integrated. Real-time chat monitoring allows for manual takeover. Technicians can update job status to 'on_site' with automatic customer SMS notifications. The platform supports plan tiers (free/starter/pro/elite/internal) with feature gating for 12 features. The system also includes advanced conversation management with AI-powered handback analysis and smart scheduling extraction, a weather risk assessment system for appointments, a multi-tenant loyalty bonus campaign system, and an AI agent system aware of these campaigns. A complete SaaS pricing and tier comparison system includes a premium public /pricing page with glassmorphism UI, in-app upgrade modals, and locked feature components. A dual suggestion system enables tenant owners to submit platform feedback and customers to submit suggestions to their tenant's business. The platform also supports custom domain routing, with specific redirection logic for `cleanmachinetulsa.com`, and includes HTTPS and www-to-root canonical redirects. Multi-tenant custom domain management is foundational for future use.

### System Design Choices
The architecture employs a React with TypeScript frontend (Vite, Tailwind CSS, shadcn/ui, TanStack React Query, React Hook Form with Zod, Stripe) and an Express.js backend with TypeScript. Core patterns include a monolithic service layer, multi-channel response formatting for AI, a customer memory system, and Google Sheets integration as a dynamic knowledge base. Data is stored in PostgreSQL (Neon serverless) with Drizzle ORM, Google Sheets, and Google Drive. Authentication is session-based. The Express server uses `app.set('trust proxy', true)` for correct handling of Replit's multi-layer proxy infrastructure.

## External Dependencies

**Google Workspace Suite**:
- **Google Calendar API**: Appointment scheduling and availability.
- **Google Sheets API**: Customer database and knowledge base.
- **Google Drive API**: Customer photo management.
- **Google Maps API**: Geocoding, distance/drive time calculation.

**Payment Processing**:
- **Stripe**: Primary payment gateway for payment intents, customer/subscription management.
- **PayPal**: Alternative payment option.

**Communication Services**:
- **Twilio**: SMS notifications, voicemail transcription, and voice/IVR services.
- **SendGrid**: Email delivery.
- **Slack**: Internal business notifications and alerts.
- **Facebook Graph API**: Integration with Facebook Messenger and Instagram Direct Messages.

**Weather & Location**:
- **Open-Meteo API**: Free weather forecasting.

**AI & ML**:
- **OpenAI API**: GPT-4o for chatbot intelligence, conversational AI, intent detection, email content generation, service recommendations, and the Support AI Assistant.

## CM-Billing-Prep: Usage Ledger

A centralized usage metering system for billing preparation:

**Files**:
- `shared/schema.ts`: `usageLedger` table with source, eventType, units, metadata
- `server/usage/usageRecorder.ts`: Helper functions (recordSmsOutbound/Inbound, recordAiMessage, recordEmailSent)
- `server/routes.usageLedger.ts`: API routes for /api/billing/usage/summary and /events
- `client/src/pages/settings/BillingUsagePage.tsx`: Collapsible "Usage Event Log" section

**Sources**: twilio, openai, sendgrid, system
**Event Types**: sms_outbound, sms_inbound, mms_outbound, mms_inbound, call_inbound, call_outbound, call_minutes, ivr_step, ai_message, ai_voicemail_summary, email_sent, email_campaign

## SP-16: Add-Ons System

Tenant add-ons extend the base plan with optional paid features:

**Files**:
- `shared/addonsConfig.ts`: Add-on catalog with AddonKey type, pricing, feature flags
- `shared/schema.ts`: `tenant_addons` table (id, tenantId, addonKey, status, quantity, etc.)
- `server/services/addonService.ts`: CRUD for tenant add-ons (getTenantAddons, isAddonActive, setAddonStatus)
- `server/services/featureGatingService.ts`: Extended feature gating with add-on support
- `server/routes/addonRoutes.ts`: API routes for /api/billing/addons
- `client/src/pages/AdminPlansAndAddons.tsx`: Admin page at /admin/plans-and-addons
- `client/src/pages/settings/AddonsPage.tsx`: Tenant page at /settings/billing/addons

**Add-on Keys**: extra_phone_number, extra_user_seats, ai_power_pack, priority_support, multi_location, white_label_plus

**How to add a new add-on**:
1. Add key to `AddonKey` type in `shared/addonsConfig.ts`
2. Add key to `ADDON_KEYS` array in `shared/schema.ts`
3. Add definition to `ADDONS_CATALOG` array with pricing, minTier, featureFlags

**Feature gating with add-ons**:
- Use `isFeatureEnabled(tenantId, planTier, featureKey)` from featureGatingService for server-side checks
- Use `hasAddonFlag(tenantId, 'ai.higherLimits')` to check specific add-on feature flags

## CM-DEMO-1: Demo Mode System

A safe sandbox demo environment for potential customers to try the platform:

**Files**:
- `shared/demoConfig.ts`: Demo tenant ID, slug, configuration constants, and isDemoTenant() helper
- `shared/demo/demoGuards.ts`: Outbound guardrails for filtering SMS/email in demo mode
- `server/services/demoService.ts`: Demo session management (create, verify, get session info)
- `server/routes/demoRoutes.ts`: Public API routes at /api/demo/* (start, send-code, verify-code, session)
- `server/middleware/demoModeMiddleware.ts`: Express middleware for detecting and handling demo mode
- `shared/schema.ts`: `demo_sessions` table with session tokens, verification status, expiry
- `client/src/pages/DemoLandingPage.tsx`: Public /demo entry page with "Try Live Demo" button
- `client/src/pages/DemoVerifyPage.tsx`: Phone verification flow for demo access
- `client/src/pages/DemoDashboardPage.tsx`: Demo dashboard with simulated data

**Demo Flow**:
1. User visits /demo → Sees feature overview and "Try Live Demo" button
2. POST /api/demo/start → Creates demo session token (2-hour expiry)
3. User enters phone number → POST /api/demo/send-code sends real SMS verification
4. User enters code → POST /api/demo/verify-code marks session as verified
5. User redirected to /demo/dashboard with demo banner and simulated data

**Security Features**:
- Phone verification prevents abuse
- Sessions expire after 2 hours
- All outbound SMS/email redirected to verified demo phone only
- Demo tenant ID: 'demo-tenant' (hardcoded in demoConfig.ts)
- Demo banner clearly indicates sandbox mode

**Middleware Helpers**:
- `demoModeMiddleware`: Adds req.isDemoMode and req.demoSessionInfo to requests
- `requireDemoVerified`: Guards routes that need verified phone
- `blockInDemoMode(actionName)`: Returns 403 for blocked actions
- `simulateInDemoMode(fn)`: Returns simulated response in demo mode

## SP-18: Usage Metering v2

Comprehensive usage tracking with tier-based caps and cost estimates:

**Files**:
- `shared/usageCapsConfig.ts`: Tier-based usage cap defaults (sms, mms, ai, email, voice) with monthly limits
- `shared/schema.ts`: `usage_caps` table with per-tenant overrides, `tenant_usage_status_v2` for status tracking
- `server/services/usageMeteringService.ts`: Core service with aggregation, cap checking, status computation
- `server/routes/usageMeteringRoutes.ts`: API routes at /api/billing/usage/v2/*
- `client/src/pages/settings/UsageDashboardPage.tsx`: Tenant page at /settings/usage-caps
- `client/src/pages/admin/AdminSystemUsagePage.tsx`: Admin page at /admin/system-usage-v2

**API Routes**:
- GET /api/billing/usage/v2/summary: Current period usage with caps and status
- GET /api/billing/usage/v2/daily: Daily usage trend for charts
- POST /api/billing/usage/v2/refresh: Force recalculation from ledger
- GET /api/admin/usage/v2/tenants: All tenants usage overview
- POST /api/admin/usage/v2/rebuild: Rebuild rollups from ledger

**Usage Status Types**: ok, warning (80%+), critical (95%+), exceeded (100%+)

**Features**:
- Tier-based default caps (free/starter/pro/elite/internal)
- Per-tenant cap overrides via admin interface
- Daily usage rollups aggregated from usageLedger events
- Cost estimation based on standard rates
- Admin rebuild capability for data correction