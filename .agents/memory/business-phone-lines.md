---
name: Business-owned phone lines are not customers
description: Clean Machine (tenant root) owns multiple Twilio lines; inter-line/alert traffic looks like inbound customer traffic and must be excluded from imports/analytics.
---

# Business-owned phone lines are not customers

Tenant `root` (Clean Machine) owns several Twilio numbers, listed in the
`phone_lines` table (Main Business Line, Jody's Business Line, Urgent Alerts).
Some of these lines text/call each other (e.g. the alerts line notifying the main
line), and Twilio logs that as **inbound** traffic whose `from` is one of the
business's own numbers.

**Why it matters:** a naive backfill/import that creates a customer per inbound
`from` will mint bogus "customer" rows for the business's own numbers — a quarter
of the audited inbound SMS were inter-line/alert traffic, not real customers.

**How to apply:**
- When importing or counting inbound comms for a tenant, load `phone_lines` for
  that tenant and **skip rows whose `from` is one of the tenant's own numbers**;
  tally them separately rather than dropping silently.
- Resolve `phoneLineId` from the inbound `to` number via the tenant's `phone_lines`
  (mirror `resolvePhoneLineId` in `server/services/callMessagePersistence.ts`,
  default 1/Main on miss) — never hardcode the line id.
- Separately, automated SMS noise (carrier verification codes, 5-digit shortcodes
  like `22395`, "Google Voice verification code") also appears as inbound and is
  not a customer — flag for a human decision before importing.
