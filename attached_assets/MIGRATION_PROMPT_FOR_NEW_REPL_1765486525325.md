# 🔄 MERGE MIGRATION: SMS Agent System (Preserve New Features)

## THE SCOPE
You're integrating **5 files from old Clean Machine Replit** into this workspace. These files control **BOTH SMS chat and web chat** behavior, but they have different modes. The migration is a **selective merge, NOT a blind file replacement**.

---

## 📍 WHERE THE SPLIT HAPPENS

All platform routing happens in **ONE file: `server/conversationHandler.ts`**

```typescript
// Lines 41-54: This is where SMS vs Web split occurs
if (platform === 'web') {
  return await processWebChatConversation(...);  // Web mode (restricted)
} else {
  return await processAuthenticatedConversation(...);  // SMS mode (full features)
}
```

**Your new schedule link display in web chat is likely in one of these functions.** That code stays. We're adding SMS logic alongside it.

---

## ✅ WHAT'S BEING MIGRATED

| File | Purpose | Handling |
|------|---------|----------|
| `openai.ts` | SMS full system prompt (lines 534-700) | **ADD to your existing file** - merge prompts |
| `conversationHandler.ts` | Platform router + web restricted prompt | **MERGE carefully** - preserve your web logic, add SMS functions |
| `gptPersonalizationService.ts` | Customer name/history lookup | **REPLACE** (shared by both platforms) |
| `campaignContextService.ts` | Campaign awareness | **REPLACE** (shared by both platforms) |
| `knowledge.ts` | Services/pricing knowledge base | **REPLACE** (shared by both platforms) |

---

## 🚨 CRITICAL: PRESERVE YOUR NEW FEATURES

**BEFORE you touch anything:**

1. **Identify your new web chat code**
   - Search your `conversationHandler.ts` for: schedule links, response formatting, any custom logic
   - Search your `openai.ts` for: any custom web-specific prompts you added
   - These sections stay exactly as-is

2. **How the merge works** (this is the key)
   - Old Clean Machine code has two separate AI prompts:
     - SMS prompt (lines 534-700 in openai.ts)
     - Web prompt (lines 94-120 in conversationHandler.ts)
   - Your code has:
     - Your custom web logic (in conversationHandler.ts)
     - Your custom schedule link display (probably in response formatting)
   - **The merge** = Keep your web logic, add SMS logic alongside it
     - Your web chat functions stay 100% untouched
     - SMS routing/functions are added as new code paths
     - They don't interfere because the router (`if platform === 'web'`) decides which code runs

3. **What gets replaced** (safe operations)
   - `gptPersonalizationService.ts` - Pure logic, no custom features
   - `campaignContextService.ts` - Pure logic, no custom features
   - `knowledge.ts` - Knowledge base, you'll update with your business info anyway

---

## 📋 MERGE INSTRUCTIONS (By File)

### File 1: `conversationHandler.ts` (MERGE - MOST CAREFUL)
```
1. Keep your existing `processWebChatConversation()` function exactly as-is
2. Keep your custom response formatting/schedule link display code
3. Add the new `processAuthenticatedConversation()` function (from old Clean Machine)
4. Keep the main `processConversation()` router at the top (it already routes by platform)
```
**Risk:** Low. The functions are separate code paths. Web stays web, SMS becomes new.

### File 2: `openai.ts` (MERGE - MODERATE)
```
1. Keep your existing code/prompts
2. Copy the old Clean Machine SMS prompt (lines 534-700) into a new export function
3. Name it something like: `generateSMSSystemPrompt()` so you can use it only for SMS
4. Don't replace your web prompt if you have one
```
**Risk:** Moderate. Make sure prompts don't conflict.

### Files 3-5: `gptPersonalizationService.ts`, `campaignContextService.ts`, `knowledge.ts` (REPLACE)
```
1. Back up your current versions (optional)
2. Replace entirely with old Clean Machine versions
3. Update business context (tenant_id, phone, domain, company name) in all 3
4. Update knowledge.ts with YOUR services/pricing
```
**Risk:** Very low. These are pure utility functions, no custom UI logic.

---

## 🧪 WILL IT CONFUSE THE SYSTEM?

**No, because:**
- The router (`if platform === 'web'`) is explicit and separate
- SMS and web functions don't interact
- Your new features are in the web-specific code path
- Bringing in SMS code doesn't touch your web path at all

**Analogy:** You're adding a separate SMS door to the building. Your existing web door keeps working exactly as before. They don't interfere.

---

## 📥 WHAT YOU'RE GETTING

1. `SMS_TEMPLATES_EXPORT.sql` - 8 SMS templates (import to database)
2. `SERVICEPRO_WIRING_INSTRUCTIONS.md` - Full setup guide
3. 5 source files from old Clean Machine

**Send the other agent these 3 files** to understand the full scope.

---

## 🎯 QUICK DECISION TREE

**"Should I keep my current code or use the old code?"**

| Component | Keep Yours? | Why |
|-----------|-----------|-----|
| Web chat response formatting | ✅ YES | It's your new feature |
| Schedule link display | ✅ YES | It's your new feature |
| Web-specific prompts/logic | ✅ YES | It's your new feature |
| SMS routing/logic | ❌ NO | Adding new SMS capability |
| Personalization (customer name lookup) | ❌ NO | Using old battle-tested version |
| Campaign context detection | ❌ NO | Using old battle-tested version |
| Knowledge base (services/pricing) | ❌ NO | You'll update it anyway |

---

## ⏱️ TIME ESTIMATE

- **Identify your new code:** 5 min
- **Merge `conversationHandler.ts`:** 10 min
- **Merge `openai.ts`:** 10 min
- **Replace 3 utility files:** 5 min
- **Update business context:** 5 min
- **Test SMS + web:** 15 min
- **Total: ~50 minutes**

---

## 🔗 FILES LAYOUT

Old Clean Machine → Your New Repl
```
openai.ts               → server/openai.ts
conversationHandler.ts  → server/conversationHandler.ts
gptPersonalizationService.ts → server/gptPersonalizationService.ts
campaignContextService.ts    → server/campaignContextService.ts
knowledge.ts            → server/knowledge.ts
SMS_TEMPLATES_EXPORT.sql → Run in your database
```

---

**Ready? Follow this merge approach and your new web chat features stay safe while SMS gets full power back.**
