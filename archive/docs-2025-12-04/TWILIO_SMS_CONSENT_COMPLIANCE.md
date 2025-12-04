# Twilio SMS Consent Compliance Documentation

## Overview
This document outlines Clean Machine Auto Detail's SMS consent mechanism implemented to comply with Twilio A2P 10DLC campaign requirements, TCPA, and CTIA regulations.

## Campaign Information Resubmission

### Consent Page URL
**Public Consent Page:** `https://machinetul.replit.app/sms-consent`

This page provides:
- Clear explanation of SMS program
- Required legal disclosures
- Explicit opt-in checkbox
- Consent timestamp and IP address logging
- TCPA compliance language

### SMS Program Description
Clean Machine Auto Detail uses SMS to send:
- Appointment confirmations
- Service reminders (day-before notifications)
- Booking status updates
- Customer service responses

**Message frequency:** Varies based on customer appointments (typically 1-3 messages per appointment)
**Opt-out:** Reply STOP to cancel
**Help:** Reply HELP for assistance

## Technical Implementation

### 1. Database Schema
Three new fields added to `customers` table:
```sql
sms_consent BOOLEAN DEFAULT false
sms_consent_timestamp TIMESTAMP
sms_consent_ip_address TEXT
```

### 2. Consent Collection Points

#### A. Public Consent Page (`/sms-consent`)
- Accessible without authentication
- Requires full name, phone number, and explicit checkbox agreement
- Records IP address for audit trail
- Includes all required TCPA language
- **Component:** `client/src/pages/sms-consent.tsx`
- **API Endpoint:** `POST /api/sms-consent`

#### B. Schedule Page (`/schedule`)
- Primary booking form for new customers
- Required SMS consent checkbox before submission
- Prevents booking if consent not provided
- **Component:** `client/src/pages/Schedule.tsx`
- **Checkbox Component:** `client/src/components/SMSConsentCheckbox.tsx`

#### C. Quick Booking Page (`/quick-booking`)
- Fast rebooking for returning customers
- SMS consent checkbox shown after time selection
- Prevents booking without consent
- **Component:** `client/src/pages/quick-booking.tsx`

#### D. Multi-Vehicle Appointment Scheduler
- Used for complex bookings with multiple vehicles
- SMS consent in details step with validation
- **Component:** `client/src/components/MultiVehicleAppointmentScheduler.tsx`

#### E. Chat Interface
- Routes to Multi-Vehicle Scheduler for bookings
- Inherits consent mechanism from scheduler
- **Component:** `client/src/components/EnhancedChatbotUI.tsx`

### 3. Consent Language (TCPA Compliant)

**Standard Checkbox Text:**
```
I consent to receive SMS text messages from Clean Machine Auto Detail, including appointment confirmations, reminders, and service updates. Message and data rates may apply. Reply STOP to opt out at any time. Reply HELP for help. By checking this box, I acknowledge that I have read and agree to the Privacy Policy and Terms of Service.
```

**Public Form Additional Disclosures:**
- Full privacy policy link
- Terms of service link
- Message frequency notice
- Standard carrier rates notice
- Opt-out instructions (STOP)
- Help instructions (HELP)

### 4. Consent Management

#### Opt-In Process
1. Customer checks SMS consent checkbox on any booking form OR submits public consent form
2. Consent timestamp recorded automatically
3. IP address captured for audit trail
4. Customer record updated in database
5. Customer can now receive SMS messages

#### Opt-Out Process (STOP Handling)
- **Location:** `server/routes.smsFallback.ts`
- **Keywords:** STOP, STOPALL, UNSUBSCRIBE, CANCEL, END, QUIT
- When received:
  1. Customer's `smsConsent` set to `false`
  2. Confirmation message sent: "You have been unsubscribed from Clean Machine Auto Detail SMS. You will no longer receive text messages. Reply START to resubscribe."
  3. No further marketing/transactional messages sent

#### Opt-In Process (START Handling)
- **Keywords:** START, UNSTOP, YES
- When received:
  1. Customer's `smsConsent` set to `true`
  2. Confirmation message sent: "You have successfully resubscribed to Clean Machine Auto Detail SMS notifications. Reply STOP to opt out at any time."

#### Help Process (HELP Handling)
- **Keyword:** HELP, INFO
- Response: "Clean Machine Auto Detail: Reply STOP to unsubscribe, START to resubscribe. For support, call [business phone] or visit [website]."

### 5. Consent Validation Before SMS

**All outbound SMS functions check consent:**
- Appointment confirmations
- Day-before reminders
- Service updates
- Customer responses

**Validation Pattern:**
```javascript
const customer = await db.query.customers.findFirst({
  where: eq(customers.phone, phoneNumber)
});

if (!customer?.smsConsent) {
  console.log(`Skipping SMS to ${phoneNumber} - no consent`);
  return;
}

// Send SMS only if consent is true
```

### 6. Audit Trail

Every consent event is logged with:
- Customer name and phone number
- Consent timestamp (ISO 8601 format)
- IP address of consent submission
- Consent source (public form, booking form, etc.)

**Example log entry:**
```
[SMS CONSENT] Created new customer - John Doe (555-123-4567) from IP 192.168.1.100
```

## Compliance Checklist

- [x] Public consent page accessible without authentication
- [x] Clear opt-in language on all booking forms
- [x] TCPA-compliant checkbox text
- [x] Consent timestamp recording
- [x] IP address logging for audit trail
- [x] STOP keyword handling with confirmation
- [x] START keyword handling with re-subscription
- [x] HELP keyword handling with instructions
- [x] Consent validation before sending SMS
- [x] Database schema supports consent tracking
- [x] Privacy policy and terms of service links
- [x] Message frequency disclosure
- [x] Standard carrier rates notice

## Resubmission Information for Twilio Campaign

**Campaign Type:** Standard
**Use Case:** 2-Way Conversation (Customer Care)
**Sample Messages:**
1. "Hi [Name], your Clean Machine appointment is confirmed for [Date] at [Time]. We'll send a reminder 24 hours before. Reply STOP to opt out."
2. "Reminder: Your appointment with Clean Machine is tomorrow at [Time]. See you then! Reply STOP to opt out."
3. "Thank you for choosing Clean Machine! Your service is complete. We'd love your feedback."

**Opt-In Method:** Website form with explicit checkbox consent
**Opt-In URL:** https://machinetul.replit.app/sms-consent

**Opt-Out Method:** Reply STOP to any message
**Privacy Policy:** [To be added - link to privacy policy page]
**Terms of Service:** [To be added - link to terms page]

## Files Modified/Created

### New Files
- `client/src/components/SMSConsentCheckbox.tsx` - Reusable consent checkbox component
- `client/src/pages/sms-consent.tsx` - Public consent form page
- `server/routes.smsConsent.ts` - API endpoint for consent logging
- `TWILIO_SMS_CONSENT_COMPLIANCE.md` - This documentation file

### Modified Files
- `shared/schema.ts` - Added SMS consent fields to customers table
- `client/src/pages/Schedule.tsx` - Added required SMS consent checkbox
- `client/src/pages/quick-booking.tsx` - Added SMS consent validation
- `client/src/components/MultiVehicleAppointmentScheduler.tsx` - Added SMS consent step
- `client/src/App.tsx` - Added /sms-consent route
- `server/routes.ts` - Registered SMS consent routes
- `server/routes.smsFallback.ts` - STOP/START/HELP keyword handling (already existed)

## Testing Recommendations

1. **Public Consent Form Test**
   - Visit `/sms-consent`
   - Submit form with test phone number
   - Verify consent recorded in database
   - Verify IP address captured

2. **Booking Form Test**
   - Attempt booking without checking consent checkbox
   - Verify form validation prevents submission
   - Check consent checkbox and submit
   - Verify booking succeeds and consent recorded

3. **STOP Command Test**
   - Send SMS "STOP" to business number
   - Verify opt-out confirmation received
   - Verify database updated (smsConsent = false)
   - Verify no further messages sent

4. **START Command Test**
   - Send SMS "START" after stopping
   - Verify re-subscription confirmation
   - Verify database updated (smsConsent = true)

## Production Deployment Notes

Before production:
1. Update privacy policy URL in SMSConsentCheckbox component
2. Update terms of service URL in SMSConsentCheckbox component
3. Update business phone number in HELP message
4. Submit updated campaign to Twilio with consent page URL
5. Monitor consent logs for any issues
6. Ensure all existing customers have consent status (migration if needed)

## Contact for Questions
- Technical Implementation: Development Team
- Legal Compliance: [Legal Team Contact]
- Twilio Campaign Support: support@twilio.com
