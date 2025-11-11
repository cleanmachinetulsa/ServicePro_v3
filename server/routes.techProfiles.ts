import { Router, Request, Response } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { nanoid } from 'nanoid';
import fs from 'fs/promises';
import path from 'path';
import { db } from './db';
import { technicians, orgSettings, auditLog, insertTechnicianSchema, insertOrgSettingSchema } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import OpenAI from 'openai';
import { z } from 'zod';
import { requireRole } from './rbacMiddleware';

const router = Router();

// Configure multer for memory storage (we'll process in memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max upload
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG and PNG images are allowed'));
    }
  },
});

// Ensure upload directories exist
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'tech_profiles');
async function ensureUploadDirs() {
  try {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
  } catch (err) {
    console.error('[TECH PROFILES] Error creating upload directory:', err);
  }
}
ensureUploadDirs();

// Photo upload endpoint - processes and generates multiple sizes (Admin only)
router.post('/api/tech/profile/photo', requireRole('manager', 'owner'), upload.single('photo'), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No photo file provided' });
    }

    // Find technician by authenticated user ID
    const tech = await db.query.technicians.findFirst({
      where: (technicians, { eq }) => eq(technicians.userId, user.id),
    });

    if (!tech) {
      return res.status(404).json({ error: 'Technician profile not found. Please create a profile first.' });
    }

    const techId = tech.id;

    // Generate unique ID for this photo set
    const photoId = nanoid(12);
    const techDir = path.join(UPLOAD_DIR, String(techId));
    await fs.mkdir(techDir, { recursive: true });

    // Process image to generate 3 sizes
    const imageBuffer = req.file.buffer;
    
    // 96x96 thumbnail
    const thumb96 = await sharp(imageBuffer)
      .resize(96, 96, { fit: 'cover', position: 'center' })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();
    
    // 320x320 card size
    const card320 = await sharp(imageBuffer)
      .resize(320, 320, { fit: 'cover', position: 'center' })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();
    
    // 640x640 for MMS (optimized for size)
    let mms640 = await sharp(imageBuffer)
      .resize(640, 640, { fit: 'cover', position: 'center' })
      .jpeg({ quality: 75, mozjpeg: true }) // Lower quality for MMS size limit
      .toBuffer();

    // Verify MMS size is under 350KB, compress further if needed
    const MMS_SIZE_LIMIT = 350000; // 350KB in bytes
    if (mms640.length > MMS_SIZE_LIMIT) {
      console.log(`[TECH PROFILES] MMS photo ${mms640.length} bytes, compressing further...`);
      // Try with lower quality
      mms640 = await sharp(imageBuffer)
        .resize(640, 640, { fit: 'cover', position: 'center' })
        .jpeg({ quality: 60, mozjpeg: true })
        .toBuffer();
      
      // If still too large, try even lower quality
      if (mms640.length > MMS_SIZE_LIMIT) {
        mms640 = await sharp(imageBuffer)
          .resize(640, 640, { fit: 'cover', position: 'center' })
          .jpeg({ quality: 50, mozjpeg: true })
          .toBuffer();
      }
      
      // If STILL too large, reduce resolution
      if (mms640.length > MMS_SIZE_LIMIT) {
        mms640 = await sharp(imageBuffer)
          .resize(480, 480, { fit: 'cover', position: 'center' })
          .jpeg({ quality: 60, mozjpeg: true })
          .toBuffer();
      }
      
      // Final size check - reject if still over limit
      if (mms640.length > MMS_SIZE_LIMIT) {
        console.error(`[TECH PROFILES] Failed to compress photo under ${MMS_SIZE_LIMIT} bytes. Final size: ${mms640.length}`);
        return res.status(422).json({ 
          error: 'Photo file is too large for MMS. Please use a smaller image or crop it more tightly.',
          currentSize: mms640.length,
          maxSize: MMS_SIZE_LIMIT,
        });
      }
    }

    // Save all sizes
    const thumb96Path = path.join(techDir, `photo_thumb_96_${photoId}.jpg`);
    const card320Path = path.join(techDir, `photo_card_320_${photoId}.jpg`);
    const mms640Path = path.join(techDir, `photo_mms_640_${photoId}.jpg`);

    await Promise.all([
      fs.writeFile(thumb96Path, thumb96),
      fs.writeFile(card320Path, card320),
      fs.writeFile(mms640Path, mms640),
    ]);

    // Generate public URLs
    const baseUrl = `/tech_profiles/${techId}`;
    const urls = {
      photoUrl: `${baseUrl}/photo_card_320_${photoId}.jpg`, // Primary photo
      photoThumb96: `${baseUrl}/photo_thumb_96_${photoId}.jpg`,
      photoCard320: `${baseUrl}/photo_card_320_${photoId}.jpg`,
      photoMms640: `${baseUrl}/photo_mms_640_${photoId}.jpg`,
      mms640Size: mms640.length, // Size in bytes for client validation
    };

    console.log('[TECH PROFILES] Photo processed:', {
      techId,
      photoId,
      sizes: {
        thumb96: thumb96.length,
        card320: card320.length,
        mms640: mms640.length,
      },
    });

    res.json(urls);
  } catch (error: any) {
    console.error('[TECH PROFILES] Photo upload error:', error);
    res.status(500).json({ error: error.message || 'Failed to process photo' });
  }
});

// Get technician profile (for Tech Portal)
router.get('/api/tech/profile/me', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Find technician by user ID
    const tech = await db.query.technicians.findFirst({
      where: (technicians, { eq }) => eq(technicians.userId, user.id),
    });

    if (!tech) {
      return res.status(404).json({ error: 'Technician profile not found' });
    }

    res.json(tech);
  } catch (error: any) {
    console.error('[TECH PROFILES] Error fetching profile:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch profile' });
  }
});

// Get public technician profile (no auth required, for SMS fallback)
router.get('/api/tech/profile/public/:publicId', async (req: Request, res: Response) => {
  try {
    const { publicId } = req.params;

    // Find technician by public ID, only return reviewed/approved profiles
    const tech = await db.query.technicians.findFirst({
      where: (technicians, { and, eq }) => and(
        eq(technicians.publicId, publicId),
        eq(technicians.profileReviewed, true)
      ),
    });

    if (!tech) {
      return res.status(404).json({ error: 'Profile not found or not approved' });
    }

    // Return only public-safe fields
    const publicProfile = {
      preferredName: tech.preferredName,
      city: tech.city,
      bioAbout: tech.bioAbout,
      bioTags: tech.bioTags,
      photoCard320Url: tech.photoCard320,
      verified: tech.profileReviewed,
    };

    res.json({ profile: publicProfile });
  } catch (error: any) {
    console.error('[TECH PROFILES] Error fetching public profile:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch public profile' });
  }
});

// Create or update technician profile (Admin only)
router.post('/api/tech/profile', requireRole('manager', 'owner'), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const data = req.body;

    // Find existing technician by user ID
    const existingTech = await db.query.technicians.findFirst({
      where: (technicians, { eq }) => eq(technicians.userId, user.id),
    });

    let techId: number;

    if (existingTech) {
      // Update existing profile
      await db.update(technicians)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(technicians.id, existingTech.id));
      
      techId = existingTech.id;

      // Log audit event
      await db.insert(auditLog).values({
        userId: user.id,
        technicianId: techId,
        actionType: 'profile_update',
        entityType: 'technician',
        entityId: techId,
        details: { changes: data },
      });

      console.log('[TECH PROFILES] Profile updated:', { techId, userId: user.id });
    } else {
      // Create new profile with publicId
      const publicId = nanoid(10);
      const result = await db.insert(technicians).values({
        ...data,
        userId: user.id,
        publicId,
      }).returning();
      
      techId = result[0].id;

      // Log audit event
      await db.insert(auditLog).values({
        userId: user.id,
        technicianId: techId,
        actionType: 'profile_create',
        entityType: 'technician',
        entityId: techId,
        details: data,
      });

      console.log('[TECH PROFILES] Profile created:', { techId, publicId, userId: user.id });
    }

    // Fetch and return updated profile
    const updatedTech = await db.query.technicians.findFirst({
      where: (technicians, { eq }) => eq(technicians.id, techId),
    });

    res.json(updatedTech);
  } catch (error: any) {
    console.error('[TECH PROFILES] Error saving profile:', error);
    res.status(500).json({ error: error.message || 'Failed to save profile' });
  }
});

// Get all technicians (Admin only)
router.get('/api/admin/technicians', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || user.role !== 'owner') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const allTechs = await db.query.technicians.findMany({
      orderBy: (technicians, { desc }) => [desc(technicians.createdAt)],
    });

    res.json(allTechs);
  } catch (error: any) {
    console.error('[TECH PROFILES] Error fetching technicians:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch technicians' });
  }
});

// Admin review technician profile (approve/reject)
router.post('/api/admin/tech/:id/review', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || user.role !== 'owner') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const techId = parseInt(req.params.id);
    const { approved, reason } = req.body;

    await db.update(technicians)
      .set({
        profileReviewed: approved,
        profileReviewedAt: new Date(),
        profileReviewedBy: user.id,
        profileRejectionReason: approved ? null : reason,
        updatedAt: new Date(),
      })
      .where(eq(technicians.id, techId));

    // Log audit event
    await db.insert(auditLog).values({
      userId: user.id,
      technicianId: techId,
      actionType: approved ? 'profile_approve' : 'profile_reject',
      entityType: 'technician',
      entityId: techId,
      details: { approved, reason },
    });

    console.log('[TECH PROFILES] Profile reviewed:', { techId, approved, reviewer: user.id });

    res.json({ success: true });
  } catch (error: any) {
    console.error('[TECH PROFILES] Error reviewing profile:', error);
    res.status(500).json({ error: error.message || 'Failed to review profile' });
  }
});

// Get org settings (feature flags)
router.get('/api/org/settings', async (req: Request, res: Response) => {
  try {
    const settings = await db.query.orgSettings.findMany();
    
    // Convert to key-value object for easier access
    const settingsObj = settings.reduce((acc, setting) => {
      acc[setting.settingKey] = setting.settingValue;
      return acc;
    }, {} as Record<string, any>);

    res.json(settingsObj);
  } catch (error: any) {
    console.error('[TECH PROFILES] Error fetching org settings:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch settings' });
  }
});

// Update org setting
router.post('/api/org/settings', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || user.role !== 'owner') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { settingKey, settingValue, description } = req.body;

    // Check if setting exists
    const existing = await db.query.orgSettings.findFirst({
      where: (orgSettings, { eq }) => eq(orgSettings.settingKey, settingKey),
    });

    if (existing) {
      // Update existing setting
      await db.update(orgSettings)
        .set({
          settingValue,
          description,
          updatedAt: new Date(),
          updatedBy: user.id,
        })
        .where(eq(orgSettings.settingKey, settingKey));
    } else {
      // Create new setting
      await db.insert(orgSettings).values({
        settingKey,
        settingValue,
        description,
        updatedBy: user.id,
      });
    }

    console.log('[TECH PROFILES] Org setting updated:', { settingKey, updatedBy: user.id });

    res.json({ success: true });
  } catch (error: any) {
    console.error('[TECH PROFILES] Error updating setting:', error);
    res.status(500).json({ error: error.message || 'Failed to update setting' });
  }
});

// Public profile page - view by publicId
router.get('/api/tech/profile/:publicId', async (req: Request, res: Response) => {
  try {
    const { publicId } = req.params;

    const tech = await db.query.technicians.findFirst({
      where: (technicians, { eq }) => eq(technicians.publicId, publicId),
    });

    if (!tech) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Only return public-facing fields
    const publicProfile = {
      preferredName: tech.preferredName,
      city: tech.city,
      photoCard320: tech.photoCard320,
      bioAbout: tech.bioAbout,
      bioTags: tech.bioTags,
      profileReviewed: tech.profileReviewed,
    };

    res.json(publicProfile);
  } catch (error: any) {
    console.error('[TECH PROFILES] Error fetching public profile:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch profile' });
  }
});

export default router;
