# MASTER PLAN v3.0 – SERVICEPRO MULTI-TENANT SUPER-SYSTEM

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

**MASTER PLAN v3.0** = Take your current **Clean Machine** codebase and layer on:

1. True tenant isolation (already in progress via Phase 1A–1H).
2. Super-tenant telephony (Twilio, SIP, IVR, AI voice).
3. Tiered SaaS product (3 tiers) + trials.
4. White-label onboarding + industry packs + website generator.
5. Built-in AI agents (onboarding, booking, support) per tenant.
6. Automated provisioning & billing.
7. Root “super-tenant” dashboard for you to run the platform.

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

You also have a tenant isolation / ServicePro backbone design that introduces:

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
➡️ Key point: This package is now being applied to the Clean Machine repo, not maintained as a separate live codebase.

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

Each phase has:

Goals

What’s already done (if applicable)

Concrete tasks Replit can execute

Where the new features (agents, website generator, tiers) plug in

PHASE 0 – CANONICALIZE & ORGANIZE (NOW)
0.1 MASTER_PLAN_V3.md (THIS FILE)
This file exists at repo root.

It is the canonical reference for:

You & partner

Replit agents

Future devs

Rule:
Whenever a major architecture decision is made (e.g., new tier logic, new agent type, website generator spec), update this file.

0.2 ServicePro Backbone as Migration Package
Treat tenant isolation docs (servicepro-backbone.md, etc.) as inputs to Phase 1, not a parallel codebase.

No second ServicePro repo.

Clean Machine becomes ServicePro over time.

Tenant isolation steps & tests are applied directly here.

PHASE 1 – TENANT ISOLATION & MULTI-TENANT CORE
1.1 Tenant Infrastructure (DONE / IN PROGRESS)
Implement in server/:

server/tenantDb.ts

Wrap base Drizzle client (db).

Inject tenant_id on inserts.

Provide withTenantFilter(table, condition) for selects, updates, deletes.

server/tenantMiddleware.ts

Resolve tenantId:

For now: hardcode 'root' for all Clean Machine traffic.

Later: use domain/subdomain/headers to map to tenant.

Attach req.tenant and req.tenantDb.

Test infra:

server/tests/setupTenantDb.ts

server/tests/tenantIsolation/tenantDb.test.ts

vitest.config.ts updated to include tests.

Verification:

npx vitest run server/tests/tenantIsolation/tenantDb.test.ts
✅ Expect 11/11 tests passing.

NOTE: Phase 1A–1H has already done a huge portion of this:

Many routes migrated

11/11 tests passing

No raw db usage in server except allowed spots.

1.2 Route Migration to req.tenantDb
For each server/routes.*.ts file:

Remove import { db } from './db' (or '../db').

Replace db. usage with req.tenantDb..

Wrap conditions with withTenantFilter:

ts
Copy code
await req.tenantDb.query.customers.findFirst({
  where: req.tenantDb.withTenantFilter(customers, eq(customers.id, id)),
})
Core routes (already mostly migrated):

routes.appointments.ts

routes.quickbooking.ts

routes.calls.ts

routes.twilioVoice.ts

routes.smsFallback.ts

routes.contacts.ts

routes.notifications.ts

Loyalty / invoices / campaigns / etc.

Phase 1H:
Final sweep to ensure no remaining server code uses raw db directly (except inside tenantDb.ts and test/migration utilities).

1.3 DB Schema & Tenants
In shared/schema.ts:

Confirm core tables have tenantId (or add it):

customers, appointments, vehicles, invoices, campaigns, etc.

Add tenants table if not present:

ts
Copy code
export const tenants = pgTable('tenants', {
  id: varchar('id').primaryKey(),   // 'root', 'tenant-xxxx'
  name: varchar('name').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  // later: domain, plan, branding, etc.
});
Seed:

tenant_id = 'root' for all existing Clean Machine data.

PHASE 2 – TELEPHONY SPINE (SMS, VOICE, SIP, IVR)
Goal:
A clean, unified telephony core that supports:

SMS automations (existing)

Voice / IVR

SIP → Groundwire for your business

Future per-tenant phone configs

You already have several telephony files:

routes.twilioVoice.ts

routes.voiceWebhook.ts

routes.smsFallback.ts

routes.phoneSettings.ts

routes.calls.ts

Twilio docs (TWILIO_* files)

2.1 Standardize Voice Entry-Points
All inbound calls to a tenant’s number should go through a single endpoint, e.g.:

POST /twilio/voice/incoming

This route should:

Lookup tenant by called number:

from / to in Twilio payload → map to tenantPhoneConfig.

Attach tenant context:

Use tenantMiddleware or a resolver to build req.tenantDb.

Decide call flow:

Simple direct dial (SIP / forward)

IVR (press 1/2/3…)

AI voice agent (future Phase 4)

For root tenant (Clean Machine):

Start with simple / IVR-lite:

Option A: Direct call → SIP / Groundwire.

Option B: Mini IVR with “press 1 to talk, 2 for SMS link, 3 to leave a voicemail, 7 for joke.”

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
You answer calls like a human, but eventually you can blend:

Live answering

AI voice receptionist

SMS follow-ups

2.3 tenantPhoneConfig Table
In shared/schema.ts define:

ts
Copy code
export const tenantPhoneConfig = pgTable('tenant_phone_config', {
  id: serial('id').primaryKey(),
  tenantId: varchar('tenant_id').references(() => tenants.id).notNull(),
  phoneNumber: varchar('phone_number').notNull(),      // Twilio number
  messagingServiceSid: varchar('messaging_service_sid'),
  sipDomain: varchar('sip_domain'),
  sipUsername: varchar('sip_username'),
  sipPasswordEncrypted: varchar('sip_password_encrypted'),
  ivrMode: varchar('ivr_mode').default('simple'),       // 'simple', 'ivr', 'ai-voice'
  createdAt: timestamp('created_at').defaultNow()
});
Root tenant:

Gets your 918 number, SIP domain/username, IVR mode, etc.

Future tenants:

Each gets their own row, so calls/SMS map correctly.

PHASE 3 – AI MESSAGING BRAIN & KNOWLEDGE BASE
Goal:
Centralize and refine the logic for:

SMS conversations

Booking flows via text

FAQs and service questions

Future reuse for voice agents

You already have:

conversationClassifier.ts

conversationState.ts

aiSuggestionService.ts

A rich Master_CleanMachine_AgentKnowledgeBase_AutoReady.xlsx

Lots of SMS logic in routes

3.1 Core “Agent Brain” Service
Create a service, e.g. server/aiAgent.ts, that exposes a single entrypoint:

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
  context?: Record<string, any>;
}

interface AgentResponse {
  replyText: string;
  nextActions?: Array<{
    type: 'book' | 'reschedule' | 'collect_info' | 'handoff' | 'confirm';
    payload?: any;
  }>;
}

async function handleAgentMessage(req: AgentRequest): Promise<AgentResponse> {
  // Look up tenant config, knowledge, AI model, etc.
}
All SMS / web chat / (later voice) routing should call this instead of embedding logic per route.

3.2 Knowledge Base Integration
Seed the agent’s knowledge base from:

Master_CleanMachine_AgentKnowledgeBase_AutoReady.xlsx

WHITE_LABEL_GUIDE.md

FAQ content

Service definitions

Policies (rain, cancellations, deposits, etc.)

This KB should be:

Global base knowledge (for all tenants).

Overlaid with tenant-specific overrides.

3.3 Customer Booking Agent (Per Tenant, Customer-Facing)
This is one of the TOP 3 features.

Responsibilities:

Answer: “What do you offer?”, “How much?”, “How long?”, “Do you travel to X?”

Drive toward bookings:

Vehicle details

Service type

Location & service area checks

Scheduling

Upsells (protectant, maintenance plans, etc.)

Works on:

SMS (through Twilio)

Web chat widget

Future: voice calls (Phase 4)

It relies on:

Tenant services & pricing from DB

Tenant preferences (upsell config, policies)

Availability engine (calendar/appointments)

PHASE 4 – AI VOICE RECEPTIONIST (OPENAI REALTIME)
Goal:
Take the AI messaging brain and surface it as a truly good voice receptionist.

4.1 Voice Gateway Service
Implement e.g. server/voiceGateway.ts:

Handles the Twilio <Stream> WebSocket.

Connects to OpenAI Realtime API.

Streams audio → text → calls same AI agent logic as SMS.

Streams text → TTS audio → Twilio.

Call flow:

Caller dials tenant’s number.

Twilio hits /twilio/voice/incoming.

If configured for AI:

TwiML <Connect><Stream> → wss://your-server/voice-gateway.

Voice gateway:

Connects to OpenAI Realtime.

Feeds transcripts into aiAgent.handleAgentMessage.

Speaks replies back.

4.2 Reuse Booking Flow Logic
The voice agent should:

Use the same step sequence as SMS booking:

Greet

Service type

Vehicle & condition

Water/power

Address & service area check

Offer slots

Confirm & book

SMS confirmation

This avoids duplication and keeps behavior consistent.

PHASE 5 – SAAS TIERS, ONBOARDING AGENTS, WEBSITE GENERATOR
This is where we plug in all the new feature ideas:

Tiered product (Basic / Hosted / Enterprise)

Onboarding/setup agents (Tier 1 vs Tier 2 variants)

Customer support agent

Website generator with 10+ high-end templates

Free trial flow

5.1 Tier Model (3 Tiers)
Tier 1 – Basic / BYO Integrations

Target: solo / small operators, tech-curious but budget-sensitive.

They:

Bring their own Twilio / A2P (optional).

Bring their own SendGrid / email.

Might use their own website, or our basic generator.

Features:

Core scheduling & CRM.

Basic booking page / widget.

Limited website template set.

Onboarding agent (BYO mode, more technical).

Customer booking agent.

Basic in-app support agent.

Tier 2 – Fully Hosted (Recommended)

Target: people who want a Shopify-like done-for-them.

They:

Use your Twilio “super-tenant” infrastructure.

Get numbers provisioned automatically.

Don’t have to touch A2P, DNS, webhooks, etc.

Features:

Everything in Tier 1.

Automatically provisioned phone numbers / A2P.

10+ high-end website templates (see 5.3 below).

Fully managed SMS/voice, reviews, calendar sync.

Simpler onboarding agent (no technical talk).

Higher level customer support agent.

Tier 3 – Enterprise / Custom

Target: bigger shops, franchises.

They get:

Everything in Tier 2.

Custom development & automations.

Multi-location support.

Priority support, SLAs.

Deep AI tuning, custom agents.

Extra reporting & analytics.

Implement in DB:

ts
Copy code
export const tenantConfig = pgTable('tenant_config', {
  tenantId: varchar('tenant_id').references(() => tenants.id).primaryKey(),
  businessName: varchar('business_name'),
  industry: varchar('industry'),
  tier: varchar('tier').default('basic'),   // 'basic', 'hosted', 'enterprise'
  // branding
  logoUrl: varchar('logo_url'),
  primaryColor: varchar('primary_color'),
  // service area
  serviceAreaZipCodes: text('service_area_zip_codes').array(),
  maxDistanceMiles: integer('max_distance_miles'),
  // business settings
  businessHours: jsonb('business_hours'),
  // feature flags
  enableAiVoice: boolean('enable_ai_voice').default(false),
  enableSms: boolean('enable_sms').default(true),
  enableWebsiteGenerator: boolean('enable_website_generator').default(false),
  // etc...
});
5.2 Onboarding Agents (Tenant Setup Agents)
We have two key variants:

5.2.1 Tier 1 Onboarding Agent (BYO, more technical)
Purpose: Help a more technical user plug in:

Twilio account SID/Auth Token.

A2P brand campaign info.

SendGrid API key.

Custom domain.

Behaviors:

Explains why it needs inputs (non-scary).

Validates keys (hits small test endpoints).

Stores keys securely (server-side, never in front-end).

Steps:

Connect communications (Twilio/SendGrid).

Define services & pricing.

Define service area & travel rules.

Setup booking rules & automation preferences.

Optional: website domain & DNS instructions.

UX:

Chat-like guided wizard embedded in dashboard.

Uses the same aiAgent core, but in admin mode.

5.2.2 Tier 2 Onboarding Agent (Hosted, super simple)
Purpose: Hide all technical crap.

Behavior:

Asks business questions only:

What do you offer?

What area do you cover?

Typical job duration?

Do you want deposits, reminders, review requests?

What style do you like for your website? (Modern, luxury, local, etc.)

Under the hood:

Provisions Twilio subaccount & number.

Sets default automations.

Seeds services & pricing (with an industry pack).

Generates initial website using generator.

UX:

Feels like an assistant “setting things up for you.”

At the end, shows a checklist + “You’re ready” screen.

5.3 Tenant Support Agent (In-App Support / Tech Help)
This is your own support load killer.

Lives inside:

Dashboard (help widget).

Docs/help center pages.

Capabilities:

Can search product docs (KB).

Can inspect tenant config.

Can safely change some settings (or propose changes).

Can open support tickets for you & your partner.

Personality:

Friendly, clear, step-by-step.

Uses screen-aware context (knows what page user is on).

For now:

Implement as a web chat widget that calls the aiAgent with userRole = 'owner' | 'staff'.

5.4 Website Generator (High-End, Limited Presets)
Key requirement you emphasized:

Not generic “meh” website generators.

You want 10 or so truly high-end templates that:

Look as good as top-tier modern SaaS / studio sites.

Have hover effects, smooth transitions, “app feel.”

Are carefully constrained so:

All booking / CTA buttons work.

All integrations work.

Styles can change safely without breaking structure.

Architecture:

Templates implemented in React + Tailwind.

Example: templates/LuminousConcierge, NightDriveNeon, PrestigeGrid, etc.
(You already have some of these in the repo.)

Data flow:

Onboarding agent collects:

Brand name

Colors / style preference

Service list

Headlines (or generates them)

About blurb (or generates it)

Generator:

Chooses a template (or user selects one).

Fills in:

Hero text

Service sections

Testimonials (seeded or blank)

Contact info & phone

Booking CTAs that link to your booking engine.

Tenant can:

Preview templates.

Switch between them.

Make small edits (text, images, colors).

For more advanced generation:

You can integrate your partner’s webapp generator as an alternate backend.

The same structured data (collected at onboarding) feeds either your internal generator or his external generator.

Performance:
We want great load times without losing features.

Use static generation/SSR where possible.

Lazy-load heavy components.

Optimize images.

Keep animation tasteful and not CPU-heavy.

5.5 Free Trial Flow (14-Day, No Credit Card)
14-day free trial, no credit card required (configurable later).

Flow:

User clicks “Start free 14-day trial” on your Clean Machine showcase page.

They land on ServicePro signup (simple form).

Backend:

Creates tenant.

Marks trialEndsAt in DB.

Provisions a default phone number (if Tier 2+).

Runs onboarding agent.

During trial:

Limited usage thresholds (SMS, calls).

“Trial” badges in dashboard.

End of trial:

Soft lock with clear messaging.

Offer to upgrade.

Possibly extend trial manually from root dashboard.

PHASE 6 – INDUSTRY PACKS & AUTO-SETUP
Goal:
New tenants shouldn’t have to set up everything from scratch. We want “wizard-like” setup.

6.1 Industry Packs
Implement a module like server/industryPacks.ts:

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

Sample SMS templates.

IVR script / call routing defaults.

FAQ entries.

Basic website content.

Then tenant can tweak.

6.2 Agent Configuration Per Industry
Onboarding agent and customer booking agent adjust language and examples by industry.

E.g. for detailing: talk about “paint correction”, “ceramic coating”.

For cleaning: talk about “deep clean”, “move-out cleans”, etc.

PHASE 7 – SUPER-TENANT OPS (BILLING, MONITORING, SCALING)
Goal:
Turn this into a real platform you can sell and grow.

7.1 Billing & Plans
Integrate Stripe for subscriptions:

Map tenantConfig.tier to Stripe price IDs.

Future:

Usage-based surcharges (high SMS/voice volume).

Root dashboard:

See which tenants are:

Trial

Active

Past due

Cancelled

7.2 Monitoring & Health
Per tenant:

SMS volume

Call volume

Booking conversions

Agent conversations

Error rates

You already started some of this with healthCheck.ts and analytics dashboards.

Root dashboard:

“Tenant health list” with quick indicators.

Ability to drill down to logs for a single tenant.

7.3 Scaling & Performance
When needed:

Introduce caching for:

Common lookups (tenant config, industry packs).

Queue jobs:

Bulk campaigns.

Heavy AI tasks.

Potential to move very large tenants to:

Separate DB or schema.

But keep same codebase & logic.

TL;DR – IMMEDIATE NEXT STEPS
For you & Replit agent, in order:

Phase 1 completion:

Make sure tenant isolation (Phase 1A–1H) is fully complete:

No raw db usage in server (except allowed).

Tenant tests all passing.

Server runs clean.

Phase 2 basics:

Standardize /twilio/voice/incoming.

Confirm SIP → Groundwire works exactly how you want (caller ID + special ringtone).

Phase 3 core:

Implement aiAgent service and route SMS/web through it.

Begin connecting knowledge base (from Excel & docs).

Phase 5 skeleton:

Add tenants + tenantConfig tables.

Implement tier field + basic flags.

Implement free trial creation + simple onboarding path.

Add placeholder website template selection using your existing templates.

From there, we can iterate on:

Onboarding agent prompts & flows.

Support agent flows.

Website generator polish.

Industry packs.

HOW TO USE THIS FILE WITH REPLIT AGENT
When asking Replit agent to work on something:

Paste the relevant excerpt from this file + your concrete ask.

Example:

“Using the MASTER_PLAN_V3.md section ‘Phase 1 – Tenant Isolation & Multi-Tenant Core / 1.2 Route Migration’, please update routes.calls.ts and routes.twilioVoice.ts to use req.tenantDb instead of db. Don’t change business logic.”

This keeps everything aligned with the master plan.

END OF MASTER PLAN v3.0