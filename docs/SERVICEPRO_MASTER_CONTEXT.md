# ServicePro v3 — Master Context Document
**Last updated:** 2026-06-06
**Purpose:** Durable, high-detail context so no work, decision, preference, or philosophy is lost across chat compaction or new sessions. This is the single source of truth. Read this first in any new session.

---

## 0. WHO / WHAT / WHY

**The person (J)** is the non-technical founder, sole owner, and product director of two interlocked ventures:

1. **Clean Machine Auto Detail** — a real, live mobile auto-detailing business in Tulsa, OK. Strong review base (250+ five-star). The founder's actual livelihood. It is the production "guinea pig" tenant on ServicePro, with `tenant_id = 'root'`. Growth goal: scale from one van to a multi-van, employee-run operation.

2. **ServicePro v3** — a multi-tenant B2B SaaS platform ("Shopify for service businesses"). Clean Machine is the live proving ground. Target valuation: $10–50M. Launch verticals: lawn care, pool service, pressure washing, house cleaning, mobile pet grooming.

Every feature built for Clean Machine is simultaneously productized for other service businesses. Dual-track is central: success = a platform stable enough to sell AND a detailing business scaled enough to prove the model.

**J is non-technical.** J follows step-by-step instructions literally and needs EXACT file names, paths, and commands in copy-pasteable markdown blocks, clearly labeled as to what tool they go into (Claude Code vs Replit shell vs this chat). J does not know the codebase mechanics and relies on Claude to be the architect and expert.

---

## 1. WORKING MODEL (LOCKED — do not deviate)

Three separate surfaces, each with one job:

- **Claude Code (the Claude Code APP on J's Windows machine, `C:\Users\jodyb\`)** = ALL code reading, editing, and git commits/pushes. 
  - **CRITICAL SETUP:** Every NEW Claude Code session starts with NO repo. The FIRST instruction must always be to clone it:
    ```
    git clone https://github.com/cleanmachinetulsa/ServicePro_v3.git
    ```
    Then confirm `server/` and `client/` are visible, run `git log` to show latest commit, and report git state before any task. Because it clones fresh from GitHub, it always pulls the latest committed work automatically — no special "loading" of prior work is needed.
  - Claude Code does NOT have DB secrets (no `DATABASE_URL`, no Twilio/Stripe/SendGrid keys). It can read and edit code freely and write migration scripts, but it CANNOT run anything against the live database. J runs those on Replit.

- **Replit** = deploy + run only. The Replit shell prompt is `~/workspace$`. Replit HAS all the production secrets including `DATABASE_URL` (production Neon — there is NO dev database). Workflow on Replit:
    ```
    git pull origin main
    npx tsx scripts/<scriptname>.ts     # run migrations / tests here
    npm run build                        # REQUIRED to compile frontend changes
    ```
  - **KEY DEPLOY INSIGHT (learned the hard way):** `git pull` updates source code, but the React frontend is a COMPILED bundle. UI changes do NOT appear until `npm run build` runs. Also: viewing the Replit PREVIEW iframe is a different origin / service-worker context than the published URL — test on the PUBLISHED `.replit.app` URL, not the preview, and hard-refresh after a build.

- **This Claude chat** = planning, review, approval, decisions, writing the instructions that get pasted into Claude Code. NO Replit agent prompts ever. Results always come back HERE for review regardless of which tool did the work.

**Models:** Sonnet for almost everything (Claude Code + routine planning). Opus reserved for hard architecture decisions and complex UI design.

---

## 2. GUARDRAILS (always apply)

- Production `DATABASE_URL` is the ONLY database. No dev DB. 
- Schema changes are **additive-only**, via raw SQL or `npx tsx` migration scripts. **NEVER `drizzle-kit push`.**
- Read every file fully before editing. Grep before creating anything new (avoid duplicate/parallel implementations).
- Failure isolation: never break payments, bookings, or loyalty paths.
- Synthetic test customers must use `try/finally` cleanup so zero rows remain.
- One stage at a time — stop and report before starting the next.
- No fake/placeholder data anywhere (`placeholderData`, `initialData` are banned) — features go live unnoticed and break silently.
- Fail open on non-critical sends (e.g. SMS) — log a warning, never throw or block the primary action.

---

## 3. TECH STACK

- **Frontend:** React + TypeScript, built with Vite. PWA (installable on phone). 
- **Backend:** Node + Express.
- **DB:** PostgreSQL via Neon (serverless), Drizzle ORM.
- **Comms:** Twilio (SMS, voice, voicemail).
- **Payments:** **Stripe is live and primary** (payment links, webhook-driven confirmation). **Square is gift-cards ONLY** (no shadow-system risk — cleanly separated). Manual methods (Venmo/CashApp/PayPal) are text links, tech marks paid manually.
- **Email:** SendGrid.
- **Google:** Calendar, Maps, Sheets, OAuth.
- **AI:** Anthropic Claude API (SMS agent, smart replies).
- **Future:** native mobile app via React Native + Expo (separate surface, architecturally required for VoIP softphone because Safari kills backgrounded WebSockets; CallKit/ConnectionService are OS-level VoIP frameworks).

---

## 4. THE GOAL: CM-7, THE WELCOME-BACK BLAST

The entire current sprint exists to safely re-send a welcome-back blast to ~2,300 dormant customers (mostly RETURNING customers who already have loyalty points). 

**Why the sprint was needed:** In Dec 2025, a blast went out on top of three broken subsystems — points-award threw an error, the send-tracking table didn't exist, and there was zero number validation (it texted fake numbers and the business's own line). DEF-33 documented this from production logs. The rescue sprint fixes the foundation BEFORE re-sending.

**Blast copy philosophy:** gift-forward (free add-on, NOT a discount), proof-led ("250+ five-star reviews, refreshed packages"), NEVER "we raised prices." Filtered through science-backed conversion / pricing psychology (a core J interest).

---

## 5. SPRINT STATUS — COMPLETED & COMMITTED

All pushed to GitHub `main` at `github.com/cleanmachinetulsa/ServicePro_v3`:

| Stage | What | Commit |
|---|---|---|
| CM-1 | Loyalty points-award bug fixed; routed through canonical `loyaltyLedger.earn()` with idempotency. 25/25 test. | ac4a8b8 |
| CM-2 | Send tracking. Found existing `port_recovery_sms_sends` table + `portRecoverySmsSender.ts` already did dedup/status; added `delivered_at` col (migration 0017) + Twilio status callback. 19/19. | e126f05 |
| CM-3 | Number validation (E.164 `\d{7,14}`, blocks fake/reserved +1(555\|900\|976), to==from guard) + suppression (fixed `sms_suppression_list` column mismatch, added tenant filter). 73 STOP'd numbers honored. 27/27. | 50d4c41 |
| CM-4 | `{name}` template fallback sweep across 3 interpolate functions. 41/41. | 1505b55 |
| CM-5 | Email path. Root cause was SendGrid (not code) — see §7. Code fixes: broken sendEmail arg signature routed through `sendTenantEmail`; enriched error logging; text fallback via `stripHtmlToText`. 27/27. | 7755449 |
| CM-6 | FULL pricing restructure (migration 0018). New names/prices, surcharge disclose-and-confirm (removed auto-add), $35 travel-fee disclosure, Pit Stop redirect modal. NOTE: migration accidentally run twice → duplicate Showstopper(78)/Paint Restoration(79) → cleaned via `cleanDuplicates.ts` (deleted IDs 78,79). | b0b9582 |
| M1 | Verified (read-only) `/schedule` route is public (App.tsx:812, aliases `/book` `/booking`), mounts `Schedule.tsx`, reads `rewardId/rewardName/rewardPoints` from URL → passes to `MultiVehicleAppointmentScheduler`. No auth gate, no 404 risk. Blast redemption CTA safe. | verified |
| S4+S2 | S2: customer completion SMS on tech job complete. S4: invoice NOT auto-sent; returns `requiresInvoiceConfirmation:true` + new endpoint `POST /api/tech/jobs/:jobId/send-invoice` with confirm-total modal (editable amount pre-filled to range midpoint, notes, Send/Send Later). Fixed 3 pre-existing bugs: missing `or` drizzle import, wrong sendSMS signature (correct = `sendSMS(tenantDb, phone, msg)`), null deposit crash on online/free. 25/25 test. | b508618 |
| HUB-1 | Fix1 iOS/Android composer (`h-screen`→`h-dvh`, added dvh to tailwind.config.ts, safe-area-inset-bottom padding). Fix2 amber "Manual Mode" banner in AutopilotBanner.tsx + returnToAIMutation → `POST /api/conversations/:id/return-to-ai`. Fix3 new `useUnreadCount.ts` hook (monitoring socket, sender==='customer', cross-page toast + sidebar red badge + PWA badge). 7 files, 249 insertions. | ef91317 |
| BUILD FIX | S4 modal had a JSX syntax error (`JobCompletionDialog.tsx:985`) that broke `npm run build` — meaning HUB-1 fixes never actually deployed until this was fixed. Build now passes clean. **LESSON: S4 tests were logic-only and never compiled the frontend. Always run `npm run build` as part of verifying any frontend change.** | (post-ef91317) |

---

## 6. FINAL LIVE PRICING (in DB, tenant_id='root')

All research-backed against Tulsa competitor data (primary comp: Dom's Details mobile $159.99–499.99; Brian's 2yr ceramic $700).

**Packages:**
- **Pit Stop** $179 (ID 5) — maintenance
- **The Deep Clean** $249 base / $349 heavy / extreme quoted (ID 4) — interior; J's MOST COMMON service
- **Showroom** $349 (ID 3) — full detail, center-stage "Most Popular"
- **Paint Revival** $249 (ID 6) — single-stage polish, exterior only
- **Paint Restoration** $399 (ID 77) — two-stage, exterior only
- **Showstopper** $549 (ID 76) — Showroom + single-stage + engine bay + headlights + protectant (repriced UP from a wrong $475 after J caught the math)
- **Force Field** $499 (ID 7) — ceramic 1–2yr
- **Force Field Pro** $950 (ID 8) — 3yr ceramic (repriced up from a wrong $750)

**Add-ons:** Engine Bay Detail $75 (17) / Headlight Restore $90 (14) / Carpet & Upholstery Shampoo $100 (11) / Fabric & Leather Protector $79 (12) / Ozone Odor Removal $75 (19) / Plastic Trim Restore $65 (16) / Glass & Windshield Protector $49 (18) / Premium Wash $99 (10) / Motorcycle Detail $199 (9).

**Retired:** Light Polish (ID 13, [Retired] prefix) / 12-Month Ceramic (ID 15, [Retired] prefix) — both had 0 bookings, safe to hard-delete anytime.

The AI auto-quotes from the `services` DB table via `smsAgentPromptBuilder.ts` — no prompt file edit needed; new names/prices are automatically used.

---

## 7. SENDGRID — RESOLVED (long, painful saga)

- Original SendGrid account was TERMINATED for unpaid invoices.
- A second account got auto-blocked by association with the old terminated account.
- **Resolution:** created a THIRD fresh account with a DIFFERENT login email + added a payment method.
- Domain-authenticated `cleanmachinetulsa.com` via GoDaddy. The NEW account's records: CNAMEs `url1650`, `108770664`, `em4123` → and updated existing `s1._domainkey` / `s2._domainkey` / `_dmarc` (these conflicted because the OLD account had set them). All point to new account `u108770664.wl165.sendgrid.net`.
- **DNS safety facts:** the website A record `34.111.179.208` and `www` CNAME and all Replit/Google/Twilio records were NEVER touched — website was never at risk.
- **9 old typo-domain records** (`cleanmacinetulsa.com` — missing the 'h', pointing to old account `u51779716`) are harmless leftovers, safe to delete anytime (cleanup, non-blocking).
- Sender identity `info@cleanmachinetulsa.com` auto-verified (matched authenticated domain).
- **LIVE SEND CONFIRMED WORKING.** 
- **WATCH-OUTS that wasted time:** (a) the API key in Replit had a DUPLICATE secret entry causing stale-key confusion — there must be exactly ONE `SENDGRID_API_KEY`. (b) Replit shell caches env vars — a new value needs a fresh shell or app restart. (c) "Authenticated user is not authorized to send mail" = account-level block (was the old terminated account). (d) J accidentally pasted a real API key into chat → was told to delete/rotate it; replacement working.
- TODO (non-blocking): delete the 9 typo-domain DNS records.

---

## 8. OPERATIONAL READINESS AUDIT — full findings

Read-only audit of the entire customer journey. Status as of this session:

🟢 = working / 🟡 = partial or gap / 🔴 = broken or missing

- **Booking confirmation** 🟡 → SMS fires on booking (`calendarApi.ts:1089`). Email path existed but was blocked by SendGrid (now fixed). Day-before reminder uses in-process `setTimeout` → LOST on server restart (DEF-6, persistent-queue gap).
- **Day-of automation** 🟡 → hourly confirmation monitor (7-day + 48-hr SMS reminders) works. "On my way" exists (`sendOnTheWayNotification`, `navigationService.ts`) but is MANUAL-trigger only — tech status change to `en_route` does NOT auto-fire it. No morning-of reminder.
- **Post-service completion msg** 🔴→✅ FIXED in S2 → customer now gets a completion SMS on job complete.
- **Invoice** 🟡→✅ FIXED in S4 → confirm-total modal (tech enters actual amount within range, then sends Stripe link). Was previously created-but-not-sent.
- **Review request** 🟡 → `sendReviewRequest` fires on invoice mark-as-paid, but IMMEDIATELY, not the intended 2-day delay (S3, comment is aspirational, no scheduler). SMS only, no email. Google + Facebook review URLs CONFIRMED configured in `tenant_config`. ✅
- **Loyalty redemption** 🟡→✅ /schedule route verified (M1). Earn side rebuilt solid (L0-L6). Customer looks up points by phone (no auth) — expected design.
- **Scheduling/calendar** 🟡 → `SchedulingDashboard.tsx` is shift-management (who's working), NOT an appointment calendar. Owner manages bookings via Google Calendar. No native day/week appointment view in-app.
- **Payment processor** 🟢 → Stripe live/primary, Square gift-cards-only, no shadow risk.
- **Escalation to human** 🟢 → strongest workflow. `escalateSmsToHuman()` sets `needsHumanAttention`, pauses AI 6h, SMS + push to owner, "Needs you" badge.

**Pre-blast MUST-FIX (all now ✅):** M1 route, SendGrid, review URLs, S4 invoice, S2 completion msg.

**SHOULD-FIX soon (post-blast OK):** S1 reminder persistence, S3 review 2-day delay.

**CAN TRAIL:** "on my way" auto-trigger (DEF-34), morning-of reminder, email review request, native calendar view.

---

## 9. THE MESSAGES UI — KNOWN PROBLEM, NEEDS A REAL REVAMP (NOT PATCHES)

This is the current active pain point. The messaging hub ("NIGHT OPS — Conversations & Dispatch", labeled "Messaging Hub v2") is how the owner will handle the wave of blast replies. J considers the current UI unacceptable quality and wants a full re-template, not more incremental fixes. The "Night Ops" styling was only ever a placeholder.

**Concrete problems J has identified (confirmed via screenshots):**
1. **Two different back buttons** — one in the thread header ("Back THREAD") and another below it ("← Back"). They go to different views, one of which is pointless. Visible in narrow/responsive layout especially.
2. **Massive wasted vertical space** in the thread view — empty space eats the screen real estate that should show message content.
3. **Responsive layout breaks** — when the window narrows, the sidebar disappears, an extra/orphan view-window section appears that doesn't belong, and it "looks and feels terrible." Expected to be even worse on true mobile.
4. **Channel switching fails** — "Switch failed 400: Target email channel requires a customer email address" and "Target instagram channel requires a linked sender ID" error toasts.
5. **"Connection lost — Messages may not be sent or received"** error appears.
6. **Phone calls / voicemails are interleaved into SMS threads** — this is the unified-timeline behavior intentionally built in the prior Comms Hub Stages 1–4 (May session). If J doesn't want calls mixed with SMS, that needs a filter/display option. NOT a HUB-1 regression.

**Files in the messages surface (mapped during HUB-1):**
- Page: `client/src/pages/messages.tsx`
- Layout shell: `client/src/components/messages/NightOpsMessagesLayout.tsx`
- Thread view: `client/src/components/messages/NightOpsThreadView.tsx` (and a separate `client/src/components/ThreadView.tsx`)
- Banner: `client/src/components/messages/AutopilotBanner.tsx`
- Sidebar/nav: `client/src/components/AppShell.tsx`
- Unread hook: `client/src/hooks/useUnreadCount.ts` (new, HUB-1)
- Bundle: `messages-*.js` ~184 kB

**DECISION PENDING:** whether to (a) do a focused fix of the double-back-button + wasted-space + responsive issues, or (b) a full ground-up re-template of the messaging hub to a production standard (Intercom / Front / Superhuman / iMessage-grade). J leans strongly toward (b) — a complete rework — and wants it designed properly to the PhD-expert standard, looking at the CODE not just screenshots. This is a candidate for an Opus design session.

**Full hub staging (from earlier planning):**
- HUB-1 ✅ blast-blockers (done)
- HUB-2 — Quick Reply Library (premium curated one-tap responses; J PRIORITY feature; foundation exists)
- HUB-3 — daily-driver fixes: Save Notes broken, archived/snoozed/resolved filters missing, dead Redeem Points button, Campaign Replies filter
- HUB-4 — persistent context panel, mobile polish, design-system consistency, empty/error states, the double-back-button + density + responsive overhaul

A `COMM_HUB_DESIGN_REVIEW.md` was produced earlier (compares current hub to Intercom/Front/Superhuman standard).

---

## 10. PENDING / BACKLOG (post-blast unless noted)

- **CM-7 — SEND THE BLAST.** The final goal. All pre-blast gates green. Remaining: verify HUB-1 fixes work on the PUBLISHED url after build + hard refresh; then send.
- **Messages UI revamp** (see §9) — J wants this addressed; decide scope before CM-7 or accept current state for the blast and revamp right after.
- **Technician Hub features (DEF-34):** (1) "next customer" function — opens next job in Maps with customer profile; (2) "on my way" notification with the tech's AI-polished bio + uploaded photo, so the customer feels a neighbor is coming, not a stranger. The tech writes a quick bio, AI polishes it to sound professional/warm/concise; tech uploads a photo to their profile; customer gets "Your detailer [Name] is on the way, ~X min out" + bio + photo. `sendOnTheWayNotification` exists but is manual + lacks bio/photo. This is brand-defining for the "premium, personal" positioning.
- **Booking-flow "window within a window" UX** (DEF-27) — separate from the messages issue, documented, deferred.
- **Master Plan v5** — NOT written yet. The v5 questionnaire was completed in the loyalty-rebuild session; v5 comes AFTER the Clean Machine sprint, informed by it. v4 (`SERVICEPRO_MASTER_BUILD_PLAN_v4.md`) is stale and missing the inbound Comms Hub entirely. Domain-authentication-for-tenants should be scoped into v5 (auto-provision sending domain in onboarding). The operational audit (§8) is the foundation for v5.
- **Kit sync** — kit docs in the repo (`docs/`) are stale (show sprint not-started). `_START_HERE.md` and `CLEAN_MACHINE_RESCUE_SPRINT.md` are NOT in the repo — they were in a referenced zip. Update the kit with this session's progress as part of closing CM-7.
- **Post-blast small fixes:** S3 review 2-day delay, S1 reminder setTimeout persistence (DEF-6), morning-of reminder, email review request, delete 9 typo-domain DNS records.
- **Bigger backlog:** DEF-13 loyalty engine consolidation (promoEngine + gamificationService still write loyalty directly — 3 engines should be 1), DEF-14 expiry (decided: rolling 12-month), DEF-9/26 auth/session audit, DEF-11/19 multi-tenant hardening before tenant #2, DEF-23 abuse/cost-control (Twilio bot-loop drain). 48+ DEF items logged in the parking lot.
- **Parked v2 features:** Google Workspace Reseller + Cloudflare Registrar domain provisioning. Dograh voice integration (concept-only, NOT a committed plan).
- **Stage 7A/7B (future):** browser softphone (Twilio Voice JS SDK, 4-state widget), then native app (React Native + Expo + CallKit/ConnectionService).

---

## 11. RECURRING DEFECT CLASSES (watch for these)

1. **tenantDb-signature mismatch** — functions called with wrong arg order (e.g. `sendSMS` is `(tenantDb, phone, msg)`).
2. **`||'root'` tenant fallbacks** masking missing auth context.
3. **Global tables lacking `tenant_id`.**
4. **Older-shadow-code** — parallel implementations from multiple AI tools, never consolidated. ALWAYS grep before creating; read before editing (DAVP — Deep Audit Verification Protocol).
5. **Float-money math** in financial calculations.

Plus the new lesson: **frontend changes must be verified with `npm run build`**, not just logic tests — a JSX syntax error passed 25/25 logic tests but broke the entire build and silently prevented HUB-1 from ever deploying.

---

## 12. HOW J WANTS CLAUDE TO WORK (preferences — IMPORTANT)

- **Be the architect and expert reviewer.** Make expert calls inline rather than constantly deferring. Flag your own misses honestly.
- **NO guessing. NO skimming. NO half-measures.** When uncertain, SAY SO and ask how to get real info (screenshots vs. reading code) rather than guessing and sending J down a wrong rabbit hole. Guessing wrong and wasting J's time is the single biggest source of frustration (and profanity).
- **Don't conflate separate issues.** (e.g. the messages-UI layering problem is NOT the booking-flow "window within a window" problem.)
- **Prove research-backing line-by-line.** Every price/decision must be provable against research or explicitly flagged as positioning-based. Don't claim "research-backed" without showing it.
- **Format clearly:** put anything J should paste into Claude Code (or run on Replit) into a clearly-labeled markdown code block, so J always knows what to copy and where it goes. Distinguish "this is me talking to you" vs "paste this into Claude Code."
- **Complete, copy-pasteable outputs with no gaps** — J does manual edits poorly and they introduce errors.
- **Fast momentum over exhaustive back-and-forth.** Short, decisive answers to complex questions. List-style for instructions.
- **One authoritative document** rather than multiple files to synthesize.
- **Plain English, define jargon.** J dislikes unexplained jargon.
- **Remind J about follow-ups** (uploading website copy, updating the kit/session-handoff after each Claude Code stage, etc.).
- **Quality bar = the "PhD expert" standard.** J has a master "expert prompt" persona (PhD CS/software eng, senior prompt engineer, principal full-stack, UX/UI lead grounded in HCI + WCAG, PhD business strategy + pricing psychology, premium-UX behavioral psychology). Build everything to that standard. The platform is a $10–50M-valuation product, not a hobby — design to that scope.

---

## 13. RECOMMENDED NEXT SEQUENCE

1. **Redeploy with the build fix.** On Replit: `git pull origin main` → `npm run build` → test on the PUBLISHED `.replit.app` URL (not preview), hard-refresh. Confirm the HUB-1 notification, manual-mode banner, and keyboard fix now actually work.
2. **Decide the messages-UI scope** (§9): full revamp now (Opus design session, build to PhD standard) vs. accept-for-blast-and-revamp-right-after. J leans full revamp.
3. **If revamping:** do a proper code-level audit of the messages component tree + a production-grade redesign spec before any building. Look at the CODE, compare to Intercom/Superhuman/Front. Do NOT design from screenshots alone.
4. **CM-7 — send the blast** once J is satisfied the inbound experience can handle the wave.
5. **Kit sync + Master Plan v5** after the blast, informed by real customer data and the operational audit.

---

*End of master context. Keep this updated as the durable reference.*
