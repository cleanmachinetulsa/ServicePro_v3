/**
 * Phase 11 - Email Test Router
 * 
 * Simple authenticated endpoint to test email sending for the current tenant.
 * For debug/QA purposes only.
 */

import { Router } from 'express';
import { requireAuth } from '../replitAuth';
import { wrapTenantDb } from '../tenantDb';
import { db } from '../db';
import { sendTenantEmail } from '../services/tenantEmailService';
import { z } from 'zod';

const router = Router();

const testEmailSchema = z.object({
  to: z.string().email().optional(),
  subject: z.string().optional(),
  message: z.string().optional(),
});

router.post('/test', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ ok: false, error: 'Missing tenant context' });
    }

    const user = req.user;
    if (!user) {
      return res.status(401).json({ ok: false, error: 'Not authenticated' });
    }

    const body = testEmailSchema.parse(req.body);
    
    const toEmail = body.to || user.email;
    if (!toEmail) {
      return res.status(400).json({ 
        ok: false, 
        error: 'No recipient email. Provide "to" in body or ensure user has email.' 
      });
    }

    const tenantDb = wrapTenantDb(db, tenantId);
    
    const subject = body.subject || `[ServicePro] Test Email from Tenant ${tenantId}`;
    const htmlContent = body.message 
      ? `<p>${body.message}</p>`
      : `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #7c3aed;">Test Email</h2>
          <p>This is a test email from the ServicePro platform.</p>
          <p><strong>Tenant ID:</strong> ${tenantId}</p>
          <p><strong>Sent at:</strong> ${new Date().toISOString()}</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">
            If you received this email, your email configuration is working correctly.
          </p>
        </div>
      `;

    const result = await sendTenantEmail(tenantDb, tenantId, {
      to: toEmail,
      subject,
      html: htmlContent,
      category: 'test_email',
    });

    if (result.ok) {
      return res.json({ 
        ok: true, 
        message: `Test email sent to ${toEmail}` 
      });
    } else {
      return res.status(500).json({ 
        ok: false, 
        error: result.reason,
        details: result.errorMessage 
      });
    }
  } catch (error: any) {
    console.error('[EMAIL TEST] Error:', error);
    return res.status(500).json({ 
      ok: false, 
      error: 'Internal error',
      details: error?.message 
    });
  }
});

export default router;
