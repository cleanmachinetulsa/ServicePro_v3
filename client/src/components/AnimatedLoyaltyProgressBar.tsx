import React, { useEffect, useState } from 'react';
import { motion } from "framer-motion";
import { Star, Badge, Award, Medal } from 'lucide-react';
import { Progress } from "@/components/ui/progress";

interface LoyaltyTier {
  name: string;
  threshold: number;
  color: string;
  icon: React.ReactNode;
}

interface AnimatedLoyaltyProgressBarProps {
  currentPoints?: number;
  value?: number;
  showValue?: boolean;
  isAnimated?: boolean;
  className?: string;
}

const AnimatedLoyaltyProgressBar: React.FC<AnimatedLoyaltyProgressBarProps> = ({ 
  currentPoints = 0,
  value,
  showValue = true,
  isAnimated = true,
  className = "",
}) => {
  // If value is provided, use it directly as percentage (0-100)
  const useDirectValue = value !== undefined;
  const [animatedPoints, setAnimatedPoints] = useState(0);
  const [visibleProgress, setVisibleProgress] = useState(0);

  // Define loyalty tiers with colors and icons
  const tiers: LoyaltyTier[] = [
    { 
      name: "Bronze", 
      threshold: 0, 
      color: "#CD7F32", 
      icon: <Award className="h-5 w-5 text-[#CD7F32]" /> 
    },
    { 
      name: "Silver", 
      threshold: 1000, 
      color: "#C0C0C0", 
      icon: <Award className="h-5 w-5 text-[#C0C0C0]" /> 
    },
    { 
      name: "Gold", 
      threshold: 2500, 
      color: "#FFD700", 
      icon: <Award className="h-5 w-5 text-[#FFD700]" /> 
    },
    { 
      name: "Platinum", 
      threshold: 3000, 
      color: "#E5E4E2", 
      icon: <Award className="h-5 w-5 text-[#E5E4E2]" /> 
    }
  ];

  // Calculate current tier and next tier
  const getCurrentTier = () => {
    for (let i = tiers.length - 1; i >= 0; i--) {
      if (currentPoints >= tiers[i].threshold) {
        return tiers[i];
      }
    }
    return tiers[0]; // Default to first tier
  };

  const getNextTier = () => {
    const currentTierIndex = tiers.findIndex(tier => tier.name === getCurrentTier().name);
    return currentTierIndex < tiers.length - 1 ? tiers[currentTierIndex + 1] : null;
  };

  const currentTier = getCurrentTier();
  const nextTier = getNextTier();

  // Calculate progress percentage to next tier
  const calculateProgress = (points: number) => {
    if (!nextTier) return 100; // Already at highest tier

    const progressValue = ((points - currentTier.threshold) / 
                          (nextTier.threshold - currentTier.threshold)) * 100;
    return Math.min(Math.max(progressValue, 0), 100);
  };

  // Animate points counter when points change
  useEffect(() => {
    if (useDirectValue) {
      // Direct value mode (0-100 percentage)
      const progressValue = typeof value === 'number' ? Math.max(0, Math.min(100, value)) : 0;
      setVisibleProgress(progressValue);
      return;
    }
    
    if (!isAnimated) {
      setAnimatedPoints(currentPoints);
      setVisibleProgress(calculateProgress(currentPoints));
      return;
    }

    // Animate the points count
    const duration = 1000; // 1 second
    const startTime = Date.now();
    const startValue = animatedPoints;
    const endValue = currentPoints;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Use easeOut function for smoother ending
      const easeOutProgress = 1 - Math.pow(1 - progress, 3);
      
      const currentValue = Math.round(startValue + (endValue - startValue) * easeOutProgress);
      setAnimatedPoints(currentValue);
      setVisibleProgress(calculateProgress(currentValue));
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }, [currentPoints, value, isAnimated, useDirectValue]);

  return (
    <div className={`${className}`}>
      {!useDirectValue && (
        <div className="space-y-3">
          {/* Points Display */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 font-semibold">
              <Star className="h-4 w-4 text-yellow-500" />
              <motion.span
                key={currentPoints}
                initial={isAnimated ? { opacity: 0.5, scale: 0.8 } : false}
                animate={{ opacity: 1, scale: 1 }}
                className="text-lg"
              >
                {animatedPoints.toLocaleString()}
              </motion.span>
              <span className="text-sm text-gray-500">points</span>
            </div>
            
            <div className="flex items-center">
              <span className="text-sm font-medium mr-2">{currentTier.name}</span>
              {currentTier.icon}
            </div>
          </div>
          
          {/* Progress Bar with Tier Info */}
          <div className="relative pt-1">
            <div className="flex mb-1 items-center justify-between">
              <div className="text-xs text-gray-500">
                {nextTier ? (
                  <>Next tier: {nextTier.name} ({(nextTier.threshold - currentPoints).toLocaleString()} points needed)</>
                ) : (
                  <>Maximum tier reached!</>
                )}
              </div>
              {showValue && (
                <div className="text-right">
                  <span className="text-xs font-semibold inline-block text-blue-600">
                    {Math.round(visibleProgress)}%
                  </span>
                </div>
              )}
            </div>
            
            {/* Custom Tier Progress Bar */}
            <div className="relative w-full h-4 bg-gray-200 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: "0%" }}
                animate={{ width: isNaN(visibleProgress) ? "0%" : `${visibleProgress}%` }}
                transition={{ duration: 0.7, ease: "easeOut" }}
                className="h-full rounded-full"
                style={{ 
                  background: `linear-gradient(90deg, ${currentTier.color} 0%, ${nextTier ? nextTier.color : currentTier.color} 100%)`,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.1) inset"
                }}
              />
              
              {/* Tier Markers */}
              <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
                {tiers.map((tier, index) => {
                  if (index === 0) return null; // Skip first tier marker
                  
                  const position = Math.min(
                    ((tier.threshold - tiers[0].threshold) / 
                    (tiers[tiers.length-1].threshold - tiers[0].threshold)) * 100,
                    100
                  );
                  
                  return (
                    <div 
                      key={tier.name}
                      className="absolute top-0 h-full flex flex-col items-center justify-center"
                      style={{ left: `${position}%` }}
                    >
                      <div className="h-full w-px bg-white opacity-70"></div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Tier Labels */}
            <div className="flex justify-between mt-1 px-1">
              {tiers.map((tier, index) => {
                if (index === 0 || index === tiers.length - 1) {
                  // Only show first and last tier on small screens
                  return (
                    <div key={tier.name} className="flex flex-col items-center">
                      <span className="text-[10px] text-gray-500">{tier.threshold.toLocaleString()}</span>
                    </div>
                  );
                }
                
                // Show other tiers only on medium screens and up
                return (
                  <div key={tier.name} className="hidden md:flex flex-col items-center">
                    <span className="text-[10px] text-gray-500">{tier.threshold.toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      
      {/* Simple Progress Bar (Direct Value Mode) */}
      {useDirectValue && (
        <div className="w-full">
          <div className="relative w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: "0%" }}
              animate={{ width: isNaN(visibleProgress) ? "0%" : `${visibleProgress}%` }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className="h-full rounded-full bg-blue-600"
            />
          </div>
          {showValue && (
            <div className="flex justify-end mt-1">
              <span className="text-xs font-semibold text-blue-600">
                {Math.round(visibleProgress)}%
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AnimatedLoyaltyProgressBar;