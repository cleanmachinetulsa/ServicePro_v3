# Twilio SMS Fallback Webhook Configuration Guide

## Overview

This guide walks you through setting up Twilio SMS integration for the Clean Machine Auto Detail Communications Hub. The system provides intelligent SMS fallback functionality:

- **Primary Mode**: AI handles all incoming SMS messages via webhook
- **Fallback Mode**: If the app/webhook is down or times out (5 seconds), Twilio automatically forwards SMS to your personal phone
- **Manual Control**: Agents can take over conversations and send SMS directly via the Communications Hub

## Prerequisites

- Twilio account with an active phone number
- Replit deployment URL (e.g., `https://your-app.replit.app`)
- Personal phone number for SMS fallback

## Step 1: Get Your Twilio Credentials

1. **Log in to Twilio Console**: https://console.twilio.com
2. **Find your credentials** on the dashboard:
   - **Account SID**: Found under "Account Info"
   - **Auth Token**: Click "Show" to reveal (keep this secret!)
3. **Get your Twilio phone number**:
   - Go to Phone Numbers → Manage → Active Numbers
   - Click on your number to see it in E.164 format (e.g., +19185551234)

## Step 2: Add Credentials to Replit

1. **Open your Replit project**
2. **Navigate to Secrets** (Tools → Secrets, or the lock icon 🔒)
3. **Add the following secrets**:

| Secret Key | Value Example | Description |
|------------|---------------|-------------|
| `TWILIO_ACCOUNT_SID` | `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` | Your Twilio Account SID |
| `TWILIO_AUTH_TOKEN` | `your_auth_token_here` | Your Twilio Auth Token (keep secret!) |
| `TWILIO_PHONE_NUMBER` | `+19185551234` | Your Twilio phone number in E.164 format |
| `TWILIO_FALLBACK_PHONE` | `+19185556789` | Your personal phone for SMS fallback |

> **Important**: Phone numbers MUST be in E.164 format: `+[country code][number]` (e.g., `+19185551234`)

## Step 3: Configure Twilio Webhook (Primary Handler)

This webhook handles incoming SMS when your app is running.

1. **Go to Twilio Console** → Phone Numbers → Manage → Active Numbers
2. **Click on your Twilio phone number**
3. **Scroll to "Messaging Configuration"**
4. **Under "A MESSAGE COMES IN"**:
   - **Configure with**: Webhooks, TwiML Bins, Functions, Studio, or Proxy
   - **Webhook URL**: `https://your-app.replit.app/api/chat/sms`
     - Replace `your-app.replit.app` with your actual Replit deployment URL
   - **HTTP Method**: `POST`
5. **Click "Save"**

### Testing the Primary Webhook

Send a test SMS to your Twilio number:
- If working correctly: AI will respond within a few seconds
- Check the Communications Hub (`/messages`) to see the conversation
- Check backend logs for "Incoming SMS from +1918..." messages

## Step 4: Configure SMS Fallback (Timeout Handler)

This ensures SMS are forwarded to your personal phone if the app is down or slow.

1. **Still in the same "Messaging Configuration" section**
2. **Scroll down to "FALLBACK"**
3. **Under "MESSAGE STATUS CALLBACK URL"** (or similar fallback option):
   - **Primary Fallback**: You can use TwiML Bins for a simple forward

### Option A: TwiML Bin Fallback (Recommended for Simplicity)

1. **Create a TwiML Bin**:
   - Go to Twilio Console → Develop → TwiML Bins
   - Click "Create new TwiML Bin"
   - **Friendly Name**: "SMS Fallback Forward"
   - **TwiML Code**:
   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <Response>
       <Message to="+19185556789">
           New message from {{From}}: {{Body}}
       </Message>
   </Response>
   ```
   - Replace `+19185556789` with your personal phone number
   - Click "Create"

2. **Set the fallback URL**:
   - Go back to your phone number settings
   - Under "A MESSAGE COMES IN" → Click "Add fallback URL"
   - **Fallback URL**: Select your TwiML Bin from dropdown
   - **HTTP Method**: `POST`

### Option B: Webhook Fallback (Advanced)

If you want programmatic control:

1. **Fallback Webhook URL**: `https://your-app.replit.app/api/chat/sms/fallback`
2. **HTTP Method**: `POST`
3. The backend will:
   - Log the fallback event
   - Forward SMS to `TWILIO_FALLBACK_PHONE`
   - Create a conversation in the Communications Hub

## Step 5: Configure Timeout Settings

1. **Still in phone number settings**
2. **Under "A MESSAGE COMES IN"**:
   - Click "Show advanced settings" or look for timeout options
   - **Timeout**: Set to `5` seconds
   - **HTTP Method**: `POST`

This means Twilio will wait 5 seconds for your webhook to respond. If it times out, the fallback URL is triggered.

## Step 6: Test the Complete Setup

### Test 1: Normal Operation (App Running)

1. **Send an SMS to your Twilio number**: "Hi, I need a full detail"
2. **Expected behavior**:
   - AI responds within 1-2 seconds
   - Conversation appears in Communications Hub
   - Backend logs show incoming SMS processing
   - You receive AI's response on your phone

### Test 2: Manual Agent Takeover

1. **In Communications Hub** (`/messages`):
   - Click on a conversation
   - Click "Take Control" to switch to Manual mode
   - Type a message and click Send
2. **Expected behavior**:
   - Your message is sent via Twilio SMS
   - Customer receives it on their phone
   - Message appears in thread with purple bubble (agent message)
   - Backend logs show "Manual message sent via SMS to +1..."

### Test 3: SMS Fallback (App Down)

This is harder to test without actually shutting down your app, but here's how:

1. **Temporarily stop your Replit deployment**
2. **Send an SMS to your Twilio number**
3. **Expected behavior**:
   - After 5 seconds timeout, Twilio triggers fallback
   - You receive the SMS on your personal phone
   - Message format: "New message from +1918...: [customer message]"

## Webhook URLs Reference

| Webhook | URL | Purpose |
|---------|-----|---------|
| **Primary SMS Handler** | `/api/chat/sms` | Handles all incoming SMS (AI processing) |
| **Fallback Handler** | `/api/chat/sms/fallback` | Forwards SMS when primary times out |
| **Agent Send SMS** | `/api/conversations/:id/send-message` | Sends SMS from Communications Hub |

## Troubleshooting

### Issue: SMS not being received by app

**Check**:
1. Webhook URL is correct (`https://your-app.replit.app/api/chat/sms`)
2. Webhook is set to POST method
3. Twilio credentials in Replit Secrets are correct
4. App is running (check deployment status)
5. Check backend logs for errors

**Fix**:
- Verify webhook URL matches your deployment
- Restart your Replit app
- Test webhook with Twilio's "Send test webhook" feature

### Issue: 500 Error - "require is not defined"

**Solution**: ✅ **FIXED** - This was a CommonJS/ESM compatibility issue. The code now uses `import twilio from 'twilio'` instead of `require('twilio')`.

### Issue: "No customer phone number available for SMS delivery"

**Cause**: Conversation doesn't have a customer phone number stored.

**Fix**:
- SMS conversations automatically capture phone numbers from incoming messages
- For web-initiated conversations, ensure the customer provides their phone number
- Check the conversation record in the database

### Issue: SMS not forwarding to fallback phone

**Check**:
1. Fallback URL/TwiML Bin is configured correctly
2. Personal phone number is correct in TwiML or env var
3. Timeout is set (5 seconds recommended)
4. Test by stopping your app and sending SMS

**Fix**:
- Verify `TWILIO_FALLBACK_PHONE` environment variable
- Test TwiML Bin independently
- Check Twilio error logs in console

### Issue: Messages sending but not appearing in Communications Hub

**Check**:
1. PostgreSQL database is connected
2. WebSocket connection is active
3. Browser console for errors
4. Backend logs for message creation

**Fix**:
- Refresh the Communications Hub page
- Check database connection (DATABASE_URL secret)
- Verify WebSocket is connected (look for console logs)

## Security Best Practices

1. **Keep Auth Token Secret**: Never commit `TWILIO_AUTH_TOKEN` to git or share publicly
2. **Use HTTPS**: Always use `https://` for webhook URLs (Replit provides this automatically)
3. **Validate Webhooks**: The backend validates Twilio's signature (optional enhancement)
4. **Rate Limiting**: Consider adding rate limits to prevent SMS spam
5. **Rotate Credentials**: Periodically rotate your Twilio Auth Token

## Advanced: Webhook Signature Validation (Optional)

For additional security, verify that webhooks are actually from Twilio:

```typescript
import twilio from 'twilio';

const validateTwilioSignature = (req: Request): boolean => {
  const signature = req.headers['x-twilio-signature'] as string;
  const url = `https://${req.headers.host}${req.url}`;
  
  return twilio.validateRequest(
    process.env.TWILIO_AUTH_TOKEN!,
    signature,
    url,
    req.body
  );
};

// Use in your webhook handler:
if (!validateTwilioSignature(req)) {
  return res.status(403).json({ error: 'Invalid signature' });
}
```

## Support Resources

- **Twilio Documentation**: https://www.twilio.com/docs/sms
- **Twilio Console**: https://console.twilio.com
- **Twilio Support**: https://support.twilio.com
- **Clean Machine Support**: Contact your development team

## Summary Checklist

Before going live, verify:

- ✅ Twilio credentials added to Replit Secrets
- ✅ Primary webhook configured and tested (`/api/chat/sms`)
- ✅ Fallback URL/TwiML Bin configured
- ✅ Timeout set to 5 seconds
- ✅ Sent test SMS - AI responded successfully
- ✅ Tested manual agent takeover - SMS delivered
- ✅ Personal fallback phone number correct
- ✅ Communications Hub displays all conversations
- ✅ Messages persist to database

Once all items are checked, your SMS fallback system is ready for production! 🎉
