# ServicePro — Messaging Stack Audit
**Scope:** SMS pipeline, web chat pipeline, the staff Messaging Center UI, and every integration that touches them.
**Audience:** Engineering, product, and a future technical buyer doing diligence.
**Method:** Code-level review of every file in the inbound/outbound message path, the conversation data model, the AI tool-calling surface, and the React staff inbox. Findings cite file paths so anything here can be re-verified.

---

## 0. Executive Summary

You have a **production-grade SMS engine wrapped in an unfinished UI, sharing a half-merged conversation model with an under-defended public web chat.** The bones are unusually good for a solo-founder SaaS — fail-closed tenant resolution, signed reminder tokens, dedup, automation pause, real Twilio failover, structured AI tool-calling, Socket.IO real-time. But three structural problems hold the product back from looking and feeling like a million-dollar platform:

1. **Identity is fractured across channels.** A customer who texts and web-chats becomes two conversations because `getOrCreateConversation` keys on `(tenant, customerPhone, platform)` instead of `(tenant, customer_id)`. The staff inbox shows two threads; the AI loses context jumping between them.
2. **The Messaging Center page is a 70%-finished iMessage clone.** Real-time, reactions, attachments, takeover all work. Read receipts are claimed but unreliable. Long threads aren't virtualized. Several buttons are stubs (`Share Availability` copies text but doesn't generate a real link; `Schedule Send` UI is hidden behind a flag that almost never trips). The composer rail overflows on mobile.
3. **Public web chat is the cost and abuse surface.** An anonymous visitor can burn `gpt-4o` tokens at 20/5min/IP, with no captcha, no global tenant cap, and no per-conversation cost ceiling. One scripted attacker behind a residential proxy pool will run up a real bill.

None of these are catastrophic. All of them are fixable in well-scoped chunks. The rest of this document is the map.

---

## 1. Severity Legend

| Tag | Meaning |
|---|---|
| **P0** | Active liability — money, deliverability, security, or trust. Fix this quarter. |
| **P1** | Holds the product back from "premium" — UX papercuts, missing observability, fragile fallbacks. Fix next. |
| **P2** | Polish, refactor, future-proofing. |
| **OK** | Already correct, called out so it isn't lost in a refactor. |

---

## 2. SMS Pipeline — Independent Audit

### 2.1 Inbound flow (the hot path)

```
Twilio POST /sms
  → server/twilioSignatureMiddleware.ts (HMAC verify, x-forwarded-proto aware)
  → server/phoneValidationMiddleware.ts  (E.164 normalize)
  → server/services/tenantCommRouter.ts  (MessagingServiceSid → To-number → fail closed)
  → server/services/smsInboundDedup.ts   (dedup; fail-open if table missing)
  → server/routes/twilioTestSms.ts       (route handler — does too much)
       ├─ iMessage tapback regex filter        (line ~141)
       ├─ #TEST simulation commands            (line ~162; owner/allowlist gated)
       ├─ TCPA keywords STOP/START/HELP        (smsConsentKeywords.ts)
       ├─ Interactive RESCHEDULE/CANCEL/KEEP   (sms/interactiveKeywords.ts)
       ├─ Booking CONFIRM intercept            (line ~396 → smsBookingRecordService)
       ├─ automation_paused_until check        (line ~255)
       ├─ smsCustomerMemoryHydrator (PII pull)
       ├─ smsConversationContextService (window stale history)
       ├─ generateAIResponse (server/openai.ts) ← gpt-4o tool-calling
       └─ escalationService (sets needsHumanAttention + paused_until)
```

### 2.2 Findings — SMS

| # | Finding | Severity | Evidence | Fix |
|---|---|---|---|---|
| S-1 | `twilioTestSms.ts` is a god-handler. Hundreds of lines of branching logic — intercepts, AI orchestration, draft state, error paths — all inline. Hard to test, hard to modify safely. | P1 | `server/routes/twilioTestSms.ts` | Extract a small **inbound pipeline** with explicit stages: `verify → normalize → resolveTenant → dedup → intercept[] → ai → reply`. Each intercept is a pure function returning `{handled, reply, sideEffects[]}`. Unit-test each stage in isolation. |
| S-2 | `recordProcessedInboundSms` is fire-and-forget (not awaited). Two identical Twilio retries within ~50 ms can both pass dedup. | P1 | `server/services/smsInboundDedup.ts` | Use a **DB upsert with `ON CONFLICT DO NOTHING` and check the row count** synchronously *before* invoking the LLM. Latency cost is < 5 ms; you save the duplicate `gpt-4o` call. |
| S-3 | iMessage tapback filter is a regex (`/Loved|Liked|Laughed/`). Will match a real customer message like *"I loved the wash, thanks!"* and silently drop it. | P0 (silent drops) | `server/routes/twilioTestSms.ts:~141` | Use Twilio's `MessageType` and `Body` length heuristics together, or check `NumMedia=0` AND body matches the *entire* tapback grammar (`^(Loved|Liked|Laughed at|Emphasized|Disliked|Questioned) ".+"$`). |
| S-4 | The `#TEST` simulation commands rely on the inbound number matching the owner's stored phone or `SMS_TEST_ALLOWLIST`. If owner changes their cell and forgets to update the tenant settings, the safety hatch silently disables. | P1 | replit.md SMS Simulation section | Add a **/admin/sms-simulation** page that shows the currently allowlisted numbers and lets the owner add/remove numbers without touching env. Audit-log every toggle. |
| S-5 | "Confused AI writes service name into history → parser adopts it as confirmed state." Booking state is partially reconstructed by parsing prior assistant turns. | P0 (booking integrity) | `extractSmsBookingStateFromHistory` referenced in audit | Stop reconstructing state from prose. Persist booking draft state in a structured row (`booking_drafts` table — you already have `bookingDraftService.ts`; treat that as the **single source of truth** and ignore history entirely for state). The R1.6 work already moved this direction; finish it. |
| S-6 | `tenantCommRouter` does a synchronous DB lookup on every inbound SMS. Twilio retries aggressively if you exceed ~10s. | P2 | `server/services/tenantCommRouter.ts:55` | Cache tenant resolution by `MessagingServiceSid|To` in a 60s in-memory LRU. Invalidate on tenant phone-line changes. |
| S-7 | TCPA `STOP` returns empty TwiML and lets Twilio handle the unsubscribe. Correct — but `START`/resubscribe path doesn't currently re-enable `automation_paused_until` if it was set, so a customer who STOPs and STARTs may get a holding message instead of a real reply. | P1 | `server/services/smsConsentKeywords.ts` | On `START`, clear `automation_paused_until` and `needsHumanAttention` for that conversation, send the consent-confirmation SMS, and emit a Slack notice. |
| S-8 | Outbound is correctly funneled through `smsSendGuard` (always main business number, never admin line). This is a real differentiator vs. competitors who casually leak admin lines. | OK | `server/services/smsSendGuard.ts`, `server/smsFailoverService.ts` | Keep this guard. Add a server-side test that fails if any other code path calls `twilioClient.messages.create` directly. |
| S-9 | `bookingConfirmationMonitor` runs hourly. Reminders at T-7d and T-48h, auto-cancel at T-24h. Good. But the cron is gated behind `PLATFORM_BG_JOBS_ENABLED=1` — if anyone forgets to set this in a new environment, **bookings silently never get confirmation reminders or auto-cancel.** | P0 (silent feature loss) | `server/services/bookingConfirmationMonitor.ts` | Either default the flag on, or add a startup self-check that emits a loud warning on the dashboard (and Slack) when it is off in production. Show a "Background jobs: OFF" banner in the staff UI. |
| S-10 | Every inbound SMS = at least one `gpt-4o` round-trip. Cost ≈ $0.005–0.015 per inbound. At 10k inbounds/month per active tenant that's $50–$150/tenant in raw model cost — fine, but no per-tenant **monthly cap** exists, so a runaway loop or abusive customer could hit four-figure bills. | P1 | `server/openai.ts` | Add per-tenant daily token budget in `usage_rollups_daily`; when tripped, downgrade to `gpt-4o-mini` and notify owner. The metering ledger already exists — just wire the cap. |

---

## 3. Web Chat Pipeline — Independent Audit

### 3.1 Architecture
- **Widget:** `client/src/components/EnhancedChatbotUI.tsx`. Persists chat in `localStorage`, no cookies, identity = generated `web-chat-{sessionId}` until phone is collected.
- **Endpoint:** `POST /api/web-chat` in `server/routes.ts:1930`. Anonymous, IP rate-limited to **20 req / 5 min**.
- **Tenant:** Resolved by Host header in `tenantMiddleware.ts`.
- **AI:** `server/conversationHandler.ts` → `server/openai.ts` (`gpt-4o`), full tool-calling but **booking writes are gated until a phone is verified**.
- **Real-time:** **None for the customer.** REST request/response only. Staff side gets Socket.IO updates; the widget itself does not subscribe.

### 3.2 Findings — Web Chat

| # | Finding | Severity | Evidence | Fix |
|---|---|---|---|---|
| W-1 | Anonymous visitor can drive `gpt-4o`. IP rate limit is bypassable by any residential-proxy attack and gives no per-tenant ceiling. | P0 (cost / abuse) | `server/routes.ts:1927` | Three layers: (a) **invisible Cloudflare Turnstile / hCaptcha** on first message; (b) per-tenant **monthly token budget** that downgrades to `gpt-4o-mini` and finally to a static "we'll text you back" canned reply when exhausted; (c) raise the rate-limit key from IP to `IP+sessionId+tenant` so a single visitor can't hide behind a shared NAT but a legitimate coworking space isn't blocked by neighbors. |
| W-2 | The widget never subscribes to anything. If a staff member takes over, the customer's screen does not change until *after* the human sends a message. They will keep waiting on a bot that's no longer answering. | P1 (CX) | `EnhancedChatbotUI.tsx` | Add a small **SSE endpoint** (`GET /api/web-chat/stream?sessionId=…`) that pushes `{type:"taken_over", agent:"Jody"}`, `{type:"typing"}`, and `{type:"message", …}`. SSE works through corporate proxies better than WebSocket and costs almost nothing. Show a "Jody from Clean Machine is typing…" pill — instant trust upgrade. |
| W-3 | Persistence is browser `localStorage` only. Same customer on phone vs laptop sees two conversations, neither connected to their SMS history unless they re-type their phone. | P1 | `EnhancedChatbotUI.tsx` | Issue an HttpOnly first-party cookie (`sp_chat=…`, signed JWT, 30-day) on first page view. Server stores `(cookie, customer_id?)`. When the visitor types a phone number, link the cookie to the customer permanently. Now: same person across devices = same thread. |
| W-4 | "Web chat = `web-chat-{sessionId}`" creates an orphan customer row until phone arrives. Many of these never resolve and sit forever cluttering the customers table. | P1 | `customerIdentityService.ts` | Don't create a `customers` row until you have at least one of (phone, email, scheduled appointment). Until then, store on `conversations.web_identifier` only. Then merge on first identity signal. |
| W-5 | Tulsa-centric hardcoding in `googleMapsApi.ts` (26-min radius, hardcoded coords) — fine for Clean Machine, **a deal-breaker** for the white-label vision. | P0 (vision-blocker) | `server/googleMapsApi.ts:7-14` | Move radius and origin into `business_settings` per tenant. Backfill Clean Machine's row with the current values. Audit every other "tulsa", "918", or hardcoded coordinate. |
| W-6 | The widget's first greeting is hardcoded copy in the React component. White-label tenants can't customize it without a deploy. | P1 | `EnhancedChatbotUI.tsx` | Pull the greeting from `business_settings.chat_greeting` (with a sensible default). While you're there, expose `chat_persona_name` and `chat_avatar_url` so a different tenant can rebrand the bot from one place. |
| W-7 | No accessibility scaffolding on the message stream. Screen-reader users hear nothing when a new bot message arrives. | P1 | `EnhancedChatbotUI.tsx` | Add `role="log"` and `aria-live="polite"` to the message container. Add `aria-label` to the send button. This is a 5-line change with disproportionate value. |
| W-8 | `/api/upload-photo` accepts attachments but has no per-session quota. A single anonymous visitor can upload as many large files as the global limit allows. | P1 (DoS / storage abuse) | audit notes | Per-session attachment cap (e.g. 5 photos, 25 MB total per 24h before phone verification), enforced server-side. |
| W-9 | OK: tenant scoping in `customerIdentityService.resolveCustomerIdentity` is correct — phone lookups are tenant-filtered. Cross-tenant leakage risk is low. | OK | `customerIdentityService.ts:350` | Keep. Add a unit test that asserts a phone number existing in two tenants returns two distinct customer IDs. |

---

## 4. Cross-Channel Joint Audit (SMS ↔ Web Chat ↔ FB ↔ Email)

### 4.1 The core problem: conversations are channel-keyed, not customer-keyed

```ts
// server/conversationService.ts:270-326 (paraphrase)
getOrCreateConversation({tenant, platform, customerPhone, fbSenderId, emailThreadId}) {
  if (platform === 'sms')      → find by (tenant, customerPhone, status='active', platform='sms')
  if (platform === 'web')      → find by (tenant, web_identifier, platform='web')
  if (platform === 'facebook') → find by (tenant, fb_sender_id)
  if (platform === 'email')    → find by (tenant, email_thread_id || email_address)
}
```

**Consequences:**
- Same human gets up to 4 simultaneous "active" conversations if they touch you on every channel.
- The AI sees only the channel it's currently on — it can answer "When's my appointment?" via SMS but not know the customer just rescheduled via web chat 30 seconds ago.
- The staff inbox shows the same person twice, with different colored channel badges and no link between them.
- Customer memory hydration (`smsCustomerMemoryHydrator`) pulls *appointment* history but not *cross-channel message* history.

### 4.2 The fix (P0, the single highest-leverage change in this audit)

Introduce a **`customer_threads`** concept: one row per `(tenant, customer_id)`. Each `conversation` row keeps its channel-specific identifiers but gains a nullable `thread_id` FK pointing at `customer_threads`. Resolution:

```
inbound (any channel)
  ↓
identity service tries to resolve customer_id (phone | email | fb_psid | cookie)
  ↓
if customer_id found:
  link/create customer_thread for (tenant, customer_id)
  attach this conversation's thread_id
else:
  leave thread_id NULL until identity is known later
```

The staff inbox switches from listing **conversations** to listing **threads**, with channel pills inside each thread row and a unified message timeline (interleaved by `created_at`, channel icon on each bubble). The AI's context becomes the thread, not the conversation. **This is the change that makes the product feel like Front, Intercom, or Kustomer instead of a Twilio panel.**

You don't need a destructive migration. Add the column, backfill where identity exists, route new traffic through the new path, and let unidentified threads collapse over time.

### 4.3 Other cross-channel gaps

| # | Finding | Severity | Fix |
|---|---|---|---|
| X-1 | A web-chat visitor who later texts "YES" to a booking offer that was *armed in web chat* will fail the `hasLiveBookingOffer` check, which is scoped to the SMS conversation. | P1 | After 4.2, scope booking-offer arming to the **thread**, not the conversation. The 30-min TTL stays. |
| X-2 | `automation_paused_until` is per-conversation. If staff pauses on SMS, the bot keeps replying on web chat. | P1 | Same fix — escalation pauses the thread, not one channel. |
| X-3 | Voicemail transcription is converted to an SMS reply but never appears in web chat or email view of the same customer. | P2 | After 4.2, voicemail becomes a system message on the thread with a "voicemail" channel pill and an inline player. Already proxied securely per replit.md. |
| X-4 | FB Messenger and IG DM exist in the schema's platform enum but lacked a clear inbound webhook handler in this audit pass. | P1 | If FB/IG are sold as features, verify there is a `/webhooks/facebook` route with signature verification (`x-hub-signature-256`). If not, mark these channels "coming soon" in marketing until built. |

---

## 5. Messaging Center UI — Deep Audit & Redesign

### 5.1 What's there today (`client/src/pages/messages.tsx`)

A 3-column layout, real-time via Socket.IO with 10s polling fallback. Working buttons: New, Send, Attach, Emoji, Take Over, Snooze, Resolve, Reactions. Stubs/half-built: Share Availability (clipboard only), Schedule Send (UI gated off), Read Receipts (intermittent), MMS gallery (image-only), Smart Schedule Panel (rarely activates).

### 5.2 Findings — UI

| # | Finding | Severity | Evidence | Fix |
|---|---|---|---|---|
| U-1 | **Composer rail overflows on small screens.** SmartComposeRail + emoji + attach + send is one un-wrapped flex row. | P1 | `client/src/components/ThreadView.tsx` | Wrap the rail in a **horizontally-scrollable `overflow-x-auto` strip** with a fade-out gradient on the right edge. Send button stays pinned right; everything else scrolls. Standard mobile-messaging pattern. |
| U-2 | **Redundant "New" buttons** (header + mobile FAB visible together at md breakpoint). | P2 | `messages.tsx`, `NightOpsMessagesLayout` | Show FAB only below `sm`, header button only at `md+`. |
| U-3 | **Z-index war between AppShell and NightOps headers.** | P1 | `NightOpsMessagesLayout` uses `z-40` | Define a single `z-index` scale in `tailwind.config` (`shell: 30, page-header: 40, modal: 50, toast: 60`) and use only those tokens. |
| U-4 | **Auto-scroll breaks when an image loads after the bubble mounts** (the MutationObserver doesn't see image height arrive). | P1 | `ThreadView.tsx` | Add `onLoad` listeners to message images that re-trigger scroll-to-bottom **only if user is already pinned to bottom** (track `isPinned` ref). |
| U-5 | **No virtualization.** Threads with 500+ messages will hitch on render and search. | P1 | `ThreadView.tsx` | Use `@tanstack/react-virtual` for the message list. Keep the existing IntersectionObserver "load older" pattern. Render-time goes from O(n) to O(visible). |
| U-6 | **Read receipts unreliable** — backend updates `readAt` only on the latest message. | P1 | `useReadReceipts.ts` | When the IntersectionObserver fires for any message, `PATCH /api/messages/:id/read` with the *highest seen message id*; server batch-updates everything ≤ that id. One write per scroll-stop, not per bubble. |
| U-7 | **Schedule Send UI is hidden behind `bookingStatus !== 'ready'`** — orphan logic, the button essentially never renders. | P2 | `SmartSchedulePanel` | Either ship it (a proper "send at…" picker) or rip it out. Half-features confuse staff and reviewers doing demos. |
| U-8 | **Share Availability button copies text only** — no tracked deep link, no analytics, no follow-up. | P1 (revenue lever) | `ShareAvailabilityModal` | Generate a real Smart Availability L2 link (the system already has the deep-link infra; `booking_initiation_events` tracks funnel stages). Insert the link into the composer instead of clipboard, with a tracked URL token so you can attribute the resulting booking back to that share action. |
| U-9 | **No "snooze until specific time" picker** — snooze appears to be a single duration. | P2 | snooze handler | Add 1h / 4h / tomorrow morning / next Monday / custom. Match Front/Superhuman conventions. |
| U-10 | **Customer profile sidebar is read-only** — staff can see the appointment but cannot reschedule/cancel/upsell from the panel. | P1 | `NightOpsContextPanel` | Wire the AI tool-calls (`reschedule_appointment`, `add_appointment_notes`, `get_upsell_offers`) as **manual buttons** in the panel. Same backend functions; the AI gets one set, the human gets the other. Massive productivity win. |
| U-11 | **No keyboard shortcuts.** Power users live and die by `j/k`, `e` archive, `r` reply, `/` search. | P2 | (none) | Add a `useHotkeys` layer + a `?` modal listing them. This is the cheapest "looks expensive" upgrade in the whole app. |
| U-12 | **No bulk actions on the conversation list.** Can't multi-select to mark read, snooze, archive. | P2 | `NightOpsConversationList` | Checkbox column on hover; bulk action bar at top. |
| U-13 | **Dead `onBookAppointment={undefined}` prop in `messages.tsx:231`** — points at an unfinished feature. | P2 | grep result | Either implement booking from inbox (redirect to `/bookings/new?customer=…` is fine) or remove the prop. |
| U-14 | **No "needs your attention" view.** When `needsHumanAttention=true` is set by escalation, there's no top-level filter showing only those conversations. | P0 (operational risk) | conversation list | Add a permanent "Needs you" tab at the top with a count badge. Same query, filtered by `needs_human_attention=true OR control_mode='manual'`. The whole point of escalation is wasted if the staff has to scroll to find escalated threads. |
| U-15 | **No cost / usage signal in UI.** Staff has no idea a thread has burned 40 AI calls. | P2 | (none) | Tiny "AI: 12 calls, $0.18" footer per thread. Pulled from the existing usage ledger. Trains owner intuition + becomes a great demo screenshot. |

### 5.3 The redesign in one paragraph

Replace the three rigid columns with a **Front-style two-pane** on desktop (list + thread, profile slides in as an overlay drawer triggered by a single button) and a **single-pane stack** on mobile (list → thread → profile). One global header with one z-index. A pinned "Needs you (3)" tab and a "Snoozed" tab. The composer becomes a single growing textarea with the action rail in a horizontal scroll strip and a single primary "Send" button that morphs into "Send SMS" / "Send web reply" / "Send via Messenger" based on the active channel — chosen by a small channel chip the user can override per-message. Reactions, typing, read receipts wired correctly. Keyboard shortcuts. Virtualized list. AI quick-replies as ghost suggestions inline with the composer (Apple-style). The result reads as "modern messaging app the owner is proud to show on stage at a SaaS conference," not "Twilio dashboard with a coat of paint."

---

## 6. Integrations & Tool-Call Audit

The AI agent has **13 structured tools** defined in `server/openai.ts:204-493`:

```
check_customer_database, validate_address, get_available_slots, get_upsell_offers,
create_appointment, build_booking_summary, request_damage_photos,
request_specialty_quote, confirm_address_validation, get_existing_appointment,
update_appointment_address, add_appointment_notes, reschedule_appointment
```

Plus background integrations: Google Calendar, Google Sheets (knowledge + customer import), Google Maps (address validation + drive time), Twilio Voice, Square (gift cards), Stripe (invoices), SendGrid (email), Slack (alerts), Open-Meteo (weather), OpenAI (`gpt-4o`).

### 6.1 Findings — Integrations

| # | Finding | Severity | Fix |
|---|---|---|---|
| I-1 | **Tools are defined for SMS but not surfaced as buttons in the staff UI.** Staff has to type free text or wait for the AI to act. | P1 | Build a `/messages` "Actions" rail inside the thread that calls the same tool functions: Reschedule, Add note, Send invoice, Send gift-card balance, Send rewards link, Send booking link, Validate address, Send weather warning. Same code path; new entry point. |
| I-2 | **No tool for `send_invoice`, `send_gift_card_balance`, `send_rewards_link`, `send_referral_link`.** These exist as background flows; the AI cannot invoke them mid-conversation. | P1 | Add four new tools, each thin wrappers around the existing services. The AI immediately becomes capable of: *"Sure, here's your gift-card balance and a rewards link → [tap to redeem]."* That is a *visible* premium-product moment. |
| I-3 | **No `transfer_to_human` tool.** Escalation happens implicitly by setting `needsHumanAttention`. AI should be able to *decide* and *announce*: "Let me grab Jody for you — one moment." | P1 | Add `transfer_to_human(reason: string, urgency: 'low'|'high')`. Sets escalation flags + Slack alert + customer-facing handoff message. |
| I-4 | **No `send_quote_pdf` tool.** Quote-first workflow exists for specialty jobs but ends in plain text. | P2 | Generate a branded PDF (you already render branded invoices) and send via MMS or email link. |
| I-5 | **No `weather_check_for_appointment` tool exposed to the AI.** Weather risk runs on a cron but the AI can't proactively warn a customer texting two days before. | P2 | Wrap the weather service as a tool. AI can now say "Heads up — 80% rain Saturday afternoon. Want me to slide you to Sunday morning?" |
| I-6 | **No SLA on Twilio status callbacks surfaced in UI.** A failed delivery shows in `sms_delivery_status` but the message bubble in the inbox shows "sent" forever. | P1 | Subscribe the inbox to `sms_status_update` Socket events and update bubble state to `delivered / undelivered / failed`. Red icon + retry button on failed. |
| I-7 | **Hardcoded Tulsa coordinates and 26-min radius in `googleMapsApi.ts`.** Same as W-5 — restated because it bites both web chat *and* SMS address validation. | P0 | Move to `business_settings`. |
| I-8 | **Webhook signature verification is solid for Twilio.** No evidence of equivalent for FB Messenger / IG (`x-hub-signature-256`), Stripe (`stripe-signature`), Square (`x-square-signature`). | P0 if those webhooks are in production | Audit each `/webhooks/*` route; require signature verification at the middleware level, fail-closed in production. |
| I-9 | **`DEMO_MODE` bypass in `notifications.ts:66`** silently no-ops Twilio sends. If `DEMO_MODE=1` ever leaks into production env, your customers stop receiving texts and you don't know. | P1 | Boot-time assertion: if `NODE_ENV==='production' && DEMO_MODE==='1'`, refuse to start. |
| I-10 | **No per-tool retry / circuit-breaker.** A flaky Google Calendar will cause AI tool calls to fail and the customer gets "I'm having trouble right now." | P2 | Wrap each tool with a small retry-with-backoff and a 60s circuit-breaker. On open circuit, AI gets a structured error and can route around (e.g., fall back to "I'll have Jody confirm and text you back."). |

---

## 7. Prioritized Action Plan

### Now (P0 — ship in the next 1–2 sprints)
1. **Cross-channel `customer_threads` model (X-0).** Single biggest UX + AI quality win.
2. **Web-chat abuse defense (W-1):** captcha + per-tenant token cap.
3. **Tulsa-hardcoding removal (W-5 / I-7):** unblocks white-label.
4. **iMessage tapback regex tightening (S-3):** stop dropping real customer messages.
5. **Booking state from structured drafts only, never from prose (S-5):** booking integrity.
6. **`PLATFORM_BG_JOBS_ENABLED` self-check + dashboard banner (S-9):** stop silent feature loss.
7. **"Needs you" tab in inbox (U-14):** make escalation actually visible.
8. **All non-Twilio webhook signature verification (I-8).**
9. **DEMO_MODE production guard (I-9).**

### Next (P1 — quarter)
- Inbox virtualization (U-5), composer overflow fix (U-1), z-index unification (U-3), reliable read receipts (U-6).
- Web-chat SSE for live takeover and typing (W-2).
- HttpOnly cookie identity for cross-device web chat continuity (W-3).
- Action rail in staff inbox wired to tool-call backends (I-1, I-2, I-3).
- SMS dedup made synchronous (S-2).
- Per-tenant AI token budget downgrade ladder (S-10).
- Twilio delivery status surfaced as message-bubble state with retry (I-6).
- Customizable widget greeting and persona (W-6).
- Manual-action buttons on customer profile sidebar (U-10).

### Later (P2 — polish & moat)
- Keyboard shortcuts + cheatsheet (U-11).
- Bulk actions (U-12).
- Snooze-until picker (U-9).
- AI cost footer per thread (U-15).
- Quote PDF tool (I-4), weather-check tool (I-5), per-tool circuit-breaker (I-10).
- god-handler refactor to staged inbound pipeline (S-1).
- Tenant-resolution LRU cache (S-6).

---

## 8. The "Premium Product" Section — Creative Plays

These aren't bug fixes. They're the moves that make this product *worth* what it should sell for.

1. **Unified-thread customer page.** When staff opens a customer, they see one chronological river: SMS in green, web chat in blue, voicemail in purple (with inline audio), email in grey, FB in indigo, internal staff notes in yellow. One scrollbar, one search. Front built a $1.7B business on exactly this UI. You already have 80% of the data model.

2. **AI that proactively offers handoff.** Before escalating silently, the AI says: *"I want to make sure I get this right — would you like me to have Jody call you in the next 30 minutes, or keep going by text?"* Implemented as a single new tool (`offer_human_handoff`). Customers tell their friends about that interaction.

3. **Owner mobile push when AI escalates.** Already have VAPID push. Add a single notification: *"Web chat from Sarah needs you — she's asking about a same-day Saturday booking."* Tap → opens the thread. Owner can reply from the lock screen. This is what makes the product feel like a co-worker, not software.

4. **AI-written thread summaries.** When staff opens a thread with > 20 messages, render a 2-line summary at the top: *"Sarah, returning customer, asking to reschedule Tuesday's interior detail to Saturday morning. Vehicle: 2021 Tahoe. Last service: 11/14, paid $230."* One `gpt-4o-mini` call, cached, refreshed when new messages arrive. Saves 30 seconds every time staff opens a thread.

5. **Channel switching as a first-class action.** A button on every thread: "Move to SMS" / "Move to email." Sends a polite handoff message on the current channel and continues on the new one, threading them together. Almost no competitor does this well.

6. **AI guardrails as visible product.** Show a tiny pill at the top of every AI reply: *"Verified by 3 tools: get_available_slots, validate_address, get_upsell_offers."* Builds trust with both the customer (in web chat) and with sales prospects watching a demo. This is your version of "powered by GPT-4" — except it actually means something.

7. **A "Demo Mode" that is *good*.** You have demo mode in the system. Productize it: a `/demo/clean-machine` URL prospects can visit that runs a scripted live conversation against real tenant data with a banner: *"This is a real Clean Machine customer experience, replayed."* Sales gold.

8. **Weekly "what your AI did this week" digest email** to the owner: messages handled, bookings created, escalations, money collected, hours saved, top intents. Pulled from existing usage ledger + appointments. Reinforces value, reduces churn, becomes the doc the owner forwards to their accountant.

9. **Public-status page per tenant.** `https://{tenant}.servicepro.app/status` — uptime of their SMS line, last delivery, weather risk for the next 7 days, current booking lead time. Looks like a Stripe status page. Zero ongoing cost; large perceived professionalism.

10. **Audit-mode for the AI.** A `/admin/ai-replay` page where the owner can scroll a thread and see, for every AI reply: which tools fired, what arguments, what the model returned, what was sent. Makes the system *legible* to the owner, which is the hardest thing any AI product has to do.

---

## 9. Appendix — Files Referenced (one-stop index)

**Inbound SMS:**
`server/twilioSignatureMiddleware.ts`, `server/phoneValidationMiddleware.ts`, `server/services/tenantCommRouter.ts`, `server/services/smsInboundDedup.ts`, `server/routes/twilioTestSms.ts`, `server/services/smsConsentKeywords.ts`, `server/sms/interactiveKeywords.ts`, `server/services/smsBookingRecordService.ts`, `server/services/bookingDraftService.ts`, `server/services/smsCustomerMemoryHydrator.ts`, `server/services/smsConversationContextService.ts`, `server/services/escalationService.ts`

**Outbound SMS:**
`server/twilioClient.ts`, `server/smsFailoverService.ts`, `server/services/smsSendGuard.ts`, `server/routes.twilioStatusCallback.ts`, `server/services/bookingConfirmationMonitor.ts`, `server/services/reminderService.ts`

**Web chat:**
`client/src/components/EnhancedChatbotUI.tsx`, `server/routes.ts:1930` (`/api/web-chat`), `server/conversationHandler.ts`, `server/services/customerIdentityService.ts`, `server/knowledge.ts`, `server/schedulingTools.ts`

**Conversation model & cross-channel:**
`shared/schema.ts` (conversations, messages, customers), `server/services/conversationService.ts`, `server/conversationService.ts`

**Messaging Center UI:**
`client/src/App.tsx:308`, `client/src/pages/messages.tsx`, `client/src/components/NightOpsMessagesLayout.tsx`, `NightOpsConversationList`, `NightOpsThreadView`, `client/src/components/ThreadView.tsx`, `NightOpsContextPanel`, `Composer.tsx`, `SmartComposeRail`, `MessageBubble.tsx`, `ShareAvailabilityModal`, `client/src/hooks/useReadReceipts.ts`

**AI / tools:**
`server/openai.ts:204-493`, `server/schedulingTools.ts`, `server/gptPersonalizationService.ts`

**Integrations:**
`server/googleMapsApi.ts`, `server/notifications.ts`, `server/routes.twilioVoiceIvr.ts`, `server/routes.giftCards.ts`, `server/services/giftCardSquareService.ts`, `server/routes.email.ts`, `server/routes.pushNotifications.ts`, `server/errorMonitoring.ts`

---

*End of audit.*
