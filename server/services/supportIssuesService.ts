/**
 * SP-SUPPORT-1: Support Issues Service
 * 
 * Provides CRUD operations for support issues, allowing the Setup Assistant
 * and other frontend flows to log errors to a central table for admin review.
 */

import { db } from '../db';
import { supportIssues, type SupportIssue, type CreateSupportIssue } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';

export interface SupportIssueContext {
  tenantId: string;
  userId?: string;
}

export interface ListSupportIssuesFilters {
  status?: 'open' | 'in_progress' | 'resolved';
}

export interface ResolveSupportIssueOptions {
  resolutionNotes: string;
  notifyUser?: boolean;
}

/**
 * Create a new support issue
 */
export async function createSupportIssue(
  ctx: SupportIssueContext,
  payload: CreateSupportIssue
): Promise<{ id: number }> {
  const [issue] = await db
    .insert(supportIssues)
    .values({
      tenantId: ctx.tenantId,
      userId: ctx.userId || null,
      source: payload.source || 'setup-assistant',
      severity: payload.severity || 'error',
      status: 'open',
      errorCode: payload.errorCode,
      summary: payload.summary,
      detailsJson: payload.details || {},
      userContactEmail: payload.userContactEmail || null,
    })
    .returning({ id: supportIssues.id });

  console.log(`[SUPPORT ISSUES] Created issue #${issue.id} for tenant ${ctx.tenantId}: ${payload.errorCode}`);
  
  return { id: issue.id };
}

/**
 * List support issues for a tenant
 */
export async function listSupportIssues(
  ctx: SupportIssueContext,
  filters: ListSupportIssuesFilters = {}
): Promise<SupportIssue[]> {
  const status = filters.status || 'open';
  
  const issues = await db
    .select()
    .from(supportIssues)
    .where(
      and(
        eq(supportIssues.tenantId, ctx.tenantId),
        eq(supportIssues.status, status)
      )
    )
    .orderBy(desc(supportIssues.createdAt));

  return issues;
}

/**
 * Get a single support issue by ID
 */
export async function getSupportIssueById(
  ctx: SupportIssueContext,
  id: number
): Promise<SupportIssue | null> {
  const [issue] = await db
    .select()
    .from(supportIssues)
    .where(
      and(
        eq(supportIssues.id, id),
        eq(supportIssues.tenantId, ctx.tenantId)
      )
    )
    .limit(1);

  return issue || null;
}

/**
 * Resolve a support issue
 */
export async function resolveSupportIssue(
  ctx: SupportIssueContext,
  id: number,
  options: ResolveSupportIssueOptions
): Promise<{ success: boolean; issue?: SupportIssue }> {
  const now = new Date();
  
  const [updated] = await db
    .update(supportIssues)
    .set({
      status: 'resolved',
      resolutionNotes: options.resolutionNotes,
      resolvedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(supportIssues.id, id),
        eq(supportIssues.tenantId, ctx.tenantId)
      )
    )
    .returning();

  if (!updated) {
    return { success: false };
  }

  console.log(`[SUPPORT ISSUES] Resolved issue #${id} for tenant ${ctx.tenantId}`);
  
  return { success: true, issue: updated };
}

/**
 * Update issue status to in_progress
 */
export async function updateIssueStatus(
  ctx: SupportIssueContext,
  id: number,
  status: 'open' | 'in_progress' | 'resolved'
): Promise<{ success: boolean }> {
  const [updated] = await db
    .update(supportIssues)
    .set({
      status,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(supportIssues.id, id),
        eq(supportIssues.tenantId, ctx.tenantId)
      )
    )
    .returning({ id: supportIssues.id });

  return { success: !!updated };
}
