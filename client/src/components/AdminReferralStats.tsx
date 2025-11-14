import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  Gift, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  Award,
  Target
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ReferralRecord {
  id: number;
  referrerId: number;
  referrerName: string;
  referralCode: string;
  refereeName: string | null;
  refereePhone: string | null;
  refereeEmail: string | null;
  status: string;
  pointsAwarded: number;
  createdAt: string;
  signedUpAt: string | null;
  completedAt: string | null;
  rewardedAt: string | null;
}

interface AdminReferralStats {
  totalReferrals: number;
  pending: number;
  signedUp: number;
  completed: number;
  rewarded: number;
  totalPointsAwarded: number;
  conversionRate: number;
  topReferrers: {
    customerId: number;
    customerName: string;
    referralCount: number;
    completedCount: number;
    totalPoints: number;
  }[];
  recentReferrals: ReferralRecord[];
}

export default function AdminReferralStats() {
  const { data, isLoading } = useQuery<{ success: boolean; data: AdminReferralStats }>({
    queryKey: ['/api/admin/referral-stats'],
  });

  const stats = data?.data;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'signed_up':
        return <Users className="h-4 w-4 text-blue-600" />;
      case 'first_service_completed':
      case 'rewarded':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      pending: 'secondary',
      signed_up: 'default',
      first_service_completed: 'default',
      rewarded: 'default',
    };

    const labels: Record<string, string> = {
      pending: 'Pending',
      signed_up: 'Signed Up',
      first_service_completed: 'Service Completed',
      rewarded: 'Rewarded',
    };

    return (
      <Badge variant={variants[status] || 'secondary'}>
        {labels[status] || status}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="text-center py-10">
        <p className="text-gray-600 dark:text-gray-400">Loading referral statistics...</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-10">
        <p className="text-gray-600 dark:text-gray-400">No referral data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <Gift className="h-6 w-6 mx-auto mb-2 text-purple-600" />
            <div className="text-2xl font-bold">{stats.totalReferrals}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Total Referrals</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Clock className="h-6 w-6 mx-auto mb-2 text-yellow-600" />
            <div className="text-2xl font-bold">{stats.pending}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Pending</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Users className="h-6 w-6 mx-auto mb-2 text-blue-600" />
            <div className="text-2xl font-bold">{stats.signedUp}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Signed Up</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="h-6 w-6 mx-auto mb-2 text-green-600" />
            <div className="text-2xl font-bold">{stats.completed}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Completed</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Award className="h-6 w-6 mx-auto mb-2 text-orange-600" />
            <div className="text-2xl font-bold">{stats.rewarded}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Rewarded</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Target className="h-6 w-6 mx-auto mb-2 text-indigo-600" />
            <div className="text-2xl font-bold">{stats.conversionRate}%</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Conversion</div>
          </CardContent>
        </Card>
      </div>

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Referral Program Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Total Points Awarded</span>
              <span className="font-semibold">{stats.totalPointsAwarded.toLocaleString()} points</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Success Rate (Rewarded / Total)</span>
              <span className="font-semibold">
                {stats.totalReferrals > 0 
                  ? Math.round((stats.rewarded / stats.totalReferrals) * 100) 
                  : 0}%
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Signup Rate (Signed Up / Total)</span>
              <span className="font-semibold">
                {stats.totalReferrals > 0 
                  ? Math.round(((stats.signedUp + stats.completed + stats.rewarded) / stats.totalReferrals) * 100) 
                  : 0}%
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top Referrers */}
      {stats.topReferrers && stats.topReferrers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top Referrers</CardTitle>
            <CardDescription>Customers with the most successful referrals</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rank</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Total Referrals</TableHead>
                  <TableHead className="text-right">Completed</TableHead>
                  <TableHead className="text-right">Points Earned</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.topReferrers.map((referrer, index) => (
                  <TableRow key={referrer.customerId}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {index === 0 && <Award className="h-5 w-5 text-yellow-500" />}
                        {index === 1 && <Award className="h-5 w-5 text-gray-400" />}
                        {index === 2 && <Award className="h-5 w-5 text-orange-600" />}
                        <span className="font-semibold">#{index + 1}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{referrer.customerName}</TableCell>
                    <TableCell className="text-right">{referrer.referralCount}</TableCell>
                    <TableCell className="text-right">{referrer.completedCount}</TableCell>
                    <TableCell className="text-right font-semibold text-green-600">
                      {referrer.totalPoints.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Recent Referrals */}
      {stats.recentReferrals && stats.recentReferrals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Referrals</CardTitle>
            <CardDescription>Latest referral activity across all customers</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Referrer</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Referee</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Points</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.recentReferrals.map((referral) => (
                  <TableRow key={referral.id} data-testid={`admin-referral-${referral.id}`}>
                    <TableCell className="text-sm">
                      {new Date(referral.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="font-medium">{referral.referrerName}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{referral.referralCode}</Badge>
                    </TableCell>
                    <TableCell>
                      {referral.refereeName || referral.refereePhone || referral.refereeEmail || 'Pending'}
                    </TableCell>
                    <TableCell>{getStatusBadge(referral.status)}</TableCell>
                    <TableCell className="text-right">
                      {referral.status === 'rewarded' ? (
                        <span className="font-semibold text-green-600">
                          +{referral.pointsAwarded}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
