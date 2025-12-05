/**
 * Customer Rewards Portal V2
 * 
 * This is the primary customer-facing entry point for viewing loyalty points,
 * milestones, and available rewards. It builds on existing loyalty APIs:
 * - GET /api/loyalty/points/phone/:phone - Phone lookup
 * - GET /api/loyalty/rewards - Available rewards catalog
 * - GET /api/loyalty/guardrails - Redemption requirements
 * - POST /api/loyalty/redeem - Redeem points
 * - POST /api/loyalty/opt-in - Enroll in program
 * 
 * Designed as a premium, mobile-first experience (393px primary viewport).
 * Three states: Phone Lookup, Customer Found, No Customer Found
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Gift, 
  Star, 
  Trophy, 
  Sparkles, 
  Phone, 
  ChevronRight, 
  Check, 
  Lock, 
  ArrowLeft,
  Award,
  Zap,
  Crown,
  Target,
  Clock,
  AlertCircle,
  PartyPopper,
  Calendar
} from 'lucide-react';
import { useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { motion, AnimatePresence } from 'framer-motion';

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

interface LoyaltyPointsResponse {
  success: boolean;
  data: {
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
    source?: string;
  };
}

interface RewardService {
  id: number;
  name: string;
  description: string;
  pointCost: number;
  tier: string;
  active: boolean;
}

interface GuardrailSettings {
  minCartTotalEnabled: boolean;
  minCartTotal: number;
  requireCoreServiceEnabled: boolean;
  coreServiceCategories: string[];
  loyaltyGuardrailMessage: string;
}

const MILESTONES = [
  { points: 500, name: 'Bronze Reward', icon: Award, color: 'from-amber-500 to-orange-600' },
  { points: 1000, name: 'Silver Reward', icon: Star, color: 'from-slate-400 to-slate-600' },
  { points: 2000, name: 'Gold Reward', icon: Crown, color: 'from-yellow-400 to-amber-500' },
  { points: 3000, name: 'Platinum Reward', icon: Trophy, color: 'from-violet-500 to-purple-700' },
];

const formatPhone = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

const CustomerRewardsPortal = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [phoneInput, setPhoneInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [loyaltyData, setLoyaltyData] = useState<LoyaltyPointsResponse['data'] | null>(null);
  const [selectedReward, setSelectedReward] = useState<RewardService | null>(null);
  const [redeemDialogOpen, setRedeemDialogOpen] = useState(false);
  const [optInDialogOpen, setOptInDialogOpen] = useState(false);
  
  /**
   * Navigate to booking with reward context
   * Loyalty Redemption Journey v2: "Use on my next booking" CTA
   */
  const navigateToBookingWithReward = (reward: RewardService) => {
    const phone = phoneInput.replace(/\D/g, '');
    const params = new URLSearchParams({
      rewardId: reward.id.toString(),
      rewardName: reward.name,
      rewardPoints: reward.pointCost.toString(),
    });
    if (phone) {
      params.set('phone', phone);
    }
    if (loyaltyData?.customer?.name) {
      params.set('name', loyaltyData.customer.name);
    }
    setLocation(`/schedule?${params.toString()}`);
  };
  
  const { data: rewardsData } = useQuery<{ success: boolean; data: RewardService[] }>({
    queryKey: ['/api/loyalty/rewards'],
  });
  
  const { data: guardrailsData } = useQuery<{ success: boolean; data: GuardrailSettings }>({
    queryKey: ['/api/loyalty/guardrails'],
  });
  
  const rewards = rewardsData?.data || [];
  const guardrails = guardrailsData?.data;
  
  const searchForPoints = async () => {
    const digits = phoneInput.replace(/\D/g, '');
    if (digits.length < 10) {
      toast({
        title: "Please enter a valid phone number",
        description: "Enter your 10-digit mobile number",
        variant: "destructive",
      });
      return;
    }
    
    setIsSearching(true);
    setHasSearched(true);
    
    try {
      const response = await fetch(`/api/loyalty/points/phone/${encodeURIComponent(digits)}`);
      const result = await response.json();
      
      if (result.success && result.data) {
        setLoyaltyData(result.data);
        if (result.data.loyaltyPoints?.points >= 500) {
          triggerCelebration();
        }
      } else {
        setLoyaltyData(null);
      }
    } catch (error) {
      console.error('Error searching for loyalty points:', error);
      setLoyaltyData(null);
      toast({
        title: "Something went wrong",
        description: "Please try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };
  
  const optInMutation = useMutation<any, Error, { customerId: number }>({
    mutationFn: async ({ customerId }) => {
      return apiRequest('/api/loyalty/opt-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId }),
      });
    },
    onSuccess: (data) => {
      toast({ title: "Welcome to the rewards program!", description: "Start earning points on your next visit." });
      setOptInDialogOpen(false);
      if (loyaltyData) {
        setLoyaltyData({ ...loyaltyData, loyaltyPoints: data.data.loyaltyPoints });
      }
    },
    onError: (error) => {
      toast({ title: "Enrollment failed", description: error.message, variant: "destructive" });
    }
  });
  
  const redeemMutation = useMutation<any, Error, { rewardId: number }>({
    mutationFn: async ({ rewardId }) => {
      if (!loyaltyData?.customer?.id) throw new Error('Customer not found');
      return apiRequest('/api/loyalty/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: loyaltyData.customer.id, rewardServiceId: rewardId, quantity: 1 }),
      });
    },
    onSuccess: (data) => {
      toast({ title: "Reward redeemed!", description: data.data.message || "We'll apply this to your next visit." });
      setRedeemDialogOpen(false);
      triggerCelebration();
      if (loyaltyData && data.data.updatedPoints) {
        setLoyaltyData({ ...loyaltyData, loyaltyPoints: { ...loyaltyData.loyaltyPoints!, points: data.data.updatedPoints.points } });
      }
    },
    onError: (error) => {
      toast({ title: "Couldn't redeem", description: error.message, variant: "destructive" });
    }
  });
  
  const currentPoints = loyaltyData?.loyaltyPoints?.points || 0;
  
  const getNextMilestone = () => {
    for (const m of MILESTONES) {
      if (currentPoints < m.points) return m;
    }
    return null;
  };
  
  const getProgressToNextMilestone = () => {
    const next = getNextMilestone();
    if (!next) return 100;
    const prev = MILESTONES[MILESTONES.indexOf(next) - 1]?.points || 0;
    return Math.min(100, Math.max(0, ((currentPoints - prev) / (next.points - prev)) * 100));
  };
  
  const resetSearch = () => {
    setHasSearched(false);
    setLoyaltyData(null);
    setPhoneInput('');
  };
  
  const getRewardStatus = (reward: RewardService) => {
    if (currentPoints >= reward.pointCost) return 'available';
    return 'locked';
  };
  
  const pointsAway = (reward: RewardService) => reward.pointCost - currentPoints;
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="max-w-md mx-auto px-4 py-6 sm:py-10">
        <AnimatePresence mode="wait">
          {!hasSearched ? (
            <motion.div
              key="lookup"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="text-center space-y-3 pt-8">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring" }}
                  className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 shadow-xl shadow-purple-500/30"
                >
                  <Gift className="w-10 h-10 text-white" />
                </motion.div>
                <h1 className="text-3xl font-bold text-white">
                  Check Your Rewards
                </h1>
                <p className="text-purple-200/80 text-lg">
                  Enter your mobile number to see your points, perks, and exclusive rewards.
                </p>
              </div>
              
              <Card className="bg-white/10 backdrop-blur-xl border-white/20 shadow-2xl">
                <CardContent className="pt-6 space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-purple-100 flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      Mobile Number
                    </label>
                    <Input
                      data-testid="input-phone-lookup"
                      type="tel"
                      placeholder="(555) 123-4567"
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(formatPhone(e.target.value))}
                      onKeyDown={(e) => e.key === 'Enter' && searchForPoints()}
                      className="h-14 text-lg bg-white/90 border-0 text-slate-900 placeholder:text-slate-400 rounded-xl"
                    />
                  </div>
                  
                  <Button
                    data-testid="button-show-rewards"
                    onClick={searchForPoints}
                    disabled={isSearching}
                    className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-xl shadow-lg shadow-purple-500/30 transition-all"
                  >
                    {isSearching ? (
                      <span className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 animate-spin" />
                        Looking up...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        Show My Rewards
                        <ChevronRight className="w-5 h-5" />
                      </span>
                    )}
                  </Button>
                  
                  <p className="text-center text-purple-300/60 text-sm">
                    We'll never spam you. This just finds your existing account.
                  </p>
                </CardContent>
              </Card>
              
              <div className="grid grid-cols-4 gap-3 px-2">
                {MILESTONES.map((m, i) => (
                  <motion.div
                    key={m.points}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + i * 0.1 }}
                    className="text-center space-y-2"
                  >
                    <div className={`w-12 h-12 mx-auto rounded-full bg-gradient-to-br ${m.color} flex items-center justify-center shadow-lg`}>
                      <m.icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-xs text-purple-200/70 font-medium">
                      {m.points.toLocaleString()}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ) : loyaltyData ? (
            <motion.div
              key="found"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <button
                data-testid="button-back"
                onClick={resetSearch}
                className="flex items-center gap-2 text-purple-300 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Different number</span>
              </button>
              
              <Card className="bg-gradient-to-br from-purple-600 to-pink-600 border-0 shadow-2xl shadow-purple-500/30 overflow-hidden relative">
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iNCIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
                <CardContent className="pt-6 pb-8 relative">
                  <div className="text-center space-y-2">
                    <motion.div
                      initial={{ scale: 0.8 }}
                      animate={{ scale: 1 }}
                      className="inline-flex items-center gap-2 bg-white/20 backdrop-blur rounded-full px-4 py-1.5"
                    >
                      <PartyPopper className="w-4 h-4 text-white" />
                      <span className="text-sm font-medium text-white">
                        {loyaltyData.customer.name ? `Welcome back, ${loyaltyData.customer.name.split(' ')[0]}!` : 'Welcome back!'}
                      </span>
                    </motion.div>
                    
                    {loyaltyData.loyaltyPoints ? (
                      <>
                        <motion.div
                          initial={{ scale: 0.5, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ delay: 0.2, type: "spring" }}
                          className="text-6xl font-bold text-white tracking-tight"
                          data-testid="text-points-balance"
                        >
                          {currentPoints.toLocaleString()}
                        </motion.div>
                        <p className="text-purple-100 text-lg">reward points</p>
                        <p className="text-purple-200/70 text-sm">
                          Earn points every time you book with us
                        </p>
                      </>
                    ) : (
                      <div className="py-4">
                        <p className="text-white text-lg mb-4">You're not enrolled yet!</p>
                        <Button
                          data-testid="button-enroll"
                          onClick={() => setOptInDialogOpen(true)}
                          className="bg-white text-purple-600 hover:bg-purple-50"
                        >
                          Join Rewards Program
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
              
              {loyaltyData.loyaltyPoints && (
                <>
                  <Card className="bg-white/10 backdrop-blur-xl border-white/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg text-white flex items-center gap-2">
                        <Target className="w-5 h-5 text-purple-400" />
                        Your Progress
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {getNextMilestone() ? (
                        <>
                          <div className="flex justify-between text-sm">
                            <span className="text-purple-200">
                              {(getNextMilestone()!.points - currentPoints).toLocaleString()} points to go
                            </span>
                            <span className="text-white font-medium">
                              {getNextMilestone()!.name}
                            </span>
                          </div>
                          <Progress 
                            value={getProgressToNextMilestone()} 
                            className="h-3 bg-white/20"
                          />
                        </>
                      ) : (
                        <div className="text-center py-2">
                          <Crown className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
                          <p className="text-white font-medium">You've reached the top tier!</p>
                        </div>
                      )}
                      
                      <div className="flex justify-between pt-2">
                        {MILESTONES.map((m) => (
                          <div
                            key={m.points}
                            className={`flex flex-col items-center gap-1 ${
                              currentPoints >= m.points ? 'opacity-100' : 'opacity-40'
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${m.color} flex items-center justify-center ${
                              currentPoints >= m.points ? 'ring-2 ring-white ring-offset-2 ring-offset-transparent' : ''
                            }`}>
                              {currentPoints >= m.points ? (
                                <Check className="w-4 h-4 text-white" />
                              ) : (
                                <m.icon className="w-4 h-4 text-white" />
                              )}
                            </div>
                            <span className="text-[10px] text-purple-200 font-medium">
                              {m.points >= 1000 ? `${m.points/1000}K` : m.points}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                  
                  <div className="space-y-4">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      <Gift className="w-5 h-5 text-pink-400" />
                      Available Rewards
                    </h2>
                    
                    {rewards.filter(r => r.active).length === 0 ? (
                      <Card className="bg-white/10 backdrop-blur-xl border-white/20">
                        <CardContent className="py-8 text-center">
                          <Gift className="w-12 h-12 text-purple-400 mx-auto mb-3 opacity-50" />
                          <p className="text-purple-200">No rewards available right now</p>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="space-y-3">
                        {rewards
                          .filter(r => r.active)
                          .sort((a, b) => a.pointCost - b.pointCost)
                          .map((reward) => {
                            const status = getRewardStatus(reward);
                            const isAvailable = status === 'available';
                            
                            return (
                              <motion.div
                                key={reward.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                              >
                                <Card 
                                  data-testid={`card-reward-${reward.id}`}
                                  className={`overflow-hidden transition-all ${
                                    isAvailable 
                                      ? 'bg-white/15 backdrop-blur-xl border-green-400/50 hover:border-green-400 cursor-pointer' 
                                      : 'bg-white/5 backdrop-blur-xl border-white/10 opacity-70'
                                  }`}
                                  onClick={() => {
                                    if (isAvailable) {
                                      setSelectedReward(reward);
                                      setRedeemDialogOpen(true);
                                    }
                                  }}
                                >
                                  <CardContent className="p-4">
                                    <div className="flex items-start gap-4">
                                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                                        isAvailable 
                                          ? 'bg-gradient-to-br from-green-500 to-emerald-600' 
                                          : 'bg-white/10'
                                      }`}>
                                        {isAvailable ? (
                                          <Sparkles className="w-6 h-6 text-white" />
                                        ) : (
                                          <Lock className="w-5 h-5 text-purple-300" />
                                        )}
                                      </div>
                                      
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                          <h3 className="font-semibold text-white truncate">
                                            {reward.name}
                                          </h3>
                                          <Badge 
                                            variant={isAvailable ? "default" : "secondary"}
                                            className={isAvailable 
                                              ? 'bg-green-500/20 text-green-300 border-green-500/30 shrink-0' 
                                              : 'bg-white/10 text-purple-300 border-white/20 shrink-0'
                                            }
                                          >
                                            {reward.pointCost.toLocaleString()} pts
                                          </Badge>
                                        </div>
                                        
                                        <p className="text-sm text-purple-200/70 mt-1 line-clamp-2">
                                          {reward.description}
                                        </p>
                                        
                                        {isAvailable ? (
                                          <div className="mt-3 space-y-2">
                                            <div className="flex items-center gap-1.5 text-green-400">
                                              <Check className="w-4 h-4" />
                                              <span className="text-sm font-medium">Available now</span>
                                            </div>
                                            <Button
                                              data-testid={`button-use-reward-${reward.id}`}
                                              size="sm"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                navigateToBookingWithReward(reward);
                                              }}
                                              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-medium"
                                            >
                                              <Calendar className="w-4 h-4 mr-2" />
                                              Use on my next booking
                                            </Button>
                                          </div>
                                        ) : (
                                          <div className="flex items-center gap-1.5 mt-2 text-purple-300/60">
                                            <Zap className="w-4 h-4" />
                                            <span className="text-sm">
                                              {pointsAway(reward).toLocaleString()} points away – book another service to get closer!
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              </motion.div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                  
                  {guardrails && (guardrails.minCartTotalEnabled || guardrails.requireCoreServiceEnabled) && (
                    <Card className="bg-amber-500/10 backdrop-blur-xl border-amber-500/30">
                      <CardContent className="py-4">
                        <div className="flex items-start gap-3">
                          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                          <div className="text-sm text-amber-200/90">
                            <p className="font-medium mb-1">Redemption Requirements</p>
                            {guardrails.loyaltyGuardrailMessage || 
                              "Rewards can be redeemed when you book a core service."
                            }
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  
                  <Card className="bg-white/5 backdrop-blur-xl border-white/10">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base text-purple-200 flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        How to Redeem
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3 text-sm text-purple-300/70">
                        <div className="flex items-start gap-2">
                          <span className="w-5 h-5 rounded-full bg-purple-500/30 flex items-center justify-center text-xs text-purple-200 shrink-0">1</span>
                          <span>Tap "Use on my next booking" on any available reward above</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="w-5 h-5 rounded-full bg-purple-500/30 flex items-center justify-center text-xs text-purple-200 shrink-0">2</span>
                          <span>Book your service – we'll show your reward is being applied</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="w-5 h-5 rounded-full bg-purple-500/30 flex items-center justify-center text-xs text-purple-200 shrink-0">3</span>
                          <span>At checkout, your points are deducted and the reward is applied!</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  {loyaltyData.transactions && loyaltyData.transactions.length > 0 && (
                    <Card className="bg-white/5 backdrop-blur-xl border-white/10">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base text-purple-200">Recent Activity</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {loyaltyData.transactions.slice(0, 5).map((tx) => (
                            <div key={tx.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                  tx.transactionType === 'earn' 
                                    ? 'bg-green-500/20' 
                                    : tx.transactionType === 'redeem' 
                                      ? 'bg-blue-500/20' 
                                      : 'bg-red-500/20'
                                }`}>
                                  {tx.transactionType === 'earn' ? (
                                    <Zap className="w-4 h-4 text-green-400" />
                                  ) : tx.transactionType === 'redeem' ? (
                                    <Gift className="w-4 h-4 text-blue-400" />
                                  ) : (
                                    <Clock className="w-4 h-4 text-red-400" />
                                  )}
                                </div>
                                <div>
                                  <p className="text-sm text-white">{tx.description}</p>
                                  <p className="text-xs text-purple-300/50">
                                    {new Date(tx.transactionDate).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>
                              <span className={`font-semibold ${
                                tx.transactionType === 'earn' 
                                  ? 'text-green-400' 
                                  : tx.transactionType === 'redeem' 
                                    ? 'text-blue-400' 
                                    : 'text-red-400'
                              }`}>
                                {tx.transactionType === 'earn' ? '+' : ''}{tx.amount}
                              </span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="not-found"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <button
                data-testid="button-try-again"
                onClick={resetSearch}
                className="flex items-center gap-2 text-purple-300 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Try different number</span>
              </button>
              
              <Card className="bg-white/10 backdrop-blur-xl border-white/20">
                <CardContent className="py-10 text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-purple-500/20 mx-auto flex items-center justify-center">
                    <AlertCircle className="w-8 h-8 text-purple-400" />
                  </div>
                  
                  <div className="space-y-2">
                    <h2 className="text-xl font-bold text-white">
                      No rewards found
                    </h2>
                    <p className="text-purple-200/70">
                      We couldn't find any rewards for that number yet.
                    </p>
                    <p className="text-purple-300/50 text-sm">
                      If you've visited us before, make sure you typed the same number you gave us.
                    </p>
                  </div>
                  
                  <div className="pt-4">
                    <Button
                      variant="outline"
                      onClick={resetSearch}
                      className="border-purple-400/50 text-purple-200 hover:bg-purple-500/20"
                    >
                      Try Another Number
                    </Button>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-purple-600/50 to-pink-600/50 border-0">
                <CardContent className="py-6 text-center space-y-3">
                  <Sparkles className="w-8 h-8 text-pink-300 mx-auto" />
                  <h3 className="text-lg font-semibold text-white">
                    Start earning rewards!
                  </h3>
                  <p className="text-purple-100/80 text-sm">
                    Book your first service and you'll automatically start earning points toward free services.
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      <Dialog open={redeemDialogOpen} onOpenChange={setRedeemDialogOpen}>
        <DialogContent className="bg-slate-900 border-purple-500/30 text-white max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Gift className="w-5 h-5 text-pink-400" />
              Redeem Reward
            </DialogTitle>
            <DialogDescription className="text-purple-200/70">
              Are you sure you want to redeem this reward?
            </DialogDescription>
          </DialogHeader>
          
          {selectedReward && (
            <div className="py-4 space-y-4">
              <Card className="bg-white/10 border-white/20">
                <CardContent className="p-4">
                  <h3 className="font-semibold text-white">{selectedReward.name}</h3>
                  <p className="text-sm text-purple-200/70 mt-1">{selectedReward.description}</p>
                  <div className="flex items-center gap-2 mt-3">
                    <Badge className="bg-purple-500/20 text-purple-200 border-purple-500/30">
                      {selectedReward.pointCost.toLocaleString()} points
                    </Badge>
                  </div>
                </CardContent>
              </Card>
              
              <div className="text-center text-sm text-purple-200/60">
                After redemption, you'll have{' '}
                <span className="text-white font-semibold">
                  {(currentPoints - selectedReward.pointCost).toLocaleString()}
                </span>{' '}
                points remaining.
              </div>
            </div>
          )}
          
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setRedeemDialogOpen(false)}
              className="border-purple-400/50 text-purple-200 hover:bg-purple-500/20"
            >
              Cancel
            </Button>
            <Button
              data-testid="button-confirm-redeem"
              onClick={() => selectedReward && redeemMutation.mutate({ rewardId: selectedReward.id })}
              disabled={redeemMutation.isPending}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500"
            >
              {redeemMutation.isPending ? 'Redeeming...' : 'Confirm Redemption'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={optInDialogOpen} onOpenChange={setOptInDialogOpen}>
        <DialogContent className="bg-slate-900 border-purple-500/30 text-white max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Award className="w-5 h-5 text-yellow-400" />
              Join Rewards Program
            </DialogTitle>
            <DialogDescription className="text-purple-200/70">
              Start earning points on every visit!
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <div className="space-y-3">
              {[
                { icon: Zap, text: 'Earn 1 point per dollar spent' },
                { icon: Gift, text: 'Redeem for free services' },
                { icon: Star, text: 'Exclusive member perks' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                    <item.icon className="w-4 h-4 text-purple-400" />
                  </div>
                  <span className="text-purple-100">{item.text}</span>
                </div>
              ))}
            </div>
          </div>
          
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setOptInDialogOpen(false)}
              className="border-purple-400/50 text-purple-200 hover:bg-purple-500/20"
            >
              Not Now
            </Button>
            <Button
              data-testid="button-confirm-enroll"
              onClick={() => loyaltyData?.customer?.id && optInMutation.mutate({ customerId: loyaltyData.customer.id })}
              disabled={optInMutation.isPending}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500"
            >
              {optInMutation.isPending ? 'Enrolling...' : 'Enroll Now'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomerRewardsPortal;
