import { Router, Request, Response } from 'express';
import { db } from './db';
import { phoneHistoryImports } from '@shared/schema';
import { z } from 'zod';

const router = Router();

const parserHookSchema = z.object({
  tenantExternalId: z.string().min(1, 'tenantExternalId is required'),
  remoteBundleUrl: z.string().url('remoteBundleUrl must be a valid URL'),
  externalJobId: z.string().optional(),
});

function validateParserSecret(req: Request, res: Response, next: Function) {
  const secret = req.headers['x-parser-secret'];
  const expectedSecret = process.env.PARSER_TOOL_SHARED_SECRET;

  if (!expectedSecret) {
    console.error('[PARSER HOOK] PARSER_TOOL_SHARED_SECRET not configured');
    return res.status(503).json({ error: 'Parser hook not configured' });
  }

  if (!secret || secret !== expectedSecret) {
    console.warn('[PARSER HOOK] Invalid or missing x-parser-secret header');
    return res.status(401).json({ error: 'Invalid parser secret' });
  }

  next();
}

router.post('/parser-hook', validateParserSecret, async (req: Request, res: Response) => {
  try {
    const result = parserHookSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: result.error.flatten().fieldErrors,
      });
    }

    const { tenantExternalId, remoteBundleUrl, externalJobId } = result.data;

    if (tenantExternalId !== 'root') {
      console.warn(`[PARSER HOOK] Non-root tenant attempted: ${tenantExternalId}`);
      return res.status(403).json({
        error: 'Only root tenant is supported in v1',
      });
    }

    const tenantId = 'root';

    const [importJob] = await db
      .insert(phoneHistoryImports)
      .values({
        tenantId,
        status: 'pending',
        source: 'parser_tool',
        remoteBundleUrl,
        externalJobId: externalJobId || null,
        fileName: `parser-job-${externalJobId || 'unknown'}`,
      })
      .returning();

    console.log(`[PARSER HOOK] Created import job #${importJob.id} for tenant ${tenantId} from parser tool`);

    res.status(201).json({
      success: true,
      importId: importJob.id,
      message: 'Import job created. Bundle will be processed when automation is enabled.',
    });
  } catch (error: any) {
    console.error('[PARSER HOOK] Error creating import job:', error);
    res.status(500).json({
      error: 'Failed to create import job',
      message: error.message,
    });
  }
});

export default router;
