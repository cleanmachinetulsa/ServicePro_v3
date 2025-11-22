# Clean Machine Auto Detail / ServicePro Platform

## Overview
ServicePro is a multi-tenant, white-label SaaS platform transforming Clean Machine Auto Detail into an AI-powered web application. It streamlines operations for service businesses through comprehensive management of customers, appointments, loyalty programs, payments, and multi-channel communication (SMS, web chat, email, Facebook Messenger, Instagram DMs). The platform integrates with Google Workspace APIs and OpenAI for intelligent chatbot capabilities, aiming for high automation to enhance efficiency and customer engagement.

## User Preferences
- Preferred communication style: Simple, everyday language
- AI Agent Behavior: Keep customer conversations focused on auto detailing topics and services. Steer discussions away from irrelevant topics back to Clean Machine Auto Detail services, scheduling, and business-related inquiries.

## Recent Changes

### Phase 6: Impersonate Tenant ("Login As...") (November 22, 2025)
- **Owner Impersonation System**: Implemented complete tenant impersonation system allowing owner-level users to view the app as any tenant for support and testing purposes.
- **Session-Based Context**: Extended session storage to include `impersonatingTenantId` and `impersonationStartedAt` fields, preserving true owner identity.
- **Backend Endpoints**: Created `/api/admin/impersonate/start` (POST, owner-only) and `/api/admin/impersonate/stop` (POST) with tenant validation and root tenant protection.
- **Auth Context API**: Added `/api/auth/context` (GET) endpoint exposing user info and impersonation state (tenantId, tenantName, startedAt) to frontend, querying root DB for cross-tenant name resolution.
- **UI Integration**: Added "Login as Tenant" buttons in AdminTenants page and AdminConciergeSetup success screen for seamless impersonation initiation.
- **Global Banner**: Created prominent ImpersonationBanner component with gradient amber/orange styling, showing impersonated tenant name and "Exit Impersonation" button, integrated into AppShell layout.
- **Helper Functions**: Created `isImpersonating()`, `getEffectiveTenantId()` (defaults to 'root' when not impersonating), and `getImpersonationContext()` utility functions in authHelpers.ts for consistent impersonation checks.
- **Test Coverage**: Basic smoke tests for impersonation start/stop covering owner-only access, tenant existence validation, and root tenant blocking.
- **Security**: Owner-only start permission, explicit root tenant blocking, audit logging of impersonation events via securityService (start/stop with userId and tenantId).

### Phase 5: Concierge Setup Dashboard (November 22, 2025)
- **Concierge Setup Dashboard**: Owner-only streamlined tenant onboarding interface at `/admin/concierge-setup` for guided tenant creation with business information collection, industry/plan tier selection, and optional phone config stub creation.
- **TenantConfig Schema Extension**: Added `industry` (varchar 100), `primaryContactEmail` (varchar 255), `primaryCity` (varchar 100), and `internalNotes` (text) fields to support concierge onboarding workflow.
- **Multi-Tenant Navigation**: Created dedicated "Multi-Tenant Management" section in admin navigation with Concierge Setup, Tenant Management, and Phone & IVR Config links (all owner-only with badges).
- **Backend Endpoint**: Implemented `/api/admin/concierge/onboard-tenant` (owner-only) with duplicate business name prevention, transactional tenant+config creation, and optional stub phone config generation.
- **Critical Bug Fix**: Fixed authMiddleware.ts security issue where `isTOTPEnabled()` was called without required `tenantDb` parameter, preventing proper 2FA verification.
- **Test Coverage**: Created comprehensive integration test suite (9 tests) for concierge onboarding endpoint validating auth, RBAC, validation, and business logic.

## System Architecture

### UI/UX Decisions
The application utilizes a modern, mobile-responsive 3-column layout based on shadcn/ui with CSS variables for theming. It features a hexagonal shield logo, visual channel indicators, gradient backgrounds, numbered buttons for AI suggestions, confidence badges, and gamification elements. Recent UI updates include glass-morphism containers, Framer Motion animations, premium step indicators, and Google Voice-level polish on messaging. A dedicated investor-ready marketing showcase (`/showcase`) includes advanced animations and interactive sandboxes. PWA enhancements provide branded install prompts, app shortcuts, badge notifications, and offline mode.

### Technical Implementations
The system supports production-ready message attachments with Google Drive, TCPA/CTIA-compliant SMS consent, and AI-powered features for damage assessment, scheduling, and message rephrasing using GPT-4o. Recurring service management integrates with Google Calendar. Twilio Voice integration provides voicemail and missed call auto-SMS, comprehensive call logging, and PWA push notifications. Security is managed through Twilio webhook verification, E.164 normalization, request validation, and RBAC middleware. Database performance is optimized with indexes and real-time WebSocket updates. Enhanced error handling includes toast messages and smart retry buttons. An iMessage-quality messaging suite offers read receipts, typing indicators, reactions, search, and offline drafts. Service limits, maintenance mode, dynamic banner management, and auto-failover protection are included. A branded invoice email system offers professional, mobile-responsive invoices with upsell recommendations and HMAC-signed payment links. A centralized SMS template system allows dynamic editing with versioning and variable interpolation. Smart address validation with interactive map confirmation allows customers to verify their location using Google Maps, saving appointments with lat/lng coordinates and address review flags. A referral management system provides admin tools for code generation, tracking, and SMS invites. A graceful fallback mechanism is in place for Google Calendar API failures. All admin pages are modernized to a unified AppShell navigation. A comprehensive referral system with 9 reward types is implemented. A dual phone line switching system supports two numbers with Google Voice-style UI and Twilio routing. An "Ask for Jody" VIP escalation system is present. A QR Code Security System with HMAC-SHA256 tokens is used for secure customer identification. Customer intelligence includes returning customer tracking and a GPT personalization service. Phone system enhancements include caller ID passthrough, configurable notifications, and a Recent Callers widget. Cash payment tracking includes manual entry and daily deposit widgets.

#### Multi-Tenant Architecture
The platform is built on a multi-tenant architecture with a `tenantConfig` table for managing tenants. It includes an admin interface for tenant CRUD operations. A canonical voice entry-point (`/twilio/voice/incoming`) provides a standardized webhook for multi-tenant telephony, dynamically resolving tenants via a `tenantPhoneConfig` table. This includes per-tenant SIP configuration, fallback to a 'root' tenant, and IVR mode support (simple, IVR, AI-voice). Security is enforced with Twilio signature verification. An Admin UI at `/admin/phone-config` allows management of phone numbers and IVR modes across tenants, with owner-only access and robust validation. A Tenant Communication Routing Engine (`server/services/tenantCommRouter.ts`) centralizes inbound communication routing (SMS, Voice, IVR) based on MessagingServiceSid, phone number, or fallback to 'root'. It ensures deterministic queries and sets proper tenant context for requests. An AI Voice Concierge entry point (`/twilio/voice/ai`) provides provider-agnostic AI voice infrastructure for `ai-voice` IVR mode, with placeholder TwiML and error handling.

#### Phone System Configuration
The system defines main business, direct business, and emergency alert phone numbers. The call flow routes customer calls to the main line, through an IVR menu, and then forwards to an owner's cell, displaying the customer's actual number (callerId="${callerNumber}"). Optional Twilio SIP integration allows custom business call ringtones, with sequential fallback. An after-hours voicemail system activates 30 minutes after the last scheduled end time, skipping the IVR. Ring duration is configurable (10-60 seconds). A notification system allows configurable preferences for voicemail, cash payments, system errors, appointment reminders, and missed calls. A communication hub integrates recent callers, click-to-SMS, one-click callback, and automatic customer record creation.

### Feature Specifications
Key features include multi-platform messaging (Facebook Messenger, Instagram DMs), real-time SMS delivery monitoring, and an AI-powered chatbot (GPT-4o) for conversational AI, intent detection, and service recommendations. A quote-first workflow for specialty jobs uses AI for keyword detection. A loyalty program with referral rewards, appointment scheduling with weather checking and conflict detection, an upselling system with context-aware offers, and email marketing capabilities are integrated. Real-time chat monitoring allows for manual takeover. Technicians can update job status to 'on_site' with automatic customer SMS notifications. Admin referral management allows managers to generate unique referral codes, track statistics, and send invites.

### System Design Choices
The architecture uses a React with TypeScript frontend (Vite, Tailwind CSS, shadcn/ui, TanStack React Query, React Hook Form with Zod, Stripe) and an Express.js backend with TypeScript. Core architectural patterns include a monolithic service layer, multi-channel response formatting for AI, a customer memory system, and Google Sheets integration as a dynamic knowledge base. Data is stored in PostgreSQL (Neon serverless) with Drizzle ORM, Google Sheets, and Google Drive. Authentication is session-based.

### Deployment & Production Safety
The Express server uses `app.set('trust proxy', true)` to handle Replit's multi-layer proxy infrastructure, which is critical for production to prevent 401 errors and ensure secure cookie handling.

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
- **Twilio**: SMS notifications and voicemail transcription.
- **SendGrid**: Email delivery.
- **Slack**: Internal business notifications and alerts.
- **Facebook Graph API**: Integration with Facebook Messenger and Instagram Direct Messages.

**Weather & Location**:
- **Open-Meteo API**: Free weather forecasting.

**AI & ML**:
- **OpenAI API**: GPT-4o for chatbot intelligence, conversation handling, email content generation, and service recommendations.