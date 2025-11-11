import { Router, Request, Response } from 'express';
import { db } from './db';
import { galleryPhotos } from '@shared/schema';
import { eq, desc, asc } from 'drizzle-orm';
import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import axios from 'axios';
import { getGoogleBusinessPhotos } from './googleIntegration';
import * as GooglePhotosAlbum from 'google-photos-album-image-url-fetch';

const router = Router();

// Configure multer for gallery photo uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'gallery');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `gallery-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max size for high-quality images
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, WEBP) are allowed!'));
    }
  }
});

/**
 * GET /api/gallery
 * Get all active gallery photos ordered by displayOrder
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    
    let photos;
    if (includeInactive) {
      photos = await db.select().from(galleryPhotos).orderBy(asc(galleryPhotos.displayOrder));
    } else {
      photos = await db.select().from(galleryPhotos)
        .where(eq(galleryPhotos.isActive, true))
        .orderBy(asc(galleryPhotos.displayOrder));
    }
    
    res.json({ success: true, photos });
  } catch (error: any) {
    console.error('[GALLERY] Error fetching photos:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/gallery
 * Upload multiple gallery photos
 */
router.post('/', upload.array('photos', 20), async (req: Request, res: Response) => {
  try {
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return res.status(400).json({ success: false, error: 'No files uploaded' });
    }

    const userId = (req as any).session?.userId || null;
    
    // Get the current max display order
    const maxOrderResult = await db.select({ maxOrder: galleryPhotos.displayOrder })
      .from(galleryPhotos)
      .orderBy(desc(galleryPhotos.displayOrder))
      .limit(1);
    
    let nextOrder = maxOrderResult.length > 0 && maxOrderResult[0].maxOrder !== null 
      ? maxOrderResult[0].maxOrder + 1 
      : 0;

    const uploadedPhotos = [];
    
    for (const file of req.files) {
      const imageUrl = `/uploads/gallery/${file.filename}`;
      
      const [newPhoto] = await db.insert(galleryPhotos).values({
        imageUrl,
        title: null,
        description: null,
        displayOrder: nextOrder,
        isActive: true,
        uploadedBy: userId,
      }).returning();
      
      uploadedPhotos.push(newPhoto);
      nextOrder++;
    }
    
    console.log(`[GALLERY] Uploaded ${uploadedPhotos.length} photos`);
    
    res.json({ 
      success: true, 
      data: uploadedPhotos,
      message: `Successfully uploaded ${uploadedPhotos.length} photo(s)`
    });
  } catch (error: any) {
    console.error('[GALLERY] Error uploading photos:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/gallery/:id
 * Update photo details (title, description, isActive)
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const photoId = parseInt(req.params.id);
    const { title, description, isActive } = req.body;
    
    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (isActive !== undefined) updateData.isActive = isActive;
    
    const [updatedPhoto] = await db.update(galleryPhotos)
      .set(updateData)
      .where(eq(galleryPhotos.id, photoId))
      .returning();
    
    if (!updatedPhoto) {
      return res.status(404).json({ success: false, error: 'Photo not found' });
    }
    
    res.json({ success: true, data: updatedPhoto });
  } catch (error: any) {
    console.error('[GALLERY] Error updating photo:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/gallery/:id
 * Delete a gallery photo
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const photoId = parseInt(req.params.id);
    
    // Get photo details to delete the file
    const [photo] = await db.select().from(galleryPhotos)
      .where(eq(galleryPhotos.id, photoId));
    
    if (!photo) {
      return res.status(404).json({ success: false, error: 'Photo not found' });
    }
    
    // Delete from database
    await db.delete(galleryPhotos).where(eq(galleryPhotos.id, photoId));
    
    // Delete the file from disk
    try {
      const filePath = path.join(process.cwd(), 'public', photo.imageUrl);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (fileError) {
      console.error('[GALLERY] Error deleting file:', fileError);
      // Continue anyway - database record is deleted
    }
    
    console.log(`[GALLERY] Deleted photo ${photoId}`);
    
    res.json({ success: true, message: 'Photo deleted successfully' });
  } catch (error: any) {
    console.error('[GALLERY] Error deleting photo:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/gallery/reorder
 * Update display order for multiple photos
 * Body: { photos: [{ id: number, displayOrder: number }] }
 */
router.post('/reorder', async (req: Request, res: Response) => {
  try {
    const { photos } = req.body;
    
    if (!Array.isArray(photos)) {
      return res.status(400).json({ success: false, error: 'Photos array is required' });
    }
    
    // Update each photo's display order
    const updates = photos.map(({ id, displayOrder }) => 
      db.update(galleryPhotos)
        .set({ displayOrder })
        .where(eq(galleryPhotos.id, id))
    );
    
    await Promise.all(updates);
    
    console.log(`[GALLERY] Reordered ${photos.length} photos`);
    
    res.json({ success: true, message: 'Photos reordered successfully' });
  } catch (error: any) {
    console.error('[GALLERY] Error reordering photos:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/gallery/sync-google-photos
 * Fetch photos from Google Business Profile and populate gallery
 */
router.post('/sync-google-photos', async (req: Request, res: Response) => {
  try {
    const { googlePlaceId } = req.body;
    console.log('[GALLERY] Starting Google Business photos sync with Place ID:', googlePlaceId || 'using default');
    
    // Fetch photos from Google Business Profile
    const googlePhotos = await getGoogleBusinessPhotos(googlePlaceId);
    
    if (!googlePhotos || googlePhotos.length === 0) {
      return res.json({ 
        success: true, 
        message: 'No photos found on Google Business Profile',
        photosAdded: 0
      });
    }
    
    console.log(`[GALLERY] Found ${googlePhotos.length} photos from Google Business`);
    
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'gallery');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    let photosAdded = 0;
    const errors: string[] = [];
    
    // Download and save each photo
    for (let i = 0; i < Math.min(googlePhotos.length, 20); i++) {
      const photo = googlePhotos[i];
      
      try {
        console.log(`[GALLERY] Downloading photo ${i + 1}/${googlePhotos.length}...`);
        
        // Download the image
        const imageResponse = await axios.get(photo.photoUrl || photo.highResUrl, {
          responseType: 'arraybuffer',
          timeout: 30000
        });
        
        // Generate filename
        const ext = '.jpg'; // Google photos are typically JPEG
        const filename = `google-${Date.now()}-${i}${ext}`;
        const filepath = path.join(uploadDir, filename);
        
        // Save file to disk
        fs.writeFileSync(filepath, Buffer.from(imageResponse.data));
        
        // Get current max display order
        const maxOrderResult = await db.select({ maxOrder: galleryPhotos.displayOrder })
          .from(galleryPhotos)
          .orderBy(desc(galleryPhotos.displayOrder))
          .limit(1);
        
        const nextOrder = (maxOrderResult[0]?.maxOrder || 0) + 1;
        
        // Insert into database
        await db.insert(galleryPhotos).values({
          imageUrl: `/uploads/gallery/${filename}`,
          title: photo.name || `Photo ${i + 1}`,
          description: null,
          displayOrder: nextOrder + i,
          isActive: true,
          uploadedBy: null // System upload
        });
        
        photosAdded++;
        console.log(`[GALLERY] Added photo ${i + 1}: ${filename}`);
        
      } catch (photoError: any) {
        console.error(`[GALLERY] Error processing photo ${i + 1}:`, photoError.message);
        errors.push(`Photo ${i + 1}: ${photoError.message}`);
      }
    }
    
    console.log(`[GALLERY] Sync complete: ${photosAdded} photos added`);
    
    res.json({ 
      success: true, 
      message: `Successfully synced ${photosAdded} photos from Google Business Profile`,
      photosAdded,
      errors: errors.length > 0 ? errors : undefined
    });
    
  } catch (error: any) {
    console.error('[GALLERY] Error syncing Google photos:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/gallery/fetch-google-photos-album
 * Fetch photos from a Google Photos shared album URL
 * 
 * WARNING: This uses an unofficial HTML scraping method as Google removed
 * shared album API access in April 2025. This may break if Google changes
 * their HTML structure. Use at your own risk.
 */
router.post('/fetch-google-photos-album', async (req: Request, res: Response) => {
  try {
    const { albumUrl } = req.body;
    
    if (!albumUrl) {
      return res.status(400).json({ success: false, error: 'Album URL is required' });
    }
    
    // Validate URL format
    if (!albumUrl.includes('photos.app.goo.gl') && !albumUrl.includes('photos.google.com')) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid Google Photos album URL. Must be a shared album link.' 
      });
    }
    
    console.log(`[GALLERY] Fetching photos from Google Photos album: ${albumUrl}`);
    
    // Fetch photos using the unofficial scraping library
    const photos = await GooglePhotosAlbum.fetchImageUrls(albumUrl);
    
    if (!photos || photos.length === 0) {
      return res.json({ 
        success: true, 
        photos: [],
        message: 'No photos found in the album'
      });
    }
    
    // Format photos for frontend
    const formattedPhotos = photos.map((photo: any, index: number) => ({
      id: `google-${index}`,
      imageUrl: photo.url,
      title: `Photo ${index + 1}`,
      description: null,
      width: photo.width,
      height: photo.height,
      isActive: true,
      source: 'google-photos'
    }));
    
    console.log(`[GALLERY] Successfully fetched ${formattedPhotos.length} photos from Google Photos album`);
    
    res.json({ 
      success: true, 
      photos: formattedPhotos,
      count: formattedPhotos.length
    });
    
  } catch (error: any) {
    console.error('[GALLERY] Error fetching Google Photos album:', error);
    
    // Provide helpful error messages
    let errorMessage = error.message;
    if (error.message.includes('404') || error.message.includes('not found')) {
      errorMessage = 'Album not found. Make sure the album is shared and the URL is correct.';
    } else if (error.message.includes('403') || error.message.includes('forbidden')) {
      errorMessage = 'Access denied. Make sure the album is publicly shared.';
    }
    
    res.status(500).json({ success: false, error: errorMessage });
  }
});

export default router;
