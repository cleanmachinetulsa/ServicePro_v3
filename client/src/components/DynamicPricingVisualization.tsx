import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Star, Award, Zap, Gift, TrendingUp, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import confetti from 'canvas-confetti';

interface DynamicPricingVisualizationProps {
  serviceName: string;
  basePrice: number;
  addOns: string[];
  addOnPrices: Record<string, number>;
  vehicleConditions: string[][];
  conditionPrices: Record<string, number>;
  customerPhone?: string;
  customerEmail?: string;
}

export function DynamicPricingVisualization({
  serviceName,
  basePrice,
  addOns,
  addOnPrices,
  vehicleConditions,
  conditionPrices,
  customerPhone,
  customerEmail
}: DynamicPricingVisualizationProps) {
  const [totalPrice, setTotalPrice] = useState(basePrice);
  const [pointsToEarn, setPointsToEarn] = useState(basePrice);
  const [isLoyaltyMember, setIsLoyaltyMember] = useState<boolean | null>(null);
  const [loyaltyTier, setLoyaltyTier] = useState<string | null>(null);
  const [currentPoints, setCurrentPoints] = useState<number>(0);
  const [nextTier, setNextTier] = useState<{ name: string, threshold: number } | null>(null);
  const [progressToNextTier, setProgressToNextTier] = useState<number>(0);
  const [showAnimation, setShowAnimation] = useState(false);
  const [checkingLoyalty, setCheckingLoyalty] = useState(false);
  
  // Calculate the total price based on service, add-ons, and vehicle conditions
  useEffect(() => {
    let price = basePrice;
    
    // Add prices for add-ons
    addOns.forEach(addOn => {
      if (addOnPrices[addOn]) {
        price += addOnPrices[addOn];
      }
    });
    
    // Add prices for vehicle conditions
    vehicleConditions.forEach(vehicleCondition => {
      vehicleCondition.forEach(condition => {
        if (conditionPrices[condition]) {
          price += conditionPrices[condition];
        }
      });
    });
    
    setTotalPrice(price);
    setPointsToEarn(price); // 1 point per dollar
  }, [basePrice, addOns, vehicleConditions, addOnPrices, conditionPrices]);
  
  // Check if customer is a loyalty program member if phone or email is provided
  useEffect(() => {
    const checkLoyaltyStatus = async () => {
      if (!customerPhone && !customerEmail) {
        setIsLoyaltyMember(null);
        return;
      }
      
      setCheckingLoyalty(true);
      
      try {
        // Try to look up customer by phone or email
        const endpoint = customerPhone 
          ? `/api/loyalty/points/phone/${encodeURIComponent(customerPhone)}`
          : `/api/loyalty/points/email/${encodeURIComponent(customerEmail!)}`;
          
        const response = await fetch(endpoint);
        const data = await response.json();
        
        if (data.success && data.data) {
          setIsLoyaltyMember(Boolean(data.data.loyaltyPoints));
          if (data.data.loyaltyPoints) {
            setCurrentPoints(data.data.loyaltyPoints.points);
            
            // Determine current tier and next tier
            const tiers = [
              { name: "Bronze", threshold: 0 },
              { name: "Silver", threshold: 1000 },
              { name: "Gold", threshold: 2500 },
              { name: "Platinum", threshold: 5000 }
            ];
            
            let currentTier = tiers[0];
            let nextTierObj = tiers[1];
            
            for (let i = 0; i < tiers.length; i++) {
              if (data.data.loyaltyPoints.points >= tiers[i].threshold) {
                currentTier = tiers[i];
                nextTierObj = tiers[i+1] || null;
              } else {
                break;
              }
            }
            
            setLoyaltyTier(currentTier.name);
            setNextTier(nextTierObj);
            
            if (nextTierObj) {
              const progress = ((data.data.loyaltyPoints.points - currentTier.threshold) / 
                               (nextTierObj.threshold - currentTier.threshold)) * 100;
              setProgressToNextTier(Math.min(Math.max(progress, 0), 100));
            } else {
              setProgressToNextTier(100); // Already at highest tier
            }
          }
        } else {
          setIsLoyaltyMember(false);
        }
      } catch (error) {
        console.error('Error checking loyalty status:', error);
        setIsLoyaltyMember(null);
      } finally {
        setCheckingLoyalty(false);
      }
    };
    
    checkLoyaltyStatus();
  }, [customerPhone, customerEmail]);
  
  // Trigger point animation when points to earn changes
  useEffect(() => {
    if (pointsToEarn > 0 && isLoyaltyMember) {
      setShowAnimation(true);
      setTimeout(() => setShowAnimation(false), 1500);
    }
  }, [pointsToEarn, isLoyaltyMember]);
  
  // Function to calculate future tier after new points
  const getFutureTier = () => {
    if (!isLoyaltyMember) return null;
    
    const tiers = [
      { name: "Bronze", threshold: 0 },
      { name: "Silver", threshold: 1000 },
      { name: "Gold", threshold: 2500 },
      { name: "Platinum", threshold: 5000 }
    ];
    
    const futurePoints = currentPoints + pointsToEarn;
    let futureTier = tiers[0].name;
    
    for (let i = 0; i < tiers.length; i++) {
      if (futurePoints >= tiers[i].threshold) {
        futureTier = tiers[i].name;
      } else {
        break;
      }
    }
    
    return futureTier !== loyaltyTier ? futureTier : null;
  };
  
  const willTierUp = getFutureTier();
  
  // Function to trigger confetti for tier-up celebration
  const triggerTierUpCelebration = () => {
    const duration = 3000;
    const end = Date.now() + duration;
    
    (function frame() {
      confetti({
        particleCount: 2,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#3b82f6', '#10b981', '#f59e0b']
      });
      
      confetti({
        particleCount: 2,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#3b82f6', '#10b981', '#f59e0b']
      });
      
      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    }());
  };
  
  // Show tier-up celebration when a new tier is achieved
  useEffect(() => {
    if (willTierUp) {
      triggerTierUpCelebration();
    }
  }, [willTierUp]);
  
  return (
    <Card className="mt-6 overflow-hidden border-blue-100 shadow-lg">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-sky-50 pb-2">
        <CardTitle>Pricing Summary</CardTitle>
        <CardDescription>See your service breakdown and loyalty points</CardDescription>
      </CardHeader>
      
      <CardContent className="pt-6 space-y-4">
        {/* Base Price */}
        <div className="flex justify-between items-center">
          <span className="font-medium">Base Service: {serviceName}</span>
          <span className="font-bold">${basePrice.toFixed(2)}</span>
        </div>
        
        {/* Add-ons */}
        {addOns.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-semibold text-gray-600">Selected Add-ons:</div>
            {addOns.map((addOn, index) => (
              <div key={index} className="flex justify-between items-center text-sm pl-4">
                <div className="flex items-center">
                  <Check size={14} className="text-green-500 mr-1" />
                  <span>{addOn}</span>
                </div>
                <span>${addOnPrices[addOn]?.toFixed(2) || '0.00'}</span>
              </div>
            ))}
          </div>
        )}
        
        {/* Vehicle Conditions */}
        {vehicleConditions.some(conditions => conditions.length > 0) && (
          <div className="space-y-2">
            <div className="text-sm font-semibold text-gray-600">
              Vehicle Condition Adjustments:
            </div>
            {vehicleConditions.map((conditions, vehicleIndex) => 
              conditions.map((condition, index) => (
                <div key={`${vehicleIndex}-${index}`} className="flex justify-between items-center text-sm pl-4">
                  <span>Vehicle {vehicleIndex + 1}: {condition}</span>
                  <span>${conditionPrices[condition]?.toFixed(2) || '0.00'}</span>
                </div>
              ))
            )}
          </div>
        )}
        
        {/* Total Price */}
        <div className="flex justify-between items-center pt-4 border-t border-gray-200 text-lg font-bold">
          <span>Total Price</span>
          <span className="text-blue-700">${totalPrice.toFixed(2)}</span>
        </div>
        
        {/* Loyalty Points */}
        {isLoyaltyMember ? (
          <div className="mt-6">
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center space-x-2">
                <Award className="text-blue-600 h-5 w-5" />
                <span className="font-semibold">Loyalty Points to Earn</span>
              </div>
              <Badge 
                variant="outline" 
                className={cn(
                  "bg-blue-50 text-blue-600 flex items-center gap-1 px-3 py-1 text-sm font-medium border-blue-200", 
                  { "animate-pulse": showAnimation }
                )}
              >
                <Zap className="h-3.5 w-3.5" />
                <span>{Math.round(pointsToEarn)} pts</span>
              </Badge>
            </div>
            
            {/* Current Tier */}
            <div className="bg-blue-50 rounded-md p-3 mb-4">
              <div className="flex justify-between mb-1">
                <div className="flex items-center space-x-1 text-sm">
                  <Star className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-blue-800">Current Tier: {loyaltyTier}</span>
                </div>
                <span className="text-sm text-blue-800">{currentPoints} pts</span>
              </div>
              
              {/* Progress to next tier */}
              {nextTier && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-blue-600">
                    <span>Progress to {nextTier.name}</span>
                    <span>{Math.round(progressToNextTier)}%</span>
                  </div>
                  <Progress value={progressToNextTier} className="h-1.5" />
                </div>
              )}
            </div>
            
            {/* Future Points and Possible Tier-Up */}
            <div className="bg-green-50 border border-green-100 rounded-md p-3">
              <div className="flex justify-between mb-2 text-sm">
                <span className="font-medium text-green-800">After this booking, you'll have</span>
                <span className="font-bold text-green-800">{currentPoints + Math.round(pointsToEarn)} pts</span>
              </div>
              
              {willTierUp && (
                <div className="flex items-center bg-yellow-100 border border-yellow-300 rounded p-2 text-sm mt-1">
                  <Gift className="h-4 w-4 text-yellow-600 mr-2 flex-shrink-0" />
                  <span className="text-yellow-800">
                    <span className="font-bold">Congratulations!</span> This booking will advance you to {willTierUp} tier!
                  </span>
                </div>
              )}
            </div>
          </div>
        ) : isLoyaltyMember === false ? (
          <div className="mt-4 bg-blue-50 p-3 rounded-md border border-blue-200">
            <div className="flex items-start space-x-2">
              <Star className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-800">Join our Loyalty Program</p>
                <p className="text-xs text-blue-600 mt-1">
                  Earn {Math.round(totalPrice)} points on this booking! Redeem for free services and exclusive rewards.
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>
      
      {isLoyaltyMember && (
        <CardFooter className="bg-slate-50 border-t">
          <div className="text-xs text-gray-500 w-full">
            <div className="flex items-center space-x-1">
              <TrendingUp className="h-3 w-3" />
              <span className="font-medium">1 point earned per $1 spent</span>
            </div>
          </div>
        </CardFooter>
      )}
    </Card>
  );
}