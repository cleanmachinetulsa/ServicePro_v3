import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, CreditCard, AlertCircle, CheckCircle, ExternalLink } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { UpgradeModal } from '@/components/UpgradeModal';
import { PRICING_PLANS } from '@shared/pricingConfig';

interface BillingStatus {
  planTier: string;
  status: string;
  hasStripeCustomer: boolean;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}

export default function Billing() {
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const { toast } = useToast();

  // Fetch billing status
  const { data: billingStatus, isLoading: statusLoading } = useQuery<BillingStatus>({
    queryKey: ['/api/tenant/billing/status'],
  });

  // Mutation for creating portal session
  const portalMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest<{ portalUrl: string }>(
        '/api/tenant/billing/portal-session',
        {
          method: 'POST',
        }
      );
      return response;
    },
    onSuccess: (data) => {
      if (data.portalUrl) {
        window.location.href = data.portalUrl;
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to open billing portal',
        description: error.message || 'Please try again or contact support',
        variant: 'destructive',
      });
    },
  });

  const currentPlan = PRICING_PLANS.find((p) => p.id === billingStatus?.planTier);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>;
      case 'trialing':
        return <Badge className="bg-blue-500">Trial</Badge>;
      case 'past_due':
        return <Badge className="bg-yellow-500"><AlertCircle className="w-3 h-3 mr-1" />Past Due</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (statusLoading) {
    return (
      <div className="container max-w-4xl mx-auto py-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Billing & Subscription</h1>
        <p className="text-muted-foreground">
          Manage your subscription, payment methods, and billing history
        </p>
      </div>

      <div className="grid gap-6">
        {/* Current Plan Card */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl">Current Plan</CardTitle>
                <CardDescription>Your active subscription plan</CardDescription>
              </div>
              {billingStatus && getStatusBadge(billingStatus.status)}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-4xl font-bold">
                    {currentPlan?.name || billingStatus?.planTier}
                  </span>
                  {currentPlan && currentPlan.monthlyPrice > 0 && (
                    <span className="text-xl text-muted-foreground">
                      ${currentPlan.monthlyPrice}/month
                    </span>
                  )}
                </div>
                {currentPlan && (
                  <p className="text-muted-foreground">{currentPlan.tagline}</p>
                )}
              </div>

              {currentPlan && currentPlan.bulletPoints && (
                <div className="space-y-2 pt-4 border-t">
                  <p className="font-semibold text-sm">What's included:</p>
                  <ul className="space-y-1">
                    {currentPlan.bulletPoints.map((point, idx) => (
                      <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button
                  onClick={() => setShowUpgradeModal(true)}
                  variant="default"
                  data-testid="button-change-plan"
                >
                  Change Plan
                </Button>

                {billingStatus?.hasStripeCustomer && (
                  <Button
                    onClick={() => portalMutation.mutate()}
                    disabled={portalMutation.isPending}
                    variant="outline"
                    data-testid="button-manage-billing"
                  >
                    {portalMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-4 h-4 mr-2" />
                        Manage Billing
                        <ExternalLink className="w-3 h-3 ml-2" />
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment Information Card */}
        {billingStatus?.hasStripeCustomer && (
          <Card>
            <CardHeader>
              <CardTitle>Payment Information</CardTitle>
              <CardDescription>Manage your payment methods and billing details</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Click "Manage Billing" above to update your payment method, view invoices, or download receipts.
                </p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>Secure payment processing powered by Stripe</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Help Card */}
        <Card>
          <CardHeader>
            <CardTitle>Need Help?</CardTitle>
            <CardDescription>Questions about billing or your subscription?</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Our support team is here to help with billing questions, plan changes, or account management.
              </p>
              <div className="flex gap-3">
                <Button variant="outline" asChild>
                  <a href="mailto:billing@servicepro.com">
                    Contact Billing Support
                  </a>
                </Button>
                <Button variant="outline" asChild>
                  <a href="/pricing" target="_blank">
                    View All Plans
                    <ExternalLink className="w-3 h-3 ml-2" />
                  </a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upgrade Modal */}
      <UpgradeModal
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
        currentTier={billingStatus?.planTier || 'free'}
      />
    </div>
  );
}
