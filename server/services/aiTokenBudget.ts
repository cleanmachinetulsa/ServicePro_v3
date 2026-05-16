/**
 * AI Token Budget Guard (Audit T1 S-10 / W-1)
 *
 * Enforces a per-tenant daily AI token budget using the existing
 * usage_rollups_daily ledger. Behavior:
 *   - <80% of budget  → use the configured base model
 *   - >=80%           → silently downgrade to gpt-4o-mini
 *   - >=100%          → short-circuit with canned reply + escalation
 *
 * If a tenant's `aiDailyTokenBudget` is 0/null, budget enforcement is
 * disabled (current behavior).
 */
import { db } from '../db';
import { usageRollupsDaily, businessSettings } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import type { TenantDb } from '../tenantDb';

export type BudgetStatus = 'ok' | 'downgrade' | 'exhausted';

export interface BudgetDecision {
  status: BudgetStatus;
  model: string;
  tokensUsedToday: number;
  budget: number;
  cannedReply?: string;
}

interface CacheEntry { value: BudgetDecision; expires: number }
const CACHE_TTL_MS = 60_000; // 1 min cache to avoid hammering DB
const cache = new Map<string, CacheEntry>();

function cacheKey(tenantId: string) { return `${tenantId}:${todayDateUtc()}`; }
function todayDateUtc(): string { return new Date().toISOString().slice(0, 10); }

export async function getTodayAiTokens(tenantId: string): Promise<number> {
  try {
    const result = await db.execute(sql`
      SELECT COALESCE(ai_total_tokens, 0) AS tokens
      FROM usage_rollups_daily
      WHERE tenant_id = ${tenantId} AND date = ${todayDateUtc()}::date
      LIMIT 1
    `);
    const row = (result as any).rows?.[0];
    return Number(row?.tokens || 0);
  } catch (err) {
    console.warn('[AI BUDGET] Failed to read usage_rollups_daily:', err);
    return 0;
  }
}

/**
 * Decide which model (if any) the AI may use for this tenant right now.
 * Resolves the per-tenant budget from business_settings; falls back to
 * the global SMS_AGENT_MODEL when no budget is configured.
 */
export async function resolveBudgetDecision(
  tenantDb: TenantDb,
  tenantId: string,
  baseModel: string,
): Promise<BudgetDecision> {
  const cached = cache.get(cacheKey(tenantId));
  if (cached && cached.expires > Date.now()) return cached.value;

  let budget = 0;
  let cannedReply = "Thanks for reaching out! We're getting back to messages shortly — text or call us and we'll respond as soon as possible.";
  try {
    const rows = await tenantDb.select().from(businessSettings).where(eq(businessSettings.id, 1)).limit(1);
    if (rows[0]) {
      budget = Number(rows[0].aiDailyTokenBudget || 0);
      if (rows[0].aiBudgetExhaustedReply) cannedReply = rows[0].aiBudgetExhaustedReply;
    }
  } catch (err) {
    console.warn('[AI BUDGET] Failed to load business_settings:', err);
  }

  let decision: BudgetDecision;
  if (!budget || budget <= 0) {
    decision = { status: 'ok', model: baseModel, tokensUsedToday: 0, budget: 0 };
  } else {
    const used = await getTodayAiTokens(tenantId);
    if (used >= budget) {
      decision = { status: 'exhausted', model: 'gpt-4o-mini', tokensUsedToday: used, budget, cannedReply };
    } else if (used >= Math.floor(budget * 0.8)) {
      decision = { status: 'downgrade', model: 'gpt-4o-mini', tokensUsedToday: used, budget };
    } else {
      decision = { status: 'ok', model: baseModel, tokensUsedToday: used, budget };
    }
  }

  cache.set(cacheKey(tenantId), { value: decision, expires: Date.now() + CACHE_TTL_MS });
  return decision;
}

/** Notify owner that the AI budget is exhausted (Slack, fail-open). */
export async function notifyOwnerBudgetExhausted(tenantId: string, used: number, budget: number) {
  try {
    const { notifySlackAudit } = await import('./slackNotifyAudit');
    await notifySlackAudit({
      tenantId,
      title: 'AI daily token budget exhausted',
      severity: 'warning',
      details: `Tenant ${tenantId} hit its daily AI token budget (${used}/${budget}). Web chat is now serving the canned reply and escalating new conversations.`,
    });
  } catch (err) {
    console.warn('[AI BUDGET] Slack notify failed:', err);
  }
}

/** Test-only helper. */
export function _clearBudgetCache() { cache.clear(); }
