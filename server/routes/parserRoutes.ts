import { Router, Request, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import {
  runParserIntegration,
  createParserImportRecord,
  updateParserImportWithResult,
  getParserImport,
  getLatestParserImport,
  ParserConfig,
} from '../services/parserIntegrationService';
import { applyParserKnowledge } from '../services/parserApplyService';
import { getImportHistory } from '../services/phoneHistoryImportService';

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

router.post('/run', upload.array('files', 10), async (req: Request, res: Response) => {
  try {
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

export default router;
