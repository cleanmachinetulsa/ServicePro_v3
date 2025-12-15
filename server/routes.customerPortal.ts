/**
 * Phase 15 - Customer Portal Routes
 * 
 * Protected routes for authenticated customers to access their data.
 * Requires tenantMiddleware and customerPortalAuthMiddleware.
 */

import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { customerPortalAuthMiddleware } from './customerPortalAuthMiddleware';
import { tenantMiddleware } from './tenantMiddleware';
import { appointments, loyaltyTransactions, customers, portalSettings, portalInstallPromptLog } from '@shared/schema';
import { eq, and, desc, gte, or, sql } from 'drizzle-orm';
import type { TenantDb } from './tenantDb';

const router = Router();

// Apply tenant middleware first, then customer auth
router.use(tenantMiddleware);
router.use(customerPortalAuthMiddleware);

// Profile picture upload storage configuration
const profilePictureStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'profile_pictures');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const customerId = (req as any).customerId;
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now();
    cb(null, `customer-${customerId}-${uniqueSuffix}${ext}`);
  }
});

// Profile picture upload multer instance
const profilePictureUpload = multer({
  storage: profilePictureStorage,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB max size for profile pictures
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, GIF, WebP) are allowed!'));
    }
  }
});

/**
 * GET /api/portal/me
 * 
 * Get authenticated customer's profile and overview data
 */
router.get('/me', async (req, res) => {
  try {
    const customer = req.customer!;
    const customerIdentity = req.customerIdentity;
    const tenantDb = req.tenantDb as TenantDb;

    // Get upcoming appointments
    const now = new Date();
    const upcomingAppointments = await tenantDb
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.customerId, customer.id),
          gte(appointments.scheduledTime, now)
        )
      )
      .orderBy(appointments.scheduledTime)
      .limit(5);

    // Get recent appointments
    const recentAppointments = await tenantDb
      .select()
      .from(appointments)
      .where(eq(appointments.customerId, customer.id))
      .orderBy(desc(appointments.scheduledTime))
      .limit(5);

    // Get recent loyalty transactions
    const recentLoyaltyTx = await tenantDb
      .select()
      .from(loyaltyTransactions)
      .where(eq(loyaltyTransactions.customerId, customer.id))
      .orderBy(desc(loyaltyTransactions.createdAt))
      .limit(10);

    // Calculate total points from loyaltyTransactions
    let totalPoints = 0;
    for (const tx of recentLoyaltyTx) {
      totalPoints += Number(tx.points || 0);
    }

    // Build response
    const response = {
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        vehicleInfo: customer.vehicleInfo,
        loyaltyTier: customer.loyaltyTier,
        isVip: customer.isVip,
        profilePictureUrl: customer.profilePictureUrl,
        customerNotes: customer.customerNotes,
        notifyViaEmail: customer.notifyViaEmail,
        notifyViaSms: customer.notifyViaSms,
        notifyViaPush: customer.notifyViaPush,
      },
      identity: customerIdentity ? {
        lastLoginAt: customerIdentity.lastLoginAt,
      } : null,
      appointments: {
        upcoming: upcomingAppointments.map(apt => ({
          id: apt.id,
          scheduledTime: apt.scheduledTime,
          serviceId: apt.serviceId,
          status: apt.status,
          address: apt.address,
          additionalRequests: apt.additionalRequests,
        })),
        recent: recentAppointments.map(apt => ({
          id: apt.id,
          scheduledTime: apt.scheduledTime,
          serviceId: apt.serviceId,
          status: apt.status,
          completedAt: apt.completedAt,
        })),
      },
      loyalty: {
        totalPoints,
        tier: customer.loyaltyTier,
        recentTransactions: recentLoyaltyTx.map(tx => ({
          id: tx.id,
          points: tx.points,
          description: tx.description,
          source: tx.source,
          createdAt: tx.createdAt,
        })),
      },
    };

    return res.json(response);
  } catch (error) {
    console.error('[CustomerPortal] /me error:', error);
    return res.status(500).json({
      error: 'Internal server error',
    });
  }
});

/**
 * GET /api/portal/appointments
 * 
 * Get customer's appointment history
 */
router.get('/appointments', async (req, res) => {
  try {
    const customer = req.customer!;
    const tenantDb = req.tenantDb as TenantDb;

    const customerAppointments = await tenantDb
      .select()
      .from(appointments)
      .where(eq(appointments.customerId, customer.id))
      .orderBy(desc(appointments.scheduledTime))
      .limit(50);

    return res.json({
      appointments: customerAppointments,
    });
  } catch (error) {
    console.error('[CustomerPortal] /appointments error:', error);
    return res.status(500).json({
      error: 'Internal server error',
    });
  }
});

/**
 * GET /api/portal/loyalty
 * 
 * Get customer's loyalty points and transaction history
 */
router.get('/loyalty', async (req, res) => {
  try {
    const customer = req.customer!;
    const tenantDb = req.tenantDb as TenantDb;

    // Get all loyalty transactions
    const transactions = await tenantDb
      .select()
      .from(loyaltyTransactions)
      .where(eq(loyaltyTransactions.customerId, customer.id))
      .orderBy(desc(loyaltyTransactions.createdAt))
      .limit(100);

    // Calculate total points
    let totalPoints = 0;
    for (const tx of transactions) {
      totalPoints += Number(tx.points || 0);
    }

    return res.json({
      totalPoints,
      tier: customer.loyaltyTier,
      transactions,
    });
  } catch (error) {
    console.error('[CustomerPortal] /loyalty error:', error);
    return res.status(500).json({
      error: 'Internal server error',
    });
  }
});

// Profile update schema
const updateProfileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255).optional(),
  email: z.string().email('Invalid email').optional(),
  phone: z.string().min(10, 'Phone must be at least 10 digits').optional(),
  address: z.string().max(500).optional(),
  vehicleInfo: z.string().max(500).optional(),
  customerNotes: z.string().max(2000).optional(),
  profilePictureUrl: z.string().url('Invalid URL').optional().nullable(),
  notifyViaEmail: z.boolean().optional(),
  notifyViaSms: z.boolean().optional(),
  notifyViaPush: z.boolean().optional(),
});

/**
 * POST /api/portal/upload-profile-picture
 * 
 * Upload customer profile picture
 */
router.post('/upload-profile-picture', profilePictureUpload.single('profilePicture'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded',
      });
    }

    const customer = req.customer!;
    const tenantDb = req.tenantDb as TenantDb;
    const tenantId = req.tenant!.id;

    // Generate public URL for the uploaded picture
    const profilePictureUrl = `/uploads/profile_pictures/${req.file.filename}`;

    // Update customer record with new profile picture URL
    const [updated] = await tenantDb
      .update(customers)
      .set({
        profilePictureUrl,
        lastInteraction: new Date(),
      })
      .where(and(
        eq(customers.id, customer.id),
        eq(customers.tenantId, tenantId)
      ))
      .returning();

    return res.json({
      success: true,
      profilePictureUrl: updated.profilePictureUrl,
      message: 'Profile picture uploaded successfully',
    });
  } catch (error: any) {
    console.error('[CustomerPortal] Upload profile picture error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

/**
 * PUT /api/portal/profile
 * 
 * Update customer profile information
 */
router.put('/profile', async (req, res) => {
  try {
    const customer = req.customer!;
    const tenantDb = req.tenantDb as TenantDb;
    const tenantId = req.tenant!.id;

    // Validate request body
    const validationResult = updateProfileSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: validationResult.error.errors,
      });
    }

    // Filter out undefined values and create clean update object
    const updateData: any = {};
    if (validationResult.data.name !== undefined) updateData.name = validationResult.data.name;
    if (validationResult.data.email !== undefined) updateData.email = validationResult.data.email;
    if (validationResult.data.phone !== undefined) updateData.phone = validationResult.data.phone;
    if (validationResult.data.address !== undefined) updateData.address = validationResult.data.address;
    if (validationResult.data.vehicleInfo !== undefined) updateData.vehicleInfo = validationResult.data.vehicleInfo;
    if (validationResult.data.customerNotes !== undefined) updateData.customerNotes = validationResult.data.customerNotes;
    if (validationResult.data.profilePictureUrl !== undefined) updateData.profilePictureUrl = validationResult.data.profilePictureUrl;
    if (validationResult.data.notifyViaEmail !== undefined) updateData.notifyViaEmail = validationResult.data.notifyViaEmail;
    if (validationResult.data.notifyViaSms !== undefined) updateData.notifyViaSms = validationResult.data.notifyViaSms;
    if (validationResult.data.notifyViaPush !== undefined) updateData.notifyViaPush = validationResult.data.notifyViaPush;

    // Check for email/phone uniqueness if they're being updated
    if (updateData.email && updateData.email !== customer.email) {
      const [emailExists] = await tenantDb
        .select()
        .from(customers)
        .where(and(
          eq(customers.email, updateData.email),
          eq(customers.tenantId, tenantId)
        ));

      if (emailExists && emailExists.id !== customer.id) {
        return res.status(409).json({
          success: false,
          error: 'Email already in use',
        });
      }
    }

    if (updateData.phone && updateData.phone !== customer.phone) {
      const [phoneExists] = await tenantDb
        .select()
        .from(customers)
        .where(and(
          eq(customers.phone, updateData.phone),
          eq(customers.tenantId, tenantId)
        ));

      if (phoneExists && phoneExists.id !== customer.id) {
        return res.status(409).json({
          success: false,
          error: 'Phone number already in use',
        });
      }
    }

    // Update customer record (only the fields that were provided and validated)
    const [updated] = await tenantDb
      .update(customers)
      .set({
        ...updateData,
        lastInteraction: new Date(),
      })
      .where(and(
        eq(customers.id, customer.id),
        eq(customers.tenantId, tenantId)
      ))
      .returning();

    return res.json({
      success: true,
      customer: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        phone: updated.phone,
        address: updated.address,
        vehicleInfo: updated.vehicleInfo,
        profilePictureUrl: updated.profilePictureUrl,
        customerNotes: updated.customerNotes,
        notifyViaEmail: updated.notifyViaEmail,
        notifyViaSms: updated.notifyViaSms,
        notifyViaPush: updated.notifyViaPush,
      },
    });
  } catch (error) {
    console.error('[CustomerPortal] Update profile error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /api/portal/install-prompt-status
 * 
 * Check if install prompt should be shown based on settings and cooldown
 */
router.get('/install-prompt-status', async (req, res) => {
  try {
    const customer = req.customer;
    const tenantId = req.tenantId || 'root';
    const tenantDb = req.tenantDb as TenantDb;
    const deviceFingerprint = req.query.deviceFingerprint as string | undefined;

    // Get portal settings
    const [settings] = await tenantDb
      .select()
      .from(portalSettings)
      .where(eq(portalSettings.tenantId, tenantId))
      .limit(1);

    // Default values if no settings exist
    const installPromptEnabled = settings?.installPromptEnabled ?? true;
    const installPromptTrigger = settings?.installPromptTrigger ?? 'booking_confirmed';
    const cooldownDays = settings?.installPromptCooldownDays ?? 21;
    const bannerText = settings?.installPromptBannerText || 'Install our app for quick access to your appointments and rewards';
    const buttonText = settings?.installPromptButtonText || 'Install App';

    if (!installPromptEnabled) {
      return res.json({
        success: true,
        shouldShow: false,
        reason: 'disabled',
      });
    }

    // Check cooldown based on customer or device fingerprint
    const cooldownDate = new Date();
    cooldownDate.setDate(cooldownDate.getDate() - cooldownDays);

    let recentEvents: any[] = [];
    if (customer) {
      // Check by customer ID
      recentEvents = await tenantDb
        .select()
        .from(portalInstallPromptLog)
        .where(and(
          eq(portalInstallPromptLog.tenantId, tenantId),
          eq(portalInstallPromptLog.customerId, customer.id),
          or(
            eq(portalInstallPromptLog.event, 'dismissed'),
            eq(portalInstallPromptLog.event, 'accepted'),
            eq(portalInstallPromptLog.event, 'installed')
          ),
          gte(portalInstallPromptLog.createdAt, cooldownDate)
        ))
        .limit(1);
    } else if (deviceFingerprint) {
      // Check by device fingerprint for anonymous users
      recentEvents = await tenantDb
        .select()
        .from(portalInstallPromptLog)
        .where(and(
          eq(portalInstallPromptLog.tenantId, tenantId),
          eq(portalInstallPromptLog.deviceFingerprint, deviceFingerprint),
          or(
            eq(portalInstallPromptLog.event, 'dismissed'),
            eq(portalInstallPromptLog.event, 'accepted'),
            eq(portalInstallPromptLog.event, 'installed')
          ),
          gte(portalInstallPromptLog.createdAt, cooldownDate)
        ))
        .limit(1);
    }

    // If there's a recent dismissal/acceptance/install within cooldown, don't show
    if (recentEvents.length > 0) {
      return res.json({
        success: true,
        shouldShow: false,
        reason: 'cooldown',
        cooldownEnds: new Date(recentEvents[0].createdAt.getTime() + (cooldownDays * 24 * 60 * 60 * 1000)),
      });
    }

    return res.json({
      success: true,
      shouldShow: true,
      trigger: installPromptTrigger,
      bannerText,
      buttonText,
      cooldownDays,
    });
  } catch (error) {
    console.error('[CustomerPortal] Install prompt status error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

const installPromptLogSchema = z.object({
  event: z.enum(['shown', 'dismissed', 'accepted', 'installed']),
  trigger: z.enum(['booking_confirmed', 'first_login', 'loyalty_earned', 'page_visit', 'manual_only']).optional().nullable(),
  deviceFingerprint: z.string().max(100).optional().nullable(),
  metadata: z.record(z.unknown()).optional().default({}),
});

/**
 * POST /api/portal/install-prompt-log
 * 
 * Log an install prompt event
 */
router.post('/install-prompt-log', async (req, res) => {
  try {
    const customer = req.customer;
    const tenantId = req.tenantId || 'root';
    const tenantDb = req.tenantDb as TenantDb;

    const parseResult = installPromptLogSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body',
        details: parseResult.error.format(),
      });
    }

    const { event, trigger, deviceFingerprint, metadata } = parseResult.data;

    await tenantDb.insert(portalInstallPromptLog).values({
      tenantId,
      customerId: customer?.id || null,
      deviceFingerprint: deviceFingerprint || null,
      event,
      trigger: trigger || null,
      userAgent: req.headers['user-agent'] || null,
      metadata: metadata || {},
    });

    console.log(`[CustomerPortal] Install prompt log: ${event} for tenant ${tenantId}`);

    return res.json({
      success: true,
      logged: true,
    });
  } catch (error) {
    console.error('[CustomerPortal] Install prompt log error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

export default router;
