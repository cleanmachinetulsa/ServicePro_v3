# Clean Machine Auto Detail / ServicePro Platform

## Canonical Roadmap
**See `/docs/MASTER_PLAN_v3.7_SERVICEPRO.md`** for the complete architecture, roadmap, and delivery blueprint. This is the single source of truth for all ServicePro development.

## Overview
ServicePro is a multi-tenant, white-label SaaS platform designed to transform service businesses into AI-powered web applications. It streamlines operations by providing comprehensive management for customers, appointments, loyalty programs, and payments. The platform integrates multi-channel communication (SMS, web chat, email, Facebook Messenger, Instagram DMs) and leverages AI (OpenAI) and Google Workspace APIs for intelligent automation, aiming to enhance efficiency and customer engagement. The business vision is to provide a highly automated and scalable solution for service businesses, starting with Clean Machine Auto Detail.

**Vision**: "The Shopify of service businesses."

## User Preferences
- Preferred communication style: Simple, everyday language
- AI Agent Behavior: Keep customer conversations focused on auto detailing topics and services. Steer discussions away from irrelevant topics back to Clean Machine Auto Detail services, scheduling, and business-related inquiries.

## System Architecture

### UI/UX Decisions
The application features a modern, mobile-responsive 3-column layout built with shadcn/ui, including a hexagonal shield logo, visual channel indicators, gradient backgrounds, and gamification elements. PWA enhancements provide branded install prompts, app shortcuts, badge notifications, and offline mode. The public website features a glassmorphism design with gradients, animations, industry-specific content, and mobile responsiveness.

### Technical Implementations
The system supports production-ready message attachments with Google Drive, TCPA/CTIA-compliant SMS consent, and AI-powered features for damage assessment, scheduling, and message rephrasing using GPT-4o. Recurring service management integrates with Google Calendar. Twilio Voice integration provides voicemail, missed call auto-SMS, and comprehensive call logging. Security is enforced through Twilio webhook verification, E.164 normalization, request validation, and RBAC middleware. An iMessage-quality messaging suite offers read receipts, typing indicators, reactions, and search. The platform includes service limits, maintenance mode, dynamic banner management, and auto-failover protection. A branded invoice email system offers professional, mobile-responsive invoices with upsell recommendations and HMAC-signed payment links. A centralized SMS template system allows dynamic editing with versioning and variable interpolation. Smart address validation with interactive map confirmation uses Google Maps. A comprehensive referral system with 9 reward types is implemented, including admin tools for code generation, tracking, and SMS invites. A dual phone line switching system supports two numbers with Google Voice-style UI and Twilio routing. A QR Code Security System with HMAC-SHA256 tokens is used for secure customer identification. Customer intelligence includes returning customer tracking and a GPT personalization service. Cash payment tracking includes manual entry and daily deposit widgets. A customizable dashboard system with drag-and-drop widgets is implemented for personalized user layouts.

#### Industry-Specific AI & Messaging Bootstrap
An automated bootstrap system initializes new tenants with industry-specific AI behavior rules, SMS templates, and FAQ entries based on their selected industry, ensuring multi-tenant isolation and idempotent upsert logic across 22 supported industries.

#### Telephony Mode System
A comprehensive telephony routing system allows tenant owners to control how incoming calls are handled. Four modes are available:
- **FORWARD_ALL_CALLS**: Calls ring the owner's personal phone directly without AI intervention. Requires a forwarding number.
- **AI_FIRST** (default, recommended): AI or IVR answers first to screen calls, then forwards to human staff as needed.
- **AI_ONLY**: AI handles all calls autonomously. Owners see bookings and messages but phones never ring.
- **TEXT_ONLY_BUSINESS**: Calls are politely declined with a brief message; callers automatically receive an SMS with booking link. Optional voicemail backup available.

Settings stored in `tenantPhoneConfig` table with `telephonyMode` and `allowVoicemailInTextOnly` columns. The canonical voice handler (`server/routes.twilioVoiceCanonical.ts`) branches on telephonyMode BEFORE consulting IVR settings. UI accessible via Phone Settings page (`/phone-settings`) with radio button selector and mode-specific options.

#### Multi-Tenant Architecture
The platform utilizes a comprehensive multi-tenant architecture with full tenant isolation across ~70+ database tables. An admin interface supports tenant CRUD operations and owner impersonation. A canonical voice entry-point provides standardized webhook handling for multi-tenant telephony. A Tenant Communication Routing Engine centralizes inbound communication routing for SMS, Voice, and IVR. An AI Voice Concierge entry point provides provider-agnostic AI voice infrastructure. Public sites are accessed via subdomain (`https://yoursite.serviceproapp.com/site/your-subdomain`) with global subdomain uniqueness and secure data isolation. Tenant isolation is enforced with a `tenantId` column on most tables.

#### Customer Identity & Login
Customer authentication is separate from staff/owner authentication, utilizing OTP (One-Time Password) via phone/email with rate limiting and session management. Customer profiles support `profilePictureUrl`, `customerNotes`, and notification preferences.

#### Billing & Usage Engine (SP-3)
A comprehensive multi-tenant usage tracking and billing system with the following components:
- **Usage Metrics Table**: `usage_metrics` tracks daily usage per tenant (SMS in/out, MMS in/out, voice minutes, emails, AI tokens in/out)
- **Usage Rollups Table**: `usage_rollups_daily` stores aggregated daily data with estimated costs
- **Usage Collector Service**: `server/services/usageCollectorService.ts` gathers usage data from various sources per tenant
- **Usage Rollup Service**: `server/services/usageRollupService.ts` runs daily at midnight UTC to aggregate metrics
- **Pricing Constants**: `shared/pricing/usagePricing.ts` defines per-unit costs (SMS: $0.0079, MMS: $0.02, Voice: $0.0085/min, Email: $0.00035, AI: $0.00001/$0.00003 per token)
- **Tenant Dashboard**: `/admin/billing-usage` shows month-to-date usage, 30-day trends, cost breakdown, and daily history
- **Root Admin Dashboard**: `/admin/system-usage` shows all tenant usage with charts, plan distribution, and manual rollup trigger
- **API Routes**: `server/routes.billingUsage.ts` with endpoints for summary, daily, metrics, and root admin tenant overview

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