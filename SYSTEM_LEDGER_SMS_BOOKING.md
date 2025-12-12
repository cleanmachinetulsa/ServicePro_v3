1. We absolutely should create a “SYSTEM LEDGER” file

You’re 100% right. Right now, critical knowledge exists only in:

Replit AI replies

Console logs

Your memory (which is exhausted)

This chat

That’s dangerous long-term and for agents.

🎯 Purpose of the Ledger

A single source of truth for:

How the system works

Where features live

How to test them

What assumptions exist

What’s deterministic vs AI-driven

This is NOT docs for users.
This is internal engineering + agent ops memory.

📄 Recommended file
/docs/SYSTEM_LEDGER_SMS_BOOKING.md


Later you can split it, but start with ONE file.

🧠 Ledger Structure (exhaustive but sane)
1. System Overview

SMS Booking = state-driven engine + AI tool loop

AI never books directly

AI proposes → tools validate → system confirms

Booking success = eventId exists ONLY

2. Inbound SMS Pipeline (Authoritative)

Include exactly this flow (you already summarized it well):

Twilio webhook received

Tenant resolved by To number / MessagingServiceSid

MessageSid dedupe (sms_inbound_dedup)

Customer resolved / created

Booking session window determined

State reset if needed

Context rebuilt

AI + tools loop

Deterministic actions (booking, notify, reminders)

Persist + respond (TwiML)

This section should include:

File names

Key log lines to look for

“If this breaks, check here first”

3. Session & Memory Rules (VERY IMPORTANT)

Document clearly:

A booking session starts when:

User expresses booking intent

Or service changes

Session memory:

Messages AFTER session start

Fallback: last 8 messages

Old messages are ignored on purpose

This prevents stale-service bugs

Include log keys:

[SMS CONTEXT]
[SMS STATE]
[SMS TRACE]


This is huge for future agents.

4. Booking State Machine (Current)

Document current stages:

selecting_service
confirming_address
choosing_slot
booked


Also document:

What resets state

What is preserved (address sometimes)

What is NOT yet gated (vehicle, condition)

5. Hard Gates vs Soft Prompts

Explicitly list:

Hard Gates (must be answered):

Address validation

Power access

Water access (unless interior-only)

Slot selection

Soft (AI-prompted, not enforced yet):

Vehicle details

Condition

Upsells

This clarity prevents future confusion like today.

6. Slot Offering Rules (Psychology Layer)

Document what you just decided:

Prefer earliest available

Show ranges, not lists

Default window:

~7 days primary

Light preview of following week

Phrase availability as:

“Best starting times”

“We can work with your schedule”

Avoid opening the entire calendar unless asked

This is behavioral policy, not code trivia — agents need it.

7. Booking Confirmation & Notifications

Clarify the rules:

No “You’re booked” unless:

eventId exists

Owner notification:

Fires ONLY on confirmed booking

If Google auth fails:

User gets fallback message

No fake confirmation

Include where logs appear:

[SCHEDULING]
[OWNER NOTIFY]

8. Testing & Debugging Cheatsheet

This is where those Replit notes shine.

Include:

Test SMS endpoint

How to simulate inbound SMS

Where to see:

Slot generation

Tool calls

Booking attempts

Common failure causes:

Google JWT invalid

Missing dedupe table

Session reset confusion

9. Known TODOs (Living Section)

Short bullet list:

Vehicle hard gate

Condition gate

Upsell suggestion pass

Slot phrasing tuning

Owner notification verification logs

This keeps you sane.

2. Upsell suggestion pass — how much work is it really?
Honest answer:

Low effort, high leverage.
This is NOT a rebuild.

Why?

You already have:

Services

Add-ons

Pricing

Some upsell logic

What’s missing is when and how it’s surfaced

The correct way to do upsells (important)

Upsells should never block booking.

They should:

Appear AFTER service is chosen

Be framed as:

“Most customers add…”

“Since we’re already there…”

Be skippable with one word: “no”

Implementation options (ranked)
✅ Option A — Fast + Safe (recommended)

Add a post-service-selection upsell suggestion step in the prompt builder.

No new DB tables

No new tools

Just:

Read available upsells for service

Pick top 1–2

Inject short suggestion

This is a single-file change.

⚠️ Option B — Deterministic Upsell Rules

More work:

Encode rules like:

Interior detail → fabric protection

Pet hair → ozone

Still doable, but slower

❌ Option C — Let the LLM “decide”

Don’t do this.
Unpredictable, inconsistent, and hard to audit.

Time estimate (realistic)

Fast prompts version: ~30–45 minutes

Polished deterministic version: ~2–3 hours

This is not an all-day thing.

3. Should we reuse existing upsell logic?
Short answer:

Yes — if it’s already structured.

Before rewriting anything, do this:

👉 Find and upload:

Where upsells are defined

Any logic that maps services → add-ons

Likely locations:

services

addons

pricing

behavior rules or JSON configs

Once I see it, I can tell you instantly:

“Reuse this”

or “Ignore this, here’s why”