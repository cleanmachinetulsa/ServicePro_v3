import { Router } from 'express';
import { eq, and } from 'drizzle-orm';
import { quoteRequests, bookingTokens, businessSettings } from '@shared/schema';
import { sendSMS } from './notifications';
import crypto from 'crypto';

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
 * Retrieve booking data from quote approval token (ONE-TIME USE)
 * Marks token as used after retrieval to prevent replay attacks
 */
router.get('/booking-data/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    // ATOMIC UPDATE: Mark as used ONLY if not already used (prevents race condition)
    // This ensures only ONE request can successfully retrieve the token data
    const [bookingToken] = await req.tenantDb!
      .update(bookingTokens)
      .set({ 
        used: true, 
        usedAt: new Date() 
      })
      .where(
        req.tenantDb!.withTenantFilter(bookingTokens, and(
          eq(bookingTokens.token, token),
          eq(bookingTokens.used, false)
        ))
      )
      .returning();
    
    // If no row was updated, token is either used, expired, or doesn't exist
    if (!bookingToken) {
      // Check if token exists to provide better error message
      const [existingToken] = await req.tenantDb!
        .select()
        .from(bookingTokens)
        .where(req.tenantDb!.withTenantFilter(bookingTokens, eq(bookingTokens.token, token)))
        .limit(1);
      
      if (!existingToken) {
        return res.status(404).json({
          error: 'Booking token not found'
        });
      }
      
      if (existingToken.used) {
        return res.status(410).json({
          error: 'This booking link has already been used. Please contact us to schedule.'
        });
      }
      
      // If not used but update failed, must be expired or other issue
      return res.status(410).json({
        error: 'Booking token is no longer valid. Please contact us to schedule.'
      });
    }
    
    // Check expiration (even though update succeeded)
    if (new Date() > bookingToken.expiresAt) {
      return res.status(410).json({
        error: 'Booking token has expired. Please contact us to schedule.'
      });
    }
    
    console.log(`[QUOTE APPROVAL] Booking token ${token} atomically consumed for quote #${bookingToken.quoteId}`);
    
    res.json({
      success: true,
      data: {
        quoteId: bookingToken.quoteId,
        customerName: bookingToken.customerName,
        phone: bookingToken.phone,
        email: bookingToken.email || '',
        damageType: bookingToken.damageType,
        customQuoteAmount: bookingToken.customQuoteAmount ? Number(bookingToken.customQuoteAmount) : 0,
        issueDescription: bookingToken.issueDescription || '',
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
    const [quote] = await req.tenantDb!
      .select()
      .from(quoteRequests)
      .where(req.tenantDb!.withTenantFilter(quoteRequests, eq(quoteRequests.approvalToken, token)))
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
      businessPhone: process.env.MAIN_PHONE_NUMBER || '(918) 555-0100',
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
    
    await req.tenantDb!
      .update(quoteRequests)
      .set({
        status: 'approved',
        approverType,
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(req.tenantDb!.withTenantFilter(quoteRequests, eq(quoteRequests.id, quote.id)));

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
    const businessPhone = process.env.MAIN_PHONE_NUMBER || '';
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

    // Generate secure booking token for automatic transition to booking flow
    // This allows the customer to immediately schedule the approved service
    const bookingToken = crypto.randomBytes(32).toString('hex');
    
    // Store booking token in database (expires in 24 hours, one-time use)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    await req.tenantDb!.insert(bookingTokens).values({
      token: bookingToken,
      quoteId: quote.id,
      customerName: quote.customerName,
      phone: quote.phone,
      email: quote.email || null,
      damageType: quote.damageType,
      customQuoteAmount: quote.customQuoteAmount,
      issueDescription: quote.issueDescription,
      expiresAt,
    });

    console.log(`[QUOTE APPROVAL] Quote ${quote.id} approved by ${approverType}, booking token saved to DB: ${bookingToken}`);

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

    // Fetch business settings for notification recipients
    // NOTE: businessSettings is a GLOBAL table (no tenantId) - use db directly
    const { db } = await import('./db');
    const [settings] = await db
      .select()
      .from(businessSettings)
      .limit(1);

    // Consume OTP before declining (verifies and deletes to prevent reuse)
    const phoneToVerify = quote.thirdPartyPayerPhone || quote.phone;
    const isOtpValid = consumeOTP(phoneToVerify, otp);
    
    if (!isOtpValid) {
      return res.status(400).json({
        error: 'Invalid or expired OTP. Please verify your code and try again.'
      });
    }

    // Update quote status to declined
    await req.tenantDb!
      .update(quoteRequests)
      .set({
        status: 'declined',
        declinedReason: reason || 'No reason provided',
        updatedAt: new Date(),
      })
      .where(req.tenantDb!.withTenantFilter(quoteRequests, eq(quoteRequests.id, quote.id)));

    // Send confirmation SMS to customer
    await sendSMS(
      quote.phone,
      `We've noted that the specialty job quote was declined. We appreciate your consideration. If you'd like to discuss alternatives, please call us. - Clean Machine Auto Detail`
    );

    // Notify business owner about decline (multi-channel)
    try {
      // Use settings from database for notification recipients
      const businessPhone = settings?.alertPhone || process.env.BUSINESS_OWNER_PERSONAL_PHONE || process.env.MAIN_PHONE_NUMBER || '';
      const businessEmail = settings?.backupEmail;

      // 1. SMS notification to business owner
      if (businessPhone) {
        try {
          let ownerMessage = `❌ Quote DECLINED - ${quote.customerName} (${quote.phone})\n`;
          ownerMessage += `Service: ${quote.damageType}\n`;
          ownerMessage += `Amount: $${quote.customQuoteAmount}\n`;
          if (reason) {
            ownerMessage += `Reason: ${reason}\n`;
          }
          ownerMessage += `\nNext: Follow up with customer to discuss alternatives.`;
          
          await sendSMS(businessPhone, ownerMessage);
          console.log(`[QUOTE APPROVAL] ✅ SMS decline notification sent to business owner`);
        } catch (smsError) {
          console.error(`[QUOTE APPROVAL] Failed to send SMS to business owner:`, smsError);
        }
      }

      // 2. Email notification to business owner (branded template)
      if (businessEmail) {
        try {
          const { renderBrandedEmail, renderBrandedEmailPlainText } = await import('./emailTemplates/base');
          const { sendBusinessEmail } = await import('./emailService');

          const emailData = {
            preheader: `${quote.customerName} declined the ${quote.damageType} quote`,
            subject: `❌ Quote Declined - ${quote.customerName}`,
            hero: {
              title: '❌ Quote Declined',
              subtitle: 'Customer Decision Notification'
            },
            sections: [
              {
                type: 'text' as const,
                content: '<p style="font-size: 16px; margin-bottom: 20px; color: #dc2626; font-weight: bold;">A customer has declined their quote. Review the details below and consider follow-up actions.</p>'
              },
              {
                type: 'table' as const,
                items: [
                  { label: 'Customer Name', value: quote.customerName },
                  { label: 'Phone', value: quote.phone },
                  { label: 'Service Type', value: quote.damageType },
                  { label: 'Quote Amount', value: `$${quote.customQuoteAmount}` },
                  { label: 'Decline Reason', value: reason || 'No reason provided' },
                  { label: 'Quote Date', value: new Date(quote.createdAt).toLocaleDateString('en-US', { dateStyle: 'medium' }) }
                ]
              },
              {
                type: 'spacer' as const,
                padding: '20px'
              },
              {
                type: 'text' as const,
                content: `
                  <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 20px 0;">
                    <h3 style="color: #92400e; margin-top: 0; font-size: 18px; font-weight: bold;">💡 Recommended Next Steps</h3>
                    <ul style="margin: 10px 0; padding-left: 20px; color: #1f2937;">
                      <li style="margin-bottom: 8px;"><strong>Follow up with customer</strong> - Understand their concerns and offer alternatives</li>
                      <li style="margin-bottom: 8px;"><strong>Discuss alternatives</strong> - Present different service options or pricing tiers</li>
                      <li style="margin-bottom: 8px;"><strong>Review pricing strategy</strong> - Analyze if pricing adjustments are needed</li>
                      <li style="margin-bottom: 8px;"><strong>Gather feedback</strong> - Learn what would make them reconsider</li>
                    </ul>
                  </div>
                `
              }
            ],
            ctas: [
              {
                text: 'View Quote Details',
                url: `${process.env.REPLIT_DEV_DOMAIN || 'https://your-domain.repl.co'}/admin-quote-requests?id=${quote.id}`,
                style: 'primary' as const
              },
              {
                text: 'Contact Customer',
                url: `tel:${quote.phone}`,
                style: 'secondary' as const
              }
            ],
            notes: `Quote ID: ${quote.id} | Declined at: ${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}`
          };

          const htmlContent = renderBrandedEmail(emailData);
          const textContent = renderBrandedEmailPlainText(emailData);

          const result = await sendBusinessEmail(
            businessEmail,
            emailData.subject,
            textContent,
            htmlContent
          );

          if (result.success) {
            console.log(`[QUOTE APPROVAL] ✅ Email decline notification sent to business owner`);
          } else {
            throw new Error(result.error || 'Email send failed');
          }
        } catch (emailError) {
          console.error(`[QUOTE APPROVAL] Failed to send email to business owner:`, emailError);
        }
      }

      // 3. Push notifications to admin users (owners/managers)
      try {
        const { users, pushSubscriptions } = await import('@shared/schema');
        const { inArray, eq } = await import('drizzle-orm');
        const { sendPushNotification } = await import('./pushNotificationService');

        const adminUsers = await req.tenantDb!
          .select({ id: users.id, role: users.role })
          .from(users)
          .innerJoin(pushSubscriptions, eq(pushSubscriptions.userId, users.id))
          .where(req.tenantDb!.withTenantFilter(users, inArray(users.role, ['owner', 'manager'])))
          .groupBy(users.id, users.role);

        if (adminUsers.length > 0) {
          const pushPayload = {
            title: '❌ Quote Declined',
            body: `${quote.customerName} declined the ${quote.damageType} quote ($${quote.customQuoteAmount})`,
            icon: '/icon-512.png',
            badge: '/icon-192.png',
            tag: `quote-declined-${quote.id}`,
            requireInteraction: false,
            data: {
              type: 'quote_declined',
              quoteId: quote.id,
              customerId: quote.customerId,
              url: `/admin-quote-requests?id=${quote.id}`,
              reason: reason || 'No reason provided'
            },
          };

          for (const user of adminUsers) {
            try {
              await sendPushNotification(user.id, pushPayload);
              console.log(`[QUOTE APPROVAL] ✅ Push notification sent to user ${user.id} (${user.role})`);
            } catch (pushError) {
              console.error(`[QUOTE APPROVAL] Failed to send push to user ${user.id}:`, pushError);
            }
          }
        } else {
          console.log('[QUOTE APPROVAL] No admin users with push subscriptions found');
        }
      } catch (pushError) {
        console.error(`[QUOTE APPROVAL] Failed to send push notifications:`, pushError);
      }
    } catch (notificationError) {
      console.error('[QUOTE APPROVAL] Error in business owner notification system:', notificationError);
    }

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
