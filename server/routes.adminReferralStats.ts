import { Express, Request, Response } from 'express';
import { requireAuth } from './authMiddleware';
import { referrals, customers } from '@shared/schema';
import { eq, sql, desc } from 'drizzle-orm';

/**
 * Register admin referral statistics routes
 */
export function registerAdminReferralStatsRoutes(app: Express) {
  
  /**
   * Get comprehensive referral statistics for admin dashboard
   * Returns overview stats, top referrers, and recent referrals
   */
  app.get('/api/admin/referral-stats', requireAuth, async (req: Request, res: Response) => {
    try {
      // Get all referrals with referrer names
      const allReferrals = await req.tenantDb!
        .select({
          id: referrals.id,
          referrerId: referrals.referrerId,
          referrerName: customers.name,
          referralCode: referrals.referralCode,
          refereeName: referrals.refereeName,
          refereePhone: referrals.refereePhone,
          refereeEmail: referrals.refereeEmail,
          status: referrals.status,
          pointsAwarded: referrals.pointsAwarded,
          createdAt: referrals.createdAt,
          signedUpAt: referrals.signedUpAt,
          completedAt: referrals.completedAt,
          rewardedAt: referrals.rewardedAt,
        })
        .from(referrals)
        .leftJoin(customers, eq(referrals.referrerId, customers.id))
        .where(req.tenantDb!.withTenantFilter(referrals))
        .orderBy(desc(referrals.createdAt));

      // Calculate overall stats
      const totalReferrals = allReferrals.length;
      const pending = allReferrals.filter(r => r.status === 'pending').length;
      const signedUp = allReferrals.filter(r => r.status === 'signed_up').length;
      const completed = allReferrals.filter(r => r.status === 'first_service_completed').length;
      const rewarded = allReferrals.filter(r => r.status === 'rewarded').length;
      const totalPointsAwarded = allReferrals
        .filter(r => r.status === 'rewarded')
        .reduce((sum, r) => sum + (r.pointsAwarded || 0), 0);

      // Calculate conversion rate (rewarded / total)
      const conversionRate = totalReferrals > 0 
        ? Math.round((rewarded / totalReferrals) * 100) 
        : 0;

      // Calculate top referrers
      const referrerMap = new Map<number, {
        customerId: number;
        customerName: string;
        referralCount: number;
        completedCount: number;
        totalPoints: number;
      }>();

      allReferrals.forEach(referral => {
        // Skip referrals with null/undefined referrerId (Issue #3 fix)
        if (!referral.referrerId) {
          console.warn(`[ADMIN REFERRAL STATS] Skipping referral ${referral.id} with null referrerId`);
          return;
        }

        const existing = referrerMap.get(referral.referrerId);
        const isCompleted = referral.status === 'first_service_completed' || referral.status === 'rewarded';
        const points = referral.status === 'rewarded' ? (referral.pointsAwarded || 0) : 0;

        if (existing) {
          existing.referralCount++;
          if (isCompleted) existing.completedCount++;
          existing.totalPoints += points;
        } else {
          referrerMap.set(referral.referrerId, {
            customerId: referral.referrerId,
            customerName: referral.referrerName || 'Unknown Customer',
            referralCount: 1,
            completedCount: isCompleted ? 1 : 0,
            totalPoints: points,
          });
        }
      });

      // Get top 10 referrers by completed count
      const topReferrers = Array.from(referrerMap.values())
        .sort((a, b) => b.completedCount - a.completedCount)
        .slice(0, 10);

      // Get 20 most recent referrals
      const recentReferrals = allReferrals.slice(0, 20);

      const stats = {
        totalReferrals,
        pending,
        signedUp,
        completed,
        rewarded,
        totalPointsAwarded,
        conversionRate,
        topReferrers,
        recentReferrals,
      };

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error('[ADMIN REFERRAL STATS] Error fetching stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch referral statistics',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
}
