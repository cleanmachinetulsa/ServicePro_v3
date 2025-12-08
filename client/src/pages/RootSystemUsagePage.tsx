import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/AppShell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Building2, 
  DollarSign,
  MessageSquare,
  Phone,
  Mail,
  Bot,
  Calendar,
  Search,
  TrendingUp,
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';

interface TenantUsage {
  tenantId: string;
  tenantName: string;
  subdomain: string;
  planTier: string;
  smsTotal: number;
  mmsTotal: number;
  voiceTotal: number;
  emailTotal: number;
  aiTokensTotal: number;
  totalCostUsd: number;
  smsCostCents: number;
  mmsCostCents: number;
  voiceCostCents: number;
  emailCostCents: number;
  aiCostCents: number;
  totalCostCents: number;
}

interface SystemUsageSummaryResponse {
  success: boolean;
  data: {
    tenants: TenantUsage[];
    totals: {
      totalCostCents: number;
      totalCostUsd: number;
      smsCostCents: number;
      mmsCostCents: number;
      voiceCostCents: number;
      emailCostCents: number;
      aiCostCents: number;
    };
    period: {
      from: string;
      to: string;
      label: string;
    };
    tenantCount: number;
  };
}

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

function getTierBadgeColor(tier: string): string {
  const colors: Record<string, string> = {
    free: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    starter: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    pro: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
    elite: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
    internal: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  };
  return colors[tier] || 'bg-gray-100 text-gray-700';
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

export default function RootSystemUsagePage() {
  const [period, setPeriod] = useState<PeriodOption>('this_month');
  const [searchQuery, setSearchQuery] = useState('');
  
  const dateRange = getDateRange(period);
  
  const { data, isLoading, isError } = useQuery<SystemUsageSummaryResponse>({
    queryKey: ['/api/root/usage/summary', dateRange.from, dateRange.to],
    queryFn: async () => {
      const res = await fetch(`/api/root/usage/summary?from=${dateRange.from}&to=${dateRange.to}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch system usage summary');
      return res.json();
    },
  });

  const tenants = data?.data?.tenants || [];
  const totals = data?.data?.totals;
  const periodLabel = data?.data?.period?.label || 'Current Period';

  const filteredTenants = tenants.filter(t => 
    t.tenantName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.subdomain?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <AppShell title="System Usage">
        <div className="p-6 max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
          <Skeleton className="h-96" />
        </div>
      </AppShell>
    );
  }

  if (isError) {
    return (
      <AppShell title="System Usage">
        <div className="p-6 max-w-7xl mx-auto">
          <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30">
            <CardContent className="pt-6">
              <p className="text-red-700 dark:text-red-400">Failed to load system usage data. Please try again later.</p>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="System Usage">
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="text-system-usage-title">
              System Usage Overview
            </h2>
            <p className="text-muted-foreground mt-1">
              {periodLabel} - All tenant usage and costs
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

        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Total Cost</p>
                <DollarSign className="h-4 w-4 text-blue-600" />
              </div>
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-400" data-testid="text-total-system-cost">
                {formatCurrency(totals?.totalCostCents || 0)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">SMS</p>
                <MessageSquare className="h-4 w-4 text-green-600" />
              </div>
              <div className="text-xl font-bold">{formatCurrency(totals?.smsCostCents || 0)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">MMS</p>
                <MessageSquare className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="text-xl font-bold">{formatCurrency(totals?.mmsCostCents || 0)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Voice</p>
                <Phone className="h-4 w-4 text-blue-600" />
              </div>
              <div className="text-xl font-bold">{formatCurrency(totals?.voiceCostCents || 0)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Email</p>
                <Mail className="h-4 w-4 text-purple-600" />
              </div>
              <div className="text-xl font-bold">{formatCurrency(totals?.emailCostCents || 0)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">AI</p>
                <Bot className="h-4 w-4 text-orange-600" />
              </div>
              <div className="text-xl font-bold">{formatCurrency(totals?.aiCostCents || 0)}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Tenant Usage
                </CardTitle>
                <CardDescription>{filteredTenants.length} tenants</CardDescription>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tenants..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
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
                    <TableHead className="text-right">SMS</TableHead>
                    <TableHead className="text-right">MMS</TableHead>
                    <TableHead className="text-right">Voice</TableHead>
                    <TableHead className="text-right">Email</TableHead>
                    <TableHead className="text-right">AI</TableHead>
                    <TableHead className="text-right">Total Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTenants.map((tenant) => (
                    <TableRow key={tenant.tenantId} data-testid={`row-tenant-${tenant.tenantId}`}>
                      <TableCell>
                        <div className="font-medium">{tenant.tenantName || tenant.subdomain}</div>
                        <div className="text-sm text-muted-foreground">{tenant.subdomain}</div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getTierBadgeColor(tenant.planTier)}>
                          {tenant.planTier || 'free'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div>{formatCurrency(tenant.smsCostCents)}</div>
                        <div className="text-sm text-muted-foreground">{formatNumber(tenant.smsTotal)}</div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div>{formatCurrency(tenant.mmsCostCents)}</div>
                        <div className="text-sm text-muted-foreground">{formatNumber(tenant.mmsTotal)}</div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div>{formatCurrency(tenant.voiceCostCents)}</div>
                        <div className="text-sm text-muted-foreground">{formatNumber(tenant.voiceTotal)} min</div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div>{formatCurrency(tenant.emailCostCents)}</div>
                        <div className="text-sm text-muted-foreground">{formatNumber(tenant.emailTotal)}</div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div>{formatCurrency(tenant.aiCostCents)}</div>
                        <div className="text-sm text-muted-foreground">{formatNumber(tenant.aiTokensTotal)}</div>
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {formatCurrency(tenant.totalCostCents)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredTenants.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        {searchQuery ? 'No tenants match your search' : 'No usage data for this period'}
                      </TableCell>
                    </TableRow>
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
