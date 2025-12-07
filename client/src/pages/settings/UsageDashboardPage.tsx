/**
 * SP-18: Tenant-facing Usage Dashboard
 * 
 * Shows current billing period usage with caps, warnings, and daily trends.
 */

import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/AppShell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, MessageSquare, Phone, Mail, Sparkles, Image, AlertTriangle, CheckCircle, XCircle, TrendingUp, HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';

interface ChannelStatus {
  channel: string;
  used: number;
  cap: number;
  percentUsed: number;
  status: 'ok' | 'warning' | 'over_cap';
  unitLabel: string;
  estimatedCostCents?: number;
}

interface UsageSummary {
  tenantId: string;
  period: {
    year: number;
    month: number;
    label: string;
  };
  channels: Record<string, ChannelStatus>;
  overallStatus: 'ok' | 'warning' | 'over_cap';
  hardStopEnabled: boolean;
}

interface DailyUsage {
  date: string;
  sms: number;
  mms: number;
  voice: number;
  email: number;
  ai: number;
}

const CHANNEL_CONFIG: Record<string, { icon: typeof MessageSquare; label: string; color: string }> = {
  sms: { icon: MessageSquare, label: 'SMS Messages', color: 'bg-blue-500' },
  mms: { icon: Image, label: 'MMS Messages', color: 'bg-purple-500' },
  voice: { icon: Phone, label: 'Voice Minutes', color: 'bg-green-500' },
  email: { icon: Mail, label: 'Emails Sent', color: 'bg-orange-500' },
  ai: { icon: Sparkles, label: 'AI Tokens', color: 'bg-pink-500' },
};

function getStatusIcon(status: string) {
  switch (status) {
    case 'ok': return <CheckCircle className="w-4 h-4 text-green-500" />;
    case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    case 'over_cap': return <XCircle className="w-4 h-4 text-red-500" />;
    default: return null;
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'ok': return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">OK</Badge>;
    case 'warning': return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Near Limit</Badge>;
    case 'over_cap': return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Over Cap</Badge>;
    default: return null;
  }
}

function formatCost(cents?: number): string {
  if (cents === undefined) return '-';
  return `$${(cents / 100).toFixed(2)}`;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function ChannelCard({ channel, status }: { channel: string; status: ChannelStatus }) {
  const config = CHANNEL_CONFIG[channel];
  if (!config) return null;

  const Icon = config.icon;
  const progressColor = status.status === 'over_cap' ? 'bg-red-500' : 
                        status.status === 'warning' ? 'bg-yellow-500' : 
                        'bg-green-500';

  return (
    <Card className="relative overflow-hidden" data-testid={`usage-card-${channel}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${config.color} bg-opacity-10`}>
              <Icon className={`w-4 h-4 ${config.color.replace('bg-', 'text-')}`} />
            </div>
            <CardTitle className="text-sm font-medium">{config.label}</CardTitle>
          </div>
          {getStatusBadge(status.status)}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {formatNumber(status.used)} of {formatNumber(status.cap)} {status.unitLabel}
            </span>
            <span className="font-medium">{status.percentUsed.toFixed(1)}%</span>
          </div>
          <div className="relative h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className={`absolute left-0 top-0 h-full ${progressColor} transition-all`}
              style={{ width: `${Math.min(status.percentUsed, 100)}%` }}
            />
          </div>
        </div>
        {status.estimatedCostCents !== undefined && (
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Estimated cost</span>
            <span className="font-medium">{formatCost(status.estimatedCostCents)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function UsageDashboardPage() {
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: summaryData, isLoading: summaryLoading, isError: summaryError, refetch: refetchSummary } = useQuery<{ success: boolean; data: UsageSummary }>({
    queryKey: ['/api/billing/usage/v2/summary'],
  });

  const { data: dailyData, isLoading: dailyLoading, isError: dailyError, refetch: refetchDaily } = useQuery<{ success: boolean; data: DailyUsage[] }>({
    queryKey: ['/api/billing/usage/v2/daily'],
  });

  const hasError = summaryError || dailyError;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await apiRequest('POST', '/api/billing/usage/v2/refresh');
      await Promise.all([refetchSummary(), refetchDaily()]);
      toast({
        title: 'Usage Refreshed',
        description: 'Your usage data has been updated.',
      });
    } catch (error) {
      toast({
        title: 'Refresh Failed',
        description: 'Could not refresh usage data. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const summary = summaryData?.data;
  const daily = dailyData?.data || [];

  const totalEstimatedCost = summary 
    ? Object.values(summary.channels).reduce((sum, ch) => sum + (ch.estimatedCostCents || 0), 0)
    : 0;

  return (
    <AppShell title="Usage & Caps">
      <div className="space-y-6 p-6" data-testid="usage-dashboard-page">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold">Usage & Costs</h1>
            <p className="text-muted-foreground">
              {summary ? `${summary.period.label} billing period` : 'Current billing period'}
            </p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={isRefreshing}
            data-testid="button-refresh-usage"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {hasError && (
          <Card className="border-red-300 bg-red-50">
            <CardContent className="flex items-center gap-3 py-4">
              <XCircle className="w-5 h-5 text-red-500" />
              <div>
                <p className="font-medium text-red-700">Unable to load usage data</p>
                <p className="text-sm text-red-600">
                  There was a problem fetching your usage information. Please try refreshing.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {summary?.overallStatus && summary.overallStatus !== 'ok' && (
          <Card className={summary.overallStatus === 'over_cap' ? 'border-red-300 bg-red-50' : 'border-yellow-300 bg-yellow-50'}>
            <CardContent className="flex items-center gap-3 py-4">
              {getStatusIcon(summary.overallStatus)}
              <div>
                <p className="font-medium">
                  {summary.overallStatus === 'over_cap' 
                    ? "You've exceeded your monthly usage cap for some channels"
                    : "You're nearing your monthly usage cap"
                  }
                </p>
                <p className="text-sm text-muted-foreground">
                  {summary.hardStopEnabled 
                    ? "Some actions may be blocked. Contact support or upgrade your plan."
                    : "Consider upgrading your plan or contact support."}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {summaryLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-6 w-32" />
                </CardHeader>
                <CardContent className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-2 w-full" />
                </CardContent>
              </Card>
            ))
          ) : summary ? (
            Object.entries(summary.channels).map(([channel, status]) => (
              <ChannelCard key={channel} channel={channel} status={status} />
            ))
          ) : (
            <Card className="col-span-full">
              <CardContent className="py-8 text-center text-muted-foreground">
                No usage data available yet
              </CardContent>
            </Card>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Usage Trends (Last 30 Days)</CardTitle>
                <TrendingUp className="w-5 h-5 text-muted-foreground" />
              </div>
              <CardDescription>Daily usage across all channels</CardDescription>
            </CardHeader>
            <CardContent>
              {dailyLoading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : daily.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={daily}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <RechartsTooltip />
                    <Legend />
                    <Area type="monotone" dataKey="sms" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} name="SMS" />
                    <Area type="monotone" dataKey="email" stackId="1" stroke="#f97316" fill="#f97316" fillOpacity={0.6} name="Email" />
                    <Area type="monotone" dataKey="voice" stackId="1" stroke="#22c55e" fill="#22c55e" fillOpacity={0.6} name="Voice" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                  No usage data yet
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Cost Summary</CardTitle>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="w-4 h-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>Estimated costs based on standard rates for Twilio, OpenAI, and SendGrid. Actual billing may vary.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <CardDescription>Estimated costs for this billing period</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {summaryLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-6 w-full" />
                  ))}
                </div>
              ) : summary ? (
                <>
                  <div className="space-y-2">
                    {Object.entries(summary.channels).map(([channel, status]) => {
                      const config = CHANNEL_CONFIG[channel];
                      if (!config || status.estimatedCostCents === undefined) return null;
                      return (
                        <div key={channel} className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">{config.label}</span>
                          <span className="font-medium">{formatCost(status.estimatedCostCents)}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="border-t pt-3">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Total Estimated</span>
                      <span className="text-lg font-bold">{formatCost(totalEstimatedCost)}</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-4 text-center text-muted-foreground">
                  No cost data available
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <HelpCircle className="w-4 h-4" />
              About Usage Tracking
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              These numbers are based on Twilio (SMS/MMS/Voice), OpenAI (AI messages), and SendGrid (Email) usage 
              recorded through ServicePro. Caps are per-month soft limits based on your plan tier. 
              Going over them may affect your service in a future release. Contact support to upgrade your plan.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
