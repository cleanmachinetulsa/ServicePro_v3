import { Router, Request, Response } from 'express';
import { db } from './db';
import { technicians, ptoRequests, shiftTrades, applicants } from '@shared/schema';
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

export default router;
