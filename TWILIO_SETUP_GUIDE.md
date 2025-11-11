# Twilio Fallback Webhook Configuration Guide

This guide will help you set up Twilio fallback webhooks to ensure SMS messages are forwarded to your personal phone when the main application is down or unreachable.

## What is a Fallback Webhook?

A fallback webhook is a backup URL that Twilio calls when your primary webhook fails or times out. This ensures customers can always reach you, even if your app experiences downtime.

## Prerequisites

Before you begin, you'll need:
1. A Twilio account with an active phone number
2. Your Twilio Account SID and Auth Token (already configured in your app)
3. Your Replit deployment URL
4. Your personal phone number (where messages should be forwarded)

## Step-by-Step Configuration

### Step 1: Find Your Fallback Webhook URL

Your fallback webhook endpoint is already built into the application at:

```
https://[your-replit-url]/sms-fallback
```

**Example:** If your Replit URL is `https://my-app.replit.dev`, your fallback URL would be:
```
https://my-app.replit.dev/sms-fallback
```

### Step 2: Log into Twilio Console

1. Go to https://console.twilio.com
2. Log in with your Twilio account credentials
3. You'll land on the Twilio Console Dashboard

### Step 3: Navigate to Phone Numbers

1. Click on the **Phone Numbers** icon in the left sidebar (looks like a phone)
2. Click **Manage** → **Active numbers**
3. You'll see a list of your Twilio phone numbers
4. Click on the phone number you want to configure (the one customers text)

### Step 4: Configure Primary Webhook

First, make sure your primary webhook is set correctly:

1. Scroll down to the **Messaging** section
2. Under **"A MESSAGE COMES IN"**:
   - **Webhook URL**: `https://[your-replit-url]/sms`
   - **HTTP Method**: `POST`
3. Keep this window open - we'll add the fallback next

### Step 5: Configure Fallback Webhook

In the same **Messaging** section:

1. Click the **"+ Add another webhook"** link (or similar option to add fallback)
2. Look for **"PRIMARY HANDLER FAILS"** or **"Fallback URL"** section
3. Configure the fallback:
   - **Fallback Webhook URL**: `https://[your-replit-url]/sms-fallback`
   - **HTTP Method**: `POST`
   - **Timeout**: `5000` milliseconds (5 seconds)

**Important:** The timeout means Twilio will wait 5 seconds for your primary webhook to respond before falling back to the backup URL.

### Step 6: Save Configuration

1. Scroll to the bottom of the page
2. Click the **Save** or **Save Configuration** button
3. You should see a success message confirming the changes

### Step 7: Test the Fallback System

**Test 1: Normal Operation (Primary Webhook)**
1. Send an SMS to your Twilio number: "Hello"
2. You should receive an AI response from the app
3. This confirms the primary webhook is working

**Test 2: Fallback When App is Down**
1. Stop your Replit application (stop the workflow)
2. Wait 10-15 seconds for it to fully shut down
3. Send an SMS to your Twilio number: "Test fallback"
4. After ~5 seconds, you should receive:
   - **Auto-reply to customer**: "We're experiencing technical difficulties. A team member will respond shortly."
   - **Forwarded SMS to your personal phone**: The customer's message

**Test 3: Restart and Verify**
1. Restart your Replit application
2. Send another test SMS
3. Should receive AI response again (primary webhook restored)

## How the Fallback Works

### When Primary Webhook is Working:
```
Customer → Twilio → /sms endpoint → AI Response → Customer
```

### When Primary Webhook Fails (timeout/error):
```
Customer → Twilio → /sms (fails after 5s) 
         → /sms-fallback → Forwards to your phone + Auto-reply to customer
```

## What Happens During Fallback?

1. **Customer receives**: Automatic reply explaining there are technical difficulties
2. **You receive**: The customer's original message forwarded to your personal phone
3. **You can**: Reply directly to the customer via SMS from your phone

## Troubleshooting

### Issue: Fallback isn't triggering

**Possible causes:**
- Timeout is set too high (should be 5000ms)
- Fallback URL is incorrect
- Primary webhook is responding slowly but not timing out

**Solution:**
- Verify timeout is set to 5000 milliseconds
- Double-check the fallback URL matches your Replit URL
- Test by completely stopping the app (not just making it slow)

### Issue: Messages aren't being forwarded

**Possible causes:**
- `BUSINESS_PHONE_NUMBER` environment variable not set
- Twilio credentials not configured correctly

**Solution:**
1. Check environment variables in Replit:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_PHONE_NUMBER` (your Twilio number)
   - `BUSINESS_PHONE_NUMBER` (your personal number to forward to)
2. Restart the application after updating environment variables

### Issue: Getting "Webhook returned invalid response"

**Possible causes:**
- Endpoint returning wrong format
- Network/connectivity issues

**Solution:**
- Check application logs for errors
- Verify the endpoint is accessible: Visit `https://[your-replit-url]/sms-fallback/health`
- Should return: `{"status":"ok","service":"sms-fallback"}`

## Health Check Endpoint

Your fallback webhook includes a health check endpoint:

```
GET https://[your-replit-url]/sms-fallback/health
```

**Expected response:**
```json
{
  "status": "ok",
  "service": "sms-fallback",
  "timestamp": "2025-10-31T18:30:00.000Z",
  "twilioConfigured": true
}
```

You can use this endpoint to monitor the fallback service health.

## Environment Variables Reference

Make sure these are set in your Replit Secrets:

| Variable | Description | Example |
|----------|-------------|---------|
| `TWILIO_ACCOUNT_SID` | Your Twilio Account SID | `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `TWILIO_AUTH_TOKEN` | Your Twilio Auth Token | `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `TWILIO_PHONE_NUMBER` | Your Twilio phone number | `+19185551234` |
| `BUSINESS_PHONE_NUMBER` | Your personal phone (forwards here) | `+19185555678` |

## Security Notes

- Never commit Twilio credentials to your code repository
- Always use Replit Secrets for sensitive values
- The fallback endpoint validates that requests come from Twilio
- Customer messages are forwarded but not stored in fallback mode

## Advanced: Custom Fallback Messages

To customize the auto-reply message sent to customers during fallback, edit the file:

**Location:** `server/routes.smsFallback.ts`

**Current message:**
```javascript
const autoReplyMessage = 'We\'re experiencing technical difficulties. A team member will respond shortly.';
```

**To customize:**
1. Edit the `autoReplyMessage` variable
2. Keep it brief (SMS limit is 160 characters)
3. Restart your application

## Support

If you continue experiencing issues:
1. Check Twilio debugger logs: https://console.twilio.com/monitor/debugger
2. Review application logs in Replit
3. Test the health endpoint
4. Verify all environment variables are set correctly

---

**Configuration Complete!** Your SMS fallback system is now ready to ensure 24/7 customer communication reliability.
