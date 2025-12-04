import OpenAI from 'openai';

// Graceful handling of missing API key - voicemail analysis degrades to fallback
const OPENAI_ENABLED = !!process.env.OPENAI_API_KEY;
let openai: OpenAI | null = null;

try {
  if (OPENAI_ENABLED) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
} catch (error) {
  console.warn('[VOICEMAIL AI] Failed to initialize OpenAI client:', error);
  openai = null;
}

if (!OPENAI_ENABLED) {
  console.warn('[VOICEMAIL AI] OpenAI API key not configured - voicemail AI analysis disabled, using fallback');
}

export interface VoicemailAnalysis {
  summary: string;
  priority: 'HIGH' | 'NORMAL';
}

export async function analyzeVoicemail(
  transcription: string,
  callerPhone: string,
  duration?: number,
  businessName: string = 'Clean Machine Auto Detail'
): Promise<VoicemailAnalysis> {
  if (!transcription || transcription.trim().length === 0) {
    return {
      summary: 'Empty voicemail',
      priority: 'NORMAL',
    };
  }

  // Fallback if OpenAI is not available
  if (!openai) {
    console.log('[VOICEMAIL AI] OpenAI not available, using fallback analysis');
    const lowerTranscription = transcription.toLowerCase();
    
    // Simple keyword-based priority detection as fallback
    const urgentKeywords = ['urgent', 'asap', 'emergency', 'immediately', 'today', 'problem', 'issue', 'complaint', 'frustrated', 'upset', 'wrong', 'mistake', 'trying to reach'];
    const isHighPriority = urgentKeywords.some(keyword => lowerTranscription.includes(keyword));
    
    return {
      summary: transcription.substring(0, 100) + (transcription.length > 100 ? '...' : ''),
      priority: isHighPriority ? 'HIGH' : 'NORMAL',
    };
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are an AI assistant for ${businessName}, a mobile auto detailing business in Tulsa, OK.

Analyze voicemail transcriptions and return a JSON object with:
1. "summary": A brief, customer-friendly 1-2 sentence summary of what the caller wants
2. "priority": Either "HIGH" or "NORMAL"

Mark as HIGH priority if the caller:
- Mentions urgency, emergency, or time-sensitive requests
- Sounds upset, frustrated, or is making a complaint
- Is asking about an existing appointment/booking issue
- Mentions a problem with a previous service
- Uses words like "urgent", "ASAP", "immediately", "today", "problem", "issue", "complaint"
- Mentions they've been trying to reach someone
- Is a returning customer with an issue

Mark as NORMAL for:
- General pricing inquiries
- New appointment requests
- Questions about services
- Happy/neutral tone general inquiries

Always respond with valid JSON like: {"summary": "...", "priority": "HIGH" or "NORMAL"}`
        },
        {
          role: 'user',
          content: `Voicemail from ${callerPhone}${duration ? ` (${duration} seconds)` : ''}:

"${transcription}"

Analyze this voicemail and return JSON with summary and priority.`
        }
      ],
      temperature: 0.3,
      max_tokens: 200,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.warn('[VOICEMAIL AI] No content in OpenAI response');
      return {
        summary: transcription.substring(0, 100) + (transcription.length > 100 ? '...' : ''),
        priority: 'NORMAL',
      };
    }

    const parsed = JSON.parse(content);
    
    const summary = typeof parsed.summary === 'string' ? parsed.summary : transcription.substring(0, 100);
    const priority = parsed.priority === 'HIGH' ? 'HIGH' : 'NORMAL';

    console.log(`[VOICEMAIL AI] Analysis complete - Priority: ${priority}, Summary: "${summary.substring(0, 50)}..."`);

    return { summary, priority };
  } catch (error) {
    console.error('[VOICEMAIL AI] Error analyzing voicemail:', error);
    
    return {
      summary: transcription.substring(0, 100) + (transcription.length > 100 ? '...' : ''),
      priority: 'NORMAL',
    };
  }
}
