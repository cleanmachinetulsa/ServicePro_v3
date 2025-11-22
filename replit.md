# Clean Machine Auto Detail / ServicePro Platform

## Overview
Clean Machine Auto Detail is being transformed into **ServicePro** - a multi-tenant, white-label SaaS platform for service businesses. The flagship instance ('root' tenant) remains Clean Machine Auto Detail, an AI-powered web application designed to streamline operations for an auto detailing service. It provides comprehensive business management, including customer management, appointment scheduling, loyalty programs, payment processing, and multi-channel communication (SMS, web chat, email, Facebook Messenger, Instagram DMs). The system integrates with Google Workspace APIs and OpenAI for intelligent chatbot capabilities, aiming for an 87% automation rate to enhance efficiency and customer engagement.

### ServicePro Multi-Tenant Architecture
**Phase 2.5 Status: ✅ COMPLETE**

The application is being transformed into a multi-tenant platform with the following architecture:

- **Tenant Registry**: `tenantConfig` table with businessName, tier (starter/pro/elite), logoUrl, primaryColor
- **Admin Interface**: `/admin/tenants` for CRUD tenant management with tier badges
- **Canonical Voice Entry-Point**: `/twilio/voice/incoming` - standardized webhook for multi-tenant telephony
  - Phase 2.2: ✅ Dynamic tenant lookup via `tenantPhoneConfig` table (COMPLETE)
  - Phase 2.2: ✅ Per-tenant SIP configuration from database
  - Phase 2.2: ✅ Falls back to 'root' tenant for unconfigured phone numbers
  - Phase 2.3: ✅ IVR Mode Support - Interactive voice menus with DTMF routing (COMPLETE)
  - IVR Modes: `simple` (direct SIP), `ivr` (multi-option menu), `ai-voice` (future)
  - IVR Menu: Press 1 (services + SMS), Press 2 (forward), Press 3 (voicemail), Press 7 (easter egg)
  - Security: ✅ Twilio signature verification with `verifyTwilioSignature` middleware
  - Testing: ✅ 15/15 IVR tests passing, production-ready
  - Phase 2.5: ✅ Admin Phone & IVR Configuration UI (COMPLETE)
  - Admin UI: `/admin/phone-config` for managing phone numbers and IVR modes across all tenants
  - Features: Create/edit/delete phone configs, toggle IVR modes (simple/ivr/ai-voice), configure SIP settings
  - Security: Owner-only access with RBAC middleware, E.164 phone validation, duplicate number prevention, root tenant deletion guard
  - Data Integrity: Whitespace trimming, nullable field validation with shared schema, empty → NULL persistence
  - UX Quality: react-hook-form + zodResolver + Form components, tenant dropdown selector, complete data-testid coverage
  - Backend: Uses shared `insertTenantPhoneConfigSchema` with schema.shape validators, proper null handling for optional fields
  - Documentation: See `PHASE_2_1_CANONICAL_VOICE.md` and `PHASE_2_3_IVR_MODE.md`

**Key Files:**
- `server/routes.twilioVoiceCanonical.ts` - Canonical voice router with ivrMode branching
- `server/routes.twilioVoiceIvr.ts` - IVR callback handlers (Phase 2.3)
- `server/services/ivrHelper.ts` - TwiML builders for IVR menu (Phase 2.3)
- `server/services/tenantPhone.ts` - Tenant phone config loader functions
- `server/seed/seedTenantPhone.ts` - Idempotent seeder for root tenant phone config
- `shared/schema.ts` - `tenantPhoneConfig` table with ivrMode column (line 210)
- `server/routes.adminTenants.ts` - Tenant CRUD API
- `server/routes.adminPhoneConfig.ts` - Phone & IVR config CRUD API (Phase 2.5)
- `client/src/pages/AdminTenants.tsx` - Tenant management UI
- `client/src/pages/AdminPhoneConfig.tsx` - Phone & IVR configuration UI (Phase 2.5)
- `server/tenantDb.ts` - Tenant isolation utilities (909 usages migrated)

## User Preferences
- Preferred communication style: Simple, everyday language
- AI Agent Behavior: Keep customer conversations focused on auto detailing topics and services. Steer discussions away from irrelevant topics back to Clean Machine Auto Detail services, scheduling, and business-related inquiries.

## System Architecture

### UI/UX Decisions
The application features a modern, mobile-responsive 3-column layout using shadcn/ui with CSS variables for theming. Key UI elements include a hexagonal shield logo, visual channel indicators, gradient backgrounds, numbered buttons for AI suggestions, confidence badges, hover effects, enhanced message input with character counters, and gamification elements like canvas confetti and weather emoji icons. The dashboard uses an 8-tab sidebar, and top navigation features compact glass-effect buttons. Recent UI overhauls include glass-morphism containers, framer-motion animations, premium step indicators, and Google Voice-level polish on messaging. A dedicated investor-ready marketing showcase (`/showcase`) features advanced animations, interactive sandboxes, and comprehensive accessibility. PWA enhancements include branded install prompts, app shortcuts, badge notifications, and offline mode.

### Technical Implementations
The system supports production-ready message attachments with Google Drive, TCPA/CTIA-compliant SMS consent, and AI-powered features for damage assessment, scheduling, and message rephrasing using GPT-4o. It includes recurring service management with Google Calendar integration, Twilio Voice integration with voicemail and missed call auto-SMS, comprehensive call logging, and PWA push notifications. Security is managed through Twilio webhook verification, E.164 normalization, request validation, and RBAC middleware. Database performance is optimized with indexes and real-time WebSocket updates. Enhanced error handling with toast messages and smart retry buttons is implemented. An iMessage-quality messaging suite provides read receipts, typing indicators, reactions, search, and offline drafts. Service limits, maintenance mode, dynamic banner management, and auto-failover protection are included. A branded invoice email system offers professional, mobile-responsive invoices with upsell recommendations and HMAC-signed payment links. A centralized SMS template system allows dynamic editing with versioning and variable interpolation. Smart address validation with interactive map confirmation allows customers to verify their location using Google Maps with a draggable pin before booking; appointments are saved with lat/lng coordinates and address review flags for technician reference. A referral management system provides admin tools for code generation, tracking, and SMS invites. A graceful fallback mechanism is in place for Google Calendar API failures (appointments save to database even when Calendar fails). All admin pages are modernized to a unified AppShell navigation. A comprehensive referral system with 9 reward types is implemented. A dual phone line switching system supports two numbers with Google Voice-style UI and Twilio routing. An "Ask for Jody" VIP escalation system is present. A QR Code Security System with HMAC-SHA256 tokens is used for secure customer identification. Customer intelligence includes returning customer tracking and a GPT personalization service. Phone system enhancements include caller ID passthrough, configurable notifications, and a Recent Callers widget. Cash payment tracking includes manual entry and daily deposit widgets.

#### Phone System Configuration
**Official Phone Number Definitions:**
1.  **Main Business Line: 918-856-5304** - Ported Google Voice number for all customer communications (primary).
2.  **Jody's Business Line: 918-856-5711** - Twilio number for direct business calls.
3.  **Emergency Alert Number: 918-282-0103** - For critical system alerts (personal number).

**Call Flow Architecture:** Customer calls Main Line → IVR Menu (booking SMS or speak with someone) → Call forwards to Owner Cell → Caller ID shows customer's actual number.

**Caller ID Configuration:** Twilio TwiML configured with `callerId="${callerNumber}"` ensures owner sees customer's real phone number.

**SIP Routing (Custom Ringtones):** Optional Twilio SIP integration enables custom business call ringtones on Samsung phones. When enabled, calls route through SIP endpoint (e.g., jody@sip.cleanmachinetulsa.com) showing real customer caller ID + custom line label + unique ringtone. Sequential fallback supported: tries SIP first, then regular phone number. Configured per phone line in Phone Settings dashboard. See `/sip-setup-guide` for Twilio SIP Domain setup instructions.

**After-Hours Voicemail:** Separate greeting system that activates 30 minutes after last schedule ends. Skips IVR menu and call forwarding, goes directly to voicemail with custom after-hours greeting. Supports both text-to-speech and audio file uploads.

**Ring Duration:** Configurable 10-60 seconds (default 10s). Applies to both PSTN forwarding and SIP calls before going to voicemail.

**Notification System:** Configurable preferences via Dashboard → Settings → Notifications for Voicemail, Cash Payments, System Errors, Appointment Reminders, and Missed Calls.

**Communication Hub Integration:** Recent Callers widget, click-to-SMS, one-click callback, and automatic customer record creation.

### Feature Specifications
Key features include multi-platform messaging (Facebook Messenger, Instagram DMs), real-time SMS delivery monitoring, and an AI-powered chatbot (GPT-4o) for conversational AI, intent detection, and service recommendations. A quote-first workflow for specialty jobs uses AI for keyword detection. A loyalty program with referral rewards, appointment scheduling with weather checking and conflict detection, an upselling system with context-aware offers, and email marketing capabilities are integrated. Real-time chat monitoring allows for manual takeover. Technicians can update job status to 'on_site' with automatic customer SMS notifications. Admin referral management allows managers to generate unique referral codes, track statistics, and send invites.

### System Design Choices
The architecture consists of a React with TypeScript frontend (Vite, Tailwind CSS, shadcn/ui, TanStack React Query, React Hook Form with Zod, Stripe) and an Express.js backend with TypeScript. Core architectural patterns include a monolithic service layer, multi-channel response formatting for AI, a customer memory system, and Google Sheets integration as a dynamic knowledge base. Data is stored in PostgreSQL (Neon serverless) with Drizzle ORM, Google Sheets, and Google Drive. Authentication is session-based.

### Deployment & Production Safety
**Critical Configuration:** The Express server uses `app.set('trust proxy', true)` to properly handle Replit's multi-layer proxy infrastructure (Cloudflare + Load Balancer). This setting is CRITICAL for production - using `trust proxy: 1` breaks session authentication on deployed sites by preventing secure cookies from being set correctly. Always verify this setting before publishing to prevent 401 errors and connection failures. See `DEPLOYMENT_SAFETY_CHECKLIST.md` for comprehensive pre-deployment verification steps.

## External Dependencies

**Google Workspace Suite**:
-   **Google Calendar API**: Appointment scheduling and availability.
-   **Google Sheets API**: Customer database and knowledge base.
-   **Google Drive API**: Customer photo management.
-   **Google Maps API**: Geocoding, distance/drive time calculation.

**Payment Processing**:
-   **Stripe**: Primary payment gateway for payment intents, customer/subscription management.
-   **PayPal**: Alternative payment option.

**Communication Services**:
-   **Twilio**: SMS notifications and voicemail transcription.
-   **SendGrid**: Email delivery.
-   **Slack**: Internal business notifications and alerts.
-   **Facebook Graph API**: Integration with Facebook Messenger and Instagram Direct Messages.

**Weather & Location**:
-   **Open-Meteo API**: Free weather forecasting.

**AI & ML**:
-   **OpenAI API**: GPT-4o for chatbot intelligence, conversation handling, email content generation, and service recommendations.