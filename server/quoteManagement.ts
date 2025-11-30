import type { TenantDb } from "./db";
import { quoteRequests, customers } from "../shared/schema";
import { nanoid } from "nanoid";
import { sendSMS } from "./notifications";
import { eq, and, inArray, isNotNull, sql } from "drizzle-orm";

/**
 * Create a specialty quote request for jobs requiring manual pricing
 */
export async function requestSpecialtyQuote(tenantDb: TenantDb, params: {
  phone: string;
  customerName: string;
  issueDescription: string;
  damageType: string;
  thirdPartyPayerName?: string;
  thirdPartyPayerEmail?: string;
  thirdPartyPayerPhone?: string;
  poNumber?: string;
  photoUrls?: string[];
}): Promise<{
  success: boolean;
  message: string;
  quoteRequestId?: number;
}> {
  try {
    console.log('[QUOTE REQUEST] Creating specialty quote request:', params);

    // Check if customer exists in database
    const existingCustomers = await tenantDb
      .select()
      .from(customers)
      .where(eq(customers.phone, params.phone))
      .limit(1);

    const customerId = existingCustomers.length > 0 ? existingCustomers[0].id : null;

    // Generate unique approval token
    const approvalToken = nanoid(32);

    // Create quote request record
    const [quoteRequest] = await tenantDb
      .insert(quoteRequests)
      .values({
        customerId: customerId || undefined,
        phone: params.phone,
        customerName: params.customerName,
        issueDescription: params.issueDescription,
        damageType: params.damageType,
        photoUrls: params.photoUrls || [],
        thirdPartyPayerName: params.thirdPartyPayerName || null,
        thirdPartyPayerEmail: params.thirdPartyPayerEmail || null,
        thirdPartyPayerPhone: params.thirdPartyPayerPhone || null,
        poNumber: params.poNumber || null,
        approvalToken,
        status: 'pending_review',
      })
      .returning();

    console.log('[QUOTE REQUEST] Created quote request:', quoteRequest.id);

    // Send SMS alert to business owner
    const businessPhone = process.env.BUSINESS_OWNER_PERSONAL_PHONE;
    if (businessPhone) {
      const thirdPartyInfo = params.thirdPartyPayerName
        ? `\n\nThird-Party Payer: ${params.thirdPartyPayerName}${params.poNumber ? ` (PO: ${params.poNumber})` : ''}`
        : '';

      const alertMessage = `🔧 SPECIALTY QUOTE REQUEST #${quoteRequest.id}

Customer: ${params.customerName}
Phone: ${params.phone}
Type: ${params.damageType}

Issue: ${params.issueDescription}${thirdPartyInfo}

Review & Quote: ${process.env.REPLIT_DEV_DOMAIN || 'https://your-domain.replit.app'}/admin/quote-requests

Photos will appear when customer uploads them.`;

      await sendSMS(businessPhone, alertMessage);
      console.log('[QUOTE REQUEST] Business owner alerted');
    }

    return {
      success: true,
      message: 'Quote request created successfully. Business owner will review and provide pricing.',
      quoteRequestId: quoteRequest.id,
    };
  } catch (error) {
    console.error('[QUOTE REQUEST ERROR]:', error);
    return {
      success: false,
      message: `Failed to create quote request: ${(error as Error).message}`,
    };
  }
}

/**
 * Get AI-powered pricing suggestions based on past completed specialty jobs
 */
export async function getPricingSuggestions(
  tenantDb: TenantDb,
  damageType: string,
  issueDescription: string
): Promise<{
  suggestions: {
    minPrice: number;
    avgPrice: number;
    maxPrice: number;
    avgTimeSpent: number;
    avgDifficulty: number;
    totalJobs: number;
    similarJobs: Array<{
      id: number;
      type: string;
      description: string;
      price: number;
      timeSpent: number;
      difficulty: number;
      lessonLearned: string | null;
    }>;
  } | null;
}> {
  try {
    console.log('[PRICING SUGGESTIONS] Analyzing historical data for:', damageType);

    // Get completed quotes with pricing data
    const completedQuotes = await tenantDb
      .select()
      .from(quoteRequests)
      .where(
        and(
          eq(quoteRequests.status, 'approved'),
          isNotNull(quoteRequests.customQuoteAmount),
          isNotNull(quoteRequests.completedAt)
        )
      );

    if (completedQuotes.length === 0) {
      console.log('[PRICING SUGGESTIONS] No historical data available');
      return { suggestions: null };
    }

    // Filter by matching damage type first
    const matchingType = completedQuotes.filter(q => q.damageType === damageType);
    
    // If we have matching type, use those. Otherwise use all completed quotes
    const relevantQuotes = matchingType.length > 0 ? matchingType : completedQuotes;

    // Calculate similarity scores based on keyword matching
    const issueKeywords = issueDescription.toLowerCase().split(/\s+/);
    const scoredQuotes = relevantQuotes.map(quote => {
      const quoteKeywords = quote.issueDescription.toLowerCase().split(/\s+/);
      const matchingKeywords = issueKeywords.filter(k => quoteKeywords.includes(k));
      const similarityScore = matchingKeywords.length / Math.max(issueKeywords.length, 1);
      
      return {
        ...quote,
        similarityScore,
      };
    });

    // Sort by similarity and take top 5 most similar jobs
    const topMatches = scoredQuotes
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, 5);

    // Calculate statistics from top matches
    const prices = topMatches
      .map(q => parseFloat(q.customQuoteAmount || '0'))
      .filter(p => p > 0);
    
    const times = topMatches
      .map(q => parseFloat(q.actualTimeSpent || '0'))
      .filter(t => t > 0);
    
    const difficulties = topMatches
      .map(q => q.difficultyRating || 0)
      .filter(d => d > 0);

    if (prices.length === 0) {
      console.log('[PRICING SUGGESTIONS] No pricing data available in matches');
      return { suggestions: null };
    }

    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    const avgTimeSpent = times.length > 0 
      ? times.reduce((a, b) => a + b, 0) / times.length 
      : 0;
    const avgDifficulty = difficulties.length > 0
      ? difficulties.reduce((a, b) => a + b, 0) / difficulties.length
      : 0;

    // Build anonymized examples
    const similarJobs = topMatches.map((quote, index) => ({
      id: quote.id,
      type: quote.damageType,
      description: quote.issueDescription.substring(0, 100) + (quote.issueDescription.length > 100 ? '...' : ''),
      price: parseFloat(quote.customQuoteAmount || '0'),
      timeSpent: parseFloat(quote.actualTimeSpent || '0'),
      difficulty: quote.difficultyRating || 0,
      lessonLearned: quote.lessonLearned,
    }));

    console.log('[PRICING SUGGESTIONS] Generated suggestions:', {
      minPrice,
      avgPrice,
      maxPrice,
      totalJobs: topMatches.length,
    });

    return {
      suggestions: {
        minPrice: Math.round(minPrice),
        avgPrice: Math.round(avgPrice),
        maxPrice: Math.round(maxPrice),
        avgTimeSpent: Math.round(avgTimeSpent * 10) / 10,
        avgDifficulty: Math.round(avgDifficulty * 10) / 10,
        totalJobs: topMatches.length,
        similarJobs,
      },
    };
  } catch (error) {
    console.error('[PRICING SUGGESTIONS ERROR]:', error);
    return { suggestions: null };
  }
}
