# Clean Machine Auto Detail / ServicePro Platform

## Overview
ServicePro is a multi-tenant, white-label SaaS platform designed to transform service businesses into AI-powered web applications. It offers comprehensive management for customers, appointments, loyalty programs, and payments, integrating multi-channel communication (SMS, web chat, email, Facebook Messenger, Instagram DMs) and leveraging AI (OpenAI) and Google Workspace APIs for intelligent automation. The platform aims to enhance efficiency and customer engagement, with a strategic vision to become "The Shopify of service businesses."

## User Preferences
- Preferred communication style: Simple, everyday language
- AI Agent Behavior: Keep customer conversations focused on auto detailing topics and services. Steer discussions away from irrelevant topics back to Clean Machine Auto Detail services, scheduling, and business-related inquiries.

## System Architecture

### UI/UX Decisions
The application features a modern, mobile-responsive 3-column layout built with shadcn/ui, including a hexagonal shield logo, visual channel indicators, gradient backgrounds, and gamification elements. PWA enhancements provide branded install prompts, app shortcuts, badge notifications, and offline mode. The public website features a glassmorphism design with gradients, animations, industry-specific content, and mobile responsiveness.

### Technical Implementations
The system supports production-ready message attachments with Google Drive, TCPA/CTIA-compliant SMS consent, and AI-powered features for damage assessment, scheduling, and message rephrasing using GPT-4o. Twilio Voice integration provides voicemail, missed call auto-SMS, and comprehensive call logging. Security is enforced through Twilio webhook verification, E.164 normalization, request validation, and RBAC middleware. An iMessage-quality messaging suite offers read receipts, typing indicators, reactions, and search. The platform includes service limits, maintenance mode, dynamic banner management, and auto-failover protection. A branded invoice email system offers professional, mobile-responsive invoices with upsell recommendations and HMAC-signed payment links. A centralized SMS template system allows dynamic editing with versioning and variable interpolation. Smart address validation with interactive map confirmation uses Google Maps. A comprehensive referral system with 9 reward types is implemented, including admin tools for code generation, tracking, and SMS invites. A dual phone line switching system supports two numbers with Google Voice-style UI and Twilio routing. A QR Code Security System with HMAC-SHA256 tokens is used for secure customer identification. Customer intelligence includes returning customer tracking and a GPT personalization service. Cash payment tracking includes manual entry and daily deposit widgets. A customizable dashboard system with drag-and-drop widgets is implemented for personalized user layouts. The platform also includes a Phone History Import Engine, Migration Wizard, and Parser Tool Hook for importing customer data, conversations, and messages. An optional "Import Your Phone History" step is integrated into the Setup Wizard. A usage and billing foundation provides visibility into current usage against plan limits for both tenant owners and root admins.

### Feature Specifications
Key features include multi-platform messaging (Facebook Messenger, Instagram DMs), real-time SMS delivery monitoring, and an AI-powered chatbot (GPT-4o) for conversational AI, intent detection, and service recommendations. A quote-first workflow for specialty jobs uses AI for keyword detection. A loyalty program with referral rewards, appointment scheduling with weather checking and conflict detection, an upselling system with context-aware offers, and email marketing capabilities are integrated. Real-time chat monitoring allows for manual takeover. Technicians can update job status to 'on_site' with automatic customer SMS notifications. The platform supports plan tiers (free/starter/pro/elite/internal) with feature gating for 12 features. The system also includes advanced conversation management with AI-powered handback analysis and smart scheduling extraction, a weather risk assessment system for appointments, a multi-tenant loyalty bonus campaign system, and an AI agent system aware of these campaigns. A complete SaaS pricing and tier comparison system includes a premium public /pricing page with glassmorphism UI, in-app upgrade modals, and locked feature components. A dual suggestion system enables tenant owners to submit platform feedback and customers to submit suggestions to their tenant's business.

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

## SP-11: Usage & Billing Foundation v1

### Overview
Establishes the foundation for tenant-level usage visibility and plan limit awareness. Provides both tenant owners and root admins with visibility into current usage against plan limits.

### Plan Limits Configuration
Located in `shared/pricing/planLimits.ts`, defines soft usage caps per plan tier:

| Tier     | SMS/mo  | Email/mo | AI Requests/mo | Voice Min/mo | Base Price |
|----------|---------|----------|----------------|--------------|------------|
| Free     | 100     | 100      | 1              | 50           | $0         |
| Starter  | 500     | 500      | 5              | 100          | $29        |
| Pro      | 2,000   | 2,000    | 25             | 300          | $79        |
| Elite    | 10,000  | 10,000   | 100            | 1,000        | $199       |
| Internal | ∞       | ∞        | ∞              | ∞            | $0         |

Note: AI requests represent 1K AI token bundles (1 request ≈ 1,000 tokens).

### Tenant Billing Page (`/settings/billing`)
Enhanced with:
- **Billing Period Display**: Shows current month (e.g., "December 2025")
- **Usage Cards with Progress Bars**: Shows "X / Y" format for SMS, Voice, Email, AI usage
- **Plan Limits Integration**: Uses limits from `planLimits.ts` based on tenant's plan tier
- **Daily Usage Chart**: Line chart showing last 30 days of usage trends (Recharts)
- **Estimated Cost**: Shows calculated usage cost for the billing period

### Root Admin Usage Overview (`/admin/billing-overview`)
New page for platform-wide visibility:
- **Aggregate Stats**: Total SMS, voice minutes, emails, AI requests across all tenants
- **Platform Summary**: Total tenants, active tenants, estimated total cost
- **Tenants by Plan**: Bar chart showing distribution across plan tiers
- **Tenant Usage Table**: Individual usage vs limits with progress bars, searchable

### API Endpoints
- **GET /api/settings/billing/overview**: Tenant billing overview with plan limits, daily usage
- **GET /api/root-admin/usage/overview**: Aggregate usage across all tenants (root only)

### Key Files
- `shared/pricing/planLimits.ts`: Plan limit configuration
- `server/services/usageOverviewService.ts`: Enhanced with plan limits and daily usage
- `server/routes.adminUsageOverview.ts`: Root admin usage overview API
- `client/src/pages/settings/BillingUsagePage.tsx`: Enhanced tenant billing page
- `client/src/pages/AdminBillingOverview.tsx`: Root admin usage overview page

### Navigation
- Tenant page: Settings → Billing & Usage (`/settings/billing`)
- Root admin page: Multi-Tenant Management → Usage Overview (`/admin/billing-overview`, Owner badge)

## SP-12: Voicemail Playback Fix (No Twilio Login Popups)

### Overview
Fixes voicemail playback in the app by routing audio through a secure server-side proxy instead of exposing raw Twilio recording URLs to the browser.

### Problem Solved
- Previously, voicemail audio players used raw Twilio Recording URLs
- These URLs require Twilio Console authentication, causing login popups
- Twilio credentials were potentially exposed to the browser

### Solution Architecture
1. **Server-side Proxy Endpoint**: `GET /api/twilio/media/:recordingSid`
   - Fetches recording from Twilio using server-side credentials
   - Streams audio back to browser (Content-Type: audio/mpeg)
   - Never exposes Twilio Account SID or Auth Token to frontend
   - Requires authentication (user must be logged in)

2. **Frontend Helper Function**: `getProxiedAudioUrl()` in `client/src/lib/twilioMediaProxy.ts`
   - Extracts recordingSid from raw Twilio URLs
   - Converts to proxy URL format: `/api/twilio/media/RExxxxxx`
   - Used by all voicemail player components

### Key Files
- `server/routes.twilioMedia.ts`: Proxy endpoint implementation
- `client/src/lib/twilioMediaProxy.ts`: URL conversion helper
- `client/src/components/messages/MessageBubble.tsx`: Main conversation voicemail player
- `client/src/components/messages/NightOpsVoicemailCard.tsx`: Night Ops voicemail card
- `client/src/components/phone/VoicemailInbox.tsx`: Voicemail inbox player
- `client/src/components/phone/CallDetailsModal.tsx`: Call details recording download

### Troubleshooting Voicemail Playback
If voicemail playback fails:
1. **Check Twilio credentials**: Verify `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` are set
2. **Check recordingSid**: Ensure the recording SID starts with "RE" prefix
3. **Check network**: Look in browser dev tools for 403/404 errors on `/api/twilio/media/` requests
4. **Check logs**: Server logs errors with `[TWILIO MEDIA PROXY]` prefix

### Security
- Server credentials never sent to browser
- Raw Twilio URLs are never exposed to frontend
- All proxy requests require user authentication
- Errors don't leak sensitive information
