# SERVICEPRO — FIXPACK STAGE 2A–2D
## Inbox & Messaging Hardening — Audit and Fix Existing Implementations
## Namespace: FIXPACK (not Comms Hub)
### Paste GUARDRAILS_PRE_PROMPT_FINAL.md first, then this.
### Only run after Fixpack 1A completion report is reviewed and approved.

---

## CONTEXT — CRITICAL: READ BEFORE ANYTHING ELSE

This is an **audit-and-fix** prompt. Several features are already implemented. Your job is to find what is broken and make the minimum targeted fix. Do not rebuild anything that already exists.

**Confirmed already done — do not rebuild, do not reinstall:**
- `VirtualizedMessageList.tsx` exists and is used by `ThreadView.tsx`. `@tanstack/react-virtual` is already in `package.json`. Do not install it again.
- z-index token scale already in `tailwind.config.ts` with tokens: `shell`, `page-header`, `modal`, `toast`. Do not rename or replace them.
- Share Availability inserts into composer via `window.dispatchEvent(new CustomEvent('composer:insert', ...))`. It is not clipboard-only. Do not touch it.
- `sms_status_update` Socket.IO listener already exists in `ThreadView.tsx` (~line 523).

**Confirmed broken — these are the four actual tasks:**
1. Delivery status broadcast goes to wrong Socket.IO room — client never receives it
2. VirtualizedMessageList may have edge cases for image load remeasure and scroll-to-bottom
3. Send row in `ThreadView.tsx` overflows at 375px — not `Composer.tsx` which is the new-message modal
4. Some components still use raw z-index numbers instead of the existing token names

---

## SEARCH BLOCK — READ ALL OF THESE BEFORE WRITING ANYTHING

```
server/routes.twilioStatusCallback.ts
  (find: the io.to('monitoring').emit call; find where delivery status is written to DB;
   find whether message rows store a Twilio MessageSid)

server/websocketService.ts
  (find: broadcastNewMessage, join_conversation handler, monitoring room handler,
   understand the room architecture)

client/src/components/ThreadView.tsx
  (find: socket.emit('join_conversation'...) ~line 479;
   find: socket.on('sms_status_update'...) ~line 523;
   find: the send row container — search for "flex gap-2.5" and "handleSendMessage";
   find: how message state is managed — React Query or local state)

client/src/components/VirtualizedMessageList.tsx
  (read fully — find: measureElement usage, scroll-to-bottom implementation,
   load-older-messages trigger, how MessageBubble is rendered per row)

client/src/components/messages/MessageBubble.tsx
  (find: how deliveryStatus is rendered; whether images have onLoad handlers)

tailwind.config.ts
  (confirm existing zIndex token names — use those exact names)

client/src/components/messages/NightOpsMessagesLayout.tsx
  (grep for raw z-30, z-40, z-50, z-[...] values)

client/src/components/AppShell.tsx
  (grep for raw z-30, z-40, z-50, z-[...] values)
```

---

## TASK 2A — Fix delivery status real-time updates

**The bug:** `routes.twilioStatusCallback.ts` emits `sms_status_update` to the `'monitoring'` Socket.IO room. `ThreadView.tsx` joins `conversation:${conversationId}` — not monitoring. So the listener in ThreadView never fires.

**Before writing any code, answer these questions by reading the files:**

1. Does the outbound SMS send path store the Twilio `MessageSid` anywhere on the message row? Look in the messages table schema (check `shared/schema.ts` messages table for a `messageSid`, `twilioSid`, or similar column), or in the message's `metadata` JSONB field.

2. Does `routes.twilioStatusCallback.ts` currently look up a `conversationId` or `messageId` when processing a status callback? Or does it only have `MessageSid`, `MessageStatus`, `To`, `From`?

3. Does `ThreadView.tsx`'s `sms_status_update` handler use `queryClient.invalidateQueries` or local state mutation?

**Then implement the fix based on what you find:**

**Best case (MessageSid stored on message row or metadata):**
- Look up the message row by `MessageSid`
- Get its `conversationId`
- Update delivery status on the message row
- Emit to `conversation:${conversationId}` with `{ messageId, messageSid, deliveryStatus: MessageStatus }`

**If MessageSid is only in metadata JSONB:**
- Query: `WHERE metadata->>'messageSid' = $MessageSid` or equivalent in Drizzle
- Then proceed as above

**If no MessageSid is stored at all:**
- Do not fake a lookup. Instead: store `MessageSid` in the message `metadata` JSONB at send time (find where outbound SMS messages are inserted and add `messageSid` to the metadata object — no schema change required, metadata is already JSONB)
- Then on the next status callback, the lookup will work
- Document this two-part fix in the completion report

**The broadcast (add after the existing monitoring emit — do not replace it):**
```typescript
// Emit to the specific conversation room so ThreadView's listener fires.
try {
  if (conv && conv.id) {
    io.to(`conversation:${conv.id}`).emit('sms_status_update', {
      messageId: targetMessageId,   // the messages table row ID, if found
      messageSid: MessageSid,
      deliveryStatus: MessageStatus,
      conversationId: conv.id,
      timestamp: new Date().toISOString(),
    });
  }
} catch (emitErr) {
  console.warn('[TWILIO STATUS] conversation room emit failed (fail-open):', emitErr);
}
```

**Client-side (ThreadView.tsx ~line 523):**
The existing `sms_status_update` handler is already there. Verify it handles the new `messageId` and `deliveryStatus` fields. If it currently only calls `queryClient.invalidateQueries`, that is acceptable — the refetch will show updated status. If it does local state patching, verify the field names match what you are emitting.

**Do not:**
- Create new Socket.IO namespaces or a second websocket service
- Change the existing monitoring broadcast
- Change `websocketService.ts`

---

## TASK 2B — Audit VirtualizedMessageList for edge cases

**The component already exists and is wired. This is an audit — report before fixing.**

Read `client/src/components/VirtualizedMessageList.tsx` fully. Then check each of these:

**2B-i — Image load remeasure:**
Does each virtual row's container div have `ref={rowVirtualizer.measureElement}` (or equivalent)? If yes, the browser's ResizeObserver inside `@tanstack/react-virtual` automatically detects height changes when images load — this is the correct approach and requires no `onLoad` handler.

If `measureElement` ref is missing from the row container, add it. Do not add `onLoad` handlers on images — the ResizeObserver approach is cleaner and handles all content types.

**2B-ii — Scroll-to-bottom after new message:**
Find the scroll-to-bottom trigger. It should call `rowVirtualizer.scrollToIndex(messages.length - 1, { align: 'end' })` after new messages arrive. If it uses `scrollTop = scrollHeight` on the DOM element directly, this bypasses the virtualizer and will fail for unmounted rows (rows above the viewport are not in the DOM).

Fix only if broken: replace DOM-level scroll with `rowVirtualizer.scrollToIndex`.

**2B-iii — Load older messages:**
Find the "load older messages" trigger. If it is a button — leave it as a button. Do not invent IntersectionObserver behavior unless the existing UX already uses it. Just verify the button still works correctly with the virtualized list (the first rendered row is a virtual item, not a static DOM node at the top of the scroll container).

**Report findings first. Only change code where a problem is confirmed.**

---

## TASK 2C — Fix send row overflow at 375px

**File: `client/src/components/ThreadView.tsx` only.**

Do not touch `client/src/components/messages/Composer.tsx` — that is the new-message modal, not the active thread send row.

Find the send row. It contains: attach button, textarea, template/variable button, channel override select, send button. It is likely near the `handleSendMessage` function and `SmartComposeRail`.

The overflow at 375px is caused by fixed-size siblings without flex shrink constraints, and the outer container lacking `min-w-0`.

**Minimum changes needed — add CSS classes only, do not restructure:**

1. Outer flex container — add `min-w-0`:
   ```tsx
   // Find the container that wraps the full send row
   // Add min-w-0 to it so it doesn't overflow its parent
   className="... min-w-0"
   ```

2. Textarea wrapper div — add `flex-1 min-w-0`:
   ```tsx
   className="... flex-1 min-w-0"
   ```

3. Icon buttons (attach, emoji, template) — add `shrink-0`:
   ```tsx
   className="... shrink-0"
   ```

4. Channel override select — either add `shrink-0 max-w-[80px]` or hide on small screens with `hidden sm:flex` if it rarely matters on mobile.

5. Send button — add `shrink-0`:
   ```tsx
   className="... shrink-0"
   ```

Verify at 375px: the send button must be fully visible without horizontal scrolling. The textarea may shrink — that is correct.

Do not add a horizontal scrolling container. Do not move `SmartComposeRail` unless it is confirmed to be part of the icon row (it appears to be an extension slot above the textarea, not inside the icon row).

---

## TASK 2D — z-index token audit

**Existing tokens in `tailwind.config.ts` (confirmed):**
- `z-shell` = 30
- `z-page-header` = 40
- `z-modal` = 50
- `z-toast` = 60

Do not add, rename, or replace these. Use them as-is.

**The audit:**

Run these searches and report every result:
```bash
grep -rn "z-\[" client/src/components/messages/ client/src/components/AppShell.tsx
grep -rn " z-30\b\| z-40\b\| z-50\b\| z-60\b\| z-70\b" client/src/components/messages/ client/src/components/AppShell.tsx
```

For each match, make the replacement only if you are certain of the layer:
- Sticky message header in `NightOpsMessagesLayout.tsx`: `z-40` → `z-page-header`
- Main sidebar/nav in `AppShell.tsx`: `z-30` → `z-shell`
- Any dialog or sheet in messages components: `z-50` → `z-modal`
- Any toast container: `z-60` → `z-toast`

**If you are not certain what layer a z-index belongs to: do not change it. Record it in the completion report as "left unchanged — layer unclear."**

Do not touch `client/src/components/ui/` — those are shadcn primitives managed separately.
Do not mass-replace. Only replace what you can confirm.

---

## TESTS REQUIRED

```bash
npx vitest run server/tests/tenantCommRouter.test.ts
npx vitest run server/tests/smsSendGuard.test.ts
```

Manual verification (do these in the running dev server):
1. Send an SMS from a test number. Without refreshing, confirm the message bubble shows a delivery status update (delivered/failed) within 30 seconds.
2. Open a thread with 50+ messages. Scroll up and down — no jank or blank rows.
3. At browser width 375px: confirm the send button is visible without horizontal scrolling.

---

## COMPLETION REPORT REQUIRED

```
## FIXPACK 2A–2D COMPLETION REPORT

### Task 2A — Delivery status realtime fix
MessageSid storage confirmed: [where it is stored — message column / metadata / not stored]
If not stored: outbound send path patched to store it: [Y/N — file and approx line]
conversationId lookup method: [describe — query by phone / query by messageSid / other]
Monitoring broadcast preserved: [Y/N]
conversation:${conversationId} broadcast added: [Y/N — approx line]
messageId included in payload: [Y/N]
deliveryStatus field name in payload: [exact field name used]
ThreadView listener verified: [Y/N — describe what it does with the event]
Manual test result: [describe what happened when SMS was sent]

### Task 2B — VirtualizedMessageList audit
Already virtualized — confirmed: [Y]
New virtualizer created: [N — must be N]
measureElement ref on row container: [present / missing — fixed]
Scroll-to-bottom method: [scrollToIndex / DOM scrollTop — fixed if DOM]
Load older trigger: [button / IntersectionObserver — left as-is / broken — describe]
Image load remeasure: [ResizeObserver via measureElement ref / missing — fixed]
Changes made: [describe each change or "none required"]

### Task 2C — Send row overflow
File changed: [must be ThreadView.tsx]
Composer.tsx touched: [N — must be N]
min-w-0 on outer container: [Y/N]
flex-1 min-w-0 on textarea wrapper: [Y/N]
shrink-0 on send button: [Y/N]
shrink-0 on icon buttons: [Y/N]
Send button visible at 375px: [Y/N — confirmed manually]

### Task 2D — z-index audit
Existing tokens found in tailwind.config.ts: [list them]
New tokens added: [none / list if any]
grep results — raw z-index matches found: [list files and classes]
Replacements made: [list each: file, old class, new class]
Left unchanged: [list each with reason]

### Unresolved issues
[Anything found but not fixable in scope — record here for the next Fixpack stage]
```
