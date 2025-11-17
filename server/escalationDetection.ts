/**
 * Escalation Detection System
 * Determines if customer communication needs owner/management involvement
 * vs. routing to assigned technician
 */

import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface EscalationAnalysis {
  requiresEscalation: boolean;
  category: 'normal' | 'complaint' | 'urgent' | 'billing' | 'quality_issue' | 'manager_request';
  reason: string;
  suggestedAction: 'route_to_technician' | 'route_to_owner' | 'both';
  confidence: number; // 0-1
}

/**
 * Analyze customer message to detect if it requires management escalation
 */
export async function analyzeForEscalation(
  customerMessage: string,
  customerPhone: string,
  hasActiveJob: boolean
): Promise<EscalationAnalysis> {
  try {
    console.log(`[ESCALATION] Analyzing message from ${customerPhone}, hasActiveJob: ${hasActiveJob}`);
    
    const systemPrompt = `You are an escalation detection system for Clean Machine Auto Detail. 

Your job is to analyze customer messages and determine if they require OWNER/MANAGEMENT involvement or can be handled by the assigned TECHNICIAN.

ROUTE TO OWNER (requiresEscalation: true) when:
- Customer is complaining about technician performance (e.g., "he's doing a terrible job", "not satisfied with the work")
- Customer expresses frustration with service quality (e.g., "this is unacceptable", "I'm very disappointed")
- Customer requests to speak with manager/owner (e.g., "let me talk to your boss", "I need to speak with Jody")
- Billing disputes or payment issues (e.g., "I was charged too much", "I don't think this is right")
- Safety concerns or damage claims (e.g., "my car was damaged", "something is missing")
- Angry or threatening tone (profanity, demands for refunds)
- Serious complaints about professionalism

ROUTE TO TECHNICIAN (requiresEscalation: false) when:
- Customer needs to communicate during active job (e.g., "I'm running late", "park in the back")
- Simple address changes or location updates (e.g., "change address to 123 Oak St")
- Normal service-related questions (e.g., "how much longer?", "what do I owe?")
- Friendly updates or clarifications (e.g., "look for the red car", "I'll meet you outside")
- Standard appointment modifications (reschedule, add services)

BOTH when:
- Moderate concerns that benefit from both technician awareness AND owner oversight
- Potential issues that may escalate but aren't critical yet

Respond with a JSON object containing:
{
  "requiresEscalation": boolean,
  "category": "normal" | "complaint" | "urgent" | "billing" | "quality_issue" | "manager_request",
  "reason": "brief explanation of your decision",
  "suggestedAction": "route_to_technician" | "route_to_owner" | "both",
  "confidence": 0.0-1.0
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Customer message: "${customerMessage}"\n\nHas active job in progress: ${hasActiveJob}\n\nAnalyze this message and determine the appropriate routing.` }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3, // Lower temperature for more consistent classification
    });

    const result = JSON.parse(completion.choices[0].message.content || '{}');
    
    console.log(`[ESCALATION] Analysis result:`, result);
    
    return {
      requiresEscalation: result.requiresEscalation || false,
      category: result.category || 'normal',
      reason: result.reason || '',
      suggestedAction: result.suggestedAction || 'route_to_technician',
      confidence: result.confidence || 0.5,
    };
    
  } catch (error) {
    console.error('[ESCALATION] Error analyzing message:', error);
    
    // Default to requiring escalation on error (safer)
    return {
      requiresEscalation: true,
      category: 'normal',
      reason: 'Error analyzing message - defaulting to owner for safety',
      suggestedAction: 'route_to_owner',
      confidence: 0.0,
    };
  }
}

/**
 * Simple keyword-based escalation detection (backup/faster method)
 */
export function quickEscalationCheck(message: string): boolean {
  const escalationKeywords = [
    'manager',
    'owner',
    'jody',
    'boss',
    'supervisor',
    'complaint',
    'complain',
    'terrible',
    'horrible',
    'worst',
    'unacceptable',
    'disappointed',
    'angry',
    'refund',
    'lawyer',
    'attorney',
    'sue',
    'police',
    'damaged',
    'damage',
    'missing',
    'stole',
    'stolen',
    'rude',
    'unprofessional',
    'incompetent',
  ];
  
  const lowerMessage = message.toLowerCase();
  return escalationKeywords.some(keyword => lowerMessage.includes(keyword));
}

/**
 * Check if customer has an active job with assigned technician
 */
export async function checkActiveJobStatus(customerPhone: string): Promise<{
  hasActiveJob: boolean;
  technicianId: number | null;
  appointmentId: number | null;
  status: string | null;
}> {
  try {
    const { db } = await import('./db');
    const { appointments, customers } = await import('@shared/schema');
    const { eq, and, or, sql } = await import('drizzle-orm');
    
    // Normalize phone
    const normalizedPhone = customerPhone.replace(/\D/g, '');
    
    // Find customer
    const customer = await db.select()
      .from(customers)
      .where(sql`REPLACE(REPLACE(REPLACE(${customers.phone}, '-', ''), ' ', ''), '+', '') = ${normalizedPhone}`)
      .limit(1);
    
    if (!customer || customer.length === 0) {
      return {
        hasActiveJob: false,
        technicianId: null,
        appointmentId: null,
        status: null,
      };
    }
    
    // Check for active appointments (en_route, on_site, in_progress)
    const activeStatuses = ['en_route', 'on_site', 'in_progress', 'scheduled'];
    const appointment = await db.select()
      .from(appointments)
      .where(and(
        eq(appointments.customerId, customer[0].id),
        or(
          eq(appointments.status, 'en_route'),
          eq(appointments.status, 'on_site'),
          eq(appointments.status, 'in_progress'),
          eq(appointments.status, 'scheduled')
        )
      ))
      .orderBy(appointments.scheduledTime)
      .limit(1);
    
    if (!appointment || appointment.length === 0) {
      return {
        hasActiveJob: false,
        technicianId: null,
        appointmentId: null,
        status: null,
      };
    }
    
    const appt = appointment[0];
    
    return {
      hasActiveJob: true,
      technicianId: appt.technicianId,
      appointmentId: appt.id,
      status: appt.status,
    };
    
  } catch (error) {
    console.error('[ESCALATION] Error checking active job status:', error);
    return {
      hasActiveJob: false,
      technicianId: null,
      appointmentId: null,
      status: null,
    };
  }
}

/**
 * Main routing decision function
 * Combines active job check + escalation analysis
 */
export async function determineMessageRouting(
  customerMessage: string,
  customerPhone: string
): Promise<{
  routeTo: 'owner' | 'technician' | 'both' | 'ai_chatbot';
  technicianId: number | null;
  escalationAnalysis: EscalationAnalysis;
  activeJobStatus: Awaited<ReturnType<typeof checkActiveJobStatus>>;
}> {
  // Check if customer has active job
  const activeJobStatus = await checkActiveJobStatus(customerPhone);
  
  // Analyze message for escalation
  const escalationAnalysis = await analyzeForEscalation(
    customerMessage,
    customerPhone,
    activeJobStatus.hasActiveJob
  );
  
  console.log('[ROUTING] Decision factors:', {
    hasActiveJob: activeJobStatus.hasActiveJob,
    requiresEscalation: escalationAnalysis.requiresEscalation,
    suggestedAction: escalationAnalysis.suggestedAction,
  });
  
  // Routing logic
  let routeTo: 'owner' | 'technician' | 'both' | 'ai_chatbot' = 'ai_chatbot';
  
  if (escalationAnalysis.requiresEscalation) {
    // Escalation needed - route to owner (and possibly tech)
    if (escalationAnalysis.suggestedAction === 'both') {
      routeTo = 'both';
    } else {
      routeTo = 'owner';
    }
  } else if (activeJobStatus.hasActiveJob && activeJobStatus.technicianId) {
    // Active job + no escalation = route to technician
    routeTo = 'technician';
  } else {
    // No active job, no escalation = AI chatbot handles it
    routeTo = 'ai_chatbot';
  }
  
  return {
    routeTo,
    technicianId: activeJobStatus.technicianId,
    escalationAnalysis,
    activeJobStatus,
  };
}
