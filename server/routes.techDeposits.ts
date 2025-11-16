import { Router, Express, Request, Response } from 'express';
import { db } from './db';
import { technicianDeposits, invoices, users, type TechnicianDeposit } from '@shared/schema';
import { eq, and, gte, lte, desc, inArray, or } from 'drizzle-orm';
import { requireAuth } from './authMiddleware';
import { requireRole } from './rbacMiddleware';
import { startOfDay, endOfDay, subDays, format } from 'date-fns';
import { sendPushNotification } from './pushNotificationService';

export function registerTechDepositRoutes(app: Express) {
  const router = Router();

  /**
   * GET /api/tech-deposits/today/:technicianId
   * Fetch today's deposit record for technician with list of invoices
   */
  router.get('/tech-deposits/today/:technicianId', requireAuth, async (req: Request, res: Response) => {
    try {
      const technicianId = parseInt(req.params.technicianId);
      const user = (req as any).user;

      // Verify user is the technician or has owner/manager role
      if (user.id !== technicianId && !['owner', 'manager'].includes(user.role)) {
        return res.status(403).json({
          success: false,
          error: 'Unauthorized to view this technician\'s deposits'
        });
      }

      const today = new Date();
      const todayDate = format(today, 'yyyy-MM-dd');

      // Find or initialize today's deposit record
      const [depositRecord] = await db
        .select()
        .from(technicianDeposits)
        .where(
          and(
            eq(technicianDeposits.technicianId, technicianId),
            eq(technicianDeposits.depositDate, todayDate)
          )
        )
        .limit(1);

      // Get today's cash/check invoices for this technician
      const todayStart = startOfDay(today);
      const todayEnd = endOfDay(today);

      const cashCheckInvoices = await db
        .select()
        .from(invoices)
        .where(
          and(
            eq(invoices.technicianId, technicianId),
            or(
              eq(invoices.paymentMethod, 'cash'),
              eq(invoices.paymentMethod, 'check')
            ),
            eq(invoices.paymentStatus, 'pending'),
            gte(invoices.createdAt, todayStart),
            lte(invoices.createdAt, todayEnd)
          )
        );

      // Calculate totals
      let cashAmount = 0;
      let checkAmount = 0;

      cashCheckInvoices.forEach((inv: any) => {
        const amount = parseFloat(inv.amount);
        if (inv.paymentMethod === 'cash') {
          cashAmount += amount;
        } else if (inv.paymentMethod === 'check') {
          checkAmount += amount;
        }
      });

      const totalAmount = cashAmount + checkAmount;

      res.status(200).json({
        success: true,
        data: {
          depositRecord: depositRecord || null,
          cashAmount: cashAmount.toFixed(2),
          checkAmount: checkAmount.toFixed(2),
          totalAmount: totalAmount.toFixed(2),
          invoiceCount: cashCheckInvoices.length,
          invoices: cashCheckInvoices,
        }
      });
    } catch (error) {
      console.error('[TECH-DEPOSITS] Error fetching today\'s deposits:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch today\'s deposits'
      });
    }
  });

  /**
   * GET /api/tech-deposits/history/:technicianId
   * Fetch last 30 days of deposits for technician
   */
  router.get('/tech-deposits/history/:technicianId', requireAuth, async (req: Request, res: Response) => {
    try {
      const technicianId = parseInt(req.params.technicianId);
      const user = (req as any).user;

      // Verify user is the technician or has owner/manager role
      if (user.id !== technicianId && !['owner', 'manager'].includes(user.role)) {
        return res.status(403).json({
          success: false,
          error: 'Unauthorized to view this technician\'s deposits'
        });
      }

      const thirtyDaysAgo = subDays(new Date(), 30);
      const thirtyDaysAgoDate = format(thirtyDaysAgo, 'yyyy-MM-dd');

      const deposits = await db
        .select()
        .from(technicianDeposits)
        .where(
          and(
            eq(technicianDeposits.technicianId, technicianId),
            gte(technicianDeposits.depositDate, thirtyDaysAgoDate)
          )
        )
        .orderBy(desc(technicianDeposits.depositDate));

      res.status(200).json({
        success: true,
        data: deposits
      });
    } catch (error) {
      console.error('[TECH-DEPOSITS] Error fetching deposit history:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch deposit history'
      });
    }
  });

  /**
   * GET /api/tech-deposits/history
   * Fetch last 7 days of deposits for all technicians (owner/manager only)
   */
  router.get('/tech-deposits/history', requireAuth, requireRole('owner', 'manager'), async (req: Request, res: Response) => {
    try {
      const sevenDaysAgo = subDays(new Date(), 7);
      const sevenDaysAgoDate = format(sevenDaysAgo, 'yyyy-MM-dd');

      const allDeposits = await db
        .select({
          deposit: technicianDeposits,
          technicianName: users.fullName,
          technicianUsername: users.username,
        })
        .from(technicianDeposits)
        .leftJoin(users, eq(technicianDeposits.technicianId, users.id))
        .where(gte(technicianDeposits.depositDate, sevenDaysAgoDate))
        .orderBy(desc(technicianDeposits.depositDate));

      // Transform to include technician name
      const deposits = allDeposits.map(record => ({
        ...record.deposit,
        technicianName: record.technicianName || record.technicianUsername || 'Unknown',
      }));

      res.status(200).json({
        success: true,
        data: deposits
      });
    } catch (error) {
      console.error('[TECH-DEPOSITS] Error fetching all deposit history:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch deposit history'
      });
    }
  });

  /**
   * GET /api/tech-deposits/pending
   * Fetch all pending deposits across all technicians (owner/manager only)
   */
  router.get('/tech-deposits/pending', requireAuth, requireRole('owner', 'manager'), async (req: Request, res: Response) => {
    try {
      // Get all pending deposits
      const pendingDeposits = await db
        .select({
          deposit: technicianDeposits,
          technicianName: users.fullName,
          technicianUsername: users.username,
        })
        .from(technicianDeposits)
        .leftJoin(users, eq(technicianDeposits.technicianId, users.id))
        .where(eq(technicianDeposits.status, 'pending'))
        .orderBy(desc(technicianDeposits.depositDate));

      // Group by technician
      const groupedByTechnician: Record<number, any> = {};

      for (const record of pendingDeposits) {
        const techId = record.deposit.technicianId;
        
        if (!groupedByTechnician[techId]) {
          groupedByTechnician[techId] = {
            technicianId: techId,
            technicianName: record.technicianName || record.technicianUsername,
            deposits: [],
            totalCash: 0,
            totalCheck: 0,
            totalAmount: 0,
            invoiceCount: 0,
          };
        }

        groupedByTechnician[techId].deposits.push(record.deposit);
        groupedByTechnician[techId].totalCash += parseFloat(record.deposit.cashAmount || '0');
        groupedByTechnician[techId].totalCheck += parseFloat(record.deposit.checkAmount || '0');
        groupedByTechnician[techId].totalAmount += parseFloat(record.deposit.totalAmount || '0');
        groupedByTechnician[techId].invoiceCount += (record.deposit.invoiceIds?.length || 0);
      }

      const grouped = Object.values(groupedByTechnician);

      res.status(200).json({
        success: true,
        data: grouped
      });
    } catch (error) {
      console.error('[TECH-DEPOSITS] Error fetching pending deposits:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch pending deposits'
      });
    }
  });

  /**
   * POST /api/tech-deposits/:depositId/mark-deposited
   * Mark deposit as deposited (owner/manager only)
   */
  router.post('/tech-deposits/:depositId/mark-deposited', requireAuth, requireRole('owner', 'manager'), async (req: Request, res: Response) => {
    try {
      const depositId = parseInt(req.params.depositId);
      const user = (req as any).user;

      // Get the deposit record
      const [deposit] = await db
        .select()
        .from(technicianDeposits)
        .where(eq(technicianDeposits.id, depositId))
        .limit(1);

      if (!deposit) {
        return res.status(404).json({
          success: false,
          error: 'Deposit record not found'
        });
      }

      if (deposit.status === 'deposited') {
        return res.status(400).json({
          success: false,
          error: 'Deposit already marked as deposited'
        });
      }

      // Update deposit status
      await db
        .update(technicianDeposits)
        .set({
          status: 'deposited',
          depositedAt: new Date(),
          depositedBy: user.id,
        })
        .where(eq(technicianDeposits.id, depositId));

      // Get technician name for notification
      const [technicianUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, deposit.technicianId))
        .limit(1);

      const techName = technicianUser?.fullName || technicianUser?.username || 'Technician';

      // Send confirmation notification to technician
      try {
        await sendPushNotification(deposit.technicianId, {
          title: 'Deposit Confirmed',
          body: `Your ${format(new Date(deposit.depositDate), 'MMM d')} deposit of $${deposit.totalAmount} has been confirmed by ${user.fullName || user.username}.`,
          tag: `deposit-confirmed-${depositId}`,
          data: {
            type: 'deposit_confirmed',
            depositId: depositId,
            amount: deposit.totalAmount,
          },
        });
      } catch (notificationError) {
        console.error('[TECH-DEPOSITS] Failed to send notification:', notificationError);
        // Don't fail the request if notification fails
      }

      res.status(200).json({
        success: true,
        message: `Deposit confirmed for ${techName}`,
      });
    } catch (error) {
      console.error('[TECH-DEPOSITS] Error marking deposit as deposited:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to mark deposit as deposited'
      });
    }
  });

  app.use('/api', router);
}
