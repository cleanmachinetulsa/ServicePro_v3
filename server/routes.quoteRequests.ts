import { Router } from "express";
import { quoteRequests, customers } from "../shared/schema";
import { eq, desc } from "drizzle-orm";
import { getPricingSuggestions } from "./quoteManagement";
import { sendSMS } from "./notifications";
import { sendBusinessEmail } from "./emailService";
import { nanoid } from "nanoid";

const router = Router();

/**
 * Get all quote requests (admin)
 * GET /api/quote-requests
 */
router.get("/", async (req, res) => {
  try {
    const allQuotes = await req.tenantDb!
      .select({
        quoteRequest: quoteRequests,
        customer: customers,
      })
      .from(quoteRequests)
      .leftJoin(customers, eq(quoteRequests.customerId, customers.id))
      .where(req.tenantDb!.withTenantFilter(quoteRequests))
      .orderBy(desc(quoteRequests.createdAt));

    res.json({ success: true, data: allQuotes });
  } catch (error) {
    console.error("[QUOTE REQUESTS] Error fetching quotes:", error);
    res.status(500).json({ success: false, error: "Failed to fetch quote requests" });
  }
});

/**
 * Get pending quote requests (admin)
 * GET /api/quote-requests/pending
 */
router.get("/pending", async (req, res) => {
  try {
    const pendingQuotes = await req.tenantDb!
      .select({
        quoteRequest: quoteRequests,
        customer: customers,
      })
      .from(quoteRequests)
      .leftJoin(customers, eq(quoteRequests.customerId, customers.id))
      .where(req.tenantDb!.withTenantFilter(quoteRequests, eq(quoteRequests.status, "pending_review")))
      .orderBy(desc(quoteRequests.createdAt));

    res.json({ success: true, data: pendingQuotes });
  } catch (error) {
    console.error("[QUOTE REQUESTS] Error fetching pending quotes:", error);
    res.status(500).json({ success: false, error: "Failed to fetch pending quotes" });
  }
});

/**
 * Get single quote request with pricing suggestions
 * GET /api/quote-requests/:id
 */
router.get("/:id", async (req, res) => {
  try {
    const quoteId = parseInt(req.params.id);

    const [quoteData] = await req.tenantDb!
      .select({
        quoteRequest: quoteRequests,
        customer: customers,
      })
      .from(quoteRequests)
      .leftJoin(customers, eq(quoteRequests.customerId, customers.id))
      .where(req.tenantDb!.withTenantFilter(quoteRequests, eq(quoteRequests.id, quoteId)))
      .limit(1);

    if (!quoteData) {
      return res.status(404).json({ success: false, error: "Quote request not found" });
    }

    // Get AI pricing suggestions
    const pricingSuggestions = await getPricingSuggestions(
      quoteData.quoteRequest.damageType,
      quoteData.quoteRequest.issueDescription
    );

    res.json({
      success: true,
      data: {
        ...quoteData,
        pricingSuggestions: pricingSuggestions.suggestions,
      },
    });
  } catch (error) {
    console.error("[QUOTE REQUESTS] Error fetching quote:", error);
    res.status(500).json({ success: false, error: "Failed to fetch quote request" });
  }
});

/**
 * Update quote with custom pricing (admin)
 * POST /api/quote-requests/:id/quote
 */
router.post("/:id/quote", async (req, res) => {
  try {
    const quoteId = parseInt(req.params.id);
    const { customQuoteAmount, quoteNotes, approverType } = req.body;

    if (!customQuoteAmount || customQuoteAmount <= 0) {
      return res.status(400).json({ success: false, error: "Valid quote amount required" });
    }

    // Update quote request with pricing
    const [updatedQuote] = await req.tenantDb!
      .update(quoteRequests)
      .set({
        customQuoteAmount: customQuoteAmount.toString(),
        quoteNotes: quoteNotes || null,
        approverType: approverType || 'customer',
        status: 'quoted',
        quotedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(req.tenantDb!.withTenantFilter(quoteRequests, eq(quoteRequests.id, quoteId)))
      .returning();

    if (!updatedQuote) {
      return res.status(404).json({ success: false, error: "Quote request not found" });
    }

    // Send notification with approval link
    const approvalLink = `${process.env.REPLIT_DEV_DOMAIN || 'https://your-domain.replit.app'}/quote-approval/${updatedQuote.approvalToken}`;
    
    // SMS to customer
    const customerMessage = `Hi ${updatedQuote.customerName}! Your custom quote for ${updatedQuote.damageType} service is ready.

Amount: $${customQuoteAmount}
${quoteNotes ? `\nNotes: ${quoteNotes}` : ''}

View & approve: ${approvalLink}

Reply with questions!`;

    await sendSMS(updatedQuote.phone, customerMessage);

    // Send email to customer if we have their email
    const customer = await req.tenantDb!.select().from(customers).where(req.tenantDb!.withTenantFilter(customers, eq(customers.phone, updatedQuote.phone))).limit(1);
    if (customer.length > 0 && customer[0].email) {
      const customerEmailSubject = `Your Custom Quote is Ready`;
      const emailHtml = `
<h2>Hi ${updatedQuote.customerName}!</h2>
<p>Your custom quote for ${updatedQuote.damageType} service is ready for review.</p>

<h3>Quote Details:</h3>
<ul>
  <li><strong>Service:</strong> ${updatedQuote.damageType}</li>
  <li><strong>Amount:</strong> $${customQuoteAmount}</li>
</ul>

${quoteNotes ? `<p><strong>Notes from us:</strong><br>${quoteNotes}</p>` : ''}

<p><a href="${approvalLink}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:white;text-decoration:none;border-radius:6px;margin-top:16px;">View & Approve Quote</a></p>

<p style="color:#666;font-size:14px;margin-top:24px;">Questions? Just reply to this email or give us a call!</p>
      `;
      
      const emailText = `Hi ${updatedQuote.customerName}!

Your custom quote for ${updatedQuote.damageType} service is ready.

Amount: $${customQuoteAmount}
${quoteNotes ? `\nNotes: ${quoteNotes}` : ''}

View & approve your quote: ${approvalLink}

Questions? Just reply to this email or give us a call!`;
      
      await sendBusinessEmail(customer[0].email, customerEmailSubject, emailText, emailHtml);
    }

    // If third-party payer, send to them too
    if (updatedQuote.thirdPartyPayerPhone && approverType === 'third_party') {
      const payerMessage = `Quote ready for ${updatedQuote.customerName}'s vehicle service.

Service: ${updatedQuote.damageType}
Amount: $${customQuoteAmount}
${updatedQuote.poNumber ? `PO: ${updatedQuote.poNumber}` : ''}

Approve: ${approvalLink}`;

      await sendSMS(updatedQuote.thirdPartyPayerPhone, payerMessage);
      
      // Send email to third-party payer if email available
      if (updatedQuote.thirdPartyPayerEmail) {
        const emailSubject = `Quote Approval Required - ${updatedQuote.customerName}`;
        const emailHtml = `
<h2>Quote Ready for Approval</h2>
<p>A custom quote is ready for your review and approval.</p>

<h3>Service Details:</h3>
<ul>
  <li><strong>Customer:</strong> ${updatedQuote.customerName}</li>
  <li><strong>Service Type:</strong> ${updatedQuote.damageType}</li>
  <li><strong>Quote Amount:</strong> $${customQuoteAmount}</li>
  ${updatedQuote.poNumber ? `<li><strong>PO Number:</strong> ${updatedQuote.poNumber}</li>` : ''}
</ul>

${quoteNotes ? `<p><strong>Notes:</strong><br>${quoteNotes}</p>` : ''}

<p><a href="${approvalLink}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:white;text-decoration:none;border-radius:6px;margin-top:16px;">Review & Approve Quote</a></p>

<p style="color:#666;font-size:14px;margin-top:24px;">This approval link will expire in 48 hours. If you have questions, please contact us.</p>
        `;
        
        const emailText = `Quote Ready for Approval

A custom quote is ready for your review.

Customer: ${updatedQuote.customerName}
Service: ${updatedQuote.damageType}
Amount: $${customQuoteAmount}
${updatedQuote.poNumber ? `PO Number: ${updatedQuote.poNumber}` : ''}

${quoteNotes ? `Notes: ${quoteNotes}\n` : ''}
Approve quote: ${approvalLink}

This approval link will expire in 48 hours. If you have questions, please contact us.`;
        
        await sendBusinessEmail(updatedQuote.thirdPartyPayerEmail, emailSubject, emailText, emailHtml);
      }
    }

    console.log("[QUOTE REQUESTS] Quote sent:", quoteId);
    res.json({ success: true, data: updatedQuote });
  } catch (error) {
    console.error("[QUOTE REQUESTS] Error updating quote:", error);
    res.status(500).json({ success: false, error: "Failed to update quote" });
  }
});

/**
 * Mark quote as completed with performance tracking
 * POST /api/quote-requests/:id/complete
 */
router.post("/:id/complete", async (req, res) => {
  try {
    const quoteId = parseInt(req.params.id);
    const { actualTimeSpent, difficultyRating, lessonLearned } = req.body;

    const [updatedQuote] = await req.tenantDb!
      .update(quoteRequests)
      .set({
        completedAt: new Date(),
        actualTimeSpent: actualTimeSpent ? actualTimeSpent.toString() : null,
        difficultyRating: difficultyRating || null,
        lessonLearned: lessonLearned || null,
        updatedAt: new Date(),
      })
      .where(req.tenantDb!.withTenantFilter(quoteRequests, eq(quoteRequests.id, quoteId)))
      .returning();

    if (!updatedQuote) {
      return res.status(404).json({ success: false, error: "Quote request not found" });
    }

    console.log("[QUOTE REQUESTS] Marked completed:", quoteId);
    res.json({ success: true, data: updatedQuote });
  } catch (error) {
    console.error("[QUOTE REQUESTS] Error completing quote:", error);
    res.status(500).json({ success: false, error: "Failed to complete quote" });
  }
});

export default router;
