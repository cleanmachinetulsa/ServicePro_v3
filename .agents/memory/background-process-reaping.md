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

## Heavy blocking scripts also get recycled ~90s in (separate from reaping)

Even a single blocking bash call running a heavy `tsx` script can be torn down around
~90s: the bash tool returns exit `-1` with **no output**, `/tmp` is wiped, and
workflows restart. So don't rely on a 120s tool timeout actually giving you 120s of
script runtime under memory pressure.

- Design one-off importers to be **idempotent and resumable** so finishing across two
  or three blocking runs is fine (dedup by real unique keys; flag/create only on first
  encounter). A killed partial then resumes cleanly.
- The dominant cost in row loops is usually **shared find/create helpers called per
  row** (they each do DB round-trips + verbose logging). Check your preloaded
  in-memory caches FIRST and return before calling them; only fall through to the
  helper on a genuine cache miss. This took an SMS phase from dying at 200/631 to
  completing all 631.
- Running the import while the dev workflow is **stopped** frees memory and reduces the
  chance of a recycle.
- Full-project `tsc --noEmit` itself OOMs (~2GB heap) on this codebase — a clean exit
  from a piped `tsc | head` can hide the OOM; don't treat it as a passing typecheck.

