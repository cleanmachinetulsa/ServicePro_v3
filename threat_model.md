# Threat Model

## Project Overview

ServicePro is a multi-tenant SaaS platform for service businesses, with a React/Vite frontend and a TypeScript/Express backend backed by PostgreSQL via Drizzle. It handles customer messaging, booking, loyalty, invoices, gift cards, and public website content, and integrates with Twilio, Stripe, Google Workspace, Square, SendGrid, and Slack.

Production scope for this scan is the deployed web app and its server-side integrations. The mockup sandbox is not production. Assume `NODE_ENV=production` in production and TLS is provided by the platform.

## Assets

- **User sessions and account state** -- authenticated tenant-owner, admin, and staff sessions; session cookies; password-reset and MFA state. Compromise allows impersonation and admin access.
- **Tenant customer data** -- names, phone numbers, email addresses, street addresses, vehicle details, appointment history, loyalty history, and conversation context. This is sensitive PII and business data.
- **Booking and reminder state** -- appointments, recurring services, reminder jobs, escalation flags, booking confirmation state, and calendar-linked workflows. Unauthorized changes can disrupt operations and customer communication.
- **Public website content and tenant branding** -- service catalog, homepage content, gallery images, rewards landing pages, pricing, and referrals. Unauthorized modification causes tenant defacement and business harm.
- **Payment and billing data** -- Stripe customer/subscription references, invoices, Square gift card data, billing state, and usage records. The app should not expose or allow unauthorized mutation of payment-related state.
- **Application and integration secrets** -- session secret, signing keys, webhook secrets, API keys, and tenant-linked provider credentials. Leakage or fallback defaults can let attackers forge trusted requests or tokens.
- **Uploaded files and public media** -- gallery uploads and other customer-facing media stored under the app’s public file tree. Unauthorized writes can enable defacement, storage abuse, and malicious content hosting.

## Trust Boundaries

- **Browser/client to Express API** -- all client input is untrusted. Public, authenticated, and admin endpoints must be separated server-side.
- **Public to authenticated/admin server routes** -- the app mixes public booking/content routes with sensitive tenant-management routes inside the same Express process. This boundary is especially high risk and must be enforced server-side on every route.
- **Express app to tenant-scoped database access** -- server code uses `req.tenantDb` and tenant filters to scope reads and writes. Any missing auth or tenant scoping exposes cross-customer or cross-tenant data.
- **Express app to third-party services** -- Twilio, Stripe, Google, Square, SendGrid, Slack, and Maps callbacks cross an external-service trust boundary and must be authenticated before they can change state.
- **Server secrets to public tokenized links** -- QR, reminder, rewards, and similar links rely on HMAC-style tokens. Weak defaults or missing production guards break trust in those links.
- **Development/testing features to production** -- debug/test routes, demo mode, and mock tooling may exist in the same repo. They should be ignored unless production reachability is clearly demonstrated.

## Scan Anchors

- **Primary production entry points:** `server/index.ts`, `server/routes.ts`, routers mounted directly from `server/index.ts`, `server/routes.*.ts`, `server/routes/**/*.ts`
- **Highest-risk code areas:** routers mounted in `server/index.ts` before `registerRoutes(app)` because they bypass the later central `/api` auth gate; global auth/public gating in `server/routes.ts`; tenant resolution and fallback behavior in `server/tenantMiddleware.ts` and `server/authHelpers.ts`; auth/session middleware in `server/authMiddleware.ts` and `server/sessionMiddleware.ts`; public file/content routes like `server/routes.gallery.ts`; webhook verification in `server/twilioSignatureMiddleware.ts` and webhook route files; token-signing utilities such as `server/reminderActionTokens.ts` and QR signing in `server/routes.ts`
- **Public surfaces:** booking, reminders, loyalty lookups, gallery, public-site content, QR scan, payer-approval links, webhooks, and customer self-service flows under `/api/public`, `/api/book*`, `/api/gallery`, `/api/loyalty/*`, `/api/qr/*`, `/api/payer-approval/*`, `/api/webhooks/*`, `/api/voice*`, `/api/twilio*`, `/api/sms*`
- **Authenticated/admin surfaces:** dashboard, billing, campaign/admin tools, customer management, settings, imports, and root-admin usage routes
- **Usually dev-only / lower-priority for production scans:** `server/tests/`, test fixtures, one-off migration helpers, mockup sandbox, and routes only mounted behind explicit non-production feature flags unless production reachability is shown

## Threat Categories

### Spoofing

This application trusts sessions, signed customer links, and provider webhooks to identify who is acting. The system must reject unauthenticated access to tenant-management routes, must fail closed when webhook verification secrets are missing, and must use strong non-default signing secrets for any public token links or QR identifiers.

### Tampering

Public traffic can reach booking, gallery, reminder, loyalty, and public-site endpoints. The server must enforce authorization on every state-changing route, compute sensitive business actions server-side, and prevent unauthenticated users from modifying tenant content, reminder schedules, or customer-facing business data.

### Information Disclosure

The app stores large amounts of customer PII and service history and also reads from tenant databases and Google Sheets. Public helper endpoints must return only the minimum data needed for the workflow, and unauthenticated callers must not be able to enumerate customers, loyalty status, addresses, or appointment history by phone number, email address, token, or predictable identifiers.

### Denial of Service

Several public endpoints trigger file uploads, remote fetches, AI workflows, or external API calls. Production routes must bound upload size, request frequency, and remote fetch behavior so anonymous users cannot exhaust disk, database, or third-party quota.

### Elevation of Privilege

Because public and privileged routes are colocated and tenant context is injected centrally, broken route matching or missing `requireAuth` checks can turn owner/admin features into public ones. Routes mounted early in `server/index.ts` are especially risky because they do not inherit the later central `/api` gate. Every sensitive route must enforce both authentication and the correct tenant/role checks in the handler chain, not rely on naming conventions, mount order, or frontend behavior.
