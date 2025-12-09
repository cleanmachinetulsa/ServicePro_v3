import { useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useBillingOverview } from '@/hooks/useBillingOverview';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
  XCircle,
  CalendarOff,
  Calendar,
  TrendingUp,
  FileText,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof CheckCircle }> = {
  trial: { label: 'Trial', variant: 'secondary', icon: Clock },
  active: { label: 'Active', variant: 'default', icon: CheckCircle },
  past_due: { label: 'Past Due', variant: 'destructive', icon: AlertCircle },
  suspended: { label: 'Suspended', variant: 'destructive', icon: XCircle },
  cancelled: { label: 'Cancelled', variant: 'outline', icon: XCircle },
  unknown: { label: 'Unknown', variant: 'outline', icon: AlertCircle },
};

function formatLimit(limit: number): string {
  if (limit >= 999999) return 'Unlimited';
  if (limit >= 1000) return `${(limit / 1000).toFixed(0)}k`;
  return limit.toString();
}

function getUsagePercentage(current: number, limit: number): number {
  if (limit <= 0 || limit >= 999999) return 0;
  return Math.min(100, Math.round((current / limit) * 100));
}

function getProgressColor(percentage: number): string {
  if (percentage >= 90) return 'bg-red-500';
  if (percentage >= 75) return 'bg-amber-500';
  return 'bg-green-500';
}

interface UsageCardProps {
  icon: typeof MessageSquare;
  label: string;
  current: number;
  limit: number;
  gradientFrom: string;
  gradientTo: string;
  testId: string;
}

function UsageCard({ icon: Icon, label, current, limit, gradientFrom, gradientTo, testId }: UsageCardProps) {
  const percentage = getUsagePercentage(current, limit);
  const isUnlimited = limit >= 999999;
  
  return (
    <Card data-testid={testId}>
      <CardContent className="pt-6">
        <div className="flex flex-col items-center text-center">
          <div className={`p-3 bg-gradient-to-br ${gradientFrom} ${gradientTo} rounded-full mb-3`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
          <span className="text-2xl font-bold text-gray-900 dark:text-white">
            {current.toLocaleString()}
          </span>
          <span className="text-xs text-muted-foreground mb-2">
            {isUnlimited ? 'Unlimited' : `of ${formatLimit(limit)}`}
          </span>
          {!isUnlimited && (
            <div className="w-full mt-2">
              <Progress 
                value={percentage} 
                className="h-2"
              />
              <span className="text-xs text-muted-foreground mt-1 block">
                {percentage}% used
              </span>
            </div>
          )}
          <span className="text-sm text-muted-foreground mt-1">{label}</span>
        </div>
      </CardContent>
    </Card>
  );
}

interface UsageLedgerEvent {
  id: string;
  tenantId: string;
  source: 'twilio' | 'openai' | 'sendgrid' | 'system';
  eventType: string;
  units: number;
  metadata: Record<string, unknown> | null;
  occurredAt: string;
}

interface UsageLedgerResponse {
  success: boolean;
  events: UsageLedgerEvent[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

const SOURCE_LABELS: Record<string, { label: string; icon: typeof MessageSquare; color: string }> = {
  twilio: { label: 'Twilio', icon: MessageSquare, color: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' },
  openai: { label: 'AI', icon: Bot, color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300' },
  sendgrid: { label: 'Email', icon: Mail, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300' },
  system: { label: 'System', icon: FileText, color: 'bg-gray-100 text-gray-700 dark:bg-gray-900/50 dark:text-gray-300' },
};

function formatEventType(eventType: string): string {
  return eventType
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function BillingUsagePage() {
  const { data: overview, isLoading, error } = useBillingOverview();
  const { toast } = useToast();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: ledgerData, isLoading: ledgerLoading } = useQuery<UsageLedgerResponse>({
    queryKey: ['/api/billing/usage/events'],
    enabled: ledgerOpen,
  });

  const cancelMutation = useMutation({
    mutationFn: async (cancelAtPeriodEnd: boolean) => {
      const res = await apiRequest('POST', '/api/billing/cancel-at-period-end', { cancelAtPeriodEnd });
      return (res as any).cancelAtPeriodEnd as boolean;
    },
    onSuccess: (value) => {
      queryClient.setQueryData(['settings', 'billing-overview'], (prev: any) =>
        prev ? { ...prev, cancelAtPeriodEnd: value } : prev
      );
      toast({
        title: value ? 'Subscription will cancel' : 'Subscription will continue',
        description: value
          ? 'Your subscription will cancel at the end of the current billing period.'
          : 'Your subscription will continue renewing automatically.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update subscription settings.',
        variant: 'destructive',
      });
    },
  });

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
      <AppShell title="Usage & Billing">
        <div className="p-6 max-w-5xl mx-auto space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </AppShell>
    );
  }

  if (error || !overview) {
    return (
      <AppShell title="Usage & Billing">
        <div className="p-6 max-w-5xl mx-auto">
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
  const planLimits = overview.planLimits;
  const currentPeriod = overview.currentPeriod;

  const chartData = (overview.dailyUsage || []).map(day => ({
    date: new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    SMS: day.smsCount,
    AI: day.aiRequests,
    Email: day.emailCount,
    Voice: day.voiceMinutes,
  }));

  return (
    <AppShell title="Usage & Billing">
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="text-billing-title">
              Usage & Billing
            </h2>
            <p className="text-muted-foreground mt-1">
              View your current plan and usage summary.
            </p>
          </div>
          {currentPeriod && (
            <Badge variant="outline" className="flex items-center gap-2 px-3 py-1.5" data-testid="badge-billing-period">
              <Calendar className="h-4 w-4" />
              Billing Period: {currentPeriod.label}
            </Badge>
          )}
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
                {planLimits && planLimits.baseMonthlyPrice > 0 && (
                  <span className="ml-2 text-sm font-medium">
                    ${planLimits.baseMonthlyPrice}/mo
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm text-muted-foreground">
                {planLimits && (
                  <p className="text-xs">{planLimits.description}</p>
                )}
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

        {overview.status === 'trial' && (
          <Card className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/50 dark:to-yellow-950/50 border-amber-200 dark:border-amber-800">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="p-2 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-lg">
                <Clock className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-amber-900 dark:text-amber-100" data-testid="text-trial-notice">Trial Period</h3>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  {overview.trialEndsAt 
                    ? `Your trial will end on ${new Date(overview.trialEndsAt).toLocaleDateString()}. You'll be prompted to choose a plan before being charged.`
                    : `You're currently on a trial. You'll be prompted to choose a plan before being charged.`
                  }
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {overview.status === 'past_due' && (
          <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/50 dark:to-orange-950/50 border-amber-300 dark:border-amber-700" data-testid="card-past-due-banner">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg">
                <AlertCircle className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-amber-900 dark:text-amber-100" data-testid="text-past-due-title">Payment Issue</h3>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  We had trouble charging your payment method. Please update your payment details to avoid interruption to your service.
                </p>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleManageBilling}
                disabled={isRedirecting || !overview.hasStripeCustomer}
                className="shrink-0 border-amber-400 text-amber-700 hover:bg-amber-100 dark:border-amber-600 dark:text-amber-300 dark:hover:bg-amber-900"
                data-testid="button-update-payment-past-due"
              >
                {isRedirecting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update Payment'}
              </Button>
            </CardContent>
          </Card>
        )}

        {overview.status === 'suspended' && (
          <Card className="bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/50 dark:to-rose-950/50 border-red-300 dark:border-red-700" data-testid="card-suspended-banner">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="p-2 bg-gradient-to-br from-red-500 to-rose-600 rounded-lg">
                <XCircle className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-red-900 dark:text-red-100" data-testid="text-suspended-title">Account Suspended</h3>
                <p className="text-sm text-red-700 dark:text-red-300">
                  Your account is currently suspended due to unpaid invoices. Outbound SMS, voice, and email services are disabled. Update your payment method to restore full functionality.
                </p>
              </div>
              <Button 
                variant="destructive" 
                size="sm"
                onClick={handleManageBilling}
                disabled={isRedirecting || !overview.hasStripeCustomer}
                className="shrink-0"
                data-testid="button-update-payment-suspended"
              >
                {isRedirecting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update Payment Now'}
              </Button>
            </CardContent>
          </Card>
        )}

        {(overview.status === 'active' || overview.status === 'past_due') && overview.hasSubscription && (
          <Card data-testid="card-subscription-settings">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <CalendarOff className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-lg">Subscription Settings</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="cancel-toggle" className="font-medium">
                    Cancel at end of billing period
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {overview.cancelAtPeriodEnd 
                      ? "Your subscription will end after the current period. You'll keep access until then."
                      : "Your subscription will renew automatically at the end of each billing period."
                    }
                  </p>
                </div>
                <Switch
                  id="cancel-toggle"
                  checked={overview.cancelAtPeriodEnd}
                  onCheckedChange={(checked) => cancelMutation.mutate(checked)}
                  disabled={cancelMutation.isPending}
                  data-testid="switch-cancel-at-period-end"
                />
              </div>
              {overview.cancelAtPeriodEnd && (
                <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <p className="text-sm text-amber-800 dark:text-amber-200 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Your subscription is set to cancel. Toggle off to continue renewing.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Current Period Usage
            </h3>
            {currentPeriod && (
              <span className="text-sm text-muted-foreground">
                ({currentPeriod.startDate} - {currentPeriod.endDate})
              </span>
            )}
          </div>
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            <UsageCard
              icon={MessageSquare}
              label="SMS Messages"
              current={overview.usage.smsSentLast30d}
              limit={planLimits?.maxSmsPerMonth || 999999}
              gradientFrom="from-green-500"
              gradientTo="to-emerald-600"
              testId="card-usage-sms"
            />
            <UsageCard
              icon={Phone}
              label="Voice Minutes"
              current={overview.usage.voiceMinutesLast30d}
              limit={planLimits?.maxVoiceMinutesPerMonth || 999999}
              gradientFrom="from-blue-500"
              gradientTo="to-cyan-600"
              testId="card-usage-voice"
            />
            <UsageCard
              icon={Mail}
              label="Emails Sent"
              current={overview.usage.emailsSentLast30d}
              limit={planLimits?.maxEmailsPerMonth || 999999}
              gradientFrom="from-purple-500"
              gradientTo="to-violet-600"
              testId="card-usage-email"
            />
            <UsageCard
              icon={Bot}
              label="AI Requests"
              current={overview.usage.aiRequestsLast30d}
              limit={planLimits?.maxAiRequestsPerMonth || 999999}
              gradientFrom="from-orange-500"
              gradientTo="to-amber-600"
              testId="card-usage-ai"
            />
          </div>

          {overview.estimatedCostLast30d > 0 && (
            <Card className="mt-4 bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-900/50 dark:to-slate-900/50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Estimated Usage Cost (This Period)</p>
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

        {chartData.length > 0 && (
          <Card data-testid="card-usage-chart">
            <CardHeader>
              <CardTitle className="text-lg">Daily Usage Trend (Last 30 Days)</CardTitle>
              <CardDescription>
                Track your usage patterns over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12 }}
                      className="text-muted-foreground"
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      className="text-muted-foreground"
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="SMS" 
                      stroke="#22c55e" 
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="AI" 
                      stroke="#f97316" 
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="Email" 
                      stroke="#8b5cf6" 
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        <Collapsible open={ledgerOpen} onOpenChange={setLedgerOpen}>
          <Card data-testid="card-usage-ledger">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-lg">Usage Event Log</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    {ledgerData?.pagination && (
                      <Badge variant="secondary" data-testid="badge-ledger-count">
                        {ledgerData.pagination.total} events
                      </Badge>
                    )}
                    {ledgerOpen ? (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                </div>
                <CardDescription>
                  Detailed log of all billable events (SMS, AI, email, voice)
                </CardDescription>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                {ledgerLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                ) : ledgerData?.events && ledgerData.events.length > 0 ? (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Time</TableHead>
                          <TableHead>Source</TableHead>
                          <TableHead>Event</TableHead>
                          <TableHead className="text-right">Units</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ledgerData.events.slice(0, 20).map((event) => {
                          const sourceConfig = SOURCE_LABELS[event.source] || { 
                            label: event.source, 
                            icon: FileText, 
                            color: 'bg-gray-100 text-gray-700' 
                          };
                          const SourceIcon = sourceConfig.icon;
                          return (
                            <TableRow key={event.id} data-testid={`row-ledger-${event.id}`}>
                              <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                {new Date(event.occurredAt).toLocaleString()}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={`${sourceConfig.color} flex items-center gap-1 w-fit`}>
                                  <SourceIcon className="h-3 w-3" />
                                  {sourceConfig.label}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm">
                                {formatEventType(event.eventType)}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {event.units}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="py-8 text-center text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No usage events recorded yet.</p>
                    <p className="text-sm">Events will appear here as you use SMS, AI, and email features.</p>
                  </div>
                )}
                {ledgerData?.pagination && ledgerData.pagination.total > 20 && (
                  <p className="mt-4 text-sm text-muted-foreground text-center">
                    Showing 20 of {ledgerData.pagination.total} events
                  </p>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </div>
    </AppShell>
  );
}
