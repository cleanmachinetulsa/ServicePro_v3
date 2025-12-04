# Twilio Voice Setup Guide

## Current System
- **918-856-5304**: Google Voice (your phone rings, but NO voicemail transcription)
- **918-856-5711**: Twilio number (available for AI voicemail system)

## The Problem
Google Voice voicemails cannot be accessed by the AI system (no API). You need calls to go through **Twilio** for voicemail transcription to work.

---

## Zero-Downtime Migration Plan

### Phase 1: Test with 918-856-5711 (Twilio)

1. **Configure Twilio Number in Console**
   - Go to: https://console.twilio.com/us1/develop/phone-numbers/manage/active
   - Click on **918-856-5711**
   - Under "Voice Configuration":
     - **A CALL COMES IN**: Webhook
     - **URL**: `https://your-replit-app.replit.app/api/voice/voice`
     - **HTTP**: POST
     - **STATUS CALLBACK URL**: `https://your-replit-app.replit.app/api/voice/call-status`
   - Click **Save**

2. **Test the Flow**
   - Call 918-856-5711 from your mobile
   - Let it go to voicemail
   - Leave a test message: "Hi, I need a full detail for my Honda Civic tomorrow"
   - Check: You should get an **AI-powered SMS** with appointment options

3. **Verify in System**
   - Check `/messages` page - voicemail should appear as conversation
   - Check call logs in database - transcription should be stored

---

### Phase 2: Migrate Main Number (918-856-5304)

**Choose ONE option:**

#### Option A: Port to Twilio (Recommended)
**Timeline**: 2-3 business days  
**Pros**: Clean setup, all features work, easier to manage  
**Cons**: Number offline during port (usually <1 hour)

**Steps:**
1. Unlock 918-856-5304 in Google Voice
2. Start port request in Twilio console
3. Provide account details to Twilio
4. Wait for port completion
5. Configure webhooks (same as Step 1 above)

#### Option B: Call Forwarding (Instant)
**Timeline**: 5 minutes  
**Pros**: Instant, no downtime  
**Cons**: Calls go GV→Twilio→Your Phone (extra hop)

**Steps:**
1. In Google Voice settings:
   - Forward 918-856-5304 → 918-856-5711 (Twilio)
2. In Twilio, configure 918-856-5711 to forward to your real phone
3. Test: Customer calls 918-856-5304 → GV forwards to Twilio → rings your phone → voicemail goes to Twilio ✅

---

## What Happens After Migration

### When a Customer Calls:
1. **Call rings your phone** (via Twilio forwarding)
2. **If you answer**: Call connects normally
3. **If you miss it**:
   - Twilio plays: "Sorry we missed your call. We've sent you a text. Leave a voicemail after the beep."
   - Customer leaves voicemail
   - Twilio **transcribes** the voicemail
   - AI reads transcription, responds with appointment options via SMS ✅
   - You get notified with transcription + recording link

### No Interruption To:
- Your phone ringing ✅
- SMS functionality ✅
- Customer experience ✅

---

## Environment Variables Needed

Add to your Replit Secrets:
```
TWILIO_ACCOUNT_SID=AC... (already set)
TWILIO_AUTH_TOKEN=... (already set)
TWILIO_PHONE_NUMBER=+19188565711 (or +19188565304 after port)
BUSINESS_PHONE_NUMBER=+1YOUR_REAL_PHONE (where calls forward to)
```

---

## Webhooks Already Built

✅ **Inbound Call Handler**: `/api/voice/voice`
- Plays greeting
- Forwards to your phone
- Offers voicemail if missed

✅ **Voicemail Transcription**: `/api/voice/transcription`
- Receives Twilio transcription
- Sends to GPT-4 for intelligent response
- Replies via SMS with booking options
- Logs to database

✅ **Call Status Tracker**: `/api/voice/call-status`
- Logs all calls to database
- Triggers missed call SMS

---

## Testing Checklist

- [ ] Configure 918-856-5711 webhooks in Twilio console
- [ ] Call 918-856-5711, verify your phone rings
- [ ] Let it go to voicemail, leave message
- [ ] Verify AI SMS response arrives
- [ ] Check `/messages` page shows voicemail transcription
- [ ] Review call logs in database
- [ ] **ONLY THEN** migrate 918-856-5304

---

## Support

If issues arise:
1. Check Twilio debugger: https://console.twilio.com/us1/monitor/debugger
2. Check Replit logs: Look for `[VOICE]` entries
3. Verify webhook URLs are publicly accessible
4. Ensure environment variables are set correctly
