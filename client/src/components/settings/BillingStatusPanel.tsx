import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  CreditCard, 
  TrendingUp,
  AlertTriangle,
  XCircle,
  Calendar,
  DollarSign
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

interface BillingOverview {
  planId: string | null;
  planName: string;
  planTier: string;
  planTierLabel: string;
  status: 'trial' | 'active' | 'past_due' | 'suspended' | 'cancelled' | 'unknown';
  trialEndsAt: string | null;
  nextRenewalAt: string | null;
  hasStripeCustomer: boolean;
  hasSubscription: boolean;
  cancelAtPeriodEnd: boolean;
  usage: {
    smsSentLast30d: number;
    voiceMinutesLast30d: number;
    emailsSentLast30d: number;
    aiRequestsLast30d: number;
  };
  estimatedCostLast30d: number;
  planLimits: {
    sms: number | null;
    mms: number | null;
    voice: number | null;
    email: number | null;
    ai: number | null;
  };
  currentPeriod: {
    startDate: string;
    endDate: string;
    label: string;
  };
  failedPaymentAttempts: number;
  delinquentSince: string | null;
  lastInvoiceStatus: string | null;
}

const statusConfig: Record<BillingOverview['status'], { 
  label: string; 
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  icon: typeof CheckCircle;
  color: string;
}> = {
  active: { label: 'Active', variant: 'default', icon: CheckCircle, color: 'text-green-600' },
  trial: { label: 'Trial', variant: 'secondary', icon: Clock, color: 'text-blue-600' },
  past_due: { label: 'Past Due', variant: 'destructive', icon: AlertCircle, color: 'text-yellow-600' },
  suspended: { label: 'Suspended', variant: 'destructive', icon: XCircle, color: 'text-red-600' },
  cancelled: { label: 'Cancelled', variant: 'outline', icon: XCircle, color: 'text-gray-600' },
  unknown: { label: 'Unknown', variant: 'outline', icon: AlertTriangle, color: 'text-gray-400' },
};

export default function BillingStatusPanel() {
  const { data, isLoading, error } = useQuery<{ success: boolean; overview: BillingOverview }>({
    queryKey: ['/api/settings/billing/overview'],
  });

  const overview = data?.overview;

  if (isLoading) {
    return (
      <div className="space-y-6" data-testid="billing-status-loading">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error || !overview) {
    return (
      <Card data-testid="billing-status-error">
        <CardContent className="flex items-center gap-3 p-6">
          <AlertCircle className="h-6 w-6 text-red-500" />
          <div>
            <p className="font-medium">Failed to load billing information</p>
            <p className="text-sm text-muted-foreground">Please try refreshing the page</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const statusInfo = statusConfig[overview.status];
  const StatusIcon = statusInfo.icon;
  const hasDunningIssue = overview.failedPaymentAttempts > 0 || overview.delinquentSince != null;

  return (
    <div className="space-y-6" data-testid="billing-status-panel">
      <Card data-testid="card-billing-status">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Account Status
              </CardTitle>
              <CardDescription>Your subscription and billing status</CardDescription>
            </div>
            <Badge variant={statusInfo.variant} className="flex items-center gap-1" data-testid="badge-status">
              <StatusIcon className="h-3 w-3" />
              {statusInfo.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">Current Plan</p>
              <p className="text-xl font-semibold" data-testid="text-plan-name">{overview.planName}</p>
            </div>
            
            {overview.nextRenewalAt && (
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  {overview.cancelAtPeriodEnd ? 'Cancels On' : 'Next Renewal'}
                </p>
                <p className="text-xl font-semibold" data-testid="text-next-renewal">
                  {format(new Date(overview.nextRenewalAt), 'MMM d, yyyy')}
                </p>
                {overview.cancelAtPeriodEnd && (
                  <Badge variant="outline" className="mt-2">Scheduled to Cancel</Badge>
                )}
              </div>
            )}

            {overview.trialEndsAt && overview.status === 'trial' && (
              <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-600 dark:text-blue-400">Trial Ends</p>
                <p className="text-xl font-semibold text-blue-900 dark:text-blue-100" data-testid="text-trial-ends">
                  {formatDistanceToNow(new Date(overview.trialEndsAt), { addSuffix: true })}
                </p>
              </div>
            )}
          </div>

          {!overview.hasStripeCustomer && (
            <div className="p-4 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-900 dark:text-yellow-100">No Payment Method</p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    Add a payment method to avoid service interruption
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {hasDunningIssue && (
        <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20" data-testid="card-payment-issue">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-300">
              <AlertCircle className="h-5 w-5" />
              Payment Issue
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-red-600 dark:text-red-400">Failed Payment Attempts</p>
                <p className="text-2xl font-bold text-red-700 dark:text-red-300" data-testid="text-failed-attempts">
                  {overview.failedPaymentAttempts}
                </p>
              </div>
              
              {overview.delinquentSince && (
                <div>
                  <p className="text-sm text-red-600 dark:text-red-400">Delinquent Since</p>
                  <p className="text-lg font-semibold text-red-700 dark:text-red-300" data-testid="text-delinquent-since">
                    {format(new Date(overview.delinquentSince), 'MMM d, yyyy')}
                    <span className="text-sm font-normal ml-2">
                      ({formatDistanceToNow(new Date(overview.delinquentSince), { addSuffix: true })})
                    </span>
                  </p>
                </div>
              )}
            </div>

            <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <p className="text-sm text-red-800 dark:text-red-200">
                Please update your payment method to avoid service interruption. 
                Your account may be suspended after {3 - overview.failedPaymentAttempts} more failed attempts.
              </p>
            </div>

            <Button variant="destructive" className="w-full sm:w-auto" data-testid="button-update-payment">
              Update Payment Method
            </Button>
          </CardContent>
        </Card>
      )}

      <Card data-testid="card-usage-summary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Usage Summary
          </CardTitle>
          <CardDescription>{overview.currentPeriod.label}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold" data-testid="text-sms-usage">{overview.usage.smsSentLast30d}</p>
              <p className="text-xs text-muted-foreground">SMS Sent</p>
              {overview.planLimits.sms && (
                <p className="text-xs text-muted-foreground">
                  of {overview.planLimits.sms.toLocaleString()}
                </p>
              )}
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold" data-testid="text-voice-usage">{overview.usage.voiceMinutesLast30d}</p>
              <p className="text-xs text-muted-foreground">Voice Min</p>
              {overview.planLimits.voice && (
                <p className="text-xs text-muted-foreground">
                  of {overview.planLimits.voice.toLocaleString()}
                </p>
              )}
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold" data-testid="text-email-usage">{overview.usage.emailsSentLast30d}</p>
              <p className="text-xs text-muted-foreground">Emails</p>
              {overview.planLimits.email && (
                <p className="text-xs text-muted-foreground">
                  of {overview.planLimits.email.toLocaleString()}
                </p>
              )}
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold" data-testid="text-ai-usage">{overview.usage.aiRequestsLast30d}</p>
              <p className="text-xs text-muted-foreground">AI Requests</p>
            </div>
          </div>

          <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-blue-600" />
                <span className="text-sm font-medium">Estimated Cost This Period</span>
              </div>
              <span className="text-xl font-bold text-blue-600" data-testid="text-estimated-cost">
                ${overview.estimatedCostLast30d.toFixed(2)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-invoice-status">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Invoice Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            {overview.lastInvoiceStatus === 'paid' && (
              <>
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="text-green-700 dark:text-green-300">Last invoice paid</span>
              </>
            )}
            {overview.lastInvoiceStatus === 'past_due' && (
              <>
                <AlertCircle className="h-5 w-5 text-yellow-500" />
                <span className="text-yellow-700 dark:text-yellow-300">Invoice past due</span>
              </>
            )}
            {!overview.lastInvoiceStatus && (
              <>
                <Clock className="h-5 w-5 text-gray-400" />
                <span className="text-muted-foreground">No invoices yet</span>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
