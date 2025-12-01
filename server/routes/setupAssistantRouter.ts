/**
 * Phase 12 - Setup & Support Copilot API Router
 * 
 * Provides an AI-powered setup assistant for business owners/admins.
 * Uses Agent Context + Tenant Readiness to give contextual guidance.
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../authMiddleware';
import { buildAgentContext } from '../services/agentContextService';
import { getTenantReadinessReportById } from '../services/tenantReadinessService';
import OpenAI from 'openai';

const router = Router();

const OPENAI_ENABLED = !!process.env.OPENAI_API_KEY;
const openai = OPENAI_ENABLED ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY! }) : null;

const SETUP_COPILOT_MODEL = process.env.SETUP_COPILOT_MODEL ?? 'gpt-4o';

interface SetupAssistantMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface SetupAssistantRequest {
  messages: SetupAssistantMessage[];
  scope?: 'telephony' | 'email' | 'website' | 'all';
}

function buildSystemPrompt(
  agentContext: any,
  readinessReport: any,
  scope: string
): string {
  const gapCount = agentContext.gaps?.length ?? 0;
  const overallStatus = readinessReport?.overallStatus ?? 'unknown';
  
  const readinessSummary = readinessReport?.categories?.map((cat: any) => {
    const passCount = cat.items?.filter((i: any) => i.status === 'pass').length ?? 0;
    const warnCount = cat.items?.filter((i: any) => i.status === 'warn').length ?? 0;
    const failCount = cat.items?.filter((i: any) => i.status === 'fail').length ?? 0;
    return `${cat.label}: ${passCount} pass, ${warnCount} warn, ${failCount} fail`;
  }).join('\n') ?? 'No readiness data available';

  const contextSummary = {
    tenantName: agentContext.tenant?.branding?.displayName ?? 'Unknown',
    planTier: agentContext.tenant?.planKey ?? 'free',
    industry: agentContext.tenant?.industryKey ?? 'not set',
    subdomain: agentContext.tenant?.subdomain ?? 'not configured',
    telephonyStatus: agentContext.telephony?.status ?? 'not_configured',
    phoneNumber: agentContext.telephony?.phoneNumbers?.[0]?.phoneNumber ?? 'none',
    emailStatus: agentContext.email?.status ?? 'not_configured',
    websiteStatus: agentContext.website?.status ?? 'not_configured',
    enabledFeatures: agentContext.features?.enabledFeatures?.length ?? 0,
    disabledFeatures: agentContext.features?.disabledFeatures?.length ?? 0,
  };

  return `You are the **ServicePro Setup & Support Copilot**.

## Your Role
You are an expert assistant helping business owners and admins configure their ServicePro account. You provide step-by-step guidance for setting up telephony (Twilio), email (SendGrid), website/booking pages, branding, and integrations.

## Current Tenant Context
- **Business Name**: ${contextSummary.tenantName}
- **Plan Tier**: ${contextSummary.planTier}
- **Industry**: ${contextSummary.industry}
- **Subdomain**: ${contextSummary.subdomain}
- **Telephony Status**: ${contextSummary.telephonyStatus}
- **Phone Number**: ${contextSummary.phoneNumber}
- **Email Status**: ${contextSummary.emailStatus}
- **Website Status**: ${contextSummary.websiteStatus}
- **Enabled Features**: ${contextSummary.enabledFeatures}
- **Disabled Features**: ${contextSummary.disabledFeatures}

## Readiness Overview (${overallStatus})
${readinessSummary}

## Configuration Gaps (${gapCount} items)
${agentContext.gaps?.map((g: any) => `- [${g.severity}] ${g.area}: ${g.message}`).join('\n') || 'No gaps detected'}

## Your Guidelines
1. **Be specific and actionable**: Give clear, numbered steps when explaining how to do something.
2. **Use the context above**: Reference the current configuration state when giving advice.
3. **External actions**: When an action must be done outside ServicePro (e.g., Twilio Console, DNS settings, SendGrid), explain the steps clearly but never claim ServicePro can do those actions directly.
4. **Never expose secrets**: Do not reveal API keys, tokens, or sensitive IDs.
5. **Future features**: If a requested feature doesn't exist yet in ServicePro, say "This feature is planned for a future update."
6. **Stay focused**: You help with ServicePro setup, configuration, and troubleshooting. Redirect off-topic questions politely.
7. **Be encouraging**: Celebrate progress and provide positive reinforcement when things are configured correctly.

## Scope
${scope === 'all' ? 'Answer questions about any ServicePro feature.' : `Focus primarily on ${scope} configuration and troubleshooting.`}

Now respond to the user's message helpfully and concisely.`;
}

/**
 * POST /api/ai/setup-assistant
 * 
 * Main endpoint for the Setup & Support Copilot.
 * Accepts conversation history and returns an AI response.
 */
router.post('/setup-assistant', requireAuth, async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenant?.id;
    const tenantDb = req.tenantDb;
    
    if (!tenantId || !tenantDb) {
      return res.status(400).json({
        ok: false,
        message: 'Tenant context not available. Please log in again.',
      });
    }

    if (!openai) {
      return res.status(503).json({
        ok: false,
        message: 'AI service is not configured. Please contact support.',
      });
    }

    const body = req.body as SetupAssistantRequest;
    const { messages, scope = 'all' } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        ok: false,
        message: 'Please provide at least one message.',
      });
    }

    const agentContext = await buildAgentContext({ tenantId, tenantDb });
    
    let readinessReport = null;
    try {
      readinessReport = await getTenantReadinessReportById(tenantId);
    } catch (err) {
      console.warn('[SETUP COPILOT] Could not fetch readiness report:', err);
    }

    const systemPrompt = buildSystemPrompt(agentContext, readinessReport, scope);

    const openaiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    console.log('[SETUP COPILOT] Generating response for tenant:', tenantId, {
      messageCount: messages.length,
      scope,
      gapCount: agentContext.gaps?.length ?? 0,
    });

    const response = await openai.chat.completions.create({
      model: SETUP_COPILOT_MODEL,
      messages: openaiMessages,
      max_completion_tokens: 1000,
      temperature: 0.7,
    });

    const reply = response.choices?.[0]?.message?.content?.trim() ?? 
      "I'm sorry, I couldn't generate a response. Please try again.";

    const gapCount = agentContext.gaps?.length ?? 0;
    const overallStatus = readinessReport?.overallStatus ?? 'unknown';

    return res.json({
      ok: true,
      reply,
      debug: {
        overallStatus,
        gapCount,
      },
    });

  } catch (error: any) {
    console.error('[SETUP COPILOT] Error:', error);
    return res.status(500).json({
      ok: false,
      message: error.message || 'An unexpected error occurred.',
    });
  }
});

/**
 * GET /api/ai/setup-assistant/context
 * 
 * Returns the current context snapshot for the Setup Copilot UI.
 * This includes agent context and readiness summary.
 */
router.get('/setup-assistant/context', requireAuth, async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenant?.id;
    const tenantDb = req.tenantDb;
    
    if (!tenantId || !tenantDb) {
      return res.status(400).json({
        ok: false,
        message: 'Tenant context not available.',
      });
    }

    const agentContext = await buildAgentContext({ tenantId, tenantDb });
    
    let readinessReport = null;
    try {
      readinessReport = await getTenantReadinessReportById(tenantId);
    } catch (err) {
      console.warn('[SETUP COPILOT] Could not fetch readiness report:', err);
    }

    const summary = {
      tenantName: agentContext.tenant?.branding?.displayName ?? 'Unknown',
      subdomain: agentContext.tenant?.subdomain ?? null,
      planTier: agentContext.tenant?.planKey ?? 'free',
      overallStatus: readinessReport?.overallStatus ?? 'unknown',
      categories: readinessReport?.categories?.map((cat: any) => ({
        id: cat.id,
        label: cat.label,
        passCount: cat.items?.filter((i: any) => i.status === 'pass').length ?? 0,
        warnCount: cat.items?.filter((i: any) => i.status === 'warn').length ?? 0,
        failCount: cat.items?.filter((i: any) => i.status === 'fail').length ?? 0,
      })) ?? [],
      telephony: {
        status: agentContext.telephony?.status ?? 'not_configured',
        phoneNumber: agentContext.telephony?.phoneNumbers?.[0]?.phoneNumber ?? null,
      },
      email: {
        status: agentContext.email?.status ?? 'not_configured',
      },
      website: {
        status: agentContext.website?.status ?? 'not_configured',
        publicUrl: agentContext.website?.publicUrl ?? null,
      },
      gapCount: agentContext.gaps?.length ?? 0,
    };

    return res.json({
      ok: true,
      context: summary,
    });

  } catch (error: any) {
    console.error('[SETUP COPILOT] Error fetching context:', error);
    return res.status(500).json({
      ok: false,
      message: error.message || 'Failed to fetch context.',
    });
  }
});

export default router;

// Example usage:
// curl -X POST http://localhost:5000/api/ai/setup-assistant \
//   -H "Content-Type: application/json" \
//   -H "Cookie: <session-cookie>" \
//   -d '{"messages":[{"role":"user","content":"Help me configure telephony"}]}'
