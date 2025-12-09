import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import {
  createImportJob,
  processImportZip,
  getLatestImport,
  getImportHistory,
} from './services/phoneHistoryImportService';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/zip' || file.mimetype === 'application/x-zip-compressed' || file.originalname.endsWith('.zip')) {
      cb(null, true);
    } else {
      cb(new Error('Only ZIP files are allowed'));
    }
  },
});

function requireOwnerRole(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const role = req.session.role;
  if (role !== 'owner' && role !== 'admin') {
    return res.status(403).json({ error: 'Owner or admin access required' });
  }
  next();
}

function requireTenant(req: Request, res: Response, next: NextFunction) {
  const tenantId = req.session?.tenantId;
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant context required' });
  }
  next();
}

router.post(
  '/upload',
  requireOwnerRole,
  requireTenant,
  upload.single('file'),
  async (req: Request, res: Response) => {
    const tenantId = req.session!.tenantId as string;
    const dryRun = req.query.dryRun === 'true' || req.body?.dryRun === true;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
      // For dry run, we don't create an import job - just analyze the file
      if (dryRun) {
        const stats = await processImportZip(req.file.buffer, tenantId, 0, true);
        return res.json({
          success: true,
          dryRun: true,
          stats,
        });
      }

      const importJob = await createImportJob(tenantId, req.file.originalname);
      const stats = await processImportZip(req.file.buffer, tenantId, importJob.id, false);

      res.json({
        success: true,
        importId: importJob.id,
        stats,
      });
    } catch (error: any) {
      console.error('[IMPORT HISTORY] Upload error:', error);
      res.status(500).json({
        error: 'Import failed',
        message: error.message,
      });
    }
  }
);

router.get('/latest', requireOwnerRole, requireTenant, async (req: Request, res: Response) => {
  const tenantId = req.session!.tenantId as string;

  try {
    const latest = await getLatestImport(tenantId);
    res.json(latest || null);
  } catch (error: any) {
    console.error('[IMPORT HISTORY] Get latest error:', error);
    res.status(500).json({ error: 'Failed to get latest import' });
  }
});

router.get('/history', requireOwnerRole, requireTenant, async (req: Request, res: Response) => {
  const tenantId = req.session!.tenantId as string;
  const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

  try {
    const history = await getImportHistory(tenantId, limit);
    res.json(history);
  } catch (error: any) {
    console.error('[IMPORT HISTORY] Get history error:', error);
    res.status(500).json({ error: 'Failed to get import history' });
  }
});

export default router;
