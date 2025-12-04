🌟 MASTER PLAN v3.4 – SERVICEPRO MULTI-TENANT SUPER-SYSTEM

Canonical blueprint for:

You (Jody)

Your partner

Replit AI agents

Future developers

Platform scaling & white-labeling

This is the single source of truth.
All development must reference this file.

0. NORTH STAR
Product Vision

Transform Clean Machine into ServicePro — a multi-tenant, AI-powered operating system for service-based businesses.

Clean Machine = root tenant
Other businesses = child tenants

Shared:

Codebase

AI framework

Telephony infrastructure

Industry packs

Website templates

Tiered SaaS features

Each tenant has:

Their own phone number(s)

Their own AI messaging brain

Their own site & branding

Their own customer + service data

Their own plan tier

Their own onboarding flow

1. CURRENT STATE SNAPSHOT (v3.3)
1.1 Architecture
Backend

Node + Express

TypeScript

Drizzle ORM + Neon/Postgres

tenantDb injected DB isolation

Central telephony router

Loyalty, campaigns, customer, appointment systems

Frontend

React + Vite

Admin (you only)

Tenant dashboard

Customer portal (Phase 15)

Telephony

POST /twilio/voice/incoming canonical entry

tenant_phone_config table

IVR modes

Multi-tenant SMS + voice routing

AI (current)

AI SMS brain (Phase 14+ roadmap)

AI voice entry (static for now)

Agent prompt builder v2

Multi-tenancy

Complete and hardened

Every write includes tenant_id

Root tenant backfilled

2. PHASE ROADMAP (0–23)

Legend:
✔️ complete • 🟡 in progress • 📝 designed / future

Phase   Area    Status
0       Canonicalization        ✔️
1       Tenant Isolation Core   ✔️
2       Telephony Spine ✔️
3       Inbound Routing ✔️
4       AI Voice Entry  ✔️
5       Concierge Setup Dashboard       📝
6       Impersonate Tenant      📝
7       SaaS Tiers + Feature Gating     ✔️
8       Industry Packs  ✔️
9       Website Generator       📝
10      AI Setup & Support Agent        📝
11      Data Export & Retention 📝
12      Keys & Integrations Checklist   📝
13      Idea Parking Lot        ✔️
14      SMS Super-Agent Index   📝
15      Customer Identity (OTP/Magic Link)      🟡
16      Customer Master Backfill        📝
17      White-Label Branding + Domains  📝
18      ServicePro In-App Support Bot   📝
19      Analytics + Showcase Dashboards 📝
20      Template / Clone-a-Tenant Factory       📝
21      Advanced Analytics & Intelligence       📝
22      Agency Mode (Reseller White-Label)      📝
23      Free Tier Engine & Watermarked Sites    📝
3. PHASE 1 – TENANT ISOLATION ✔️

Fully implemented:

tenant_id columns

tenantDb helper

Isolation tests

4. PHASE 2 – TELEPHONY SPINE ✔️

Includes:

Canonical inbound entry

Multi-tenant phone config

IVR mode selection

Admin UI for phone config

5. PHASE 3 – TENANT COMMUNICATION ROUTER ✔️

resolveTenantFromInbound:

SMS + voice unified resolution

MessagingServiceSid → tenant

Fallback to root

Full tests

6. PHASE 4 – AI VOICE ENTRY POINT ✔️

Static AI receptionist with safe TwiML.
Future streaming-ready structure.

7. PHASE 5 – CONCIERGE SETUP DASHBOARD 📝

Owner-only power dashboard:

Create tenant

Assign phone numbers

Select industry pack

Apply Tier (starter/pro/elite/internal)

Provision website starter

Send onboarding links

“Login as tenant" button (Phase 6 hook)

8. PHASE 6 – IMPERSONATE TENANT 📝

Secure “Login as…”:

Audit logs

Session shows “You are viewing as…”

Owner can help tenants directly

9. PHASE 7 – TIERS, BILLING & GATING ✔️

Plan tiers:

starter

pro

elite

internal

Features gated using hasFeature(tenant, key).

Stripe wiring will be Phase 7B.

10. PHASE 8 – INDUSTRY PACKS ✔️

Per-industry starter template implemented with 17+ industry packs:

**Implemented Features:**
- ✔️ Industry pack configuration system (`shared/industryPacks.ts`)
- ✔️ 17 industry packs: detailing, lawn care, house cleaning, pet grooming, photography, HVAC, plumbing, electrical, moving, pressure washing, window washing, pool service, landscaping, roofing, flooring, painting, pest control
- ✔️ Automated service seeding with pricing, duration, descriptions
- ✔️ FAQ seeding with categories and keywords
- ✔️ AI style notes per industry (for Phase 10/14 integration)
- ✔️ Website seed data for Phase 9 integration
- ✔️ Backend service (`server/industryPackService.ts`)
- ✔️ Concierge UI integration with pack selection dropdown
- ✔️ Database field: `tenant_config.industry_pack_id`
- ✔️ Idempotent pack application (no duplicates)

**Integration Hooks (TODO):**
- 📝 Phase 9: Use `pack.websiteSeed` to pre-populate website templates
- 📝 Phase 10/14: Use `pack.aiStyleNotes` to configure AI agent tone
- 📝 Phase 23: Free tier uses industry packs as initial content

**Supported Industries:**
Auto detailing, lawn care, house cleaning, pet grooming, photography, HVAC, plumbing, electrical, moving, pressure washing, window washing, pool service, landscaping, roofing, flooring, painting, pest control

11. PHASE 9 – WEBSITE GENERATOR 📝

High-end builder:

6–10 templates

React/Tailwind components

Custom brand colors

Logo upload

Custom domain connection

SEO & OpenGraph presets

Connected to Industry Packs.

12. PHASE 10 – AI SETUP & SUPPORT AGENT 📝

Dashboard assistant that:

Reads tenant config

Reads industry pack

Reads service lists

Understands telephony/IVR setup

Helps configure automations

Can fix common issues automatically

Appears in “Need help?” sidebar

13. PHASE 11 – DATA EXPORT & RETENTION 📝

Per-tenant data export:

Customers

Appointments

Campaigns

Loyalty

Invoices

SMS/voice logs

Suspended/cancelled tenants still get export access.

14. PHASE 12 – INTEGRATIONS & KEY CHECKLIST 📝

Platform-level:

DB

OpenAI

Twilio super-tenant

SendGrid

Stripe

Google APIs

Per-tenant:

Phone config

Website settings

Industry configuration

Branding

15. PHASE 13 – IDEA PARKING LOT ✔️

Includes:

Technician PWA

Operator dashboard

Review funnel

Loyalty gamification expansion

AI revenue coaching

16. PHASE 14 – SMS SUPER-AGENT INDEX 📝

Master index of:

Intent classes

Structured agent actions

Scheduling logic

Customer state machine

Upsell engine

Industry pack integration

This phase maps all AI functionality.

17. PHASE 15 – CUSTOMER IDENTITY (OTP + MAGIC LINK) 🟡

V1 implemented:

OTP-based login (SMS)

Customer identity in database

V2 (Magic Link):

“Tap to login” URLs

Auto-login for returning customers

Portal pages:

Points

Appointment history

Vehicle list

Profile

18. PHASE 16 – CUSTOMER MASTER BACKFILL 📝

Merge historical:

Appointments

SMS conversations

Vehicles

Service history

Loyalty accrual

Customer deduping (phone/email)

This creates a unified Customer Master record.

19. PHASE 17 – WHITE-LABEL BRANDING + DOMAINS 📝

Enables full white-label:

Tenant branding (logo, color, name)

Toggle “powered by ServicePro”

Custom domain mapping

Tenant-themed:

booking page

customer portal

confirmation emails

receipts

SMS templates

20. PHASE 18 – SERVICEPRO SUPPORT CONCIERGE (ADMIN AI) 📝

Built-in support bot for tenants:

Knows your whole platform

Can explain ANY page

Can walk user through setup

Answers “How do I…?” questions

Helps configure:

IVR

Website

Industry pack

Apps & automations

Billing questions

Massively reduces live support load.

21. PHASE 19 – ANALYTICS + SHOWCASE DASHBOARDS 📝

Tenant dashboards:

Revenue

Booking volume

Customer LTV

Upsell rate

Loyalty impact

Repeat rate

Channel breakdown (phone/web/SMS)

Super-admin dashboards:

Tenants ranked

Revenue per tenant

Messaging volume

AI booking contribution

Churn prediction

Public “showcase mode” for demos.

22. PHASE 20 – TEMPLATE / CLONE-A-TENANT FACTORY 📝

Snapshot a tenant → use as template.

Copies:

Industry pack

Services/pricing

Automations

Campaigns

AI configs

Website theme

Massively accelerates onboarding.

23. PHASE 21 – ADVANCED ANALYTICS & INTELLIGENCE 📝

Predictive intelligence:

Forecast revenue

Detect declining customer behavior

Predict no-shows

Detect optimal pricing

AI-driven suggestions to tenants

Anti-churn alerts

24. PHASE 22 – AGENCY MODE (SUPER-WHITE-LABEL) 📝

Reseller mode:

Agencies manage multiple tenants

Agencies apply their own branding

Agencies have their own dashboard

Agencies can clone templates

Agencies handle their own billing

You bill the agency

This unlocks massive scale.

25. PHASE 23 – FREE TIER ENGINE & WATERMARKED SITES 📝

**Goal:**  
Create a strategically powerful **Free Tier** that:

- Costs ServicePro nearly nothing to run.
- Gives real value to small service businesses.
- Makes upgrading to paid plans feel natural and inevitable.
- Never leaks paid-only costs (SMS, AI, telephony) into the Free tier.
- Uses watermarked websites and locked features to constantly showcase Pro/Elite.

This phase introduces the **Free tier mechanics**, **feature gating rules**, **UX for locked features**, and **watermarked website mode**.

---

### 25.1 Free Tier Positioning

**Plan name example:**  
- `free` or `starter_free` (internal code)
- Public label: "Free", "Starter Free", or similar.

**Core principles:**

- Free tier is a **serious** starting point, not a demo.
- Free tier never triggers **per-usage expenses** for us:
  - No SMS sends.
  - No AI tokens.
  - No Twilio voice/IVR usage.
- Free tier helps users:
  - Organize their customers.
  - Define their services.
  - Launch a basic, watermarked website.
  - Get comfortable inside ServicePro.
- All automation, messaging, and AI are behind paid gates.

---

### 25.2 Free Tier – What's Included (Zero or Near-Zero Cost Features)

These features are fully available on the Free plan because they rely mostly on database reads/writes and static hosting:

1. **CRM / Customer Database (Manual-Only)**  
   - Unlimited customers (within reason; can add soft caps later if needed).
   - Customer profiles: name, phone, email, vehicles, notes.
   - Basic tags and simple segmentation fields.
   - Manual activity logging (notes, "had a call", "completed job").

2. **Manual Booking & Job Tracking (No automated comms)**  
   - Calendar view of jobs.
   - Ability to create/edit/delete bookings manually.
   - Manual status updates (scheduled / in progress / completed / cancelled).
   - Fields for price, service, and notes.
   - No automatic SMS/email reminders; all notifications remain manual or external.

3. **Industry Pack Setup (Read-Only / Manual Apply)**  
   - Choose an industry pack (detailing, lawn care, cleaning, photography, etc.).
   - Auto-seed:
     - Suggested services & add-ons.
     - Suggested durations.
     - Suggested base pricing (they can adjust).
   - Preloaded FAQs and example copy visible in the UI.
   - Free tier can use these to configure their CRM and services, but:
     - Automated agent behavior stays locked.
     - Campaigns & flows stay locked.

4. **Website Generator – Free, Watermarked Site**  
   - Free tier gets:
     - A hosted website at a shared ServicePro domain, e.g.  
       `tenantSlug.servicepro-sites.com` or equivalent.
   - They can:
     - Pick from 1–2 starter templates.
     - Customize:
       - Business name.
       - About text.
       - Services list.
       - Hero text and CTAs.
       - Colors (within reasonable bounds).
   - Restrictions:
     - **No custom domain** on free tier.
     - **Watermark footer**: "Powered by ServicePro – Upgrade to remove this branding".
     - Limit advanced layout features to Pro/Elite (locked but visible).
   - Booking CTA can:
     - Either open a simple intake form.
     - Or just show a contact form (submit to email) on free tier.

5. **Business Overview Dashboard (Lite Analytics)**  
   - High-level stats from their manually entered data:
     - Total customers.
     - Total jobs logged.
     - Basic revenue sum (from job entries).
   - This is all computed from DB data; no external costs.

6. **Settings & Branding (Basic)**  
   - Business profile (name, city, contact email, etc.).
   - Basic logo upload (within reasonable file limits).
   - Color theme selection (applied to website + basic dashboard UI).
   - Watermark is still visible on Free websites and optionally in footer.

---

### 25.3 Free Tier – What Is Explicitly Locked

The Free tier **must not** allow operations that cost us Twilio/AI money or that define the premium value of ServicePro.

These are **paid-only** (Pro/Elite/internal) features:

1. **SMS & AI Messaging**
   - Inbound and outbound SMS automation.
   - AI SMS agent responses.
   - Missed-call → text flows.
   - SMS campaigns and broadcasts.
   - Automated appointment reminders by SMS.
   - Any OpenAI-token-consuming behavior.

2. **Voice & IVR / AI Voice**
   - IVR menus.
   - AI voice receptionist.
   - Phone call routing.
   - Twilio voice usage (except maybe basic incoming mapping available only for paid tiers).

3. **Automations & Workflows**
   - Notification flows ("2 days before", "day-of", "follow-up").
   - Auto-tagging or auto-status changes based on events.
   - Customer lifecycle automations.

4. **Loyalty & Referral Systems**
   - Points accrual/redemption.
   - Referral tracking.
   - VIP tiers, rewards, and promo engines.

5. **Customer Portal & Logins**
   - Customer-facing portal.
   - Customer OTP / magic-link login.
   - Customer-visible loyalty balances.
   - Self-service booking management.

6. **Advanced Website Features**
   - Custom domain connection.
   - Additional templates library.
   - Website sections generated by AI.
   - Multi-language options (if offered).
   - Upsell sections (e.g., "most popular packages" powered by analytics).

7. **Bulk Actions & Campaigns**
   - Bulk SMS/email sends.
   - Campaign analytics dashboards.
   - Automated drip sequences.

8. **Multi-Tenant / Agency Features**
   - Managing multiple child businesses under one account.
   - Whitelabel / agency dashboards.

All of the above features should **clearly exist in the UI**, but be marked as locked features with a consistent visual pattern.

---

### 25.4 Feature Gating Rules (Backend)

Phase 23 extends the existing `planTier` + `hasFeature` mechanism:

1. Add a new plan tier value:

   - `planTier: 'free' | 'starter' | 'pro' | 'elite' | 'internal'`

   Where:
   - `free` = new Free tier.
   - Existing tenants (including root) retain their current tiers.

2. Update `TIER_FEATURES` to include a Free tier entry:

   Example (conceptual, actual mapping lives in code):

   - `free`:
     - `canUseCrm`: true
     - `canUseManualBookings`: true
     - `canUseIndustryPackSetup`: true (manual-only)
     - `canUseWebsiteGeneratorFree`: true
     - `canUseCustomDomain`: false
     - `canUseSms`: false
     - `canUseAiSms`: false
     - `canUseVoiceIvr`: false
     - `canUseCampaigns`: false
     - `canUseLoyalty`: false
     - `canUseCustomerPortal`: false

   - `starter`/`pro`/`elite`/`internal`:
     - Keep existing or future mappings as defined in Phase 7.

3. All backend routes that trigger cost or premium behavior should:

   - Call `hasFeature(tenant, 'featureKey')`.
   - Return 403 / 404 / controlled error for Free tier if feature is disallowed.
   - Never silently allow Free tier tenants to use SMS, voice, or AI.

---

### 25.5 Locked Feature UX & Upgrade Tease

The Free tier should clearly show what's possible, without being annoying.

1. **Locked UI Pattern**
   - For locked features, show:
     - A blurred or dimmed preview of the UI.
     - A small lock icon.
     - A caption like:  
       "Available on Pro and Elite plans – upgrade to unlock."
   - Clicking on the locked area opens:
     - An **Upgrade Modal** or navigates to the Pricing/Upgrade page.

2. **Examples:**
   - SMS page:
     - Show the existing layout, but with a "Pro Only" overlay.
   - Campaigns page:
     - Show a nice empty state graphic with "Upgrade to run campaigns".
   - Loyalty:
     - Show potential reward tiers as a teaser, with "Unlock Loyalty with Pro".

3. **Pricing & Upgrade Handoff**
   - Clicking upgrade CTAs should:
     - Take the tenant to a Pricing/Plans page, or
     - Open a dedicated "Upgrade" dialog where they can choose a paid plan.
   - When Stripe integration (Phase 7B) exists:
     - The upgrade path will integrate with Stripe checkout.
   - Before Stripe:
     - Can route to a "Contact us to upgrade" flow or manual onboarding.

---

### 25.6 Watermarked Website Mode

For Free tier websites:

1. Always include a footer watermark, e.g.:

   - "Powered by ServicePro – Upgrade to remove this branding."

2. This watermark:
   - Is rendered on all Free-tier booking/marketing pages.
   - Uses the platform brand, not the tenant brand.
   - Is removed automatically when tenant upgrades to Starter/Pro/Elite.

3. No custom domains:
   - Free tier is limited to `*.servicepro-sites.com` or similar.
   - Custom domain settings UI should:
     - Be visible but locked.
     - Show a short explanation:
       - "Connect your own domain on Pro or Elite plans."

4. This acts as:
   - A marketing engine for ServicePro (organic footprint).
   - A constant upgrade nudge for tenants.

---

### 25.7 Onboarding Flow for Free Tier

The Free tier onboarding should:

1. Invite the user to:
   - Choose their industry.
   - Confirm business name and city.
   - Pick a website template & color scheme.
   - Add 3–5 core services.
   - Add a logo (optional).

2. At the end:
   - Show their new website URL.
   - Encourage them to:
     - Add their first customers.
     - Add their first manual jobs.
   - Show a **"What you can unlock next"** panel with Pro/Elite features:
     - Automated texts.
     - AI assistant.
     - Loyalty & referrals.
     - Custom domain.

---

### 25.8 Interaction With Existing Phases

Phase 23 builds on:

- **Phase 7 – Tiers & Feature Gating**:
  - Extends `planTier` and `TIER_FEATURES`.
- **Phase 8 – Industry Packs**:
  - Uses packs as initial content for Free tier.
- **Phase 9 – Website Generator**:
  - Introduces Free tier variant with watermark and limited features.
- **Phase 10 – AI Setup & Support Agent**:
  - The assistant should know:
    - When a tenant is Free.
    - Which features are locked.
    - How to explain upgrades.
- **Phase 19 – Analytics & Showcase Dashboards**:
  - Can later show Free → Paid conversion metrics.

Status: **DESIGNED (📝)**  
Implementation will be handled by subsequent feature/build phases that hook into billing, feature gating, and website generation.

---

## 26. TENANT READINESS ENGINE (Phase 12)

### 26.1 Overview

The Tenant Readiness Engine provides automated production-readiness checks for any tenant. It inspects branding, website, telephony, email, AI features, and conversation activity to generate a comprehensive report.

### 26.2 Components

1. **Shared Types** (`shared/readinessTypes.ts`):
   - `ReadinessStatus`: "pass" | "warn" | "fail"
   - `ReadinessItem`: Individual check result with key, label, status, details, suggestion
   - `ReadinessCategory`: Group of related items (branding, telephony, etc.)
   - `TenantReadinessReport`: Full report with overall status and summary counts

2. **Readiness Service** (`server/services/tenantReadinessService.ts`):
   - `getTenantReadinessReportBySlug(identifier)`: Lookup by subdomain or tenant ID
   - Checks 6 categories: Branding, Website/Booking, Telephony, Email, AI/Booking Engine, Conversations

3. **Admin API Endpoint**:
   - `GET /api/admin/tenant-readiness/:tenantSlug`
   - Protected by auth + owner role
   - Returns `{ ok: true, report: TenantReadinessReport }`

4. **CLI Script** (`scripts/printCleanMachineReadiness.ts`):
   - Run: `npx tsx scripts/printCleanMachineReadiness.ts [identifier]`
   - Default: `root` (Clean Machine)
   - Outputs human-readable summary + JSON blob

### 26.3 Readiness Categories

| Category | Checks |
|----------|--------|
| Branding & Identity | tenant.exists, tenant.name, tenant.subdomain, branding.visual_identity |
| Website & Booking | website.enabled, website.booking_url, booking.services_configured |
| Telephony | phone_config_exists, sms_number_present, ivr_mode_configured, messaging_service |
| Email | global_sendgrid_config_present, tenant_profile_exists, reply_to_configured, status_healthy |
| AI & Booking Engine | plan_tier, booking_engine_enabled, industry_configured |
| Conversations | schema_present, recent_activity OR recent_activity_query_error OR schema_error |

### 26.3.1 Conversation Diagnostics

The conversations check uses distinct keys to differentiate between error states:

- **`conversations.schema_present`** (pass): Database table is accessible, shows total conversation count
- **`conversations.recent_activity`** (pass/warn): Recent 30-day activity check succeeded
- **`conversations.recent_activity_query_error`** (warn): Recent activity query failed (e.g., null lastMessageAt values)
- **`conversations.schema_error`** (fail): Database table query completely failed

This separation ensures diagnostics clearly indicate whether issues are with schema access, data quality, or expected tenant inactivity.

### 26.4 Usage

```bash
# Check Clean Machine (root tenant)
npx tsx scripts/printCleanMachineReadiness.ts

# Check specific tenant by subdomain
npx tsx scripts/printCleanMachineReadiness.ts my-business

# Check specific tenant by ID
npx tsx scripts/printCleanMachineReadiness.ts tenant-abc123
```

Status: **COMPLETE (✔️)**

---

🎯 CURRENT FOCUS (v3.4)

Phase 5 – Concierge Dashboard

Phase 6 – Impersonate Tenant

Phase 8 – Industry Packs

Phase 14–16 – SMS Super-Agent + customer identity

END OF MASTER PLAN v3.4

This is the canonical document.
Everything else must follow it.