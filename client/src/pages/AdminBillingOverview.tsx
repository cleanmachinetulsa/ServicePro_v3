import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/AppShell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  DollarSign, 
  MessageSquare, 
  Phone, 
  Mail, 
  Bot,
  Building2,
  TrendingUp,
  AlertTriangle,
  Search,
  Activity,
  Calendar,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface TenantUsageInfo {
  tenantId: string;
  name: string;
  planTier: string;
  status: string;
  usage: {
    smsCount: number;
    voiceMinutes: number;
    emailCount: number;
    aiRequests: number;
  };
  limits: {
    maxSmsPerMonth: number;
    maxVoiceMinutesPerMonth: number;
    maxEmailsPerMonth: number;
    maxAiRequestsPerMonth: number;
  };
  estimatedCost: number;
}

interface AggregateStats {
  totalTenants: number;
  activeTenants: number;
  totalSms: number;
  totalVoiceMinutes: number;
  totalEmails: number;
  totalAiRequests: number;
  totalEstimatedCost: number;
  tenantsByPlan: Record<string, number>;
}

interface UsageOverviewResponse {
  success: boolean;
  period: {
    label: string;
    startDate: string;
    endDate: string;
  };
  aggregates: AggregateStats;
  tenants: TenantUsageInfo[];
}

const PLAN_COLORS: Record<string, string> = {
  free: 'bg-gray-500',
  starter: 'bg-blue-500',
  pro: 'bg-purple-500',
  elite: 'bg-amber-500',
  internal: 'bg-green-500',
};

const PLAN_NAMES: Record<string, string> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
  elite: 'Elite',
  internal: 'Internal',
};

function formatLimit(limit: number): string {
  if (limit >= 999999) return '∞';
  if (limit >= 1000) return `${(limit / 1000).toFixed(0)}k`;
  return limit.toString();
}

function getUsagePercentage(current: number, limit: number): number {
  if (limit <= 0 || limit >= 999999) return 0;
  return Math.min(100, Math.round((current / limit) * 100));
}

function UsageCell({ current, limit }: { current: number; limit: number }) {
  const percentage = getUsagePercentage(current, limit);
  const isUnlimited = limit >= 999999;
  
  return (
    <div className="space-y-1">
      <div className="flex items-baseline gap-1">
        <span className="font-medium">{current.toLocaleString()}</span>
        <span className="text-xs text-muted-foreground">
          / {isUnlimited ? '∞' : formatLimit(limit)}
        </span>
      </div>
      {!isUnlimited && (
        <Progress 
          value={percentage} 
          className="h-1.5"
        />
      )}
    </div>
  );
}

export default function AdminBillingOverview() {
  const [searchQuery, setSearchQuery] = useState('');

  const { data, isLoading, error } = useQuery<UsageOverviewResponse>({
    queryKey: ['/api/root-admin/usage/overview'],
  });

  const filteredTenants = useMemo(() => {
    if (!data?.tenants) return [];
    if (!searchQuery.trim()) return data.tenants;

    const query = searchQuery.toLowerCase();
    return data.tenants.filter(t => 
      t.name.toLowerCase().includes(query) || 
      t.planTier.toLowerCase().includes(query)
    );
  }, [data?.tenants, searchQuery]);

  const chartData = useMemo(() => {
    if (!data?.aggregates?.tenantsByPlan) return [];
    return Object.entries(data.aggregates.tenantsByPlan).map(([plan, count]) => ({
      plan: PLAN_NAMES[plan] || plan,
      count,
    }));
  }, [data?.aggregates?.tenantsByPlan]);

  if (isLoading) {
    return (
      <AppShell title="Usage Overview" showSearch={false}>
        <div className="p-6 max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-12 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
          <Skeleton className="h-96" />
        </div>
      </AppShell>
    );
  }

  if (error || !data?.success) {
    return (
      <AppShell title="Usage Overview" showSearch={false}>
        <div className="p-6 max-w-7xl mx-auto">
          <Card className="border-red-200 bg-red-50 dark:bg-red-900/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-6 w-6 text-red-600" />
                <p className="text-red-800 dark:text-red-200">
                  Failed to load usage data. Please try again later.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  const { aggregates, period } = data;

  return (
    <AppShell title="Usage Overview" showSearch={false}>
      <div className="p-6 max-w-7xl mx-auto space-y-6" data-testid="admin-usage-overview-page">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="text-page-title">
              Platform Usage Overview
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Aggregate usage metrics across all tenants
            </p>
          </div>
          {period && (
            <Badge variant="outline" className="flex items-center gap-2 px-3 py-1.5" data-testid="badge-period">
              <Calendar className="h-4 w-4" />
              {period.label}
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card data-testid="stat-total-sms">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Total SMS</p>
                  <p className="text-2xl font-bold text-green-600">{aggregates.totalSms.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
                  <MessageSquare className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="stat-total-voice">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Voice Minutes</p>
                  <p className="text-2xl font-bold text-blue-600">{aggregates.totalVoiceMinutes.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                  <Phone className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="stat-total-email">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Emails Sent</p>
                  <p className="text-2xl font-bold text-purple-600">{aggregates.totalEmails.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-full">
                  <Mail className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="stat-total-ai">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">AI Requests</p>
                  <p className="text-2xl font-bold text-orange-600">{aggregates.totalAiRequests.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-full">
                  <Bot className="h-6 w-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2" data-testid="card-summary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Platform Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <p className="text-sm text-muted-foreground">Total Tenants</p>
                  <p className="text-xl font-semibold">{aggregates.totalTenants}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active Tenants</p>
                  <p className="text-xl font-semibold text-green-600">{aggregates.activeTenants}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Est. Total Cost</p>
                  <p className="text-xl font-semibold text-blue-600">
                    ${aggregates.totalEstimatedCost.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Period</p>
                  <p className="text-sm font-medium">{period?.startDate} - {period?.endDate}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-plan-distribution">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Tenants by Plan
              </CardTitle>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical" margin={{ left: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="plan" type="category" tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#6366f1" radius={4} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No plan distribution data</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card data-testid="card-tenant-usage-table">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Tenant Usage Details
                </CardTitle>
                <CardDescription>
                  Individual usage vs plan limits for each tenant
                </CardDescription>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search tenants..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-tenants"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>SMS</TableHead>
                    <TableHead>Voice (min)</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>AI</TableHead>
                    <TableHead>Est. Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTenants.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                        No tenants found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTenants.map((tenant) => (
                      <TableRow key={tenant.tenantId} data-testid={`row-tenant-${tenant.tenantId}`}>
                        <TableCell>
                          <div className="font-medium">{tenant.name}</div>
                          <div className="text-xs text-gray-400">{tenant.tenantId}</div>
                        </TableCell>
                        <TableCell>
                          <Badge className={PLAN_COLORS[tenant.planTier] || 'bg-gray-500'}>
                            {PLAN_NAMES[tenant.planTier] || tenant.planTier}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <UsageCell 
                            current={tenant.usage.smsCount} 
                            limit={tenant.limits.maxSmsPerMonth} 
                          />
                        </TableCell>
                        <TableCell>
                          <UsageCell 
                            current={tenant.usage.voiceMinutes} 
                            limit={tenant.limits.maxVoiceMinutesPerMonth} 
                          />
                        </TableCell>
                        <TableCell>
                          <UsageCell 
                            current={tenant.usage.emailCount} 
                            limit={tenant.limits.maxEmailsPerMonth} 
                          />
                        </TableCell>
                        <TableCell>
                          <UsageCell 
                            current={tenant.usage.aiRequests} 
                            limit={tenant.limits.maxAiRequestsPerMonth} 
                          />
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">
                            ${tenant.estimatedCost.toFixed(2)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
