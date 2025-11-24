import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Check, Sparkles, Zap, Crown, ArrowRight, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentTier?: string;
  lockedFeature?: string;
}

interface PricingPlan {
  id: string;
  name: string;
  tagline: string;
  monthlyPrice: number;
  priceSuffix?: string;
  recommended?: boolean;
  bulletPoints: string[];
}

export function UpgradeModal({ open, onOpenChange, currentTier = 'free', lockedFeature }: UpgradeModalProps) {
  const [upgradingTo, setUpgradingTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ['/api/public/pricing'],
    enabled: open,
  });

  // Reset state when modal closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setUpgradingTo(null);
      setError(null);
    }
    onOpenChange(newOpen);
  };

  const plans = data?.plans || [];
  const currentIndex = plans.findIndex((p: PricingPlan) => p.id === currentTier);
  
  // Show plans above current tier
  const upgradePlans = plans.filter((_: PricingPlan, idx: number) => idx > currentIndex && plans[idx].id !== 'internal');

  const tierIcons: Record<string, typeof Sparkles> = {
    starter: Sparkles,
    pro: Zap,
    elite: Crown,
  };

  const handleUpgrade = async (targetTier: string) => {
    setUpgradingTo(targetTier);
    setError(null);

    try {
      // Call the checkout session API
      const response = await apiRequest<{ checkoutUrl: string }>(
        '/api/tenant/billing/checkout-session',
        {
          method: 'POST',
          body: JSON.stringify({ targetTier }),
        }
      );

      // Redirect to Stripe Checkout
      if (response.checkoutUrl) {
        window.location.href = response.checkoutUrl;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err: any) {
      console.error('[UPGRADE] Error creating checkout session:', err);
      
      setError(err.message || 'Failed to start upgrade process');
      setUpgradingTo(null);

      toast({
        title: 'Upgrade Failed',
        description: err.message || 'Could not create checkout session. Please try again or contact support.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-slate-900 to-purple-900 border-purple-500/50 text-white">
        <DialogHeader>
          <DialogTitle className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-purple-200">
            Upgrade Your Plan
          </DialogTitle>
          <DialogDescription className="text-gray-300 text-lg">
            {lockedFeature 
              ? `Unlock ${lockedFeature} and more with a higher tier plan`
              : 'Choose a plan that fits your growing business needs'}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-64 bg-white/10" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            {upgradePlans.map((plan: PricingPlan) => {
              const Icon = tierIcons[plan.id] || Sparkles;
              const isRecommended = plan.recommended;

              return (
                <Card
                  key={plan.id}
                  className={`
                    relative p-6 backdrop-blur-lg border-2 transition-all hover:scale-105
                    ${isRecommended 
                      ? 'bg-white/20 border-purple-400/50 shadow-xl shadow-purple-500/30' 
                      : 'bg-white/10 border-white/20'}
                  `}
                  data-testid={`upgrade-card-${plan.id}`}
                >
                  {isRecommended && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
                        Recommended
                      </div>
                    </div>
                  )}

                  <div className={`
                    w-12 h-12 rounded-xl flex items-center justify-center mb-4
                    ${isRecommended 
                      ? 'bg-gradient-to-br from-purple-500 to-pink-500' 
                      : 'bg-gradient-to-br from-gray-700 to-gray-800'}
                  `}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>

                  <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                  <p className="text-gray-300 text-sm mb-4">{plan.tagline}</p>

                  <div className="mb-4">
                    <span className="text-4xl font-bold">${plan.monthlyPrice}</span>
                    <span className="text-gray-400">{plan.priceSuffix}</span>
                  </div>

                  <div className="space-y-2 mb-6">
                    {plan.bulletPoints.slice(0, 4).map((point, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-sm">
                        <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-200">{point}</span>
                      </div>
                    ))}
                  </div>

                  <Button
                    onClick={() => handleUpgrade(plan.id)}
                    disabled={upgradingTo !== null}
                    className={`
                      w-full font-semibold
                      ${isRecommended
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600'
                        : 'bg-white/20 hover:bg-white/30 border border-white/30'}
                    `}
                    data-testid={`button-upgrade-${plan.id}`}
                  >
                    {upgradingTo === plan.id ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Redirecting to checkout...
                      </>
                    ) : (
                      <>
                        Upgrade to {plan.name}
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                </Card>
              );
            })}
          </div>
        )}

        {error && (
          <div className="mt-4 p-4 bg-red-500/10 border border-red-500/50 rounded-lg">
            <p className="text-sm text-red-200">
              <strong>Error:</strong> {error}
            </p>
          </div>
        )}

        <div className="mt-6 p-4 bg-white/5 rounded-lg border border-white/10">
          <p className="text-sm text-gray-300">
            <strong>Current plan:</strong> {currentTier.charAt(0).toUpperCase() + currentTier.slice(1)}
          </p>
          <p className="text-xs text-gray-400 mt-2">
            Secure payment processing powered by Stripe. Questions? Contact sales@servicepro.com
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
