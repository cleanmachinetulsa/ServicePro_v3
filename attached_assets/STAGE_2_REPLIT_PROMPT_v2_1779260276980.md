# SERVICEPRO — STAGE 2 DROP-IN PROMPT (v2) FOR REPLIT AGENT
## P1 Inbox Upgrade — Audit & Fix Existing Implementations
### Paste the GUARDRAILS PRE-PROMPT first, then this.
### Only run after Stage 1 completion report is reviewed and approved.

---

## CONTEXT — READ CAREFULLY BEFORE ANYTHING ELSE

This is an **audit-and-fix** prompt, not a build-from-scratch prompt. Several Stage 2 features are **already partially or fully implemented**. Your job is to find what is and isn't working and make targeted fixes. Do not rebuild anything that exists.

**Confirmed already done — do not rebuild:**
- `VirtualizedMessageList.tsx` exists and is imported into `ThreadView.tsx`. `@tanstack/react-virtual` (`^3.13.24`) is already installed.
- z-index token scale already defined in `tailwind.config.ts` (shell=30, page-header=40, modal=50, toast=60). `z-page-header` is already used in `messages.tsx`.
- Share Availability already inserts into the composer via `window.CustomEvent('composer:insert')` — fully wired in `messages.tsx` and `ThreadView.tsx`. This is not clipboard-only.
- The `sms_status_update` Socket.IO listener exists in `ThreadView.tsx` (~line 523).

**Confirmed open — these are the actual tasks:**
1. Delivery status real-time path is broken — broadcast goes to wrong room
2. Send row overflows at 375px — wrong file previously identified
3. VirtualizedMessageList needs an image-load resize audit
4. z-index tokens exist but some components still use raw values

---

## SEARCH BLOCK — READ THESE FILES BEFORE WRITING ANYTHING

```
client/src/components/ThreadView.tsx
  (search for: VirtualizedMessageList, sms_status_update, flex gap-2.5, items-end, handleSendMessage)
client/src/components/VirtualizedMessageList.tsx
  (read fully — understand measureElement usage and scroll behavior)
server/routes.twilioStatusCallback.ts
  (find the io.to('monitoring').emit('sms_status_update') broadcast)
server/websocketService.ts
  (find: broadcastNewMessage, join_conversation, 'monitoring' room — understand room architecture)
tailwind.config.ts
  (confirm existing zIndex tokens)
client/src/components/messages/NightOpsMessagesLayout.tsx
  (check for any raw z-40/z-50 values)
client/src/components/AppShell.tsx
  (check for any raw z-40/z-50 values)
```

---

## TASK 1 — Fix delivery status real-time updates (broken room broadcast)

**What the audit found:**

`routes.twilioStatusCallback.ts` broadcasts `sms_status_update` to the `'monitoring'` Socket.IO room:
```typescript
io.to('monitoring').emit('sms_status_update', { messageSid, status, to, from, ... });
```

`ThreadView.tsx` (~line 479) joins `conversation:${conversationId}` via `socket.emit('join_conversation', conversationId)`.  
`ThreadView.tsx` (~line 523) listens for `socket.on('sms_status_update', ...)`.

`websocketService.ts` shows that joining `'monitoring'` is a separate opt-in (`socket.on('join_monitoring')`). ThreadView does NOT join the monitoring room, so the `sms_status_update` listener in ThreadView **never fires**. The broadcast is going to a room the client isn't in.

`ThreadView`'s `sms_status_update` handler calls `queryClient.invalidateQueries` to refresh the conversation — this is the right approach.

**The fix — `server/routes.twilioStatusCallback.ts` only:**

After the existing `io.to('monitoring').emit(...)` call, add a second broadcast to the conversation room. You need to look up the `conversationId` from the phone number:

```typescript
// ALSO emit to the specific conversation room so ThreadView's sms_status_update listener fires.
// Look up the conversation by customer phone (To = customer for outbound SMS).
try {
  const { conversations } = await import('@shared/schema');
  const { eq, and } = await import('drizzle-orm');
  const conv = await req.tenantDb!
    .select({ id: conversations.id })
    .from(conversations)
    .where(
      req.tenantDb!.withTenantFilter(
        conversations,
        and(
          eq(conversations.customerPhone, To),
          eq(conversations.platform, 'sms'),
        ),
      ),
    )
    .limit(1);

  if (conv.length > 0) {
    io.to(`conversation:${conv[0].id}`).emit('sms_status_update', {
      messageSid: MessageSid,
      status: MessageStatus,
      conversationId: conv[0].id,
      timestamp: new Date().toISOString(),
    });
    console.log(`[TWILIO STATUS] Emitted sms_status_update to conversation:${conv[0].id}`);
  }
} catch (roomErr) {
  console.warn('[TWILIO STATUS] Could not emit to conversation room (fail-open):', roomErr);
}
```

**Why this works:** The `req.tenantDb!` is already tenant-scoped by the time the route handler runs (Twilio's `To` number resolves the tenant via middleware). The `ThreadView` guard at `if (typeof data.conversationId === 'number' && data.conversationId !== conversationId) return` now gets a real `conversationId` and filters correctly.

**Do not:**
- Change the existing monitoring broadcast
- Change `ThreadView.tsx` — the listener code there is already correct
- Change `websocketService.ts`

---

## TASK 2 — Audit VirtualizedMessageList for known edge cases

**File:** `client/src/components/VirtualizedMessageList.tsx`

This component is already built. Read it fully. Then audit and fix these specific issues if they are not already handled:

**2a — Image load remeasure:**  
Find where `MessageBubble` is rendered inside the virtualizer. Images inside messages load asynchronously after the row mounts, making the row height initially wrong. If `measureElement` is not called after images load, the virtualizer renders rows at incorrect positions.

Check: is there an `onLoad` handler on images inside the virtual rows, or is `measureElement` called via a `ResizeObserver`?

- If `measureElement` is passed as a `ref` to the row container element, the browser's `ResizeObserver` used by `@tanstack/react-virtual` will auto-detect height changes when images load. This is the correct approach and may already be implemented.
- If not, add: attach `ref={rowVirtualizer.measureElement}` to the row container `<div>` and verify images inside `MessageBubble` trigger the ResizeObserver naturally.

Report what you find. Only change code if the image load case is not handled.

**2b — Scroll-to-bottom after new message:**  
Find the scroll-to-bottom logic. Confirm it calls `rowVirtualizer.scrollToIndex(messages.length - 1, { align: 'end', behavior: 'smooth' })` or equivalent when a new message arrives. If it uses a DOM `scrollTop` approach that bypasses the virtualizer, it may not work correctly for unmounted rows. Fix if broken.

**2c — Load-older-messages trigger:**  
Find whether the IntersectionObserver for loading older messages is attached to the first virtual item. If it's attached to a static DOM node that scrolls out of the virtualized area, it may never fire for long threads. Report what you find.

Report findings before making changes. Only change what is provably broken.

---

## TASK 3 — Fix send row overflow at 375px

**File:** `client/src/components/ThreadView.tsx`

**What the audit found:** The main send row is in `ThreadView.tsx`. The `Composer.tsx` file in `client/src/components/messages/` is the new-conversation dialog — do not touch it.

Find the send row container. It is approximately:
```tsx
<div className="flex gap-2.5 max-w-4xl mx-auto items-end">
  {/* attachment button */}
  {/* textarea */}
  {/* emoji picker */}
  {/* channel selector */}
  {/* send button */}
</div>
```

At 375px, this row can push the send button off-screen if the textarea is wide and the action icons don't shrink.

**The fix — surgical and minimal:**

1. Add `min-w-0` to the outer container so flex doesn't overflow its parent:
   ```tsx
   <div className="flex gap-2.5 max-w-4xl mx-auto items-end min-w-0">
   ```

2. Add `flex-shrink-0` to the attachment button, emoji button, and send button so they never compress.

3. Add `min-w-0 flex-1` to the `<Textarea>` wrapper div (the div that contains the textarea and the char count) so the textarea takes available space and shrinks when needed.

4. The send button and channel selector at the end of the row: verify they have `flex-shrink-0` so they are always fully visible.

**Do not:** Restructure the layout, change the visual design, or add a scrolling container. These are minimum-change class additions only.

---

## TASK 4 — Audit and fix raw z-index values

**What the audit found:** z-index tokens are already defined in `tailwind.config.ts`. `messages.tsx` already uses `z-page-header`. But other files may still use raw values like `z-40` or `z-50` that should use tokens.

**The fix:**

1. Run this search and report results:
   ```bash
   grep -rn "z-\[" client/src/
   grep -rn " z-30\| z-40\| z-50\| z-60\| z-70" client/src/components/messages/ client/src/components/AppShell.tsx
   ```

2. For each match:
   - If it's in `NightOpsMessagesLayout.tsx`: replace `z-40` → `z-page-header`
   - If it's in `AppShell.tsx`: replace `z-30` → `z-shell` (if it's the sidebar/nav layer)
   - If it's a modal or dialog: replace with `z-modal`
   - If it's a toast: replace with `z-toast`
   - If you're unsure what layer something belongs to, report it in the completion summary rather than guessing

3. Do not touch z-index on components in `client/src/components/ui/` (shadcn primitives) — those are managed separately.

---

## TESTS REQUIRED

```bash
npx vitest run server/tests/tenantCommRouter.test.ts
npx vitest run server/tests/smsSendGuard.test.ts
# Manual dev-server check:
# 1. Send an SMS from a test number → check the message bubble updates to 'delivered' without page refresh
# 2. Open a thread with 50+ messages → scroll smoothly, no hitch
# 3. Verify send button visible at 375px browser width without scrolling
```

---

## COMPLETION SUMMARY REQUIRED

```
## STAGE 2 COMPLETION REPORT

### Task 1 — Delivery status broadcast fix
File changed:
Lookup query added: [Y/N]
Room emit target: [conversation:${conversationId}]
conversationId included in payload: [Y/N]
Existing monitoring broadcast preserved: [Y/N]
Fail-open on lookup error: [Y/N]

### Task 2 — VirtualizedMessageList audit
2a image load: [existing measureElement ref approach / ResizeObserver detected / fix applied / already correct]
2b scroll-to-bottom: [method used / broken or correct]
2c load-older-messages: [IntersectionObserver target description / broken or correct]
Changes made (if any):

### Task 3 — Send row overflow
Container min-w-0 added: [Y/N]
flex-shrink-0 on send button: [Y/N]
flex-1 min-w-0 on textarea wrapper: [Y/N]
Send button visible at 375px: [Y/N confirmed]

### Task 4 — z-index token audit
grep results summary:
Files where raw z-values were replaced:
Files where raw z-values were left (and why):

### Unresolved issues
[Anything found but not fixable in scope — record here for Stage 3]
```
