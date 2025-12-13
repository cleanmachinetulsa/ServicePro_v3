import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRoute, useLocation } from 'wouter';
import { AppShell } from '@/components/AppShell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { 
  ArrowLeft, MessageSquare, CheckCircle, XCircle, AlertTriangle, 
  Clock, TrendingUp, Send, Ban, BarChart3, Calendar
} from 'lucide-react';
import { format, subDays, parseISO } from 'date-fns';

const COLORS = ['#22c55e', '#3b82f6', '#ef4444', '#f59e0b', '#8b5cf6', '#06b6d4'];

const STATUS_COLORS: Record<string, string> = {
  delivered: '#22c55e',
  sent: '#3b82f6',
  failed: '#ef4444',
  undelivered: '#f59e0b',
  pending: '#6b7280',
  queued: '#6b7280',
  skipped: '#9ca3af',
};

interface CampaignRunAnalytics {
  success: boolean;
  campaign: {
    id: number;
    name: string;
    tenantId: string;
    scheduledDate: string | null;
    sentAt: string | null;
    completedAt: string | null;
    status: string;
    message: string;
    fromNumber: string | null;
  };
  totals: {
    total_outbound: number;
    delivered: number;
    sent: number;
    failed: number;
    undelivered: number;
    pending: number;
    skipped_unsubscribed: number;
    skipped_invalid: number;
    skipped_other: number;
  };
  error_breakdown: Array<{ error_code: string; count: number; meaning: string }>;
  status_breakdown: Array<{ status: string; count: number }>;
  skip_reason_breakdown: Array<{ skip_reason: string; count: number }>;
}

interface SmsSummary {
  success: boolean;
  tenantId: string;
  from: string;
  to: string;
  daily_stats: Array<{
    date: string;
    total_outbound: number;
    delivered: number;
    failed: number;
    undelivered: number;
    sent: number;
  }>;
  totals: {
    total_outbound: number;
    delivered: number;
    failed: number;
    undelivered: number;
  };
  error_breakdown: Array<{ error_code: string; count: number; meaning: string }>;
  status_breakdown: Array<{ status: string; count: number }>;
}

interface Campaign {
  id: number;
  name: string;
  status: string;
  scheduledDate: string | null;
  sentAt: string | null;
  completedAt: string | null;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  deliveredCount: number;
  createdAt: string;
}

function CampaignRunDetailView({ campaignId }: { campaignId: number }) {
  const [, navigate] = useLocation();
  
  const { data, isLoading, error } = useQuery<CampaignRunAnalytics>({
    queryKey: ['/api/admin/analytics/sms/campaign-run', campaignId],
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  if (error || !data?.success) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <XCircle className="h-12 w-12 mx-auto text-red-500 mb-4" />
          <p className="text-muted-foreground">Failed to load campaign analytics</p>
          <Button variant="outline" onClick={() => navigate('/admin/sms-analytics')} className="mt-4">
            Back to Campaigns
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { campaign, totals, error_breakdown, status_breakdown, skip_reason_breakdown } = data;
  
  const deliveryRate = totals.total_outbound > 0 
    ? ((totals.delivered / totals.total_outbound) * 100).toFixed(1)
    : '0';

  const pieData = status_breakdown
    .filter(s => s.count > 0)
    .map(s => ({
      name: s.status.charAt(0).toUpperCase() + s.status.slice(1),
      value: s.count,
      fill: STATUS_COLORS[s.status] || '#6b7280',
    }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/sms-analytics')} data-testid="btn-back-campaigns">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Campaigns
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl" data-testid="text-campaign-name">{campaign.name}</CardTitle>
              <CardDescription>
                {campaign.sentAt 
                  ? `Sent on ${format(parseISO(campaign.sentAt), 'MMM d, yyyy h:mm a')}`
                  : campaign.scheduledDate 
                    ? `Scheduled for ${format(parseISO(campaign.scheduledDate), 'MMM d, yyyy h:mm a')}`
                    : 'Draft campaign'
                }
              </CardDescription>
            </div>
            <Badge variant={campaign.status === 'sent' ? 'default' : 'secondary'} data-testid="badge-campaign-status">
              {campaign.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="bg-muted/50 p-4 rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">Message Preview</p>
            <p className="text-sm" data-testid="text-message-preview">{campaign.message}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Send className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold" data-testid="stat-total-outbound">{totals.total_outbound}</p>
                <p className="text-sm text-muted-foreground">Total Sent</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold" data-testid="stat-delivered">{totals.delivered}</p>
                <p className="text-sm text-muted-foreground">Delivered ({deliveryRate}%)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-2xl font-bold" data-testid="stat-failed">{totals.failed}</p>
                <p className="text-sm text-muted-foreground">Failed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Ban className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-2xl font-bold" data-testid="stat-skipped">{totals.skipped_unsubscribed + totals.skipped_invalid + totals.skipped_other}</p>
                <p className="text-sm text-muted-foreground">Skipped</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">No data available</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Error Breakdown</CardTitle>
            <CardDescription>Twilio error codes encountered</CardDescription>
          </CardHeader>
          <CardContent>
            {error_breakdown.length > 0 ? (
              <div className="space-y-2">
                {error_breakdown.map((err) => (
                  <div key={err.error_code} className="flex items-center justify-between p-2 bg-muted/50 rounded" data-testid={`error-row-${err.error_code}`}>
                    <div>
                      <span className="font-mono text-sm font-medium">{err.error_code}</span>
                      <p className="text-sm text-muted-foreground">{err.meaning}</p>
                    </div>
                    <Badge variant="destructive">{err.count}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">No errors - great job!</p>
            )}
          </CardContent>
        </Card>
      </div>

      {skip_reason_breakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Skip Reasons</CardTitle>
            <CardDescription>Why some messages were not sent</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={skip_reason_breakdown}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="skip_reason" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CampaignListView() {
  const [, navigate] = useLocation();
  
  const { data: campaignsData, isLoading } = useQuery<{ success: boolean; campaigns: Campaign[] }>({
    queryKey: ['/api/admin/analytics/sms/campaigns'],
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );
  }

  const campaigns = campaignsData?.campaigns || [];

  return (
    <div className="space-y-4">
      {campaigns.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No SMS campaigns found</p>
          </CardContent>
        </Card>
      ) : (
        campaigns.map((campaign) => (
          <Card 
            key={campaign.id} 
            className="cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => navigate(`/admin/sms-analytics/campaign/${campaign.id}`)}
            data-testid={`campaign-card-${campaign.id}`}
          >
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">{campaign.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {campaign.sentAt 
                      ? `Sent ${format(parseISO(campaign.sentAt), 'MMM d, yyyy')}`
                      : campaign.scheduledDate 
                        ? `Scheduled ${format(parseISO(campaign.scheduledDate), 'MMM d, yyyy')}`
                        : `Created ${format(parseISO(campaign.createdAt), 'MMM d, yyyy')}`
                    }
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>{campaign.deliveredCount || 0}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Send className="h-4 w-4" />
                      <span>{campaign.sentCount || 0}</span>
                    </div>
                  </div>
                  <Badge variant={campaign.status === 'sent' ? 'default' : 'secondary'}>
                    {campaign.status}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

function OverviewTab() {
  const [timeRange, setTimeRange] = useState('30');
  
  const fromDate = subDays(new Date(), parseInt(timeRange)).toISOString();
  const toDate = new Date().toISOString();

  const { data, isLoading } = useQuery<SmsSummary>({
    queryKey: ['/api/admin/analytics/sms/summary', { from: fromDate, to: toDate }],
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  const summary = data;
  const deliveryRate = summary?.totals.total_outbound 
    ? ((summary.totals.delivered / summary.totals.total_outbound) * 100).toFixed(1)
    : '0';

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-40" data-testid="select-time-range">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Send className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold" data-testid="overview-total">{summary?.totals.total_outbound || 0}</p>
                <p className="text-sm text-muted-foreground">Total Sent</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold" data-testid="overview-delivered">{summary?.totals.delivered || 0}</p>
                <p className="text-sm text-muted-foreground">Delivered ({deliveryRate}%)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-2xl font-bold" data-testid="overview-failed">{summary?.totals.failed || 0}</p>
                <p className="text-sm text-muted-foreground">Failed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-2xl font-bold" data-testid="overview-undelivered">{summary?.totals.undelivered || 0}</p>
                <p className="text-sm text-muted-foreground">Undelivered</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {summary?.daily_stats && summary.daily_stats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              SMS Volume Over Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={summary.daily_stats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(value) => format(parseISO(value), 'MMM d')}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(value) => format(parseISO(value as string), 'MMM d, yyyy')}
                />
                <Legend />
                <Line type="monotone" dataKey="total_outbound" name="Total Sent" stroke="#3b82f6" strokeWidth={2} />
                <Line type="monotone" dataKey="delivered" name="Delivered" stroke="#22c55e" strokeWidth={2} />
                <Line type="monotone" dataKey="failed" name="Failed" stroke="#ef4444" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {summary?.error_breakdown && summary.error_breakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Error Breakdown</CardTitle>
            <CardDescription>Common error codes in the selected period</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={summary.error_breakdown.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="error_code" />
                <YAxis />
                <Tooltip 
                  formatter={(value, name, props) => [value, props.payload.meaning]}
                />
                <Bar dataKey="count" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function SmsCampaignAnalyticsPage() {
  const [matchCampaign, paramsCampaign] = useRoute('/admin/sms-analytics/campaign/:campaignId');
  const campaignId = paramsCampaign?.campaignId ? parseInt(paramsCampaign.campaignId, 10) : null;

  if (matchCampaign && campaignId) {
    return (
      <AppShell title="Campaign Analytics">
        <div className="container mx-auto py-6 px-4 max-w-6xl">
          <CampaignRunDetailView campaignId={campaignId} />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="SMS Campaign Analytics">
      <div className="container mx-auto py-6 px-4 max-w-6xl">
        <div className="flex items-center gap-3 mb-6">
          <BarChart3 className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold" data-testid="page-title">SMS Campaign Analytics</h1>
            <p className="text-muted-foreground">Monitor campaign performance and delivery metrics</p>
          </div>
        </div>

        <Tabs defaultValue="campaigns" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview" data-testid="tab-overview">
              <TrendingUp className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="campaigns" data-testid="tab-campaigns">
              <MessageSquare className="h-4 w-4 mr-2" />
              Campaigns
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <OverviewTab />
          </TabsContent>

          <TabsContent value="campaigns">
            <CampaignListView />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
