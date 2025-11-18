import { Router } from 'express';
import { db } from './db';
import { eq } from 'drizzle-orm';
import { quoteRequests } from '@shared/schema';
import { sendSMS } from './notifications';

// Simple in-memory OTP store (for MVP - consider using Redis in production)
const otpStore = new Map<string, { code: string; expiresAt: number; verified: boolean }>();

// Generate a 6-digit OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Store OTP with phone number as key
function storeOTP(phone: string, code: string): void {
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
  otpStore.set(phone, { code, expiresAt, verified: false });
}

// Verify OTP and mark as verified (doesn't delete - allows approve/decline to verify again)
function verifyOTP(phone: string, code: string): boolean {
  const stored = otpStore.get(phone);
  if (!stored) return false;
  
  if (Date.now() > stored.expiresAt) {
    otpStore.delete(phone);
    return false;
  }
  
  if (stored.code !== code) return false;
  
  // Mark as verified but keep in store for approve/decline
  stored.verified = true;
  return true;
}

// Consume OTP after successful approve/decline (deletes to prevent reuse)
function consumeOTP(phone: string, code: string): boolean {
  const stored = otpStore.get(phone);
  if (!stored) return false;
  
  if (Date.now() > stored.expiresAt) {
    otpStore.delete(phone);
    return false;
  }
  
  if (stored.code !== code || !stored.verified) return false;
  
  // OTP is valid and verified, delete it to prevent reuse
  otpStore.delete(phone);
  return true;
}

const router = Router();

/**
 * GET /api/quote-approval/booking-data/:token
 * Retrieve booking data from quote approval token
 * Allows customers to proceed to booking after approving a quote
 */
router.get('/booking-data/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    // Retrieve from global store
    const bookingTokenStore = (global as any).bookingTokenStore || new Map();
    const bookingData = bookingTokenStore.get(token);
    
    if (!bookingData) {
      return res.status(404).json({
        error: 'Booking token not found or expired'
      });
    }
    
    // Check expiration
    if (Date.now() > bookingData.expiresAt) {
      bookingTokenStore.delete(token);
      return res.status(410).json({
        error: 'Booking token has expired. Please contact us to schedule.'
      });
    }
    
    res.json({
      success: true,
      data: {
        quoteId: bookingData.quoteId,
        customerName: bookingData.customerName,
        phone: bookingData.phone,
        email: bookingData.email,
        damageType: bookingData.damageType,
        customQuoteAmount: bookingData.customQuoteAmount,
        issueDescription: bookingData.issueDescription,
      }
    });
  } catch (error) {
    console.error('[QUOTE APPROVAL] Error retrieving booking data:', error);
    res.status(500).json({
      error: 'Failed to retrieve booking data'
    });
  }
});

/**
 * GET /api/quote-approval/:token
 * Fetch quote data for approval page (public, no auth required)
 */
router.get('/:token', async (req, res) => {
  try {
    const { token } = req.params;

    // Find quote by approval token
    const [quote] = await db
      .select()
      .from(quoteRequests)
      .where(eq(quoteRequests.approvalToken, token))
      .limit(1);

    if (!quote) {
      return res.status(404).json({
        error: 'Quote not found or link has expired'
      });
    }

    // Check if quote is in 'quoted' status (ready for approval)
    if (quote.status !== 'quoted') {
      // Allow viewing if already approved/declined
      if (quote.status !== 'approved' && quote.status !== 'declined') {
        return res.status(400).json({
          error: 'This quote is not ready for approval yet'
        });
      }
    }

    // Send OTP for verification (only if status is 'quoted')
    if (quote.status === 'quoted') {
      const otpCode = generateOTP();
      
      // Send OTP to appropriate phone number
      const phoneToVerify = quote.thirdPartyPayerPhone || quote.phone;
      storeOTP(phoneToVerify, otpCode);
      
      await sendSMS(
        phoneToVerify,
        `Your quote approval code is: ${otpCode}\n\nThis code expires in 10 minutes.`
      );

      console.log(`[QUOTE APPROVAL] OTP ${otpCode} sent to ${phoneToVerify} for quote ${quote.id}`);
    }

    // Determine approver type
    const approverType = quote.thirdPartyPayerName ? 'third_party' : 'customer';

    // Return quote data
    res.json({
      quote: {
        id: quote.id,
        customerName: quote.customerName,
        phone: quote.phone,
        issueDescription: quote.issueDescription,
        damageType: quote.damageType,
        photoUrls: quote.photoUrls || [],
        customQuoteAmount: quote.customQuoteAmount,
        quoteNotes: quote.quoteNotes,
        status: quote.status,
        thirdPartyPayerName: quote.thirdPartyPayerName,
        thirdPartyPayerEmail: quote.thirdPartyPayerEmail,
        thirdPartyPayerPhone: quote.thirdPartyPayerPhone,
        poNumber: quote.poNumber,
        createdAt: quote.createdAt,
      },
      approverType,
      businessName: 'Clean Machine Auto Detail',
      businessPhone: process.env.TWILIO_PHONE_NUMBER || '(918) 555-0100',
    });
  } catch (error) {
    console.error('[QUOTE APPROVAL] Error fetching quote:', error);
    res.status(500).json({
      error: 'Failed to load quote data'
    });
  }
});

/**
 * POST /api/quote-approval/:token/verify-otp
 * Verify OTP code
 */
router.post('/:token/verify-otp', async (req, res) => {
  try {
    const { token } = req.params;
    const { otp } = req.body;

    if (!otp) {
      return res.status(400).json({
        error: 'OTP code is required'
      });
    }

    // Find quote
    const [quote] = await db
      .select()
      .from(quoteRequests)
      .where(eq(quoteRequests.approvalToken, token))
      .limit(1);

    if (!quote) {
      return res.status(404).json({
        error: 'Quote not found'
      });
    }

    // Get phone number to verify against
    const phoneToVerify = quote.thirdPartyPayerPhone || quote.phone;

    // Verify OTP
    const isValid = verifyOTP(phoneToVerify, otp);

    if (!isValid) {
      return res.status(400).json({
        error: 'Invalid or expired OTP code'
      });
    }

    res.json({
      success: true,
      message: 'OTP verified successfully'
    });
  } catch (error) {
    console.error('[QUOTE APPROVAL] Error verifying OTP:', error);
    res.status(500).json({
      error: 'Failed to verify OTP'
    });
  }
});

/**
 * POST /api/quote-approval/:token/approve
 * Approve the quote (requires OTP verification)
 */
router.post('/:token/approve', async (req, res) => {
  try {
    const { token } = req.params;
    const { otp, ipAddress, userAgent } = req.body;

    if (!otp) {
      return res.status(400).json({
        error: 'OTP verification is required to approve'
      });
    }

    // Find quote
    const [quote] = await db
      .select()
      .from(quoteRequests)
      .where(eq(quoteRequests.approvalToken, token))
      .limit(1);

    if (!quote) {
      return res.status(404).json({
        error: 'Quote not found'
      });
    }

    if (quote.status !== 'quoted') {
      return res.status(400).json({
        error: 'This quote cannot be approved at this time'
      });
    }

    // Consume OTP before approving (verifies and deletes to prevent reuse)
    const phoneToVerify = quote.thirdPartyPayerPhone || quote.phone;
    const isOtpValid = consumeOTP(phoneToVerify, otp);
    
    if (!isOtpValid) {
      return res.status(400).json({
        error: 'Invalid or expired OTP. Please verify your code and try again.'
      });
    }

    // Update quote status to approved
    const approverType = quote.thirdPartyPayerName ? 'third_party' : 'customer';
    
    await db
      .update(quoteRequests)
      .set({
        status: 'approved',
        approverType,
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(quoteRequests.id, quote.id));

    // Send confirmation SMS to customer
    await sendSMS(
      quote.phone,
      `Great news! Your specialty job quote for $${quote.customQuoteAmount} has been approved. We'll contact you shortly to schedule the service. - Clean Machine Auto Detail`
    );

    // If third-party approved, notify them too
    if (quote.thirdPartyPayerPhone && approverType === 'third_party') {
      await sendSMS(
        quote.thirdPartyPayerPhone,
        `Thank you for approving the quote for ${quote.customerName}'s specialty job ($${quote.customQuoteAmount}). We'll coordinate with them to schedule the service.`
      );
    }

    // Notify business owner about approval
    const businessPhone = process.env.TWILIO_PHONE_NUMBER || '';
    if (businessPhone) {
      let ownerMessage = `✅ Quote APPROVED - ${quote.customerName} (${quote.phone})\n`;
      ownerMessage += `Service: ${quote.damageType}\n`;
      ownerMessage += `Amount: $${quote.customQuoteAmount}\n`;
      
      if (approverType === 'third_party' && quote.thirdPartyPayerName) {
        ownerMessage += `⚠️ Approved by third-party: ${quote.thirdPartyPayerName}\n`;
        ownerMessage += `Customer should also approve if needed.\n`;
      }
      
      ownerMessage += `\nNext: Schedule appointment with customer.`;
      
      await sendSMS(businessPhone, ownerMessage);
    }

    // Generate booking token for automatic transition to booking flow
    // This allows the customer to immediately schedule the approved service
    const bookingToken = crypto.randomBytes(32).toString('hex');
    
    // Store booking token with quote data (expires in 24 hours)
    const bookingData = {
      quoteId: quote.id,
      customerName: quote.customerName,
      phone: quote.phone,
      email: quote.email || '',
      damageType: quote.damageType,
      customQuoteAmount: quote.customQuoteAmount,
      issueDescription: quote.issueDescription,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    };
    
    // Store in memory (TODO: Move to Redis for production)
    (global as any).bookingTokenStore = (global as any).bookingTokenStore || new Map();
    (global as any).bookingTokenStore.set(bookingToken, bookingData);

    console.log(`[QUOTE APPROVAL] Quote ${quote.id} approved by ${approverType}, booking token generated: ${bookingToken}`);

    res.json({
      success: true,
      message: 'Quote approved successfully',
      bookingToken, // Frontend will use this to redirect to booking
    });
  } catch (error) {
    console.error('[QUOTE APPROVAL] Error approving quote:', error);
    res.status(500).json({
      error: 'Failed to approve quote'
    });
  }
});

/**
 * POST /api/quote-approval/:token/decline
 * Decline the quote (requires OTP verification)
 */
router.post('/:token/decline', async (req, res) => {
  try {
    const { token } = req.params;
    const { otp, reason, ipAddress, userAgent } = req.body;

    if (!otp) {
      return res.status(400).json({
        error: 'OTP verification is required to decline'
      });
    }

    // Find quote
    const [quote] = await db
      .select()
      .from(quoteRequests)
      .where(eq(quoteRequests.approvalToken, token))
      .limit(1);

    if (!quote) {
      return res.status(404).json({
        error: 'Quote not found'
      });
    }

    if (quote.status !== 'quoted') {
      return res.status(400).json({
        error: 'This quote cannot be declined at this time'
      });
    }

    // Consume OTP before declining (verifies and deletes to prevent reuse)
    const phoneToVerify = quote.thirdPartyPayerPhone || quote.phone;
    const isOtpValid = consumeOTP(phoneToVerify, otp);
    
    if (!isOtpValid) {
      return res.status(400).json({
        error: 'Invalid or expired OTP. Please verify your code and try again.'
      });
    }

    // Update quote status to declined
    await db
      .update(quoteRequests)
      .set({
        status: 'declined',
        declinedReason: reason || 'No reason provided',
        updatedAt: new Date(),
      })
      .where(eq(quoteRequests.id, quote.id));

    // Send confirmation SMS to customer
    await sendSMS(
      quote.phone,
      `We've noted that the specialty job quote was declined. We appreciate your consideration. If you'd like to discuss alternatives, please call us. - Clean Machine Auto Detail`
    );

    // TODO: Notify business owner about decline with reason

    console.log(`[QUOTE APPROVAL] Quote ${quote.id} declined. Reason: ${reason || 'None provided'}`);

    res.json({
      success: true,
      message: 'Quote declined successfully'
    });
  } catch (error) {
    console.error('[QUOTE APPROVAL] Error declining quote:', error);
    res.status(500).json({
      error: 'Failed to decline quote'
    });
  }
});

export default router;
