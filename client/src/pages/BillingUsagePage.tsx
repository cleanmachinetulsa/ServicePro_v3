import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AppShell } from '@/components/AppShell';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  MessageSquare, 
  Phone, 
  Mail, 
  Bot, 
  TrendingUp,
  Calendar,
  DollarSign,
  Image
} from 'lucide-react';
import { 
  AreaChart, 
  Area,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend
} from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, parseISO, subDays } from 'date-fns';

interface UsageSummary {
  currentMonth: {
    smsTotal: number;
    mmsTotal: number;
    voiceMinutes: number;
    emailTotal: number;
    aiTokensTotal: number;
    estimatedCost: number;
  };
  previousMonth: {
    smsTotal: number;
    mmsTotal: number;
    voiceMinutes: number;
    emailTotal: number;
    aiTokensTotal: number;
    estimatedCost: number;
  };
  monthToDate: string;
}

interface DailyRollup {
  date: string;
  sms_total: number;
  mms_total: number;
  voice_total_minutes: number;
  email_total: number;
  ai_total_tokens: number;
  estimated_cost_usd: string;
}

interface Pricing {
  sms: { inbound: number; outbound: number };
  mms: { inbound: number; outbound: number };
  voice: { perMinute: number };
  email: { perEmail: number };
  ai: { perInputToken: number; perOutputToken: number };
}

export default function BillingUsagePage() {
  const { data: summaryData, isLoading: summaryLoading } = useQuery<{
    success: boolean;
    summary: UsageSummary;
    pricing: Pricing;
  }>({
    queryKey: ['/api/admin/usage/summary'],
    refetchInterval: 60000,
  });

  const { data: dailyData, isLoading: dailyLoading } = useQuery<{
    success: boolean;
    rollups: DailyRollup[];
    pricing: Pricing;
  }>({
    queryKey: ['/api/admin/usage/daily', 30],
    refetchInterval: 60000,
  });

  const isLoading = summaryLoading || dailyLoading;
  const summary = summaryData?.summary?.currentMonth || {
    smsTotal: 0,
    mmsTotal: 0,
    voiceMinutes: 0,
    emailTotal: 0,
    aiTokensTotal: 0,
    estimatedCost: 0,
  };
  const previousMonth = summaryData?.summary?.previousMonth;
  const rollups = dailyData?.rollups || [];
  const pricing = summaryData?.pricing;

  const chartData = rollups
    .slice()
    .reverse()
    .map((r) => ({
      date: format(parseISO(r.date), 'MMM d'),
      SMS: r.sms_total,
      MMS: r.mms_total,
      Voice: r.voice_total_minutes,
      Email: r.email_total,
      Cost: parseFloat(r.estimated_cost_usd) || 0,
    }));

  const getChangePercent = (current: number, previous: number | undefined) => {
    if (!previous || previous === 0) return null;
    const change = ((current - previous) / previous) * 100;
    return change;
  };

  const renderChange = (current: number, previous: number | undefined) => {
    const change = getChangePercent(current, previous);
    if (change === null) return null;
    const isUp = change > 0;
    return (
      <span className={`text-xs ${isUp ? 'text-yellow-600' : 'text-green-600'}`}>
        {isUp ? '↑' : '↓'} {Math.abs(change).toFixed(1)}% vs last month
      </span>
    );
  };

  if (isLoading) {
    return (
      <AppShell title="Billing & Usage">
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16 mb-2" />
                  <Skeleton className="h-3 w-20" />
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardContent className="pt-6">
              <Skeleton className="h-[300px] w-full" />
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Billing & Usage">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold" data-testid="text-usage-title">Month-to-Date Usage</h2>
            <p className="text-sm text-muted-foreground">
              <Calendar className="inline w-4 h-4 mr-1" />
              {summaryData?.summary?.monthToDate || format(new Date(), 'MMMM yyyy')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-primary" />
            <span className="text-2xl font-bold" data-testid="text-total-cost">
              ${summary.estimatedCost.toFixed(2)}
            </span>
            <span className="text-sm text-muted-foreground">estimated</span>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <Card data-testid="card-sms-usage">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">SMS</CardTitle>
              <MessageSquare className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.smsTotal.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">messages</p>
              {renderChange(summary.smsTotal, previousMonth?.smsTotal)}
            </CardContent>
          </Card>

          <Card data-testid="card-mms-usage">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">MMS</CardTitle>
              <Image className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.mmsTotal.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">media messages</p>
              {renderChange(summary.mmsTotal, previousMonth?.mmsTotal)}
            </CardContent>
          </Card>

          <Card data-testid="card-voice-usage">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Voice</CardTitle>
              <Phone className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.voiceMinutes.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">minutes</p>
              {renderChange(summary.voiceMinutes, previousMonth?.voiceMinutes)}
            </CardContent>
          </Card>

          <Card data-testid="card-email-usage">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Email</CardTitle>
              <Mail className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.emailTotal.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">emails sent</p>
              {renderChange(summary.emailTotal, previousMonth?.emailTotal)}
            </CardContent>
          </Card>

          <Card data-testid="card-ai-usage">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">AI Tokens</CardTitle>
              <Bot className="h-4 w-4 text-cyan-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {summary.aiTokensTotal >= 1000000
                  ? `${(summary.aiTokensTotal / 1000000).toFixed(1)}M`
                  : summary.aiTokensTotal >= 1000
                  ? `${(summary.aiTokensTotal / 1000).toFixed(1)}K`
                  : summary.aiTokensTotal.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">tokens used</p>
              {renderChange(summary.aiTokensTotal, previousMonth?.aiTokensTotal)}
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="trends" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="trends" data-testid="tab-trends">Trends</TabsTrigger>
            <TabsTrigger value="costs" data-testid="tab-costs">Cost Breakdown</TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-history">Daily History</TabsTrigger>
          </TabsList>

          <TabsContent value="trends">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  30-Day Usage Trends
                </CardTitle>
                <CardDescription>Daily message volume and costs</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Area type="monotone" dataKey="SMS" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
                    <Area type="monotone" dataKey="MMS" stackId="1" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.6} />
                    <Area type="monotone" dataKey="Voice" stackId="1" stroke="#22c55e" fill="#22c55e" fillOpacity={0.6} />
                    <Area type="monotone" dataKey="Email" stackId="1" stroke="#f97316" fill="#f97316" fillOpacity={0.6} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="costs">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Daily Cost Breakdown
                </CardTitle>
                <CardDescription>Estimated costs per day (last 30 days)</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => `$${value}`} />
                    <Tooltip formatter={(value: number) => `$${value.toFixed(4)}`} />
                    <Bar dataKey="Cost" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Daily Usage History</CardTitle>
                <CardDescription>Detailed breakdown by day</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">SMS</TableHead>
                        <TableHead className="text-right">MMS</TableHead>
                        <TableHead className="text-right">Voice (min)</TableHead>
                        <TableHead className="text-right">Email</TableHead>
                        <TableHead className="text-right">AI Tokens</TableHead>
                        <TableHead className="text-right">Est. Cost</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rollups.slice(0, 30).map((r, idx) => (
                        <TableRow key={idx} data-testid={`row-usage-${idx}`}>
                          <TableCell className="font-medium">
                            {format(parseISO(r.date), 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell className="text-right">{r.sms_total.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{r.mms_total.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{r.voice_total_minutes.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{r.email_total.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{r.ai_total_tokens.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-semibold">
                            ${parseFloat(r.estimated_cost_usd).toFixed(4)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {rollups.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                            No usage data available yet. Data will appear after daily rollup runs.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {pricing && (
          <Card>
            <CardHeader>
              <CardTitle>Current Pricing</CardTitle>
              <CardDescription>Per-unit costs used for billing calculations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-600 font-medium">SMS</p>
                  <p className="text-sm">In: ${pricing.sms.inbound.toFixed(4)}</p>
                  <p className="text-sm">Out: ${pricing.sms.outbound.toFixed(4)}</p>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg">
                  <p className="text-xs text-purple-600 font-medium">MMS</p>
                  <p className="text-sm">In: ${pricing.mms.inbound.toFixed(4)}</p>
                  <p className="text-sm">Out: ${pricing.mms.outbound.toFixed(4)}</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <p className="text-xs text-green-600 font-medium">Voice</p>
                  <p className="text-sm">${pricing.voice.perMinute.toFixed(4)}/min</p>
                </div>
                <div className="p-3 bg-orange-50 rounded-lg">
                  <p className="text-xs text-orange-600 font-medium">Email</p>
                  <p className="text-sm">${pricing.email.perEmail.toFixed(4)}/email</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
