/**
 * Support Assistant Service
 * 
 * AI-powered support assistant using OpenAI.
 * Provides helpful answers about ServicePro setup and configuration.
 */

import OpenAI from "openai";
import { getSupportContextForTenantUser, formatContextForPrompt, type SupportContext } from "./supportContextService";
import { supportKbService } from "./supportKbService";

const OPENAI_ENABLED = !!(process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY);

const openai = OPENAI_ENABLED
  ? new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    })
  : null;

if (!OPENAI_ENABLED) {
  console.warn("[SUPPORT ASSISTANT] OpenAI API key not configured - AI assistant will be disabled");
}

export interface SupportAssistantReply {
  replyText: string;
  usedArticles: Array<{
    slug: string;
    title: string;
    scope: string;
    category: string;
  }>;
  meta: {
    model: string;
    createdAt: string;
  };
}

interface AssistantOptions {
  tenantId: string;
  userId: number;
  userMessage: string;
  currentRoute?: string;
  topicHint?: string;
}

const SYSTEM_PROMPT = `You are the ServicePro Setup & Support Assistant.
You help service-business owners configure their ServicePro account, connect phone/SMS and email, understand A2P compliance, and use the app effectively.

You have access to:
- The tenant and user context (plan, features, telephony/email status)
- A small internal knowledge base with product and integration docs

Rules:
1. Explain in simple, friendly language
2. Prefer step-by-step instructions when appropriate
3. If something clearly requires a human or is dangerous (like DNS changes, billing disputes, or destructive data changes), explain what they should do and suggest contacting support rather than pretending you can perform it
4. Never invent specific secrets, API keys, or panel URLs. Use generic guidance like "Go to your Twilio Console" or "Go to your DNS provider dashboard"
5. If you're not sure about something, say so and propose next steps or suggest contacting support
6. Keep responses concise but helpful - aim for clarity over length
7. When referencing features, check if they're enabled for the tenant's plan
8. For A2P/SMS questions, emphasize compliance and proper setup steps`;

/**
 * Extract simple keywords from user message for KB search
 */
function extractKeywords(message: string): string[] {
  const stopWords = new Set([
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "must", "shall", "can", "need", "dare",
    "to", "of", "in", "for", "on", "with", "at", "by", "from", "as",
    "into", "through", "during", "before", "after", "above", "below",
    "between", "under", "again", "further", "then", "once", "here",
    "there", "when", "where", "why", "how", "all", "each", "few",
    "more", "most", "other", "some", "such", "no", "nor", "not",
    "only", "own", "same", "so", "than", "too", "very", "just",
    "i", "me", "my", "myself", "we", "our", "ours", "ourselves",
    "you", "your", "yours", "yourself", "yourselves", "he", "him",
    "his", "himself", "she", "her", "hers", "herself", "it", "its",
    "itself", "they", "them", "their", "theirs", "themselves",
    "what", "which", "who", "whom", "this", "that", "these", "those",
    "am", "and", "but", "if", "or", "because", "until", "while"
  ]);

  return message
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(word => word.length >= 3 && !stopWords.has(word))
    .slice(0, 5);
}

/**
 * Find relevant KB articles based on topic hint or message keywords
 */
async function findRelevantArticles(
  userMessage: string,
  topicHint?: string
): Promise<Array<{ slug: string; title: string; scope: string; category: string; summary: string }>> {
  try {
    // Get all public articles (limited set)
    const allArticles = await supportKbService.listArticles({
      limit: 20,
      publicOnly: true,
    });

    if (allArticles.length === 0) {
      return [];
    }

    // If we have a topic hint, prioritize matching articles
    if (topicHint) {
      const hintLower = topicHint.toLowerCase();
      const matched = allArticles.filter(
        a =>
          a.title.toLowerCase().includes(hintLower) ||
          a.category.toLowerCase().includes(hintLower) ||
          a.scope.toLowerCase().includes(hintLower)
      );
      if (matched.length > 0) {
        return matched.slice(0, 3);
      }
    }

    // Extract keywords from user message
    const keywords = extractKeywords(userMessage);
    
    if (keywords.length === 0) {
      // Return first 2 general articles as fallback
      return allArticles.slice(0, 2);
    }

    // Score articles by keyword matches
    const scored = allArticles.map(article => {
      const searchText = `${article.title} ${article.category} ${article.summary}`.toLowerCase();
      const score = keywords.reduce((acc, keyword) => {
        return acc + (searchText.includes(keyword) ? 1 : 0);
      }, 0);
      return { article, score };
    });

    // Sort by score descending and take top 3
    const topArticles = scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(s => s.article);

    // If no matches, return first 2 general articles
    return topArticles.length > 0 ? topArticles : allArticles.slice(0, 2);
  } catch (error) {
    console.error("[SUPPORT ASSISTANT] Error fetching KB articles:", error);
    return [];
  }
}

/**
 * Format KB articles for the prompt
 */
function formatArticlesForPrompt(
  articles: Array<{ slug: string; title: string; scope: string; category: string; summary: string }>
): string {
  if (articles.length === 0) {
    return "Knowledge Articles:\n- (No relevant articles found)";
  }

  const formatted = articles
    .map((a, i) => `${i + 1}) ${a.title} [${a.scope}/${a.category}]\n   Summary: ${a.summary}`)
    .join("\n\n");

  return `Knowledge Articles:\n${formatted}`;
}

/**
 * Get a support assistant reply for a user message
 */
export async function getSupportAssistantReply(
  options: AssistantOptions
): Promise<SupportAssistantReply> {
  const { tenantId, userId, userMessage, currentRoute, topicHint } = options;

  // Default response if OpenAI is unavailable
  if (!openai) {
    console.log("[SUPPORT ASSISTANT] OpenAI not available, returning fallback response");
    return {
      replyText:
        "I'm sorry, the AI assistant is currently unavailable. Please try again later or open a support ticket for help with your question.",
      usedArticles: [],
      meta: {
        model: "fallback",
        createdAt: new Date().toISOString(),
      },
    };
  }

  try {
    // 1) Load tenant/user context
    const context = await getSupportContextForTenantUser(tenantId, userId);
    const contextText = formatContextForPrompt(context);

    // 2) Find relevant KB articles
    const articles = await findRelevantArticles(userMessage, topicHint);
    const articlesText = formatArticlesForPrompt(articles);

    // 3) Build user prompt
    const routeInfo = currentRoute ? `\nThe user is currently on route: ${currentRoute}` : "";
    
    const userPrompt = `${contextText}

${articlesText}
${routeInfo}

[USER QUESTION]
${userMessage}`;

    // 4) Call OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 800,
    });

    const replyText =
      response.choices[0]?.message?.content?.trim() ||
      "I apologize, but I wasn't able to generate a helpful response. Please try rephrasing your question or open a support ticket for assistance.";

    // Log for debugging (truncated)
    console.log("[SUPPORT ASSISTANT] Generated reply:", {
      tenantId,
      userId,
      messagePreview: userMessage.substring(0, 100),
      replyLength: replyText.length,
      articlesUsed: articles.length,
    });

    return {
      replyText,
      usedArticles: articles.map(a => ({
        slug: a.slug,
        title: a.title,
        scope: a.scope,
        category: a.category,
      })),
      meta: {
        model: response.model || "gpt-4o",
        createdAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error("[SUPPORT ASSISTANT] Error generating reply:", error);
    
    // Return a safe fallback
    return {
      replyText:
        "I encountered an issue while processing your question. Please try again in a moment, or open a support ticket if the problem persists.",
      usedArticles: [],
      meta: {
        model: "error-fallback",
        createdAt: new Date().toISOString(),
      },
    };
  }
}
