import { useState } from 'react';
import { Lock, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { UpgradeModal } from './UpgradeModal';

interface LockedFeatureProps {
  featureName: string;
  description: string;
  requiredTier: string;
  currentTier?: string;
  showPreview?: boolean;
  children?: React.ReactNode;
}

/**
 * Locked Feature Component
 * 
 * Shows a blurred preview of locked features with upgrade prompt.
 * Uses loss aversion psychology - users see what they're missing.
 */
export function LockedFeature({ 
  featureName, 
  description, 
  requiredTier,
  currentTier = 'free',
  showPreview = true,
  children 
}: LockedFeatureProps) {
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  return (
    <>
      <div className="relative" data-testid="locked-feature">
        {/* Preview content (blurred) */}
        {showPreview && children && (
          <div className="blur-sm opacity-50 pointer-events-none select-none">
            {children}
          </div>
        )}

        {/* Overlay */}
        <div className={`
          ${showPreview ? 'absolute inset-0' : ''}
          flex items-center justify-center p-8
        `}>
          <Card className="max-w-md w-full bg-white/95 dark:bg-gray-900/95 backdrop-blur-lg shadow-2xl border-2 border-purple-500/50">
            <div className="p-8 text-center">
              {/* Lock icon */}
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <Lock className="w-8 h-8 text-white" />
              </div>

              {/* Headline */}
              <h3 className="text-2xl font-bold mb-3 text-gray-900 dark:text-white">
                Unlock {featureName}
              </h3>

              {/* Description */}
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                {description}
              </p>

              {/* Tier requirement */}
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 mb-6">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  This feature is available on the{' '}
                  <span className="font-bold text-purple-600 dark:text-purple-400">
                    {requiredTier.charAt(0).toUpperCase() + requiredTier.slice(1)}
                  </span>{' '}
                  plan and higher
                </p>
              </div>

              {/* CTA Buttons */}
              <div className="space-y-3">
                <Button
                  onClick={() => setShowUpgradeModal(true)}
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold"
                  data-testid="button-view-pricing"
                >
                  View Pricing
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => window.open('/pricing', '_blank')}
                  className="w-full"
                  data-testid="button-compare-plans"
                >
                  Compare All Plans
                </Button>
              </div>

              {/* Fine print */}
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-6">
                You can upgrade or downgrade your plan at any time
              </p>
            </div>
          </Card>
        </div>
      </div>

      {/* Upgrade modal */}
      <UpgradeModal
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
        currentTier={currentTier}
        lockedFeature={featureName}
      />
    </>
  );
}
