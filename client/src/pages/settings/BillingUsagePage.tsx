import { useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useBillingOverview } from '@/hooks/useBillingOverview';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { 
  CreditCard, 
  MessageSquare, 
  Phone, 
  Mail, 
  Bot, 
  ExternalLink,
  Loader2,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle
} from 'lucide-react';

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof CheckCircle }> = {
  trial: { label: 'Trial', variant: 'secondary', icon: Clock },
  active: { label: 'Active', variant: 'default', icon: CheckCircle },
  past_due: { label: 'Past Due', variant: 'destructive', icon: AlertCircle },
  suspended: { label: 'Suspended', variant: 'destructive', icon: XCircle },
  cancelled: { label: 'Cancelled', variant: 'outline', icon: XCircle },
  unknown: { label: 'Unknown', variant: 'outline', icon: AlertCircle },
};

export default function BillingUsagePage() {
  const { data: overview, isLoading, error } = useBillingOverview();
  const { toast } = useToast();
  const [isRedirecting, setIsRedirecting] = useState(false);

  const handleManageBilling = async () => {
    setIsRedirecting(true);
    try {
      const res = await fetch('/api/tenant/billing/portal-session', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      
      const data = await res.json();
      
      if (data.success && data.portalUrl) {
        window.location.href = data.portalUrl;
      } else {
        toast({
          title: 'Billing Portal',
          description: data.error || 'Billing portal is not yet configured. Please contact support.',
          variant: 'default',
        });
        setIsRedirecting(false);
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to open billing portal. Please try again.',
        variant: 'destructive',
      });
      setIsRedirecting(false);
    }
  };

  if (isLoading) {
    return (
      <AppShell title="Billing & Usage">
        <div className="p-6 max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </AppShell>
    );
  }

  if (error || !overview) {
    return (
      <AppShell title="Billing & Usage">
        <div className="p-6 max-w-4xl mx-auto">
          <Card className="border-destructive bg-destructive/5">
            <CardContent className="flex items-center gap-4 p-6">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <div>
                <h3 className="font-semibold text-destructive">Failed to load billing information</h3>
                <p className="text-sm text-muted-foreground">Please try refreshing the page.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  const status = statusConfig[overview.status] || statusConfig.unknown;
  const StatusIcon = status.icon;

  return (
    <AppShell title="Billing & Usage">
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="text-billing-title">
            Billing & Usage
          </h2>
          <p className="text-muted-foreground mt-1">
            View your current plan and usage summary.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 border-blue-200 dark:border-blue-800">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg">
                  <CreditCard className="h-5 w-5 text-white" />
                </div>
                <Badge variant={status.variant} className="flex items-center gap-1" data-testid="badge-plan-status">
                  <StatusIcon className="h-3 w-3" />
                  {status.label}
                </Badge>
              </div>
              <CardTitle className="mt-3" data-testid="text-plan-name">{overview.planName}</CardTitle>
              <CardDescription>
                {overview.planTierLabel} tier
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm text-muted-foreground">
                {overview.trialEndsAt && (
                  <p>
                    <span className="font-medium">Trial ends:</span> {new Date(overview.trialEndsAt).toLocaleDateString()}
                  </p>
                )}
                {overview.nextRenewalAt && (
                  <p>
                    <span className="font-medium">Next renewal:</span> {new Date(overview.nextRenewalAt).toLocaleDateString()}
                  </p>
                )}
                {!overview.trialEndsAt && !overview.nextRenewalAt && (
                  <p className="text-muted-foreground italic">
                    No billing cycle configured
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Manage Billing</CardTitle>
              <CardDescription>
                Update payment methods, view invoices, and manage your subscription.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={handleManageBilling}
                disabled={isRedirecting || !overview.hasStripeCustomer}
                className="w-full"
                data-testid="button-manage-billing"
              >
                {isRedirecting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Opening...
                  </>
                ) : (
                  <>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Manage Payment & Invoices
                  </>
                )}
              </Button>
              {!overview.hasStripeCustomer && (
                <p className="mt-3 text-sm text-muted-foreground text-center">
                  No billing account found. Upgrade your plan to access billing management.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Usage Summary (Last 30 Days)
          </h3>
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            <Card data-testid="card-usage-sms">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center">
                  <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full mb-3">
                    <MessageSquare className="h-5 w-5 text-white" />
                  </div>
                  <span className="text-3xl font-bold text-gray-900 dark:text-white" data-testid="text-sms-count">
                    {overview.usage.smsSentLast30d.toLocaleString()}
                  </span>
                  <span className="text-sm text-muted-foreground">SMS Sent</span>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-usage-voice">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center">
                  <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-full mb-3">
                    <Phone className="h-5 w-5 text-white" />
                  </div>
                  <span className="text-3xl font-bold text-gray-900 dark:text-white" data-testid="text-voice-minutes">
                    {overview.usage.voiceMinutesLast30d.toLocaleString()}
                  </span>
                  <span className="text-sm text-muted-foreground">Voice Minutes</span>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-usage-email">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center">
                  <div className="p-3 bg-gradient-to-br from-purple-500 to-violet-600 rounded-full mb-3">
                    <Mail className="h-5 w-5 text-white" />
                  </div>
                  <span className="text-3xl font-bold text-gray-900 dark:text-white" data-testid="text-email-count">
                    {overview.usage.emailsSentLast30d.toLocaleString()}
                  </span>
                  <span className="text-sm text-muted-foreground">Emails Sent</span>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-usage-ai">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center">
                  <div className="p-3 bg-gradient-to-br from-orange-500 to-amber-600 rounded-full mb-3">
                    <Bot className="h-5 w-5 text-white" />
                  </div>
                  <span className="text-3xl font-bold text-gray-900 dark:text-white" data-testid="text-ai-requests">
                    {overview.usage.aiRequestsLast30d.toLocaleString()}
                  </span>
                  <span className="text-sm text-muted-foreground">AI Requests</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {overview.estimatedCostLast30d > 0 && (
            <Card className="mt-4 bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-900/50 dark:to-slate-900/50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Estimated Usage Cost (30 days)</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="text-estimated-cost">
                      ${overview.estimatedCostLast30d.toFixed(2)}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground max-w-xs text-right">
                    This is an estimate based on your usage. Actual charges may vary based on your plan.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}
