# QA Testing Guide: Payer-Approval Referral System

## Overview
This document provides comprehensive testing instructions for the payer-approval referral code system, which allows customers to apply referral codes during the payment approval process.

---

## System Architecture

### Flow Summary
```
1. Appointment created with payer authorization required
2. Payer receives SMS/email with approval link: /approve/:token
3. Payer verifies identity via OTP
4. Payer (optionally) applies referral code
5. System validates code and recalculates deposit
6. Payer approves → Payment link created with discounted amount
```

### Security Features
- ✅ OTP verification required before referral application
- ✅ Server-side price validation (client cannot manipulate amounts)
- ✅ One referral code per authorization (abuse prevention)
- ✅ CSRF protection via apiRequest
- ✅ Discount clamped to appointment total (prevents negative amounts)

---

## Test Scenarios

### Scenario 1: Successful Referral Application (10% Discount)

**Prerequisites:**
- Active referral code exists (e.g., TEST-12345)
- Referral configuration: 10% percent_discount for referee
- Appointment with $200 estimated price and 85% deposit ($170)

**Test Steps:**

1. **Navigate to payer-approval page**
   - URL: `/approve/{valid_token}`
   - Expected: Page loads successfully

2. **Verify initial state**
   - Verify "Estimated Total" shows **$200.00**
   - Verify "Deposit Required (85%)" shows **$170.00**
   - Verify referral code input is **DISABLED** (OTP not verified)

3. **Verify OTP**
   - Enter 6-digit OTP code
   - Click "Verify" button
   - Expected: Success message appears
   - Expected: Referral code input becomes **ENABLED**

4. **Apply referral code**
   - Enter code: **TEST-12345**
   - Click "Apply" button
   - Expected: Success message: "Referral code applied! You'll save $20.00"

5. **Verify discount applied**
   - Verify "Original Price" shows **$200.00** (crossed out or muted)
   - Verify "New Total" shows **$180.00** (green text)
   - Verify "Deposit Required (85%)" now shows **$153.00** (85% of $180)
   - Verify referral code input is **DISABLED** (cannot apply twice)
   - Verify apply button shows **"Applied"** state

6. **Database verification**
   ```sql
   SELECT 
     referral_code,
     referral_discount,
     deposit_amount,
     otp_verified
   FROM authorizations 
   WHERE token = '{test_token}';
   ```
   - Expected: `referral_code = "TEST-12345"`
   - Expected: `referral_discount = 20.00` (computed discount)
   - Expected: `deposit_amount = 153.00` (recalculated)
   - Expected: `otp_verified = true`

7. **Approve and verify payment**
   - Click "Approve" button
   - Expected: Redirect to payment link or success page
   - Query payment_links table:
     ```sql
     SELECT amount, status 
     FROM payment_links 
     WHERE appointment_id = {appointment_id};
     ```
   - Expected: `amount = 153.00` (discounted deposit)
   - Expected: `status = "pending"`

8. **Critical Verification: Amount Synchronization**
   - ✅ UI shows: **$153.00** deposit
   - ✅ Database stores: **$153.00** deposit
   - ✅ Payment link charges: **$153.00**
   - **ALL THREE MUST MATCH!**

---

### Scenario 2: Invalid Referral Code

**Test Steps:**
1. Complete OTP verification
2. Enter invalid code: **INVALID-CODE**
3. Click "Apply"
4. **Expected**: Error message: "Invalid referral code"
5. **Expected**: No discount applied, original prices remain

---

### Scenario 3: Expired Referral Code

**Prerequisites:**
- Referral code with `expires_at` in the past

**Test Steps:**
1. Complete OTP verification
2. Enter expired code
3. Click "Apply"
4. **Expected**: Error message: "This referral code has expired"
5. **Expected**: No discount applied

---

### Scenario 4: OTP Security Gate

**Test Steps:**
1. Navigate to payer-approval page
2. **Without verifying OTP**, attempt to apply referral code
3. **Expected**: Input field is **DISABLED**
4. **Expected**: Cannot enter or submit code
5. Verify OTP
6. **Expected**: Input field becomes **ENABLED**

---

### Scenario 5: Double-Discount Prevention

**Test Steps:**
1. Complete OTP verification
2. Apply valid referral code successfully
3. **Expected**: Input field becomes **DISABLED**
4. **Expected**: Apply button shows "Applied" (no longer clickable)
5. Attempt to modify input or apply again
6. **Expected**: No action possible (prevented by UI)

---

### Scenario 6: Percentage Discount Calculation

**Prerequisites:**
- Referral configuration: 15% percent_discount
- Appointment: $300 price, 50% deposit ($150)

**Test Steps:**
1. Apply referral code
2. **Expected**: Discount = **$45.00** (15% of $300)
3. **Expected**: New Total = **$255.00** ($300 - $45)
4. **Expected**: New Deposit = **$127.50** (50% of $255)
5. Verify database:
   - `referral_discount = 45.00`
   - `deposit_amount = 127.50`

---

### Scenario 7: Fixed Dollar Discount

**Prerequisites:**
- Referral configuration: $25 fixed_discount
- Appointment: $100 price, 100% deposit ($100)

**Test Steps:**
1. Apply referral code
2. **Expected**: Discount = **$25.00**
3. **Expected**: New Total = **$75.00**
4. **Expected**: New Deposit = **$75.00** (100% of $75)
5. Verify payment link charges **$75.00**

---

### Scenario 8: Discount Exceeds Total (Edge Case)

**Prerequisites:**
- Referral configuration: $50 fixed_discount
- Appointment: $30 price

**Test Steps:**
1. Apply referral code
2. **Expected**: Discount clamped to **$30.00** (total amount)
3. **Expected**: New Total = **$0.00** or minimum allowed
4. **Expected**: System handles gracefully (no negative amounts)

---

## Database Queries for Verification

### Check Authorization State
```sql
SELECT 
  id,
  token,
  otp_verified,
  otp_verified_at,
  referral_code,
  referral_discount,
  referral_discount_type,
  deposit_amount,
  approval_status
FROM authorizations 
WHERE token = '{test_token}';
```

### Check Payment Link Created
```sql
SELECT 
  pl.amount,
  pl.status,
  pl.url,
  a.estimated_price as original_price
FROM payment_links pl
JOIN appointments a ON pl.appointment_id = a.id
JOIN authorizations auth ON auth.appointment_id = a.id
WHERE auth.token = '{test_token}';
```

### Check Referral Code Validity
```sql
SELECT 
  referral_code,
  status,
  expires_at,
  referrer_id
FROM referrals 
WHERE referral_code = '{code}';
```

### Check Referral Configuration
```sql
SELECT 
  referee_reward_type,
  referee_reward_amount,
  enabled
FROM referral_program_config
LIMIT 1;
```

---

## API Endpoints Reference

### POST /api/payer-approval/:token/verify-otp
**Purpose**: Verify OTP and enable referral code input

**Request Body**:
```json
{
  "otp": "123456"
}
```

**Success Response**:
```json
{
  "success": true
}
```

**Side Effect**: Sets `authorization.otp_verified = true`

---

### POST /api/payer-approval/:token/apply-referral
**Purpose**: Validate and apply referral code

**Request Body**:
```json
{
  "referralCode": "TEST-12345"
}
```

**Success Response**:
```json
{
  "success": true,
  "isInformational": false,
  "message": "Referral code applied! You'll save $20.00",
  "rewardType": "percent_discount",
  "rewardValue": 10,
  "computedDiscount": 20.00,
  "discountedTotal": 180.00,
  "discountedDeposit": 153.00,
  "referrerName": "John Doe"
}
```

**Error Response** (Invalid Code):
```json
{
  "success": false,
  "message": "Invalid referral code"
}
```

**Error Response** (OTP Not Verified):
```json
{
  "error": "OTP verification required before applying referral code"
}
```

**Error Response** (Already Applied):
```json
{
  "error": "A referral code has already been applied to this authorization"
}
```

---

### POST /api/payer-approval/:token/approve
**Purpose**: Approve job and create payment link

**Side Effect**: Uses `authorization.depositAmount` (potentially discounted) for payment link creation

---

## Frontend Component Testing

### PayerReferralCodeInput Component
**Location**: `client/src/components/PayerReferralCodeInput.tsx`

**Props**:
- `token`: Authorization token
- `currentAmount`: Current total amount (for display)
- `onDiscountApplied`: Callback with (discountedTotal, discountedDeposit)

**Test Attributes**:
- `data-testid="input-payer-referral-code"`: Input field
- `data-testid="button-apply-payer-code"`: Apply button

**States to Verify**:
1. **Initial**: Input enabled, button shows "Apply"
2. **Pending**: Button shows "Applying..." with spinner
3. **Applied**: Input disabled, button shows "Applied" with checkmark
4. **Error**: Error message displays with X icon

---

## Known Limitations

### Out of Scope (Future Enhancements)
1. **No live validation**: Code validity checked only on submission
2. **No preview**: User doesn't see discount amount before applying
3. **No rate limiting**: Could be brute-forced (low risk on public page)
4. **No code suggestion**: User must know exact code

### Documented Constraints
- **Small business scale**: Optimized for low concurrency
- **Synchronous processing**: No async reward distribution
- **Manual QA required**: Automated E2E tests need payer authorization creation

---

## Troubleshooting Guide

### Issue: "Method is not a valid HTTP token"
**Cause**: API call arguments in wrong order  
**Fixed**: Updated to `apiRequest(method, url, data)` format  
**Status**: ✅ RESOLVED (as of Nov 15, 2025)

### Issue: Deposit amounts don't match UI
**Cause**: Frontend calculated deposit instead of using server value  
**Fixed**: UI now displays `discountedDeposit` from server  
**Status**: ✅ RESOLVED (as of Nov 15, 2025)

### Issue: Double-discount possible
**Cause**: No check for prior application  
**Fixed**: Backend checks `authorization.referralCode` existence  
**Status**: ✅ RESOLVED (as of Nov 15, 2025)

### Issue: Client can manipulate price
**Cause**: Backend trusted `estimatedPrice` from request body  
**Fixed**: Backend loads appointment from DB, ignores client input  
**Status**: ✅ RESOLVED (as of Nov 15, 2025)

---

## Production Readiness Checklist

- ✅ OTP verification enforced
- ✅ Server-side price validation
- ✅ Deposit synchronization (UI === DB === Payment)
- ✅ Abuse prevention (one code per authorization)
- ✅ CSRF protection
- ✅ Defensive safeguards (discount clamping)
- ✅ Complete audit trail (auditLog entries)
- ✅ Architect-approved implementation
- ⏳ Manual QA testing (this document)
- ⏳ Real-world appointment testing

---

## Next Steps for QA Team

1. **Create test data** using admin dashboard:
   - Generate test referral codes
   - Configure referee rewards (10% or $20 fixed)
   - Create appointment with payer authorization

2. **Execute all test scenarios** from this document

3. **Verify synchronization** of amounts across:
   - Browser UI display
   - Database authorizations table
   - Payment links table
   - Stripe payment intent (when integrated)

4. **Report any discrepancies** immediately

5. **Sign off** when all scenarios pass

---

**Document Version**: 1.0  
**Last Updated**: November 15, 2025  
**Status**: Production-Ready (pending QA sign-off)
