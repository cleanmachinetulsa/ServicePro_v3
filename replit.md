# Clean Machine Auto Detail / ServicePro Platform

## Overview
ServicePro is a multi-tenant, white-label SaaS platform designed to transform service businesses into AI-powered web applications. It provides comprehensive management for customers, appointments, loyalty programs, and payments, integrating multi-channel communication (SMS, web chat, email, Facebook Messenger, Instagram DMs) and leveraging AI (OpenAI) and Google Workspace APIs for intelligent automation. The platform aims to enhance efficiency and customer engagement, with a strategic vision to become "The Shopify of service businesses."

## User Preferences
- Preferred communication style: Simple, everyday language
- AI Agent Behavior: Keep customer conversations focused on auto detailing topics and services. Steer discussions away from irrelevant topics back to Clean Machine Auto Detail services, scheduling, and business-related inquiries.

## System Architecture

### UI/UX Decisions
The application features a modern, mobile-responsive 3-column layout built with shadcn/ui, including a hexagonal shield logo, visual channel indicators, gradient backgrounds, and gamification elements. PWA enhancements provide branded install prompts, app shortcuts, badge notifications, and offline mode. The public website features a glassmorphism design with gradients, animations, industry-specific content, and mobile responsiveness.

### Technical Implementations
The system supports production-ready message attachments with Google Drive, TCPA/CTIA-compliant SMS consent, and AI-powered features for damage assessment, scheduling, and message rephrasing using GPT-4o. Twilio Voice integration provides voicemail, missed call auto-SMS, and comprehensive call logging. Security is enforced through Twilio webhook verification, E.164 normalization, request validation, and RBAC middleware. An iMessage-quality messaging suite offers read receipts, typing indicators, reactions, and search. The platform includes service limits, maintenance mode, dynamic banner management, and auto-failover protection. A branded invoice email system offers professional, mobile-responsive invoices with upsell recommendations and HMAC-signed payment links. A centralized SMS template system allows dynamic editing with versioning and variable interpolation. Smart address validation with interactive map confirmation uses Google Maps. A comprehensive referral system with 9 reward types is implemented, including admin tools for code generation, tracking, and SMS invites. A dual phone line switching system supports two numbers with Google Voice-style UI and Twilio routing. A QR Code Security System with HMAC-SHA256 tokens is used for secure customer identification. Customer intelligence includes returning customer tracking and a GPT personalization service. Cash payment tracking includes manual entry and daily deposit widgets. A customizable dashboard system with drag-and-drop widgets is implemented for personalized user layouts. The platform also includes a Phone History Import Engine, Migration Wizard, and Parser Tool Hook for importing customer data, conversations, and messages. An optional "Import Your Phone History" step is integrated into the Setup Wizard. A usage and billing foundation provides visibility into current usage against plan limits for both tenant owners and root admins. Billing features include a tenant-facing page with Stripe integration, usage visibility, automated dunning for overdue accounts, and server-side proxy for secure voicemail playback. A Simple vs Advanced UI Mode system (SP-14) provides per-user interface complexity preferences stored in users.uiExperienceMode column, with a visible toggle in the app header between page actions and theme toggle. Simple mode shows essential widgets (monthly-stats, calendar, schedule, quick-actions), simplified navigation with advancedOnly items hidden (Multi-Tenant Management, A2P Campaign, Port Recovery, Call Metrics, Usage Dashboard), and jargon-free labels in settings tabs (Hours instead of Business Hours, Booking instead of Booking Settings, Look & Feel instead of Branding). Dashboard customization is disabled in Simple mode.

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

## Clean Machine Custom Domain Behavior

### CM-DNS-2: Root Domain Routing

The platform supports custom domain routing for the Clean Machine tenant specifically:

- **Environment Variable**: `CLEAN_MACHINE_DOMAIN` (default: `cleanmachinetulsa.com`)
- **Frontend Variable**: `VITE_CLEAN_MACHINE_DOMAIN` (same default)

**Behavior**:
- When the browser hostname matches `cleanmachinetulsa.com` (or `www.cleanmachinetulsa.com`), visiting `/` automatically redirects to `/site/cleanmachine` (the Clean Machine public booking site).
- For all other hosts (Replit default domain, future app.servicepro.com, etc.), `/` shows the standard ServicePro marketing landing page.

**Implementation**:
- `shared/domainConfig.ts`: Exports `CLEAN_MACHINE_DOMAIN` and `CLEAN_MACHINE_TENANT_SLUG` constants
- `client/src/components/RootDomainHandler.tsx`: Checks hostname on the root route and redirects if on the Clean Machine domain
- This is a client-side redirect only; no server-side changes required for this feature

### CM-DNS-3: HTTPS and Canonical Redirects

Express middleware in `server/index.ts` handles HTTP-to-HTTPS and www-to-root redirects for the Clean Machine domain:

- **http → https**: Redirects all HTTP traffic to HTTPS (301 permanent)
- **www → root**: Redirects www.cleanmachinetulsa.com → cleanmachinetulsa.com (301 permanent)
- Only applies in production mode (skipped when `NODE_ENV=development`)
- Uses `x-forwarded-proto` header to detect protocol behind Replit's proxy

**SEO Component** (`client/src/components/Seo.tsx`):
- Sets document.title and meta tags dynamically
- Supports: description, canonical URL, Open Graph (og:title, og:description, og:url)
- Applied to PublicSite, rewards pages, and booking pages

### SP-DOMAINS-1: Tenant Domain Management Foundation

Multi-tenant custom domain infrastructure for future use:

**Schema** (`shared/schema.ts`):
- `tenant_domains` table with domain, tenant_id, isPrimary, status (pending/verified/inactive)
- Foreign key cascade on tenant deletion
- Insert and select types exported

**Service Layer** (`server/services/tenantDomainService.ts`):
- CRUD operations: create, getAll, getById, update, delete
- setPrimary: Sets one domain as primary, unsets others
- Domain validation and uniqueness checks

**API Routes** (`server/routes.tenantDomains.ts`):
- `GET /api/settings/domains`: List tenant domains
- `POST /api/settings/domains`: Add new domain
- `PUT /api/settings/domains/:id`: Update domain (set primary)
- `DELETE /api/settings/domains/:id`: Remove domain
- All routes require authentication

**UI Page** (`client/src/pages/settings/DomainsPage.tsx`):
- Add custom domains with validation
- Set primary domain for tenant
- Delete domains with confirmation dialog
- Shows domain status badges (pending/verified/inactive)
- Navigation: Settings > Custom Domains (Advanced mode only)