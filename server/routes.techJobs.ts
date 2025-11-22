import { Router, Request, Response } from 'express';
import type { TenantDb } from './tenantDb';
import { appointments, conversations, messages as messagesTable, customers, jobPhotos, invoices, technicianDeposits, users, customerServiceHistory, services } from '@shared/schema';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import { requireTechnician } from './technicianMiddleware';
import { startOfDay, endOfDay, format } from 'date-fns';
import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { getDriveClient, getAuthClient } from './googleIntegration';
import { google } from 'googleapis';
import { createInvoice } from './invoiceService';
import { sendSMS } from './notifications';
import { sendPushNotification } from './pushNotificationService';
import { recordAppointmentCompleted } from './customerBookingStats';

const router = Router();

// Multer configuration for job photo uploads
const jobPhotoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(os.tmpdir(), 'job-photos');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `job-photo-${uniqueSuffix}${ext}`);
  }
});

const jobPhotoUpload = multer({
  storage: jobPhotoStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max size
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
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
 * Get today's jobs for technician
 * GET /api/tech/jobs/today
 * 
 * Query params:
 * - assignedOnly: boolean - if true, only show jobs assigned to current technician
 * - status: string - filter by status (assigned, en_route, on_site, in_progress, paused, completed, hand_off)
 * 
 * Returns appointments from Google Calendar with database status/assignment info
 */
router.get('/jobs/today', requireTechnician, async (req: Request, res: Response) => {
  try {
    const technician = (req as any).technician;
    const assignedOnly = req.query.assignedOnly === 'true';
    const statusFilter = req.query.status as string | undefined;

    console.log(`[TECH JOBS] Fetching today's jobs for technician ${technician.id}`, {
      assignedOnly,
      statusFilter,
    });

    // Fetch appointments from BOTH database and Google Calendar, then reconcile
    const today = new Date();
    const todayStart = startOfDay(today);
    const todayEnd = endOfDay(today);

    // Step 1: Get database appointments
    const dbAppointments = await req.tenantDb!
      .select({
        id: appointments.id,
        customerId: appointments.customerId,
        serviceId: appointments.serviceId,
        scheduledTime: appointments.scheduledTime,
        status: appointments.status,
        technicianId: appointments.technicianId,
        calendarEventId: appointments.calendarEventId,
        latitude: appointments.latitude,
        longitude: appointments.longitude,
        jobNotes: appointments.jobNotes,
        statusUpdatedAt: appointments.statusUpdatedAt,
        customerPhone: customers.phone,
        customerName: customers.name,
        customerAddress: customers.address,
      })
      .from(appointments)
      .leftJoin(customers, eq(appointments.customerId, customers.id))
      .where(
        req.tenantDb!.withTenantFilter(appointments,
          and(
            gte(appointments.scheduledTime, todayStart),
            lte(appointments.scheduledTime, todayEnd)
          )
        )
      );

    // Step 2: Fetch calendar events
    let calendarEvents = [];
    try {
      const auth = await getAuthClient();
      const calendar = google.calendar({ version: 'v3', auth });
      const calendarId = process.env.GOOGLE_CALENDAR_ID || 'cleanmachinetulsa@gmail.com';
      
      const response = await calendar.events.list({
        calendarId,
        timeMin: todayStart.toISOString(),
        timeMax: todayEnd.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });

      calendarEvents = response.data.items || [];
      console.log(`[TECH JOBS] Found ${dbAppointments.length} DB appointments, ${calendarEvents.length} calendar events`);
    } catch (calError) {
      console.error('[TECH JOBS] Failed to fetch from calendar:', calError);
      // Continue with database appointments only if calendar fails
    }

    // Step 3: Reconcile - prioritize database data when it exists
    const enrichedJobs = [];
    const processedEventIds = new Set();

    // First, add all database appointments (they have full metadata)
    for (const apt of dbAppointments) {
      enrichedJobs.push({
        id: apt.id,
        customerId: apt.customerId,
        serviceId: apt.serviceId,
        scheduledTime: apt.scheduledTime,
        status: apt.status || 'scheduled',
        technicianId: apt.technicianId,
        calendarEventId: apt.calendarEventId,
        latitude: apt.latitude,
        longitude: apt.longitude,
        jobNotes: apt.jobNotes,
        statusUpdatedAt: apt.statusUpdatedAt,
        customerPhone: apt.customerPhone,
        customerName: apt.customerName,
        customerAddress: apt.customerAddress,
      });
      
      if (apt.calendarEventId) {
        processedEventIds.add(apt.calendarEventId);
      }
    }

    // Then, add calendar events that don't exist in database (view-only mode)
    for (const event of calendarEvents) {
      if (!processedEventIds.has(event.id)) {
        const eventSummaryParts = event.summary ? event.summary.split('-') : ['Unknown Service'];
        const serviceName = eventSummaryParts[0]?.trim() || 'Unknown Service';
        const customerName = eventSummaryParts[1]?.trim() || 'Unknown Customer';
        
        enrichedJobs.push({
          id: `cal_${event.id}`,  // Prefix to distinguish from real IDs
          customerId: null,
          serviceId: null,
          scheduledTime: event.start.dateTime || event.start.date,
          status: 'scheduled',
          technicianId: null,
          calendarEventId: event.id,
          latitude: null,
          longitude: null,
          jobNotes: event.description || null,
          statusUpdatedAt: null,
          customerPhone: null,
          customerName,
          customerAddress: event.location || '',
          serviceName,
          isCalendarOnly: true,  // Flag for UI to show read-only state
        });
      }
    }

    console.log(`[TECH JOBS] Reconciled ${enrichedJobs.length} total jobs`);


    // Apply filters
    let filteredJobs = enrichedJobs;

    // CRITICAL SECURITY: Exclude calendar-only jobs for technicians
    // Calendar events don't have technician assignment metadata, so showing them to all techs
    // would expose customer PII (names, addresses, phone numbers) to unauthorized personnel
    // Only managers/owners can see calendar-only jobs for coordination purposes
    const isTechnicianRole = technician.role === 'employee';
    if (isTechnicianRole) {
      filteredJobs = filteredJobs.filter((job: any) => !job.isCalendarOnly);
    }

    // AUTHORIZATION: By default, only show jobs assigned to current technician OR unassigned jobs
    // This prevents leaking other technicians' jobs and customer data
    if (assignedOnly) {
      // Show only jobs explicitly assigned to current technician
      filteredJobs = filteredJobs.filter((job: any) => job.technicianId === technician.id);
    } else {
      // Show jobs assigned to current technician + unassigned jobs (available to claim)
      // NEVER show jobs assigned to other technicians
      filteredJobs = filteredJobs.filter((job: any) => 
        job.technicianId === null || job.technicianId === technician.id
      );
    }

    if (statusFilter) {
      filteredJobs = filteredJobs.filter((job: any) => job.status === statusFilter);
    }

    console.log(`[TECH JOBS] Found ${filteredJobs.length} jobs matching filters`);

    res.json({
      success: true,
      jobs: filteredJobs,
      technicianId: technician.id,
      filters: {
        assignedOnly,
        status: statusFilter || 'all',
      },
    });
  } catch (error) {
    console.error('[TECH JOBS] Error fetching jobs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch jobs',
    });
  }
});

/**
 * Update job status
 * POST /api/tech/jobs/:id/status
 * 
 * Body:
 * - status: string (assigned, en_route, on_site, in_progress, paused, completed, hand_off)
 * - latitude: number (optional) - GPS coordinates when status updated
 * - longitude: number (optional)
 * - notes: string (optional) - Job notes from technician
 */
router.post('/jobs/:id/status', requireTechnician, async (req: Request, res: Response) => {
  try {
    const technician = (req as any).technician;
    const appointmentId = parseInt(req.params.id);
    const { status, latitude, longitude, notes } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'Status is required',
      });
    }

    // Validate status
    const validStatuses = ['assigned', 'en_route', 'on_site', 'in_progress', 'paused', 'completed', 'hand_off', 'scheduled', 'confirmed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    console.log(`[TECH JOBS] Technician ${technician.id} updating job ${appointmentId} to status: ${status}`);

    // Check if appointment exists
    const [appointment] = await req.tenantDb!
      .select()
      .from(appointments)
      .where(req.tenantDb!.withTenantFilter(appointments, eq(appointments.id, appointmentId)))
      .limit(1);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: 'Appointment not found',
      });
    }

    // AUTHORIZATION: Check if technician owns this job
    // Only allow updates if job is unassigned OR assigned to current technician
    if (appointment.technicianId && appointment.technicianId !== technician.id) {
      console.warn(`[TECH JOBS] Technician ${technician.id} attempted to update job ${appointmentId} assigned to technician ${appointment.technicianId}`);
      return res.status(403).json({
        success: false,
        error: 'Cannot update job assigned to another technician',
        assignedTo: appointment.technicianId,
      });
    }

    // Update appointment status
    const updateData: any = {
      status,
      statusUpdatedAt: new Date(),
    };

    // If technician is updating status, assign them to the job if not already assigned
    if (!appointment.technicianId) {
      updateData.technicianId = technician.id;
      console.log(`[TECH JOBS] Auto-assigning job ${appointmentId} to technician ${technician.id}`);
    }

    // Update GPS coordinates if provided
    if (latitude !== undefined && longitude !== undefined) {
      updateData.latitude = latitude.toString();
      updateData.longitude = longitude.toString();
    }

    // Update job notes if provided
    if (notes !== undefined) {
      updateData.jobNotes = notes;
    }

    const [updatedAppointment] = await req.tenantDb!
      .update(appointments)
      .set(updateData)
      .where(req.tenantDb!.withTenantFilter(appointments, eq(appointments.id, appointmentId)))
      .returning();

    console.log(`[TECH JOBS] Job ${appointmentId} status updated to: ${status}`);

    // ✅ CUSTOMER NOTIFICATION: Send SMS when technician arrives on-site
    if (status === 'on_site') {
      try {
        // Get customer phone number
        const [customer] = await req.tenantDb!
          .select({ phone: customers.phone, name: customers.name })
          .from(customers)
          .where(req.tenantDb!.withTenantFilter(customers, eq(customers.id, appointment.customerId)))
          .limit(1);

        if (customer && customer.phone) {
          const { sendSMS } = await import('./notifications');
          const { renderSmsTemplateOrFallback } = await import('./templateRenderer');
          const firstName = customer.name ? customer.name.split(' ')[0] : 'there';
          
          // Render SMS from template with fallback to legacy message
          const templateResult = await renderSmsTemplateOrFallback(
            'on_site_arrival',
            { firstName },
            () => `Hey ${firstName}! 👋 Your Clean Machine technician has arrived and will be with you shortly. Get ready for that showroom shine! ✨`
          );
          
          await sendSMS(customer.phone, templateResult.message);
          console.log(`[TECH JOBS] On-site SMS notification sent to customer ${appointment.customerId}`);
        }
      } catch (smsError) {
        // Log error but don't fail the status update
        console.error('[TECH JOBS] Failed to send on-site SMS notification:', smsError);
      }
    }

    // Broadcast status update via WebSocket for real-time dashboard updates
    try {
      const { broadcastJobStatusUpdate } = await import('./websocketService');
      broadcastJobStatusUpdate(appointmentId, status, updatedAppointment);
    } catch (wsError) {
      // Log error but don't fail the status update
      console.error('[TECH JOBS] Failed to broadcast WebSocket update:', wsError);
    }

    res.json({
      success: true,
      appointment: updatedAppointment,
      message: `Job status updated to ${status}`,
    });
  } catch (error) {
    console.error('[TECH JOBS] Error updating job status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update job status',
    });
  }
});

/**
 * Get messages for a job
 * GET /api/tech/jobs/:id/messages
 * 
 * Returns conversation messages associated with the job's customer
 */
router.get('/jobs/:id/messages', requireTechnician, async (req: Request, res: Response) => {
  try {
    const appointmentId = parseInt(req.params.id);

    console.log(`[TECH JOBS] Fetching messages for job ${appointmentId}`);

    // Get appointment with customer info
    const [appointmentData] = await req.tenantDb!
      .select({
        id: appointments.id,
        customerId: appointments.customerId,
        technicianId: appointments.technicianId,
        customerPhone: customers.phone,
        customerName: customers.name,
      })
      .from(appointments)
      .leftJoin(customers, eq(appointments.customerId, customers.id))
      .where(req.tenantDb!.withTenantFilter(appointments, eq(appointments.id, appointmentId)))
      .limit(1);

    if (!appointmentData) {
      return res.status(404).json({
        success: false,
        error: 'Appointment not found',
      });
    }

    const technician = (req as any).technician;

    // AUTHORIZATION: Check if technician owns this job
    // Only allow viewing messages if job is unassigned OR assigned to current technician
    if (appointmentData.technicianId && appointmentData.technicianId !== technician.id) {
      console.warn(`[TECH JOBS] Technician ${technician.id} attempted to access messages for job ${appointmentId} assigned to technician ${appointmentData.technicianId}`);
      return res.status(403).json({
        success: false,
        error: 'Cannot access messages for job assigned to another technician',
        assignedTo: appointmentData.technicianId,
      });
    }

    if (!appointmentData.customerPhone) {
      return res.json({
        success: true,
        messages: [],
        conversation: null,
        message: 'No customer phone number associated with this appointment',
      });
    }

    // Find conversation for this customer phone
    const [conversation] = await req.tenantDb!
      .select()
      .from(conversations)
      .where(req.tenantDb!.withTenantFilter(conversations, eq(conversations.customerPhone, appointmentData.customerPhone)))
      .limit(1);

    if (!conversation) {
      return res.json({
        success: true,
        messages: [],
        conversation: null,
        message: 'No conversation found for this customer',
      });
    }

    // Get messages for this conversation
    const messageList = await req.tenantDb!
      .select()
      .from(messagesTable)
      .where(req.tenantDb!.withTenantFilter(messagesTable, eq(messagesTable.conversationId, conversation.id)))
      .orderBy(desc(messagesTable.timestamp))
      .limit(100); // Last 100 messages

    console.log(`[TECH JOBS] Found ${messageList.length} messages for job ${appointmentId}`);

    res.json({
      success: true,
      messages: messageList,
      conversation: {
        id: conversation.id,
        customerPhone: conversation.customerPhone,
        customerName: conversation.customerName,
      },
      appointmentId,
    });
  } catch (error) {
    console.error('[TECH JOBS] Error fetching messages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch messages',
    });
  }
});

/**
 * Upload job photo to Google Drive
 * POST /api/tech/jobs/:id/photos
 * 
 * Requires technician authentication
 * Verifies job ownership before allowing upload
 * Creates record in jobPhotos table with Google Drive link
 */
router.post('/jobs/:id/photos', requireTechnician, jobPhotoUpload.single('photo'), async (req: Request, res: Response) => {
  let tempFilePath: string | null = null;

  try {
    const appointmentId = parseInt(req.params.id);
    const technician = (req as any).technician;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No photo file provided',
      });
    }

    tempFilePath = req.file.path;

    console.log(`[TECH JOBS] Photo upload request for job ${appointmentId} by technician ${technician.id}`);

    // Get appointment with customer info and verify ownership
    const [appointmentData] = await req.tenantDb!
      .select({
        id: appointments.id,
        customerId: appointments.customerId,
        technicianId: appointments.technicianId,
        calendarEventId: appointments.calendarEventId,
        customerPhone: customers.phone,
        customerName: customers.name,
      })
      .from(appointments)
      .leftJoin(customers, eq(appointments.customerId, customers.id))
      .where(req.tenantDb!.withTenantFilter(appointments, eq(appointments.id, appointmentId)))
      .limit(1);

    if (!appointmentData) {
      return res.status(404).json({
        success: false,
        error: 'Appointment not found',
      });
    }

    // AUTHORIZATION: Check if technician owns this job
    if (appointmentData.technicianId && appointmentData.technicianId !== technician.id) {
      console.warn(`[TECH JOBS] Technician ${technician.id} attempted to upload photo for job ${appointmentId} assigned to technician ${appointmentData.technicianId}`);
      return res.status(403).json({
        success: false,
        error: 'Cannot upload photos for job assigned to another technician',
        assignedTo: appointmentData.technicianId,
      });
    }

    // Upload to Google Drive
    const drive = getDriveClient();
    if (!drive) {
      return res.status(503).json({
        success: false,
        error: 'Google Drive service not available',
      });
    }

    try {
      // Create folder name: "Job Photos - [Customer Name] - [Date]"
      const folderDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const customerName = appointmentData.customerName || 'Unknown Customer';
      const folderName = `Job Photos - ${customerName} - ${folderDate}`;

      // Escape single quotes in folder name for query (prevents errors with names like "O'Reilly")
      const escapedFolderName = folderName.replace(/'/g, "\\'");

      // Find or create folder
      const folderQuery = `name='${escapedFolderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
      const folderSearch = await drive.files.list({
        q: folderQuery,
        fields: 'files(id, name, webViewLink)',
        spaces: 'drive'
      });

      let folderId: string;
      let folderLink: string;

      if (folderSearch.data.files && folderSearch.data.files.length > 0) {
        folderId = folderSearch.data.files[0].id!;
        folderLink = folderSearch.data.files[0].webViewLink!;
        console.log(`[TECH JOBS] Using existing folder: ${folderLink}`);
      } else {
        // Create new folder
        const folderMetadata = {
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder'
        };
        const folder = await drive.files.create({
          requestBody: folderMetadata,
          fields: 'id, webViewLink'
        });
        folderId = folder.data.id!;
        folderLink = folder.data.webViewLink!;
        console.log(`[TECH JOBS] Created new folder: ${folderLink}`);

        // Set permissions to allow link access
        try {
          await drive.permissions.create({
            fileId: folderId,
            requestBody: {
              role: 'reader',
              type: 'anyone'
            }
          });
        } catch (permError) {
          console.warn('[TECH JOBS] Failed to set folder permissions:', permError);
        }
      }

      // Generate unique filename with timestamp
      const timestamp = new Date().toISOString().replace(/[\W_]+/g, '').slice(0, 14);
      const ext = path.extname(req.file.originalname);
      const fileName = `job_${appointmentId}_${timestamp}${ext}`;

      // Upload file to Drive
      const fileMetadata = {
        name: fileName,
        parents: [folderId]
      };

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
      try {
        await drive.permissions.create({
          fileId: uploadedFile.data.id!,
          requestBody: {
            role: 'reader',
            type: 'anyone'
          }
        });
      } catch (permError) {
        console.warn('[TECH JOBS] Failed to set file permissions:', permError);
      }

      const photoUrl = uploadedFile.data.webViewLink!;
      const fileSize = uploadedFile.data.size ? parseInt(uploadedFile.data.size) : null;

      console.log(`[TECH JOBS] Photo uploaded successfully: ${photoUrl}`);

      // Create record in jobPhotos table
      const [photoRecord] = await req.tenantDb!
        .insert(jobPhotos)
        .values({
          appointmentId,
          technicianId: technician.id,
          photoUrl,
          fileSize,
          mimeType: uploadedFile.data.mimeType || req.file.mimetype,
          fileName: uploadedFile.data.name || fileName,
        })
        .returning();

      console.log(`[TECH JOBS] Created photo record #${photoRecord.id} for job ${appointmentId}`);

      res.json({
        success: true,
        photo: {
          id: photoRecord.id,
          url: photoUrl,
          fileName: uploadedFile.data.name,
          size: fileSize,
          uploadedAt: photoRecord.uploadedAt,
        },
        message: 'Photo uploaded successfully',
      });

    } catch (driveError: any) {
      console.error('[TECH JOBS] Google Drive error:', driveError);
      return res.status(500).json({
        success: false,
        error: 'Failed to upload to Google Drive',
        message: driveError.message,
      });
    }

  } catch (error: any) {
    console.error('[TECH JOBS] Error uploading photo:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message || 'An unexpected error occurred',
    });
  } finally {
    // Always clean up temp file
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
        console.log(`[TECH JOBS] Cleaned up temp file: ${tempFilePath}`);
      } catch (cleanupError) {
        console.error(`[TECH JOBS] Failed to clean up temp file:`, cleanupError);
      }
    }
  }
});

/**
 * Complete job with comprehensive payment handling
 * POST /api/tech/jobs/:jobId/complete
 * 
 * Body:
 * - paymentMethod: 'cash' | 'check' | 'online' | 'free'
 * - amount: number
 * - servicesPerformed: Array<{ serviceId, serviceName, price }> (optional)
 * 
 * Flow:
 * 1. Fetch appointment details
 * 2. Create invoice with technician ID
 * 3. Update invoice payment method and status
 * 4. Update job status to completed
 * 5. Update/create today's deposit record (cash/check only)
 * 6. Send notifications to owner
 */
router.post('/jobs/:jobId/complete', requireTechnician, async (req: Request, res: Response) => {
  try {
    const jobId = parseInt(req.params.jobId);
    const { paymentMethod, amount, servicesPerformed = [] } = req.body;
    const technician = (req as any).technician;

    console.log(`[TECH JOBS] Completing job ${jobId} with ${paymentMethod} payment of $${amount}`);
    if (servicesPerformed.length > 0) {
      console.log(`[TECH JOBS] Services performed:`, servicesPerformed);
    }

    // Validate input
    if (!paymentMethod || !['cash', 'check', 'online', 'free'].includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid payment method. Must be "cash", "check", "online", or "free"',
      });
    }

    // Allow amount to be 0 for 'free' payment method
    if (paymentMethod !== 'free' && (!amount || amount < 0)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid amount. Must be greater than or equal to 0',
      });
    }

    // Fetch appointment details
    const [appointment] = await req.tenantDb!
      .select({
        id: appointments.id,
        customerId: appointments.customerId,
        serviceId: appointments.serviceId,
        technicianId: appointments.technicianId,
        customerName: customers.name,
        customerPhone: customers.phone,
      })
      .from(appointments)
      .leftJoin(customers, eq(appointments.customerId, customers.id))
      .where(req.tenantDb!.withTenantFilter(appointments, eq(appointments.id, jobId)))
      .limit(1);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: 'Job not found',
      });
    }

    // Verify job ownership
    if (appointment.technicianId && appointment.technicianId !== technician.id) {
      return res.status(403).json({
        success: false,
        error: 'Cannot complete job assigned to another technician',
      });
    }

    // ATOMIC TRANSACTION: Create invoice, update job, update deposit
    // TODO: Wrap tx with tenant context for full tenant isolation within transactions
    const result = await req.tenantDb!.raw.transaction(async (tx) => {
      // 1. Create invoice using invoiceService
      const invoice = await createInvoice(req.tenantDb!, jobId);

      console.log(`[TECH JOBS] Invoice created: ${invoice.id}`);

      // 2. Update invoice with payment method, technician, and status
      const invoiceUpdate: any = {
        paymentMethod,
        paymentStatus: paymentMethod === 'free' ? 'paid' : 
                      paymentMethod === 'online' ? 'pending' : 
                      'pending',
        technicianId: technician.id,
        amount: amount.toString(),
      };
      
      // Add itemized services to invoice notes if provided
      if (servicesPerformed.length > 0) {
        invoiceUpdate.notes = `Services performed: ${servicesPerformed.map(s => 
          `${s.serviceName} ($${s.price.toFixed(2)})`
        ).join(', ')}`;
      }

      const [updatedInvoice] = await tx
        .update(invoices)
        .set(invoiceUpdate)
        .where(eq(invoices.id, invoice.id))
        .returning();

      // 3. Update job status to completed
      const [completedAppointment] = await tx
        .update(appointments)
        .set({
          status: 'completed',
          completedAt: new Date(),
          technicianId: technician.id,
        })
        .where(eq(appointments.id, jobId))
        .returning();

      // 3b. Track completion in customer booking stats (mark as returning customer)
      await recordAppointmentCompleted(appointment.customerId, tx);

      // 3a. Record service in customer history (Phase 1: Customer Intelligence)
      if (completedAppointment) {
        const [service] = await tx
          .select()
          .from(services)
          .where(eq(services.id, completedAppointment.serviceId))
          .limit(1);

        await tx.insert(customerServiceHistory).values({
          customerId: completedAppointment.customerId,
          appointmentId: completedAppointment.id,
          serviceDate: new Date(),
          serviceType: service?.name || completedAppointment.serviceType || 'Service',
          vehicleId: null,
          technicianId: technician.id,
          amount: amount.toString(),
        });

        // Update customer stats
        const customerStats = await tx
          .select({
            totalAppointments: sql<number>`count(*)`,
            lifetimeValue: sql<string>`COALESCE(sum(${customerServiceHistory.amount}), 0)`,
            firstAppointment: sql<Date>`min(${customerServiceHistory.serviceDate})`,
            lastAppointment: sql<Date>`max(${customerServiceHistory.serviceDate})`
          })
          .from(customerServiceHistory)
          .where(eq(customerServiceHistory.customerId, completedAppointment.customerId))
          .groupBy(customerServiceHistory.customerId);

        if (customerStats.length > 0) {
          const stats = customerStats[0];
          await tx.update(customers)
            .set({
              isReturningCustomer: stats.totalAppointments > 0,
              totalAppointments: stats.totalAppointments,
              lifetimeValue: stats.lifetimeValue,
              firstAppointmentAt: stats.firstAppointment,
              lastAppointmentAt: stats.lastAppointment
            })
            .where(eq(customers.id, completedAppointment.customerId));
        }

        console.log(`[CUSTOMER INTELLIGENCE] Service history recorded for customer ${completedAppointment.customerId}`);
      }

      // 4. Update or create today's deposit record (only for cash/check payments)
      let depositRecord = null;
      
      if (paymentMethod === 'cash' || paymentMethod === 'check') {
        const today = format(new Date(), 'yyyy-MM-dd');

        // Check if deposit record exists for today
        const [existingDeposit] = await tx
          .select()
          .from(technicianDeposits)
          .where(
            and(
              eq(technicianDeposits.technicianId, technician.id),
              eq(technicianDeposits.depositDate, today)
            )
          )
          .limit(1);

        if (existingDeposit) {
          // Update existing deposit
          const newCashAmount = paymentMethod === 'cash'
            ? parseFloat(existingDeposit.cashAmount || '0') + amount
            : parseFloat(existingDeposit.cashAmount || '0');

          const newCheckAmount = paymentMethod === 'check'
            ? parseFloat(existingDeposit.checkAmount || '0') + amount
            : parseFloat(existingDeposit.checkAmount || '0');

          const newTotalAmount = newCashAmount + newCheckAmount;

          const updatedInvoiceIds = existingDeposit.invoiceIds || [];
          if (!updatedInvoiceIds.includes(invoice.id)) {
            updatedInvoiceIds.push(invoice.id);
          }

          [depositRecord] = await tx
            .update(technicianDeposits)
            .set({
              cashAmount: newCashAmount.toFixed(2),
              checkAmount: newCheckAmount.toFixed(2),
              totalAmount: newTotalAmount.toFixed(2),
              invoiceIds: updatedInvoiceIds,
            })
            .where(eq(technicianDeposits.id, existingDeposit.id))
            .returning();

          console.log(`[TECH JOBS] Updated deposit record ${depositRecord.id}`);
        } else {
          // Create new deposit record
          const cashAmount = paymentMethod === 'cash' ? amount : 0;
          const checkAmount = paymentMethod === 'check' ? amount : 0;
          const totalAmount = cashAmount + checkAmount;

          [depositRecord] = await tx
            .insert(technicianDeposits)
            .values({
              technicianId: technician.id,
              depositDate: today,
              cashAmount: cashAmount.toFixed(2),
              checkAmount: checkAmount.toFixed(2),
              totalAmount: totalAmount.toFixed(2),
              invoiceIds: [invoice.id],
              status: 'pending',
            })
            .returning();

          console.log(`[TECH JOBS] Created new deposit record ${depositRecord.id}`);
        }
      } else if (paymentMethod === 'online') {
        console.log(`[TECH JOBS] Online payment - invoice already sent, no deposit record needed`);
      } else if (paymentMethod === 'free') {
        console.log(`[TECH JOBS] Free service - no deposit record needed`);
      }

      return {
        invoice: updatedInvoice,
        deposit: depositRecord,
      };
    });

    const techName = technician.fullName || technician.username || 'Technician';
    const customerName = appointment.customerName || 'Customer';

    // 5. Send notifications to owner/manager
    try {
      const { shouldSendNotification } = await import('./notificationHelper');
      
      // Get owner/manager users
      const ownerManagers = await req.tenantDb!
        .select()
        .from(users)
        .where(
          req.tenantDb!.withTenantFilter(users,
            and(
              eq(users.isActive, true),
              or(eq(users.role, 'owner'), eq(users.role, 'manager'))
            )
          )
        );

      let notificationMessage = '';
      
      if (paymentMethod === 'cash' || paymentMethod === 'check') {
        notificationMessage = `💵 ${paymentMethod.toUpperCase()} payment recorded: ${customerName} paid $${amount.toFixed(2)}\nTechnician: ${techName}\nToday's total: $${result.deposit?.totalAmount || '0.00'}`;
      } else if (paymentMethod === 'online') {
        notificationMessage = `💳 Online invoice sent: ${customerName} - $${amount.toFixed(2)}\nTechnician: ${techName}`;
      } else if (paymentMethod === 'free') {
        notificationMessage = `🎁 Free service completed: ${customerName}\nTechnician: ${techName}`;
      }

      // Send push notifications (check preference)
      for (const owner of ownerManagers) {
        if (await shouldSendNotification(owner.id, 'cashPaymentPush')) {
          await sendPushNotification(owner.id, {
            title: '💵 Cash Payment Recorded',
            body: `${customerName} paid $${amount.toFixed(2)} via ${paymentMethod} - ${techName}`,
            tag: `cash-payment-${result.invoice.id}`,
            data: {
              type: 'cash_payment',
              invoiceId: result.invoice.id,
              amount: amount,
              paymentMethod,
              technicianId: technician.id,
            },
          });
        }
      }

      // Send SMS to business owner phone if configured (check preference)
      const businessOwnerPhone = process.env.BUSINESS_OWNER_PHONE;
      if (businessOwnerPhone) {
        const owner = ownerManagers.find(u => u.role === 'owner');
        if (owner && await shouldSendNotification(owner.id, 'cashPaymentSms')) {
          await sendSMS(businessOwnerPhone, notificationMessage);
        }
      }

      console.log(`[TECH JOBS] Notifications sent to ${ownerManagers.length} owner/managers`);
    } catch (notificationError) {
      console.error('[TECH JOBS] Failed to send notifications:', notificationError);
      // Don't fail the request if notifications fail
    }

    res.json({
      success: true,
      invoiceId: result.invoice.id,
      depositAmount: result.deposit.totalAmount,
      message: `Job completed with ${paymentMethod} payment of $${amount.toFixed(2)}`,
    });
  } catch (error: any) {
    console.error('[TECH JOBS] Error completing job:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to complete job',
      message: error.message || 'An unexpected error occurred',
    });
  }
});

export default router;
