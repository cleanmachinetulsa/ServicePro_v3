# MASTER PLAN v3.1 – SERVICEPRO MULTI-TENANT SUPER-SYSTEM

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
- One Twilio “super-tenant” architecture  
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

1. True tenant isolation (Phase 1A–1H – DONE for root; ready for more tenants).
2. Super-tenant telephony (Twilio, SIP, IVR, AI voice).
3. Tiered SaaS product (3 tiers) + trials.
4. White-label onboarding + industry packs + website generator.
5. Built-in AI agents (onboarding, booking, support) per tenant.
6. Automated provisioning & billing with Stripe.
7. Root “super-tenant” dashboard for you to run the platform.
8. Safe suspension / data retention / export so no one loses their business data.

---

## 1. CURRENT STATE SNAPSHOT (BASED ON REPO)

### 1.1 Clean Machine Repo (Current Reality)

From the exported repo:

- **Backend:**  
  - `server/index.ts` – Express + TypeScript  
  - Drizzle ORM + Neon/Postgres  
  - A lot of route files (calls, appointments, loyalty, etc.)

- **Schema:**  
  - `shared/schema.ts` – tables for customers, appointments, invoices, loyalty, etc.

- **Frontend:**  
  - Vite/React app  
  - Components for scheduling, SMS, dashboards, settings, etc.

- **Docs & Guides:**
  - `WHITE_LABEL_GUIDE.md` – feature inventory & white-label thinking  
  - `TWILIO_SETUP_GUIDE.md` / `TWILIO_WEBHOOK_SETUP.md` / `TWILIO_VOICE_SETUP.md` / `VOICE_WEBHOOK_SETUP.md`  
  - Various deployment & QA docs under `docs/`  

- **Telephony / comm routes:**
  - `server/routes.twilioVoice.ts`
  - `server/routes.voiceWebhook.ts`
  - `server/routes.smsFallback.ts`
  - `server/routes.calls.ts`
  - `server/routes.phoneSettings.ts`
  - `server/routes.twilioStatusCallback.ts`
  - Plus SMS consent, campaigns, appointments, etc.

- **Business logic routes:**
  - Appointments, quick booking, quotes, cancellations, refunds, subscriptions  
  - Loyalty & rewards: `routes.loyalty.ts`, `routes.invoice.loyalty.ts`, `loyaltyService`, `googleLoyaltyIntegration`, etc.  
  - Tags, tech profiles, contacts, gallery, recurring services, calendars, etc.

- **AI / automation bits already present:**
  - `conversationClassifier.ts`
  - `conversationState.ts`
  - `aiSuggestionService.ts`
  - `damageAssessment*`, `roleAwareNotifications.ts`, etc.

- **Knowledge base / admin artifacts:**
  - `Master_CleanMachine_AgentKnowledgeBase_AutoReady.xlsx`
  - `HOMEPAGE_FEATURE_INVENTORY.md`
  - PWA docs
  - Deployment checklists & improvement plans

➡️ **Key point:** Clean Machine is now a **seriously feature-rich** single-tenant system with Twilio, SendGrid, Stripe, loyalty, PWA, etc.

---

### 1.2 Tenant Isolation Package (ServicePro Backbone)

A tenant isolation / ServicePro backbone design introduces:

- `tenantDb` wrapper (Drizzle wrapper that injects `tenant_id`)
- `tenantMiddleware` that attaches `req.tenant` and `req.tenantDb`
- Tenant isolation tests (11 tests)
- A migration plan to move routes from `db` → `req.tenantDb`

Example pattern:

```ts
// BEFORE
await db.query.customers.findFirst({
  where: eq(customers.id, id),
})

// AFTER
await req.tenantDb.query.customers.findFirst({
  where: req.tenantDb.withTenantFilter(customers, eq(customers.id, id)),
})
➡️ Key point: This package is now applied directly to Clean Machine, not a separate live repo.
Phase 1A–1H has migrated ~800+ DB operations across ~86 files. All tenant isolation tests pass. Root tenant (tenant_id = 'root') is fully working.

2. PHASE STRUCTURE (MASTER ROADMAP)
We keep a clear phase structure so Replit agents and humans can collaborate:

Phase 0 – Canonicalization & Docs

Phase 1 – Tenant Isolation & Multi-Tenant Core

Phase 2 – Telephony Spine (SMS, Voice, SIP, IVR)

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

Where the new features (agents, website generator, tiers) plug in

PHASE 0 – CANONICALIZE & ORGANIZE (NOW)
0.1 MASTER_PLAN_V3.md (THIS FILE)
Lives at repo root.

It is the canonical reference for:

You & partner

Replit agents

Future devs

Rule: Whenever a major architecture decision is made (e.g., new tier logic, new agent type, website generator spec, billing behavior), update this file.

0.2 ServicePro Backbone as Migration Package
Treat tenant isolation docs (servicepro-backbone.md, TENANT_ISOLATION_IMPORT.md, etc.) as inputs to Phase 1, not a parallel codebase.

No second ServicePro repo.

Clean Machine becomes ServicePro over time.

Tenant isolation steps & tests are applied directly here.

PHASE 1 – TENANT ISOLATION & MULTI-TENANT CORE
1.1 Tenant Infrastructure (DONE)
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

Test infra:

server/tests/setupTenantDb.ts

server/tests/tenantIsolation/tenantDb.test.ts

vitest.config.ts updated to include tests.

Verification:

bash
Copy code
npx vitest run server/tests/tenantIsolation/tenantDb.test.ts
✅ 11/11 tests passing.

1.2 Route Migration to req.tenantDb (DONE FOR CURRENT SCOPE)
For each server/routes.*.ts file:

Remove import { db } from './db' (or ../db) where not explicitly allowed.

Replace db. usage with req.tenantDb..

Wrap conditions with withTenantFilter for SELECTs:

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
and multi-tenant enumeration for certain services.

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

PHASE 2 – TELEPHONY SPINE (SMS, VOICE, SIP, IVR)
Goal: A clean, unified telephony core that supports:

SMS automations (existing)

Voice / IVR

SIP → Groundwire for your business

Future per-tenant phone configs

You already have:

routes.twilioVoice.ts

routes.voiceWebhook.ts

routes.smsFallback.ts

routes.phoneSettings.ts

routes.calls.ts

Twilio docs (TWILIO_* files)

2.1 Standardize Voice Entry-Points
All inbound calls to a tenant’s number should go through a single endpoint:

POST /twilio/voice/incoming

This route should:

Lookup tenant by called number (Twilio To field → tenantPhoneConfig).

Attach tenant context:

Use tenant resolver → set req.tenant, req.tenantDb.

Decide call flow based on tenant’s ivrMode:

Simple direct dial (SIP / forward)

IVR (press 1/2/3…)

AI voice agent (Phase 4)

For root tenant (Clean Machine) now:

Use simple / IVR-lite – either:

Direct → SIP / Groundwire, or

Mini IVR with:

“Press 1 to talk”

“Press 2 for scheduling link via SMS”

“Press 3 to leave a voicemail”

“Press 7 for a joke / easter egg”

2.2 SIP → Groundwire Flow (Your Own Calls)
For your business (root tenant):

Twilio number → /twilio/voice/incoming → TwiML:

xml
Copy code
<Response>
  <Dial callerId="{From}">
    <Sip>jody@cleanmachinetulsa.sip.twilio.com</Sip>
  </Dial>
</Response>
Groundwire:

SIP domain: cleanmachinetulsa.sip.twilio.com

Username: jody

Custom ringtone to mark business calls.

Goal:

You answer calls like a human now.

Over time, blend:

Live answering

AI voice receptionist

SMS follow-ups

2.3 tenantPhoneConfig Table
In shared/schema.ts:

ts
Copy code
export const tenantPhoneConfig = pgTable('tenant_phone_config', {
  id: varchar('id').primaryKey(),
  tenantId: varchar('tenant_id')
    .references(() => tenants.id)
    .notNull(),
  phoneNumber: varchar('phone_number').notNull(),      // Twilio number
  messagingServiceSid: varchar('messaging_service_sid'),
  sipDomain: varchar('sip_domain'),
  sipUsername: varchar('sip_username'),
  sipPasswordEncrypted: varchar('sip_password_encrypted'),
  ivrMode: varchar('ivr_mode').default('simple'),       // 'simple', 'ivr', 'ai-voice'
  createdAt: timestamp('created_at').defaultNow(),
});
Root tenant:

Has your 918 number, SIP domain/username, IVR mode, etc.

Future tenants:

Each gets a row, so calls/SMS map correctly.

PHASE 3 – AI MESSAGING BRAIN & KNOWLEDGE BASE
Goal: Centralize and refine the logic for:

SMS conversations

Booking flows via text

FAQs and service questions

Future reuse for voice agents

You already have:

conversationClassifier.ts

conversationState.ts

aiSuggestionService.ts

Master_CleanMachine_AgentKnowledgeBase_AutoReady.xlsx

Lots of SMS logic in routes

3.1 Core “Agent Brain” Service
Create a service, e.g. server/aiAgent.ts, with a single entrypoint:

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

export async function handleAgentMessage(req: AgentRequest): Promise<AgentResponse> {
  // Look up tenant config, KB, etc.
}
All SMS / web chat / (later voice) routing should call this instead of embedding logic per route.

3.2 Knowledge Base Integration
Seed the agent’s knowledge base from:

Master_CleanMachine_AgentKnowledgeBase_AutoReady.xlsx

WHITE_LABEL_GUIDE.md

FAQ content

Service definitions

Policies (rain, cancellations, deposits, etc.)

KB design:

Global base knowledge (for all tenants).

Tenant-specific overrides (services, prices, policies).

Later: industry pack overlays (detailing vs lawn care vs house cleaning, etc.).

3.3 Customer Booking Agent (Per Tenant, Customer-Facing)
Top-3 feature.

Responsibilities:

Answer:

“What do you offer?”

“How much?”

“How long?”

“Do you travel to X?”

Drive toward bookings:

Vehicle / job details

Service type

Location & service area checks

Scheduling

Upsells (protectant, coating, maintenance program, etc.)

Channels:

SMS (Twilio)

Web chat widget

Future: voice calls (Phase 4)

Relies on:

Tenant services & pricing from DB

Tenant preferences (upsell config, policies)

Availability engine (calendar/appointments)

PHASE 4 – AI VOICE RECEPTIONIST (OPENAI REALTIME)
Goal: Take the AI messaging brain and surface it as a truly good voice receptionist.

4.1 Voice Gateway Service
Implement e.g. server/voiceGateway.ts:

Handles Twilio <Stream> WebSocket.

Connects to OpenAI Realtime API.

Streams audio → text → calls the same AI agent logic as SMS (handleAgentMessage).

Streams text → TTS audio → Twilio.

Call flow:

Caller dials tenant’s number.

Twilio hits /twilio/voice/incoming.

If configured for AI:

TwiML <Connect><Stream> → wss://your-server/voice-gateway.

Voice gateway:

Connects to OpenAI Realtime.

Feeds transcripts into handleAgentMessage.

Speaks replies back.

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

No duplicated logic, just different channel.

PHASE 5 – SAAS TIERS, ONBOARDING AGENTS, WEBSITE GENERATOR
This is where we plug in:

Tiered product (Starter / Pro / Elite).

Onboarding/setup agents (tier-aware).

Customer support agent.

Website generator with ~10 high-end templates.

Free trial flow.

5.1 Tier Model (3 Tiers)
Tenants live in a single tenants table and have a plan + status:

ts
Copy code
export const tenants = pgTable('tenants', {
  id: varchar('id').primaryKey(),
  name: varchar('name').notNull(),
  planTier: varchar('plan_tier').default('starter'), 
  status: varchar('status').default('trialing'), // 'active' | 'trialing' | 'past_due' | 'suspended' | 'cancelled'
  // later: trialEndsAt, etc.
});
Billing metadata is stored separately:

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
Feature gates live in code or a config table:

ts
Copy code
export const TIER_FEATURES = {
  starter: {
    aiSmsAgent: false,
    aiVoiceAgent: false,
    dedicatedNumber: false,
    campaigns: false,
    dataExport: true,
    websiteGenerator: true,      // maybe limited templates / branding
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
All feature checks go through a helper:

ts
Copy code
function hasFeature(tenant, key: keyof typeof TIER_FEATURES['starter']) { ... }
5.2 Onboarding Agents (Tenant Setup Agents)
We use AI setup agents to remove friction.

5.2.1 Starter Tier Onboarding Agent (BYO / simpler, but not fully hosted)
Can support:

Basic services & pricing setup.

Service area definition.

Basic booking rules.

Optional BYO Twilio/SendGrid integration (advanced button).

Tone:

Slightly more technical is OK.

Explains why a setting matters.

5.2.2 Pro / Elite Onboarding Agent (Hosted – main flow)
This is the “Shopify-like” experience.

Asks only business questions:

Business name, logo, colors, vibe.

What services do you offer?

Typical job length?

Service area (zips / radius).

Do you want deposits, reminders, review requests?

Under the hood:

Provisions Twilio number (via platform account).

Sets default automations.

Seeds services & pricing (from an industry pack).

Generates website (see 5.4).

Configures AI booking agent for this tenant.

UX:

Embedded in dashboard as a step-by-step wizard.

Uses the core aiAgent, but in admin mode and with a structured checklist.

5.3 Tenant Support Agent (In-App Support / Tech Help)
This is the product-aware copilot for your tenants (detailed in Phase 10 but summarized here).

Lives inside:

Dashboard (help widget / bottom-right dock).

Setup pages (“Need help?” button).

Knows:

Current screen/route.

Tenant tier & enabled features.

Tenant configuration (services, calendars, numbers, etc.).

Can:

Explain features.

Walk users through multi-step setup.

Perform safe actions (update a setting, trigger a test message).

Open a support ticket to you + partner if needed.

5.4 Website Generator (High-End, Limited Presets)
Key requirement: Not generic “meh” generators. You want ~10 truly high-end templates that:

Look like modern, premium SaaS / studio sites.

Use:

Clean layouts

Hover effects

Smooth transitions / subtle page transitions

“App-like” feel

But are constrained so:

Booking buttons/links always work.

Analytics & tracking work.

Layout changes don’t break logic.

Implementation:

Templates implemented in React + Tailwind, e.g. under web-templates/:

LuminousConcierge

NightDriveNeon

PrestigeGrid

LocalHero

StudioMinimal

etc., up to ~10 curated designs.

Data:

Onboarding agent collects a single structured object:

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
  bookingUrl: string; // link to tenant’s booking / request form
}
Generator:

Chooses a template (or user picks).

Fills in hero, services, FAQs, testimonials (fake/placeholder or user-provided), CTAs.

Users can:

Preview templates on their own subdomain or dev URL.

Switch between templates without breaking functionality.

Make shallow edits (copy, images, brand colors).

Partner integration:

The same WebsiteSeed object can be sent to your partner’s external webapp generator.

You keep a config:

ts
Copy code
tenantConfig.websiteGeneratorMode = 'built-in' | 'partner';
tenantConfig.partnerGeneratorEndpoint = 'https://...';
So you can:

Offer your in-app generator by default.

Offer “upgrade” to a fully custom front-end via partner as an add-on.

Performance:

Use SSR/SSG where possible.

Lazy-load heavy images.

Keep animations tasteful and lightweight.

5.5 Free Trial Flow (14-Day, No Credit Card)
Standard flow (can be adjusted later):

Landing page (Clean Machine / ServicePro showcase) has “Start 14-day free trial” button.

Trial signup form:

Name, email, business name, industry, city.

Choose plan tier (default Pro during trial).

Backend:

Creates tenant with status = 'trialing', planTier = 'pro', trialEndsAt.

Provisions a default phone number (for Pro+).

Kicks off onboarding agent.

During trial:

Soft limits on SMS/calls to avoid abuse.

“Trial” badge in app.

Upsell content reminding them of full Pro benefits.

End of trial:

Webhook from Stripe (if trial in Stripe) OR internal cron.

If not upgraded:

Set status = 'past_due' or a special trial_expired.

Soft-lock functionality (see 8.3).

Leave data intact for easy reactivation.

PHASE 6 – INDUSTRY PACKS & AUTO-SETUP
Goal: No one should feel like they’re “setting up everything from scratch.”

6.1 Industry Packs
Implement module server/industryPacks.ts:

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
Goal: Turn this into a real platform you can sell and grow.

7.1 Billing & Plans (Stripe)
Use Stripe for subscriptions.

Map planTier to Stripe price IDs.

Use Stripe webhooks:

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

Key usage stats (messages, calls, bookings).

7.2 Monitoring & Health
Per tenant:

SMS volume.

Call volume.

Booking conversions.

Agent conversations.

Error rates.

Reuse existing:

Health check system.

Logging.

Super-tenant dashboard:

“Tenant health” view.

Drill-down into a single tenant’s logs/logical events.

7.3 Scaling & Performance
When needed:

Introduce caching for:

Tenant config.

Industry packs.

Queue jobs for:

Campaign sends.

Heavy AI tasks.

For very large tenants:

Optionally move them to their own DB instance / schema using same codebase.

8. PLAN TIERS, UPGRADES, AND USAGE BILLING (v3.1)
8.1 Plan & Status Fields
Already described in 5.1 + 7.1; key fields:

tenants.planTier – 'starter' | 'pro' | 'elite'.

tenants.status – 'active' | 'trialing' | 'past_due' | 'suspended' | 'cancelled'.

tenantBilling.* – Stripe metadata.

8.2 Upgrade Flow (Starter → Pro → Elite, No Re-Setup)
Flow:

Tenant clicks “Upgrade to Pro/Elite” in the app.

Frontend calls /api/billing/upgrade with targetTier.

Backend:

Uses tenantBilling to find Stripe subscription.

Updates subscription to new price.

On success:

Sets planTier to 'pro'/'elite'.

Triggers provisioning (e.g., dedicated number for Pro+).

Features unlock immediately via hasFeature.

No new tenant, no migration. Same data, same charts, just more powers.

8.3 Handling Non-Payment (Suspend but Don’t Delete)
Principles:

Never delete tenant data just because a card failed.

Suspend access, not information.

Make reactivation easy.

Policy:

On invoice.payment_failed:

Mark status = 'past_due'.

Show prominent banner:

“There was a problem with your payment. Please update your card.”

Optionally:

Block new campaigns & new outbound SMS.

Allow read-only access + 1:1 bookings.

On long-term non-payment or subscription cancelled:

Set status = 'suspended'.

Allow:

Login.

Read-only dashboard.

Billing page.

Data export (see Phase 11).

Block:

New bookings.

SMS/voice automations.

Campaigns.

Data retention:

Keep data for a configurable window (e.g., 6–12 months).

Later: implement archival (cold storage) if needed.

8.4 Built-in Upgrade Nudges
To push Starter → Pro:

In-app plan card:

“Current Plan: Starter” with a compare table.

Feature wall:

When they try to use Pro-only feature:

Modal: “This feature is part of Pro – upgrade to unlock AI SMS agent + your own business number. Your existing setup stays exactly the same.”

Usage-based prompt:

If they send a lot of manual texts:

“You’ve sent 180 SMS manually this month. Pro can automate follow-ups and reminders. [See Pro benefits]”

9. TELEPHONY MODEL & TWILIO UX (v3.1)
9.1 Core Principle: Platform-Managed by Default
For Pro/Elite tenants:

They never see Twilio.

You act as carrier:

Own Twilio account.

Provision numbers.

Handle A2P registration.

Maintain webhooks.

They see:

“Your business number: (XXX) XXX-XXXX”.

Call + SMS stats.

High-level routing settings (hours, voicemail vs AI voice, etc.).

Starter tenants:

Optionally BYO Twilio (advanced) or share a pool / generic number.

9.2 Provisioning Numbers for Tenants
Provisioning service provisionTenantNumber(tenantId):

Look up tenant’s location (city/area, country).

Use platform Twilio keys to:

Search for local or toll-free number.

Purchase it.

Attach voice & SMS webhooks:

Voice: /twilio/voice/incoming

SMS: /twilio/sms/incoming

Create/update tenantPhoneConfig row:

phoneNumber

messagingServiceSid (if used)

ivrMode = 'simple' by default.

On failure:

Log + show friendly UI:

“We couldn’t automatically get a number in your preferred area. We’ll reach out with options.”

9.3 BYO Twilio (Advanced)
Hidden behind an “Advanced” toggle in settings.

Collect:

accountSid

authToken

Optional messagingServiceSid

Validate with test calls.

Mark tenant as BYO Twilio.

All telephony flows for that tenant use their creds instead of platform’s.

Note: Most users stay on platform-managed Twilio.

9.4 Suspension Behavior for Telephony
Based on tenants.status:

active or trialing:

Full telephony flows.

past_due:

Option A: allow inbound calls/SMS, block campaigns & scheduled outbound.

Option B: gradually limit usage + show warnings.

suspended:

Stop automations and new outbound.

Optionally allow inbound calls to still ring but with a “your account is paused” message, depending on your business decision.

Keep number & config intact during retention window.

10. AI SETUP & SUPPORT AGENTS (PRODUCT-AWARE COPILOTS)
This section pulls together all the thinking about the “super helpful support agent” and the setup agents.

10.1 Concept: Product-Aware Copilot
Instead of “random chatbots that kinda know stuff”, ServicePro has a product-aware copilot with 3 layers:

Knowledge layer – product docs, screen map, feature specs, FAQs, tenant config.

Tool layer – safe actions (update settings, trigger tests, create tickets).

UX layer – embedded where it’s needed (setup wizard, help dock, chat bubble, maybe SMS/email later).

10.2 Knowledge Layer
Sources:

Your existing docs (WHITE_LABEL_GUIDE.md, KB sheets, etc.).

DB schema + route map (what features exist, where).

Industry packs.

Tenant config (services, hours, numbers, tier).

We model:

Feature specs

Screen map / UI flow

Setup playbooks:

“Onboard solo detailer”.

“Onboard cleaning business”.

“Connect calendar”.

Troubleshooting trees:

“My SMS aren’t sending”.

“Appointments aren’t showing on technician iPad”.

This can be stored as:

A structured JSON/DB (for tools).

Plus a vector store for free-text search.

10.3 Tool Layer (Safe Actions)
Examples of tools the agent can call:

Read-only:

get_tenant_profile(tenantId)

get_enabled_features(tenantId)

get_error_logs(tenantId, timeframe)

search_docs(query)

Actions:

update_setting(tenantId, key, value)

enable_feature(tenantId, featureKey) (if allowed by tier)

trigger_onboarding_flow(tenantId, flowType)

create_support_ticket(tenantId, userId, summary, details)

Rules:

Write actions are whitelisted and narrow.

Risky stuff (deleting data, downgrades) must:

Ask explicit confirmation, or

Escalate to human via support ticket.

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

Starter: can talk about BYO Twilio, etc.

Pro/Elite: hides complexity, uses platform-managed defaults.

In-App Support Agent

Help dock on every page.

Knows current route (e.g. /settings/notifications).

Can say:

“I see you’re editing notification settings. Want me to explain reminder rules or help test one?”

Talks more “technical” to owners than to customers.

Customer-Facing Agent (Booking / FAQs)

On website widget + SMS.

Tone: friendly, non-technical.

Pulls from tenant services + policies.

10.5 Context Passing
Front-end should pass:

tenantId

userId

route (for dashboard)

Optional lastErrorCode, recentAction (for debugging/help).

Agent uses that to feel “psychic” and specific.

11. DATA EXPORT & RETENTION
You explicitly want:

No data-loss for non-payment.

Ability for tenants to download their whole dataset.

11.1 Export
Implement a Data Export feature gated by hasFeature(tenant, 'dataExport'):

Accessible even when status = 'suspended' (as long as you want).

Generates:

CSV/JSON exports for:

Customers

Vehicles / assets

Appointments

Invoices / payments

Messages (SMS logs, notes)

Optionally zipped.

Flow:

Tenant clicks “Export My Data”.

Backend triggers a background job.

When ready, they get:

Download link (time-limited signed URL).

Or an email if configured.

11.2 Retention Policy
For past_due / suspended:

Keep all data for at least N months (decide later, e.g., 6–12).

For manual cancellation:

Let them export before final closure.

Later:

Add archival / anonymization if needed for costs/privacy.

12. INTEGRATIONS & KEYS CHECKLIST
You asked “what all new integration keys do I need?”

12.1 Core Platform Keys (You / Root Tenant)
These live as environment variables for the platform, not per-tenant:

Database

DATABASE_URL

OpenAI

OPENAI_API_KEY (for SMS agent, support agent, voice agent, etc.)

Twilio (platform-managed)

TWILIO_ACCOUNT_SID

TWILIO_AUTH_TOKEN

TWILIO_MESSAGING_SERVICE_SID (if using)

Voice + SMS webhooks wired to ServicePro backend.

Stripe

STRIPE_SECRET_KEY

STRIPE_WEBHOOK_SECRET

SendGrid

SENDGRID_API_KEY

Default “from” email like info@cleanmachinetulsa.com

Google

GOOGLE_MAPS_API_KEY

GOOGLE_API_KEY

Google Calendar credentials (Service account or OAuth).

PUSH / PWA

VAPID keys already in use.

12.2 Per-Tenant Config
Stored in DB, not env:

tenantConfig:

businessName, branding, tier, hours, service area, etc.

tenantPhoneConfig:

phoneNumber, messagingServiceSid, sipDomain, etc.

Optional BYO credentials:

Twilio account SID/Auth Token.

(Later) BYO email provider, etc.

12.3 Email for Tenants (Mid/Upper Tier)
For now:

Use your SendGrid + your domain as the sending infrastructure.

Tenants can:

Use theirname@cleanmachinetulsa.com style addresses only for you (root).

For other tenants, use:

no-reply@servicepro.app or a similar neutral domain.

Later: verify their own domain via SendGrid for premium tiers.

You personally:

Already use Microsoft 365/Outlook for @cleanmachinetulsa.com.

Sending automated app emails can:

Be from info@cleanmachinetulsa.com (your SendGrid verified identity).

Or a dedicated no-reply@cleanmachinetulsa.com.

13. IDEA PARKING LOT / FUTURE ENHANCEMENTS
Because you think of new ideas constantly (which is a feature, not a bug), we keep a short “REVISIT LIST” here so nothing gets lost:

Add more website templates and a template marketplace.

Tenant-specific review funnels and Google Review widgets.

Technician iPad mode – deeper integration with multi-tenant data.

Referral tracking and loyalty system exposed as a generic feature for all tenants.

Analytics for agents – show how much the AI booking agent is earning them.

Deep investor-ready deck / PDF:

Visual architecture diagrams.

Market positioning.

Pricing models & LTV.

Partner “white-label of a white-label” – letting agencies resell ServicePro to multiple clients under their own brand.

TL;DR – IMMEDIATE NEXT STEPS
For you & Replit agent, in order:

Confirm Phase 1 completion

Tenant isolation tests passing (already done).

Server starts clean (already done).

Solidify Phase 2 basics

Ensure /twilio/voice/incoming is the canonical inbound voice route.

Confirm SIP → Groundwire flow works exactly how you want.

Start centralizing AI messaging (Phase 3)

Implement aiAgent.handleAgentMessage.

Route SMS + any web chat into it.

Add tier + status fields and TIER_FEATURES (Phase 5 & 8)

planTier, status, tenantBilling.

hasFeature helper and use it in UI for gating.

Wire upgrade, suspend, and export behavior

Stripe webhooks set status.

Upgrade endpoint flips tiers.

Data export endpoint scaffolding.

Add or refine this file whenever you have a new “we HAVE to have this” idea.