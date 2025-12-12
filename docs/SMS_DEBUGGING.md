# SMS Debugging Guide

This document describes how to debug and verify SMS booking behavior.

## Environment Variables

### Quiet Mode (Background Jobs Control)

```bash
# Disable all background cron jobs for quiet debugging (DEFAULT)
# SMS inbound handling remains always active
PLATFORM_BG_JOBS_ENABLED=0

# Enable all background jobs (production mode)
PLATFORM_BG_JOBS_ENABLED=1
```

When `PLATFORM_BG_JOBS_ENABLED=0` (default), the following are disabled:
- Timeout monitoring
- Damage assessment monitoring  
- Recurring services scheduler
- Reminder scheduler
- Campaign scheduler
- Usage rollup scheduler
- Invoice generator
- Dunning process
- Trial telephony reset
- Port monitoring
- Unanswered message monitoring
- System health monitoring
- Sheets auto-sync

**SMS inbound handling is ALWAYS enabled regardless of this setting.**

### Other Relevant Env Vars

```bash
# Business owner phone for booking notifications
BUSINESS_OWNER_PERSONAL_PHONE=+1918XXXXXXX

# Use legacy Clean Machine routing (default: false)
CLEAN_MACHINE_USE_LEGACY_SMS=true
```

## Database Schema Push

After any schema changes, run:

```bash
npm run db:push
```

If there are data-loss warnings:

```bash
npm run db:push --force
```

This creates/updates the `sms_inbound_dedup` table used for webhook deduplication.

## How to Confirm a Booking is Real

A booking is only confirmed when:

1. The `handleBook()` function returns successfully
2. A Google Calendar event is created with a real `eventId`
3. The booking database row is created

### Log Pattern for Real Booking

```
[SCHEDULING] Attempting to create booking... {service, slot, address, phone}
[SCHEDULING] Booking created eventId=abc123xyz
[OWNER NOTIFY] sent=true
```

### Log Pattern for Failed Booking

```
[SCHEDULING] Attempting to create booking...
[SCHEDULING] Booking failed reason=Calendar auth failed
```

When booking fails, the customer receives:
> "I couldn't finalize that slot automatically — want me to try the next available option or a different day?"

**Fake confirmations like "We'll send a confirmation shortly" are never sent.**

## Understanding the New Logs

### Session Logs

```
[SMS SESSION] started id=s-lxyz123-a1b2 reason=new_session
[SMS SESSION] context_window_start=2024-12-12T10:00:00.000Z included_messages=5 (3 continuity + 2 session)
```

**Session reasons:**
- `new_session`: First booking intent with no existing session
- `new_booking_after_completed`: User started new booking after previous completed
- `stale_session`: Session older than 24 hours
- `service_changed`: User changed service type

### Deduplication Logs

```
[SMS DEDUPE] Duplicate inbound ignored sid=SM1234567890abcdef
```

Indicates a redelivery from Twilio that was correctly prevented.

### State Logs

```
[SMS STATE] Reset booking state: reason=service_changed prev_service=Full Detail new_service=Interior Detail
[SMS DRAFT] State: service=Interior Detail, address=123 Main St..., stage=choosing_slot
```

### Context Logs

```
[SMS CONTEXT] tenant=root conv=123 from=+1918XXXXXXX to=+1918YYYYYYY
[SMS CONTEXT] loaded_messages=5 first_ts=2024-12-12T10:00:00.000Z last_ts=2024-12-12T10:15:00.000Z
```

### Length Control Logs

```
[SMS LENGTH] truncated from 450 to 298
```

## Session Boundary Explanation

The booking session system prevents old conversation history from "poisoning" new bookings.

### How It Works

1. When user expresses booking intent ("book", "schedule", "appointment"), a new session starts
2. Each session gets a unique `bookingSessionId` and `bookingSessionStartedAt` timestamp
3. The LLM context only includes messages AFTER session start (plus 3 continuity messages)
4. State is reset but verified addresses are preserved if confirmed within 24 hours

### Session State Fields

- `bookingSessionId`: Unique ID for tracking (e.g., `s-lxyz123-a1b2`)
- `bookingSessionStartedAt`: Unix timestamp when session started
- `stage`: Current booking stage (`selecting_service`, `confirming_address`, `choosing_slot`, `booked`)
- `verifiedAddressPhone`: Phone that confirmed the current address
- `verifiedAddressTimestamp`: When address was last confirmed

## SMS Length Control

All SMS responses are automatically truncated to max 300 characters to ensure they fit in ~2 SMS segments.

Truncation strategy (in order):
1. Reduce slot lists to max 3 options
2. Remove fluff phrases ("I'd be happy to help", "Please let me know if you have any other questions")
3. Shorten addresses (Avenue → Ave, Street → St)
4. Hard truncate at sentence boundary if needed

## Fail-Open Behavior

The SMS deduplication system uses fail-open design:
- If the dedupe table is missing, SMS processing continues (no crash)
- A single warning is logged per process: `[SMS DEDUPE] WARN dedup table unavailable; proceeding without dedup (fail-open)`
- Run `npm run db:push` to create the table

## Verification Steps

### Test Quiet Mode

1. Start server without `PLATFORM_BG_JOBS_ENABLED` set
2. Check logs for: `[DEFERRED INIT] PLATFORM_BG_JOBS_ENABLED=false (quiet mode)`
3. Check logs for: `[SERVER] Background jobs DISABLED (PLATFORM_BG_JOBS_ENABLED=0). SMS inbound is still active.`
4. Verify no cron job logs appear

### Test Session Boundary

1. Send booking intent: "I'd like to book an interior detail"
2. Check for: `[SMS SESSION] started id=... reason=new_session`
3. Complete booking flow
4. Send another booking intent: "Can I schedule an appointment?"
5. Check for: `[SMS SESSION] started id=... reason=new_booking_after_completed`

### Test Real Booking

1. Complete a booking flow with all required info (service, address, slot)
2. Check for: `[SCHEDULING] Booking created eventId=...`
3. Verify Google Calendar has the event
4. Check owner received SMS notification: `[OWNER NOTIFY] sent=true`
