import { Router, Request, Response } from 'express';
import OpenAI from 'openai';
import { db } from './db';
import { orgSettings, auditLog } from '@shared/schema';
import { eq } from 'drizzle-orm';
import rateLimit from 'express-rate-limit';
import { requireRole } from './rbacMiddleware';

const router = Router();

// Initialize OpenAI client with Replit AI Integrations
const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

// System prompt for Bio Coach
const BIO_COACH_SYSTEM_PROMPT = `You are the Bio Coach for a mobile auto detailing service. Your goal is to help technicians create brief, trust-building bios that will be sent via SMS to customers.

CONTEXT: This bio introduces a stranger who will be coming to the customer's home. It must elicit comfort, safety, and trust in a very limited space.

REQUIREMENTS:
- One sentence, ≤140 characters (SMS-friendly)
- Use first name only
- Warm, personable tone that makes customers feel at ease
- Highlight trustworthiness and professionalism
- Avoid jargon, technical terms, or corporate speak
- NO personal contact info, addresses, or sensitive details
- Focus on building emotional connection and reassurance

GOAL: Make the customer think "This person sounds nice and trustworthy - I feel good about them coming to my home."

Examples of good bios:
- "Mike's a detail-obsessed dad of two who treats every car like his own and loves making customers smile."
- "Sarah brings 8 years of detailing expertise and a genuine passion for helping busy families keep their vehicles pristine."
- "James is a Navy veteran who takes pride in meticulous work and always leaves customers impressed."

Suggest up to two short trust-building tags (e.g., "Family-Friendly", "Military Veteran", "Detail-Obsessed", "Customer Favorite").

You must respond ONLY with valid JSON in this exact format:
{
  "bio_about": "string (<=140 chars, 1 sentence)",
  "tags": ["tag1", "tag2"]
}

Do not include any other text, explanations, or markdown formatting. Just the JSON object.`;

// Rate limiter for AI requests (10 per minute per IP)
const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: 'Too many AI requests, please try again in a minute',
  standardHeaders: true,
  legacyHeaders: false,
});

// Moderation helpers
const PII_PATTERNS = [
  /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, // Phone numbers
  /\b[\w\.-]+@[\w\.-]+\.\w{2,4}\b/g, // Email addresses
  /\b\d{1,5}\s+[\w\s]+(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|way|court|ct)\b/gi, // Street addresses
  /\b\d{5}(?:-\d{4})?\b/g, // ZIP codes
];

const PROFANITY_PATTERNS = [
  // Add common profanity patterns here - keeping it simple for now
  /\b(fuck|shit|damn|bitch|ass|crap|hell)\b/gi,
];

function moderate(text: string): string[] {
  const issues: string[] = [];

  // Check for PII
  for (const pattern of PII_PATTERNS) {
    if (pattern.test(text)) {
      issues.push('Contains personal information (phone, email, or address)');
      break;
    }
  }

  // Check for profanity
  for (const pattern of PROFANITY_PATTERNS) {
    if (pattern.test(text)) {
      issues.push('Contains inappropriate language');
      break;
    }
  }

  return issues;
}

function truncateToSentence(text: string, maxLength: number = 140): string {
  if (text.length <= maxLength) {
    return text;
  }

  // Find the last sentence end before maxLength
  const truncated = text.substring(0, maxLength);
  const lastPeriod = truncated.lastIndexOf('.');
  const lastExclamation = truncated.lastIndexOf('!');
  const lastQuestion = truncated.lastIndexOf('?');
  
  const lastSentenceEnd = Math.max(lastPeriod, lastExclamation, lastQuestion);
  
  if (lastSentenceEnd > 0) {
    return text.substring(0, lastSentenceEnd + 1);
  }
  
  // If no sentence end found, just truncate at max length
  return truncated + '...';
}

function safeParseJson(text: string): any {
  try {
    // Try to parse directly first
    return JSON.parse(text);
  } catch (e) {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1]);
      } catch (e2) {
        // Fallback: try to find any JSON object in the text
        const objectMatch = text.match(/\{[\s\S]*\}/);
        if (objectMatch) {
          return JSON.parse(objectMatch[0]);
        }
      }
    }
  }
  
  throw new Error('Could not parse JSON from response');
}

// AI Bio Suggest endpoint (All authenticated users)
router.post('/api/ai/bio/suggest', requireRole('employee', 'manager', 'owner'), aiRateLimiter, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Check if AI Bio Coach is enabled
    const aiEnabledSetting = await db.query.orgSettings.findFirst({
      where: (orgSettings, { eq }) => eq(orgSettings.settingKey, 'ai_bio_coach_enabled'),
    });

    const settingValue = aiEnabledSetting?.settingValue as any;
    const isAiEnabled = settingValue === true || settingValue?.enabled === true;
    if (!isAiEnabled) {
      return res.status(403).json({ error: 'AI Bio Coach is disabled' });
    }

    const { preferred_name, city, bio_raw, tags = [], service_context = 'mobile auto detailing' } = req.body;

    // Basic validation
    if (!preferred_name || !bio_raw) {
      return res.status(400).json({ error: 'preferred_name and bio_raw are required' });
    }

    // Get bio policy settings
    const bioPolicySetting = await db.query.orgSettings.findFirst({
      where: (orgSettings, { eq }) => eq(orgSettings.settingKey, 'bio_policy'),
    });

    const bioPolicy = (bioPolicySetting?.settingValue as any) || {
      maxChars: 140,
      disallow: ['addresses', 'emails', 'phone_numbers'],
      tone: 'warm, trustworthy, safety-forward',
    };

    // Build user message
    const userMessage = JSON.stringify({
      preferred_name,
      city,
      bio_raw,
      existing_tags: tags,
      service_context,
      max_length: bioPolicy.maxChars || 140,
    });

    console.log('[AI BIO COACH] Generating suggestion for:', { preferred_name, city });

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_BIO_MODEL || 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: BIO_COACH_SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.6,
      response_format: { type: 'json_object' },
    });

    const aiResponse = completion.choices[0]?.message?.content;
    if (!aiResponse) {
      throw new Error('No response from AI');
    }

    // Parse JSON response
    let result;
    try {
      result = safeParseJson(aiResponse);
    } catch (e) {
      console.error('[AI BIO COACH] Failed to parse JSON:', aiResponse);
      return res.status(500).json({ 
        error: 'AI returned invalid format. Please try again.',
        details: 'Could not parse AI response as JSON',
      });
    }

    // Ensure we have the required fields
    if (!result.bio_about) {
      return res.status(500).json({ error: 'AI response missing bio_about field' });
    }

    // Truncate bio to max length
    result.bio_about = truncateToSentence(result.bio_about, bioPolicy.maxChars || 140);

    // Ensure tags is an array and limit to 2
    if (!Array.isArray(result.tags)) {
      result.tags = [];
    }
    result.tags = result.tags.slice(0, 2);

    // Moderate the bio
    const issues = moderate(result.bio_about);
    if (issues.length > 0) {
      return res.status(422).json({ 
        error: 'needs_changes', 
        issues,
        suggestion: result, // Still return the suggestion so user can see what was flagged
      });
    }

    // Log audit event
    await db.insert(auditLog).values({
      userId: user.id,
      actionType: 'ai_suggest',
      entityType: 'technician_bio',
      details: {
        input: { preferred_name, city, bio_raw },
        output: result,
        model: process.env.OPENAI_BIO_MODEL || 'gpt-4.1-mini',
      },
    });

    console.log('[AI BIO COACH] Suggestion generated successfully:', { preferred_name, length: result.bio_about.length });

    res.json(result);
  } catch (error: any) {
    console.error('[AI BIO COACH] Error generating suggestion:', error);
    
    // Handle rate limit errors
    if (error.status === 429) {
      return res.status(429).json({ error: 'AI service is temporarily unavailable. Please try again in a moment.' });
    }
    
    res.status(500).json({ 
      error: error.message || 'Failed to generate bio suggestion',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

export default router;
