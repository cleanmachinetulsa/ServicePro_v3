import React, { useState } from 'react';
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardContent, 
  CardFooter 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { 
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { AlertCircle, Award, Check, ChevronLeft, Gift, Search, Star, Zap } from 'lucide-react';
import { Link } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { apiRequest } from '@/lib/queryClient';
import MultiVehicleAppointmentScheduler from '@/components/MultiVehicleAppointmentScheduler';
import AnimatedLoyaltyProgressBar from '@/components/AnimatedLoyaltyProgressBar';

// Function to trigger confetti celebration
const triggerCelebration = async () => {
  const count = 200;
  const defaults = {
    origin: { y: 0.7 },
    zIndex: 9999,
  };

  const confettiModule = await import('canvas-confetti');
  const confettiFn = confettiModule.default;

  function fire(particleRatio: number, opts: any) {
    confettiFn({
      ...defaults,
      ...opts,
      particleCount: Math.floor(count * particleRatio),
    });
  }

  fire(0.25, {
    spread: 26,
    startVelocity: 55,
  });

  fire(0.2, {
    spread: 60,
  });

  fire(0.35, {
    spread: 100,
    decay: 0.91,
    scalar: 0.8,
  });

  fire(0.1, {
    spread: 120,
    startVelocity: 25,
    decay: 0.92,
    scalar: 1.2,
  });

  fire(0.1, {
    spread: 120,
    startVelocity: 45,
  });
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

interface RewardsResponse {
  success: boolean;
  data: RewardService[];
}

interface RedemptionResponse {
  success: boolean;
  data: {
    updatedPoints: {
      id: number;
      points: number;
    };
    redeemedRewards: any[];
    message: string;
  };
}

const LoyaltyPointsPage: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchType, setSearchType] = useState<'phone' | 'email'>('phone');
  const [searchValue, setSearchValue] = useState('');
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [loyaltyData, setLoyaltyData] = useState<LoyaltyPointsResponse['data'] | null>(null);
  const [selectedReward, setSelectedReward] = useState<RewardService | null>(null);
  const [redeemDialogOpen, setRedeemDialogOpen] = useState(false);
  const [rewardQuantity, setRewardQuantity] = useState(1);
  const [optInDialogOpen, setOptInDialogOpen] = useState(false);
  const [schedulerOpen, setSchedulerOpen] = useState(false);
  const [selectedRedemptionService, setSelectedRedemptionService] = useState<string>('');
  
  // Get all available reward services
  const { data: rewardsData } = useQuery<RewardsResponse>({
    queryKey: ['/api/loyalty/rewards'],
    enabled: true,
  });

  // Group rewards by tier
  const rewardsByTier = rewardsData?.data?.reduce((acc, reward) => {
    const tier = reward.tier;
    if (!acc[tier]) {
      acc[tier] = [];
    }
    acc[tier].push(reward);
    return acc;
  }, {} as Record<string, RewardService[]>) || {};

  // Sort tiers for display (500, 1000, 2000, 3000)
  const sortedTiers = rewardsByTier ? Object.keys(rewardsByTier).sort((a, b) => {
    const tierValueA = a === 'tier_500' ? 500 : a === 'tier_1000' ? 1000 : a === 'tier_2000' ? 2000 : a === 'tier_3000' ? 3000 : 0;
    const tierValueB = b === 'tier_500' ? 500 : b === 'tier_1000' ? 1000 : b === 'tier_2000' ? 2000 : b === 'tier_3000' ? 3000 : 0;
    return tierValueA - tierValueB;
  }) : [];

  const searchForPoints = async () => {
    if (!searchValue.trim()) {
      toast({
        title: "Required field",
        description: "Please enter a phone number or email address",
        variant: "destructive",
      });
      return;
    }
    
    setSearching(true);
    setHasSearched(true);
    try {
      const endpoint = searchType === 'phone' 
        ? `/api/loyalty/points/phone/${encodeURIComponent(searchValue)}`
        : `/api/loyalty/points/email/${encodeURIComponent(searchValue)}`;
      
      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error('Failed to fetch loyalty points data');
      }
      
      const result = await response.json();
      
      if (result.success && result.data) {
        setLoyaltyData(result.data);
        
        // Check if customer has points for a reward, show confetti
        if (result.data.loyaltyPoints?.points >= 500) {
          triggerCelebration();
        }
      } else {
        setLoyaltyData(null);
      }
    } catch (error) {
      console.error('Error searching for loyalty points:', error);
      toast({
        title: "Error",
        description: "Failed to retrieve loyalty information. Please try again.",
        variant: "destructive",
      });
      setLoyaltyData(null);
    } finally {
      setSearching(false);
    }
  };

  // Opt in to loyalty program
  const optInMutation = useMutation<any, Error, {customerId: number}>({
    mutationFn: async ({ customerId }) => {
      return apiRequest('/api/loyalty/opt-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId }),
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Success!",
        description: "You have been enrolled in our loyalty program.",
      });
      setOptInDialogOpen(false);
      
      // Update local state
      if (loyaltyData) {
        setLoyaltyData({
          ...loyaltyData,
          loyaltyPoints: data.data.loyaltyPoints,
        });
      }
      
      // Refresh points data
      if (searchValue && searchType) {
        const endpoint = searchType === 'phone' 
          ? `/api/loyalty/points/phone/${encodeURIComponent(searchValue)}`
          : `/api/loyalty/points/email/${encodeURIComponent(searchValue)}`;
        
        queryClient.invalidateQueries({ queryKey: [endpoint] });
      }
    },
    onError: (error) => {
      toast({
        title: "Enrollment failed",
        description: error.message || "Failed to enroll in loyalty program",
        variant: "destructive",
      });
    }
  });

  // Redeem points
  const redeemMutation = useMutation<RedemptionResponse, Error, { rewardId: number, quantity: number }>({
    mutationFn: async ({ rewardId, quantity }) => {
      if (!loyaltyData?.customer?.id) {
        throw new Error('Customer ID is required');
      }
      
      return apiRequest('/api/loyalty/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: loyaltyData.customer.id,
          rewardServiceId: rewardId,
          quantity,
        }),
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Success!",
        description: data.data.message || "Reward redeemed successfully!",
      });
      setRedeemDialogOpen(false);
      
      // Update local state
      if (loyaltyData && data.data.updatedPoints) {
        setLoyaltyData({
          ...loyaltyData,
          loyaltyPoints: {
            ...loyaltyData.loyaltyPoints!,
            points: data.data.updatedPoints.points,
          },
        });
      }
      
      // Open scheduler for booking the reward service
      if (selectedReward) {
        setSelectedRedemptionService(selectedReward.name);
        setSchedulerOpen(true);
      }
      
      // Refresh points data
      if (searchValue && searchType) {
        const endpoint = searchType === 'phone' 
          ? `/api/loyalty/points/phone/${encodeURIComponent(searchValue)}`
          : `/api/loyalty/points/email/${encodeURIComponent(searchValue)}`;
        
        queryClient.invalidateQueries({ queryKey: [endpoint] });
      }
    },
    onError: (error) => {
      toast({
        title: "Redemption failed",
        description: error.message || "Failed to redeem points",
        variant: "destructive",
      });
    }
  });

  // Handle redeem button click
  const handleRedeemClick = (reward: RewardService) => {
    if (!loyaltyData?.loyaltyPoints) {
      toast({
        title: "Not enrolled",
        description: "Please enroll in the loyalty program first",
        variant: "destructive",
      });
      return;
    }
    
    if (loyaltyData.loyaltyPoints.points < reward.pointCost) {
      toast({
        title: "Not enough points",
        description: `You need ${reward.pointCost} points to redeem this reward, but you only have ${loyaltyData.loyaltyPoints.points} points.`,
        variant: "destructive",
      });
      return;
    }
    
    setSelectedReward(reward);
    setRewardQuantity(1);
    setRedeemDialogOpen(true);
  };

  // Calculate progress to next tier
  const calculateProgressToNextTier = () => {
    if (!loyaltyData?.loyaltyPoints || typeof loyaltyData.loyaltyPoints.points !== 'number') {
      return { progress: 0, nextTier: 1000, pointsNeeded: 1000 };
    }
    
    // Ensure points is a number
    const points = Number(loyaltyData.loyaltyPoints.points) || 0;
    const tiers = [500, 1000, 2000, 3000];
    
    // Find the next tier
    let nextTierValue = null;
    for (const tier of tiers) {
      if (points < tier) {
        nextTierValue = tier;
        break;
      }
    }
    
    // If customer is at the highest tier already
    if (!nextTierValue) {
      return { progress: 100, nextTier: 3000, pointsNeeded: 0 };
    }
    
    // Calculate progress percentage
    const previousTier = tiers[tiers.indexOf(nextTierValue) - 1] || 0;
    const progress = ((points - previousTier) / (nextTierValue - previousTier)) * 100;
    const pointsNeeded = nextTierValue - points;
    
    return { 
      progress: Math.min(Math.max(isNaN(progress) ? 0 : progress, 0), 100), 
      nextTier: nextTierValue,
      pointsNeeded: pointsNeeded
    };
  };

  // Calculate current tier
  const getCurrentTier = () => {
    if (!loyaltyData?.loyaltyPoints) return 'Not Enrolled';
    
    const points = loyaltyData.loyaltyPoints.points;
    
    if (points >= 3000) return 'Platinum';
    if (points >= 2000) return 'Gold';
    if (points >= 1000) return 'Silver';
    if (points >= 500) return 'Bronze';
    return 'Standard';
  };

  // Handle opt-in button click
  const handleOptIn = () => {
    if (!loyaltyData?.customer?.id) {
      toast({
        title: "Error",
        description: "Customer information is required. Please search for a customer first.",
        variant: "destructive",
      });
      return;
    }
    
    optInMutation.mutate({ customerId: loyaltyData.customer.id });
  };

  return (
    <div className="container py-6 max-w-4xl">
      <div className="flex items-center mb-6">
        <Link href="/">
          <Button variant="ghost" size="sm" className="gap-1">
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>
        <h1 className="text-3xl font-bold text-center flex-1 mr-10">My Loyalty Points</h1>
      </div>
      
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-xl">Check Your Loyalty Points</CardTitle>
          <CardDescription>
            Enter your phone number or email address to see your loyalty points and available rewards.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="phone" className="space-y-4" onValueChange={(value) => setSearchType(value as 'phone' | 'email')}>
            <TabsList className="grid grid-cols-2 w-64">
              <TabsTrigger value="phone">Phone</TabsTrigger>
              <TabsTrigger value="email">Email</TabsTrigger>
            </TabsList>
            
            <div className="flex space-x-2">
              <div className="flex-1">
                <Label htmlFor="searchValue" className="sr-only">
                  {searchType === 'phone' ? 'Phone Number' : 'Email Address'}
                </Label>
                <Input
                  id="searchValue"
                  placeholder={searchType === 'phone' ? 'Enter phone number (e.g. 123-456-7890)' : 'Enter email address'}
                  value={searchValue}
                  onChange={(e) => {
                    // Format phone number with dashes if phone type is selected
                    if (searchType === 'phone') {
                      const input = e.target.value.replace(/\D/g, ''); // Remove non-digits
                      let formattedInput = input;
                      
                      // Add dashes after 3rd and 6th digits (123-456-7890)
                      if (input.length > 3) {
                        formattedInput = input.slice(0, 3) + '-' + input.slice(3);
                      }
                      if (input.length > 6) {
                        formattedInput = formattedInput.slice(0, 7) + '-' + formattedInput.slice(7);
                      }
                      
                      // Limit to 12 characters (10 digits + 2 dashes)
                      if (formattedInput.length <= 12) {
                        setSearchValue(formattedInput);
                      }
                    } else {
                      // No formatting for email
                      setSearchValue(e.target.value);
                    }
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && searchForPoints()}
                />
              </div>
              <Button onClick={searchForPoints} disabled={searching}>
                {searching ? 'Searching...' : 'Search'}
                <Search className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </Tabs>
        </CardContent>
      </Card>
      
      {hasSearched && (
        <div className="space-y-6">
          {loyaltyData ? (
            <div className="space-y-6">
              <Card className="overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-4">
                  <h2 className="text-2xl font-bold">
                    Hello, {loyaltyData.customer.name}!
                  </h2>
                </div>
                <CardContent className="pt-6">
                  {loyaltyData.loyaltyPoints ? (
                    <div className="space-y-6">
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="text-xl font-semibold">
                            {loyaltyData.loyaltyPoints && typeof loyaltyData.loyaltyPoints.points === 'number' 
                              ? loyaltyData.loyaltyPoints.points 
                              : 0} Points
                          </h3>
                          <p className="text-gray-600">Current Tier: {getCurrentTier()}</p>
                        </div>
                        <div className="bg-blue-100 text-blue-800 py-1 px-3 rounded-full text-sm font-medium">
                          Points valid for 2 years
                        </div>
                      </div>
                      
                      {/* Progress bar for next tier */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Progress to next tier</span>
                          <span>{calculateProgressToNextTier().nextTier} Points</span>
                        </div>
                        <div className="flex justify-between text-xs text-gray-600 mb-1">
                          <span>{loyaltyData.loyaltyPoints.points} points</span>
                          <span>{calculateProgressToNextTier().pointsNeeded} points needed</span>
                        </div>
                        <AnimatedLoyaltyProgressBar value={calculateProgressToNextTier().progress} showValue={false} />
                      </div>
                      
                      {/* Transaction history */}
                      <div className="border rounded-md p-4">
                        <h4 className="font-medium mb-2">Recent Transactions</h4>
                        {loyaltyData.transactions && loyaltyData.transactions.length > 0 ? (
                          <ul className="space-y-2 text-sm">
                            {loyaltyData.transactions.map((tx) => (
                              <li key={tx.id} className="flex justify-between items-center">
                                <div>
                                  <span className={tx.transactionType === 'earn' ? 'text-green-600' : tx.transactionType === 'redeem' ? 'text-blue-600' : 'text-red-600'}>
                                    {tx.transactionType === 'earn' ? '+' : ''}
                                    {tx.amount} points
                                  </span>
                                  <p className="text-gray-600 text-xs">{tx.description}</p>
                                </div>
                                <div className="text-xs text-gray-500">
                                  {new Date(tx.transactionDate).toLocaleDateString()}
                                </div>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-gray-500 text-sm">No transactions yet.</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <Alert className="mb-4">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        You are not currently enrolled in our loyalty program. 
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="ml-4"
                          onClick={() => setOptInDialogOpen(true)}
                        >
                          Enroll Now
                        </Button>
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>

              {/* Available rewards section */}
              {loyaltyData.loyaltyPoints && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-bold text-center text-blue-700">Available Loyalty Offers</h2>
                  
                  {/* Rewards cards by tier */}
                  {sortedTiers.map((tier) => (
                    <div key={tier} className="space-y-4">
                      <h3 className="text-xl font-semibold text-blue-600">
                        {tier === 'tier_500' ? '500 Points Offers' :
                         tier === 'tier_1000' ? '1,000 Points Offers' :
                         tier === 'tier_2000' ? '2,000 Points Offers' :
                         tier === 'tier_3000' ? '3,000 Points Offers' : 'Loyalty Offers'}
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {rewardsByTier[tier].map((reward) => (
                          <Card key={reward.id} className={`overflow-hidden transition-all duration-300 ${loyaltyData.loyaltyPoints && loyaltyData.loyaltyPoints.points >= reward.pointCost ? 'bg-gradient-to-br from-white to-blue-50 shadow-md border-blue-200 hover:shadow-lg hover:-translate-y-1' : 'bg-gray-50 border-gray-200 opacity-70'}`}>
                            <div className="bg-gradient-to-r from-blue-600 to-blue-800 py-2 px-4 text-white text-sm font-semibold">
                              {reward.pointCost} Points
                            </div>
                            <CardHeader className="pb-2">
                              <CardTitle className="text-xl flex items-center">
                                <Gift className="h-5 w-5 mr-2 text-blue-600" />
                                {reward.name}
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="text-sm text-gray-600">
                              <p>{reward.description}</p>
                            </CardContent>
                            <CardFooter>
                              <Button 
                                className="w-full bg-blue-600 hover:bg-blue-700"
                                disabled={!loyaltyData.loyaltyPoints || loyaltyData.loyaltyPoints.points < reward.pointCost}
                                onClick={() => handleRedeemClick(reward)}
                              >
                                {loyaltyData.loyaltyPoints && loyaltyData.loyaltyPoints.points >= reward.pointCost ? 'Redeem Offer' : `Need ${reward.pointCost - (loyaltyData.loyaltyPoints?.points || 0)} More Points`}
                              </Button>
                            </CardFooter>
                          </Card>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>No Results Found</AlertTitle>
              <AlertDescription>
                We couldn't find a customer with that information. Please check your entry and try again.
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
      
      {/* Program information */}
      <Card className="mb-8 bg-white shadow-md border-blue-100">
        <CardHeader>
          <CardTitle className="text-2xl text-center text-blue-700">About Our Loyalty Program</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-blue-600 flex items-center">
              <Zap className="h-5 w-5 mr-2" />
              How It Works
            </h3>
            <p>
              Our loyalty program rewards you for every dollar you spend on our detailing services. 
              For each dollar spent, you earn 1 point in your loyalty account. 
              Points can be redeemed for free services when you reach specific reward tiers.
            </p>
          </div>
          
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-blue-600 flex items-center">
              <Award className="h-5 w-5 mr-2" />
              Reward Tiers
            </h3>
            <ul className="space-y-2">
              <li className="flex items-start">
                <Check className="h-5 w-5 mr-2 text-green-500 flex-shrink-0 mt-0.5" />
                <span><strong>500 Points:</strong> Free Leather/Upholstery Protector or Engine Bay Cleaning</span>
              </li>
              <li className="flex items-start">
                <Check className="h-5 w-5 mr-2 text-green-500 flex-shrink-0 mt-0.5" />
                <span><strong>1,000 Points:</strong> Free Maintenance Detail</span>
              </li>
              <li className="flex items-start">
                <Check className="h-5 w-5 mr-2 text-green-500 flex-shrink-0 mt-0.5" />
                <span><strong>2,000 Points:</strong> Free Paint Enhancement</span>
              </li>
              <li className="flex items-start">
                <Check className="h-5 w-5 mr-2 text-green-500 flex-shrink-0 mt-0.5" />
                <span><strong>3,000 Points:</strong> Free 1 Year Ceramic Coating</span>
              </li>
            </ul>
          </div>
          
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-blue-600 flex items-center">
              <Star className="h-5 w-5 mr-2" />
              Important Details
            </h3>
            <ul className="space-y-2">
              <li className="flex items-start">
                <Check className="h-5 w-5 mr-2 text-green-500 flex-shrink-0 mt-0.5" />
                <span>Points are valid for 2 years from the date they are earned.</span>
              </li>
              <li className="flex items-start">
                <Check className="h-5 w-5 mr-2 text-green-500 flex-shrink-0 mt-0.5" />
                <span>You can redeem up to 3 reward services at once if you have enough points.</span>
              </li>
              <li className="flex items-start">
                <Check className="h-5 w-5 mr-2 text-green-500 flex-shrink-0 mt-0.5" />
                <span>Reward services must be scheduled within 90 days of redemption.</span>
              </li>
              <li className="flex items-start">
                <Check className="h-5 w-5 mr-2 text-green-500 flex-shrink-0 mt-0.5" />
                <span>You will receive an email notification when you become eligible for a reward.</span>
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
      
      {/* Opt-in Dialog */}
      <Dialog open={optInDialogOpen} onOpenChange={setOptInDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-xl">Join Our Loyalty Program</DialogTitle>
            <DialogDescription>
              Earn points for every dollar you spend and redeem them for free services.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <Alert className="bg-blue-50 border-blue-200">
              <Award className="h-5 w-5 text-blue-600" />
              <AlertDescription>
                By joining our loyalty program, you'll start earning 1 point for every dollar spent on our services.
              </AlertDescription>
            </Alert>
            
            <div className="space-y-2">
              <p className="text-sm text-gray-600">Benefits include:</p>
              <ul className="text-sm space-y-1">
                <li className="flex items-center">
                  <Check className="h-4 w-4 mr-2 text-green-500" />
                  Free services at reward tiers
                </li>
                <li className="flex items-center">
                  <Check className="h-4 w-4 mr-2 text-green-500" />
                  Early access to promotions
                </li>
                <li className="flex items-center">
                  <Check className="h-4 w-4 mr-2 text-green-500" />
                  Birthday rewards
                </li>
              </ul>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setOptInDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleOptIn} disabled={optInMutation.isPending}>
              {optInMutation.isPending ? 'Enrolling...' : 'Enroll Now'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Redeem Dialog */}
      <Dialog open={redeemDialogOpen} onOpenChange={setRedeemDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-xl">Redeem Loyalty Offer</DialogTitle>
            <DialogDescription>
              Confirm your redemption for {selectedReward?.name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <Alert>
              <AlertDescription>
                {selectedReward?.description}
              </AlertDescription>
            </Alert>
            
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity (up to 3)</Label>
              <Select
                value={String(rewardQuantity)}
                onValueChange={(val) => setRewardQuantity(Number(val))}
              >
                <SelectTrigger id="quantity">
                  <SelectValue placeholder="Quantity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem 
                    value="2" 
                    disabled={loyaltyData?.loyaltyPoints?.points && selectedReward ? loyaltyData.loyaltyPoints.points < (selectedReward.pointCost * 2) : true}
                  >
                    2
                  </SelectItem>
                  <SelectItem 
                    value="3" 
                    disabled={loyaltyData?.loyaltyPoints?.points && selectedReward ? loyaltyData.loyaltyPoints.points < (selectedReward.pointCost * 3) : true}
                  >
                    3
                  </SelectItem>
                </SelectContent>
              </Select>
              
              <div className="text-sm text-gray-600 mt-1">
                This will use {selectedReward ? selectedReward.pointCost * rewardQuantity : 0} points from your balance.
              </div>
            </div>
            
            <Alert className="bg-yellow-50 border-yellow-200">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                Please note: Redeemed offers must be scheduled within 90 days.
              </AlertDescription>
            </Alert>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setRedeemDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => selectedReward && redeemMutation.mutate({ rewardId: selectedReward.id, quantity: rewardQuantity })}
              disabled={redeemMutation.isPending}
            >
              {redeemMutation.isPending ? 'Redeeming...' : 'Confirm Redemption'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Appointment scheduler dialog */}
      <Dialog open={schedulerOpen} onOpenChange={setSchedulerOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">Schedule Your Redemption Service</DialogTitle>
            <DialogDescription>
              Choose a time to schedule your {selectedRedemptionService}
            </DialogDescription>
          </DialogHeader>
          
          <MultiVehicleAppointmentScheduler 
            customerId={loyaltyData?.customer?.id}
            customerName={loyaltyData?.customer?.name}
            defaultService={selectedRedemptionService}
            isRewardRedemption={true}
            onAppointmentBooked={() => {
              setSchedulerOpen(false);
              toast({
                title: "Appointment Scheduled!",
                description: "Your redemption service has been scheduled successfully.",
              });
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LoyaltyPointsPage;