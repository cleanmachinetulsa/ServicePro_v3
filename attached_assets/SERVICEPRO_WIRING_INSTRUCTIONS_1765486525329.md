# 🔌 SERVICEPRO WIRING INSTRUCTIONS
## Step-by-Step Setup Guide for New Workspace

---

## 📋 WHAT YOU'RE GETTING FROM CLEAN MACHINE

**5 Complete Source Files:**
1. `server/openai.ts` - Includes the full system prompt (NOT separate)
2. `server/gptPersonalizationService.ts` - Customer personalization
3. `server/campaignContextService.ts` - Campaign awareness
4. `server/conversationHandler.ts` - SMS/web routing
5. `server/knowledge.ts` - Service/pricing knowledge base

**SMS Template Data:**
8 pre-formatted SQL INSERT statements in `SMS_TEMPLATES_EXPORT.sql`

**That's everything. Nothing else needed.**

---

## ⚙️ STEP 1: COPY THE 5 FILES

Copy these files to the new SERVICEPRO workspace's `/server/` directory:
- `openai.ts`
- `gptPersonalizationService.ts`
- `campaignContextService.ts`
- `conversationHandler.ts`
- `knowledge.ts`

**No modifications yet. Just copy as-is.**

---

## 🔍 STEP 2: FIND & REPLACE (Update Business Context)

In **ALL 5 FILES**, replace these values from Clean Machine with YOUR values:

| Find | Replace With |
|------|--------------|
| `clean-machine` | YOUR_TENANT_ID |
| `918-856-5711` | YOUR_PHONE_NUMBER |
| `cleanmachinetulsa.com` | YOUR_DOMAIN |
| `Tulsa, OK` | YOUR_LOCATION |
| `Clean Machine Auto Detail` | YOUR_BUSINESS_NAME |
| `auto detailing` | YOUR_SERVICE_TYPE |
| `mobile auto detailing` | YOUR_SERVICE_DESCRIPTION |

**Critical:** Check `openai.ts` for service-specific requirements:
- **Lines 557-575:** "Power outlet" + "water spigot" requirements (auto detail specific)
- **If your service is different** (house cleaning, photography, etc.), update these to match

Example:
```
OLD: "power outlet within 100ft" + "water spigot for washing"
NEW (House Cleaning): "access to your home for setup" (remove water requirement)
NEW (Photography): "good natural lighting and location access" (remove both)
```

---

## 📊 STEP 3: UPDATE KNOWLEDGE BASE

In **`knowledge.ts`**, choose one approach:

### Option A: Use Google Sheets (Recommended - stays dynamic)
```typescript
const SHEETS_ID = "YOUR_NEW_SHEETS_ID";
```

### Option B: Hardcode your services (Simpler - no sheet dependency)
```typescript
export function extractKnowledgeBase(): string {
  return `
SERVICES & PRICING:
- Service 1: $XX - Description
- Service 2: $XX - Description
- Service 3: $XX - Description

ADD-ONS:
- Add-on 1: $XX
- Add-on 2: $XX
  `;
}
```

---

## 📥 STEP 4: IMPORT SMS TEMPLATES

1. Open `SMS_TEMPLATES_EXPORT.sql`
2. Find and replace:
   - `'servicepro-clean-machine'` → `'YOUR_ACTUAL_TENANT_ID'`
   - `'cleanmachinetulsa.com'` → `'YOUR_DOMAIN'`
3. Copy the entire SQL and run it in your SERVICEPRO database

Verify it worked:
```sql
SELECT template_key, name FROM sms_templates WHERE tenant_id = 'servicepro-clean-machine';
```
Should return 8 rows with these keys:
- `booking_confirmation`
- `appointment_reminder_24h`
- `appointment_reminder_1h`
- `on_site_arrival`
- `damage_assessment_request`
- `missed_call_auto_response`
- `specialty_quote_received`
- `payment_received`

---

## ✅ STEP 5: VERIFY & TEST

### Verify Files Compile
```bash
npx tsc --noEmit
```
Should have zero TypeScript errors.

### Send Test SMS
Send a message to your Twilio number from your phone.

### Verify Each Feature

**1. Personalized Greeting**
```
Expected: "Hi [Name]! Thanks for reaching out to [Your Business Name]!"
If fails: Check customers table has test data for your phone number
```

**2. Power Outlet Requirement (Before Booking)**
```
Expected: "We'll need access to a power outlet within 100ft..."
If fails: Check openai.ts lines 557-575 were updated
```

**3. Water Requirement (Exterior Services)**
```
Customer: "I want exterior detailing"
Expected: "We'll also need access to a water spigot..."
If fails: Check openai.ts lines 562-565 exist for your service
```

**4. Damage Keyword Detection**
```
Customer: "I have a scratch on my paint"
Expected: Requests photos - "Can you text me a photo of the scratch?"
If fails: Check damage keywords in openai.ts (lines 585-589)
```

**5. Specialty Job Routing**
```
Customer: "I have mold/tar/overspray"
Expected: Routes to quote workflow, NOT regular booking
If fails: Check specialty keywords in openai.ts (lines 613-615)
```

**6. Campaign Context**
```
Customer: "I got your message about bonus points"
Expected: Shows points balance, offers booking
If fails: Check campaignContextService.ts connection
```

**7. Escalation with Phone Number**
```
Try to trigger an error in conversation
Expected: "Please call us at [YOUR_PHONE] and we'll help"
If fails: Check phone number in openai.ts (line 685) - must be actual number, not placeholder
```

---

## 🛠️ TROUBLESHOOTING

| Problem | Solution |
|---------|----------|
| Empty responses from AI | Check `knowledge.ts` - Is Google Sheets working? Try hardcoding services instead |
| Old business name appears | Find & replace incomplete. Search all 5 files for "Clean Machine" and update |
| No personalization/greeting | Check `customers` table has data. Verify `gptPersonalizationService.ts` imports correctly |
| Campaign context not detected | Check `campaignContextService.ts` can connect to `campaign_grants` table |
| Booking workflow broken | Check `conversationHandler.ts` imports correctly |
| Wrong phone number in errors | Search all files for "918-856-5711" - replace EVERY occurrence |
| TypeScript compilation errors | Run `npm install`. Check import paths match new file locations |

---

## ✨ SUCCESS INDICATORS

SMS chat is working correctly when ALL of these pass:

1. ✅ **Personalization** - Greeting uses customer name if returning customer
2. ✅ **Service Requirements** - Power outlet explained BEFORE booking
3. ✅ **Water Requirement** - Water explained for exterior services (if applicable)
4. ✅ **Damage Detection** - Keywords ("scratch", "tear", "dent") trigger photo request
5. ✅ **Specialty Jobs** - Keywords ("mold", "asphalt", "paint overspray") route to quote
6. ✅ **Campaign Awareness** - Words ("points", "bonus", "welcome back") trigger campaign context
7. ✅ **Upsells** - Smart add-on suggestions show with exact names and prices
8. ✅ **Escalation** - Error messages include full phone number (not placeholder)
9. ✅ **Templates** - All 8 SMS templates send with correct formatting
10. ✅ **Booking** - Full 8-step workflow completes successfully

---

## ⏱️ TIME ESTIMATE

- **Copy files:** 5 min
- **Find & replace:** 10 min
- **Update knowledge base:** 5 min
- **Import templates:** 5 min
- **Test SMS:** 15 min
- **Troubleshoot (if needed):** 10 min
- **Total: ~45 minutes**

---

## 📞 COMMON ISSUES & SOLUTIONS

**Issue: "I'm getting empty responses"**
- Solution: Check if `knowledge.ts` can access Google Sheets. If not, hardcode your services.

**Issue: "SMS says 'Clean Machine' instead of my business"**
- Solution: You missed some find & replace instances. Search for "Clean Machine" in all files.

**Issue: "Booking doesn't start"**
- Solution: Check `conversationHandler.ts` is complete and imports `openai.ts` correctly.

**Issue: "Damage detection not working"**
- Solution: Check `openai.ts` lines 585-589 have your damage keywords (or the Clean Machine ones).

**Issue: "Customer can't call us from error message"**
- Solution: The phone number might be a placeholder. Update `918-856-5711` to your real number in `openai.ts` line 685.

---

## 🎯 NEXT STEPS AFTER SETUP

Once SMS is working:
1. Connect to your Twilio phone number
2. Test with real customer SMS
3. Set up appointment reminders
4. Configure campaign sends
5. Train team on SMS workflows

---

**READY? Start with Step 1: Copy the 5 files.**
