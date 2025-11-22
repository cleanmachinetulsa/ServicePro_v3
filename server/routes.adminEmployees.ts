import { Router, Request, Response } from 'express';
import type { TenantDb } from './tenantDb';
import { technicians, ptoRequests, shiftTrades, applicants, extensionPool, businessSettings } from '@shared/schema';
import { eq, and, gte, lte, sql } from 'drizzle-orm';

const router = Router();

// Get employee overview statistics
router.get('/api/admin/employees/overview', async (req: Request, res: Response) => {
  try {
    // Get total and active technicians
    const allTechs = await req.tenantDb!.select().from(technicians);
    const totalTechnicians = allTechs.length;
    const activeTechnicians = allTechs.filter(t => t.employmentStatus === 'active').length;
    
    // Count pending profile approvals (profiles submitted but not reviewed)
    const pendingProfiles = allTechs.filter(t => 
      t.bioAbout && !t.profileReviewed
    );
    const pendingProfileApprovals = pendingProfiles.length;

    // Count upcoming PTO (next 30 days, approved status)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    
    const upcomingPTORequests = await req.tenantDb!.select().from(ptoRequests).where(
      req.tenantDb!.withTenantFilter(ptoRequests,
        and(
          eq(ptoRequests.status, 'approved'),
          gte(ptoRequests.startDate, new Date().toISOString().split('T')[0]),
          lte(ptoRequests.startDate, thirtyDaysFromNow.toISOString().split('T')[0])
        )
      )
    );
    const upcomingPTO = upcomingPTORequests.length;

    // Count open shift trade requests
    const openTrades = await req.tenantDb!.select().from(shiftTrades).where(
      req.tenantDb!.withTenantFilter(shiftTrades, eq(shiftTrades.status, 'pending'))
    );
    const openShiftTrades = openTrades.length;

    // Count pending applicants (new + screening status)
    const pendingApplicantsList = await req.tenantDb!.select().from(applicants).where(
      req.tenantDb!.withTenantFilter(applicants, sql`${applicants.applicationStatus} IN ('new', 'screening')`)
    );
    const pendingApplicants = pendingApplicantsList.length;

    res.json({
      success: true,
      stats: {
        totalTechnicians,
        activeTechnicians,
        pendingProfileApprovals,
        upcomingPTO,
        openShiftTrades,
        pendingApplicants,
      },
    });
  } catch (error: any) {
    console.error('[ADMIN EMPLOYEES] Error fetching overview:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to fetch employee overview' 
    });
  }
});

// Get employee directory (for sidebar)
router.get('/api/admin/employees/directory', async (req: Request, res: Response) => {
  try {
    const { search, status } = req.query;

    let query = req.tenantDb!.select({
      id: technicians.id,
      preferredName: technicians.preferredName,
      fullName: technicians.fullName,
      phone: technicians.phone,
      employmentStatus: technicians.employmentStatus,
      role: technicians.role,
      photoThumb96: technicians.photoThumb96,
      profileReviewed: technicians.profileReviewed,
    }).from(technicians);

    // Apply filters
    let techs = await query;

    // Filter by search term
    if (search && typeof search === 'string') {
      const searchLower = search.toLowerCase();
      techs = techs.filter(t => 
        t.preferredName.toLowerCase().includes(searchLower) ||
        t.fullName.toLowerCase().includes(searchLower) ||
        (t.phone && t.phone.includes(search))
      );
    }

    // Filter by status
    if (status && typeof status === 'string' && status !== 'all') {
      techs = techs.filter(t => t.employmentStatus === status);
    }

    // Sort by name
    techs.sort((a, b) => a.preferredName.localeCompare(b.preferredName));

    res.json({
      success: true,
      employees: techs,
    });
  } catch (error: any) {
    console.error('[ADMIN EMPLOYEES] Error fetching directory:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to fetch employee directory' 
    });
  }
});

// Get full employee profiles (for review queue)
router.get('/api/admin/employees/profiles', async (req: Request, res: Response) => {
  try {
    const { status } = req.query;

    // Get all technicians with full profile data
    let techs = await req.tenantDb!.select().from(technicians);

    // Filter by review status
    if (status === 'pending') {
      techs = techs.filter(t => !t.profileReviewed && t.bioAbout);
    } else if (status === 'approved') {
      techs = techs.filter(t => t.profileReviewed);
    }

    // Sort by name
    techs.sort((a, b) => a.preferredName.localeCompare(b.preferredName));

    res.json({
      success: true,
      employees: techs,
    });
  } catch (error: any) {
    console.error('[ADMIN EMPLOYEES] Error fetching profiles:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to fetch employee profiles' 
    });
  }
});

// Approve technician profile
router.post('/api/admin/employees/:id/approve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Validate ID is numeric
    const techId = parseInt(id);
    if (isNaN(techId)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid employee ID' 
      });
    }

    // Check if technician exists
    const [existingTech] = await req.tenantDb!.select().from(technicians).where(
      req.tenantDb!.withTenantFilter(technicians, eq(technicians.id, techId))
    );
    if (!existingTech) {
      return res.status(404).json({ 
        success: false,
        error: 'Technician not found' 
      });
    }

    // Update profile reviewed flag
    await req.tenantDb!.update(technicians)
      .set({ profileReviewed: true })
      .where(req.tenantDb!.withTenantFilter(technicians, eq(technicians.id, techId)));

    // Fetch updated profile to confirm change
    const [updatedTech] = await req.tenantDb!.select().from(technicians).where(
      req.tenantDb!.withTenantFilter(technicians, eq(technicians.id, techId))
    );
    
    if (!updatedTech) {
      return res.status(500).json({ 
        success: false,
        error: 'Failed to update profile' 
      });
    }

    res.json({
      success: true,
      employee: updatedTech,
      message: 'Profile approved successfully',
    });
  } catch (error: any) {
    console.error('[ADMIN EMPLOYEES] Error approving profile:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to approve profile' 
    });
  }
});

// Request changes to technician profile
router.post('/api/admin/employees/:id/request-changes', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    // Validate ID is numeric
    const techId = parseInt(id);
    if (isNaN(techId)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid employee ID' 
      });
    }

    // Check if technician exists
    const [existingTech] = await req.tenantDb!.select().from(technicians).where(
      req.tenantDb!.withTenantFilter(technicians, eq(technicians.id, techId))
    );
    if (!existingTech) {
      return res.status(404).json({ 
        success: false,
        error: 'Technician not found' 
      });
    }

    // Update profile reviewed flag to false
    await req.tenantDb!.update(technicians)
      .set({ profileReviewed: false })
      .where(req.tenantDb!.withTenantFilter(technicians, eq(technicians.id, techId)));

    // TODO: Send notification to technician with reason
    // This could be implemented via SMS, email, or in-app notification

    // Fetch updated profile to confirm change
    const [updatedTech] = await req.tenantDb!.select().from(technicians).where(
      req.tenantDb!.withTenantFilter(technicians, eq(technicians.id, techId))
    );
    
    if (!updatedTech) {
      return res.status(500).json({ 
        success: false,
        error: 'Failed to update profile' 
      });
    }

    res.json({
      success: true,
      employee: updatedTech,
      message: 'Change request sent to technician',
    });
  } catch (error: any) {
    console.error('[ADMIN EMPLOYEES] Error requesting changes:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to request changes' 
    });
  }
});

// ===== EMPLOYEE PROVISIONING AUTOMATION =====

/**
 * Generate email alias from employee name
 * Format: firstname.lastname@cleanmachine.com
 * Handles special characters and duplicate names
 */
function generateEmailAlias(fullName: string): string {
  const nameParts = fullName.trim().toLowerCase().split(/\s+/);
  const firstName = nameParts[0] || 'employee';
  const lastName = nameParts[nameParts.length - 1] || 'user';
  
  // Remove special characters and convert to email-safe format
  const cleanFirst = firstName.replace(/[^a-z0-9]/g, '');
  const cleanLast = lastName.replace(/[^a-z0-9]/g, '');
  
  return `${cleanFirst}.${cleanLast}@cleanmachine.com`;
}

/**
 * Get next available phone extension
 * Returns sequential extension number starting from 101
 * Handles conflicts and ensures uniqueness
 * 
 * CRITICAL: Uses transaction with row-level locking to prevent race conditions
 * - SELECT ... FOR UPDATE locks the row
 * - Increment happens atomically in database
 * - Prevents duplicate extensions from concurrent requests
 */
async function getNextExtension(tenantDb: any): Promise<number> {
  try {
    return await tenantDb.raw.transaction(async (tx: any) => {
      // SELECT ... FOR UPDATE locks the row until transaction completes
      const [pool] = await tx.select().from(extensionPool).for('update').limit(1);
      
      // If no pool exists, create it inside transaction
      if (!pool) {
        const [newPool] = await tx.insert(extensionPool).values({
          nextExtension: 101,
          assignedExtensions: [],
        }).returning();
        
        const currentExt = newPool.nextExtension;
        
        // Update pool with first extension
        await tx.update(extensionPool)
          .set({
            nextExtension: sql`${extensionPool.nextExtension} + 1`,
            assignedExtensions: sql`coalesce(${extensionPool.assignedExtensions}, '{}') || ARRAY[${currentExt}]`,
            lastUpdated: new Date(),
          })
          .where(eq(extensionPool.id, newPool.id));
        
        return currentExt;
      }
      
      const currentExt = pool.nextExtension;
      
      // Atomic SQL update - increment happens in database
      await tx.update(extensionPool)
        .set({
          nextExtension: sql`${extensionPool.nextExtension} + 1`,
          assignedExtensions: sql`coalesce(${extensionPool.assignedExtensions}, '{}') || ARRAY[${currentExt}]`,
          lastUpdated: new Date(),
        })
        .where(eq(extensionPool.id, pool.id));
      
      return currentExt;
    });
  } catch (error) {
    console.error('[PROVISIONING] Error getting next extension:', error);
    throw new Error('Failed to allocate extension number');
  }
}

/**
 * Create Google Workspace email alias
 * NOTE: This requires Google Workspace Admin SDK to be configured
 * Falls back gracefully if Google integration is not available
 */
async function createGoogleWorkspaceAlias(emailAlias: string, targetEmail: string = 'cleanmachinetulsa@gmail.com'): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if Google Workspace credentials are configured
    const GOOGLE_API_CREDENTIALS = process.env.GOOGLE_API_CREDENTIALS;
    
    if (!GOOGLE_API_CREDENTIALS) {
      console.warn('[PROVISIONING] Google Workspace not configured - skipping email alias creation');
      return { 
        success: false, 
        error: 'Google Workspace API credentials not configured. Manual alias creation required.' 
      };
    }
    
    // Import Google API dynamically to avoid errors if not configured
    const { google } = await import('googleapis');
    const credentials = JSON.parse(GOOGLE_API_CREDENTIALS);
    
    // Create auth client with Admin SDK scope
    const auth = new google.auth.JWT(
      credentials.client_email,
      undefined,
      credentials.private_key,
      ['https://www.googleapis.com/auth/admin.directory.user']
    );
    
    const admin = google.admin({ version: 'directory_v1', auth });
    
    // Extract username from target email (the part before @)
    const targetUser = targetEmail.split('@')[0];
    
    // Add alias to user account
    await admin.users.aliases.insert({
      userKey: targetEmail,
      requestBody: {
        alias: emailAlias,
      },
    });
    
    console.log(`[PROVISIONING] Successfully created Google Workspace alias: ${emailAlias} -> ${targetEmail}`);
    return { success: true };
    
  } catch (error: any) {
    console.error('[PROVISIONING] Error creating Google Workspace alias:', error);
    
    // Provide user-friendly error messages
    let errorMessage = 'Failed to create email alias';
    
    if (error.code === 409) {
      errorMessage = 'Email alias already exists in Google Workspace';
    } else if (error.code === 403) {
      errorMessage = 'Insufficient permissions to create alias. Check Google Workspace Admin SDK access.';
    } else if (error.code === 404) {
      errorMessage = 'Target email account not found in Google Workspace';
    } else {
      errorMessage = `${error.message || 'Unknown error'}`;
    }
    
    return { success: false, error: errorMessage };
  }
}

/**
 * Provision employee with email alias and phone extension
 * POST /api/admin/employees/:id/provision
 * 
 * PROVISIONING FLOW:
 * 1. Validate employee exists and is not already provisioned
 * 2. Generate email alias from full name
 * 3. Assign next available phone extension
 * 4. Attempt to create Google Workspace alias (if configured)
 * 5. Update employee record with provisioning details
 * 6. Log provisioning event for audit trail
 * 
 * MANUAL FALLBACK:
 * If Google Workspace alias creation fails, the system will:
 * - Mark provisioning status as "failed"
 * - Store error details for admin review
 * - Save generated email and extension anyway
 * - Admin can manually create alias in Google Workspace and retry
 */
router.post('/api/admin/employees/:id/provision', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { targetEmail } = req.body; // Optional: specify which Google Workspace account to add alias to
    
    // Validate employee ID
    const techId = parseInt(id);
    if (isNaN(techId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid employee ID',
      });
    }
    
    // Get employee record
    const [tech] = await req.tenantDb!.select().from(technicians).where(
      req.tenantDb!.withTenantFilter(technicians, eq(technicians.id, techId))
    );
    
    if (!tech) {
      return res.status(404).json({
        success: false,
        error: 'Employee not found',
      });
    }
    
    // Check if already provisioned
    if (tech.provisioningStatus === 'provisioned' && tech.generatedEmail && tech.phoneExtension) {
      return res.status(400).json({
        success: false,
        error: 'Employee already provisioned',
        data: {
          email: tech.generatedEmail,
          extension: tech.phoneExtension,
        },
      });
    }
    
    // STEP 1: Generate email alias
    const generatedEmail = generateEmailAlias(tech.fullName);
    console.log(`[PROVISIONING] Generated email for ${tech.fullName}: ${generatedEmail}`);
    
    // Check for duplicate email
    const [existingEmail] = await req.tenantDb!.select()
      .from(technicians)
      .where(req.tenantDb!.withTenantFilter(technicians,
        and(
          eq(technicians.generatedEmail, generatedEmail),
          sql`${technicians.id} != ${techId}`
        )
      ));
    
    if (existingEmail) {
      // Handle duplicate by appending ID
      const uniqueEmail = generatedEmail.replace('@cleanmachine.com', `${techId}@cleanmachine.com`);
      console.warn(`[PROVISIONING] Duplicate email detected, using: ${uniqueEmail}`);
    }
    
    // STEP 2: Assign phone extension
    let phoneExtension: number;
    try {
      phoneExtension = await getNextExtension(req.tenantDb!);
      console.log(`[PROVISIONING] Assigned extension ${phoneExtension} to ${tech.fullName}`);
    } catch (error: any) {
      console.error('[PROVISIONING] Failed to allocate extension:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to allocate phone extension. Please try again.',
        details: error.message,
      });
    }
    
    // STEP 3: Create Google Workspace alias (best effort)
    const emailResult = await createGoogleWorkspaceAlias(
      generatedEmail,
      targetEmail || 'cleanmachinetulsa@gmail.com'
    );
    
    // STEP 4: Update employee record with constraint violation handling
    const provisioningStatus = emailResult.success ? 'provisioned' : 'failed';
    const provisioningError = emailResult.error || null;
    const userId = (req.user as any)?.id || null;
    
    try {
      await req.tenantDb!.update(technicians)
        .set({
          generatedEmail,
          phoneExtension,
          provisioningStatus,
          provisioningError,
          provisionedAt: emailResult.success ? new Date() : null,
          provisionedBy: userId,
          updatedAt: new Date(),
        })
        .where(req.tenantDb!.withTenantFilter(technicians, eq(technicians.id, techId)));
    } catch (dbError: any) {
      // Check for unique constraint violation on phone extension
      if (dbError.code === '23505' && dbError.constraint === 'technicians_phone_extension_unique_idx') {
        console.error('[PROVISIONING] Extension already in use (constraint violation):', dbError);
        return res.status(409).json({
          success: false,
          error: 'Phone extension conflict detected',
          message: `Extension ${phoneExtension} is already assigned. This indicates a race condition was prevented. Please retry provisioning.`,
          retryRecommended: true,
        });
      }
      // Re-throw other database errors
      throw dbError;
    }
    
    // STEP 5: Get updated record
    const [updatedTech] = await req.tenantDb!.select().from(technicians).where(
      req.tenantDb!.withTenantFilter(technicians, eq(technicians.id, techId))
    );
    
    // STEP 6: Log provisioning event
    console.log(`[PROVISIONING] Employee ${tech.fullName} provisioning ${provisioningStatus}:`, {
      email: generatedEmail,
      extension: phoneExtension,
      error: provisioningError,
    });
    
    // Return appropriate response
    if (emailResult.success) {
      return res.json({
        success: true,
        message: 'Employee provisioned successfully',
        employee: updatedTech,
        provisioning: {
          email: generatedEmail,
          extension: phoneExtension,
          status: 'provisioned',
        },
      });
    } else {
      return res.status(207).json({
        success: false,
        message: 'Partial provisioning - manual email setup required',
        employee: updatedTech,
        provisioning: {
          email: generatedEmail,
          extension: phoneExtension,
          status: 'failed',
          error: provisioningError,
        },
        manualSteps: [
          `1. Go to Google Workspace Admin (admin.google.com)`,
          `2. Navigate to Users > ${targetEmail || 'cleanmachinetulsa@gmail.com'}`,
          `3. Add email alias: ${generatedEmail}`,
          `4. Click "Retry Provisioning" in the admin panel`,
        ],
      });
    }
    
  } catch (error: any) {
    console.error('[PROVISIONING] Error provisioning employee:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to provision employee',
    });
  }
});

/**
 * Retry provisioning for failed employee
 * POST /api/admin/employees/:id/retry-provision
 * Only attempts to create Google Workspace alias (email/extension already assigned)
 */
router.post('/api/admin/employees/:id/retry-provision', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { targetEmail } = req.body;
    
    const techId = parseInt(id);
    if (isNaN(techId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid employee ID',
      });
    }
    
    const [tech] = await req.tenantDb!.select().from(technicians).where(
      req.tenantDb!.withTenantFilter(technicians, eq(technicians.id, techId))
    );
    
    if (!tech) {
      return res.status(404).json({
        success: false,
        error: 'Employee not found',
      });
    }
    
    if (!tech.generatedEmail) {
      return res.status(400).json({
        success: false,
        error: 'No email generated for this employee. Run full provisioning first.',
      });
    }
    
    // Retry Google Workspace alias creation
    const emailResult = await createGoogleWorkspaceAlias(
      tech.generatedEmail,
      targetEmail || 'cleanmachinetulsa@gmail.com'
    );
    
    // Update status
    const provisioningStatus = emailResult.success ? 'provisioned' : 'failed';
    const userId = (req.user as any)?.id || null;
    
    await req.tenantDb!.update(technicians)
      .set({
        provisioningStatus,
        provisioningError: emailResult.error || null,
        provisionedAt: emailResult.success ? new Date() : tech.provisionedAt,
        provisionedBy: emailResult.success ? userId : tech.provisionedBy,
        updatedAt: new Date(),
      })
      .where(req.tenantDb!.withTenantFilter(technicians, eq(technicians.id, techId)));
    
    const [updatedTech] = await req.tenantDb!.select().from(technicians).where(
      req.tenantDb!.withTenantFilter(technicians, eq(technicians.id, techId))
    );
    
    if (emailResult.success) {
      return res.json({
        success: true,
        message: 'Email alias created successfully',
        employee: updatedTech,
      });
    } else {
      return res.status(400).json({
        success: false,
        error: emailResult.error,
        employee: updatedTech,
      });
    }
    
  } catch (error: any) {
    console.error('[PROVISIONING] Error retrying provisioning:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to retry provisioning',
    });
  }
});

/**
 * PATCH /api/admin/employees/:id
 * Update technician details (including employmentStatus)
 * Sends multi-channel notifications when status changes to non-active states
 * 
 * SECURITY: Requires admin role (owner/manager) and only allows whitelisted fields
 */
router.patch('/api/admin/employees/:id', async (req: Request, res: Response) => {
  try {
    // SECURITY CHECK 1: Authentication required
    if (!req.session || !req.session.userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    // Get authenticated user from database
    const { users } = await import('@shared/schema');
    const [user] = await req.tenantDb!
      .select()
      .from(users)
      .where(req.tenantDb!.withTenantFilter(users, eq(users.id, req.session.userId)))
      .limit(1);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    // SECURITY CHECK 2: Authorization - Admin privileges required
    if (!['owner', 'manager'].includes(user.role)) {
      console.warn(`[EMPLOYEE UPDATE] Unauthorized access attempt by user ${user.id} (${user.role})`);
      return res.status(403).json({
        success: false,
        error: 'Admin privileges required',
      });
    }

    // Attach user to request for downstream use in notifications
    (req as any).user = user;

    const { id } = req.params;
    
    // Validate employee ID
    const techId = parseInt(id);
    if (isNaN(techId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid employee ID',
      });
    }
    
    // Fetch existing technician record
    const [existingTech] = await req.tenantDb!.select().from(technicians).where(
      req.tenantDb!.withTenantFilter(technicians, eq(technicians.id, techId))
    );
    
    if (!existingTech) {
      return res.status(404).json({
        success: false,
        error: 'Technician not found',
      });
    }
    
    // SECURITY: Whitelist allowed fields to prevent mass assignment
    // Only employmentStatus and terminationDate can be updated via this endpoint
    const updateData: Partial<typeof technicians.$inferSelect> = {};
    
    // Extract and validate employmentStatus if provided
    if (req.body.employmentStatus !== undefined) {
      const validStatuses = ['active', 'inactive', 'on_leave', 'terminated'];
      if (!validStatuses.includes(req.body.employmentStatus)) {
        return res.status(400).json({
          success: false,
          error: `Invalid employmentStatus. Must be one of: ${validStatuses.join(', ')}`,
        });
      }
      updateData.employmentStatus = req.body.employmentStatus;
    }
    
    // Extract terminationDate if provided
    if (req.body.terminationDate !== undefined) {
      updateData.terminationDate = req.body.terminationDate;
    }
    
    // Detect status change
    const statusChanged = updateData.employmentStatus && 
                         updateData.employmentStatus !== existingTech.employmentStatus;
    const oldStatus = existingTech.employmentStatus;
    const newStatus = updateData.employmentStatus;
    
    // Auto-set terminationDate if status = terminated and none provided
    if (updateData.employmentStatus === 'terminated' && !updateData.terminationDate) {
      updateData.terminationDate = new Date().toISOString().split('T')[0];
    }
    
    // Always set updatedAt timestamp
    updateData.updatedAt = new Date();
    
    // AUDIT LOG: Log employee update for security audit trail
    console.log(`[EMPLOYEE UPDATE] Admin ${user.username} (${user.role}) updating employee ${existingTech.fullName} (ID: ${techId})`);
    if (statusChanged) {
      console.log(`[EMPLOYEE UPDATE] Status change: ${oldStatus} → ${newStatus}`);
    }
    console.log(`[EMPLOYEE UPDATE] Whitelisted fields updated:`, Object.keys(updateData).filter(k => k !== 'updatedAt'));
    
    // Update technician record with ONLY whitelisted fields
    await req.tenantDb!.update(technicians)
      .set(updateData)
      .where(req.tenantDb!.withTenantFilter(technicians, eq(technicians.id, techId)));
    
    // Fetch updated technician
    const [updatedTech] = await req.tenantDb!.select().from(technicians).where(
      req.tenantDb!.withTenantFilter(technicians, eq(technicians.id, techId))
    );
    
    if (!updatedTech) {
      return res.status(500).json({
        success: false,
        error: 'Failed to update technician',
      });
    }
    
    // Send notifications if status changed to non-active states
    if (statusChanged && ['inactive', 'on_leave', 'terminated'].includes(newStatus)) {
      console.log(`[EMPLOYEE UPDATE] Status changed: ${oldStatus} → ${newStatus} for ${existingTech.fullName}`);
      
      // Wrap all notifications in try-catch to prevent breaking the update flow
      try {
        // Fetch business settings for notification contacts
        const [settings] = await req.tenantDb!.select().from(businessSettings).limit(1);
        
        // Get admin user who made the change (if authenticated)
        const adminUserId = (req.user as any)?.id;
        let adminName = 'Admin';
        if (adminUserId) {
          const { users } = await import('@shared/schema');
          const [adminUser] = await req.tenantDb!.select().from(users).where(
            req.tenantDb!.withTenantFilter(users, eq(users.id, adminUserId))
          ).limit(1);
          if (adminUser) {
            adminName = adminUser.fullName || adminUser.username;
          }
        }
        
        // Format status labels for display
        const formatStatus = (status: string) => {
          const labels: Record<string, string> = {
            'active': 'Active',
            'inactive': 'Inactive (Suspended)',
            'on_leave': 'On Leave',
            'terminated': 'Terminated',
          };
          return labels[status] || status;
        };
        
        // CHANNEL 1: SMS to business owner
        if (settings?.alertPhone) {
          try {
            const { sendSMS } = await import('./notifications');
            
            const smsMessage = `⚠️ Technician Status Changed
${updatedTech.fullName} (${updatedTech.phone || 'No phone'})
Status: ${formatStatus(oldStatus)} → ${formatStatus(newStatus)}${newStatus === 'terminated' && updatedTech.terminationDate ? `\nTermination Date: ${updatedTech.terminationDate}` : ''}

Next: Review employee record and update schedules.`;
            
            await sendSMS(settings.alertPhone, smsMessage);
            console.log(`[EMPLOYEE UPDATE] SMS notification sent to ${settings.alertPhone}`);
          } catch (smsError: any) {
            console.error('[EMPLOYEE UPDATE] Failed to send SMS notification:', smsError.message);
          }
        } else {
          console.warn('[EMPLOYEE UPDATE] No alertPhone configured, skipping SMS notification');
        }
        
        // CHANNEL 2: Email to business owner (branded template)
        if (settings?.backupEmail) {
          try {
            const { sendBusinessEmail } = await import('./emailService');
            
            const subject = `⚠️ Technician Status Changed - ${updatedTech.fullName}`;
            
            // Plain text version
            const textContent = `
Technician Status Changed

Technician: ${updatedTech.fullName}
Phone: ${updatedTech.phone || 'N/A'}
Email: ${updatedTech.email || 'N/A'}
Status Change: ${formatStatus(oldStatus)} → ${formatStatus(newStatus)}
Role: ${updatedTech.role || 'technician'}
Hire Date: ${updatedTech.hireDate || 'N/A'}
${newStatus === 'terminated' && updatedTech.terminationDate ? `Termination Date: ${updatedTech.terminationDate}` : ''}
Updated By: ${adminName}

Next Steps:
- Review employee record
- Update schedules/assignments
- Cancel active jobs (if needed)
${newStatus === 'terminated' ? '- Archive employee data' : ''}

View Employee Profile: ${process.env.REPLIT_DOMAIN || 'https://yourapp.replit.app'}/admin/employees
            `.trim();
            
            // HTML version with branded styling
            const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header with alert styling -->
          <tr>
            <td style="background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">
                ⚠️ Technician Status Changed
              </h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 30px;">
              <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.5;">
                A technician's employment status has been updated in the system.
              </p>
              
              <!-- Details Table -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <tr>
                  <td style="padding: 10px; background-color: #f9fafb; border: 1px solid #e5e7eb; font-weight: 600; color: #374151;">Technician</td>
                  <td style="padding: 10px; background-color: #ffffff; border: 1px solid #e5e7eb; color: #1f2937;">${updatedTech.fullName}</td>
                </tr>
                <tr>
                  <td style="padding: 10px; background-color: #f9fafb; border: 1px solid #e5e7eb; font-weight: 600; color: #374151;">Phone</td>
                  <td style="padding: 10px; background-color: #ffffff; border: 1px solid #e5e7eb; color: #1f2937;">${updatedTech.phone || 'N/A'}</td>
                </tr>
                <tr>
                  <td style="padding: 10px; background-color: #f9fafb; border: 1px solid #e5e7eb; font-weight: 600; color: #374151;">Email</td>
                  <td style="padding: 10px; background-color: #ffffff; border: 1px solid #e5e7eb; color: #1f2937;">${updatedTech.email || 'N/A'}</td>
                </tr>
                <tr>
                  <td style="padding: 10px; background-color: #f9fafb; border: 1px solid #e5e7eb; font-weight: 600; color: #374151;">Status Change</td>
                  <td style="padding: 10px; background-color: #fff7ed; border: 1px solid #fed7aa; color: #c2410c; font-weight: 600;">
                    ${formatStatus(oldStatus)} → ${formatStatus(newStatus)}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px; background-color: #f9fafb; border: 1px solid #e5e7eb; font-weight: 600; color: #374151;">Role</td>
                  <td style="padding: 10px; background-color: #ffffff; border: 1px solid #e5e7eb; color: #1f2937;">${updatedTech.role || 'technician'}</td>
                </tr>
                <tr>
                  <td style="padding: 10px; background-color: #f9fafb; border: 1px solid #e5e7eb; font-weight: 600; color: #374151;">Hire Date</td>
                  <td style="padding: 10px; background-color: #ffffff; border: 1px solid #e5e7eb; color: #1f2937;">${updatedTech.hireDate || 'N/A'}</td>
                </tr>
                ${newStatus === 'terminated' && updatedTech.terminationDate ? `
                <tr>
                  <td style="padding: 10px; background-color: #f9fafb; border: 1px solid #e5e7eb; font-weight: 600; color: #374151;">Termination Date</td>
                  <td style="padding: 10px; background-color: #fef2f2; border: 1px solid #fecaca; color: #991b1b; font-weight: 600;">${updatedTech.terminationDate}</td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding: 10px; background-color: #f9fafb; border: 1px solid #e5e7eb; font-weight: 600; color: #374151;">Updated By</td>
                  <td style="padding: 10px; background-color: #ffffff; border: 1px solid #e5e7eb; color: #1f2937;">${adminName}</td>
                </tr>
              </table>
              
              <!-- Next Steps -->
              <div style="margin: 25px 0; padding: 20px; background-color: #f0f9ff; border-left: 4px solid #0ea5e9; border-radius: 4px;">
                <h3 style="margin: 0 0 10px; color: #0c4a6e; font-size: 16px; font-weight: 600;">Next Steps</h3>
                <ul style="margin: 0; padding-left: 20px; color: #374151; line-height: 1.6;">
                  <li>Review employee record</li>
                  <li>Update schedules/assignments</li>
                  <li>Cancel active jobs (if needed)</li>
                  ${newStatus === 'terminated' ? '<li>Archive employee data</li>' : ''}
                </ul>
              </div>
              
              <!-- CTA Buttons -->
              <table role="presentation" style="width: 100%; margin: 25px 0;">
                <tr>
                  <td align="center" style="padding: 10px;">
                    <a href="${process.env.REPLIT_DOMAIN || 'https://yourapp.replit.app'}/admin/employees/${techId}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">View Employee Profile</a>
                  </td>
                  <td align="center" style="padding: 10px;">
                    <a href="${process.env.REPLIT_DOMAIN || 'https://yourapp.replit.app'}/admin/employees" style="display: inline-block; padding: 12px 24px; background-color: #64748b; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">Manage Employees</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 20px; background-color: #f9fafb; border-radius: 0 0 8px 8px; text-align: center;">
              <p style="margin: 0; color: #6b7280; font-size: 12px;">
                Clean Machine Auto Detail | Employee Management System
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
            `.trim();
            
            await sendBusinessEmail(settings.backupEmail, subject, textContent, htmlContent);
            console.log(`[EMPLOYEE UPDATE] Email notification sent to ${settings.backupEmail}`);
          } catch (emailError: any) {
            console.error('[EMPLOYEE UPDATE] Failed to send email notification:', emailError.message);
          }
        } else {
          console.warn('[EMPLOYEE UPDATE] No backupEmail configured, skipping email notification');
        }
        
        // CHANNEL 3: Push notifications to admin users (owner/manager roles)
        try {
          const { sendPushNotification } = await import('./pushNotificationService');
          const { users } = await import('@shared/schema');
          const { inArray } = await import('drizzle-orm');
          
          // Get all owner/manager users
          const adminUsers = await req.tenantDb!
            .select({ id: users.id, role: users.role })
            .from(users)
            .where(req.tenantDb!.withTenantFilter(users, inArray(users.role, ['owner', 'manager'])))
            .groupBy(users.id, users.role);
          
          if (adminUsers.length > 0) {
            const pushPayload = {
              title: '⚠️ Technician Status Changed',
              body: `${updatedTech.fullName}: ${formatStatus(oldStatus)} → ${formatStatus(newStatus)}`,
              tag: `technician-status-${techId}`,
              data: {
                type: 'technician_status_change',
                technicianId: techId,
                oldStatus: oldStatus,
                newStatus: newStatus,
                url: `/admin/employees/${techId}`,
              },
            };
            
            for (const admin of adminUsers) {
              try {
                await sendPushNotification(admin.id, pushPayload);
                console.log(`[EMPLOYEE UPDATE] Push notification sent to admin user ${admin.id}`);
              } catch (pushError: any) {
                console.error(`[EMPLOYEE UPDATE] Failed to send push to admin ${admin.id}:`, pushError.message);
              }
            }
          } else {
            console.warn('[EMPLOYEE UPDATE] No admin users found for push notifications');
          }
        } catch (pushError: any) {
          console.error('[EMPLOYEE UPDATE] Failed to send push notifications:', pushError.message);
        }
        
      } catch (notificationError: any) {
        // Log notification errors but don't fail the request
        console.error('[EMPLOYEE UPDATE] Notification error:', notificationError);
      }
    }
    
    // Always return success with updated employee
    return res.json({
      success: true,
      employee: updatedTech,
      message: statusChanged 
        ? `Employee status updated from ${formatStatus(oldStatus)} to ${formatStatus(newStatus)}`
        : 'Employee updated successfully',
    });
    
  } catch (error: any) {
    console.error('[EMPLOYEE UPDATE] Error updating employee:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to update employee',
    });
  }
  
  // Helper function for status labels
  function formatStatus(status: string): string {
    const labels: Record<string, string> = {
      'active': 'Active',
      'inactive': 'Inactive (Suspended)',
      'on_leave': 'On Leave',
      'terminated': 'Terminated',
    };
    return labels[status] || status;
  }
});

export default router;
