/**
 * CM-REWARDS-WELCOME-LANDING
 * 
 * A celebratory landing page for customers who tap the SMS link that says:
 * "Sorry I missed your message... here are 500 bonus points..."
 * 
 * Features:
 * - Greets customer by name
 * - Celebrates points with confetti/motion
 * - Shows current balance + what points can buy
 * - Book Now button going straight into booking
 * - Holiday gift card mention
 * - Floating chat bubble
 * 
 * Route: /rewards/welcome?token=<customerToken>
 */
import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Seo } from '@/components/Seo';
import { FloatingChatButton } from '@/components/chat/FloatingChatButton';
import {
  PartyPopper,
  Gift,
  Calendar,
  Star,
  ChevronRight,
  Sparkles,
  Trophy,
  Heart,
  MessageCircle,
  Loader2,
  AlertCircle,
  RefreshCw
} from 'lucide-react';

interface LoyaltyData {
  customer: {
    id: number;
    name: string;
    email: string;
    phone: string;
  };
  loyaltyPoints: {
    id: number;
    points: number;
    lastUpdated: string;
    expiryDate: string;
  } | null;
  transactions: Array<{
    id: number;
    amount: number;
    description: string;
    transactionDate: string;
    transactionType: 'earn' | 'redeem' | 'expire';
  }>;
  message: string;
}

interface RewardService {
  id: number;
  name: string;
  description: string;
  pointCost: number;
  tier: string;
  active: boolean;
}

const triggerCelebration = async () => {
  const count = 200;
  const defaults = { origin: { y: 0.7 }, zIndex: 9999 };
  const confettiModule = await import('canvas-confetti');
  const confettiFn = confettiModule.default;

  function fire(particleRatio: number, opts: any) {
    confettiFn({ ...defaults, ...opts, particleCount: Math.floor(count * particleRatio) });
  }

  fire(0.25, { spread: 26, startVelocity: 55 });
  fire(0.2, { spread: 60 });
  fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
  fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
  fire(0.1, { spread: 120, startVelocity: 45 });
};

export default function PointsWelcomeLandingPage() {
  const [, setLocation] = useLocation();
  const [token, setToken] = useState<string | null>(null);
  const [hasCelebrated, setHasCelebrated] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get('token');
    setToken(tokenParam);
  }, []);

  const { data: loyaltyResponse, isLoading, isError, error, refetch } = useQuery<{ success: boolean; data: LoyaltyData; expired?: boolean }>({
    queryKey: ['/api/loyalty/points/token', token],
    queryFn: async () => {
      if (!token) throw new Error('No token provided');
      const res = await fetch(`/api/loyalty/points/token/${encodeURIComponent(token)}`);
      const data = await res.json();
      if (!res.ok) throw { ...data, status: res.status };
      return data;
    },
    enabled: !!token,
    retry: false,
  });

  const { data: rewardsData } = useQuery<{ success: boolean; data: RewardService[] }>({
    queryKey: ['/api/loyalty/rewards'],
    enabled: !!loyaltyResponse?.success,
  });

  const { data: galleryData } = useQuery<{ success: boolean; photos: Array<{ id: number; imageUrl: string; title: string }> }>({
    queryKey: ['/api/gallery'],
    enabled: !!loyaltyResponse?.success,
  });

  const loyaltyData = loyaltyResponse?.data;
  const rewards = rewardsData?.data?.filter(r => r.active).sort((a, b) => a.pointCost - b.pointCost) || [];
  const currentPoints = loyaltyData?.loyaltyPoints?.points || 0;
  const firstName = loyaltyData?.customer?.name?.split(' ')[0] || 'there';
  const photos = galleryData?.photos?.slice(0, 6) || [];

  useEffect(() => {
    if (loyaltyData && currentPoints > 0 && !hasCelebrated) {
      setHasCelebrated(true);
      setTimeout(() => triggerCelebration(), 500);
    }
  }, [loyaltyData, currentPoints, hasCelebrated]);

  const getPointsValue = () => {
    if (rewards.length === 0) return null;
    const affordable = rewards.filter(r => r.pointCost <= currentPoints);
    if (affordable.length > 0) {
      return `Redeem for ${affordable.length} reward${affordable.length > 1 ? 's' : ''}`;
    }
    const next = rewards[0];
    return `${next.pointCost - currentPoints} more to ${next.name}`;
  };

  const handleBookNow = () => {
    const params = new URLSearchParams();
    if (loyaltyData?.customer?.phone) {
      params.set('phone', loyaltyData.customer.phone.replace(/\D/g, ''));
    }
    if (loyaltyData?.customer?.name) {
      params.set('name', loyaltyData.customer.name);
    }
    setLocation(`/schedule?${params.toString()}`);
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-pink-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-white/10 backdrop-blur-xl border-white/20 text-white">
          <CardContent className="pt-8 pb-8 text-center">
            <AlertCircle className="w-16 h-16 mx-auto mb-4 text-yellow-400" />
            <h2 className="text-xl font-bold mb-2">Link Required</h2>
            <p className="text-purple-200 mb-6">
              Please use the link from your text message to view your points.
            </p>
            <Button
              variant="outline"
              className="border-white/30 text-white hover:bg-white/10"
              onClick={() => setLocation('/rewards')}
              data-testid="button-go-to-rewards"
            >
              Look up my points
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-pink-900 flex items-center justify-center">
        <div className="text-center text-white">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" />
          <p className="text-lg">Loading your points...</p>
        </div>
      </div>
    );
  }

  if (isError || !loyaltyData) {
    const isExpired = (error as any)?.expired;
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-pink-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-white/10 backdrop-blur-xl border-white/20 text-white">
          <CardContent className="pt-8 pb-8 text-center">
            <AlertCircle className="w-16 h-16 mx-auto mb-4 text-yellow-400" />
            <h2 className="text-xl font-bold mb-2">
              {isExpired ? 'Link Expired' : 'Something went wrong'}
            </h2>
            <p className="text-purple-200 mb-6">
              {isExpired 
                ? "This link has expired or is already used. Tap the chat bubble or text us and we'll resend your points link."
                : "We couldn't load your points. Please try again or contact us for help."}
            </p>
            <div className="flex flex-col gap-3">
              <Button
                variant="outline"
                className="border-white/30 text-white hover:bg-white/10"
                onClick={() => refetch()}
                data-testid="button-retry"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Try again
              </Button>
              <Button
                variant="ghost"
                className="text-purple-300 hover:text-white"
                onClick={() => setLocation('/rewards')}
                data-testid="button-lookup"
              >
                Look up by phone number
              </Button>
            </div>
          </CardContent>
        </Card>
        <FloatingChatButton />
      </div>
    );
  }

  return (
    <>
      <Seo 
        title="Your Points Are Ready! | Clean Machine Auto Detail"
        description="Check your loyalty points balance and redeem rewards at Clean Machine Auto Detail."
      />
      
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-pink-900 overflow-x-hidden">
        <div className="container mx-auto px-4 py-8 md:py-12">
          <div className="grid md:grid-cols-2 gap-8 items-start max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, type: 'spring' }}
              >
                <Card className="bg-gradient-to-br from-purple-600/90 to-pink-600/90 backdrop-blur-xl border-0 shadow-2xl shadow-purple-500/30 overflow-hidden">
                  <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iNCIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
                  <CardContent className="pt-8 pb-10 relative">
                    <div className="text-center space-y-4">
                      <motion.div
                        initial={{ y: -10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="inline-flex items-center gap-2 bg-white/20 backdrop-blur rounded-full px-4 py-1.5"
                      >
                        <PartyPopper className="w-4 h-4 text-yellow-300" />
                        <span className="text-sm font-medium text-white">Welcome back!</span>
                      </motion.div>

                      <motion.h1
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.4, type: 'spring' }}
                        className="text-2xl md:text-3xl font-bold text-white leading-tight"
                        data-testid="text-greeting"
                      >
                        Hey {firstName}, your Clean Machine points are live 🎉
                      </motion.h1>

                      <motion.div
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.5, type: 'spring', stiffness: 200 }}
                        className="py-4"
                      >
                        <div
                          className="text-6xl md:text-7xl font-bold text-white tracking-tight"
                          data-testid="text-points-balance"
                        >
                          {currentPoints.toLocaleString()}
                        </div>
                        <p className="text-purple-100 text-lg mt-1">reward points</p>
                        {getPointsValue() && (
                          <Badge className="mt-3 bg-white/20 text-white border-0 text-sm px-4 py-1">
                            {getPointsValue()}
                          </Badge>
                        )}
                      </motion.div>

                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.6 }}
                        className="text-purple-100/90 text-sm md:text-base max-w-md mx-auto"
                      >
                        We've been upgrading our phone system behind the scenes, and a few calls slipped through the cracks. To make it up to you, we loaded bonus loyalty points into your account so your next detail is easier to say yes to.
                      </motion.p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="flex flex-col sm:flex-row gap-3"
              >
                <Button
                  size="lg"
                  onClick={handleBookNow}
                  className="flex-1 bg-white text-purple-700 hover:bg-purple-50 shadow-lg text-lg py-6"
                  data-testid="button-book-now"
                >
                  <Calendar className="w-5 h-5 mr-2" />
                  Book a Detail with My Points
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => setLocation('/rewards')}
                  className="border-white/30 text-white hover:bg-white/10"
                  data-testid="button-browse-rewards"
                >
                  Browse all rewards
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </motion.div>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="text-purple-200/70 text-sm text-center"
              >
                Grab a spot on the schedule now and we'll automatically apply your points at the time of service.
              </motion.p>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9 }}
                className="text-center"
              >
                <Button
                  variant="ghost"
                  onClick={() => setLocation('/')}
                  className="text-purple-300 hover:text-white hover:bg-white/10"
                  data-testid="button-browse-services"
                >
                  Browse services & pricing
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
              className="space-y-6"
            >
              {rewards.length > 0 && (
                <Card className="bg-white/10 backdrop-blur-xl border-white/20">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg text-white flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-yellow-400" />
                      What your points can do
                    </CardTitle>
                    <CardDescription className="text-purple-200/70">
                      Redeem for free upgrades and discounts
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {rewards.slice(0, 4).map((reward, index) => {
                      const canAfford = currentPoints >= reward.pointCost;
                      const progress = Math.min(100, (currentPoints / reward.pointCost) * 100);
                      return (
                        <motion.div
                          key={reward.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.6 + index * 0.1 }}
                          className={`p-3 rounded-lg border transition-all ${
                            canAfford 
                              ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-green-400/30' 
                              : 'bg-white/5 border-white/10'
                          }`}
                          data-testid={`reward-item-${reward.id}`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-white flex items-center gap-2">
                              {canAfford && <Star className="w-4 h-4 text-yellow-400" />}
                              {reward.name}
                            </h4>
                            <Badge className={canAfford ? 'bg-green-500/20 text-green-300 border-green-400/30' : 'bg-purple-500/20 text-purple-200 border-purple-400/30'}>
                              {reward.pointCost.toLocaleString()} pts
                            </Badge>
                          </div>
                          <p className="text-xs text-purple-200/70 mb-2 line-clamp-1">{reward.description}</p>
                          {!canAfford && (
                            <Progress value={progress} className="h-1.5 bg-white/10" />
                          )}
                        </motion.div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 }}
              >
                <Card className="bg-gradient-to-br from-red-500/20 to-orange-500/20 backdrop-blur-xl border-red-400/20">
                  <CardContent className="pt-6 pb-6">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shrink-0">
                        <Gift className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-white mb-1">
                          Perfect time for gift cards 🎁
                        </h3>
                        <p className="text-sm text-purple-200/80 mb-4">
                          If you've got a car-lover, busy parent, or road warrior in your life, a Clean Machine gift card is a ridiculously easy win. You tap a few buttons, they get a spotless car and all the credit goes to you.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-white/30 text-white hover:bg-white/10"
                          onClick={() => setLocation('/gift-cards')}
                          data-testid="button-gift-cards"
                        >
                          <Heart className="w-4 h-4 mr-2 text-red-400" />
                          Get a gift card
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {photos.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1 }}
                >
                  <Card className="bg-white/5 backdrop-blur-xl border-white/10 overflow-hidden">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-purple-200/70 flex items-center gap-2">
                        <Trophy className="w-4 h-4" />
                        Recent work
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-2">
                      <div className="grid grid-cols-3 gap-1">
                        {photos.map((photo) => (
                          <div
                            key={photo.id}
                            className="aspect-square rounded overflow-hidden"
                          >
                            <img
                              src={photo.imageUrl}
                              alt={photo.title || 'Detail work'}
                              className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                              loading="lazy"
                            />
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.1 }}
                className="text-purple-200/60 text-xs text-center flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-4 h-4" />
                Questions about your points or booking? Tap the chat bubble and we'll help you out.
              </motion.p>
            </motion.div>
          </div>
        </div>

        <FloatingChatButton 
          customerName={loyaltyData?.customer?.name}
          customerPhone={loyaltyData?.customer?.phone}
        />
      </div>
    </>
  );
}
