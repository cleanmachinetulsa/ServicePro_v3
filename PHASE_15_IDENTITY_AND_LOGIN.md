### 2️⃣ `PHASE_15_IDENTITY_AND_LOGIN.md`

```md
# PHASE 15 – Customer Identity & Login (OTP + Magic Links) – IMPLEMENTATION PLAYBOOK

## 0. Purpose

Move from “phone-only lookup” to a **proper identity model** and **customer login** for ServicePro v3:

- Internally: everything is keyed by `{tenantId, customerId}`.
- Externally: customers log in via:
  - **SMS OTP** (v1 – ship first).
  - **Magic links** (v2 – add on top when ready).
- Goal: Customer portal feels like Uber/Doordash:
  - No passwords.
  - Phone and/or email.
  - Secure sessions tied to their real customer record.

---

## 1. Pre-Reqs / Assumptions

- Multi-tenant schema is in place.
- `customers` table already exists and is tenant-scoped.
- Loyalty & promo engine (Phase 14) is either implemented or underway.
- There will be a **customer portal** route for each tenant (even if very minimal at first).

---

## 2. Data Model Extensions

### 2.1 Customers Table

**File:** `shared/schema.ts`

Extend `customers` as needed:

```ts
export const customers = pgTable('customers', {
  id: varchar('id').primaryKey(),   // or serial, depending on current code
  tenantId: varchar('tenant_id').notNull(),
  name: varchar('name'),
  phone: varchar('phone'),
  email: varchar('email'),
  addressLine1: varchar('address_line_1'),
  addressLine2: varchar('address_line_2'),
  city: varchar('city'),
  state: varchar('state'),
  postalCode: varchar('postal_code'),
  country: varchar('country'),
  householdId: integer('household_id'), // from Phase 16
  firstJobDate: timestamp('first_job_date'),
  lastJobDate: timestamp('last_job_date'),
  totalJobs: integer('total_jobs').default(0),
  totalLifetimeValue: integer('total_lifetime_value').default(0),
  importSource: varchar('import_source'),
  isVip: boolean('is_vip').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  // ...
});
Add constraints as appropriate:

Unique per {tenantId, phone} if that fits your existing data.

Or at least an index: (tenant_id, phone).

2.2 Login Tokens Table
Add a table for OTP codes & magic-link tokens:

ts
Copy code
export const customerLoginTokens = pgTable('customer_login_tokens', {
  id: serial('id').primaryKey(),
  tenantId: varchar('tenant_id').notNull(),
  customerId: varchar('customer_id').notNull(),
  token: varchar('token').notNull(),        // opaque token for magic links OR hashed OTP
  type: varchar('type').notNull(),         // 'otp' | 'magic_link'
  channel: varchar('channel').notNull(),   // 'sms' | 'email'
  targetUrl: text('target_url'),           // where to redirect after magic login
  createdAt: timestamp('created_at').defaultNow(),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
});
Notes:

For OTP:

You can store the plain code or a hash; up to you.

For magic links:

token should be random & unguessable.

expiresAt should be short (e.g., 15–60 minutes).

3. SMS OTP Login (v1 – Ship First)
3.1 Backend Endpoints
Create a customer portal auth router, e.g.:

File: server/routes.customerPortalAuth.ts

Register in server/routes.ts under /api/portal.

Endpoint 1: Start OTP Login
POST /api/portal/start-login

Body:

json
Copy code
{
  "tenantId": "root" | "some-tenant-id",   // might come from subdomain instead
  "phone": "+19188565304",
  "targetUrl": "/portal"                   // optional, default to "/portal"
}
Behavior:

Resolve tenant:

From request, subdomain, or req.tenant.

Find customer by {tenantId, phone}:

If none:

Option A: return an error (“we could not find an account for this number”).

Option B: create a “soft” customer record.

Generate a numeric OTP (e.g., Math.floor(100000 + Math.random()*900000)).

Insert a row into customerLoginTokens:

type = 'otp'

channel = 'sms'

token = otpCode (or a hash)

expiresAt = now + 10 minutes

usedAt = null

Send SMS via existing telephony utilities:

Use tenant’s number from tenantPhoneConfig.

Template: Your Clean Machine/ServicePro code is: 123456 (keep it short).

Return 200 OK with a generic message: “If this number is in our system, we’ve sent a code.”

Endpoint 2: Verify OTP
POST /api/portal/verify-otp

Body:

json
Copy code
{
  "phone": "+19188565304",
  "code": "123456"
}
Behavior:

Resolve tenant & customer by {tenantId, phone}.

Look up the latest customerLoginToken:

type = 'otp'

channel = 'sms'

usedAt IS NULL

expiresAt > now()

If:

No token → return 400.

Token exists but code mismatch → 400.

On success:

Mark token usedAt = now().

Create a customer session:

Either:

Set a signed cookie customerSession with {tenantId, customerId}.

Or return a JWT to the frontend.

Return:

{ success: true, redirectUrl: token.targetUrl || '/portal' }.

Session Strategy (Simple):

For now:

Use a signed HTTP-only cookie:

Content: {tenantId, customerId}

Name: sp_customer_session (for example)

Middleware on “portal” endpoints will decode cookie and attach req.customer.

3.2 Frontend: Basic Customer Portal Shell
Goal: Minimal but functional.

File(s):

client/src/pages/CustomerPortalLogin.tsx

client/src/pages/CustomerPortalHome.tsx

Basic flow:

/portal/login:

Input: phone

Button: “Send code”

Then: code input + “Verify”

/portal:

On mount, call /api/portal/me:

If not logged in → redirect to /portal/login.

If logged in → show:

Customer name

Points balance

Upcoming jobs (later)

“Book now” button

Backend endpoint /api/portal/me:

Reads customerSession cookie.

Returns customer info + loyalty info.

4. Magic Links (v2 – Layer on Top)
Once OTP is stable, add magic link support.

4.1 Backend: Start Magic Link
Extend POST /api/portal/start-login:

Accept email as alternative to phone OR a mode: 'otp' | 'magic_link'.

If mode === 'magic_link' and email is present:

Find customer by {tenantId, email}.

Generate random token: crypto.randomBytes(32).toString('hex').

Insert customerLoginTokens row:

type = 'magic_link'

channel = 'email'

targetUrl = '/portal' or passed in.

Send email via SendGrid:

Subject: “Sign in to Clean Machine / ServicePro”

Link: https://tenant-domain.com/magic-login?token=XYZ.

4.2 Backend: Magic Link Callback
GET /magic-login?token=XYZ

Behavior:

Look up customerLoginTokens by token:

type = 'magic_link'

usedAt IS NULL

expiresAt > now()

If invalid/expired:

Show friendly “link expired” page.

If valid:

Mark token usedAt = now().

Create customer session (same cookie mechanism).

Redirect to targetUrl or /portal.

5. Multi-Tenant Considerations
All lookups are scoped by tenantId.

Frontend may resolve tenantId from:

Subdomain

Path prefix

Or be hardcoded for root in your own Clean Machine use.

For ServicePro:

The plan is:

root tenant → Clean Machine.

Other tenants → their own domains/subdomains.

The playbook should be implemented generically:

Don’t hard-code root except in testing.

6. Tests & QA
6.1 Unit / Integration Tests
Test token creation & expiration.

Test OTP verification:

Correct code → success.

Wrong code → error.

Reuse of same code after used → error.

Test magic link:

Valid token → session created.

Expired → reject.

6.2 Manual QA
In dev:

Open /portal/login.

Enter own phone, check OTP SMS arrives.

Enter OTP → confirm you’re redirected & see your test customer’s points.

Confirm:

Sessions persist while browser open.

Logout clears cookie (add a simple /api/portal/logout).

6.3 Security Notes
Ensure customerSession cookie is:

HttpOnly

Secure in production

Signed

Limit OTP attempts per token to prevent brute force (optional: track attempts in metadata).