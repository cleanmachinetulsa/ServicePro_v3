🔽 MASTER PLAN v3.3 – SERVICEPRO MULTI-TENANT SUPER-SYSTEM

This supersedes v3.2.
Canonical roadmap for you, your partner, Replit agents, and future contributors.

0. HIGH-LEVEL NORTH STAR

Product: Turn the existing Clean Machine app into ServicePro – a multi-tenant, white-label, AI-powered service business OS.

Clean Machine = root tenant (your flagship business)

Other businesses (detailers, lawn care, cleaners, pet groomers, photographers, etc.) = child tenants.

All share:

One codebase

One Twilio “super-tenant” telephony backbone

One AI brain framework, customized per industry and per tenant

Each tenant gets:

Their own phone number(s)

Their own SMS/voice/IVR experience

Their own branding, services, pricing, and website

Their own AI agents:

Onboarding/setup agent

Customer booking agent

Customer support/help agent

MASTER PLAN v3.3 = Take your current Clean Machine codebase and layer on:

✅ True tenant isolation (done for root; ready for more tenants)

✅ Telephony spine (canonical voice entry + tenant phone config)

✅ Tenant registry & admin UI

🔄 AI messaging brain + conversation management

🆕 Unified loyalty & promo engine with anti-abuse

🆕 Customer identity & login (OTP + magic links)

🆕 Customer master backfill (6+ years of your data → clean CRM)

White-label onboarding, industry packs, website generator

SaaS tiers, trials, provisioning & billing (Stripe)

Root “super-tenant” dashboard for you

AI setup/support agents for tenants

Data export & retention

1. CURRENT STATE SNAPSHOT
1.1 Clean Machine / ServicePro Repo (Reality Today)

Backend:

server/index.ts – Express + TypeScript

Drizzle + Neon/Postgres

Route files for calls, appointments, loyalty, campaigns, etc.

Schema:

shared/schema.ts – customers, appointments, invoices, loyalty, campaigns, conversations, etc.

Frontend:

Vite/React app

Pages & components for:

Scheduling

SMS conversations

Dashboards

Settings

Loyalty, campaigns, etc.

Docs:

WHITE_LABEL_GUIDE.md

TWILIO_* setup guides

PWA docs

Deployment notes

Telephony routes:

server/routes.twilioVoice.ts

server/routes.voiceWebhook.ts

server/routes.smsFallback.ts

server/routes.calls.ts

server/routes.twilioStatusCallback.ts

SMS consent, campaigns, appointments, notifications

Business logic routes:

Appointments / quick booking / cancellations

Loyalty & rewards (routes.loyalty.ts, invoice loyalty, loyaltyService etc.)

Tags, tech profiles, contacts, gallery, recurring services, calendars…

AI bits already present:

conversationClassifier.ts

conversationState.ts

aiSuggestionService.ts

Damage assessment helpers

Role-aware notifications, etc.

Knowledge base artifacts:

Master_CleanMachine_AgentKnowledgeBase_AutoReady.xlsx

HOMEPAGE_FEATURE_INVENTORY.md

PWA docs

➡️ Clean Machine has evolved into a feature-rich single-tenant system. v3.3 continues the migration into ServicePro multi-tenant without losing functionality.

1.2 Tenant Isolation Backbone (ServicePro Core)

Tenant isolation / ServicePro backbone introduces:

tenantDb wrapper (Drizzle wrapper injecting tenant_id)

tenantMiddleware attaching req.tenant and req.tenantDb

Tenant isolation tests

Pattern:

// BEFORE
await db.query.customers.findFirst({
  where: eq(customers.id, id),
})

// AFTER
await req.tenantDb.query.customers.findFirst({
  where: req.tenantDb.withTenantFilter(customers, eq(customers.id, id)),
})


Status:

Phase 1A–1H migrated ~800+ DB ops across ~86 files

Tenant isolation tests: ✅ all passing

Root tenant (tenant_id = 'root') fully working

New tenants & tenant_config tables in place

2. PHASE STRUCTURE (ROADMAP)

We keep the original skeleton but now extend it with new phases for:

Unified promo/loyalty engine (anti-abuse)

Customer identity & login (OTP + magic links)

Customer master backfill & historical merge

Phase overview:

Phase 0 – Canonicalization & Docs

Phase 1 – Tenant Isolation & Multi-Tenant Core

Phase 2 – Telephony Spine (SMS, Voice, SIP, IVR)

Phase 2A – Tenant Registry & Admin UI ✅

Phase 3 – AI Messaging Brain & Knowledge Base

Phase 4 – AI Voice Receptionist (OpenAI Realtime)

Phase 5 – SaaS Tiers, Onboarding Agents, Website Generator

Phase 6 – Industry Packs & Auto-Setup

Phase 7 – Super-Tenant Ops (Billing, Monitoring, Scaling)

Phase 8 – Plan Tiers, Upgrades, Usage Billing

Phase 9 – Telephony Model & Twilio UX

Phase 10 – AI Setup & Support Agents (Product-Aware Copilots)

Phase 11 – Data Export & Retention

Phase 12 – Integrations & Keys Checklist

Phase 13 – Idea Parking Lot / Future Enhancements

Phase 14 – Unified Loyalty & Promo Engine (Anti-Abuse) 🆕

Phase 15 – Customer Identity & Login (OTP + Magic Links) 🆕

Phase 16 – Customer Master Backfill & Historical Merge 🆕

You don’t have to execute these strictly in order; the doc just gives a consistent map Replit and you can follow.

PHASE 0 – CANONICALIZE & ORGANIZE

(As before; v3.3 just reaffirms this.)

MASTER_PLAN_v3.3.md lives at repo root.

Any major feature (telephony, AI agents, loyalty engine, identity, onboarding) gets reflected here.

Replit agents are instructed: read this file first and obey its conventions.

PHASE 1 – TENANT ISOLATION & MULTI-TENANT CORE

(As in v3.2, but now considered complete for current scope.)

tenantDb and tenantMiddleware in place

Most routes migrated to req.tenantDb + withTenantFilter

Root tenant seeded

Tenant isolation tests ✅

This phase is your safety net: every new feature must respect tenantId.

PHASE 2 – TELEPHONY SPINE (SMS, VOICE, SIP, IVR)

Same as v3.2 with:

2.1 Canonical voice entry-point ✅

2.2 tenantPhoneConfig ✅

2.3 Single-number IVR pattern (Press 1 info/SMS, Press 2 talk, Press 3 VM, Press 7 easter egg) – design complete, implementation in progress

2.4 SIP → Groundwire for root tenant

2.5 Call handling & PWA console roadmap

2.6 Voice models & providers (Polly/OpenAI/ElevenLabs) design

(No major changes here; just reaffirmed.)

PHASE 2A – TENANT REGISTRY & ADMIN UI ✅

As previously documented:

tenants + tenant_config

Admin endpoints: /api/admin/tenants etc.

React page: AdminTenants with cards, tiers, root highlight

Role-based access

This is your ServicePro admin dashboard for managing tenants.

PHASE 3 – AI MESSAGING BRAIN & KNOWLEDGE BASE

Now updated to reflect what we’ve done and what’s next.

3.1 Core Agent Service

server/aiAgent.ts (or equivalent) with:

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
  nextActions?: {
    type: 'book' | 'reschedule' | 'collect_info' | 'handoff' | 'confirm';
    payload?: any;
  }[];
}


All SMS + web chat (and later voice) eventually route through handleAgentMessage.

3.2 Knowledge Base Integration

Global base knowledge (common actions, generic policies)

Industry pack layer (detailing, lawn care, house cleaning, etc.)

Tenant-specific overrides (services, prices, rain policy, etc.)

Data sources:

Master KB spreadsheet

Industry packs (Phase 6)

Tenant config

3.3 Customer Booking Agent (Per Tenant)

Channel-aware: SMS, web widget, later voice

Goals:

Answer what/where/how much

Drive to confirmed appointments

Use tenant services & calendars

Apply upsells intelligently

3.4 SMS Agent Prompt Builder v2 (Tenant & Industry Aware) ✅

This is the work you just completed:

server/ai/smsAgentPromptBuilder.ts:

Uses tenant-specific business name, industry type, services/pricing.

Enforces key rules:

Don’t invent prices; use DB.

Ask for photos when needed.

Use booking link when appropriate.

Keep responses SMS-sized (≤ 160/320 chars when possible).

Integrates plan tiers + industry packs.

server/openai.ts:

When platform === 'sms' and tenantId is provided:

Uses SMS-specific prompt builder.

Has graceful fallback to generic prompts.

This maps to what we previously called “Phase 11”; now it’s explicitly part of Phase 3.

3.5 Professional Conversation Management – Smart Hand-Off & Smart Schedule ✅

What you called Phase 12 is now explicitly documented here:

server/smartConversationParser.ts:

AI-powered extraction of:

Schedule intent

Dates, times, windows

Services requested

Address/service area hints

Handback readiness analysis (is this safe for AI again?)

server/enhancedHandoffService.ts:

Human takeover with agent assignment

Smart scheduling from messy threads → structured bookings

Intelligent handback to AI with context and mode switching

Multi-tenant safe (tenantDb.withTenantFilter everywhere)

Endpoints in server/routes.conversations.ts:

POST /api/conversations/:id/smart-schedule

POST /api/conversations/:id/smart-handback

GET /api/conversations/:id/handback-analysis

Frontend:

ConversationMetaBar

SmartSchedulePanel

HandoffControls

HandbackAnalysisPanel

This is done and secure, and is now the canonical “Phase 3.5”.

3.6 Campaign-Aware Agents (Welcome Back & Future Promos) (Design complete; partial implementation)

Shared campaignContextService:

Given { tenantId, customerId } returns:

hasRecentCampaign

campaignKey

campaignName

lastSentAt

bonusPointsFromCampaign

currentPoints

SMS + web-chat prompt builders:

Inject CAMPAIGN CONTEXT when present:

“This customer recently received the ‘Welcome Back: New System Launch’ campaign…”

Behavior rules:

If customer mentions “your message/text”, “points”, “welcome back”, “new system”:

Assume they mean the latest campaign.

Confirm and explain the offer.

Drive toward booking or using points.

Never respond “I don’t know what you’re referring to” as first answer.

This design is generalized so future promos (referral, review bonus, seasonal campaigns) can reuse the same pattern via Phase 14’s promo engine.

PHASE 4 – AI VOICE RECEPTIONIST (OPENAI REALTIME)

No major change from v3.2 — this phase reuses:

The agent brain from Phase 3

Telephony spine from Phase 2

Voice provider config from 2.6

Goal: a true AI voice receptionist per tenant with the same intelligence as SMS/web.

PHASE 5 – SAAS TIERS, ONBOARDING AGENTS, WEBSITE GENERATOR

Same as v3.2, but now tightly coupled with later identity/promo phases.

Tier model (starter/pro/elite)

Onboarding agents (different flows by tier)

Tenant support agent (in-app copilot)

Website generator with curated premium templates

PHASE 6 – INDUSTRY PACKS & AUTO-SETUP

Same core idea:

industryPacks describing defaults for:

Services

Add-ons

Durations

SMS templates

IVR patterns

FAQ seeds

AI instructions / jargon

These feed:

Onboarding

AI agents

Website generator

Promo engine defaults (Phase 14)

PHASE 7 – SUPER-TENANT OPS (BILLING, MONITORING, SCALING)

No major changes vs v3.2:

Stripe-based billing

Tenant health & usage stats

Monitoring & logs per tenant

Scaling strategies for heavy tenants

PHASE 8 – PLAN TIERS, UPGRADES, AND USAGE BILLING

As before:

planTier and status on tenants

tenantBilling for Stripe linkage

TIER_FEATURES / hasFeature() gating

Upgrade/downgrade flows

Suspension behavior that never deletes data

PHASE 9 – TELEPHONY MODEL & TWILIO UX

As before:

Platform-managed Twilio for Pro/Elite

Optional BYO Twilio for advanced tenants

Number provisioning service

Telephony behavior tied to tenant status (active/trial/past_due/suspended)

PHASE 10 – AI SETUP & SUPPORT AGENTS (PRODUCT-AWARE COPILOTS)

As before, but note:

These support agents will also understand:

Loyalty/promo engine (Phase 14)

Identity/login flows (Phase 15)

Backfill status (Phase 16)

So tenants can get help like:

“Why didn’t this customer get the Welcome Back bonus?”
“How does the OTP login work for customers?”

PHASE 11 – DATA EXPORT & RETENTION

As before:

Per-tenant export (customers, jobs, invoices, messages, loyalty, etc.)

Retention policies for past_due/suspended/cancelled

PHASE 12 – INTEGRATIONS & KEYS CHECKLIST

As before:

Platform env vars:

DB, OpenAI, Twilio, Stripe, SendGrid, Google, voice providers

Per-tenant config in DB:

tenant_config, tenantPhoneConfig, voice config, BYO creds, etc.

PHASE 13 – IDEA PARKING LOT / FUTURE ENHANCEMENTS

Same idea: a live bucket for future big ideas (more site templates, PWA console, review widgets, etc.) that we’ll hydrate into real phases later.

🆕 PHASE 14 – UNIFIED LOYALTY & PROMO ENGINE (ANTI-ABUSE)

Goal: Replace “one-off campaign logic” with a single, central promo/loyalty engine that:

Awards points safely

Enforces anti-abuse rules

Works across all promo types (Welcome Back, referrals, review bonuses, seasonal campaigns)

Is multi-tenant and plan-aware

14.1 Central API: awardPromoPoints

Design a server-level service:

interface AwardPromoPointsArgs {
  tenantId: string;
  customerId: string;
  promoKey: string;       // 'welcome_back_v1', 'referral_v1', 'review_bonus_v1', etc.
  basePoints: number;     // proposed number of points
  metadata?: Record<string, any>;
}

interface AwardPromoPointsResult {
  awarded: boolean;
  pointsGranted: number;
  reason?: string;        // e.g. 'already_awarded', 'household_limit', etc.
}


All campaigns call this, not raw “add points” methods.

14.2 Anti-Abuse Rules (Configurable, Defaults for You)

Central rules implemented inside awardPromoPoints:

Per-customer + per-promo cap

Only one welcome_back_v1 per customerId ever (or per 12 months).

Per-household cap (using address/household ID, see Phase 16)

Only X bonuses from the same normalized address per year.

Eligibility rules per promo

Example for Welcome Back:

Must have at least 1 completed job before promo launched, or

Customer created before WELCOME_BACK_LAUNCH_DATE.

Global promo caps (optional)

Max total redemptions of a given promo if you ever want to limit.

Pending vs “live” points

For large bonuses (like 500 pts), you can:

Mark them as pendingPromoBonus

Only convert to active points after next completed job.

All of this is driven by a PROMO_RULES config:

const PROMO_RULES = {
  welcome_back_v1: {
    perCustomerLifetimeMax: 1,
    perHouseholdPerYearMax: 1,
    requireExistingJob: true,
    awardMode: 'pending_until_next_completed_job',
    basePointsVip: 500,
    basePointsRegular: 100,
  },
  referral_v1: {
    perCustomerPerYearMax: 5,
    awardMode: 'immediate_on_completed_job',
    // ...
  },
  // ...
} as const;

14.3 Loyalty Storage & Audit

Under the hood:

loyalty_balances (per {tenantId, customerId})

loyalty_transactions table:

tenantId

customerId

deltaPoints

promoKey (nullable)

source (e.g. 'campaign', 'manual_adjustment', 'redemption')

metadata (JSON)

createdAt

The promo engine only writes via a trusted “award points” function, so later audits are easy.

14.4 Household Awareness

To block “same house, 5 phone numbers” abuse:

Introduce a household abstraction:

Either:

households table with normalized address → householdId

Or an internal mapping tied to customer records.

For promos that should be per-household (Welcome Back), awardPromoPoints looks at:

Other customers with same householdId who already received that promoKey.

If found:

You can:

Deny bonus, or

Give a smaller “secondary” bonus.

14.5 Simple Abuse Monitoring View (Later UI)

Add an admin-only table in the ServicePro admin dashboard:

“Potential Abuse” list:

Customers/households hitting promo caps

Suspicious clusters (multiple customers at same address, many promo triggers in short window)

You don’t have to act on it, but it gives you visibility.

🆕 PHASE 15 – CUSTOMER IDENTITY & LOGIN (OTP + MAGIC LINKS)

Goal: Move from “phone number only” to a real identity system that’s still super smooth for customers:

Under the hood: everything keyed by customerId

For customers: login feels like Uber/Doordash:

Enter phone → OTP or magic link → you’re in.

15.1 Internal Identity Model

Canonical model:

customers table extended with:

id (primary key)

tenantId

name

phone

email (optional)

address (structured)

firstJobDate

lastJobDate

totalJobs

totalLifetimeValue

householdId (optional, from Phase 16)

source / importSource (sheet, sms_history, portal, etc.)

isVip flag(s)

Points, promos, bookings all key off {tenantId, customerId}.

Phone and email are identifiers, not the primary key.

15.2 Customer Portal Concepts

Per tenant, customers will eventually have a portal where they can:

See:

Points balance

Recent jobs

Upcoming appointments

Book new services (with info prefilled)

Use points at checkout

Portal authentication uses OTP and magic links.

15.3 OTP Login (v1 – Simpler, Ship Sooner)

Flow:

Customer goes to “Sign in” or “Check my points” on the tenant’s site.

Enters phone number.

Server:

Looks up {tenantId, phone} → customerId (or offers “create account” if allowed).

Generates a short-lived OTP code (e.g. 6 digits), stores in login_tokens table.

Sends SMS via tenant’s Twilio number.

Customer enters code → POST /api/customer/verify-otp:

Validate code & expiry.

Mark token as used.

Create a customer session (cookie or JWT) tied to customerId.

Redirect to portal (points + history).

This preserves your “phone-first” experience but makes it actually secure and private.

15.4 Magic Links (v2 – Magical Feel)

On top of OTP, we add magic links (primarily for email, but can work with SMS too).

Flow:

Customer enters phone or email.

System resolves or creates a customer record.

System generates a signed token stored in login_tokens (type: 'magic_link'), with:

tenantId

customerId

expiresAt

usedAt (null)

System sends:

Email: “Click to access your Clean Machine/ServicePro portal” with link:

https://tenant-domain.com/magic-login?token=XYZ

Or SMS version if you want.

Customer clicks link:

GET /magic-login?token=XYZ

Backend validates token:

Not expired

Not used

Marks as used.

Creates session.

Redirects into portal.

This is a bit more wiring than OTP (sessions + token DB + redirect flows), which is why it’s “later” — but it’s absolutely in-scope for ServicePro v3 and you’ll ultimately have both.

15.5 Tenant Isolation & Plan Gating

Starter tenants may only get barebones OTP or nothing (manual booking only).

Pro/Elite get full customer portal + OTP.

Magic links might be gated to Pro/Elite (or just default for everyone, up to you).

🆕 PHASE 16 – CUSTOMER MASTER BACKFILL & HISTORICAL MERGE

Goal: Take your 6+ years of customers (Sheets + SMS + current DB) and merge them into a clean, canonical customer database for the root tenant (Clean Machine), and later for other tenants.

This prevents your real customers from being treated as “new” when loyalty, promos, and AI go live.

16.1 Canonical Customer Schema

For {tenantId, customerId} (starting with tenantId='root'):

Fields as described in Phase 15.1.

This schema is already mostly there; we’ll extend it and enforce it.

16.2 Sources of Truth to Merge

Google Sheets tabs:

Customer information

Live Client Requests

Customer_info_sheet

Any others used in your current pipeline

SMS history:

Exported SMS HTML now being transformed for knowledge base.

We extend the pipeline to:

Extract phone numbers

Extract names/addresses from conversation when possible

Existing DB:

customers table

appointments, invoices, etc. used to compute firstJob/lastJob totals.

16.3 Backfill Pipeline (Root Tenant First)

Implement a one-time (and rerunnable) backfill job:

Extract & normalize from Sheets

Normalize phone formats.

Normalize addresses.

Extract vehicles (year/make/model) into customer_vehicles if present.

Build an in-memory dictionary keyed by (tenantId='root', phone).

Extract from DB

For existing customers rows:

Merge onto the same (tenantId, phone) records:

Fill missing fields.

Calculate:

firstJobDate

lastJobDate

totalJobs

totalLifetimeValue

Extract from SMS (optional v1, v2 later)

As we parse SMS threads, any number not yet in the DB:

Create a new customer entry with:

phone

name if we find patterns (“Hi, this is John…”)

importSource = 'sms_history'

Dedup & merge

Rules:

Same phone → same customer (primary)

Same normalized address + similar name → candidate for merge

For auto merges: do them safely.

For ambiguous cases: mark with needsReview = true and surface in admin UI.

Write into DB

Upsert into customers table.

Populate household IDs based on address (for Phase 14).

16.4 Existing vs New Customer Flags

Once backfill is done:

For each customer, set:

firstJobDate

isExistingCustomer = firstJobDate < promoLaunchDate (for Welcome Back, etc.)

Promo engine (Phase 14) and AI agents can then:

Treat them correctly:

Welcome Back = existing only

New Customer promos = firstJobDate >= some threshold

16.5 Extending to Other Tenants

For future ServicePro tenants:

They might onboard with:

CSV imports

Google Sheets

Manual entry

We will:

Reuse the same mastering strategy:

A “Customer Import & Merge” tool per tenant:

Upload data

Map columns

Deduplicate by phone/address

Backfill firstJob/lastJob where possible

TL;DR – WHAT’S NEW IN v3.3 (BIG PICTURE)

New things we’ve now formally baked into the plan:

Unified Promo & Loyalty Engine (Phase 14)

One awardPromoPoints function for all promos

Anti-abuse (per customer, per household, per year, pending bonuses)

Multi-tenant & plan-aware

Customer Identity & Login (Phase 15)

Everything keyed by customerId inside

Customer portal with:

SMS OTP now

Magic links later

Smooth, modern login that feels “magical” but is secure & private.

Customer Master Backfill (Phase 16)

Merge 6+ years of your real customers into a clean DB

Use Google Sheets + SMS + DB

Deduplicate + compute history

Power promos, loyalty, AI, and “existing vs new customer” logic correctly.

Campaign-Aware Agents formally recognized (Phase 3.6)

Agents know about Welcome Back + future promos

Never act confused when a customer references “your message” or “points”.