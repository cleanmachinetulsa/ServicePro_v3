import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Star, Award, Gift, Zap, TrendingUp, ArrowRight } from 'lucide-react';
import { Link } from 'wouter';
import { motion } from 'framer-motion';

interface LoyaltyData {
  customer: {
    id: number;
    name: string;
    phone: string;
  } | null;
  loyaltyPoints: {
    points: number;
    tier: string;
  } | null;
}

export function LoyaltyBanner({ variant = 'compact' }: { variant?: 'compact' | 'full' }) {
  const { data: userData } = useQuery<{ user: { phone?: string } }>({
    queryKey: ['/api/users/me'],
  });

  const { data: loyaltyData } = useQuery<LoyaltyData>({
    queryKey: ['/api/loyalty/status', userData?.user?.phone],
    enabled: !!userData?.user?.phone,
    queryFn: async () => {
      const response = await fetch(`/api/loyalty/status?phone=${userData?.user?.phone}`);
      if (!response.ok) throw new Error('Failed to fetch loyalty data');
      return response.json();
    },
  });

  if (!loyaltyData?.loyaltyPoints) {
    // Show promotional banner for non-members
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/30 dark:via-indigo-950/30 dark:to-purple-950/30 border-blue-200 dark:border-blue-800">
          <div className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <Gift className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-yellow-500" />
                  Join Our Loyalty Program!
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Earn 1 point for every $1 spent • Unlock exclusive rewards • VIP perks
                </p>
              </div>
            </div>
            <Link href="/rewards">
              <Button 
                size="sm" 
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                data-testid="button-join-loyalty"
              >
                Learn More
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </Card>
      </motion.div>
    );
  }

  const points = loyaltyData.loyaltyPoints.points;
  const tier = loyaltyData.loyaltyPoints.tier || 'Standard';
  
  // Calculate next tier
  const tiers = [
    { name: 'Standard', threshold: 0, color: 'gray', icon: '🌟' },
    { name: 'Bronze', threshold: 500, color: 'orange', icon: '🥉' },
    { name: 'Silver', threshold: 1000, color: 'gray', icon: '🥈' },
    { name: 'Gold', threshold: 2000, color: 'yellow', icon: '🥇' },
    { name: 'Platinum', threshold: 3000, color: 'purple', icon: '💎' },
  ];

  const currentTierIndex = tiers.findIndex(t => t.name === tier);
  const currentTier = tiers[currentTierIndex] || tiers[0];
  const nextTier = tiers[currentTierIndex + 1];
  const pointsToNext = nextTier ? nextTier.threshold - points : 0;
  const progress = nextTier ? ((points - currentTier.threshold) / (nextTier.threshold - currentTier.threshold)) * 100 : 100;

  if (variant === 'compact') {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/40 dark:via-indigo-950/40 dark:to-purple-950/40 border-blue-200 dark:border-blue-800">
          <div className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-1">
              <div className="h-14 w-14 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-2xl">
                {currentTier.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge 
                    variant="secondary" 
                    className={`bg-${currentTier.color}-100 text-${currentTier.color}-800 dark:bg-${currentTier.color}-900/30 dark:text-${currentTier.color}-300`}
                  >
                    {tier} Member
                  </Badge>
                  <span className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1">
                    <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                    {points.toLocaleString()}
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">points</span>
                </div>
                {nextTier && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600 dark:text-gray-400 flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        {pointsToNext} points to {nextTier.icon} {nextTier.name}
                      </span>
                      <span className="font-medium text-blue-600 dark:text-blue-400">{Math.round(progress)}%</span>
                    </div>
                    <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <motion.div 
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-600"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
            <Link href="/rewards">
              <Button 
                variant="outline" 
                size="sm"
                className="whitespace-nowrap"
                data-testid="button-view-rewards"
              >
                View Rewards
                <Award className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </Card>
      </motion.div>
    );
  }

  return null;
}
