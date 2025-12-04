# Twilio Voice Webhook Setup - Automatic Missed Call Text Response

## What This Does

When someone calls your Twilio number:
1. They hear a greeting: "Thank you for calling Clean Machine Auto Detail"
2. The call tries to connect to your personal phone
3. **If you don't answer within 20 seconds:**
   - The caller gets sent to voicemail
   - **They automatically receive a text message** saying you'll call them back
   - You get notified about the missed call

This ensures customers always get an immediate response, even when you miss their call!

## Setup Instructions

### Step 1: Log into Twilio Console

1. Go to: https://console.twilio.com
2. Log in with your Twilio account

### Step 2: Find Your Phone Number Settings

1. Click **Phone Numbers** in the left sidebar
2. Click **Manage** → **Active Numbers**
3. Click on your Twilio phone number (the one customers call)

### Step 3: Configure Voice Webhook

Scroll down to the **Voice & Fax** section:

1. **A CALL COMES IN**:
   - Select: **Webhook**
   - **URL**: `https://your-app-url.replit.app/api/voice/voice`
     - Replace `your-app-url` with your actual Replit deployment URL
   - **HTTP Method**: `POST`

2. Click **Save** at the bottom

### Step 4: Set Your Business Phone Number

The system needs to know what phone number to forward calls to (your personal phone).

1. In Replit, go to **Tools** → **Secrets** (or click the lock icon 🔒)
2. Add this secret if you haven't already:

| Secret Key | Value | Example |
|------------|-------|---------|
| `BUSINESS_PHONE_NUMBER` | Your personal phone | `+19185551234` |

**Important**: Must be in E.164 format: `+[country code][number]`

3. Restart your app after adding the secret

### Step 5: Optional - Set Booking URL

To include your booking link in the automatic text message:

1. In Replit Secrets, add:

| Secret Key | Value | Example |
|------------|-------|---------|
| `BOOKING_URL` | Your booking page URL | `https://your-app.replit.app/quick-booking` |

2. This will be included in the missed call text: "You can also book online at [your URL]"

## How It Works

### When Someone Calls:

```
Customer calls → Twilio → Your App
    ↓
Greeting plays: "Thank you for calling Clean Machine..."
    ↓
Rings your personal phone for 20 seconds
    ↓
IF YOU ANSWER:
    ✅ Call connected - customer talks to you
    
IF YOU DON'T ANSWER (busy/no-answer):
    📱 Customer gets automatic text: "Hi! We're sorry we missed your call..."
    📞 Customer offered voicemail option
    📧 You get notified about the missed call
```

### The Automatic Text Message Says:

> "Hi, it's Jody with Clean Machine Auto Detail, sorry I missed you! How can I help you today?
> 
> Here are some of our most popular services. You can also see all of our available services, book online, read reviews and more by visiting cleanmachinetulsa.com
> 
> FULL DETAIL | $225-300
> Including Deep Interior Cleaning and Complete Exterior Wash & Wax, we aim make your vehicle look and feel like new!
> 
> •DEEP INTERIOR CLEANING | $150-250
> Includes upholstery & carpet shampoo, steam cleaning of all surfaces, windows, leather conditioning and more.
> 
> •COMPLETE EXTERIOR DETAIL | $150-175
> Including our Hand Wash & Wax PLUS 1-step Polish, removing light swirls and oxidation, restoring brilliant paint luster and shine!
> 
> •MINI DETAIL | $150-175
> Our routine service includes a premium Hand Wash & Wax PLUS a Basic Interior Cleaning; vacuum/wipedown/glass cleaning.
> 
> *Add-on services -
> •Leather / Upholstery protector | $50-60
> •Paint polishing | $75-100
> •Headlight Restoration | $25ea
> 
> May I answer any questions or get your vehicle scheduled?"

## Testing

### Test 1: Normal Call (You Answer)

1. Call your Twilio number from a different phone
2. You should hear the greeting
3. Your personal phone should ring
4. Answer it - call should connect successfully

### Test 2: Missed Call Auto-Response

1. Call your Twilio number from a different phone
2. **Don't answer your personal phone** - let it ring for 20+ seconds
3. The calling phone should receive an automatic text message
4. The caller will be offered voicemail

### Test 3: Voicemail

1. Call your Twilio number
2. Don't answer
3. Leave a voicemail message
4. You should receive a text with the voicemail transcription and recording link

## Troubleshooting

### Issue: Calls go straight to voicemail, phone doesn't ring

**Possible causes:**
- `BUSINESS_PHONE_NUMBER` secret not set
- Wrong phone number format

**Solution:**
1. Check Replit Secrets → verify `BUSINESS_PHONE_NUMBER` is set
2. Make sure it's in E.164 format: `+19185551234`
3. Restart your app

### Issue: No automatic text sent on missed calls

**Possible causes:**
- Twilio credentials not configured
- Voice webhook URL incorrect

**Solution:**
1. Verify these secrets in Replit:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_PHONE_NUMBER`
2. Check voice webhook URL matches your deployment
3. Check backend logs for errors

### Issue: Webhook returns error

**Check backend logs:**
```
grep "VOICE" /tmp/logs/*.log
```

Look for error messages like:
- `[VOICE] Incoming call from...` (successful)
- `[VOICE] Failed to send missed call SMS` (error)

## Environment Variables Checklist

Make sure these are all set in Replit Secrets:

- ✅ `TWILIO_ACCOUNT_SID` - Your Twilio Account SID
- ✅ `TWILIO_AUTH_TOKEN` - Your Twilio Auth Token
- ✅ `TWILIO_PHONE_NUMBER` - Your Twilio number (E.164 format)
- ✅ `BUSINESS_PHONE_NUMBER` - Your personal phone to forward calls to
- ⚠️ `BOOKING_URL` - Optional - Your booking page URL

## Webhook Endpoints Reference

| Endpoint | Purpose |
|----------|---------|
| `/api/voice/voice` | Main voice webhook - handles incoming calls |
| `/api/voice/call-status` | Triggered after call attempt (answered/missed) |
| `/api/voice/transcription` | Receives voicemail transcriptions |

## Advanced: Customize Messages

### Change the Greeting

Edit: `server/routes.voiceWebhook.ts`

Find this line:
```javascript
twiml.say({
  voice: 'alice',
  language: 'en-US'
}, 'Thank you for calling Clean Machine Auto Detail. Please hold while we connect you.');
```

Change the text to your custom greeting.

### Change the Missed Call Text

Edit: `server/routes.voiceWebhook.ts`

Find the `sendMissedCallSMS` function and update the `message` variable.

## Cost Information

**Twilio Charges:**
- Incoming call: ~$0.01/minute
- Outgoing SMS (auto-response): ~$0.0075/message
- Voicemail transcription: ~$0.05/transcription

Total cost per missed call: ~$0.06 (very affordable for great customer service!)

---

**Setup Complete!** Your customers will now get instant text responses when they can't reach you by phone. 📱✨
