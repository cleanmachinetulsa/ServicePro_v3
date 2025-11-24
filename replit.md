# Clean Machine Auto Detail / ServicePro Platform

## Overview
ServicePro is a multi-tenant, white-label SaaS platform designed to transform service businesses into AI-powered web applications. Its core purpose is to streamline operations by providing comprehensive management for customers, appointments, loyalty programs, and payments. The platform integrates multi-channel communication (SMS, web chat, email, Facebook Messenger, Instagram DMs) and leverages AI (OpenAI) and Google Workspace APIs for intelligent automation, aiming to enhance efficiency and customer engagement. The business vision is to provide a highly automated and scalable solution for service businesses, starting with Clean Machine Auto Detail.

## Recent Changes

### Phase 8: Industry Packs (November 24, 2025)
**Status**: ✅ Implementation complete

**Implemented Features**:
- ✅ Industry pack configuration system (`shared/industryPacks.ts`)
- ✅ **22 industry packs**: auto detailing, lawn care, house cleaning, mobile pet grooming, photography, pressure washing, window washing, pool service, landscaping, roofing, flooring, painting, pest control, moving help, personal training, massage therapy, mobile car wash, HVAC, plumbing, electrical, handyman, generic home services
- ✅ Automated service seeding with pricing, duration, descriptions (3-4 services per pack)
- ✅ FAQ seeding with categories and keywords (2-4 FAQs per pack)
- ✅ AI style notes per industry (for Phase 10/14 integration)
- ✅ Website seed data for Phase 9 integration
- ✅ Backend service (`server/industryPackService.ts`)
- ✅ Concierge UI integration with industry pack dropdown and auto-apply checkbox
- ✅ Database field: `tenant_config.industry_pack_id` (VARCHAR 100)
- ✅ Idempotent pack application (no duplicates, safe to re-run)

**Architecture Notes**:
- Industry packs are applied during tenant onboarding via Concierge Setup UI
- Pack data is stored in `shared/industryPacks.ts` with TypeScript types
- Backend service uses transactions to ensure atomicity
- Services and FAQs are checked for duplicates before insertion (by name/question)
- `industryConfig` JSONB field stores pack metadata for future use
- Integration hooks prepared for Phase 9 (Website Generator) and Phase 10/14 (AI tone)
- Phase 23 (Free Tier) will use industry packs as initial content for free tenants

**Future Integration Points**:
- 📝 Phase 9: Use `pack.websiteSeed` to pre-populate website templates
- 📝 Phase 10/14: Use `pack.aiStyleNotes` to configure AI agent tone per industry
- 📝 Phase 23: Free tier uses industry packs as starter content with watermarked sites

### Phase 15: Customer Identity & Login via OTP + Profile Customization (November 24, 2025)
**Status**: ✅ Implementation complete

**Completed (Profile Customization)**:
- ✅ Customer profile schema extensions: `profilePictureUrl`, `customerNotes`, `notifyViaEmail`, `notifyViaSms`, `notifyViaPush`
- ✅ Profile picture upload endpoint: `POST /api/portal/upload-profile-picture` (2MB limit, images only, saved to `public/uploads/profile_pictures/`)
- ✅ Profile update endpoint: `PUT /api/portal/profile` with Zod validation and tenant scoping
- ✅ Customer settings page UI: `/portal/settings` with profile editing, notification preferences, and personal notes
- ✅ PWA install prompt on customer portal for home screen access
- ✅ Updated `insertCustomerSchema` to include new profile fields for validation
- ✅ Secure file upload with multer (images only: JPEG, PNG, GIF, WebP)
- ✅ Proper tenant isolation: all routes scope by both `customerId` and `tenantId`

**Completed (OTP Authentication)**:
- ✅ Backend schema tables: `customerIdentities`, `customerOtps`, `customerSessions`
- ✅ Customer identity resolution service with phone/email normalization
- ✅ OTP authentication service with 5/hour rate limiting
- ✅ Customer portal authentication middleware (separate from staff auth)
- ✅ Public authentication routes: `/api/public/customer-auth/*`
- ✅ Protected customer portal routes: `/api/portal/me`
- ✅ Frontend OTP login page: `/portal/login`
- ✅ Customer portal dashboard: `/portal`
- ✅ Customer context service scaffold for AI integration
- ✅ Multi-tenant isolation with explicit tenant filtering
- ✅ Security: OTP expiration (10min), rate limiting (5/hour), session management (30 days)
- ✅ **OTP Dev Mode**: Development-only mode for testing without Twilio
  - Logs verification codes to server console in development
  - Accepts plain phone numbers (9182820103) or E.164 format (+19182820103)
  - Enable via `OTP_DEV_MODE=1` environment variable (set in development)
  - **SECURITY**: Only activates when `OTP_DEV_MODE=1` AND `NODE_ENV !== 'production'`
  - Production always attempts real SMS and returns proper errors if Twilio fails

**Architecture Notes**:
- Customer authentication is completely separate from staff/owner authentication  
- Uses dedicated `customerPortalAuthMiddleware` vs `requireAuth` for staff
- Customer profile updates use explicit field whitelisting to prevent malicious payload injection
- Profile pictures are stored in `/public/uploads/profile_pictures/` with customer-scoped filenames
- Notification preferences allow customers to opt-out of email/SMS/push notifications independently
- All services enforce `tenantDb.withTenantFilter(tenantId)` for multi-tenant isolation
- Phone normalization via `normalizePhoneE164()` from `contactUtils.ts`:
  - Accepts: `9185551234`, `19185551234`, `+19185551234`, `(918) 555-1234`
  - Normalizes to: `+19185551234` (E.164 format)
- OTP codes are SHA-256 hashed in database, never stored in plaintext
- Session tokens are cryptographically random (32 bytes hex)
- **Dev Mode Behavior**: 
  - **Development**: When `OTP_DEV_MODE=1` AND `NODE_ENV !== 'production'` → logs OTP to console
  - **Production**: Always sends real SMS via Twilio, never logs codes
  - Missing Twilio credentials in production → loud warning + `sms_send_failed` error
  - Check server logs for: `[OTP DEV MODE] 🔐 VERIFICATION CODE`

## User Preferences
- Preferred communication style: Simple, everyday language
- AI Agent Behavior: Keep customer conversations focused on auto detailing topics and services. Steer discussions away from irrelevant topics back to Clean Machine Auto Detail services, scheduling, and business-related inquiries.

## System Architecture

### UI/UX Decisions
The application features a modern, mobile-responsive 3-column layout built with shadcn/ui and CSS variables for theming. It includes a hexagonal shield logo, visual channel indicators, gradient backgrounds, numbered buttons for AI suggestions, confidence badges, gamification elements, glass-morphism containers, Framer Motion animations, premium step indicators, and Google Voice-level polish on messaging. PWA enhancements provide branded install prompts, app shortcuts, badge notifications, and offline mode.

### Technical Implementations
The system supports production-ready message attachments with Google Drive, TCPA/CTIA-compliant SMS consent, and AI-powered features for damage assessment, scheduling, and message rephrasing using GPT-4o. Recurring service management integrates with Google Calendar. Twilio Voice integration provides voicemail, missed call auto-SMS, comprehensive call logging, and PWA push notifications. Security is enforced through Twilio webhook verification, E.164 normalization, request validation, and RBAC middleware. Database performance is optimized with indexes and real-time WebSocket updates. Enhanced error handling includes toast messages and smart retry buttons. An iMessage-quality messaging suite offers read receipts, typing indicators, reactions, search, and offline drafts. The platform includes service limits, maintenance mode, dynamic banner management, and auto-failover protection. A branded invoice email system offers professional, mobile-responsive invoices with upsell recommendations and HMAC-signed payment links. A centralized SMS template system allows dynamic editing with versioning and variable interpolation. Smart address validation with interactive map confirmation allows customers to verify their location using Google Maps. A referral management system provides admin tools for code generation, tracking, and SMS invites. A graceful fallback mechanism is in place for Google Calendar API failures. All admin pages are modernized to a unified AppShell navigation. A comprehensive referral system with 9 reward types is implemented. A dual phone line switching system supports two numbers with Google Voice-style UI and Twilio routing. An "Ask for Jody" VIP escalation system is present. A QR Code Security System with HMAC-SHA256 tokens is used for secure customer identification. Customer intelligence includes returning customer tracking and a GPT personalization service. Phone system enhancements include caller ID passthrough, configurable notifications, and a Recent Callers widget. Cash payment tracking includes manual entry and daily deposit widgets. A customizable dashboard system with drag-and-drop widgets is implemented for personalized user layouts.

#### Industry-Specific AI & Messaging Bootstrap
An automated bootstrap system initializes new tenants with industry-specific AI behavior rules, SMS templates, and FAQ entries based on their selected industry during onboarding. This includes AI Behavior Rules, SMS Templates, and FAQ Entries stored in respective tables, ensuring multi-tenant isolation and idempotent upsert logic. It supports 17 industries, each with specific AI behavior rules, SMS templates, and FAQ entries.

#### Multi-Tenant Architecture
The platform utilizes a multi-tenant architecture with a `tenantConfig` table. An admin interface supports tenant CRUD operations and owner impersonation. A canonical voice entry-point provides standardized webhook handling for multi-tenant telephony, dynamically resolving tenants via a `tenantPhoneConfig` table, supporting per-tenant SIP configuration, fallback, and IVR modes. A Tenant Communication Routing Engine centralizes inbound communication routing for SMS, Voice, and IVR based on MessagingServiceSid, phone number, or fallback, ensuring proper tenant context. An AI Voice Concierge entry point provides provider-agnostic AI voice infrastructure.

#### Phone System Configuration
The system defines main business, direct business, and emergency alert phone numbers. Calls route through an IVR menu to an owner's cell, displaying the customer's actual number. Optional Twilio SIP integration allows custom ringtones with sequential fallback. An after-hours voicemail system activates 30 minutes after the last scheduled end time. Ring duration is configurable. A notification system allows configurable preferences for voicemail, cash payments, system errors, appointment reminders, and missed calls. A communication hub integrates recent callers, click-to-SMS, one-click callback, and automatic customer record creation.

### Feature Specifications
Key features include multi-platform messaging (Facebook Messenger, Instagram DMs), real-time SMS delivery monitoring, and an AI-powered chatbot (GPT-4o) for conversational AI, intent detection, and service recommendations. A quote-first workflow for specialty jobs uses AI for keyword detection. A loyalty program with referral rewards, appointment scheduling with weather checking and conflict detection, an upselling system with context-aware offers, and email marketing capabilities are integrated. Real-time chat monitoring allows for manual takeover. Technicians can update job status to 'on_site' with automatic customer SMS notifications. Admin referral management allows managers to generate unique referral codes, track statistics, and send invites. The platform supports plan tiers (starter/pro/elite/internal) with feature gating for AI SMS Agent, AI Voice Agent, and Campaigns. The system also includes advanced conversation management with AI-powered handback analysis and smart scheduling extraction, a weather risk assessment system for appointments, a multi-tenant loyalty bonus campaign system, and an AI agent system aware of these campaigns.

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
- **Twilio**: SMS notifications and voicemail transcription.
- **SendGrid**: Email delivery.
- **Slack**: Internal business notifications and alerts.
- **Facebook Graph API**: Integration with Facebook Messenger and Instagram Direct Messages.

**Weather & Location**:
- **Open-Meteo API**: Free weather forecasting.

**AI & ML**:
- **OpenAI API**: GPT-4o for chatbot intelligence, conversation handling, email content generation, and service recommendations.