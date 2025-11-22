Here’s your **MASTER PLAN v3.0** – rebuilt off the **actual Clean Machine repo you just uploaded** plus the **tenant isolation migration package** (servicepro-backbone.md) and the earlier white-label docs.

This is now the *canonical, up-to-date plan* for you + Replit + your partner.

---

# 0. High-level North Star

**Product:**
Turn your existing Clean Machine app into **ServicePro** – a **multi-tenant, white-label, AI-powered service business OS**.

* **Clean Machine** = **root tenant** (your business, flagship instance).
* Other businesses (detailers, lawn care, cleaners, etc.) = **child tenants**.
* All share:

  * One codebase
  * One Twilio “super-tenant” setup
  * One AI brain (customized per industry)
* Each tenant gets:

  * Their own phone number(s)
  * Own SMS/voice/IVR experience
  * Own branding, services, and automations.

MASTER PLAN v3.0 = **take your current Clean Machine code** (which is now very feature-rich) and layer on:

1. **True tenant isolation**
2. **Super-tenant telephony (Twilio, SIP, IVR, AI voice)**
3. **White-label onboarding + industry packs**
4. **Automated provisioning & billing**

---

# 1. Current State Snapshot (Based on Your Repo)

## 1.1 Clean Machine Repo (current reality)

From `cleanmachine-export.zip`, your app is:

* **Backend:** `server/index.ts` (Express + TypeScript, Drizzle, Neon/Postgres, etc.)
* **Schema:** `shared/schema.ts`
* **Frontend:** Vite/React app (via `vite.config.ts`, `public/` etc.)
* **Docs & guides:**

  * `WHITE_LABEL_GUIDE.md` (feature inventory)
  * `TWILIO_SETUP_GUIDE.md`, `TWILIO_WEBHOOK_SETUP.md`, `TWILIO_VOICE_SETUP.md`, `VOICE_WEBHOOK_SETUP.md`
  * A bunch of build/rollout docs under `docs/` (QA, rollout notes, etc.)
* **Telephony/comm routes:**

  * `server/routes.twilioVoice.ts`
  * `server/routes.voiceWebhook.ts`
  * `server/routes.smsFallback.ts`
  * `server/routes.calls.ts`
  * `server/routes.phoneSettings.ts`
  * `server/routes.twilioStatusCallback.ts`
  * `server/routes.sendgridWebhook.ts`
  * plus SMS consent, campaigns, appointments, etc.
* **Business logic routes:**

  * Appointments, quick booking, quotes, cancellations, refunds, subscriptions
  * Loyalty & rewards: `routes.loyalty.ts`, `routes.invoice.loyalty.ts`, `loyaltyService`, `googleLoyaltyIntegration`, etc.
  * Tags, tech profiles, contacts, gallery, recurring services, calendars, etc.
* **AI / automation bits already present:**

  * `conversationClassifier.ts`
  * `conversationState.ts`
  * `aiSuggestionService.ts`
  * `damageAssessment*`, `roleAwareNotifications.ts`, etc.
* **Knowledge base / admin artifacts:**

  * `Master_CleanMachine_AgentKnowledgeBase_AutoReady.xlsx`
  * `HOMEPAGE_FEATURE_INVENTORY.md`
  * PWA docs
  * Various deployment checklists & improvement plans

👉 **Key point:** Clean Machine is now a **seriously feature-rich, single-tenant system** with Twilio, SendGrid, Stripe, loyalty, PWA, etc.
But it is **not yet tenant-isolated** (no `tenantDb.ts` / `tenantMiddleware.ts` in the repo), even though the migration plan exists.

## 1.2 ServicePro Backbone / Tenant Isolation Package

Your `servicepro-backbone.md` is basically the **Tenant Isolation Migration Package**:

* Defines:

  * `tenantDb` wrapper (Drizzle wrapper that injects `tenant_id`)
  * `tenantMiddleware` that attaches `req.tenant` and `req.tenantDb`
  * `tenantIsolation` tests (11 tests)
* Lists 20+ routes to migrate from `db` → `req.tenantDb`
* Shows the exact before/after pattern:

  * `db.query.customers...` → `req.tenantDb.query.customers...`
  * `where: req.tenantDb.withTenantFilter(table, condition)`

👉 **Key point:** This is **not a separate repo anymore** – it’s a **code+instructions bundle** that must be applied into the **current Clean Machine repo**.

---

# 2. Overall Structure of MASTER PLAN v3.0

We’ll keep the phased structure (because it works), but **aim it at where things actually are now**:

1. **Phase 0 – Canonicalization & Docs**
2. **Phase 1 – Tenant Isolation & Multi-Tenant Core**
3. **Phase 2 – Telephony Spine (SMS, Voice, SIP, IVR)**
4. **Phase 3 – AI Messaging Brain & Knowledge Base**
5. **Phase 4 – AI Voice Receptionist & Call Handling**
6. **Phase 5 – White-Label SaaS Features & Onboarding**
7. **Phase 6 – Industry Packs & Auto-Setup**
8. **Phase 7 – Super-Tenant Ops (Billing, Monitoring, Scaling)**

I’ll give you:

* What each phase *does*
* What’s *already done* vs *to do*
* Concrete tasks Replit agents can execute
* How it ties back to your white-label vision & Twilio super-tenant model

---

# PHASE 0 – Canonicalize & Organize (Now)

**Goal:** Make the **current Clean Machine repo** the **one true home** of everything, and freeze “ServicePro backbone” as a *design + migration package*, not a separate live codebase.

### 0.1 Create MASTER_PLAN_V3.md in repo

Add a new doc at repo root:

* `MASTER_PLAN_V3.md`

  * Paste a cleaned-up version of this plan into it.
  * This becomes the canonical reference for:

    * You
    * Your partner
    * Any Replit agent

### 0.2 Mark ServicePro backbone as “migration package”

In the repo:

* Keep `TENANT_ISOLATION_IMPORT.md` & `servicepro-backbone.md`
* But treat them as **inputs to Phase 1**, not active code.

You do **not** need a separate ServicePro repo anymore – everything folds into Clean Machine.

---

# PHASE 1 – Tenant Isolation & Multi-Tenant Core

**Goal:** Turn Clean Machine from single-tenant into **multi-tenant**, with:

* **Clean Machine** = root tenant (`tenant_id = 'root'`)
* Future businesses = additional tenants
* All tenant-scoped tables filtered by `tenant_id` at the DB wrapper level.

### 1.1 Apply tenant infrastructure (from migration package)

**Replit agent tasks (backed by `servicepro-backbone.md` / `TENANT_ISOLATION_IMPORT.md`):**

1. Create core files in `server/`:

   * `server/tenantDb.ts`
   * `server/tenantMiddleware.ts`
2. Create test infra:

   * `server/tests/setupTenantDb.ts`
   * `server/tests/tenantIsolation/tenantDb.test.ts`
   * `vitest.config.ts` updates to hook tests
3. Implement `tenantDb` to:

   * Wrap base Drizzle client
   * Auto-inject `tenant_id` on inserts
   * Auto-filter on selects/updates/deletes with `withTenantFilter(table, condition)`
4. Implement `tenantMiddleware` to:

   * Resolve tenant (for now, hardcode `tenant_id = 'root'`)
   * Attach `req.tenant` and `req.tenantDb`

Then:

```bash
npm install vitest supertest @types/supertest
npx vitest run server/tests/tenantIsolation/tenantDb.test.ts
```

✅ **Success:** 11/11 tests passing.

### 1.2 Migrate key routes to `req.tenantDb`

Use the migration file’s list (appointments, campaigns, calls, contacts, notifications, etc.). For each route:

* Remove any `import { db } from './db'`
* Swap:

  * `db.` → `req.tenantDb.`
* Wrap where clauses:

  * Before:

    ```ts
    await db.query.customers.findFirst({
      where: eq(customers.id, id),
    })
    ```
  * After:

    ```ts
    await req.tenantDb.query.customers.findFirst({
      where: req.tenantDb.withTenantFilter(customers, eq(customers.id, id)),
    })
    ```

Do this **first** for:

* `server/routes.appointments.ts`
* `server/routes.quickbooking.ts`
* `server/routes.calls.ts`
* `server/routes.twilioVoice.ts`
* `server/routes.smsFallback.ts`
* `server/routes.contacts.ts`
* `server/routes.notifications.ts`

Then expand to the rest over time.

### 1.3 DB schema: ensure `tenant_id` exists where needed

Using `shared/schema.ts`:

* Confirm core tables have `tenant_id`:

  * customers, vehicles, bookings, quotes, invoices, campaigns, etc.
* For any missing, add:

  ```ts
  tenantId: varchar('tenant_id').notNull().references(() => tenants.id)
  ```
* Add `tenants` table if it doesn’t exist yet:

  ```ts
  export const tenants = pgTable('tenants', {
    id: varchar('id').primaryKey(), // 'root', 'tenant-xxxx'
    name: varchar('name').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
    // later: domain, config, etc.
  })
  ```

Seed a `root` tenant linked to your current Clean Machine data.

---

# PHASE 2 – Telephony Spine (SMS, Voice, SIP, IVR)

**Goal:** Clean, consistent telephony core that supports:

* SMS automations (already fairly rich)
* Voice / IVR
* SIP → Groundwire for your business
* Later: per-tenant phone configs

You already have a bunch of telephony files:

* `server/routes.twilioVoice.ts`
* `server/routes.voiceWebhook.ts`
* `server/routes.smsFallback.ts`
* `server/routes.phoneSettings.ts`
* `server/routes.calls.ts`
* Twilio docs: `TWILIO_SETUP_GUIDE.md`, `TWILIO_VOICE_SETUP.md`, `VOICE_WEBHOOK_SETUP.md`

### 2.1 Normalize voice entrypoints

Standardize: **all inbound calls** to a tenant’s number go through ONE place in backend:

* e.g. `POST /twilio/voice/incoming`

This route should:

1. Look up **tenant** based on:

   * The Twilio number being called (map number → `tenant_id`)
2. Attach tenant context:

   * Use `tenantMiddleware` or a specific resolver
3. Decide flow:

   * IVR?
   * Direct SIP dial (Groundwire)?
   * AI voice agent?

For Clean Machine/root tenant **today**:

* Keep it simple:

  * Option A: direct → SIP (Groundwire), so you get caller ID + special ringtone.
  * Option B (slightly richer): minimal IVR (press 1 for AI assistant (future), 2 for SMS link, 3 for callback, 7 for joke, etc.) then downstream.

### 2.2 Lock in SIP → Groundwire flow

You already started this. The plan is:

* Twilio number → `/twilio/voice/incoming` → TwiML `<Dial callerId="{From}"><Sip>jody@cleanmachinetulsa.sip.twilio.com</Sip></Dial>`
* Groundwire registered on S24 with:

  * SIP domain: `cleanmachinetulsa.sip.twilio.com`
  * User: `jody`
  * Custom ringtone: “this is a business call”

**Action:**
Make sure `server/routes.twilioVoice.ts` (or the consolidated `/twilio/voice/incoming` route) is the **canonical implementation** of that logic.

### 2.3 Introduce `tenantPhoneConfig` table

In `shared/schema.ts`, define:

```ts
export const tenantPhoneConfig = pgTable('tenant_phone_config', {
  id: varchar('id').primaryKey(),
  tenantId: varchar('tenant_id').references(() => tenants.id).notNull(),
  phoneNumber: varchar('phone_number').notNull(),  // Twilio number
  sipDomain: varchar('sip_domain'),
  sipUsername: varchar('sip_username'),
  sipPasswordEncrypted: varchar('sip_password_encrypted'),
  messagingServiceSid: varchar('messaging_service_sid'),
  ivrMode: varchar('ivr_mode').default('simple'), // 'simple', 'ivr', 'ai-voice'
  createdAt: timestamp('created_at').defaultNow(),
})
```

Then **root tenant** has:

* 918 number
* SIP domain and username for Groundwire
* Current IVR mode = 'simple' or 'ivr-lite'

Later, new tenants get their own records here automatically.

---

# PHASE 3 – AI Messaging Brain & Knowledge Base

**Goal:** Stabilize and centralize your SMS/AI behavior so it’s:

* predictable
* easy to adjust
* tenant-aware
* reusable for voice later

You already have:

* `conversationClassifier.ts`
* `conversationState.ts`
* `aiSuggestionService.ts`
* `Master_CleanMachine_AgentKnowledgeBase_AutoReady.xlsx`
* A ton of SMS logic in routes: `routes.smsFallback.ts`, `routes.campaigns.ts`, etc.

### 3.1 Formalize “Agent Brain” interfaces

Define a **single internal service** like `server/aiAgent.ts` that:

* Accepts:

  * tenantId
  * channel (sms, web, voice_future)
  * incoming message text
  * conversation context (history, customer record, service, etc.)
* Returns:

  * reply text
  * suggested actions (book, reschedule, quote, etc.)

Your SMS routes should call this service instead of embedding logic directly.

### 3.2 Connect knowledge base

Use the Excel + `WHITE_LABEL_GUIDE.md` + other docs to feed a **knowledge base**:

* For root tenant:

  * Your services, addons, policies, FAQ, rain policy, etc.
* Later, per tenant:

  * Each tenant can override certain entries.

The AI agent service should:

* Load base knowledge (global)
* Overlay tenant knowledge
* Answer questions and generate scheduling messages from that.

---

# PHASE 4 – AI Voice Receptionist (OpenAI Realtime)

**Goal:** Build the **“holy shit” voice** that does what your SMS agent does, but over phone calls.

### 4.1 Voice gateway service

Create something like `server/voiceGateway.ts`:

* Handles Twilio <→ OpenAI Realtime WebSocket
* Converts incoming audio → text
* Feeds the text into the same `aiAgent` service as SMS
* Feeds the agent’s reply text → OpenAI TTS → audio back to Twilio

**Call flow:**

Caller → Twilio number → `/twilio/voice/incoming` → IVR
→ choose “speak with AI”
→ TwiML `<Connect><Stream>` to `wss://your-voice-gateway`
→ OpenAI Realtime API ↔ Clean Machine backend ↔ your existing agent logic

### 4.2 Use same scheduling flow as SMS

Don’t reinvent the logic:

* Voice agent conversation steps:

  1. Greet warmly
  2. Ask service type
  3. Ask vehicle info
  4. Confirm water/power
  5. Confirm address + service area
  6. Offer 2–3 time slots from your availability engine
  7. Confirm & book
  8. Send SMS confirmation

Under the hood, it calls the same appointment creation routes and AI agent logic as the SMS path.

---

# PHASE 5 – White-Label SaaS Features & Onboarding

**Goal:** Turn this into a product other businesses can sign up for without touching code.

### 5.1 Tenant model & onboarding flow

In DB:

* `tenants` table (as defined earlier)
* `tenantConfig` table for settings:

```ts
export const tenantConfig = pgTable('tenant_config', {
  tenantId: varchar('tenant_id').references(() => tenants.id).primaryKey(),
  businessName: varchar('business_name'),
  logoUrl: varchar('logo_url'),
  primaryColor: varchar('primary_color'),
  serviceAreaZipCodes: text('service_area_zip_codes').array(),
  maxDistanceMiles: integer('max_distance_miles'),
  businessHours: jsonb('business_hours'),
  tier: varchar('tier').default('starter'),  // starter, pro, elite
  enableAiVoice: boolean('enable_ai_voice').default(false),
  enableSms: boolean('enable_sms').default(true),
  enableSip: boolean('enable_sip').default(false),
  // integration keys (encrypted or proxied)
})
```

Onboarding UI:

* Signup page:

  * Business name, industry, city
  * Website (optional)
  * Choose plan (starter, pro, elite)
* After signup:

  * Create `tenant` row
  * Create `tenantConfig`
  * Call telephony provisioning (below)
  * Initialize default services for the chosen industry pack

### 5.2 Super-tenant Twilio model

**Your Twilio account** = super-carrier:

* For tenants on **mid/high tier**:

  * You buy/manage their numbers
  * You host their calls/SMS
  * You bill them for usage or wrap it in a subscription
* For tenants on **starter/BYO tier**:

  * They can plug in their own Twilio credentials (optional)

Implement:

* `tenantTwilioConfig` table:

  * If empty → fall back to your master Twilio config.
  * If present → use tenant’s own Twilio account.

Over time, you can add:

* Usage tracking per tenant
* Cost analytics
* Billing hooks (Stripe, etc.)

---

# PHASE 6 – Industry Packs & Auto-Setup

**Goal:** Drastically reduce friction: new tenants shouldn’t feel like they’re “setting up everything from scratch”.

You’ve already started thinking this way with:

* White-label guide
* Knowledge base templates
* Detailed service definitions
* SMS templates

### 6.1 Industry packs model

Create a code module like `server/industryPacks.ts`:

```ts
export const industryPacks = {
  'mobile-detailing': {
    name: 'Mobile Auto Detailing',
    defaultServices: [...],
    defaultAddons: [...],
    faqs: [...],
    ivrScriptTemplate: 'Thanks for calling [BUSINESS_NAME]...',
    smsTemplates: {...},
    agentInstructions: [...],
    jokes: [...], // for option 7 :)
  },
  'lawn-care': { ... },
  'house-cleaning': { ... },
  // etc.
}
```

On onboarding:

* Tenant picks an industry
* System seeds:

  * Default services/pricing
  * IVR script
  * AI agent instructions
  * SMS templates
  * A starting FAQ set

Tenant can always edit these later.

---

# PHASE 7 – Super-Tenant Ops (Billing, Monitoring, Scaling)

**Goal:** Turn this into a commercially viable platform.

High-level:

* **Billing:**

  * Use Stripe for recurring subscription per tenant.
  * Maybe usage-based surcharges for high SMS/voice volume.
* **Monitoring:**

  * Track per-tenant:

    * Call volume
    * SMS volume
    * Appointment conversion rates
    * No-show rates
* **Scaling:**

  * Add caching (Redis) when needed.
  * Queue jobs for heavy tasks (bulk campaigns, AI heavy calls).
  * Possibly split DB per region or large tenants later.

This phase comes after:

* Core multi-tenant infra is stable.
* Telephony and AI are battle-tested with your own business and a few early adopters.

---

# TL;DR – What You Should Do *Right Now*

If you want a short “do this first” list:

1. **Drop this into your repo** as `MASTER_PLAN_V3.md` so Replit agents and future you know what’s up.
2. **Run Phase 1**:

   * Use the tenant isolation migration package to:

     * Add `tenantDb`, `tenantMiddleware`, tests.
     * Migrate a first batch of routes (appointments, calls, Twilio voice/SMS).
3. **Stabilize telephony spine (Phase 2 basic)**:

   * Standardize `/twilio/voice/incoming`.
   * Confirm SIP→Groundwire is working exactly how you want (caller ID + business ringtone).
4. **Centralize AI messaging logic (Phase 3 basic)**:

   * Wrap SMS logic into a single `aiAgent` service internally.
5. **Then start Phase 5 onboarding + tenant tables** once your own “root tenant” is cleanly running on tenantDb.

If you want, next step I can do is:

* Write a **Replit-ready agent prompt** that says
  “Here’s MASTER_PLAN_V3, start at Phase 1 and implement tenantDb + middleware in this repo”
  so you can just paste it into the Replit agent and let it go to work.
