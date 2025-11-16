import { Router, Request, Response } from 'express';
import { db } from './db';
import { jobApplications, jobPostings } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { requireRole } from './rbacMiddleware';

const router = Router();

// GET /api/admin/applications - Fetch all job applications with job posting info
router.get('/api/admin/applications', requireRole('manager', 'owner'), async (req: Request, res: Response) => {
  try {
    const applications = await db
      .select({
        id: jobApplications.id,
        jobPostingId: jobApplications.jobPostingId,
        firstName: jobApplications.firstName,
        lastName: jobApplications.lastName,
        email: jobApplications.email,
        phone: jobApplications.phone,
        resumeUrl: jobApplications.resumeUrl,
        coverLetter: jobApplications.coverLetter,
        linkedinUrl: jobApplications.linkedinUrl,
        portfolioUrl: jobApplications.portfolioUrl,
        yearsExperience: jobApplications.yearsExperience,
        currentCompany: jobApplications.currentCompany,
        status: jobApplications.status,
        notes: jobApplications.notes,
        submittedAt: jobApplications.submittedAt,
        jobPostingTitle: jobPostings.title,
      })
      .from(jobApplications)
      .leftJoin(jobPostings, eq(jobApplications.jobPostingId, jobPostings.id))
      .orderBy(jobApplications.submittedAt);

    // Transform data to match frontend interface
    const transformedApplications = applications.map((app) => ({
      id: app.id,
      firstName: app.firstName,
      lastName: app.lastName,
      email: app.email,
      phone: app.phone,
      resumeUrl: app.resumeUrl,
      coverLetter: app.coverLetter,
      linkedinUrl: app.linkedinUrl,
      portfolioUrl: app.portfolioUrl,
      yearsExperience: app.yearsExperience,
      currentCompany: app.currentCompany,
      status: app.status,
      notes: app.notes,
      submittedAt: app.submittedAt,
      jobPosting: app.jobPostingTitle ? { title: app.jobPostingTitle } : undefined,
    }));

    res.json({
      success: true,
      applications: transformedApplications,
    });
  } catch (error: any) {
    console.error('[JOB APPLICATIONS] Error fetching applications:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch job applications',
    });
  }
});

// PUT /api/admin/applications/:id - Update application status and notes
router.put('/api/admin/applications/:id', requireRole('manager', 'owner'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    // Validate status
    const validStatuses = ['new', 'reviewing', 'interviewing', 'rejected', 'hired'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status value',
      });
    }

    // Update the application
    const updateData: any = {};
    if (status !== undefined) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;

    const [updatedApplication] = await db
      .update(jobApplications)
      .set(updateData)
      .where(eq(jobApplications.id, parseInt(id)))
      .returning();

    if (!updatedApplication) {
      return res.status(404).json({
        success: false,
        error: 'Application not found',
      });
    }

    res.json({
      success: true,
      application: updatedApplication,
    });
  } catch (error: any) {
    console.error('[JOB APPLICATIONS] Error updating application:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update job application',
    });
  }
});

export default router;
