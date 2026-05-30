---
name: Drizzle onConflict must match the FULL composite unique constraint
description: Why ON CONFLICT targeting one column of a multi-column unique key makes every insert throw, and how to avoid it.
---

# onConflict target must list every column of the real unique constraint

Postgres matches an `ON CONFLICT (...)` clause to a constraint by its **exact column
set**. If the table's unique constraint is composite but you target only one of its
columns, Postgres raises *"no unique or exclusion constraint matching the ON CONFLICT
specification"* and the insert fails — for a loop of inserts, that means **0 rows
written and one error per row**, which is easy to misread as a data problem.

Concrete case that bit us: `sms_inbound_dedup` is unique on **(tenant_id, message_sid)**.
`onConflictDoNothing({ target: smsInboundDedup.messageSid })` made every SMS insert in
the Twilio importer throw → 0 SMS imported. Fix: `target: [smsInboundDedup.tenantId,
smsInboundDedup.messageSid]`. (By contrast `call_events.call_sid` has a *standalone*
unique, so single-column onConflict there is fine.)

**Why:** the constraint-match is structural, not "close enough". A single column of a
composite key is not a constraint.

**How to apply:** before writing any `onConflictDoNothing/onConflictDoUpdate`, confirm
the constraint's real columns from the live DB (`\d <table>`), not from the column you
think of as "the id". Note also: `shared/schema.ts` can drift from the live DB — at time
of writing it declared the `sms_inbound_dedup` unique on `message_sid` only while the
deployed DB has the composite. Trust `\d` over the schema file.
