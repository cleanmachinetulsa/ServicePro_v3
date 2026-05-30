---
name: Background processes get reaped between tool calls
description: Why long-running scripts launched with nohup/& disappear, and how to run them reliably in this Replit environment.
---

# Background processes get reaped between bash tool calls

A script started with `nohup … &` (or any backgrounded `&`) in one bash tool call is
**gone by the next bash tool call**. Only the configured workflow server survives
between calls; ad-hoc background children are reaped.

**Why:** each bash tool invocation is effectively its own short-lived session;
orphaned children do not persist across invocations.

**How to apply:**
- Run a long script in ONE blocking bash call (raise the tool `timeout`, max 120000ms).
- If the work would exceed ~2 min, redesign it to fit: e.g. preload all needed DB
  state into memory once up front so per-row hot loops avoid round-trips. This took
  a Twilio backfill over 600 SMS + ~300 calls from minutes down to ~15s.
- `setsid`/detached approaches are unreliable here — don't depend on them.
