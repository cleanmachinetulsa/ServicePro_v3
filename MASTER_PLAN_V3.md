# MASTER PLAN v3.2 – SERVICEPRO MULTI-TENANT SUPER-SYSTEM
Deprecated – see MASTER_PLAN_v3.2.md for the latest master plan.
> Canonical master plan for:
> - You (Jody)
> - Your partner
> - Replit AI agents
> - Future contributors  
>
> This file is the **source of truth**. All major changes to architecture, features, or roadmap get reflected here.

---

## 0. HIGH-LEVEL NORTH STAR

**Product:** Turn the existing Clean Machine app into **ServicePro** – a multi-tenant, white-label, AI-powered service business OS.

- **Clean Machine** = **root tenant** (your business, flagship instance).
- Other businesses (detailers, lawn care, cleaners, pet groomers, etc.) = **child tenants**.

All share:

- One codebase  
- One Twilio **super-tenant** architecture  
- One AI brain (general framework) customized per industry & per tenant  

Each tenant gets:

- Their **own phone number(s)**
- Their **own SMS/voice/IVR experience**
- Their **own branding, services, pricing, and website**
- Their **own AI agents**:
  - Onboarding/setup agent  
  - Customer booking agent  
  - Customer support / help agent  

**MASTER PLAN v3.x** = Take your current **Clean Machine** codebase and layer on:

1. True tenant isolation (Phase 1A–1H – ✅ DONE for root; ready for more tenants).
2. Super-tenant telephony (Twilio, SIP, IVR, AI voice) with **single-number IVR flows** that are easy for tenants.
3. Tiered SaaS product (3 tiers) + trials.
4. White-label onboarding + industry packs + website generator.
5. Built-in AI agents (onboarding, booking, support) per tenant.
6. Automated provisioning & billing with Stripe.
7. Root “super-tenant” dashboard + tenant registry admin UI.
8. Safe suspension / data retention / export so no one loses their business data.
9. A consistent, **premium PWA call & app experience** so tenants don’t suffer Twilio/dialer hell.
10. Optional **premium voice models** (OpenAI / ElevenLabs) on top of included free Polly voices.

---

## 1. CURRENT STATE SNAPSHOT (BASED ON REPO)

### 1.1 Clean Machine Repo (Current Reality)

From the exported repo:

**Backend**

- `server/index.ts` – Express + TypeScript  
- Drizzle ORM + Neon/Postgres  
- Many route files: calls, appointments, loyalty, campaigns, etc.

**Schema**

- `shared/schema.ts` – tables for customers, appointments, invoices, loyalty, etc.

**Frontend**

- Vite/React app  
- Pages & components for scheduling, SMS, dashboards, settings, etc.

**Docs & Guides**

- `WHITE_LABEL_GUIDE.md` – feature inventory & white-label thinking  
- `TWILIO_SETUP_GUIDE.md`, `TWILIO_WEBHOOK_SETUP.md`, `TWILIO_VOICE_SETUP.md`, `VOICE_WEBHOOK_SETUP.md`  
- Various deployment & QA docs under `docs/`

**Telephony / comm routes**

- `server/routes.twilioVoice.ts`
- `server/routes.voiceWebhook.ts`
- `server/routes.smsFallback.ts`
- `server/routes.calls.ts`
- `server/routes.phoneSettings.ts`
- `server/routes.twilioStatusCallback.ts`
- Plus SMS consent, campaigns, appointments, notifications, etc.

**Business logic routes**

- Appointments, quick booking, quotes, cancellations, refunds, subscriptions  
- Loyalty & rewards: `routes.loyalty.ts`, `routes.invoice.loyalty.ts`, `loyaltyService`, `googleLoyaltyIntegration`, etc.  
- Tags, tech profiles, contacts, gallery, recurring services, calendars, etc.

**AI / automation bits already present**

- `conversationClassifier.ts`
- `conversationState.ts`
- `aiSuggestionService.ts`
- `damageAssessment*`, `roleAwareNotifications.ts`, etc.

**Knowledge base / admin artifacts**

- `Master_CleanMachine_AgentKnowledgeBase_AutoReady.xlsx`
- `HOMEPAGE_FEATURE_INVENTORY.md`
- PWA docs
- Deployment checklists & improvement plans

➡️ **Key point:** Clean Machine is now a **seriously feature-rich single-tenant system** with Twilio, SendGrid, Stripe, loyalty, PWA, etc.

---

### 1.2 Tenant Isolation Package (ServicePro Backbone)

The tenant isolation / ServicePro backbone introduces:

- `tenantDb` wrapper (Drizzle wrapper that injects `tenant_id`)
- `tenantMiddleware` that attaches `req.tenant` and `req.tenantDb`
- Tenant isolation tests (11 tests)
- A migration plan to move routes from `db` → `req.tenantDb`

Pattern:

```ts
// BEFORE
await db.query.customers.findFirst({
  where: eq(customers.id, id),
})

// AFTER
await req.tenantDb.query.customers.findFirst({
  where: req.tenantDb.withTenantFilter(customers, eq(customers.id, id)),
})
➡️ This package is now applied directly to Clean Machine (no separate ServicePro repo).

Phase 1A–1H migrated ~800+ DB operations across ~86 files.
All tenant isolation tests pass. Root tenant (tenant_id = 'root') is fully working.

2. PHASE STRUCTURE (MASTER ROADMAP)
Clear phase structure so you + partner + Replit agents can collaborate:

Phase 0 – Canonicalization & Docs

Phase 1 – Tenant Isolation & Multi-Tenant Core

Phase 2 – Telephony Spine (SMS, Voice, SIP, IVR)

Phase 2.1 – Canonical Voice Entry-Point ✅ DONE

Phase 2.2–2.4 – IVR / AI routing

Phase 2.5 – Call handling & PWA experience

Phase 2A – Tenant Registry & Admin UI ✅ DONE

Phase 3 – AI Messaging Brain & Knowledge Base

Phase 4 – AI Voice Receptionist & Call Handling

Phase 5 – SaaS Tiers, Onboarding Agents, Website Generator

Phase 6 – Industry Packs & Auto-Setup

Phase 7 – Super-Tenant Ops (Billing, Monitoring, Scaling)

Phase 8 – Tiers, Upgrades, Usage Billing (details)

Phase 9 – Telephony Model & Twilio UX (details)

Phase 10 – AI Setup & Support Agents (product-aware copilot)

Phase 11 – Data Export & Retention

Phase 12 – Integrations & Keys Checklist

Phase 13 – Idea Parking Lot / Future Enhancements

Each phase has:

Goals

What’s already done (if applicable)

Concrete tasks Replit can execute

Where the new features plug in (agents, website generator, tiers, telephony)

PHASE 0 – CANONICALIZE & ORGANIZE (NOW)
0.1 MASTER_PLAN_V3.md (THIS FILE)
Lives at repo root.

Canonical reference for:

You & partner

Replit agents

Future devs

Rule: Whenever a major architecture decision is made (new tier logic, new agent type, website generator spec, billing behavior, telephony UX, voice model options), update this file.

0.2 ServicePro Backbone as Migration Package
Treat tenant isolation docs (servicepro-backbone.md, TENANT_ISOLATION_IMPORT.md, etc.) as inputs to Phase 1, not a second codebase.

No separate ServicePro repo.

Clean Machine becomes ServicePro over time.

Tenant isolation steps & tests are applied directly here.

PHASE 1 – TENANT ISOLATION & MULTI-TENANT CORE
1.1 Tenant Infrastructure ✅ DONE
Implemented in server/:

server/tenantDb.ts

Wraps base Drizzle client (db).

Injects tenant_id on inserts.

Provides withTenantFilter(table, condition) for selects/updates/deletes.

server/tenantMiddleware.ts

Resolves tenantId:

For now: hardcode 'root' for all Clean Machine traffic.

Later: use domain/subdomain/headers to map to tenant.

Attaches req.tenant and req.tenantDb.

Test infra

server/tests/setupTenantDb.ts

server/tests/tenantIsolation/tenantDb.test.ts

vitest.config.ts updated to include tests.

Verification:

bash
Copy code
npx vitest run server/tests/tenantIsolation/tenantDb.test.ts
✅ 11/11 tests passing.

1.2 Route Migration to req.tenantDb ✅ DONE (CURRENT SCOPE)
For each server/routes.*.ts:

Removed import { db } from './db' (or ../db) where not explicitly allowed.

Replaced db. usage with req.tenantDb..

Wrapped conditions with withTenantFilter for SELECTs:

ts
Copy code
await req.tenantDb.query.customers.findFirst({
  where: req.tenantDb.withTenantFilter(customers, eq(customers.id, id)),
});
Core routes migrated across Phases 1A–1H:

routes.appointments.ts

routes.quickbooking.ts

routes.calls.ts

routes.twilioVoice.ts

routes.smsFallback.ts

routes.contacts.ts

routes.notifications.ts

Loyalty, invoices, campaigns, and many others.

Background jobs use:

ts
Copy code
const tenantDb = wrapTenantDb(db, 'root');
and tenant enumeration where needed.

1.3 DB Schema & Tenants
In shared/schema.ts:

Core tables have tenantId (NOT NULL, default 'root' where needed):

customers, appointments, vehicles, invoices, campaigns, conversations, sms_templates, banners, etc.

tenants table:

ts
Copy code
export const tenants = pgTable('tenants', {
  id: varchar('id').primaryKey(),   // 'root', 'tenant-xxxx'
  name: varchar('name').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  // later: domain, plan, branding, etc.
});
sms_templates unique constraint is composite per tenant:

sql
Copy code
UNIQUE (tenant_id, template_key)
Root tenant (Clean Machine):

Has tenant_id = 'root' for all existing data.

Background jobs enumerate all tenants but currently only find 'root'.

1.4 Phase 2A – Tenant Registry & Admin UI ✅ DONE
This sits conceptually between Phase 1 (multi-tenant core) and later phases.

DB Changes

New enum type: tenant_tier: 'starter' | 'pro' | 'elite'

New table: tenant_config

ts
Copy code
export const tenantConfig = pgTable('tenant_config', {
  tenantId: varchar('tenant_id')
    .references(() => tenants.id)
    .primaryKey(),
  businessName: varchar('business_name').notNull(),
  logoUrl: text('logo_url'),
  primaryColor: varchar('primary_color').default('#3b82f6'),
  tier: tenantTierEnum('tier').default('starter').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
Seeded root tenant config:

tenantId = 'root'

businessName = 'Clean Machine Auto Detail'

tier = 'elite'

Backend

New file: server/routes.adminTenants.ts

Admin endpoints (owner role required):

GET /api/admin/tenants – list all tenants with config

GET /api/admin/tenants/:id – single tenant details

POST /api/admin/tenants – create tenant + config (transactional)

PATCH /api/admin/tenants/:id – partial updates (only provided fields)

DELETE /api/admin/tenants/:id – delete tenant (root protected)

Security:

All routes require auth + owner role.

Root tenant cannot be modified or deleted.

Zod validation.

Transactions for create.

Frontend

New page: client/src/pages/AdminTenants.tsx

Features:

Grid layout of tenant cards with tier badges (color-coded).

“Create tenant” dialog with validation.

Displays tenant id, business name, subdomain (if present), tier, created date.

Visual indicators for root tenant (shield icon + “Root/Flagship” badge).

Responsive layout + loading/empty states.

Uses TanStack Query + shadcn/ui components.

Wiring:

server/routes.ts – registerAdminTenantRoutes(app)

client/src/App.tsx – route /admin/tenants guarded by <AuthGuard>.

Status:

✅ All tasks completed and architect-reviewed.

✅ Server running clean.

✅ All tenant isolation tests still passing.

PHASE 2 – TELEPHONY SPINE (SMS, VOICE, SIP, IVR)
Goal: A clean, unified telephony core that supports:

SMS automations (existing)

Voice / IVR

SIP → Groundwire / in-app call handling

Future per-tenant phone configs

Single-number experience for tenants (no Twilio hell).

2.1 Canonical Voice Entry-Point ✅ DONE
Endpoint:

POST /twilio/voice/incoming

Implemented in: server/routes.twilioVoiceCanonical.ts

This is now the single canonical entry-point for inbound voice calls.

Current behavior:

Verifies Twilio signatures for security.

Resolves tenant (for now, still 'root').

Performs simple SIP forwarding to:

xml
Copy code
<Response>
  <Dial callerId="{From}">
    <Sip>jody@cleanmachinetulsa.sip.twilio.com</Sip>
  </Dial>
</Response>
Caller ID is passed through.

Tests:

server/tests/twilioVoiceCanonical.test.ts – ✅ all tests passing.

Scenarios: valid/invalid signatures, missing fields, SIP forwarding behavior, error handling.

Docs:

PHASE_2_1_CANONICAL_VOICE.md – implementation details + migration notes.

replit.md – updated overview & how to hit /twilio/voice/incoming.

Status:

✅ Canonical voice route live and ready for root tenant.

✅ Twilio can be pointed directly at this now.

2.2 tenantPhoneConfig Table ✅ DONE
In shared/schema.ts:

ts
Copy code
export const tenantPhoneConfig = pgTable('tenant_phone_config', {
  id: varchar('id').primaryKey(),
  tenantId: varchar('tenant_id')
    .references(() => tenants.id)
    .notNull(),
  phoneNumber: varchar('phone_number').notNull(),      // Twilio number (E.164)
  messagingServiceSid: varchar('messaging_service_sid'),
  sipDomain: varchar('sip_domain'),
  sipUsername: varchar('sip_username'),
  sipPasswordEncrypted: varchar('sip_password_encrypted'),
  ivrMode: varchar('ivr_mode').default('simple'),      // 'simple' | 'ivr' | 'ai-voice'
  createdAt: timestamp('created_at').defaultNow(),
});
Root tenant row:

tenantId = 'root'

phoneNumber = <your 918 number>

sipDomain, sipUsername set for Groundwire.

ivrMode = 'simple' initially.

Future tenants:

Each gets their own row with their own number + IVR mode.

2.3 Single-Number IVR Pattern (Design + Implementation Target)
Key principle: Each tenant should be able to do everything with one business number:

IVR menu:

“Press 1 for info”

“Press 2 to talk”

“Press 3 for voicemail”

“Press 7 for a joke / easter egg”

SMS follow-up:

Press 1 sends link/pricing.

Forward to a cell/SIP:

Press 2 forwards to their chosen phone.

Voicemail capture:

Press 3 records a message.

Twilio does not require separate numbers for these actions.

Recommended default IVR pattern for ServicePro tenants:

Press 1 – “Tell me about your services”

Play a short info message.

Send SMS with price sheet / website link / booking form.

Press 2 – “Talk to a person”

Forward to their primary business phone (or SIP endpoint).

Same number handles IVR and live call.

Press 3 – “Leave a message”

Record voicemail.

Email or SMS the tenant/owner a link to the recording.

Press 7 – “Easter egg / joke” (optional)

Fun differentiator (Clean Machine-style) they can turn on/off.

For root tenant, this mirrors your current usage but cleans it up and removes the need for a second number (like the 5711 scenario).

Implementation idea:

Extend canonical endpoint so it:

Reads tenantPhoneConfig.ivrMode.

If 'simple': direct SIP forwarding (as now).

If 'ivr': IVR logic (Press 1/2/3/7).

If 'ai-voice': hand off to AI voice gateway (Phase 4).

2.4 SIP → Groundwire Flow (Your Own Calls)
For your business (root tenant):

Twilio number → /twilio/voice/incoming → TwiML:

xml
Copy code
<Response>
  <Dial callerId="{From}">
    <Sip>jody@cleanmachinetulsa.sip.twilio.com</Sip>
  </Dial>
</Response>
Groundwire setup:

SIP domain: cleanmachinetulsa.sip.twilio.com

Username: jody

Custom ringtone to mark business calls.

Goal:

You answer calls like a human, with proper caller ID and custom ringtone.

Over time, you can blend:

Live answering

AI voice receptionist

SMS follow-ups

2.5 Call Handling & PWA Experience (Roadmap)
Problem (current reality):

Right now you have to use a third-party dialer and manual SIP setup to get:

Caller ID passthrough

Custom ringer

This is friction and feels non-premium.

ServicePro objective:

Make call handling feel like a real product, not a wiring project.

Short-term “good” (v1)
Platform-managed Twilio number per Pro/Elite tenant.

Default IVR pattern (Press 1 info/SMS, Press 2 talk, Press 3 voicemail).

Forward-to-cell as default for “Press 2”:

No SIP config required for most tenants.

Caller ID passthrough via Twilio <Dial> with proper callerId.

Admin UI to set:

Primary call forwarding number.

Business hours (after-hours → voicemail).

Toggle IVR vs direct dial.

Medium-term “better”
Offer optional SIP/softphone mode for advanced tenants:

Generate SIP credentials for them.

Provide step-by-step guided setup for a recommended softphone app (like Groundwire) but:

No Twilio console.

All info in a single “Connect Your SIP App” page.

QR-code or simple copy-paste config.

Tenants never log into Twilio; ServicePro acts like the carrier.

Long-term “best” – ServicePro PWA Call Console
Build a ServicePro PWA call console with:

Full-screen PWA with:

Incoming call UI (caller name from CRM).

Custom ringtone.

Accept / decline / send-to-voicemail buttons.

“Open customer record” quick action.

Uses:

WebRTC (or similar) for in-browser/iPad audio.

Your telephony backend as signaling/origin.

PWA behaviors:

“Add to Home Screen” prompts with branded icon.

Fullscreen mode on launch / long-press.

Persistent login for techs/owners.

Clean offline states.

Ladder:

Phase 2: “Works great with phone forwarding”

Phase 2.5+: “Optional SIP app with guided setup”

Phase X: “Native-feeling PWA call console”

All aligned with the white-label, premium ServicePro story.

2.6 Voice Models & Providers (Polly, OpenAI, ElevenLabs)
Goal: Give tenants a simple voice tier ladder:

Included: solid free voices (Polly / Twilio default).

Premium optional: higher-end voices (OpenAI / ElevenLabs) as add-ons.

Architecture:

Central voiceProviderConfig (later table or JSON) per tenant:

ts
Copy code
interface TenantVoiceConfig {
  provider: 'polly' | 'openai' | 'elevenlabs';
  voiceId: string; // e.g. 'Joanna', 'gpt-voice-1', 'elevenlab-xyz'
  billingTier: 'included' | 'premium';
}
Phase 4 (AI Voice) & IVR TTS both use:

getVoiceConfig(tenantId) → returns:

TTS API to call (Polly / OpenAI / ElevenLabs).

Specific voice ID.

Whether it’s included or billable/premium.

Product stance:

Base tiers (Starter/Pro):

Use included Twilio/Polly-level voices (no extra cost).

Elite / add-on:

Unlock OpenAI / ElevenLabs voices.

Potentially small per-tenant surcharge or usage-based fee.

Tenants never see the wiring – they just pick “Standard” vs “Premium natural voice” in settings; you manage actual providers.

PHASE 3 – AI MESSAGING BRAIN & KNOWLEDGE BASE
(Concept unchanged; restated cleanly.)

3.1 Core “Agent Brain” Service
Create server/aiAgent.ts with a single main entry:

ts
Copy code
type AgentChannel = 'sms' | 'web' | 'voice';

interface AgentRequest {
  tenantId: string;
  channel: AgentChannel;
  userRole: 'customer' | 'owner' | 'staff';
  messageText: string;
  conversationId?: number;
  phoneNumber?: string;
  context?: Record<string, any>; // current route, last action, etc.
}

interface AgentResponse {
  replyText: string;
  nextActions?: Array<{
    type: 'book' | 'reschedule' | 'collect_info' | 'handoff' | 'confirm';
    payload?: any;
  }>;
}

export async function handleAgentMessage(
  req: AgentRequest
): Promise<AgentResponse> {
  // Look up tenant config, KB, services, policies, etc.
}
All SMS / web chat / (later voice) routes call this instead of embedding logic.

3.2 Knowledge Base Integration
Seed from:

Master_CleanMachine_AgentKnowledgeBase_AutoReady.xlsx

WHITE_LABEL_GUIDE.md

FAQ content

Service definitions

Policies (rain, cancellations, deposits, etc.)

Design:

Global base knowledge (for all tenants).

Tenant-specific overrides (services, prices, policies).

Later: industry pack overlays (detailing vs lawn care vs house cleaning, etc.).

3.3 Customer Booking Agent (Per Tenant, Customer-Facing)
Responsibilities:

Answer:

“What do you offer?”

“How much?”

“How long?”

“Do you travel to X?”

Drive toward bookings:

Vehicle/job details

Service type

Location & service area checks

Scheduling

Upsells (protectant, coating, maintenance plans, etc.)

Channels:

SMS (Twilio)

Web chat widget

Future: voice calls (Phase 4)

Relies on:

Tenant services & pricing from DB

Tenant preferences (upsell config, policies)

Availability engine (calendar/appointments)

PHASE 4 – AI VOICE RECEPTIONIST (OPENAI REALTIME)
Goal: Take the AI messaging brain and surface it as a real voice receptionist.

4.1 Voice Gateway Service
Implement server/voiceGateway.ts:

Handles Twilio <Stream> WebSocket.

Connects to OpenAI Realtime API.

Streams audio → text → handleAgentMessage.

Streams text → TTS audio → Twilio.

Call flow:

Caller dials tenant’s number.

Twilio hits /twilio/voice/incoming.

If ivrMode = 'ai-voice':

TwiML <Connect><Stream> → wss://your-server/voice-gateway.

Voice gateway:

Connects to OpenAI Realtime.

Feeds transcripts into handleAgentMessage.

Speaks replies back using chosen voice provider (Polly/OpenAI/ElevenLabs via TenantVoiceConfig).

4.2 Reuse Booking Flow Logic
Voice agent uses the same steps as SMS booking:

Greet

Service type

Vehicle/job & condition

Water/power (if relevant)

Address & service area check

Offer slots

Confirm & book

SMS confirmation

No duplicated logic – just different channel.

PHASE 5 – SAAS TIERS, ONBOARDING AGENTS, WEBSITE GENERATOR
(Same core as v3.1, with tenant_config already in place.)

5.1 Tier Model (3 Tiers)
tenants table gains plan + status:

ts
Copy code
export const tenants = pgTable('tenants', {
  id: varchar('id').primaryKey(),
  name: varchar('name').notNull(),
  planTier: varchar('plan_tier').default('starter'),
  status: varchar('status').default('trialing'), // 'active' | 'trialing' | 'past_due' | 'suspended' | 'cancelled'
  // later: trialEndsAt, etc.
});
Billing metadata:

ts
Copy code
export const tenantBilling = pgTable('tenant_billing', {
  tenantId: varchar('tenant_id').references(() => tenants.id).primaryKey(),
  stripeCustomerId: varchar('stripe_customer_id'),
  stripeSubscriptionId: varchar('stripe_subscription_id'),
  subscriptionStatus: varchar('subscription_status'),
  latestInvoiceStatus: varchar('latest_invoice_status'),
  lastPaymentAt: timestamp('last_payment_at'),
});
Feature gates (example):

ts
Copy code
export const TIER_FEATURES = {
  starter: {
    aiSmsAgent: false,
    aiVoiceAgent: false,
    dedicatedNumber: false,
    campaigns: false,
    dataExport: true,
    websiteGenerator: true, // maybe limited templates
  },
  pro: {
    aiSmsAgent: true,
    aiVoiceAgent: false,
    dedicatedNumber: true,
    campaigns: true,
    dataExport: true,
    websiteGenerator: true,
  },
  elite: {
    aiSmsAgent: true,
    aiVoiceAgent: true,
    dedicatedNumber: true,
    campaigns: true,
    dataExport: true,
    websiteGenerator: true,
  },
} as const;
Helper:

ts
Copy code
function hasFeature(
  tenant: TenantRow,
  key: keyof typeof TIER_FEATURES['starter']
) { ... }
Used everywhere to gate features in UI & backend.

5.2 Onboarding Agents (Tenant Setup Agents)
Starter Tier Onboarding Agent (more DIY/BYO)

Helps with:

Basic services & pricing setup.

Service area definition.

Basic booking rules.

Optional BYO Twilio/SendGrid (advanced).

Tone:

Slightly more technical is OK.

Explains why each setting matters.

Pro / Elite Onboarding Agent (Hosted – main flow)

“Shopify-like” experience:

Asks:

Business name, logo, colors, vibe.

Services offered.

Typical job length.

Service area (zips / radius).

Deposits, reminders, review requests?

Under the hood:

Provisions Twilio number (via platform account).

Sets default automations.

Seeds services & pricing (via industry pack).

Generates website (see 5.4).

Configures AI booking agent for that tenant.

UX:

Embedded in dashboard as wizard.

Uses aiAgent in admin mode with checklists.

5.3 Tenant Support Agent (In-App Support / Tech Help)
Product-aware copilot (see Phase 10), but specifically for tenant admins.

Lives inside:

Dashboard (help widget / dock).

Setup pages (“Need help?” buttons).

Knows:

Current route (e.g., /settings/notifications).

Tenant tier & enabled features.

Tenant configuration (services, calendars, numbers, etc.).

Can:

Explain features in context.

Walk through multi-step setup.

Perform safe actions (update a setting, trigger a test message).

Open a support ticket to you + partner if needed.

5.4 Website Generator (High-End, Limited Presets)
Key requirement: Not generic “meh” generators. You want ~10 high-end templates:

Modern, premium SaaS / studio look.

Use:

Clean layouts

Hover effects

Smooth transitions / micro-animations

“App-like” feel

But constrained so:

Booking buttons/links always work.

Analytics & tracking stay connected.

Layout changes don’t break logic.

Implementation:

Templates implemented in React + Tailwind under web-templates/:

LuminousConcierge

NightDriveNeon

PrestigeGrid

LocalHero

StudioMinimal

etc. (up to ~10 curated designs)

Data:

ts
Copy code
interface WebsiteSeed {
  businessName: string;
  tagline: string;
  tone: 'modern' | 'luxury' | 'local' | 'bold';
  primaryColor?: string;
  logoUrl?: string;
  services: ServiceSeed[];
  aboutBlurb: string;
  city: string;
  phoneNumber: string;
  bookingUrl: string; // tenant’s booking / request form
}
Generator:

Chooses a template (or user picks).

Fills in hero, services, FAQs, testimonials, CTAs.

Users can:

Preview templates on subdomain/dev URL.

Switch templates without breaking functionality.

Make shallow edits (copy, images, brand colors).

Partner integration:

Same WebsiteSeed object can be sent to external partner generator.

Config:

ts
Copy code
tenantConfig.websiteGeneratorMode = 'built-in' | 'partner';
tenantConfig.partnerGeneratorEndpoint = 'https://...';
Performance:

Use SSR/SSG where possible.

Lazy-load heavy images.

Keep animations tasteful & light.

5.5 Free Trial Flow (14-Day, No Credit Card)
Standard flow:

Landing page (Clean Machine / ServicePro showcase) has “Start 14-day free trial”.

Trial signup:

Name, email, business name, industry, city.

Choose plan tier (default Pro during trial).

Backend:

Creates tenant with status = 'trialing', planTier = 'pro', trialEndsAt.

Provisions default phone number (for Pro+).

Kicks off onboarding agent.

During trial:

Soft limits on SMS/calls to avoid abuse.

“Trial” badge in app.

Upsell content about full Pro benefits.

End of trial:

Stripe webhook OR internal cron.

If not upgraded:

status = 'past_due' or trial_expired.

Soft-lock functionality (see 8.3).

Data intact for easy reactivation.

PHASE 6 – INDUSTRY PACKS & AUTO-SETUP
Goal: No one should feel like they’re “setting up everything from scratch.”

6.1 Industry Packs
Implement server/industryPacks.ts:

ts
Copy code
export const industryPacks = {
  'mobile-detailing': {
    name: 'Mobile Auto Detailing',
    defaultServices: [...],
    defaultAddons: [...],
    defaultDurations: {...},
    defaultReminderRules: {...},
    faqs: [...],
    ivrScriptTemplate: 'Thanks for calling [BUSINESS_NAME]...',
    smsTemplates: {...},
    agentInstructions: [...],
  },
  'lawn-care': { ... },
  'house-cleaning': { ... },
  'window-washing': { ... },
  // etc.
};
On onboarding:

Tenant chooses industry.

System seeds:

Services & pricing.

Add-ons.

Example SMS templates.

IVR script / call routing defaults.

FAQ entries.

Website content skeleton.

6.2 Agent Configuration Per Industry
Agents adjust tone & vocabulary:

Detailing:

“paint correction”, “ceramic coating”, “interior steam extraction”.

Cleaning:

“deep clean”, “move-out clean”, “recurring weekly/bi-weekly”.

etc.

Tenant AI knowledge:

Base + industry pack + tenant overrides.

PHASE 7 – SUPER-TENANT OPS (BILLING, MONITORING, SCALING)
7.1 Billing & Plans (Stripe)
Use Stripe for subscriptions.

Map planTier to Stripe price IDs.

Stripe webhooks:

customer.subscription.created

customer.subscription.updated

invoice.payment_succeeded

invoice.payment_failed

customer.subscription.deleted

Webhook handler:

Updates tenantBilling and tenants.status.

Triggers enable/disable of features (see Phase 8).

Root dashboard:

List tenants with:

Tier

Status

Next billing date

Usage stats (messages, calls, bookings)

7.2 Monitoring & Health
Per tenant:

SMS volume

Call volume

Booking conversions

Agent conversations

Error rates

Use existing:

Health checks

Logging

Super-tenant dashboard:

“Tenant health” view.

Drill-down into a tenant’s logs/events.

7.3 Scaling & Performance
When needed:

Introduce caching for:

Tenant config

Industry packs

Queue jobs for:

Campaign sends

Heavy AI tasks

For large tenants:

Optionally move them to their own DB instance/schema using same codebase.

PHASE 8 – PLAN TIERS, UPGRADES, AND USAGE BILLING (v3.2)
8.1 Plan & Status Fields
Covered in 5.1 & 7.1; main fields:

tenants.planTier – 'starter' | 'pro' | 'elite'

tenants.status – 'active' | 'trialing' | 'past_due' | 'suspended' | 'cancelled'

tenantBilling.* – Stripe metadata

Also aligns with tenant_config.tier.

8.2 Upgrade Flow (Starter → Pro → Elite, No Re-Setup)
Flow:

Tenant clicks “Upgrade to Pro/Elite”.

Frontend calls /api/billing/upgrade with targetTier.

Backend:

Uses tenantBilling to find Stripe subscription.

Updates subscription to new price.

On success:

planTier = 'pro' | 'elite'.

Trigger provisioning (e.g., dedicated number, AI features).

Features unlock immediately via hasFeature.

No new tenant, no migration. Same data, same charts.

8.3 Handling Non-Payment (Suspend but Don’t Delete)
Principles:

Never delete tenant data just for card failure.

Suspend access, not information.

Make reactivation easy.

Policy:

On invoice.payment_failed:

Mark status = 'past_due'.

Show banner:

“There was a problem with your payment. Please update your card.”

Optionally:

Block new campaigns & scheduled outbound.

Allow read-only access + 1:1 bookings.

On long-term non-payment or subscription cancelled:

status = 'suspended'.

Allow:

Login (if you want).

Read-only dashboard.

Billing page.

Data export (see Phase 11).

Block:

New bookings (optional).

SMS/voice automations.

Campaigns.

Data retention:

Keep data for a configurable window (e.g., 6–12 months).

Later: archival / cold storage if needed.

8.4 Built-in Upgrade Nudges
To push Starter → Pro:

In-app plan card:

“Current Plan: Starter” with compare table.

Feature wall:

When they try Pro-only feature:

Modal explaining benefit and that existing setup remains intact.

Usage-based prompt:

“You’ve sent 180 SMS manually this month. Pro can automate follow-ups and reminders. [See Pro benefits]”

PHASE 9 – TELEPHONY MODEL & TWILIO UX (v3.2)
This ties together:

Canonical voice entry-point (2.1 ✅).

tenantPhoneConfig (2.2 ✅).

Single-number IVR pattern (2.3).

Forwarding/SIP/PWA flow (2.5).

Voice model options (2.6).

9.1 Core Principle: Platform-Managed by Default
For Pro / Elite tenants:

They never see Twilio.

You act as carrier:

Own Twilio account.

Provision numbers.

Handle A2P registration.

Maintain webhooks.

They see:

“Your business number: (XXX) XXX-XXXX”

Call + SMS stats.

Simple routing settings (hours, voicemail vs AI, etc.).

Starter tenants:

Optional BYO Twilio (advanced) or shared/generic number.

9.2 Provisioning Numbers for Tenants
Provisioning service provisionTenantNumber(tenantId):

Look up tenant’s location (city/area/country).

Use platform Twilio keys to:

Search for local or toll-free number.

Purchase it.

Attach webhooks:

Voice: /twilio/voice/incoming

SMS: /twilio/sms/incoming

Create/update tenantPhoneConfig row:

phoneNumber, messagingServiceSid, ivrMode = 'simple', etc.

On failure:

Log + show UI:

“We couldn’t automatically get a number in your preferred area. We’ll reach out with options.”

9.3 BYO Twilio (Advanced)
Hidden behind “Advanced” toggle in settings.

Collect:

accountSid

authToken

Optional messagingServiceSid

Validate with test calls.

Mark tenant as BYO Twilio.

All telephony flows for that tenant use their creds instead of platform’s.

Most users stay on platform-managed Twilio.

9.4 Suspension Behavior for Telephony
Based on tenants.status:

active or trialing:

Full telephony flows.

past_due:

Option A: allow inbound, block campaigns & scheduled outbound.

Option B: gradually limit usage + warnings.

suspended:

Stop automations & new outbound.

Optional inbound:

Play “account paused” message.

Keep number & config intact during retention window.

PHASE 10 – AI SETUP & SUPPORT AGENTS (PRODUCT-AWARE COPILOTS)
10.1 Concept: Product-Aware Copilot
Three layers:

Knowledge layer – product docs, screen map, feature specs, FAQs, tenant config.

Tool layer – safe actions (update settings, trigger tests, create tickets).

UX layer – embedded where needed (setup wizard, help dock, chat bubble).

10.2 Knowledge Layer
Sources:

Existing docs (WHITE_LABEL_GUIDE.md, KB sheets, etc.).

DB schema + route map.

Industry packs.

Tenant config (services, hours, numbers, tier).

We model:

Feature specs.

Screen map / UI flow.

Setup playbooks:

“Onboard solo detailer”

“Onboard cleaning business”

“Connect calendar”

Troubleshooting trees:

“My SMS aren’t sending”

“Appointments aren’t showing on technician iPad”

“My calls don’t ring in the app”

Stored as:

Structured JSON/DB for tools.

Vector store for free-text search.

10.3 Tool Layer (Safe Actions)
Examples:

Read-only:

get_tenant_profile(tenantId)

get_enabled_features(tenantId)

get_error_logs(tenantId, timeframe)

search_docs(query)

Actions:

update_setting(tenantId, key, value)

enable_feature(tenantId, featureKey) (if tier allows)

trigger_onboarding_flow(tenantId, flowType)

create_support_ticket(tenantId, userId, summary, details)

Rules:

Write actions are narrow and whitelisted.

Risky stuff (deletions, downgrades):

Ask explicit confirmation, or

Escalate to human via ticket.

10.4 UX Layer: Where Agents Live
Owner/Admin Setup Agent

Appears during onboarding.

Guides through:

Business info

Services

Service area

Telephony choices

Website template selection

Tier-aware:

Starter: can explain BYO Twilio, more DIY.

Pro/Elite: hides complexity, uses platform-managed defaults.

In-App Support Agent

Help dock on every page.

Knows current route (e.g., /settings/notifications, /settings/phone).

Can say:

“I see you’re editing notification settings. Want help testing a reminder?”

“I see your IVR is in simple mode. Want to enable Press-1 info + SMS?”

Customer-Facing Agent (Booking / FAQs)

On website widget + SMS.

Tone: friendly, non-technical.

Uses tenant services + policies.

10.5 Context Passing
Frontend should pass:

tenantId

userId

route (for dashboard)

Optional: lastErrorCode, recentAction

Agent uses this to feel “psychic” and specific.

PHASE 11 – DATA EXPORT & RETENTION
You want:

No data-loss on non-payment.

Tenants able to download their whole dataset.

11.1 Export
Data Export feature gated by hasFeature(tenant, 'dataExport'):

Accessible even when status = 'suspended' (if you allow).

Exports:

CSV/JSON for:

Customers

Vehicles / assets

Appointments

Invoices / payments

Messages (SMS logs, notes)

Flow:

Tenant clicks “Export My Data”.

Backend triggers background job.

When ready:

Download link (time-limited signed URL).

Or email.

11.2 Retention Policy
For past_due / suspended:

Keep all data at least N months (e.g., 6–12).

For manual cancellation:

Let them export before final closure.

Later:

Add archival / anonymization if needed.

PHASE 12 – INTEGRATIONS & KEYS CHECKLIST
You asked: “What all new integration keys do I need?”

12.1 Core Platform Keys (You / Root Tenant)
Env vars for platform (not per-tenant):

Database

DATABASE_URL

OpenAI

OPENAI_API_KEY (SMS agent, support agent, voice agent, etc.)

Twilio (platform-managed)

TWILIO_ACCOUNT_SID

TWILIO_AUTH_TOKEN

TWILIO_MESSAGING_SERVICE_SID (if used)

Stripe

STRIPE_SECRET_KEY

STRIPE_WEBHOOK_SECRET

SendGrid

SENDGRID_API_KEY

Default from email like info@cleanmachinetulsa.com

Google

GOOGLE_MAPS_API_KEY

GOOGLE_API_KEY

Calendar credentials (service account / OAuth).

PWA / Push

VAPID keys

Voice providers (when added):

Polly:

AWS access keys

ElevenLabs:

ELEVENLABS_API_KEY

OpenAI voice:

Same as OPENAI_API_KEY + model/voice settings.

12.2 Per-Tenant Config (DB, Not Env)
tenantConfig:

businessName, branding, tier, hours, service area, website mode.

tenantPhoneConfig:

phoneNumber, messagingServiceSid, sipDomain, sipUsername, ivrMode.

TenantVoiceConfig (future):

provider, voiceId, billingTier.

Optional BYO credentials:

Twilio SID/Auth Token (for advanced tenants).

Later: BYO email provider, etc.

12.3 Email for Tenants (Mid/Upper Tier)
For now:

Use your SendGrid + domain as sender infra.

Tenants:

For root only: real @cleanmachinetulsa.com addresses.

For other tenants:

Use neutral domain like no-reply@servicepro.app.

You:

Already use Microsoft 365/Outlook for @cleanmachinetulsa.com.

Automated app emails:

info@cleanmachinetulsa.com (SendGrid verified).

Or no-reply@cleanmachinetulsa.com.

PHASE 13 – IDEA PARKING LOT / FUTURE ENHANCEMENTS
Keep this short but live:

More website templates + template marketplace.

Tenant-specific review funnels & Google Review widgets.

Technician iPad mode – deeper multi-tenant integration.

Referral tracking & loyalty as generic feature for all tenants.

Agent analytics – show how much the AI booking agent earns them.

Investor-ready deck / PDF:

Visual architecture diagrams

Market positioning

Pricing models & LTV

“White-label of a white-label”:

Agencies resell ServicePro to multiple clients under their own brand.

PWA Call Console:

Full-screen mode, long-press / home-screen install.

Custom branding per tenant.

Auto SIP credential provisioning & QR-code setup.

Extended voice options:

More curated voice packs mapped to plan tiers.

TL;DR – IMMEDIATE NEXT STEPS
For you & Replit agent, in order:

Phase 2.3 – IVR branching:

Make /twilio/voice/incoming branch on ivrMode:

simple → SIP forward (current).

ivr → Press 1/2/3/7 menu.

ai-voice → placeholder until Phase 4.

Phase 2.5 – Call handling UX:

Add admin settings for forward-to-cell, hours, IVR vs direct.

Start Phase 3 – AI messaging:

Implement aiAgent.handleAgentMessage.

Route SMS + future web chat into it.

Prep Phase 5/8 – Tier fields & feature gating:

planTier, status, tenantBilling.

TIER_FEATURES + hasFeature.

Wire upgrade / suspend / export behavior:

Stripe webhooks set status.

Upgrade endpoint changes tiers.

Data export endpoint scaffolded.

When you have a new “we HAVE to have this” idea, put it here, then we’ll hydrate it into real code in the next phase.