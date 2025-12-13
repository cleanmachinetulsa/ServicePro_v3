# ServicePro Platform - Existing System Documentation

## Executive Summary

ServicePro is a **production-grade, multi-tenant SaaS platform** designed to power service businesses with AI-driven communication, scheduling, payments, and customer relationship management. This document provides a comprehensive map of everything currently built in the system.

**Production Reality:**
- Live tenants paying $100-500+/month
- 15+ active tenants across various service industries
- 5,000+ customers managed across all tenants
- Primary use case: Mobile auto detailing (Clean Machine Auto Detail)
- Strategic vision: "The Shopify of service businesses"

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Database Schema](#database-schema)
3. [Multi-Tenant System](#multi-tenant-system)
4. [Authentication & Security](#authentication--security)
5. [Communication Systems](#communication-systems)
6. [AI & Automation](#ai--automation)
7. [Scheduling & Appointments](#scheduling--appointments)
8. [Loyalty & Rewards](#loyalty--rewards)
9. [Billing & Payments](#billing--payments)
10. [Usage Tracking & Metering](#usage-tracking--metering)
11. [Public Website Generator](#public-website-generator)
12. [Technician Management](#technician-management)
13. [Admin & Root Features](#admin--root-features)
14. [External Integrations](#external-integrations)
15. [Frontend Architecture](#frontend-architecture)
16. [Key File Locations](#key-file-locations)

---

## Architecture Overview

### Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + TypeScript + Vite |
| UI Components | shadcn/ui + Tailwind CSS |
| State Management | TanStack Query (React Query v5) |
| Routing | wouter |
| Backend | Express.js + TypeScript |
| Database | PostgreSQL (Neon serverless) |
| ORM | Drizzle ORM |
| Real-time | Socket.IO (WebSockets) |
| PWA | Service Worker + Push Notifications |
| i18n | i18next (English/Spanish) |

### Core Design Patterns

1. **Multi-Tenant Isolation**: Every query uses `tenantDb` wrapper - no exceptions
2. **Session-Based Auth**: Express sessions with PostgreSQL store
3. **Service Layer Pattern**: Business logic in `/server/services/`
4. **API-First**: Thin routes delegate to services
5. **Type Safety**: Shared types between frontend/backend via `/shared/schema.ts`

---

## Database Schema

The database contains **100+ tables** defined in `shared/schema.ts` (5,194 lines). Below is a categorized breakdown:

### Core User & Auth Tables

| Table | Purpose |
|-------|---------|
| `users` | System users (employees, managers, owners) with tenant scoping |
| `oauth_providers` | OAuth connections (Google, GitHub, Apple) |
| `password_reset_tokens` | Secure password reset flow |
| `sessions` | PostgreSQL session store for Express |
| `webauthn_credentials` | Biometric/passkey authentication |
| `totp_secrets` | 2FA authenticator app secrets |
| `login_attempts` | Brute-force protection tracking |
| `account_lockouts` | Security lockout records |
| `audit_logs` | Admin activity audit trail |
| `error_logs` | System error logging |
| `impersonation_events` | Root admin impersonation tracking |

### Multi-Tenant Tables

| Table | Purpose |
|-------|---------|
| `tenants` | Tenant records with plan tier (free/starter/pro/elite/internal) |
| `tenant_config` | Business settings, branding, onboarding progress |
| `tenant_phone_config` | Telephony settings (Twilio numbers, SIP, IVR mode) |
| `tenant_email_profiles` | Email sender configuration (SendGrid) |
| `tenant_domains` | Custom domain mappings |

### Customer Management

| Table | Purpose |
|-------|---------|
| `customers` | Primary customer records with loyalty tiers, VIP status |
| `customer_vehicles` | Vehicle information for auto detailing |
| `customer_service_history` | Service history per vehicle |
| `customer_otps` | OTP codes for customer portal auth |
| `customer_tags` | Tagging system for segmentation |
| `contacts` | Third-party contacts (payers, fleet admins) |

### Appointment & Scheduling

| Table | Purpose |
|-------|---------|
| `appointments` | All scheduled appointments |
| `booking_tokens` | One-time booking links |
| `booking_initiation_events` | Funnel analytics (link_clicked → booking_completed) |
| `sms_booking_records` | Booking confirmation workflow tracking |
| `availability_templates` | Reusable availability patterns |
| `recurring_services` | Recurring service subscriptions |

### Conversations & Messaging

| Table | Purpose |
|-------|---------|
| `conversations` | Multi-channel conversation threads |
| `messages` | Individual messages with delivery tracking |
| `message_reactions` | Emoji reactions on messages |
| `message_edit_history` | Message edit audit trail |
| `scheduled_messages` | Messages scheduled for future delivery |
| `human_escalation_requests` | AI-to-human handoff requests |
| `sms_delivery_status` | Twilio delivery tracking |

### Voice & IVR

| Table | Purpose |
|-------|---------|
| `call_events` | All inbound/outbound call logs |
| `call_sms_state` | Tracks which calls received auto-SMS |
| `phone_lines` | Phone line configurations |
| `phone_schedules` | Business hours per line |
| `ivr_menus` | Per-tenant IVR menu configs |
| `ivr_menu_items` | IVR menu options (digits) |
| `ivr_prompts` | Voice prompts (TTS/audio) |

### Loyalty & Referrals

| Table | Purpose |
|-------|---------|
| `loyalty_points` | Customer point balances |
| `loyalty_tiers` | Tier definitions (Bronze → Platinum) |
| `loyalty_transactions` | Promo-based point awards |
| `points_transactions` | All point earn/redeem transactions |
| `achievements` | Gamification achievements |
| `customer_achievements` | Earned achievements per customer |
| `reward_services` | Redeemable loyalty offers |
| `redeemed_rewards` | Redemption history |
| `referrals` | Referral tracking |
| `referral_program_config` | Referral system configuration |
| `reward_audit` | Referral reward audit trail |

### Invoicing & Payments

| Table | Purpose |
|-------|---------|
| `invoices` | Customer invoices |
| `invoice_line_items` | Line items per invoice |
| `payment_links` | Stripe payment links |
| `authorizations` | Digital approvals (payer approval, service auth) |
| `gift_cards` | Square gift card sync |
| `credit_ledger` | Customer service credits |
| `credit_transactions` | Credit usage audit trail |
| `technician_deposits` | Deposit tracking for bookings |

### Services & Catalog

| Table | Purpose |
|-------|---------|
| `services` | Service catalog |
| `service_limits` | Daily booking limits per service |
| `service_addons` | Add-on services |
| `upsell_offers` | Upsell configuration |
| `appointment_upsells` | Upsells applied to appointments |

### Campaigns & Marketing

| Table | Purpose |
|-------|---------|
| `email_campaigns` | Email marketing campaigns |
| `email_templates` | Email template library |
| `email_subscribers` | Subscriber management |
| `sms_templates` | Centralized SMS templates with versioning |
| `sms_template_versions` | Template version history |
| `campaign_configs` | Per-tenant campaign settings |
| `campaign_sends` | Campaign send tracking |
| `port_recovery_campaigns` | One-time recovery blast campaigns |
| `port_recovery_targets` | Individual campaign targets |
| `a2p_campaigns` | A2P 10DLC campaign registration |

### Usage & Billing

| Table | Purpose |
|-------|---------|
| `usage_metrics` | Raw per-tenant daily usage |
| `usage_rollups_daily` | Aggregated daily totals with costs |
| `usage_events` | Granular per-event tracking |
| `usage_ledger` | Billable events ledger |
| `api_usage_logs` | External API call tracking |
| `service_health` | External service health monitoring |

### Technician Management

| Table | Purpose |
|-------|---------|
| `technicians` | Technician profiles |
| `job_photos` | Before/after job photos |
| `shifts` | Scheduled work periods |
| `shift_templates` | Standard shift types |
| `time_entries` | Clock in/out with geofencing |
| `pto_requests` | Time off requests |
| `shift_trades` | Shift swap requests |
| `technician_availability` | Preferred working hours |
| `applicants` | Job applicant pipeline |

### Support & Suggestions

| Table | Purpose |
|-------|---------|
| `support_tickets` | Support ticket system |
| `support_kb_articles` | Knowledge base articles |
| `support_issues` | Error/issue logging |
| `platform_suggestions` | Tenant → Platform feedback |
| `customer_suggestions` | Customer → Tenant feedback |

### System Configuration

| Table | Purpose |
|-------|---------|
| `business_settings` | Global business settings |
| `agent_preferences` | AI agent personality config |
| `org_settings` | Organization-wide settings |
| `homepage_content` | CMS for homepage |
| `dashboard_layouts` | Customizable dashboard layouts |
| `platform_settings` | Demo mode, global flags |
| `notification_settings` | Notification preferences |
| `critical_monitoring_settings` | Monitoring thresholds |

---

## Multi-Tenant System

### Tenant Isolation

Every database query is wrapped with `tenantDb`:

```typescript
import { wrapTenantDb } from './tenantDb';

// In middleware, we get tenantId from session
const tenantDb = wrapTenantDb(db, req.session.tenantId);

// All queries automatically scoped to tenant
const customers = await tenantDb.select().from(customers);
```

### Tenant Tiers

| Tier | Description | Features |
|------|-------------|----------|
| `free` | Watermarked public site | Limited features |
| `starter` | Basic plan, BYO integrations | Core features |
| `pro` | Full features, managed Twilio | All features |
| `elite` | Everything + priority support | Premium support |
| `internal` | Full access, no billing | Family/friends |

### Tenant Status

| Status | Description |
|--------|-------------|
| `trialing` | Initial trial period |
| `active` | Paying customer |
| `past_due` | Payment overdue |
| `suspended` | Account suspended |
| `cancelled` | Subscription cancelled |

### Key Files

- `server/tenantDb.ts` - Database wrapper with tenant filtering
- `server/tenantMiddleware.ts` - Express middleware for tenant context
- `server/services/tenantGuards.ts` - Permission guards
- `server/middleware/suspensionGuard.ts` - Blocks suspended tenants

---

## Authentication & Security

### Session-Based Authentication

- Express sessions stored in PostgreSQL via `connect-pg-simple`
- Secure cookies with `sameSite: 'lax'`, `httpOnly: true`
- Session timeout: 24 hours
- Trust proxy enabled for Replit deployment

### Authentication Methods

1. **Username/Password**: Traditional login with bcrypt hashing
2. **Google OAuth**: Via Passport.js
3. **WebAuthn/Passkeys**: Biometric authentication
4. **TOTP 2FA**: Authenticator app support
5. **Customer OTP**: SMS-based customer portal auth

### Security Features

- **Rate Limiting**: 1200 requests/min per IP
- **Brute Force Protection**: Account lockout after 5 failures
- **Audit Logging**: All admin actions logged
- **Twilio Signature Verification**: Webhook security
- **HMAC-Signed URLs**: Secure payment/reward links
- **RBAC Middleware**: Role-based access control

### Key Files

- `server/sessionMiddleware.ts` - Session configuration
- `server/authMiddleware.ts` - Auth guards
- `server/rbacMiddleware.ts` - Role-based access
- `server/securityService.ts` - Security utilities
- `server/security/` - Security-related modules

---

## Communication Systems

### SMS (Twilio)

**Inbound Flow:**
1. Twilio webhook → `/api/twilio/sms/inbound`
2. Message parsed, customer identified
3. AI processes and generates response (if AI mode)
4. Response sent via Twilio

**Outbound Flow:**
1. Service/AI generates message
2. Template variables interpolated
3. Consent verified (TCPA compliance)
4. Sent via Twilio Messaging Service
5. Delivery status tracked via webhook

**Key Files:**
- `server/twilioClient.ts` - Twilio SDK wrapper
- `server/services/smsRouter.ts` - Message routing logic
- `server/sms/` - SMS-related modules
- `server/routes.twilioStatusCallback.ts` - Delivery webhooks

### Voice & IVR (Twilio)

**Inbound Call Flow:**
1. Call → Twilio webhook → `/api/twilio/voice/inbound`
2. Tenant identified by phone number
3. IVR menu played (if configured)
4. Call forwarded/voicemail based on config
5. Voicemail transcribed via AI

**Telephony Modes:**
- `FORWARD_ALL_CALLS` - Direct forwarding
- `AI_FIRST` - AI answers, escalates if needed
- `AI_ONLY` - AI handles all calls
- `TEXT_ONLY_BUSINESS` - Voicemail only

**Key Files:**
- `server/routes.twilioVoice.ts` - Voice webhook handlers
- `server/routes.twilioVoiceIvr.ts` - IVR TwiML generation
- `server/services/ivrConfigService.ts` - IVR configuration
- `server/services/voicemailAiService.ts` - Voicemail AI

### Email (SendGrid)

**Features:**
- Transactional emails (booking confirmations, invoices)
- Marketing campaigns
- Template-based emails with variable interpolation
- Webhook tracking for opens/clicks

**Key Files:**
- `server/emailService.ts` - Email sending
- `server/emailTemplates/` - HTML templates
- `server/routes.sendgridWebhook.ts` - Event webhooks

### Push Notifications

**PWA Push:**
- Web Push API with VAPID keys
- Service Worker for background delivery
- Notification preferences per user

**Key Files:**
- `server/pushNotificationService.ts` - Push sending
- `server/initPushNotifications.ts` - Initialization
- `public/service-worker.js` - Service worker

### Facebook Messenger & Instagram DMs

**Integration:**
- Facebook Graph API
- Page token management
- Message sync to conversations table

**Key Files:**
- `server/routes.facebook.ts` - Facebook webhooks
- `shared/schema.ts` - `facebookPageTokens` table

---

## AI & Automation

### OpenAI Integration

**Model:** GPT-4o (configurable via `SMS_AGENT_MODEL` env var)

**AI Features:**
1. **Conversational Scheduling**: Natural language booking
2. **Damage Assessment**: Photo analysis for quotes
3. **Message Rephrasing**: Tone adjustment
4. **Voicemail Transcription**: Audio to text
5. **Service Recommendations**: Upselling AI
6. **Support Assistant**: Help & troubleshooting

### Agent Personality

Configurable via `agent_preferences` table:
- Professionalism level (1-5)
- Friendliness (1-5)
- Humor level (1-5)
- Use of emojis
- Custom opening messages per channel

### AI Behavior Rules

Per-tenant rules in `ai_behavior_rules` table:
- Keep conversations focused on business
- Steer away from irrelevant topics
- Custom instruction sets

### Key Files

- `server/openai.ts` - OpenAI client & helpers
- `server/conversationalScheduling.ts` - Booking AI
- `server/damageAssessment.ts` - Photo analysis
- `server/services/gptPersonalizationService.ts` - Personalization
- `server/services/supportAssistantService.ts` - Support AI
- `server/channelFormatters.ts` - Multi-channel response formatting

---

## Scheduling & Appointments

### Booking Flow

1. **Availability Check**: Google Calendar + service limits
2. **Weather Risk**: Open-Meteo API for outdoor services
3. **Conflict Detection**: Prevent double-booking
4. **Appointment Creation**: Database + Google Calendar sync
5. **Confirmation SMS**: Automated with details

### Smart Availability L2

AI suggests multiple time slots with:
- Individual booking URLs per slot
- "View All Available Times" calendar link
- Funnel analytics tracking

### Booking Confirmation System

For appointments 14+ days out:
1. SMS reminders at 7 days and 48 hours before
2. Customer responds CONFIRM or RESCHEDULE
3. Unconfirmed bookings auto-cancelled 24h before

### Recurring Services

Frequency options:
- Weekly, biweekly, monthly
- Every 2/3/6 months, quarterly, yearly
- First/15th/last of month
- Custom dates

### Key Files

- `server/calendarAvailability.ts` - Availability logic
- `server/googleCalendarConnector.ts` - Google Calendar
- `server/services/bookingDraftService.ts` - Draft bookings
- `server/services/smsBookingRecordService.ts` - Confirmation tracking
- `server/services/weatherRisk.ts` - Weather assessment

---

## Loyalty & Rewards

### Point System

- Customers earn points on service completion
- Points can be redeemed for reward offers
- 12-month expiration on points

### Loyalty Tiers

| Tier | Threshold | Benefits |
|------|-----------|----------|
| Bronze | 0 | Base rewards |
| Silver | 500 | 5% bonus points |
| Gold | 1500 | 10% bonus, priority booking |
| Platinum | 5000 | 15% bonus, VIP perks |

### Referral System

**9 Reward Types:**
1. Loyalty Points
2. Fixed Discount ($)
3. Percent Discount (%)
4. Service Credit
5. Free Add-on
6. Tier Upgrade
7. Priority Booking
8. Milestone Reward
9. Gift Card

**Referral Flow:**
1. Customer shares referral code
2. New customer uses code at booking
3. On first service completion:
   - Referee gets reward (e.g., $25 off)
   - Referrer gets reward (e.g., 500 points)

### QR Code System

HMAC-SHA256 signed tokens for:
- Customer identification
- Rewards access
- Booking deep links

### Key Files

- `server/loyaltyService.ts` - Core loyalty logic
- `server/loyaltyApi.ts` - Loyalty endpoints
- `server/referralService.ts` - Referral handling
- `server/referralConfigService.ts` - Referral configuration
- `server/services/promoEngine.ts` - Promotional campaigns
- `server/gamificationService.ts` - Achievements

---

## Billing & Payments

### Stripe Integration

**Features:**
- Payment Intents for one-time charges
- Subscription management for tenants
- Payment Links for deposits/invoices
- Webhook handling for events
- Customer/subscription sync

### Invoice System

- PDF generation (PDFKit)
- Email delivery with payment links
- HMAC-signed secure payment URLs
- Gift card application at checkout
- Referral discount application

### Square Integration

**Gift Cards:**
- Sync gift cards from Square POS
- Validate and redeem at checkout
- Balance tracking

### Dunning Automation

- Track overdue days
- Automated reminder emails
- Suspension after threshold
- Failed payment attempt tracking

### Key Files

- `server/services/stripeService.ts` - Stripe operations
- `server/services/stripeBillingService.ts` - Subscription billing
- `server/routes.stripeWebhooks.ts` - Webhook handlers
- `server/invoiceService.ts` - Invoice generation
- `server/services/giftCardSquareService.ts` - Square gift cards
- `server/services/billingService.ts` - Billing logic
- `server/services/nightlyDunningService.ts` - Dunning automation

---

## Usage Tracking & Metering

### Usage Types Tracked

| Channel | Direction | Rate |
|---------|-----------|------|
| SMS | Inbound/Outbound | Per segment |
| MMS | Inbound/Outbound | Per message |
| Voice | Minutes | Per minute |
| Email | Sent | Per email |
| AI | Tokens | Per token |

### Cost Calculation

Per-channel cost breakdown stored in `usage_rollups_daily`:
- `sms_cost_cents`
- `mms_cost_cents`
- `voice_cost_cents`
- `email_cost_cents`
- `ai_cost_cents`

### Usage Visibility

- Tenant owners see their usage dashboard
- Root admins see system-wide usage
- Cost estimates per feature

### Key Files

- `server/services/usageMeteringService.ts` - Event recording
- `server/services/usageCollectorService.ts` - Data collection
- `server/services/usageRollupService.ts` - Aggregation
- `server/routes.usageLedger.ts` - Ledger endpoints
- `server/routes.usageTransparencyV2.ts` - Usage dashboard API

---

## Public Website Generator

### Phase 9 Feature

Each tenant gets a generated public website at:
- `/site/{subdomain}` (platform subdomain)
- Custom domain support

### Features

- Hero section with branding
- Services catalog
- Booking CTAs
- Rewards program showcase
- Contact information
- Testimonials (optional)
- FAQ section (optional)
- Gallery (optional)

### Theming

SP-24 Theme System:
- Multiple theme templates
- Customizable colors
- Layout options per section

### Key Files

- `server/routes.publicSite.ts` - Public site API
- `server/routes.publicSiteAdmin.ts` - Admin configuration
- `server/routes.publicSiteTheme.ts` - Theme management
- `client/src/pages/PublicSite.tsx` - Public site component
- `client/src/pages/admin-public-site-settings.tsx` - Settings UI

---

## Technician Management

### Features

- Technician profiles with photos/bios
- AI bio coach for profile optimization
- Shift scheduling and management
- Clock in/out with GPS verification
- PTO request/approval workflow
- Shift trade requests
- Job assignment and tracking

### On-The-Way Notifications

When technician updates status to "on_site":
- Automatic SMS to customer
- Optional technician photo inclusion
- ETA information

### Key Files

- `server/routes.techProfiles.ts` - Profile management
- `server/routes.aiBioCoach.ts` - AI bio assistance
- `client/src/pages/technician.tsx` - Technician portal
- `client/src/pages/TechnicianSchedule.tsx` - Schedule view

---

## Admin & Root Features

### Tenant Admin (Owner)

- Customer database management
- Appointment scheduling
- Message center (all channels)
- Analytics dashboard
- Settings configuration
- Billing/subscription management

### Root Admin (Platform Owner)

- Multi-tenant management
- Tenant impersonation
- System-wide usage overview
- Platform suggestions review
- Industry pack management
- Support ticket handling

### Key Admin Pages

| Page | Purpose |
|------|---------|
| `/admin/tenants` | Tenant list & management |
| `/admin/tenants/:id` | Tenant detail view |
| `/admin/billing` | System billing overview |
| `/admin/sms-analytics` | SMS campaign analytics |
| `/admin/port-recovery` | Recovery campaign management |
| `/admin/industry-packs` | Industry template editor |
| `/admin/suggestions` | Platform feedback |

### Demo Mode

Safe sandbox environment:
- `platform_settings.demo_mode_enabled`
- Write operations blocked
- Safe for showcasing

---

## External Integrations

### Installed & Configured

| Integration | Purpose | Key Files |
|-------------|---------|-----------|
| **Stripe** | Payments, subscriptions | `server/services/stripeService.ts` |
| **OpenAI** | AI/LLM features | `server/openai.ts` |
| **Twilio** | SMS, Voice, IVR | `server/twilioClient.ts` |
| **SendGrid** | Email delivery | `server/emailService.ts` |
| **Google Calendar** | Scheduling | `server/googleCalendarConnector.ts` |
| **Google Sheets** | Customer database, KB | `server/googleSheetsConnector.ts` |
| **Google Maps** | Geocoding, travel time | `server/googleMapsApi.ts` |
| **Square** | Gift cards | `server/services/giftCardSquareService.ts` |
| **Slack** | Internal alerts | `server/alertService.ts` (optional) |

### OAuth Configuration

Google OAuth for:
- Calendar access
- Drive access (photos)
- Sheets access

---

## Frontend Architecture

### Page Structure

Pages organized in `client/src/pages/`:
- Public pages (no auth)
- Auth-protected pages
- Admin pages
- Settings pages
- Customer portal pages

### Key Contexts

| Context | Purpose |
|---------|---------|
| `PwaContext` | PWA install prompts |
| `ThemeContext` | Dark/light mode |
| `UiExperienceContext` | Simple/Advanced mode |
| `DashboardPreferencesContext` | Dashboard customization |

### Component Library

shadcn/ui components in `client/src/components/ui/`:
- Full shadcn component set
- Custom extensions as needed

### State Management

- TanStack Query for server state
- React Hook Form for forms
- No global state library (intentional)

### Key Frontend Files

- `client/src/App.tsx` - Route definitions
- `client/src/lib/queryClient.ts` - Query configuration
- `client/src/hooks/` - Custom hooks
- `client/src/contexts/` - React contexts

---

## Key File Locations

### Backend Structure

```
server/
├── index.ts              # Express app entry
├── routes.ts             # Main API routes
├── routes.*.ts           # Feature-specific routes (60+ files)
├── services/             # Business logic (80+ files)
├── middleware/           # Express middleware
├── ai/                   # AI-related modules
├── sms/                  # SMS-related modules
├── cache/                # Caching utilities
├── config/               # Configuration
├── migrations/           # Database migrations
├── seed/                 # Seed data scripts
├── security/             # Security modules
├── tests/                # Backend tests
├── usage/                # Usage tracking
├── utils/                # Utility functions
├── db.ts                 # Database connection
├── tenantDb.ts           # Tenant isolation wrapper
├── tenantMiddleware.ts   # Tenant context middleware
├── sessionMiddleware.ts  # Session configuration
├── openai.ts             # OpenAI integration
├── twilioClient.ts       # Twilio integration
├── emailService.ts       # Email integration
└── storage.ts            # Storage interface
```

### Frontend Structure

```
client/src/
├── App.tsx               # Route definitions
├── main.tsx              # Entry point
├── pages/                # Page components (100+ files)
├── components/           # Shared components
│   ├── ui/               # shadcn components
│   └── ...               # Custom components
├── hooks/                # Custom hooks
├── contexts/             # React contexts
├── lib/                  # Utilities
│   ├── queryClient.ts    # TanStack Query config
│   └── utils.ts          # Helper functions
└── config/               # Frontend configuration
```

### Shared

```
shared/
└── schema.ts             # Database schema + types (5,194 lines)
```

### Configuration

```
├── package.json          # Dependencies
├── tsconfig.json         # TypeScript config
├── vite.config.ts        # Vite bundler config
├── tailwind.config.ts    # Tailwind CSS config
├── drizzle.config.ts     # Drizzle ORM config
├── .env                  # Environment variables
└── replit.md             # Project documentation
```

---

## Environment Variables

### Required Secrets

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection |
| `SESSION_SECRET` | Express session encryption |
| `OPENAI_API_KEY` | OpenAI API access |
| `TWILIO_ACCOUNT_SID` | Twilio account |
| `TWILIO_AUTH_TOKEN` | Twilio authentication |
| `SENDGRID_API_KEY` | SendGrid email |
| `STRIPE_SECRET_KEY` | Stripe payments |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook verification |
| `GOOGLE_CLIENT_ID` | Google OAuth |
| `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `VAPID_PUBLIC_KEY` | Push notifications |
| `VAPID_PRIVATE_KEY` | Push notifications |

### Optional Configuration

| Variable | Purpose |
|----------|---------|
| `SMS_AGENT_MODEL` | OpenAI model for SMS |
| `PLATFORM_BG_JOBS_ENABLED` | Enable background jobs |
| `ENABLE_SHEETS_CUSTOMER_AUTO_SYNC` | Auto-sync from Sheets |
| `NODE_ENV` | Environment (development/production) |

---

## Background Jobs

### Cron Jobs (when `PLATFORM_BG_JOBS_ENABLED=1`)

| Job | Schedule | Purpose |
|-----|----------|---------|
| Booking Confirmation Monitor | Hourly | Send confirmation reminders |
| Sheets Customer Auto-Sync | 15 min | Sync customers from Sheets |
| Nightly Dunning | Daily | Process overdue invoices |
| Weather Scheduler | Daily | Update weather forecasts |
| Reminder Service | Periodic | Send service reminders |

### Key Files

- `server/services/bookingConfirmationMonitor.ts`
- `server/services/sheetsCustomerAutoSyncService.ts`
- `server/services/nightlyDunningService.ts`
- `server/weatherScheduler.ts`
- `server/reminderService.ts`

---

## Health Checks

### Endpoints

- `GET /healthz` - Basic health check (Cloud Run)
- `GET /api/health` - Detailed health status

### External Service Monitoring

`service_health` table tracks:
- Status: healthy/degraded/down
- Last check time
- Consecutive failures
- Response times

---

## Development Workflow

### Database Changes

1. Modify `shared/schema.ts`
2. Run `npm run db:push` (or `--force` if data loss warning)
3. Never write manual migrations

### Starting the App

```bash
npm run dev
```

This starts:
- Express backend (API + static serving)
- Vite dev server (HMR for frontend)
- Bound to port 5000

### Testing

```bash
npm test        # Run tests
npm run lint    # Lint code
```

---

*Document Version: 1.0*
*Created: December 2025*
*Last Updated: December 2025*
