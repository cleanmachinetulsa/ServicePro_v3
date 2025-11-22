MASTER PLAN v3.2 – SERVICEPRO MULTI-TENANT SUPER-SYSTEM

Canonical master plan for:

You (Jody)

Your partner

Replit AI agents

Future contributors

This file is the source of truth. All major changes to architecture, features, or roadmap get reflected here.

0. HIGH-LEVEL NORTH STAR

Product: Turn the existing Clean Machine app into ServicePro – a multi-tenant, white-label, AI-powered service business OS.

Clean Machine = root tenant (your business, flagship instance).

Other businesses (detailers, lawn care, cleaners, pet groomers, etc.) = child tenants.

All share:

One codebase

One Twilio super-tenant architecture

One AI brain (general framework) customized per industry & per tenant

Each tenant gets:

Their own phone number(s)

Their own SMS/voice/IVR experience

Their own branding, services, pricing, and website

Their own AI agents:

Onboarding/setup agent

Customer booking agent

Customer support / help agent

MASTER PLAN v3.x = Take your current Clean Machine codebase and layer on:

True tenant isolation (Phase 1A–1H – DONE for root; ready for more tenants).

Super-tenant telephony (Twilio, SIP, IVR, AI voice) with single-number IVR flows that are easy for tenants.

Tiered SaaS product (3 tiers) + trials.

White-label onboarding + industry packs + website generator.

Built-in AI agents (onboarding, booking, support) per tenant.

Automated provisioning & billing with Stripe.

Root “super-tenant” dashboard + tenant registry admin UI.

Safe suspension / data retention / export so no one loses their business data.

A consistent, premium PWA call & app experience so tenants don’t suffer “Twilio/dialer hell”.

1. CURRENT STATE SNAPSHOT (BASED ON REPO)
1.1 Clean Machine Repo (Current Reality)

From the exported repo:

Backend:

server/index.ts – Express + TypeScript

Drizzle ORM + Neon/Postgres

A lot of route files (calls, appointments, loyalty, etc.)

Schema:

shared/schema.ts – tables for customers, appointments, invoices, loyalty, etc.

Frontend:

Vite/React app

Components for scheduling, SMS, dashboards, settings, etc.

Docs & Guides:

WHITE_LABEL_GUIDE.md – feature inventory & white-label thinking

TWILIO_SETUP_GUIDE.md / TWILIO_WEBHOOK_SETUP.md / TWILIO_VOICE_SETUP.md / VOICE_WEBHOOK_SETUP.md

Various deployment & QA docs under docs/

Telephony / comm routes:

server/routes.twilioVoice.ts

server/routes.voiceWebhook.ts

server/routes.smsFallback.ts

server/routes.calls.ts

server/routes.phoneSettings.ts

server/routes.twilioStatusCallback.ts

Plus SMS consent, campaigns, appointments, etc.

Business logic routes:

Appointments, quick booking, quotes, cancellations, refunds, subscriptions

Loyalty & rewards: routes.loyalty.ts, routes.invoice.loyalty.ts, loyaltyService, googleLoyaltyIntegration, etc.

Tags, tech profiles, contacts, gallery, recurring services, calendars, etc.

AI / automation bits already present:

conversationClassifier.ts

conversationState.ts

aiSuggestionService.ts

damageAssessment*, roleAwareNotifications.ts, etc.

Knowledge base / admin artifacts:

Master_CleanMachine_AgentKnowledgeBase_AutoReady.xlsx

HOMEPAGE_FEATURE_INVENTORY.md

PWA docs

Deployment checklists & improvement plans

➡️ Key point: Clean Machine is now a seriously feature-rich single-tenant system with Twilio, SendGrid, Stripe, loyalty, PWA, etc.

1.2 Tenant Isolation Package (ServicePro Backbone)

A tenant isolation / ServicePro backbone design introduces:

tenantDb wrapper (Drizzle wrapper that injects tenant_id)

tenantMiddleware that attaches req.tenant and req.tenantDb

Tenant isolation tests (11 tests)

A migration plan to move routes from db → req.tenantDb

Example pattern:

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

Phase 2.1 – Canonical Voice Entry-Point (DONE)

Phase 2.2–2.4 – IVR / AI routing

Phase 2.5 – Call handling & PWA experience

Phase 2A – Tenant Registry & Admin UI (DONE)

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

Rule: Whenever a major architecture decision is made (e.g., new tier logic, new agent type, website generator spec, billing behavior, telephony UX) update this file.

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

npx vitest run server/tests/tenantIsolation/tenantDb.test.ts


✅ 11/11 tests passing.

1.2 Route Migration to req.tenantDb (DONE FOR CURRENT SCOPE)

For each server/routes.*.ts file:

Removed import { db } from './db' (or ../db) where not explicitly allowed.

Replaced db. usage with req.tenantDb..

Wrapped conditions with withTenantFilter for SELECTs:

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

const tenantDb = wrapTenantDb(db, 'root');


and multi-tenant enumeration where needed.

1.3 DB Schema & Tenants

In shared/schema.ts:

Core tables have tenantId (NOT NULL, default 'root' where needed):
customers, appointments, vehicles, invoices, campaigns, conversations, sms_templates, banners, etc.

tenants table:

export const tenants = pgTable('tenants', {
  id: varchar('id').primaryKey(),   // 'root', 'tenant-xxxx'
  name: varchar('name').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  // later: domain, plan, branding, etc.
});


sms_templates unique constraint is composite per tenant:

UNIQUE (tenant_id, template_key)


Root tenant (Clean Machine):

Has tenant_id = 'root' for all existing data.

Background jobs enumerate all tenants but currently only find 'root'.

1.4 Phase 2A – Tenant Registry & Admin UI (DONE)

This is implemented but conceptually sits between Phase 1 (multi-tenant core) and later phases.

DB Changes

New enum type: tenant_tier: 'starter' | 'pro' | 'elite'

New table: tenant_config

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

Create tenant dialog with validation.

Displays tenant id, business name, subdomain (if present), tier, created date.

Visual indicators for root tenant (shield icon + “Root/Flagship” badge).

Responsive layout + loading/empty states.

Wired via TanStack Query + shadcn/ui components.

Wiring:

server/routes.ts – registerAdminTenantRoutes(app)

client/src/App.tsx – route /admin/tenants guarded by <AuthGuard>.

Status:

✅ All 6 tasks completed and architect-reviewed.

✅ Server running clean.

✅ All tenant isolation tests still passing.

PHASE 2 – TELEPHONY SPINE (SMS, VOICE, SIP, IVR)

Goal: A clean, unified telephony core that supports:

SMS automations (existing)

Voice / IVR

SIP → Groundwire / in-app call handling

Future per-tenant phone configs

A simple “one-number” experience for tenants (no Twilio hell).

2.1 Canonical Voice Entry-Point (DONE)

Endpoint:
POST /twilio/voice/incoming

Built in: server/routes.twilioVoiceCanonical.ts

This is now the single canonical entry-point for inbound voice calls.

Currently hardcoded to 'root' tenant (Clean Machine) but framed for multi-tenant.

Behavior (current):

Verifies Twilio signatures for security.

Resolves tenant (temporarily 'root').

Performs simple SIP forwarding to:

<Response>
  <Dial callerId="{From}">
    <Sip>jody@cleanmachinetulsa.sip.twilio.com</Sip>
  </Dial>
</Response>


Caller ID is passed through.

Tests:

server/tests/twilioVoiceCanonical.test.ts – 6/6 tests passing.

Scenarios: valid/invalid signatures, missing fields, SIP forwarding behavior, error handling.

Docs:

PHASE_2_1_CANONICAL_VOICE.md – implementation details + migration notes.

replit.md – updated project overview & how to hit /twilio/voice/incoming.

Status:

✅ Canonical voice route live and ready for root tenant.

✅ Twilio can be pointed directly at this now.

2.2 Single-Number IVR Pattern (Design Now, Implement Soon)

Key principle:
Each tenant should be able to do all of this with one business number:

IVR menu (“press 1 for info, 2 to talk, 3 for voicemail, 7 for joke”)

SMS follow-up (“press 1” sends link/pricing)

Forward to a cell/SIP (“press 2”)

Voicemail capture (“press 3”)

Nothing in Twilio requires separate numbers for these actions.

Recommended default IVR pattern for ServicePro tenants:

Press 1 – “Tell me about your services”

Play a short info message.

Send SMS with price sheet / website link / booking form.

Press 2 – “Talk to a person”

Forward to their primary business phone (or SIP endpoint).

Same number handles IVR and the live call.

Press 3 – “Leave a message”

Record voicemail.

Email or SMS the tenant/owner a link.

Press 7 – “Easter egg / joke” (optional)

Fun differentiator (Clean Machine’s style) they can turn on/off.

For root tenant, this mirrors your current usage but cleans it up and removes the need for a second number like the 5711 scenario.

Implementation idea:

New IVR router: server/routes.twilioIvr.ts

tenantPhoneConfig.ivrMode determines whether canonical endpoint:

Directly forwards (simple), or

Delegates to IVR logic.

2.3 SIP → Groundwire Flow (Your Own Calls)

For your business (root tenant):

Twilio number → /twilio/voice/incoming → TwiML:

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

You answer calls like a human now, with caller ID and custom ringtone.

Over time, you can blend:

Live answering

AI voice receptionist

SMS follow-ups

2.4 tenantPhoneConfig Table

In shared/schema.ts:

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

2.5 Call Handling & PWA Experience (Roadmap)

Problem you called out:

Right now we’re forcing people through a third-party dialer and SIP setup just to get caller ID passthrough and custom ringer. That’s friction and feels non-premium.

ServicePro objective:

Make the call handling experience feel like a real app, not a wiring project.

Short-term “good” (v1)

Platform-managed Twilio number per Pro/Elite tenant.

IVR default pattern (Press 1 info/SMS, Press 2 talk, Press 3 voicemail).

Forward-to-cell as the default for “Press 2”:

No SIP config required for most tenants.

Caller ID passthrough via Twilio <Dial> with proper callerId.

Admin UI to set:

Primary call forwarding number.

Business hours (after-hours goes to voicemail).

Toggle IVR vs direct dial.

Medium-term “better”

Offer optional SIP/softphone mode for advanced tenants:

We generate SIP credentials.

Provide step-by-step guided setup for a recommended softphone app (like you experienced with Groundwire), but:

No Twilio console.

All info in a single “Connect Your SIP App” page.

QR-code or copy-paste config.

The tenant never touches Twilio. ServicePro acts like the “carrier”.

Long-term “best” (PWA call console)

Build a ServicePro PWA call console:

Full-screen PWA with:

Incoming call UI (caller name from CRM).

Custom ringtone.

Accept / decline / send-to-voicemail buttons.

“Open customer record” quick action.

Uses:

WebRTC or similar to handle audio in the browser/iPad.

Your telephony backend as signaling/origin.

PWA behaviors:

“Add to Home Screen” prompts with branded icon.

Fullscreen mode on long-press / launch.

Persistent login for techs/owners.

Clean offline states (if no network).

This gives you:

Phase 2: “Works great with phone forwarding”

Phase 2.5+: “Optional SIP app with guided setup”

Phase X: “Native-feeling PWA call console”

All aligned with the white-label, premium ServicePro story.

PHASE 3 – AI MESSAGING BRAIN & KNOWLEDGE BASE

(unchanged in spirit, kept for completeness)

3.1 Core “Agent Brain” Service

Create server/aiAgent.ts with:

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


All SMS / web chat / (later voice) routes call this instead of embedding logic.

3.2 Knowledge Base Integration

Seed from:

Master_CleanMachine_AgentKnowledgeBase_AutoReady.xlsx

WHITE_LABEL_GUIDE.md

FAQ content

Service definitions

Policies (rain, cancellations, deposits, etc.)

Design:

Global base knowledge (all tenants).

Tenant-specific overrides.

Later: industry pack overlays.

3.3 Customer Booking Agent (Per Tenant, Customer-Facing)

As before:

Answers “what/price/where/how long”.

Drives toward booking.

Works on SMS & web chat.

Uses tenant’s services, policies, and calendar availability.

PHASE 4 – AI VOICE RECEPTIONIST (OPENAI REALTIME)

(unchanged in concept; relies on Phase 2 canonical entry & agent brain)

server/voiceGateway.ts

Twilio <Stream> → OpenAI Realtime → handleAgentMessage → TTS back to Twilio.

Reuses SMS booking flow logic; just a different channel.

PHASE 5 – SAAS TIERS, ONBOARDING AGENTS, WEBSITE GENERATOR

(same as v3.1, with tenant_config now explicitly in place from Phase 2A)

tenants.planTier, tenants.status

tenantBilling table

TIER_FEATURES + hasFeature helper

Starter vs Pro vs Elite behavior

Onboarding agents for setup (Starter: more BYO; Pro/Elite: “Shopify-like”).

Website generator with ~10 curated templates using WebsiteSeed data.

Free 14-day trial flow.

(I’m keeping all previous content; you can paste from v3.1 as-is for these sections – nothing in our last few chats changes the plan here.)

PHASE 6 – INDUSTRY PACKS & AUTO-SETUP

(same as v3.1)

server/industryPacks.ts

Seeds services, FAQs, IVR copy, SMS templates, agent instructions.

PHASE 7 – SUPER-TENANT OPS (BILLING, MONITORING, SCALING)

(same as v3.1)

Stripe-powered billing.

Tenant health dashboard.

Caching, queues, and potential DB isolation for big customers.

PHASE 8 – PLAN TIERS, UPGRADES, AND USAGE BILLING (v3.2)

(same as v3.1, but now explicitly tied to tenant_config.tier + tenants.planTier)

Upgrade flows that don’t require re-onboarding.

Non-payment handling: suspend but don’t delete.

Data retention for months after suspension.

PHASE 9 – TELEPHONY MODEL & TWILIO UX (v3.2)

This now ties together:

Canonical voice entry-point (2.1 – DONE).

Single-number IVR pattern (2.2).

Provisioning and tenantPhoneConfig.

Platform-managed Twilio as default (tenants never log into Twilio).

Optional BYO Twilio for advanced users.

Suspension behavior:

Active/trial: normal telephony.

Past_due: warn + limit campaigns first.

Suspended: stop automations; possibly let inbound caller hear “account paused” message, but number and config kept for retention window.

PHASE 10 – AI SETUP & SUPPORT AGENTS (PRODUCT-AWARE COPILOTS)

(same as v3.1, but now they can also surface tips about telephony & PWA)

Setup agent knows about:

“One-number IVR” default.

Forward-to-cell vs SIP vs future PWA console.

Support agent can:

Read tenant_config, tenantPhoneConfig.

Help debug “why don’t my calls ring?” with context.

PHASE 11 – DATA EXPORT & RETENTION

(unchanged)

CSV/JSON export of all key entities.

Available even when suspended (if you allow).

Background job + signed URL downloads.

PHASE 12 – INTEGRATIONS & KEYS CHECKLIST

(same as v3.1, plus we now know Twilio is fully platform-owned for Pro/Elite tenants)

Platform env vars: DB, OpenAI, Twilio, Stripe, SendGrid, Google, PWA/VAPID.

Per-tenant config in DB (no per-tenant env vars).

PHASE 13 – IDEA PARKING LOT / FUTURE ENHANCEMENTS

Still active, plus:

PWA Call Console with:

Full-screen mode.

Long-press and home-screen-capable UX.

Custom branding per tenant.

Auto SIP credential provisioning & QR-code setup for power users.

Single “Upgrade to Pro” flow that also upgrades telephony from shared/basic to dedicated-number IVR.