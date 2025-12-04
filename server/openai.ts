import OpenAI from "openai";
import Bottleneck from "bottleneck";
import { generatePrompt, extractKnowledgeBase } from "./knowledge";
import { shouldOfferMaintenanceDetail, getMaintenanceDetailRecommendation, mightNeedDeeperCleaning } from "./maintenanceDetail";
import { customerMemory } from "./customerMemory";
import { 
  checkCustomerDatabase, 
  validateAddress, 
  getAvailableSlots, 
  getUpsellOffers, 
  createAppointment,
  buildInvoiceSummary 
} from "./schedulingTools";
import { conversationState } from "./conversationState";
import { requestDamagePhotos } from "./damageAssessment";
import { buildCustomerContext, buildPersonalizedSystemPrompt } from "./gptPersonalizationService";

// SMS Agent Model Configuration
// GPT-5.1 upgrade requested - centralized config for easy switching
export const SMS_AGENT_MODEL = process.env.SMS_AGENT_MODEL ?? "gpt-5.1";

const OPENAI_ENABLED = !!process.env.OPENAI_API_KEY;

if (!OPENAI_ENABLED) {
  console.warn('[OPENAI] OPENAI_API_KEY not found in openai.ts, AI scheduling features will be disabled');
}

const openai = OPENAI_ENABLED ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY! }) : null;

/**
 * Demo Mode AI Rate Limiter
 * Limits demo users to 20 requests/hour and 1 request/second
 * to prevent abuse and control costs
 */
const demoAILimiter = new Bottleneck({
  reservoir: 20, // 20 requests
  reservoirRefreshAmount: 20,
  reservoirRefreshInterval: 60 * 60 * 1000, // per hour
  minTime: 1000, // 1 second between requests
});

// Track demo AI usage for monitoring
let demoAIUsageCount = 0;
export function getDemoAIUsageStats() {
  return {
    totalRequests: demoAIUsageCount,
    limiterStatus: {
      reservoir: demoAILimiter.counts().RECEIVED,
    },
  };
}

/**
 * Generate an AI-powered SMS reply to a voicemail transcription.
 * Used by the test IVR voicemail-transcription endpoint.
 */
export async function generateVoicemailFollowupSms(transcriptionText: string): Promise<string> {
  if (!openai) {
    console.warn('[OPENAI] OpenAI not configured, using fallback voicemail reply');
    return "Thanks for your voicemail! We received your message and will review it shortly.";
  }

  const trimmed = (transcriptionText || "").trim();

  const basePrompt =
    "You are an AI assistant helping a mobile auto detailing business respond to customer voicemails via SMS.\n" +
    "You will be given the text transcription of a customer's voicemail.\n" +
    "Your job is to craft a single, concise, friendly SMS reply that:\n" +
    "- Acknowledges the voicemail\n" +
    "- Briefly reflects what they asked for or described\n" +
    "- Suggests the next step (like scheduling, clarifying details, or confirming a quote)\n" +
    "- Stays under 320 characters if possible\n" +
    "Do NOT include line breaks, quotes, or emojis.\n";

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: basePrompt,
    },
    {
      role: "user",
      content:
        "Customer voicemail transcription:\n" +
        trimmed +
        "\n\nWrite the SMS reply text only:",
    },
  ];

  try {
    const response = await openai.chat.completions.create({
      model: SMS_AGENT_MODEL,
      messages,
      max_completion_tokens: 120,
      temperature: 0.4,
    });

    const text =
      response.choices?.[0]?.message?.content?.trim() ||
      "Thanks for your voicemail! We received your message and will review it shortly.";
    
    console.log("[VOICEMAIL AI] Generated follow-up SMS:", { 
      transcriptionLength: trimmed.length,
      replyLength: text.length 
    });
    
    return text;
  } catch (err) {
    console.error("[VOICEMAIL AI] Error generating reply:", err);
    return "Thanks for your voicemail! We received your message and will review it shortly.";
  }
}

/**
 * Generate a short AI summary of a voicemail transcription.
 * Used to provide quick context in the Messages UI and SMS agent prompts.
 */
export interface VoicemailSummaryInput {
  transcriptionText: string;
  fromPhone: string;
  toPhone: string;
  recordingUrl?: string;
  tenantName?: string;
}

export async function generateVoicemailSummary(
  input: VoicemailSummaryInput
): Promise<string | null> {
  if (!openai) {
    console.warn('[voicemail-summary] OpenAI not configured, skipping summary generation');
    return null;
  }

  const trimmed = (input.transcriptionText || "").trim();
  if (!trimmed) {
    console.warn('[voicemail-summary] Empty transcription, skipping summary');
    return null;
  }

  const systemPrompt = `You are an assistant summarizing voicemails for a mobile auto detailing business${input.tenantName ? ` (${input.tenantName})` : ''}.
Write a VERY short summary (1-2 sentences max, no bullets, no emojis) of what the caller wants.

Focus on:
- Vehicle details (year/make/model) if mentioned
- Interior vs exterior vs full detail
- Any requested date/time window
- Any special concerns (stains, pet hair, bad odor, etc.)

Tone: neutral, factual, concise. Do NOT invent details not mentioned in the voicemail.`;

  const userPrompt = `VOICEMAIL TRANSCRIPT:
${trimmed}

Caller phone: ${input.fromPhone}
Our line: ${input.toPhone}
Recording URL: ${input.recordingUrl ?? "n/a"}

Write a 1-2 sentence summary:`;

  try {
    const response = await openai.chat.completions.create({
      model: SMS_AGENT_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_completion_tokens: 80,
      temperature: 0.3,
    });

    const summary = response.choices?.[0]?.message?.content?.trim() || null;
    
    console.log("[voicemail-summary] Generated summary:", {
      transcriptionLength: trimmed.length,
      summaryLength: summary?.length ?? 0,
      hasSummary: !!summary,
    });

    return summary;
  } catch (err) {
    console.error("[voicemail-summary] Error generating summary:", err);
    return null;
  }
}

/**
 * OpenAI Function Schemas for Scheduling Tools
 * These allow the AI to intelligently schedule appointments using real data
 */
const SCHEDULING_FUNCTIONS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "check_customer_database",
      description: "Look up customer information in the database by phone number. Use this to greet returning customers by name and access their service history.",
      parameters: {
        type: "object",
        properties: {
          phone: {
            type: "string",
            description: "Customer's phone number (any format accepted)"
          }
        },
        required: ["phone"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "validate_address",
      description: "Validate a customer's address and check if it's within the service area (26-minute drive radius from Tulsa). Must be called before booking an appointment.",
      parameters: {
        type: "object",
        properties: {
          phone: {
            type: "string",
            description: "Customer's phone number"
          },
          address: {
            type: "string",
            description: "Customer's full address (street, city, state)"
          }
        },
        required: ["phone", "address"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_available_slots",
      description: "Fetch real available appointment time slots from Google Calendar for a specific service. Call this when customer wants to schedule an appointment.",
      parameters: {
        type: "object",
        properties: {
          phone: {
            type: "string",
            description: "Customer's phone number"
          },
          service: {
            type: "string",
            description: "The service they want to book (e.g., 'Full Detail', 'Interior Detail', etc.)"
          }
        },
        required: ["phone", "service"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_upsell_offers",
      description: "Get relevant add-on services (upsells) that complement the main service selected. Call after customer selects a service.",
      parameters: {
        type: "object",
        properties: {
          phone: {
            type: "string",
            description: "Customer's phone number"
          },
          service: {
            type: "string",
            description: "The main service they selected"
          }
        },
        required: ["phone", "service"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_appointment",
      description: "Book the appointment in Google Calendar once all details are confirmed by the customer. Only call this after customer explicitly confirms they want to book.",
      parameters: {
        type: "object",
        properties: {
          phone: {
            type: "string",
            description: "Customer's phone number"
          }
        },
        required: ["phone"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "build_booking_summary",
      description: "Generate a formatted invoice-style summary of the pending appointment for customer review before confirming.",
      parameters: {
        type: "object",
        properties: {
          phone: {
            type: "string",
            description: "Customer's phone number"
          }
        },
        required: ["phone"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "request_damage_photos",
      description: "Request photos from customer when they mention vehicle damage that needs assessment (scratches, dents, tears, paint chips, stains that won't come out, burns, holes, etc.). This flags the appointment for damage assessment and sends the business owner an alert.",
      parameters: {
        type: "object",
        properties: {
          phone: {
            type: "string",
            description: "Customer's phone number"
          },
          damageDescription: {
            type: "string",
            description: "Description of the damage mentioned by the customer (e.g., 'paint scratches on hood', 'tear in driver seat', 'cigarette burn in carpet')"
          },
          damageType: {
            type: "string",
            enum: ["paint_damage", "upholstery_tear", "stain", "dent", "scratch", "burn", "other"],
            description: "Category of damage"
          }
        },
        required: ["phone", "damageDescription", "damageType"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "request_specialty_quote",
      description: "Create a specialty job quote request for unusual conditions requiring manual pricing (asphalt/tar removal, extreme staining, mold, biohazard, unusual contaminants). This bypasses normal booking and sends request to business owner for custom pricing.",
      parameters: {
        type: "object",
        properties: {
          phone: {
            type: "string",
            description: "Customer's phone number"
          },
          customerName: {
            type: "string",
            description: "Customer's name"
          },
          issueDescription: {
            type: "string",
            description: "Detailed description of the specialty job/unusual condition (e.g., 'Vehicle covered in asphalt from road work', 'Severe mold throughout interior')"
          },
          damageType: {
            type: "string",
            enum: ["asphalt", "tar", "extreme_staining", "mold", "biohazard", "paint_overspray", "chemical_spill", "other"],
            description: "Category of specialty job"
          },
          thirdPartyPayerName: {
            type: "string",
            description: "Name of third-party paying for service (if applicable, e.g., 'APAC', 'Insurance Company', 'Property Manager')"
          },
          thirdPartyPayerEmail: {
            type: "string",
            description: "Email of third-party payer (if applicable)"
          },
          thirdPartyPayerPhone: {
            type: "string",
            description: "Phone of third-party payer (if applicable)"
          },
          poNumber: {
            type: "string",
            description: "Purchase order or claim number from third-party (if applicable)"
          },
          photoUrls: {
            type: "array",
            items: { type: "string" },
            description: "Array of photo URLs uploaded by customer showing the specialty job condition"
          }
        },
        required: ["phone", "customerName", "issueDescription", "damageType"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_existing_appointment",
      description: "Check if customer has an existing/upcoming appointment. Use this when customer contacts you about an already-scheduled service.",
      parameters: {
        type: "object",
        properties: {
          phone: {
            type: "string",
            description: "Customer's phone number"
          }
        },
        required: ["phone"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_appointment_address",
      description: "Update the address for an existing appointment. Use when customer says they need to change the service location (e.g., 'I need to change address to 123 Oak St', 'Can you come to my work instead').",
      parameters: {
        type: "object",
        properties: {
          phone: {
            type: "string",
            description: "Customer's phone number"
          },
          newAddress: {
            type: "string",
            description: "The new address for the appointment"
          }
        },
        required: ["phone", "newAddress"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "add_appointment_notes",
      description: "Add important notes to an existing appointment (e.g., customer preferences, delays, special instructions). Use for messages like 'I'm running 20 minutes late', 'Please park in back driveway', 'Look for the red car'.",
      parameters: {
        type: "object",
        properties: {
          phone: {
            type: "string",
            description: "Customer's phone number"
          },
          notes: {
            type: "string",
            description: "Notes to add to the appointment"
          }
        },
        required: ["phone", "notes"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "reschedule_appointment",
      description: "Change the date/time of an existing appointment. Use when customer requests to move their appointment to a different time.",
      parameters: {
        type: "object",
        properties: {
          phone: {
            type: "string",
            description: "Customer's phone number"
          },
          newDateTime: {
            type: "string",
            description: "New date and time for the appointment (ISO format or natural language like '2025-11-20T14:00:00')"
          }
        },
        required: ["phone", "newDateTime"]
      }
    }
  }
];

/**
 * Execute a function call requested by OpenAI
 */
async function executeFunctionCall(
  functionName: string,
  args: any
): Promise<string> {
  try {
    console.log(`[FUNCTION CALL] Executing ${functionName} with args:`, args);
    
    switch (functionName) {
      case "check_customer_database": {
        const result = await checkCustomerDatabase(args.phone);
        return JSON.stringify(result);
      }
      
      case "validate_address": {
        const result = await validateAddress(args.phone, args.address);
        return JSON.stringify(result);
      }
      
      case "get_available_slots": {
        const result = await getAvailableSlots(args.phone, args.service);
        return JSON.stringify(result);
      }
      
      case "get_upsell_offers": {
        const result = await getUpsellOffers(args.phone, args.service);
        return JSON.stringify(result);
      }
      
      case "create_appointment": {
        const result = await createAppointment(args.phone);
        return JSON.stringify(result);
      }
      
      case "build_booking_summary": {
        const result = buildInvoiceSummary(args.phone);
        return JSON.stringify(result);
      }
      
      case "request_damage_photos": {
        const result = await requestDamagePhotos(args.phone, args.damageDescription, args.damageType);
        return JSON.stringify(result);
      }
      
      case "request_specialty_quote": {
        const { requestSpecialtyQuote } = await import('./quoteManagement');
        const result = await requestSpecialtyQuote({
          phone: args.phone,
          customerName: args.customerName,
          issueDescription: args.issueDescription,
          damageType: args.damageType,
          thirdPartyPayerName: args.thirdPartyPayerName,
          thirdPartyPayerEmail: args.thirdPartyPayerEmail,
          thirdPartyPayerPhone: args.thirdPartyPayerPhone,
          poNumber: args.poNumber,
          photoUrls: args.photoUrls || [],
        });
        return JSON.stringify(result);
      }
      
      case "get_existing_appointment": {
        const { getExistingAppointment } = await import('./schedulingTools');
        const result = await getExistingAppointment(args.phone);
        return JSON.stringify(result);
      }
      
      case "update_appointment_address": {
        const { updateAppointmentAddress } = await import('./schedulingTools');
        const result = await updateAppointmentAddress(args.phone, args.newAddress);
        return JSON.stringify(result);
      }
      
      case "add_appointment_notes": {
        const { addAppointmentNotes } = await import('./schedulingTools');
        const result = await addAppointmentNotes(args.phone, args.notes);
        return JSON.stringify(result);
      }
      
      case "reschedule_appointment": {
        const { rescheduleAppointment } = await import('./schedulingTools');
        const result = await rescheduleAppointment(args.phone, args.newDateTime);
        return JSON.stringify(result);
      }
      
      default:
        return JSON.stringify({ error: `Unknown function: ${functionName}` });
    }
  } catch (error) {
    console.error(`[FUNCTION CALL ERROR] ${functionName}:`, error);
    return JSON.stringify({ 
      error: `Failed to execute ${functionName}: ${(error as Error).message}` 
    });
  }
}

/**
 * Generate an AI response with function calling support for scheduling
 * Now supports both general conversation AND intelligent appointment booking
 * PHASE 11: SMS-optimized with tenant-aware prompts
 */
export async function generateAIResponse(
  userMessage: string, 
  phoneNumber: string, 
  platform: "sms" | "web" = "web",
  behaviorSettings?: {
    tone?: string;
    forcedAction?: string;
    formality?: number;
    responseLength?: number;
    proactivity?: number;
  },
  conversationHistory?: Array<{ content: string; role: string; sender: string }>,
  isDemoMode: boolean = false,
  tenantId?: string,
  controlMode?: 'auto' | 'manual' | 'paused'  // AI BEHAVIOR V2: control mode awareness
) {
  try {
    // PHASE 11 + AI BEHAVIOR V2: Use SMS-optimized, state-aware prompt for SMS platform
    if (platform === 'sms' && tenantId) {
      console.log('[AI BEHAVIOR V2] Using state-aware SMS prompt builder');
      const { buildSmsSystemPrompt } = await import('./ai/smsAgentPromptBuilder');
      
      try {
        // AI BEHAVIOR V2: Load conversation state
        const currentState = conversationState.getState(phoneNumber);
        
        // Extract last voicemail summary from conversation history (newest first)
        let lastVoicemailSummary: string | undefined;
        if (conversationHistory && conversationHistory.length > 0) {
          for (let i = conversationHistory.length - 1; i >= 0; i--) {
            const msg = conversationHistory[i] as any;
            if (msg.metadata?.type === 'voicemail' && msg.metadata?.voicemailSummary) {
              lastVoicemailSummary = msg.metadata.voicemailSummary;
              break;
            }
          }
        }
        
        const conversationStateInfo = {
          customerName: currentState.customerName,
          customerEmail: currentState.customerEmail,
          address: currentState.address,
          addressValidated: currentState.addressValidated,
          service: currentState.service,
          selectedTimeSlot: currentState.selectedTimeSlot,
          addOns: currentState.addOns,
          vehicles: currentState.vehicles,
          lastVoicemailSummary,
        };
        
        // AI BEHAVIOR V2: Extract recent human messages if transitioning from manual mode
        let recentHumanMessages: string[] | undefined;
        if (controlMode === 'auto' && conversationHistory && conversationHistory.length > 0) {
          // Find recent human agent messages (last 3)
          recentHumanMessages = conversationHistory
            .filter(msg => msg.sender === 'agent' || msg.sender === 'owner')
            .slice(-3)
            .map(msg => msg.content);
        }
        
        const smsSystemPrompt = await buildSmsSystemPrompt({ 
          tenantId, 
          phoneNumber,
          conversationState: conversationStateInfo,  // AI BEHAVIOR V2: pass state
          controlMode,  // AI BEHAVIOR V2: pass control mode
          recentHumanMessages  // AI BEHAVIOR V2: pass human context
        });
        
        // Build messages array with SMS-optimized prompt
        const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
          { role: "system", content: smsSystemPrompt }
        ];
        
        // Add conversation history (limit to last 15 messages for context window)
        if (conversationHistory && conversationHistory.length > 0) {
          const recentHistory = conversationHistory.slice(-15);  // AI BEHAVIOR V2: limit history
          for (const msg of recentHistory) {
            if (msg.sender === 'customer') {
              messages.push({ role: "user", content: msg.content });
            } else if (msg.sender === 'ai') {
              messages.push({ role: "assistant", content: msg.content });
            }
          }
        }
        
        // Add current user message
        messages.push({ role: "user", content: userMessage });
        
        // AI BEHAVIOR V2: Wrap OpenAI call in try-catch for safety fallback
        let completion;
        try {
          // Make OpenAI call with SMS-optimized settings
          // NOTE: Tools disabled for SMS to ensure customers always get text responses
          // The AI can still recommend scheduling but won't block on function calls
          completion = await openai!.chat.completions.create({
            model: SMS_AGENT_MODEL,
            messages,
            max_completion_tokens: 300, // Shorter for SMS (GPT-5.1 uses max_completion_tokens)
          });
        } catch (openaiError) {
          console.error('[AI BEHAVIOR V2] OpenAI API error:', openaiError);
          
          // AI BEHAVIOR V2: Safety fallback
          const { SAFETY_FALLBACK_MESSAGE } = await import('@shared/ai/smsAgentConfig');
          
          // TODO: Set needsHumanAttention flag on conversation in database
          console.log('[AI BEHAVIOR V2] OpenAI error - returning safety fallback and flagging for human attention');
          
          return SAFETY_FALLBACK_MESSAGE;
        }
        
        // Log usage
        try {
          const { logApiUsage } = await import('./usageTracker');
          const inputTokens = completion.usage?.prompt_tokens || 0;
          const outputTokens = completion.usage?.completion_tokens || 0;
          const totalCost = (inputTokens / 1000000) * 2.50 + (outputTokens / 1000000) * 10.00;
          
          await logApiUsage(
            'openai',
            'tokens',
            inputTokens + outputTokens,
            totalCost,
            {
              model: SMS_AGENT_MODEL,
              input_tokens: inputTokens,
              output_tokens: outputTokens,
              platform: 'sms',
            }
          );
        } catch (err) {
          console.error('[SMS AI USAGE LOG] Error:', err);
        }
        
        let finalResponse = completion.choices[0].message.content || "I apologize, but I didn't generate a proper response. Please try again.";
        
        // SMS length optimization: trim whitespace
        finalResponse = finalResponse.trim();
        
        // AI BEHAVIOR V2: Sentiment/Escalation detection
        const { detectEscalationSentiment, ESCALATION_MESSAGE } = await import('@shared/ai/smsAgentConfig');
        const escalationCheck = detectEscalationSentiment(userMessage, conversationHistory);
        
        if (escalationCheck.shouldEscalate) {
          console.log(`[AI BEHAVIOR V2] Escalation detected - confidence: ${escalationCheck.confidence}, reason: ${escalationCheck.reason}`);
          
          // TODO: Set needsHumanAttention flag on conversation in database
          // For high confidence escalations, use standard escalation message
          if (escalationCheck.confidence === 'high') {
            console.log('[AI BEHAVIOR V2] High confidence escalation - overriding AI response with escalation message');
            finalResponse = ESCALATION_MESSAGE;
          }
        }
        
        // TODO: Consider truncating or splitting replies into multiple SMS segments if > 320 chars
        if (finalResponse.length > 320) {
          console.warn(`[SMS AI] Response length ${finalResponse.length} exceeds 2 SMS segments (320 chars)`);
        }
        
        console.log(`[AI BEHAVIOR V2] Generated response (${finalResponse.length} chars)`);
        return finalResponse;
      } catch (smsPromptError) {
        console.error('[AI BEHAVIOR V2] Error with SMS prompt builder, falling back to standard prompt:', smsPromptError);
        // Fall through to standard prompt below
      }
    }
    
    // Standard (web/fallback) prompt logic
    const prompt = generatePrompt(userMessage);
    const knowledgeBase = extractKnowledgeBase();
    
    // Check if the customer should be offered the maintenance detail program
    const offerMaintenanceDetail = shouldOfferMaintenanceDetail(phoneNumber, userMessage);
    
    // Check if customer might need deeper cleaning instead
    const needsDeeperCleaning = mightNeedDeeperCleaning(userMessage);
    
    // Determine if this is a repeat customer
    const customerInfo = phoneNumber ? customerMemory.getCustomer(phoneNumber) : null;
    const isRepeatCustomer = customerInfo && customerInfo.serviceHistory && customerInfo.serviceHistory.length > 0;
    
    // Prepare special instructions about maintenance detail
    let maintenanceDetailInstructions = "";
    if (offerMaintenanceDetail && !needsDeeperCleaning) {
      maintenanceDetailInstructions = `
      This customer is a good candidate for the Maintenance Detail Program.
      Make sure to mention our Maintenance Detail Program in your response.
      The program consists of a quick wipe down, window cleaning, and wash/wax to maintain their vehicle.
      Emphasize this is ideal for vehicles that are already in good condition and just need regular upkeep.
      ${isRepeatCustomer ? "This is a repeat customer who has had service with us in the past 3 months." : "This customer mentioned their vehicle is well-maintained."}
      `;
    } else if (needsDeeperCleaning) {
      maintenanceDetailInstructions = `
      This customer likely needs a deeper cleaning service rather than the Maintenance Detail Program.
      If they ask about maintenance detailing, explain that it's best for vehicles that are already very clean,
      and recommend our Full Detail or Interior Detail service instead for vehicles with stains or heavy soil.
      `;
    } else {
      maintenanceDetailInstructions = `
      DO NOT suggest the Maintenance Detail Program to this customer unless they specifically ask about it.
      It should only be offered to customers who mention they keep their car regularly maintained/detailed/garage kept,
      or repeat customers who have had service within the past 3 months.
      `;
    }

    // Build behavior instructions from settings
    let behaviorInstructions = "";
    if (behaviorSettings) {
      if (behaviorSettings.tone) {
        behaviorInstructions += `\n- Tone: ${behaviorSettings.tone}`;
      }
      if (behaviorSettings.formality !== undefined) {
        const formalityLevel = behaviorSettings.formality;
        if (formalityLevel < 30) {
          behaviorInstructions += `\n- Be very casual and friendly`;
        } else if (formalityLevel < 70) {
          behaviorInstructions += `\n- Use a balanced, professional yet approachable tone`;
        } else {
          behaviorInstructions += `\n- Be very formal and professional`;
        }
      }
      if (behaviorSettings.responseLength !== undefined) {
        const lengthLevel = behaviorSettings.responseLength;
        if (lengthLevel < 30) {
          behaviorInstructions += `\n- Keep responses very brief and to the point`;
        } else if (lengthLevel < 70) {
          behaviorInstructions += `\n- Provide moderate-length responses`;
        } else {
          behaviorInstructions += `\n- Provide detailed, comprehensive responses`;
        }
      }
      if (behaviorSettings.proactivity !== undefined && behaviorSettings.proactivity > 60) {
        behaviorInstructions += `\n- Be proactive in offering suggestions and upsells`;
      }
      if (behaviorSettings.forcedAction === 'show_scheduler') {
        behaviorInstructions += `\n- Encourage the customer to book an appointment and direct them to the scheduling system`;
      } else if (behaviorSettings.forcedAction === 'collect_info') {
        behaviorInstructions += `\n- Focus on collecting customer information (name, vehicle info, address)`;
      }
    }

    // Get conversation state for context
    const state = conversationState.getState(phoneNumber);
    const stateContext = state ? `
    
    Current Booking State:
    - Customer Name: ${state.customerName || "Not collected"}
    - Service Selected: ${state.service || "None"}
    - Address: ${state.address || "Not provided"}
    - Selected Time: ${state.selectedTimeSlot || "Not selected"}
    - Add-ons: ${state.addOns?.join(', ') || "None"}
    - Steps Completed: ${Object.keys(state.stepsCompleted).filter(k => state.stepsCompleted[k as keyof typeof state.stepsCompleted]).join(', ')}
    
    IMPORTANT: Don't ask for information that's already collected above. Remember context across the conversation.
    ` : "";
    
    // Build customer intelligence context for personalization (Phase 1)
    const customerContext = phoneNumber ? await buildCustomerContext(phoneNumber) : null;
    
    // Build base system prompt
    const baseSystemPrompt = `You are a virtual assistant for Clean Machine Auto Detail, a mobile auto detailing service in Tulsa, OK. 
        
        ${knowledgeBase}
        
        SCHEDULING CAPABILITIES:
        You have access to scheduling tools to help customers book appointments.
        
        CRITICAL: The customer's phone number is: ${phoneNumber}
        Always use this EXACT phone number when calling any function - never use placeholder text like "user's phone number".
        
        Available tools:
        - check_customer_database: Look up returning customers by phone to greet them personally
        - validate_address: Check if address is within service area (26-min radius)
        - get_available_slots: Fetch real appointment times from Google Calendar
        - get_upsell_offers: Get smart add-on recommendations based on the service they selected
        - build_booking_summary: Show appointment summary for confirmation
        - create_appointment: Book the appointment in Google Calendar
        - request_damage_photos: Request photos when customer mentions damage needing repair assessment
        - request_specialty_quote: Create specialty job quote request for unusual conditions requiring manual pricing
        
        DAMAGE ASSESSMENT SYSTEM:
        When a customer mentions vehicle damage that may need REPAIR (not just cleaning), call request_damage_photos.
        
        Damage keywords to watch for:
        - Paint issues: "scratch", "chip", "dent", "ding", "scrape", "gouge" on paint/clear coat
        - Upholstery damage: "tear", "rip", "hole", "burn" in seats/carpet/headliner
        - Stains: "won't come out", "set in", "permanent stain", specific damage stains
        - Other: "cracked", "broken", "damaged" (structural issues)
        
        DO NOT request photos for:
        - Normal dirt, dust, or grime (this is cleaning, not damage)
        - General messiness or clutter
        - Pet hair, food crumbs, or typical soiling
        - Water spots or light staining that's cleanable
        
        When you detect damage, call request_damage_photos, then continue with scheduling.
        Tell the customer: "I'd love to help with that! Can you text me a photo of the [damage] so I can assess it? Just send it back in this conversation. In the meantime, let's get you scheduled..."
        
        The appointment will be marked for damage assessment and the business owner will be alerted with the photos.
        
        SERVICES WE DON'T OFFER:
        If a customer requests any of these services, politely decline and explain:
        - Undercarriage washing
        - Semi truck or RV washing
        - Body work or car painting (beyond minor touch-ups)
        - Hot water engine degreasing
        
        Response template: "I appreciate you reaching out! Unfortunately, we don't currently offer [service]. We specialize in mobile detailing for cars, trucks, and motorcycles. Is there anything else I can help with?"
        
        SPECIALTY JOBS REQUIRING QUOTE:
        Watch for unusual conditions that require manual pricing review BEFORE booking:
        - Asphalt/tar removal: "asphalt", "tar", "oil coating", "sticky residue"
        - Extreme staining: "mold", "mildew", "biohazard", "extreme pet stains", "cigarette smoke saturation"
        - Unusual contaminants: "paint overspray", "tree sap everywhere", "chemical spills"
        
        When you detect specialty job keywords:
        1. DON'T proceed with normal booking workflow
        2. Explain this requires a custom quote: "This sounds like a specialty job that needs a custom quote. Let me get some details..."
        3. Request photos: "Can you text me 3-4 photos showing the affected areas? This will help me provide an accurate quote."
        4. Collect: customer name, detailed description, third-party payer info if paying (name, email, phone, PO number)
        5. Once photos are uploaded, call request_specialty_quote with all collected info including photo URLs
        6. Tell customer: "Thanks! I've sent this to the owner for review. You'll receive a custom quote within 24 hours via text. Once you approve, we'll get you scheduled!"
        
        IMPORTANT: Photos are uploaded separately by customer. When they upload, you'll receive the photo URLs in the conversation context. Include these URLs when calling request_specialty_quote.
        
        SELLING VEHICLE / LEASE RETURN CONTEXT:
        Detect when customer mentions selling/trading/leasing context with keywords:
        - "selling my car", "trade-in", "listing", "putting it up for sale", "private sale"
        - "lease return", "end of lease", "turning in lease", "lease buyout"
        
        When detected, activate special upsell strategy:
        1. Prioritize VISUAL UPGRADES over protection services:
           - Paint correction / quick polish (makes car shine)
           - Headlight restoration (eliminates haze, looks newer)
           - Trim restoration (black plastic looks new again)
           - Wheel detailing (curb rash touch-ups if available)
        
        2. Use sale-focused messaging:
           - "First impressions matter - buyers judge in seconds"
           - "Clean cars sell faster and command higher prices"
           - "Avoid price negotiations over appearance issues"
           - "Show you maintained it well - builds buyer confidence"
           - For lease: "Avoid wear-and-tear charges with a thorough detail"
        
        3. De-prioritize protection services (ceramic, sealants) since they won't own the vehicle long
        
        4. Suggest timing: "Book 1-2 days before listing photos or showing to buyers for maximum impact"
        
        BOOKING WORKFLOW:
        When customer wants to book:
        1. Check customer database first using their phone: ${phoneNumber}
        2. Ask for their service preference
        3. Get their address and validate it using their phone: ${phoneNumber}
        4. Show available time slots using their phone: ${phoneNumber}
        5. Get smart upsell offers using their phone: ${phoneNumber} - these are personalized add-on recommendations
        6. Show booking summary for confirmation using their phone: ${phoneNumber}
        7. Create appointment when they confirm using their phone: ${phoneNumber}
        
        IMPORTANT RULES FOR ADD-ONS/UPSELLS:
        - When you call get_upsell_offers, you'll receive SMART recommendations specifically chosen for their service
        - Present these as helpful suggestions with proper formatting
        - USE THE EXACT NAME from the add-on data - DO NOT shorten or paraphrase (e.g., say "Headlight Restoration" not "lens restoration")
        - Explain WHY each add-on makes sense (e.g., "Since you're getting an Interior Detail, I'd recommend our Fabric Protector to keep those seats looking fresh longer")
        - FORMATTING: Use double line breaks between each add-on for readability (use \\n\\n not \\n)
        - STRUCTURE: For each add-on, format as: "• [EXACT NAME] ([PRICE]) - Brief explanation"
        - Be specific and helpful, not generic
        - If you get no recommendations, that's okay - don't force it
        
        Use the tools naturally - don't announce you're calling functions, just use them to help customers seamlessly.
        ${stateContext}
        
        Rules:
        1. Keep responses concise, friendly, and professional
        2. If you don't know something, say so rather than making up information
        3. The customer is contacting you via ${platform === "sms" ? "SMS" : "web chat"}${platform === "sms" ? " - you automatically have their phone number (it's the number they're texting from). NEVER ask for their phone number - immediately use check_customer_database to see if they're a returning customer." : ""}
        4. Always respond with grammatically correct full sentences and proper punctuation
        5. Do not refer to yourself by name or as Jody
        6. Represent Clean Machine Auto Detail in a professional manner
        7. When booking, guide customers through the process naturally without being robotic
        8. CRITICAL: Review the conversation history below and remember what the customer has already told you. NEVER ask for information they've already provided.
        
        ${maintenanceDetailInstructions}
        ${behaviorInstructions ? `\nBehavior Adjustments:${behaviorInstructions}` : ''}`;
    
    // Apply customer personalization to system prompt (Phase 1)
    const personalizedSystemPrompt = buildPersonalizedSystemPrompt(baseSystemPrompt, customerContext);
    
    // Build conversation messages with history
    let systemPromptWithDemoMode = personalizedSystemPrompt;
    
    // Add demo mode constraints to system prompt
    if (isDemoMode) {
      systemPromptWithDemoMode += `\n\nDEMO MODE ACTIVE:
      - You are assisting with auto detailing services demonstration
      - Keep responses focused on car detailing topics only
      - Do not schedule real appointments or access real customer data
      - All operations are simulated for demonstration purposes`;
    }
    
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: systemPromptWithDemoMode
      }
    ];

    // Add conversation history if available (exclude the current message which will be added separately)
    if (conversationHistory && conversationHistory.length > 0) {
      for (const msg of conversationHistory) {
        if (msg.sender === 'customer') {
          messages.push({ role: "user", content: msg.content });
        } else if (msg.sender === 'ai') {
          messages.push({ role: "assistant", content: msg.content });
        }
      }
    }
    
    // Add current user message
    messages.push({ role: "user", content: userMessage });
    
    // Iterative function calling loop
    let currentMessages = [...messages];
    const MAX_ITERATIONS = 10; // Prevent infinite loops
    let iterations = 0;
    
    while (iterations < MAX_ITERATIONS) {
      iterations++;
      
      // Use demo rate limiter if in demo mode
      const makeOpenAICall = async () => {
        return await openai.chat.completions.create({
          model: SMS_AGENT_MODEL,
          messages: currentMessages,
          tools: SCHEDULING_FUNCTIONS,
          tool_choice: "auto",
          max_completion_tokens: 500, // GPT-5.1 uses max_completion_tokens
        });
      };
      
      const completion = isDemoMode 
        ? await demoAILimiter.schedule(() => makeOpenAICall())
        : await makeOpenAICall();
      
      // Log demo AI usage
      if (isDemoMode) {
        demoAIUsageCount++;
        console.log(`[DEMO AI] Request #${demoAIUsageCount} | Phone: ${phoneNumber} | Platform: ${platform}`);
      }
      
      // Log usage for tracking dashboard
      try {
        const { logApiUsage } = await import('./usageTracker');
        const inputTokens = completion.usage?.prompt_tokens || 0;
        const outputTokens = completion.usage?.completion_tokens || 0;
        const totalCost = (inputTokens / 1000000) * 2.50 + (outputTokens / 1000000) * 10.00;
        
        await logApiUsage(
          'openai',
          'tokens',
          inputTokens + outputTokens,
          totalCost,
          {
            model: SMS_AGENT_MODEL,
            input_tokens: inputTokens,
            output_tokens: outputTokens,
          }
        );
      } catch (err) {
        console.error('[OPENAI USAGE LOG] Error:', err);
      }
      
      const responseMessage = completion.choices[0].message;
      currentMessages.push(responseMessage);
      
      // If no tool calls, we have final response
      if (!responseMessage.tool_calls || responseMessage.tool_calls.length === 0) {
        let finalResponse = responseMessage.content || "I apologize, but I didn't generate a proper response. Please try again.";
        
        // Only append maintenance detail recommendation if not in booking flow
        if (offerMaintenanceDetail && !needsDeeperCleaning && 
            !state?.service &&
            !finalResponse.toLowerCase().includes("maintenance detail") && 
            !finalResponse.toLowerCase().includes("regular upkeep")) {
          const recommendation = getMaintenanceDetailRecommendation(isRepeatCustomer);
          finalResponse += "\n\n" + recommendation;
        }
        
        return finalResponse;
      }
      
      // Execute function calls
      for (const toolCall of responseMessage.tool_calls) {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);
        
        console.log(`[AI FUNCTION CALL] ${functionName}(${JSON.stringify(functionArgs)})`);
        
        const functionResult = await executeFunctionCall(functionName, functionArgs);
        
        currentMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: functionResult
        });
      }
    }
    
    // If we hit max iterations, return last AI response
    console.warn("[AI] Hit maximum function call iterations");
    return "I'm working on helping you with your request. Please let me know if you need anything else!";
    
  } catch (error) {
    console.error("Error generating AI response:", error);
    return "I'm sorry, I'm having trouble processing your request right now. Please try again in a moment.";
  }
}

/**
 * Analyze sentiment of a customer message
 */
export async function analyzeSentiment(text: string): Promise<{
  rating: number,
  confidence: number
}> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are a sentiment analysis expert. Analyze the sentiment of the text and provide a rating from 1 to 5 stars and a confidence score between 0 and 1. Respond with JSON in this format: { 'rating': number, 'confidence': number }",
        },
        {
          role: "user",
          content: text,
        },
      ],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content);

    return {
      rating: Math.max(1, Math.min(5, Math.round(result.rating))),
      confidence: Math.max(0, Math.min(1, result.confidence)),
    };
  } catch (error) {
    console.error("Failed to analyze sentiment:", error);
    return {
      rating: 3,
      confidence: 0.5
    };
  }
}

/**
 * Detect service requests in customer messages
 */
export async function detectServiceRequest(text: string): Promise<{
  isServiceRequest: boolean;
  requestedService?: string;
  confidence: number;
}> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an auto detailing service request analyzer. Determine if the text contains a request for a service.
          Services include: Full Detail, Interior Only, Exterior Only, Express Wash, Engine Detail, Headlight Restoration, Paint Correction, Ceramic Coating
          
          If it is a service request, identify which service they're requesting.
          Respond with JSON in this format: 
          { 
            "isServiceRequest": boolean, 
            "requestedService": string or null,
            "confidence": number between 0 and 1
          }`,
        },
        {
          role: "user",
          content: text,
        },
      ],
      response_format: { type: "json_object" },
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error("Failed to detect service request:", error);
    return {
      isServiceRequest: false,
      confidence: 0
    };
  }
}

/**
 * Extract vehicle information from customer messages
 */
export async function extractVehicleInfo(text: string): Promise<{
  hasVehicleInfo: boolean;
  make?: string;
  model?: string;
  year?: string;
  color?: string;
  confidence: number;
}> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a vehicle information extractor. Extract any vehicle details from the text.
          
          Respond with JSON in this format: 
          { 
            "hasVehicleInfo": boolean, 
            "make": string or null,
            "model": string or null,
            "year": string or null,
            "color": string or null,
            "confidence": number between 0 and 1
          }`,
        },
        {
          role: "user",
          content: text,
        },
      ],
      response_format: { type: "json_object" },
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error("Failed to extract vehicle info:", error);
    return {
      hasVehicleInfo: false,
      confidence: 0
    };
  }
}