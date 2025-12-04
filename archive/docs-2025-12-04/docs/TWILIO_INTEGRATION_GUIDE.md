# ServicePro Twilio Integration Setup Guide

## Overview

This guide covers the complete setup for Twilio Voice and SMS integration with ServicePro. Follow each section in order to ensure everything works correctly.

---

## Part 1: Required Environment Variables

### Critical Secrets (Must be in Replit Secrets)

| Secret Name | Description | Where to Get It |
|-------------|-------------|-----------------|
| `TWILIO_ACCOUNT_SID` | Your Twilio Account SID | Twilio Console > Dashboard |
| `TWILIO_AUTH_TOKEN` | Your Twilio Auth Token | Twilio Console > Dashboard |
| `MAIN_PHONE_NUMBER` | Clean Machine main business line | Your Twilio number (E.164 format: +19185551234) |
| `TWILIO_TEST_SMS_NUMBER` | Test SMS number for dev | A Twilio number for testing |
| `TWILIO_MESSAGING_SERVICE_SID` | Messaging Service SID | Twilio Console > Messaging Services |
| `BUSINESS_OWNER_PERSONAL_PHONE` | Owner's personal cell | E.164 format |
| `VIP_PHONE_NUMBER` | VIP escalation number | E.164 format |

### Environment Variables (Shared)

Currently set:
- `TWILIO_VOICE_FROM_NUMBER` = +19188565304

### Push Notification Keys

Already configured:
- `VAPID_PUBLIC_KEY` ✓
- `VAPID_PRIVATE_KEY` ✓  
- `VAPID_SUBJECT` ✓

---

## Part 2: Twilio Console Configuration

### Step 1: Phone Number Webhook Configuration

1. Go to: **Twilio Console** > **Phone Numbers** > **Manage** > **Active Numbers**
2. Click on your Clean Machine business number (e.g., +19188565304)
3. Configure **Voice Configuration**:

| Setting | Value |
|---------|-------|
| **Configure With** | Webhooks |
| **A Call Comes In** | Webhook |
| **URL** | `https://YOUR-REPLIT-DOMAIN/twilio/voice/incoming` |
| **HTTP Method** | HTTP POST |
| **Primary Handler Fails** | (leave blank or set fallback) |
| **Call Status Changes** | `https://YOUR-REPLIT-DOMAIN/twilio/voice/call-status` |

4. Configure **Messaging Configuration**:

| Setting | Value |
|---------|-------|
| **Configure With** | Messaging Service |
| **Messaging Service** | Select your ServicePro Messaging Service |

**OR** if using webhooks directly:

| Setting | Value |
|---------|-------|
| **A Message Comes In** | `https://YOUR-REPLIT-DOMAIN/api/twilio/sms/inbound` |
| **HTTP Method** | HTTP POST |

### Step 2: Get Your Replit Domain

Your public URL is one of these (check `REPLIT_DOMAINS` secret):
- Production: `https://your-app.replit.app`
- Development: Check the webview URL in Replit

**Important:** Replace `YOUR-REPLIT-DOMAIN` in all URLs with your actual domain.

---

## Part 3: Complete Webhook URL Reference

### Voice Webhooks (Primary)

| Endpoint | Purpose | When to Use |
|----------|---------|-------------|
| `/twilio/voice/incoming` | Main inbound call handler | Set as "A Call Comes In" |
| `/twilio/voice/ivr-selection` | IVR menu selection handler | Called by IVR internally |
| `/twilio/voice/voicemail-complete` | Recording complete callback | Called after voicemail |
| `/twilio/voice/recording-status` | Recording status updates | Called during voicemail |
| `/twilio/voice/voicemail-transcribed` | Transcription callback | Called when transcription ready |
| `/twilio/voice/voice-dial-status` | Dial leg status | Called when dial completes |
| `/twilio/voice/call-status` | Overall call status | Set as "Call Status Changes" |

### SMS Webhooks

| Endpoint | Purpose | When to Use |
|----------|---------|-------------|
| `/api/twilio/sms/inbound` | Inbound SMS handler | Set as "A Message Comes In" |
| `/api/twilio/sms/status` | SMS delivery status | Set as Status Callback |

### Legacy Voice Webhooks (Alternate)

| Endpoint | Purpose |
|----------|---------|
| `/api/voice/voice` | Legacy inbound voice |
| `/api/voice/voice-dial-status` | Legacy dial status |
| `/api/voice/call-status` | Legacy call status |

---

## Part 4: SIP Configuration (Groundwire/Softphone)

### Twilio SIP Domain Setup

1. Go to: **Twilio Console** > **Voice** > **SIP Domains**
2. Create or verify domain: `cleanmachinetulsa.sip.twilio.com`
3. Configure Authentication:
   - **Username**: `jody`
   - **Password**: Your SIP password (stored encrypted in database)

### Softphone Settings (Groundwire/Zoiper)

| Setting | Value |
|---------|-------|
| **SIP Server** | `cleanmachinetulsa.sip.twilio.com` |
| **Username** | `jody` |
| **Password** | Your SIP password |
| **Transport** | TLS (recommended) or UDP |
| **Port** | 5061 (TLS) or 5060 (UDP) |

### How SIP Routing Works

When a caller presses 2 on the IVR:
1. System builds SIP URI: `sip:jody@cleanmachinetulsa.sip.twilio.com`
2. Twilio dials the SIP endpoint
3. Your softphone rings
4. If no answer → voicemail prompt plays

---

## Part 5: Messaging Service Setup

### Create Messaging Service

1. Go to: **Twilio Console** > **Messaging** > **Services**
2. Click **Create Messaging Service**
3. Configure:
   - **Friendly Name**: `ServicePro Notifications`
   - **Use Case**: Mixed (or select appropriate)
4. Add your phone number(s) to the sender pool
5. Configure webhook:
   - **Request URL**: `https://YOUR-REPLIT-DOMAIN/api/twilio/sms/inbound`
   - **Fallback URL**: (optional)
   - **Status Callback**: `https://YOUR-REPLIT-DOMAIN/api/twilio/sms/status`

### Get the Messaging Service SID

After creating, copy the **Messaging Service SID** (starts with `MG...`) and add it to Replit secrets as `TWILIO_MESSAGING_SERVICE_SID`.

---

## Part 6: Verification Checklist

### Required Secrets Check

Run this in Replit Shell to verify:
```bash
echo "Checking required secrets..."
[ -n "$TWILIO_ACCOUNT_SID" ] && echo "✓ TWILIO_ACCOUNT_SID" || echo "✗ TWILIO_ACCOUNT_SID missing"
[ -n "$TWILIO_AUTH_TOKEN" ] && echo "✓ TWILIO_AUTH_TOKEN" || echo "✗ TWILIO_AUTH_TOKEN missing"
[ -n "$MAIN_PHONE_NUMBER" ] && echo "✓ MAIN_PHONE_NUMBER" || echo "✗ MAIN_PHONE_NUMBER missing"
[ -n "$TWILIO_MESSAGING_SERVICE_SID" ] && echo "✓ TWILIO_MESSAGING_SERVICE_SID" || echo "✗ TWILIO_MESSAGING_SERVICE_SID missing"
```

### Webhook URL Verification

Your primary webhook URLs should be:
1. **Voice Incoming**: `https://YOUR-DOMAIN/twilio/voice/incoming`
2. **SMS Incoming**: `https://YOUR-DOMAIN/api/twilio/sms/inbound`

---

## Part 7: Testing the Integration

### Test 1: Inbound Voice Call

1. Call your Clean Machine number from another phone
2. You should hear the IVR greeting
3. Press 2 to talk to a person
4. Your softphone should ring
5. Don't answer → voicemail prompt should play
6. Leave a message → you should receive a push notification
7. Check Messages in app → voicemail should appear with audio player

### Test 2: Missed Call Notification

1. Call your number, let it ring (don't answer on softphone)
2. Hang up before voicemail
3. You should receive a "Missed Call" push notification

### Test 3: Inbound SMS

1. Send an SMS to your Clean Machine number
2. Check the Messages section in the app
3. Message should appear in the customer's conversation

### Test 4: Outbound SMS

1. In the app, open a customer conversation
2. Send a reply message
3. Customer should receive the SMS

---

## Troubleshooting

### "Twilio client not initialized"
- Missing `TWILIO_ACCOUNT_SID` or `TWILIO_AUTH_TOKEN`
- Add these to Replit Secrets

### No push notifications
- Check that VAPID keys are configured
- Ensure browser notifications are allowed
- Check browser console for errors

### Calls not reaching softphone
- Verify SIP domain is correct
- Check SIP credentials match Twilio credential list
- Ensure softphone is registered and online

### Voicemails not appearing
- Check `/twilio/voice/recording-status` webhook is receiving callbacks
- Look for errors in server logs
- Verify database has voicemail records

### SMS not working
- Verify Messaging Service SID is set
- Check phone number is in Messaging Service sender pool
- Verify webhook URL is correct in Twilio Console

---

## Quick Reference: Environment Variables

```env
# Required Twilio Credentials
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token

# Phone Numbers
MAIN_PHONE_NUMBER=+19188565304
TWILIO_TEST_SMS_NUMBER=+19189183265
BUSINESS_OWNER_PERSONAL_PHONE=+1xxxxxxxxxx
VIP_PHONE_NUMBER=+1xxxxxxxxxx

# Messaging Service
TWILIO_MESSAGING_SERVICE_SID=MGxxxxxxxxxxxxx

# Push Notifications
VAPID_PUBLIC_KEY=your_public_key
VAPID_PRIVATE_KEY=your_private_key
VAPID_SUBJECT=mailto:admin@cleanmachinetulsa.com
```

---

## Current Status

Based on current configuration:

**Configured:**
- ✓ TWILIO_ACCOUNT_SID
- ✓ TWILIO_VOICE_FROM_NUMBER
- ✓ VAPID keys for push notifications
- ✓ Database with tenant phone config

**May Need Setup:**
- ⚠ TWILIO_AUTH_TOKEN - verify in secrets
- ⚠ TWILIO_MESSAGING_SERVICE_SID - verify in secrets
- ⚠ Twilio Console webhook URLs - must match your Replit domain
- ⚠ SIP domain credential list in Twilio Console
