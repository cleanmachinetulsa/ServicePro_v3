# MASTER PLAN v3.2 – SERVICEPRO MULTI-TENANT SUPER-SYSTEM

> Canonical master plan for:
> - You (Jody)
> - Your partner
> - Replit AI agents
> - Future contributors  
>
> This file is the **source of truth**. All major architecture and product changes should be reflected here.

---

## 0. NORTH STAR

**Product:** Transform the original Clean Machine app into **ServicePro** – a multi-tenant, white-label, AI-powered OS for service businesses.

- **Clean Machine** = **root tenant** (`tenant_id = 'root'`), flagship instance.
- Other businesses (detailers, lawn care, cleaners, pet groomers, etc.) = **child tenants**.

Shared:

- One codebase  
- One Twilio **super-tenant** telephony architecture  
- One AI framework (customized per industry + per tenant)  

Each tenant gets:

- Their own phone number(s) and routing
- Their own branding, services, pricing, and website
- Their own AI agents:
  - Onboarding / setup agent
  - Customer booking agent
  - Ongoing customer support agent

v3.x is about:

1. True multi-tenant isolation (already in place).
2. A telephony spine that can route SMS/Voice/IVR/AI per tenant.
3. Tiered SaaS (3 plans) with trials and upgrades.
4. Concierge setup + “login as tenant” tools.
5. Industry packs and website generator.
6. Product-aware AI support agents.
7. Clean billing, suspension, export, and retention.

---

## 1. CURRENT STATE SNAPSHOT

### 1.1 App & Architecture (Clean Machine → ServicePro)

**Backend**

- Express + TypeScript
- Drizzle ORM + Neon/Postgres
- Many routes for appointments, campaigns, loyalty, SMS, notifications, etc.

**Frontend**

- Vite + React
- Dashboard pages for SMS, calendar, customers, campaigns, settings, etc.
- Admin pages now include tenant + phone config management.

**Telephony & Comm**

- Twilio integration for SMS and voice.
- Canonical inbound voice route: `/twilio/voice/incoming`.
- Inbound SMS route `/sms` (now using centralized tenant resolution).
- `tenant_phone_config` table controlling per-tenant numbers + IVR mode.

**AI & Automation Bits**

- Early AI helpers for suggestions, conversation state, etc.
- SMS & call flows ready to be unified behind an AI “agent brain”.

---

### 1.2 Tenant Isolation Backbone (DONE)

Tenant isolation is baked directly into this repo (no separate ServicePro codebase):

- `server/tenantDb.ts`
  - Wraps base `db` with `tenantId`.
  - Injects `tenant_id` on writes, filters on reads.
- `server/tenantMiddleware.ts`
  - Resolves current tenant.
  - Attaches `req.tenant` and `req.tenantDb`.

Core tables now include `tenant_id`, with `root` as default for legacy data.

✅ Tenant isolation tests (11/11) passing.  
✅ Major routes migrated to use `req.tenantDb`.

---

## 2. PHASE ROADMAP (v3.2 OVERVIEW)

This is the high-level phase map. Detailed sections follow for the ones we’re working on now.

**Legend:**  
✅ = complete (in repo)  
🟡 = in progress / next up  
📝 = designed / future  

1. **Phase 0 – Canonicalization & Master Docs** ✅  
2. **Phase 1 – Tenant Isolation & Multi-Tenant Core** ✅  
3. **Phase 2 – Telephony Spine (SMS, Voice, SIP, IVR)**  
   - 2.1 Canonical Voice Entry-Point `/twilio/voice/incoming` ✅  
   - 2.2 `tenant_phone_config` schema ✅  
   - 2.5 Admin Phone & IVR Config UI ✅  
4. **Phase 3 – Tenant Communication Router** ✅  
   - 3.0 Central `resolveTenantFromInbound` (SMS + Voice) ✅  
   - 3.1 SMS middleware coverage hardening ✅  
5. **Phase 4 – AI Voice Concierge Entry Point** 🟡 (next)  
6. **Phase 5 – Concierge Setup Dashboard (Owner-only)** 📝  
7. **Phase 6 – Impersonate Tenant (“Login as…”)** 📝  
8. **Phase 7 – Tiers, Billing, and Plan Features** 📝  
9. **Phase 8 – Industry Packs & Auto-Setup** 📝  
10. **Phase 9 – Website Generator (Templates + White-Label)** 📝  
11. **Phase 10 – AI Setup & Support Agents (Product-aware copilot)** 📝  
12. **Phase 11 – Data Export & Retention** 📝  
13. **Phase 12 – Integrations & Keys Checklist** 📝  
14. **Phase 13 – Idea Parking Lot / Future Enhancements** 📝  

---

## 3. PHASE 2 – TELEPHONY SPINE (STATUS)

### 3.1 Canonical Voice Entry-Point ✅

- **Route:** `POST /twilio/voice/incoming`
- Verifies Twilio signatures.
- Currently:
  - Resolves tenant (via `resolveTenantFromInbound`).
  - For `ivrMode = 'simple'`: SIP/forward behavior (e.g., to Groundwire).
- This is the **single inbound voice entry** for all tenants.

### 3.2 `tenant_phone_config` Table ✅

In `shared/schema.ts`:

- `tenant_phone_config` includes:
  - `tenant_id`
  - `phone_number` (E.164)
  - `messaging_service_sid`
  - SIP domain / username / password (encrypted)
  - `ivr_mode`: `'simple' | 'ivr' | 'ai-voice'`
- Root row seeded for Clean Machine (your 918 number).

Used by both SMS + Voice routing.

### 3.3 Admin Phone & IVR Config UI (Phase 2.5) ✅

- Backend: `server/routes.adminPhoneConfig.ts`
  - Full CRUD with shared `insertTenantPhoneConfigSchema`.
  - Root config protected (cannot delete).
  - E.164 validation, duplicate prevention, whitespace trimming, empty → `NULL`.
- Frontend: `client/src/pages/AdminPhoneConfig.tsx`
  - React Hook Form + zodResolver.
  - Tenant dropdown.
  - IVR mode selection: `simple` / `ivr` / `ai-voice`.
  - `data-testid` coverage.
- Docs updated (`replit.md`) to mark Phase 2.5 complete.

---

## 4. PHASE 3 – TENANT COMMUNICATION ROUTING ✅

### 4.1 Central `resolveTenantFromInbound` Service

New service (e.g. `server/services/tenantCommRouter.ts`):

- Single function powering inbound routing for **both** SMS + Voice:
  - Input: Twilio webhook (From, To, MessagingServiceSid, Body, etc.).
  - Output: `{ tenantId, tenant, phoneConfig, ivrMode, resolutionMeta }`.
- 3-tier resolution strategy:
  1. `MessagingServiceSid` → tenant.
  2. `To` phone number → `tenant_phone_config`.
  3. Fallback: `root` (for error handling / local dev).

Routes now use it:

- `/sms`
- `/twilio/voice/incoming`
- Future: `/twilio/voice/ai`, other inbound comms.

### 4.2 Middleware & Context

After resolution, routes have:

- `req.tenant`  
- `req.tenantDb`  
- `req.phoneConfig`  
- Some `req.tenantResolution` metadata (how the mapping was found).

### 4.3 Tests & 3.1 Hardening ✅

- **Unit tests:** routing logic (16/16).
- **Integration tests:**
  - Voice (full middleware stack): 8 tests.
  - SMS: 6 tests, now upgraded to hit real `/sms` route with the actual normalization middleware.
- Phase 3.1 (hardening) closed the gap:
  - SMS integration tests now use **full production middleware**, including phone normalization.
  - Tenant resolution behavior is verified with real inbound shapes.

Result: **Inbound routing is now production-grade and deterministic.**

---

## 5. PHASE 4 – AI VOICE CONCIERGE ENTRY POINT 🟡 (NEXT)

This is what your current Replit snippet is implementing.

### 5.1 Goals

- Add `/twilio/voice/ai` as the AI voice webhook endpoint.
- Wire `ivrMode = 'ai-voice'` to this path.
- Implement a **static TwiML placeholder** AI receptionist now.
- Leave a clean seam for future streaming OpenAI / ElevenLabs integration.

### 5.2 Components

- `server/services/aiVoiceSession.ts`
  - `handleAiVoiceRequest({ tenant, phoneConfig, body }) → { twiml }`
  - Simple, friendly `<Say>`-based concierge for now.
- `server/routes.twilioVoiceAi.ts`
  - Verifies Twilio.
  - Uses `resolveTenantFromInbound`.
  - Guards misconfig / missing tenant.
- `/twilio/voice/incoming`
  - Branches on `phoneConfig.ivrMode`:
    - `'ai-voice'` → AI handler.
    - `'ivr'` → DTMF menu (press 1/2/3/7).
    - `'simple'` → current SIP/forward.

### 5.3 Admin UI Indication

- In Admin Phone Config, show `AI Voice (Beta)` badge when `ivrMode = 'ai-voice'`.

---

## 6. PHASE 5 – CONCIERGE SETUP DASHBOARD (OWNER-ONLY) 📝

> This is your “done-for-you setup” control room.  
> You use this to configure tenants *for* them, offer premium onboarding, and do advanced wiring they never see.

### 6.1 Goals

- Allow you (and future staff) to:
  - Create tenants with one form.
  - Assign phone numbers and IVR modes.
  - Pick an industry pack and seed data.
  - Configure AI + website basics.
  - Trigger onboarding emails/texts.
- Expose fields that don’t exist in tenant UI (plan tier, flags, internal notes).

### 6.2 Core Features

- **Route / Page:** `/admin/concierge-setup`
- **Backend:**
  - Create tenant + tenant_config + default `tenant_phone_config` in a single transaction.
  - Choose:
    - Tier (starter / pro / elite).
    - Industry (detailing, lawn care, cleaning, etc.).
    - Provision platform-managed Twilio number.
  - Apply:
    - Industry pack (services, FAQs, default automations).
    - Base AI agent config.
- **UI:**
  - “New Tenant (Concierge)” flow:
    1. Basic info (name, city, contact).
    2. Plan + industry.
    3. Telephony provisioning.
    4. Optional extras (logo upload, simple color theme).
    5. Final review → Create.
  - After creation:
    - Buttons:
      - “Open tenant in impersonate mode” (Phase 6).
      - “Send onboarding email”.
      - “Copy quick login link”.

This is where you can include “extras” per tier (e.g. logo help, extra copywriting, IVR scripting) as part of your offer.

---

## 7. PHASE 6 – IMPERSONATE TENANT (“LOGIN AS…”) 📝

> This is your **God Mode for support**: jump into a tenant’s view and fix things as if you were them — with audit logs.

### 7.1 Goals

- Let owner-level users:
  - Click “Login as tenant” from Admin Tenants/Concierge pages.
  - Be instantly switched into the tenant’s dashboard session.
- Keep this **secure and auditable**:
  - Only owner-level accounts can impersonate.
  - Every impersonation is logged (who, which tenant, when).
  - It’s clear in the UI that you’re in impersonation mode.

### 7.2 Architecture Sketch

- Add `impersonation` concept to auth/session:
  - Real user ID = owner.
  - Effective tenant context = target tenant.
  - UI shows banner “You are viewing as [Tenant Name] – Exit”.
- Backend:
  - Middleware checks if `req.user` is impersonating.
  - Uses impersonated tenantId for `req.tenant` (but still knows the real actor).
- Logging:
  - Log impersonation start/stop events.
  - Tag sensitive changes made during impersonation.

> Concierge Dashboard (Phase 5) + Impersonation (Phase 6) together =  
> **fast done-for-you onboarding + elite support.**

---

## 8. PHASE 7 – TIERS, BILLING, AND PLAN FEATURES 📝

High level (details already designed previously):

- Add `planTier` and `status` fields to `tenants` (`starter` / `pro` / `elite`).
- Add `tenant_billing` table with Stripe metadata.
- Define `TIER_FEATURES` map and `hasFeature()` helper.
- Implement upgrade/downgrade flows via Stripe.
- Use `status` to control:
  - Active, trialing, past_due, suspended, cancelled.
- Make sure non-payment never deletes data; it only gates features.

---

## 9. PHASE 8 – INDUSTRY PACKS & AUTO-SETUP 📝

- Structured presets per industry:
  - Services, durations, upsells.
  - Default SMS/IVR/FAQ content.
  - AI agent instructions and vocabulary.
- Automatically applied during Concierge Setup (Phase 5) and self-serve onboarding.
- Makes “I don’t know where to start” disappear for new tenants.

---

## 10. PHASE 9 – WEBSITE GENERATOR 📝

- 6–10 curated, high-end React/Tailwind templates.
- Data-driven: fed by a `WebsiteSeed` object (business info, services, city, etc.).
- Tenants can:
  - Pick a template.
  - Adjust core copy/images/colors.
- You can also offer:
  - Concierge tier that includes you doing logo + copy + layout for them, still powered by the same engine.

---

## 11. PHASE 10 – AI SETUP & SUPPORT AGENTS 📝

- Product-aware copilot that:
  - Knows tenant config + docs + industry pack.
  - Can explain features in context (“you’re on the notifications page…”).
  - Can perform safe actions (update a setting, trigger a test).
- Appears as:
  - Setup wizard agent.
  - “Need help?” dock in dashboard.
  - Possibly as part of your own internal tooling for debugging.

---

## 12. PHASE 11 – DATA EXPORT & RETENTION 📝

- Per-tenant data export:
  - Customers, appointments, invoices, SMS logs, etc.
- Accessible even for suspended tenants (within a retention window).
- Background job to generate export + download link.

---

## 13. PHASE 12 – INTEGRATIONS & KEYS CHECKLIST 📝

Platform-level env vars:

- DB, OpenAI, Twilio super-tenant, Stripe, SendGrid, Google, etc.

Per-tenant config in DB:

- Telephony (phone config, BYO options).
- Voice config.
- Website + branding.
- Industry pack selection.

This section is mostly a checklist so you and your partner can onboard new infra cleanly.

---

## 14. PHASE 13 – IDEA PARKING LOT 📝

Short list of “future awesome”:

- PWA call console (web-based softphone with branding per tenant).
- Technician iPad advanced mode, multi-tenant aware.
- Agency-level white-label (your product as a white-label of a white-label).
- Review funnels + per-tenant Google review widgets.
- AI revenue analytics per tenant (showing how much the agent is “selling”).

---

## TL;DR – WHAT’S HAPPENING *RIGHT NOW*

- ✅ Telephony spine + tenant routing are complete and hardened.  
- 🟡 **You’re about to implement Phase 4: AI Voice Entry (`/twilio/voice/ai`).**  
- 🔜 After that, we pivot to **Phase 5 (Concierge Setup Dashboard)** and **Phase 6 (Impersonate Tenant)** to unlock:
  - Done-for-you setups as a premium offering.
  - Instant “fix it for me” support.

