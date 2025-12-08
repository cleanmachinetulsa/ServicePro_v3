import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/AppShell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
  MessageSquare, 
  Phone, 
  Mail, 
  Bot, 
  DollarSign,
  TrendingUp,
  Calendar,
  Image,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';

interface ChannelData {
  channel: string;
  count: number;
  costCents: number;
  costUsd: number;
}

interface DailyUsage {
  date: string;
  totalCostCents: number;
  smsCount: number;
  mmsCount: number;
  voiceMinutes: number;
  emailCount: number;
  aiTokens: number;
}

interface UsageSummaryResponse {
  success: boolean;
  data: {
    channels: ChannelData[];
    daily: DailyUsage[];
    totalCostCents: number;
    totalCostUsd: number;
    period: {
      from: string;
      to: string;
      label: string;
    };
  };
}

const CHANNEL_ICONS: Record<string, typeof MessageSquare> = {
  sms: MessageSquare,
  mms: Image,
  voice: Phone,
  email: Mail,
  ai: Bot,
};

const CHANNEL_LABELS: Record<string, string> = {
  sms: 'SMS Messages',
  mms: 'MMS Messages',
  voice: 'Voice Minutes',
  email: 'Emails',
  ai: 'AI Tokens',
};

const CHANNEL_COLORS: Record<string, string> = {
  sms: 'bg-green-500',
  mms: 'bg-emerald-600',
  voice: 'bg-blue-500',
  email: 'bg-purple-500',
  ai: 'bg-orange-500',
};

function formatCurrency(cents: number): string {
  const dollars = cents / 100;
  if (dollars < 0.01 && dollars > 0) {
    return `$${dollars.toFixed(4)}`;
  }
  return `$${dollars.toFixed(2)}`;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

type PeriodOption = 'this_month' | 'last_month' | 'last_30_days' | 'last_90_days';

function getDateRange(period: PeriodOption): { from: string; to: string } {
  const now = new Date();
  
  switch (period) {
    case 'this_month': {
      const from = startOfMonth(now);
      const to = endOfMonth(now);
      return { 
        from: format(from, 'yyyy-MM-dd'), 
        to: format(to, 'yyyy-MM-dd') 
      };
    }
    case 'last_month': {
      const lastMonth = subMonths(now, 1);
      const from = startOfMonth(lastMonth);
      const to = endOfMonth(lastMonth);
      return { 
        from: format(from, 'yyyy-MM-dd'), 
        to: format(to, 'yyyy-MM-dd') 
      };
    }
    case 'last_30_days': {
      const from = new Date(now);
      from.setDate(from.getDate() - 30);
      return { 
        from: format(from, 'yyyy-MM-dd'), 
        to: format(now, 'yyyy-MM-dd') 
      };
    }
    case 'last_90_days': {
      const from = new Date(now);
      from.setDate(from.getDate() - 90);
      return { 
        from: format(from, 'yyyy-MM-dd'), 
        to: format(now, 'yyyy-MM-dd') 
      };
    }
  }
}

export default function UsageCostsPage() {
  const [period, setPeriod] = useState<PeriodOption>('this_month');
  
  const dateRange = getDateRange(period);
  
  const { data, isLoading, isError } = useQuery<UsageSummaryResponse>({
    queryKey: ['/api/admin/usage/summary', dateRange.from, dateRange.to],
    queryFn: async () => {
      const res = await fetch(`/api/admin/usage/summary?from=${dateRange.from}&to=${dateRange.to}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch usage summary');
      return res.json();
    },
  });

  const channels = data?.data?.channels || [];
  const daily = data?.data?.daily || [];
  const totalCostCents = data?.data?.totalCostCents || 0;
  const periodLabel = data?.data?.period?.label || 'Current Period';

  const chartData = daily.map(d => ({
    date: format(new Date(d.date), 'MMM d'),
    cost: d.totalCostCents / 100,
  }));

  if (isLoading) {
    return (
      <AppShell title="Usage & Costs">
        <div className="p-6 max-w-6xl mx-auto space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
          <Skeleton className="h-64" />
        </div>
      </AppShell>
    );
  }

  if (isError) {
    return (
      <AppShell title="Usage & Costs">
        <div className="p-6 max-w-6xl mx-auto">
          <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30">
            <CardContent className="pt-6">
              <p className="text-red-700 dark:text-red-400">Failed to load usage data. Please try again later.</p>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Usage & Costs">
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="text-usage-costs-title">
              Usage & Costs
            </h2>
            <p className="text-muted-foreground mt-1">
              {periodLabel} - Per-channel breakdown
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={(v) => setPeriod(v as PeriodOption)}>
              <SelectTrigger className="w-[160px]" data-testid="select-period">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="this_month">This Month</SelectItem>
                <SelectItem value="last_month">Last Month</SelectItem>
                <SelectItem value="last_30_days">Last 30 Days</SelectItem>
                <SelectItem value="last_90_days">Last 90 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Estimated Cost</CardTitle>
              <DollarSign className="h-5 w-5 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-blue-700 dark:text-blue-400" data-testid="text-total-cost">
              {formatCurrency(totalCostCents)}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Based on usage during selected period
            </p>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {channels.map((channel) => {
            const Icon = CHANNEL_ICONS[channel.channel] || MessageSquare;
            const label = CHANNEL_LABELS[channel.channel] || channel.channel;
            const bgColor = CHANNEL_COLORS[channel.channel] || 'bg-gray-500';
            
            return (
              <Card key={channel.channel} data-testid={`card-channel-${channel.channel}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
                    <div className={`p-2 rounded-full ${bgColor}/10`}>
                      <Icon className={`h-4 w-4 ${bgColor.replace('bg-', 'text-')}`} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid={`text-${channel.channel}-cost`}>
                    {formatCurrency(channel.costCents)}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatNumber(channel.count)} {channel.channel === 'voice' ? 'min' : channel.channel === 'ai' ? 'tokens' : 'sent'}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Daily Cost Trend</CardTitle>
                <CardDescription>Estimated cost over time</CardDescription>
              </div>
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      tickFormatter={(v) => `$${v.toFixed(2)}`}
                    />
                    <Tooltip 
                      formatter={(value: number) => [`$${value.toFixed(4)}`, 'Cost']}
                      labelStyle={{ fontWeight: 'bold' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="cost" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                No usage data for this period
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Channel Breakdown</CardTitle>
            <CardDescription>Detailed cost and usage by channel</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Channel</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">% of Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {channels.map((channel) => {
                  const Icon = CHANNEL_ICONS[channel.channel] || MessageSquare;
                  const label = CHANNEL_LABELS[channel.channel] || channel.channel;
                  const percentage = totalCostCents > 0 
                    ? ((channel.costCents / totalCostCents) * 100).toFixed(1)
                    : '0';
                  
                  return (
                    <TableRow key={channel.channel} data-testid={`row-channel-${channel.channel}`}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          {label}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(channel.count)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(channel.costCents)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">{percentage}%</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
