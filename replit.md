# Clean Machine Auto Detail / ServicePro Platform

## Overview
ServicePro is a multi-tenant, white-label SaaS platform that transforms service businesses into AI-powered web applications. It offers comprehensive management for customers, appointments, loyalty programs, and payments, integrating multi-channel communication (SMS, web chat, email, Facebook Messenger, Instagram DMs). Leveraging AI (OpenAI) and Google Workspace APIs, the platform automates tasks, enhances efficiency, and improves customer engagement. The strategic vision is to become "The Shopify of service businesses."

## User Preferences
- Preferred communication style: Simple, everyday language
- AI Agent Behavior: Keep customer conversations focused on auto detailing topics and services. Steer discussions away from irrelevant topics back to Clean Machine Auto Detail services, scheduling, and business-related inquiries.

## Recent Changes (December 2024)

### SP-SUPPORT-1: Support Issues & Error Logging (Dec 9, 2024)
1. **Support Issues System**: Added `support_issues` table for tracking errors, bugs, and feature requests per tenant. Owner-only access for viewing/managing issues.

2. **Key Files**:
   - `shared/schema.ts`: support_issues table with tenant isolation
   - `server/services/supportIssuesService.ts`: CRUD operations with email notifications
   - `server/routes.supportIssues.ts`: API routes at /api/support/issues
   - `client/src/pages/admin/SupportIssuesPage.tsx`: Admin page for issue management
   - `client/src/lib/supportIssueReporter.ts`: Frontend helper for auto-logging errors

3. **Integration Points**: Support Assistant (useSupportAssistantChat) auto-logs errors to support_issues table. Emails sent to info@cleanmachinetulsa.com on new issues.

### Critical Production Fixes (Dec 8, 2024)
1. **Google Calendar Sync for Dashboard Appointments**: Added `syncAppointmentToCalendar` export in `server/calendarApi.ts` and integrated it into `server/routes.appointments.ts`. Appointments created via the admin dashboard now sync to Google Calendar.

2. **Push Notifications for New Bookings**: Added `sendPushToAllUsers` call in `server/routes.appointments.ts` to alert owners/managers when new appointments are created via the dashboard. Includes deep link to appointment details.

3. **Root Tenant Settings Hub**: Updated `client/src/pages/settings-admin.tsx` to show a dedicated settings hub for root tenant (Clean Machine) instead of the generic SettingsWorkspace. The hub shows organized links to all legacy admin pages with proper icons and data-testid attributes.

4. **AI Agent Behavior Rules**: Root tenant has 3 behavior rules in database that are loaded by `buildSmsSystemPrompt` in `server/ai/smsAgentPromptBuilder.ts` for SMS AI responses.

## System Architecture

### UI/UX Decisions
The application features a modern, mobile-responsive 3-column layout built with shadcn/ui, incorporating a hexagonal shield logo, visual channel indicators, and gradient backgrounds. PWA enhancements provide branded install prompts, app shortcuts, badge notifications, and offline mode. The public website utilizes a glassmorphism design with gradients, animations, and mobile responsiveness, including dynamic SEO components.

### Technical Implementations
The system supports production-ready message attachments with Google Drive, TCPA/CTIA-compliant SMS consent, and AI-powered features for damage assessment, scheduling, and message rephrasing using GPT-4o. Twilio Voice integration provides voicemail, missed call auto-SMS, and call logging. Security is enforced through Twilio webhook verification, E.164 normalization, request validation, and RBAC middleware. An iMessage-quality messaging suite offers read receipts, typing indicators, reactions, and search. The platform includes service limits, maintenance mode, dynamic banner management, and auto-failover protection. A branded invoice email system offers professional, mobile-responsive invoices with upsell recommendations and HMAC-signed payment links. A centralized SMS template system allows dynamic editing with versioning and variable interpolation. Smart address validation with interactive map confirmation uses Google Maps. A comprehensive referral system with 9 reward types is implemented, including admin tools for code generation, tracking, and SMS invites. A dual phone line switching system supports two numbers with Google Voice-style UI and Twilio routing. A QR Code Security System with HMAC-SHA256 tokens is used for secure customer identification. Customer intelligence includes returning customer tracking and a GPT personalization service. Cash payment tracking includes manual entry and daily deposit widgets. A customizable dashboard system with drag-and-drop widgets is implemented for personalized user layouts. The platform also includes a Phone History Import Engine, Migration Wizard, and Parser Tool Hook for importing customer data, conversations, and messages. A usage and billing foundation provides visibility into current usage against plan limits for both tenant owners and root admins, with a tenant-facing page for Stripe integration, automated dunning, and server-side proxy for secure voicemail playback. A Simple vs Advanced UI Mode system provides per-user interface complexity preferences with a visible toggle. A comprehensive usage metering system records all billable events (SMS, AI, email, voice) to a centralized ledger.

### Feature Specifications
Key features include multi-platform messaging (Facebook Messenger, Instagram DMs), real-time SMS delivery monitoring, and an AI-powered chatbot (GPT-4o) for conversational AI, intent detection, and service recommendations. A quote-first workflow for specialty jobs uses AI for keyword detection. A loyalty program with referral rewards, appointment scheduling with weather checking and conflict detection, an upselling system with context-aware offers, and email marketing capabilities are integrated. Real-time chat monitoring allows for manual takeover. Technicians can update job status to 'on_site' with automatic customer SMS notifications. The platform supports plan tiers (free/starter/pro/elite/internal) with feature gating for 12 features. The system also includes advanced conversation management with AI-powered handback analysis and smart scheduling extraction, a weather risk assessment system for appointments, a multi-tenant loyalty bonus campaign system, and an AI agent system aware of these campaigns. A complete SaaS pricing and tier comparison system includes a premium public /pricing page with glassmorphism UI, in-app upgrade modals, and locked feature components. A dual suggestion system enables tenant owners to submit platform feedback and customers to submit suggestions to their tenant's business. The platform also supports custom domain routing, with specific redirection logic for `cleanmachinetulsa.com` (which must always render `client/src/pages/home.tsx`), and includes HTTPS and www-to-root canonical redirects. Multi-tenant custom domain management is foundational for future use. The platform also includes an add-ons system to extend base plans with optional paid features and a demo mode system for a safe sandbox environment. A comprehensive usage metering system (v2) tracks usage with tier-based caps and cost estimates. An AI-powered parser integration analyzes phone history for onboarding knowledge extraction. **SP-26 Usage Transparency v2**: Per-channel cost breakdown (SMS, MMS, Voice, Email, AI) with exact inbound/outbound rate calculations stored in usage_rollups_daily, tenant dashboard at /admin/usage-costs, root admin view at /root/system-usage, and billing integration helper calculateTenantUsageForPeriod().

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