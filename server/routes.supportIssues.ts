/**
 * SP-SUPPORT-1: Support Issues Routes
 * 
 * API routes for creating, listing, and resolving support issues.
 * Used by the Setup Assistant and other frontend flows to log errors.
 */

import { Router, Request, Response } from 'express';
import { createSupportIssueSchema, resolveSupportIssueSchema } from '@shared/schema';
import {
  createSupportIssue,
  listSupportIssues,
  getSupportIssueById,
  resolveSupportIssue,
  updateIssueStatus,
} from './services/supportIssuesService';
import { sendEmail } from './notifications';
import { ZodError } from 'zod';

const router = Router();

/**
 * POST /api/support/issues - Create a new support issue
 * Auth: Any authenticated user may create
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const tenantId = req.user.tenantId || 'root';
    const userId = req.user.id;

    const payload = createSupportIssueSchema.parse(req.body);

    const result = await createSupportIssue(
      { tenantId, userId },
      payload
    );

    return res.status(201).json({ success: true, issueId: result.id });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
    }
    console.error('[SUPPORT ISSUES] Error creating issue:', error);
    return res.status(500).json({ success: false, error: 'Failed to create support issue' });
  }
});

/**
 * GET /api/support/issues - List issues for current tenant
 * Auth: Owner/admin only
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    if (req.user.role !== 'owner' && req.user.role !== 'manager') {
      return res.status(403).json({ success: false, error: 'Forbidden - owner or manager role required' });
    }

    const tenantId = req.user.tenantId || 'root';
    const status = req.query.status as 'open' | 'in_progress' | 'resolved' | undefined;

    const issues = await listSupportIssues({ tenantId }, { status });

    return res.json({ success: true, issues });
  } catch (error) {
    console.error('[SUPPORT ISSUES] Error listing issues:', error);
    return res.status(500).json({ success: false, error: 'Failed to list support issues' });
  }
});

/**
 * GET /api/support/issues/:id - Get issue detail
 * Auth: Owner/admin for current tenant
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    if (req.user.role !== 'owner' && req.user.role !== 'manager') {
      return res.status(403).json({ success: false, error: 'Forbidden - owner or manager role required' });
    }

    const tenantId = req.user.tenantId || 'root';
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Invalid issue ID' });
    }

    const issue = await getSupportIssueById({ tenantId }, id);

    if (!issue) {
      return res.status(404).json({ success: false, error: 'Issue not found' });
    }

    return res.json({ success: true, issue });
  } catch (error) {
    console.error('[SUPPORT ISSUES] Error getting issue:', error);
    return res.status(500).json({ success: false, error: 'Failed to get support issue' });
  }
});

/**
 * POST /api/support/issues/:id/resolve - Resolve an issue and optionally notify user
 * Auth: Owner/platform admin only
 */
router.post('/:id/resolve', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    if (req.user.role !== 'owner') {
      return res.status(403).json({ success: false, error: 'Forbidden - owner role required' });
    }

    const tenantId = req.user.tenantId || 'root';
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Invalid issue ID' });
    }

    const payload = resolveSupportIssueSchema.parse(req.body);

    const result = await resolveSupportIssue({ tenantId }, id, {
      resolutionNotes: payload.resolutionNotes,
      notifyUser: payload.notifyUser,
    });

    if (!result.success) {
      return res.status(404).json({ success: false, error: 'Issue not found or already resolved' });
    }

    if (payload.notifyUser && result.issue?.userContactEmail) {
      try {
        await sendEmail({
          to: result.issue.userContactEmail,
          subject: `We've fixed your issue: ${result.issue.summary}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #16a34a;">Issue Resolved</h2>
              <p>Good news! We've resolved the issue you reported:</p>
              <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
                <strong>${result.issue.summary}</strong>
              </div>
              <p><strong>Resolution Notes:</strong></p>
              <p>${payload.resolutionNotes}</p>
              <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb;" />
              <p style="color: #6b7280; font-size: 14px;">
                Thank you for your patience while we worked on this. If you have any questions or encounter
                any other issues, please don't hesitate to reach out.
              </p>
            </div>
          `,
        });
        console.log(`[SUPPORT ISSUES] Resolution notification sent to ${result.issue.userContactEmail}`);
      } catch (emailError) {
        console.error('[SUPPORT ISSUES] Failed to send resolution email:', emailError);
      }
    }

    return res.json({ success: true });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
    }
    console.error('[SUPPORT ISSUES] Error resolving issue:', error);
    return res.status(500).json({ success: false, error: 'Failed to resolve support issue' });
  }
});

/**
 * PATCH /api/support/issues/:id/status - Update issue status
 * Auth: Owner/manager
 */
router.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    if (req.user.role !== 'owner' && req.user.role !== 'manager') {
      return res.status(403).json({ success: false, error: 'Forbidden - owner or manager role required' });
    }

    const tenantId = req.user.tenantId || 'root';
    const id = parseInt(req.params.id, 10);
    const { status } = req.body;

    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Invalid issue ID' });
    }

    if (!['open', 'in_progress', 'resolved'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    const result = await updateIssueStatus({ tenantId }, id, status);

    if (!result.success) {
      return res.status(404).json({ success: false, error: 'Issue not found' });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('[SUPPORT ISSUES] Error updating status:', error);
    return res.status(500).json({ success: false, error: 'Failed to update issue status' });
  }
});

export default router;
