import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/AppShell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Download, 
  MessageSquare, 
  Phone, 
  Mail, 
  Bot, 
  TrendingUp,
  DollarSign,
  BarChart3,
  PieChart,
  AlertCircle
} from 'lucide-react';
import { PieChart as RechartPie, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

interface ChannelData {
  channel: string;
  count: number;
  estimatedCost: number;
  percentOfTotal: number;
}

interface FeatureBreakdown {
  channel: string;
  source: string;
  feature: string;
  eventCount: number;
  totalQuantity: number;
  estimatedCost: number;
  aiInputTokens: number | null;
  aiOutputTokens: number | null;
}

const CHANNEL_COLORS: Record<string, string> = {
  sms: '#22c55e',
  mms: '#16a34a',
  voice: '#3b82f6',
  email: '#8b5cf6',
  ai: '#f97316',
};

const CHANNEL_ICONS: Record<string, typeof MessageSquare> = {
  sms: MessageSquare,
  mms: MessageSquare,
  voice: Phone,
  email: Mail,
  ai: Bot,
};

const CHANNEL_LABELS: Record<string, string> = {
  sms: 'SMS',
  mms: 'MMS',
  voice: 'Voice',
  email: 'Email',
  ai: 'AI',
};

function formatCurrency(value: number): string {
  if (value < 0.01 && value > 0) {
    return `$${value.toFixed(4)}`;
  }
  return `$${value.toFixed(2)}`;
}

function formatFeatureName(feature: string): string {
  return feature
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export default function UsageDashboardV2() {
  const [days, setDays] = useState('30');
  
  const { data: channelData, isLoading: channelsLoading } = useQuery<{ channels: ChannelData[] }>({
    queryKey: ['/api/admin/usage/v2/channels', { days }],
  });
  
  const { data: featureData, isLoading: featuresLoading } = useQuery<{ breakdown: FeatureBreakdown[] }>({
    queryKey: ['/api/admin/usage/v2/features', { days }],
  });

  const handleExportCSV = () => {
    window.location.href = `/api/admin/usage/v2/export?days=${days}&format=csv`;
  };

  const isLoading = channelsLoading || featuresLoading;

  const totalCost = channelData?.channels?.reduce((sum, c) => sum + c.estimatedCost, 0) || 0;
  const totalEvents = channelData?.channels?.reduce((sum, c) => sum + c.count, 0) || 0;

  const pieData = channelData?.channels?.map(c => ({
    name: CHANNEL_LABELS[c.channel] || c.channel,
    value: c.estimatedCost,
    fill: CHANNEL_COLORS[c.channel] || '#94a3b8',
  })) || [];

  const barData = featureData?.breakdown?.slice(0, 10).map(f => ({
    name: formatFeatureName(f.feature),
    cost: f.estimatedCost,
    count: f.eventCount,
    channel: f.channel,
  })) || [];

  if (isLoading) {
    return (
      <AppShell title="Usage Dashboard">
        <div className="p-6 max-w-6xl mx-auto space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Usage Dashboard">
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="text-usage-dashboard-title">
              Usage Dashboard
            </h2>
            <p className="text-muted-foreground mt-1">
              Detailed cost and usage breakdown by channel and feature
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="w-[140px]" data-testid="select-days-range">
                <SelectValue placeholder="Select days" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="60">Last 60 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            
            <Button variant="outline" onClick={handleExportCSV} data-testid="button-export-csv">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-200 dark:border-green-800">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Est. Cost</CardTitle>
                <DollarSign className="h-4 w-4 text-green-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-700 dark:text-green-400" data-testid="text-total-cost">
                {formatCurrency(totalCost)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Last {days} days
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Events</CardTitle>
                <TrendingUp className="h-4 w-4 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-700 dark:text-blue-400" data-testid="text-total-events">
                {totalEvents.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                SMS, MMS, Voice, Email, AI
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30 border-orange-200 dark:border-orange-800">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Avg Cost/Event</CardTitle>
                <BarChart3 className="h-4 w-4 text-orange-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-700 dark:text-orange-400" data-testid="text-avg-cost">
                {formatCurrency(totalEvents > 0 ? totalCost / totalEvents : 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Across all channels
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="channels" className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:w-auto md:inline-grid">
            <TabsTrigger value="channels" data-testid="tab-channels">
              <PieChart className="h-4 w-4 mr-2" />
              By Channel
            </TabsTrigger>
            <TabsTrigger value="features" data-testid="tab-features">
              <BarChart3 className="h-4 w-4 mr-2" />
              By Feature
            </TabsTrigger>
          </TabsList>

          <TabsContent value="channels" className="mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Cost Distribution</CardTitle>
                  <CardDescription>Cost breakdown by communication channel</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartPie>
                        <Pie
                          data={pieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label={({ name, value }) => `${name}: ${formatCurrency(value)}`}
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      </RechartPie>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Channel Breakdown</CardTitle>
                  <CardDescription>Detailed usage by channel</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {channelData?.channels?.map((channel) => {
                    const Icon = CHANNEL_ICONS[channel.channel] || MessageSquare;
                    const color = CHANNEL_COLORS[channel.channel] || '#94a3b8';
                    
                    return (
                      <div key={channel.channel} className="space-y-2" data-testid={`channel-row-${channel.channel}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div 
                              className="p-1.5 rounded-full" 
                              style={{ backgroundColor: `${color}20` }}
                            >
                              <Icon className="h-4 w-4" style={{ color }} />
                            </div>
                            <span className="font-medium">{CHANNEL_LABELS[channel.channel]}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-semibold">{formatCurrency(channel.estimatedCost)}</span>
                            <span className="text-xs text-muted-foreground ml-2">
                              ({channel.count.toLocaleString()} events)
                            </span>
                          </div>
                        </div>
                        <Progress 
                          value={channel.percentOfTotal} 
                          className="h-2"
                          style={{ 
                            ['--progress-background' as any]: color 
                          }}
                        />
                      </div>
                    );
                  })}
                  
                  {(!channelData?.channels || channelData.channels.length === 0) && (
                    <div className="flex items-center justify-center h-32 text-muted-foreground">
                      <AlertCircle className="h-5 w-5 mr-2" />
                      No usage data available
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="features" className="mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Top Features by Cost</CardTitle>
                  <CardDescription>Highest cost features in the selected period</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barData} layout="vertical">
                        <XAxis type="number" tickFormatter={(v) => `$${v.toFixed(2)}`} />
                        <YAxis type="category" dataKey="name" width={100} fontSize={12} />
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                        <Bar 
                          dataKey="cost" 
                          fill="#3b82f6" 
                          radius={[0, 4, 4, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Feature Details</CardTitle>
                  <CardDescription>Usage breakdown by feature</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {featureData?.breakdown?.map((feature, index) => (
                      <div 
                        key={`${feature.channel}-${feature.feature}-${index}`}
                        className="flex items-center justify-between p-2 bg-muted/50 rounded-lg"
                        data-testid={`feature-row-${feature.feature}`}
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" style={{ 
                            borderColor: CHANNEL_COLORS[feature.channel],
                            color: CHANNEL_COLORS[feature.channel],
                          }}>
                            {CHANNEL_LABELS[feature.channel]}
                          </Badge>
                          <span className="font-medium text-sm">
                            {formatFeatureName(feature.feature)}
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-sm">{formatCurrency(feature.estimatedCost)}</div>
                          <div className="text-xs text-muted-foreground">
                            {feature.eventCount.toLocaleString()} events
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {(!featureData?.breakdown || featureData.breakdown.length === 0) && (
                      <div className="flex items-center justify-center h-32 text-muted-foreground">
                        <AlertCircle className="h-5 w-5 mr-2" />
                        No feature data available
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
