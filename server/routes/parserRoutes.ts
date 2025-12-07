import { Router, Request, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import {
  runParserIntegration,
  createParserImportRecord,
  updateParserImportWithResult,
  getParserImport,
  getLatestParserImport,
  checkParserHealth,
  ParserConfig,
} from '../services/parserIntegrationService';
import { applyParserKnowledge } from '../services/parserApplyService';
import { getImportHistory, listTenantImportsWithSummary } from '../services/phoneHistoryImportService';
import { applyKnowledgeToTenant, getKnowledgePreview } from '../services/knowledgeOnboardingService';
import { isCleanMachineTenantFromRequest, logTenantGuardCheckDetailed } from '../services/tenantGuards';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'text/html',
      'text/csv',
      'application/zip',
      'application/x-zip-compressed',
      'application/json',
    ];
    const allowedExtensions = ['.html', '.csv', '.zip', '.json'];
    
    const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
    if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${file.mimetype}`));
    }
  },
});

const runParserSchema = z.object({
  businessName: z.string().optional(),
  businessPhone: z.string().optional(),
  threadGapMinutes: z.coerce.number().min(1).max(1440).optional().default(60),
  includeFaqs: z.preprocess((v) => v === 'true' || v === true, z.boolean()).optional().default(true),
  includeToneProfile: z.preprocess((v) => v === 'true' || v === true, z.boolean()).optional().default(true),
  includeServices: z.preprocess((v) => v === 'true' || v === true, z.boolean()).optional().default(true),
  includeAnalytics: z.preprocess((v) => v === 'true' || v === true, z.boolean()).optional().default(true),
});

const applyParserSchema = z.object({
  importId: z.coerce.number().int().positive(),
  applyFaqs: z.boolean().default(false),
  applyServices: z.boolean().default(false),
  applyTone: z.boolean().default(false),
});

router.get('/health', async (req: Request, res: Response) => {
  try {
    const result = await checkParserHealth();
    return res.json({
      success: result.healthy,
      healthy: result.healthy,
      message: result.message,
      parserUrl: process.env.PARSER_API_URL || 'https://sms-parse-output-cleanmachinetul.replit.app',
    });
  } catch (error: any) {
    return res.status(500).json({ 
      success: false, 
      healthy: false,
      error: error.message 
    });
  }
});

router.post('/run', upload.array('files', 10), async (req: Request, res: Response) => {
  try {
    if (isCleanMachineTenantFromRequest(req)) {
      logTenantGuardCheckDetailed(req, 'parser/run', true);
      return res.status(403).json({
        success: false,
        error: 'Parser onboarding is disabled for the Clean Machine tenant. Your configuration is already live.',
      });
    }

    const tenantId = (req as any).tenantId;
    if (!tenantId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, error: 'No files uploaded' });
    }

    const parseResult = runParserSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid configuration', 
        details: parseResult.error.flatten() 
      });
    }

    const config: ParserConfig = parseResult.data;
    const fileNames = files.map(f => f.originalname).join(', ');

    const importId = await createParserImportRecord(tenantId, fileNames, config);

    const result = await runParserIntegration(files, config, tenantId);

    await updateParserImportWithResult(importId, tenantId, result);

    if (!result.success) {
      return res.json({
        success: false,
        error: result.error,
        importId,
      });
    }

    return res.json({
      success: true,
      importId,
      analytics: result.analytics,
      preview: result.preview,
    });
  } catch (error: any) {
    console.error('[PARSER ROUTES] Run error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
});

router.post('/apply', async (req: Request, res: Response) => {
  try {
    if (isCleanMachineTenantFromRequest(req)) {
      logTenantGuardCheckDetailed(req, 'parser/apply', true);
      return res.status(403).json({
        success: false,
        error: 'Parser onboarding is disabled for the Clean Machine tenant. Your configuration is already live.',
      });
    }

    const tenantId = (req as any).tenantId;
    if (!tenantId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const parseResult = applyParserSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid request', 
        details: parseResult.error.flatten() 
      });
    }

    const { importId, applyFaqs, applyServices, applyTone } = parseResult.data;

    if (!applyFaqs && !applyServices && !applyTone) {
      return res.status(400).json({ 
        success: false, 
        error: 'At least one apply option must be selected' 
      });
    }

    const result = await applyParserKnowledge(importId, tenantId, {
      applyFaqs,
      applyServices,
      applyTone,
    });

    if (!result.success) {
      return res.status(422).json({
        success: false,
        error: result.error,
      });
    }

    return res.json({
      success: true,
      created: result.created,
      updated: result.updated,
      skipped: result.skipped,
      toneApplied: result.toneApplied,
    });
  } catch (error: any) {
    console.error('[PARSER ROUTES] Apply error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
});

router.get('/import/:importId', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    if (!tenantId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const importId = parseInt(req.params.importId, 10);
    if (isNaN(importId)) {
      return res.status(400).json({ success: false, error: 'Invalid import ID' });
    }

    const importRecord = await getParserImport(importId, tenantId);
    if (!importRecord) {
      return res.status(404).json({ success: false, error: 'Import not found' });
    }

    return res.json({ success: true, import: importRecord });
  } catch (error: any) {
    console.error('[PARSER ROUTES] Get import error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
});

router.get('/latest', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    if (!tenantId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const importRecord = await getLatestParserImport(tenantId);

    return res.json({ success: true, import: importRecord });
  } catch (error: any) {
    console.error('[PARSER ROUTES] Get latest error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
});

router.get('/history', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    if (!tenantId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const limit = Math.min(parseInt(req.query.limit as string, 10) || 10, 50);
    const history = await getImportHistory(tenantId, limit);

    return res.json({ success: true, imports: history });
  } catch (error: any) {
    console.error('[PARSER ROUTES] Get history error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
});

const buildSetupSchema = z.object({
  importId: z.coerce.number().int().positive(),
  applyServices: z.boolean().default(true),
  applyFaqs: z.boolean().default(true),
  applyPersona: z.boolean().default(true),
  applyProfile: z.boolean().default(true),
});

router.post('/build-setup', async (req: Request, res: Response) => {
  try {
    if (isCleanMachineTenantFromRequest(req)) {
      logTenantGuardCheckDetailed(req, 'parser/build-setup', true);
      return res.status(403).json({
        success: false,
        error: 'Parser onboarding is disabled for the Clean Machine tenant. Your configuration is already live.',
      });
    }

    const tenantId = (req as any).tenantId;
    if (!tenantId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const parseResult = buildSetupSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid request', 
        details: parseResult.error.flatten() 
      });
    }

    const { importId, applyServices, applyFaqs, applyPersona, applyProfile } = parseResult.data;

    const result = await applyKnowledgeToTenant(importId, tenantId, {
      applyServices,
      applyFaqs,
      applyPersona,
      applyProfile,
    });

    return res.json({
      success: true,
      result,
    });
  } catch (error: any) {
    console.error('[PARSER ROUTES] Build setup error:', error);
    return res.status(422).json({ success: false, error: error.message || 'Failed to build setup from knowledge' });
  }
});

router.get('/preview/:importId', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    if (!tenantId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const importId = parseInt(req.params.importId, 10);
    if (isNaN(importId)) {
      return res.status(400).json({ success: false, error: 'Invalid import ID' });
    }

    const preview = await getKnowledgePreview(importId, tenantId);

    return res.json({ success: true, preview });
  } catch (error: any) {
    console.error('[PARSER ROUTES] Get preview error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
});

router.get('/status', async (req: Request, res: Response) => {
  try {
    const healthResult = await checkParserHealth();
    
    let status: 'online' | 'degraded' | 'offline' = 'offline';
    if (healthResult.healthy) {
      status = 'online';
    } else if (healthResult.message && !healthResult.message.includes('Connection failed')) {
      status = 'degraded';
    }

    const isProtectedTenant = isCleanMachineTenantFromRequest(req);

    return res.json({
      success: true,
      status,
      healthy: healthResult.healthy,
      lastError: healthResult.message || null,
      parserUrl: process.env.PARSER_API_URL || 'https://sms-parse-output-cleanmachinetul.replit.app',
      isProtectedTenant,
      protectionMessage: isProtectedTenant 
        ? 'Parser onboarding is disabled for the Clean Machine tenant.'
        : null,
    });
  } catch (error: any) {
    return res.json({
      success: false,
      status: 'offline',
      healthy: false,
      lastError: error.message,
    });
  }
});

router.get('/admin/history', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    if (!tenantId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 50);
    const imports = await listTenantImportsWithSummary(tenantId, limit);

    return res.json({ success: true, imports });
  } catch (error: any) {
    console.error('[PARSER ROUTES] Admin history error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
});

export default router;
