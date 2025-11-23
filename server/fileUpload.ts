import { Express, Request, Response } from 'express';
import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { processCustomerPhoto, getDriveClient } from './googleIntegration';
import { sendSMS } from './notifications';
import { conversationState } from './conversationState';
import { handleDamagePhotoUpload } from './damageAssessment';
import { requireAuth } from './authMiddleware';
import { getConversationById } from './conversationService';

// Set up storage for uploaded files
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Create temp directory if it doesn't exist
    const uploadDir = path.join(os.tmpdir(), 'clean-machine-uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename with original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `photo-${uniqueSuffix}${ext}`);
  }
});

// Create multer instance with storage configuration
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max size
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// Message attachments uploader (images, documents, PDFs)
const messageAttachmentStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(os.tmpdir(), 'message-attachments');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `attachment-${uniqueSuffix}${ext}`);
  }
});

const messageAttachmentUpload = multer({
  storage: messageAttachmentStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max size for messages
  },
  fileFilter: (req, file, cb) => {
    // MVP: Accept images and PDFs only
    const allowedTypes = /jpeg|jpg|png|gif|webp|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetypePatterns = ['image/', 'application/pdf'];
    const mimetype = mimetypePatterns.some(pattern => file.mimetype.includes(pattern));
    
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only images and PDFs are allowed!'));
    }
  }
});

// Voicemail greeting audio uploader
const voicemailGreetingStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(os.tmpdir(), 'voicemail-greetings');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `voicemail-greeting-${uniqueSuffix}${ext}`);
  }
});

const voicemailGreetingUpload = multer({
  storage: voicemailGreetingStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max size for audio
  },
  fileFilter: (req, file, cb) => {
    // Accept common audio formats that Twilio supports
    const allowedTypes = /mp3|wav|m4a|ogg/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetypePatterns = ['audio/'];
    const mimetype = mimetypePatterns.some(pattern => file.mimetype.includes(pattern));
    
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only audio files (MP3, WAV, M4A, OGG) are allowed!'));
    }
  }
});

// Storage configuration for service images (saved to public directory)
const serviceImageStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'services');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `service-${uniqueSuffix}${ext}`);
  }
});

// Create multer instance for service images
const serviceImageUpload = multer({ 
  storage: serviceImageStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max size
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// Storage configuration for industry hero images (saved to public directory)
const industryImageStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'industry');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const industryId = req.body.industryId || 'unknown';
    const ext = path.extname(file.originalname);
    // Use industry ID in filename for easy identification
    cb(null, `${industryId}${ext}`);
  }
});

// Create multer instance for industry hero images
const industryImageUpload = multer({ 
  storage: industryImageStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max size
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

/**
 * Register file upload routes
 */
export function registerFileUploadRoutes(app: Express) {
  // Route for uploading a photo
  app.post('/api/upload-photo', upload.single('photo'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      
      // Get form data
      const customerName = req.body.customerName || '';
      const customerPhone = req.body.customerPhone || '';
      const customerEmail = req.body.customerEmail || '';
      const vehicleInfo = req.body.vehicleInfo || '';
      const message = req.body.message || '';
      
      if (!customerName) {
        return res.status(400).json({ error: 'Customer name is required' });
      }
      
      if (!customerPhone && !customerEmail) {
        return res.status(400).json({ error: 'Either phone number or email is required' });
      }
      
      if (!vehicleInfo) {
        return res.status(400).json({ error: 'Vehicle information is required' });
      }
      
      const contactInfo = customerPhone ? 
        `Phone: ${customerPhone}` : 
        (customerEmail ? `Email: ${customerEmail}` : 'No contact info');
      
      console.log(`Received photo upload from ${customerName} (${contactInfo})`, {
        filename: req.file.filename,
        size: req.file.size,
        vehicleInfo: vehicleInfo,
        message: message
      });
      
      // Create a file:// URL for the temporary file
      const fileUrl = `file://${req.file.path}`;
      
      console.log('Processing photo upload with details:', {
        name: customerName,
        phone: customerPhone || 'not provided',
        email: customerEmail || 'not provided',
        vehicle: vehicleInfo,
        fileSize: req.file.size,
        tempPath: req.file.path
      });
      
      // Process the photo - store in Google Drive
      try {
        console.log('Attempting to process customer photo in Google Drive...');
        
        // Extra debug for Google Drive status
        const drive = getDriveClient();
        if (!drive) {
          console.error('Google Drive API client is not initialized!');
        } else {
          try {
            // Test the Google Drive API connection
            const testResult = await drive.files.list({
              pageSize: 1,
              fields: 'files(id, name)'
            });
            console.log('Google Drive API connection test succeeded:', 
                       testResult.data.files ? `Found ${testResult.data.files.length} files` : 'No files found');
          } catch (testError) {
            console.error('Google Drive API connection test failed:', testError);
          }
        }
        
        const result = await processCustomerPhoto(
          fileUrl,
          customerPhone,
          customerName,
          vehicleInfo,
          customerEmail
        );
        
        console.log('Photo processing result:', result ? `Success: ${result}` : 'Failed: null result');
      
        if (result) {
        // If the user included a message, process it with OpenAI
        let aiResponse = '';
        if (message) {
          // This could be implemented to send the message to OpenAI similar to the SMS route
          aiResponse = 'Thank you for your message. We have received your photo and will get back to you soon.';
        }
        
        // 📸 SEND SMS NOTIFICATION TO BUSINESS OWNER about photo upload
        try {
          // Check if this is a damage assessment photo
          const state = customerPhone ? conversationState.getState(customerPhone) : null;
          const isDamageAssessment = state && (state as any).damageAssessmentRequested;
          
          if (isDamageAssessment && customerPhone) {
            // Use damage assessment alert system
            await handleDamagePhotoUpload(customerPhone, result, req.file.mimetype);
            console.log(`[DAMAGE ASSESSMENT] Photo processed for ${customerPhone}`);
          } else {
            // Standard photo upload notification
            const businessPhone = process.env.BUSINESS_OWNER_PHONE;
            if (businessPhone) {
              const fileSize = (req.file.size / 1024).toFixed(1); // Convert to KB
              const photoMessage = message ? `\n\nCustomer message: "${message.substring(0, 100)}${message.length > 100 ? '...' : ''}"` : '';
              
              const notificationText = `📸 New Photo Upload!

Customer: ${customerName}
${customerPhone ? `Phone: ${customerPhone}` : ''}
${customerEmail ? `Email: ${customerEmail}` : ''}
Vehicle: ${vehicleInfo}
File size: ${fileSize}KB${photoMessage}

View photo: ${result}`;

              await sendSMS(businessPhone, notificationText);
              console.log(`[PHOTO UPLOAD] Notification sent to ${businessPhone}`);
            } else {
              console.log('[PHOTO UPLOAD] No business phone configured for notifications');
            }
          }
        } catch (notifyError) {
          console.error('[PHOTO UPLOAD] Failed to send notification:', notifyError);
          // Don't fail the upload if notification fails
        }
        
        // Success response
        res.status(200).json({
          success: true,
          message: 'Photo uploaded successfully',
          folderLink: result,
          aiResponse: aiResponse
        });
      } else {
        res.status(500).json({ 
          error: 'Failed to process photo',
          message: 'The photo was received but could not be stored properly'
        });
      }
      } catch (processError: any) {
        console.error('Error in photo processing:', processError);
        res.status(500).json({ 
          error: 'Failed to process photo',
          message: processError.message || 'An error occurred while processing the photo'
        });
        return;
      }
    } catch (error: any) {
      console.error('Error handling photo upload:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: error.message || 'An unexpected error occurred'
      });
    }
  });
  
  // Route for checking upload status/health
  app.get('/api/upload-status', (req: Request, res: Response) => {
    res.status(200).json({ 
      status: 'ok',
      message: 'Photo upload service is running',
      maxFileSize: '5MB',
      acceptedTypes: ['image/jpeg', 'image/png', 'image/gif']
    });
  });
  
  // Route for processing photos from URLs
  app.post('/api/process-photo', async (req: Request, res: Response) => {
    try {
      const { photoUrl, customerName, phoneNumber, customerEmail, vehicleInfo } = req.body;
      
      if (!photoUrl) {
        return res.status(400).json({ error: 'Photo URL is required' });
      }
      
      if (!customerName) {
        return res.status(400).json({ error: 'Customer name is required' });
      }
      
      if (!phoneNumber && !customerEmail) {
        return res.status(400).json({ error: 'Either phone number or email is required' });
      }
      
      if (!vehicleInfo) {
        return res.status(400).json({ error: 'Vehicle information is required' });
      }
      
      const contactInfo = phoneNumber ? 
        `Phone: ${phoneNumber}` : 
        (customerEmail ? `Email: ${customerEmail}` : 'No contact info');
      
      console.log(`Processing photo from URL for ${customerName} (${contactInfo})`, {
        url: photoUrl,
        vehicleInfo: vehicleInfo
      });
      
      // Process the photo - download and store in Google Drive
      const result = await processCustomerPhoto(
        photoUrl,
        phoneNumber || '',
        customerName,
        vehicleInfo,
        customerEmail || ''
      );
      
      if (result) {
        // Success response
        res.status(200).json({
          success: true,
          message: 'Photo processed successfully',
          folderLink: result,
          url: photoUrl
        });
      } else {
        res.status(500).json({ 
          error: 'Failed to process photo',
          message: 'The photo URL was received but could not be processed properly'
        });
      }
    } catch (error: any) {
      console.error('Error processing photo from URL:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: error.message || 'An unexpected error occurred'
      });
    }
  });

  // Route for uploading service images
  app.post('/api/upload-service-image', serviceImageUpload.single('image'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      
      // Return the public URL for the uploaded image
      const imageUrl = `/uploads/services/${req.file.filename}`;
      
      res.status(200).json({
        success: true,
        message: 'Image uploaded successfully',
        imageUrl: imageUrl,
        filename: req.file.filename
      });
    } catch (error: any) {
      console.error('Error uploading service image:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: error.message || 'An unexpected error occurred'
      });
    }
  });

  // Route for saving service image URL to database
  app.post('/api/save-service-image', async (req: Request, res: Response) => {
    try {
      const { serviceName, imageUrl } = req.body;
      
      if (!serviceName || !imageUrl) {
        return res.status(400).json({ 
          error: 'Service name and image URL are required' 
        });
      }

      // Import the saveServiceImage function
      const { saveServiceImage } = await import('./services');
      const success = await saveServiceImage(serviceName, imageUrl);
      
      if (success) {
        res.status(200).json({
          success: true,
          message: 'Service image saved successfully'
        });
      } else {
        res.status(500).json({
          error: 'Failed to save service image'
        });
      }
    } catch (error: any) {
      console.error('Error saving service image:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: error.message || 'An unexpected error occurred'
      });
    }
  });

  // Route for deleting service images
  app.delete('/api/delete-service-image', (req: Request, res: Response) => {
    try {
      const { imageUrl } = req.body;
      
      if (!imageUrl) {
        return res.status(400).json({ error: 'Image URL is required' });
      }
      
      // Extract filename from URL
      const filename = path.basename(imageUrl);
      const filepath = path.join(process.cwd(), 'public', 'uploads', 'services', filename);
      
      // Check if file exists
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
        res.status(200).json({
          success: true,
          message: 'Image deleted successfully'
        });
      } else {
        res.status(404).json({
          error: 'File not found'
        });
      }
    } catch (error: any) {
      console.error('Error deleting service image:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: error.message || 'An unexpected error occurred'
      });
    }
  });

  // Route for uploading industry hero images
  app.post('/api/upload-industry-image', industryImageUpload.single('image'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      
      const { industryId } = req.body;
      if (!industryId) {
        return res.status(400).json({ error: 'Industry ID is required' });
      }
      
      // Return the public URL for the uploaded image
      const imageUrl = `/uploads/industry/${req.file.filename}`;
      
      console.log(`[INDUSTRY IMAGE] Uploaded hero image for industry '${industryId}':`, {
        filename: req.file.filename,
        size: req.file.size,
        url: imageUrl
      });
      
      res.status(200).json({
        success: true,
        message: 'Industry hero image uploaded successfully',
        imageUrl: imageUrl,
        filename: req.file.filename,
        industryId: industryId
      });
    } catch (error: any) {
      console.error('Error uploading industry image:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: error.message || 'An unexpected error occurred'
      });
    }
  });

  // Route for message attachments - upload to Google Drive (AUTHENTICATED)
  app.post('/api/messages/upload-attachment', requireAuth, messageAttachmentUpload.single('file'), async (req: Request, res: Response) => {
    let tempFilePath: string | null = null;
    
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      
      tempFilePath = req.file.path;
      
      const conversationId = parseInt(req.body.conversationId);
      if (!conversationId || isNaN(conversationId)) {
        return res.status(400).json({ error: 'Valid conversation ID is required' });
      }
      
      // Verify conversation exists and user has access to it
      const conversation = await getConversationById(req.tenantDb!, conversationId);
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }
      
      console.log(`[MESSAGE ATTACHMENT] Received file upload for conversation ${conversationId}:`, {
        filename: req.file.originalname,
        size: req.file.size,
        type: req.file.mimetype
      });
      
      // Upload to Google Drive
      try {
        const drive = getDriveClient();
        if (!drive) {
          throw new Error('Google Drive API not initialized');
        }
        
        // Create folder name based on conversation
        const folderName = `Message Attachments - Conversation ${conversationId}`;
        
        // Upload file
        const fileMetadata = {
          name: req.file.originalname,
          parents: [] as string[]
        };
        
        // Try to find or create folder
        const folderQuery = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
        const folderSearch = await drive.files.list({
          q: folderQuery,
          fields: 'files(id, name)',
          spaces: 'drive'
        });
        
        let folderId: string;
        if (folderSearch.data.files && folderSearch.data.files.length > 0) {
          folderId = folderSearch.data.files[0].id!;
        } else {
          // Create folder
          const folderMetadata = {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder'
          };
          const folder = await drive.files.create({
            requestBody: folderMetadata,
            fields: 'id'
          });
          folderId = folder.data.id!;
        }
        
        fileMetadata.parents.push(folderId);
        
        // Upload file
        const media = {
          mimeType: req.file.mimetype,
          body: fs.createReadStream(req.file.path)
        };
        
        const uploadedFile = await drive.files.create({
          requestBody: fileMetadata,
          media: media,
          fields: 'id, name, webViewLink, webContentLink, mimeType, size'
        });
        
        // Make file publicly viewable
        await drive.permissions.create({
          fileId: uploadedFile.data.id!,
          requestBody: {
            role: 'reader',
            type: 'anyone'
          }
        });
        
        console.log(`[MESSAGE ATTACHMENT] File uploaded successfully:`, uploadedFile.data.webViewLink);
        
        res.status(200).json({
          success: true,
          attachment: {
            id: uploadedFile.data.id,
            name: uploadedFile.data.name,
            url: uploadedFile.data.webViewLink,
            directUrl: uploadedFile.data.webContentLink,
            type: uploadedFile.data.mimeType,
            size: uploadedFile.data.size
          }
        });
      } catch (driveError: any) {
        console.error('[MESSAGE ATTACHMENT] Google Drive error:', driveError);
        res.status(500).json({
          error: 'Failed to upload to Google Drive',
          message: driveError.message
        });
      }
    } catch (error: any) {
      console.error('[MESSAGE ATTACHMENT] Error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message || 'An unexpected error occurred'
      });
    } finally {
      // Always clean up temp file
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
          console.log(`[MESSAGE ATTACHMENT] Cleaned up temp file: ${tempFilePath}`);
        } catch (cleanupError) {
          console.error(`[MESSAGE ATTACHMENT] Failed to clean up temp file:`, cleanupError);
        }
      }
    }
  });

  // Route for voicemail greeting upload - upload to Google Drive (AUTHENTICATED)
  app.post('/api/phone-settings/upload-voicemail-greeting', requireAuth, voicemailGreetingUpload.single('audio'), async (req: Request, res: Response) => {
    let tempFilePath: string | null = null;
    
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      
      tempFilePath = req.file.path;
      
      const phoneLineId = parseInt(req.body.phoneLineId);
      if (!phoneLineId || isNaN(phoneLineId)) {
        return res.status(400).json({ error: 'Valid phone line ID is required' });
      }
      
      const greetingType = req.body.type || 'regular';
      const isAfterHours = greetingType === 'after-hours';
      
      console.log(`[VOICEMAIL GREETING] Received ${isAfterHours ? 'after-hours ' : ''}audio upload for phone line ${phoneLineId}:`, {
        filename: req.file.originalname,
        size: req.file.size,
        type: req.file.mimetype,
        greetingType
      });
      
      // Upload to Google Drive
      try {
        let drive = getDriveClient();
        
        // If Drive client isn't initialized, try to initialize it now
        if (!drive) {
          console.log('[VOICEMAIL GREETING] Drive client not initialized, attempting to initialize Google APIs...');
          const { initializeGoogleAPIs } = await import('./googleIntegration');
          const initialized = await initializeGoogleAPIs();
          
          if (initialized) {
            drive = getDriveClient();
            console.log('[VOICEMAIL GREETING] Google APIs initialized successfully');
          }
          
          if (!drive) {
            throw new Error('Google Drive API could not be initialized. Please check your Google API credentials.');
          }
        }
        
        // Create folder name for voicemail greetings
        const folderName = 'Voicemail Greetings';
        
        // Upload file
        const fileMetadata = {
          name: `${req.file.originalname}`,
          parents: [] as string[]
        };
        
        // Try to find or create folder
        const folderQuery = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
        const folderSearch = await drive.files.list({
          q: folderQuery,
          fields: 'files(id, name)',
          spaces: 'drive'
        });
        
        let folderId: string;
        if (folderSearch.data.files && folderSearch.data.files.length > 0) {
          folderId = folderSearch.data.files[0].id!;
        } else {
          // Create folder
          const folderMetadata = {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder'
          };
          const folder = await drive.files.create({
            requestBody: folderMetadata,
            fields: 'id'
          });
          folderId = folder.data.id!;
        }
        
        fileMetadata.parents.push(folderId);
        
        // Upload file
        const media = {
          mimeType: req.file.mimetype,
          body: fs.createReadStream(req.file.path)
        };
        
        const uploadedFile = await drive.files.create({
          requestBody: fileMetadata,
          media: media,
          fields: 'id, name, webViewLink, webContentLink, mimeType, size'
        });
        
        // Make file publicly accessible (required for Twilio to play it)
        await drive.permissions.create({
          fileId: uploadedFile.data.id!,
          requestBody: {
            role: 'reader',
            type: 'anyone'
          }
        });
        
        console.log(`[VOICEMAIL GREETING] File uploaded successfully:`, uploadedFile.data.webContentLink);
        
        // Update phone line with greeting URL
        const { db } = await import('./db');
        const { phoneLines } = await import('@shared/schema');
        const { eq } = await import('drizzle-orm');
        
        const updateData = isAfterHours
          ? { afterHoursVoicemailGreetingUrl: uploadedFile.data.webContentLink, updatedAt: new Date() }
          : { voicemailGreetingUrl: uploadedFile.data.webContentLink, updatedAt: new Date() };
        
        const [updated] = await db
          .update(phoneLines)
          .set(updateData)
          .where(eq(phoneLines.id, phoneLineId))
          .returning();
        
        if (!updated) {
          return res.status(404).json({ error: 'Phone line not found' });
        }
        
        res.status(200).json({
          success: true,
          greetingUrl: uploadedFile.data.webContentLink,
          fileName: uploadedFile.data.name
        });
      } catch (driveError: any) {
        console.error('[VOICEMAIL GREETING] Google Drive error:', driveError);
        res.status(500).json({
          error: 'Failed to upload to Google Drive',
          message: driveError.message
        });
      }
    } catch (error: any) {
      console.error('[VOICEMAIL GREETING] Error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message || 'An unexpected error occurred'
      });
    } finally {
      // Always clean up temp file
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
          console.log(`[VOICEMAIL GREETING] Cleaned up temp file: ${tempFilePath}`);
        } catch (cleanupError) {
          console.error(`[VOICEMAIL GREETING] Failed to clean up temp file:`, cleanupError);
        }
      }
    }
  });

  // Route for deleting voicemail greeting
  app.delete('/api/phone-settings/delete-voicemail-greeting/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const phoneLineId = parseInt(req.params.id);
      if (!phoneLineId || isNaN(phoneLineId)) {
        return res.status(400).json({ error: 'Valid phone line ID is required' });
      }
      
      const greetingType = req.query.type as string || 'regular';
      const isAfterHours = greetingType === 'after-hours';
      
      // Update phone line to remove greeting URL
      const { db } = await import('./db');
      const { phoneLines } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');
      
      const updateData = isAfterHours
        ? { afterHoursVoicemailGreetingUrl: null, updatedAt: new Date() }
        : { voicemailGreetingUrl: null, updatedAt: new Date() };
      
      const [updated] = await db
        .update(phoneLines)
        .set(updateData)
        .where(eq(phoneLines.id, phoneLineId))
        .returning();
      
      if (!updated) {
        return res.status(404).json({ error: 'Phone line not found' });
      }
      
      res.status(200).json({
        success: true,
        message: 'Voicemail greeting deleted successfully'
      });
    } catch (error: any) {
      console.error('[VOICEMAIL GREETING] Error deleting:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message || 'An unexpected error occurred'
      });
    }
  });
}