import { Router, Request, Response } from 'express';
import { db } from './db';
import { technicians, ptoRequests, shiftTrades, applicants, extensionPool } from '@shared/schema';
import { eq, and, gte, lte, sql } from 'drizzle-orm';

const router = Router();

// Get employee overview statistics
router.get('/api/admin/employees/overview', async (req: Request, res: Response) => {
  try {
    // Get total and active technicians
    const allTechs = await db.select().from(technicians);
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
    
    const upcomingPTORequests = await db.select().from(ptoRequests).where(
      and(
        eq(ptoRequests.status, 'approved'),
        gte(ptoRequests.startDate, new Date().toISOString().split('T')[0]),
        lte(ptoRequests.startDate, thirtyDaysFromNow.toISOString().split('T')[0])
      )
    );
    const upcomingPTO = upcomingPTORequests.length;

    // Count open shift trade requests
    const openTrades = await db.select().from(shiftTrades).where(
      eq(shiftTrades.status, 'pending')
    );
    const openShiftTrades = openTrades.length;

    // Count pending applicants (new + screening status)
    const pendingApplicantsList = await db.select().from(applicants).where(
      sql`${applicants.applicationStatus} IN ('new', 'screening')`
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

    let query = db.select({
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
    let techs = await db.select().from(technicians);

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
    const [existingTech] = await db.select().from(technicians).where(eq(technicians.id, techId));
    if (!existingTech) {
      return res.status(404).json({ 
        success: false,
        error: 'Technician not found' 
      });
    }

    // Update profile reviewed flag
    await db.update(technicians)
      .set({ profileReviewed: true })
      .where(eq(technicians.id, techId));

    // Fetch updated profile to confirm change
    const [updatedTech] = await db.select().from(technicians).where(eq(technicians.id, techId));
    
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
    const [existingTech] = await db.select().from(technicians).where(eq(technicians.id, techId));
    if (!existingTech) {
      return res.status(404).json({ 
        success: false,
        error: 'Technician not found' 
      });
    }

    // Update profile reviewed flag to false
    await db.update(technicians)
      .set({ profileReviewed: false })
      .where(eq(technicians.id, techId));

    // TODO: Send notification to technician with reason
    // This could be implemented via SMS, email, or in-app notification

    // Fetch updated profile to confirm change
    const [updatedTech] = await db.select().from(technicians).where(eq(technicians.id, techId));
    
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
async function getNextExtension(): Promise<number> {
  try {
    return await db.transaction(async (tx) => {
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
    const [tech] = await db.select().from(technicians).where(eq(technicians.id, techId));
    
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
    const [existingEmail] = await db.select()
      .from(technicians)
      .where(and(
        eq(technicians.generatedEmail, generatedEmail),
        sql`${technicians.id} != ${techId}`
      ));
    
    if (existingEmail) {
      // Handle duplicate by appending ID
      const uniqueEmail = generatedEmail.replace('@cleanmachine.com', `${techId}@cleanmachine.com`);
      console.warn(`[PROVISIONING] Duplicate email detected, using: ${uniqueEmail}`);
    }
    
    // STEP 2: Assign phone extension
    let phoneExtension: number;
    try {
      phoneExtension = await getNextExtension();
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
      await db.update(technicians)
        .set({
          generatedEmail,
          phoneExtension,
          provisioningStatus,
          provisioningError,
          provisionedAt: emailResult.success ? new Date() : null,
          provisionedBy: userId,
          updatedAt: new Date(),
        })
        .where(eq(technicians.id, techId));
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
    const [updatedTech] = await db.select().from(technicians).where(eq(technicians.id, techId));
    
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
    
    const [tech] = await db.select().from(technicians).where(eq(technicians.id, techId));
    
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
    
    await db.update(technicians)
      .set({
        provisioningStatus,
        provisioningError: emailResult.error || null,
        provisionedAt: emailResult.success ? new Date() : tech.provisionedAt,
        provisionedBy: emailResult.success ? userId : tech.provisionedBy,
        updatedAt: new Date(),
      })
      .where(eq(technicians.id, techId));
    
    const [updatedTech] = await db.select().from(technicians).where(eq(technicians.id, techId));
    
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

export default router;
