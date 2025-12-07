import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AppShell } from '@/components/AppShell';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { 
  Users, 
  DollarSign, 
  RefreshCw,
  MessageSquare,
  Phone,
  Mail,
  Bot,
  TrendingUp,
  Building2,
  Search,
  Download
} from 'lucide-react';
import { 
  BarChart, 
  Bar,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface TenantUsage {
  tenant_id: string;
  tenant_name: string;
  business_name: string | null;
  plan_tier: string | null;
  sms_total: number;
  mms_total: number;
  voice_total: number;
  email_total: number;
  ai_tokens_total: number;
  estimated_monthly_cost: string;
}

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

const planColors: Record<string, string> = {
  free: 'bg-gray-100 text-gray-800',
  starter: 'bg-blue-100 text-blue-800',
  pro: 'bg-purple-100 text-purple-800',
  elite: 'bg-yellow-100 text-yellow-800',
  internal: 'bg-green-100 text-green-800',
};

export default function SystemUsageAdmin() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('cost');

  const { data, isLoading, refetch } = useQuery<{
    success: boolean;
    tenants: TenantUsage[];
  }>({
    queryKey: ['/api/root-admin/usage/tenants'],
    refetchInterval: 120000,
  });

  const handleExportCSV = () => {
    window.location.href = '/api/root-admin/usage/export?format=csv';
  };

  const rollupMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/root-admin/usage/rollup', {});
    },
    onSuccess: () => {
      toast({ title: 'Rollup complete', description: 'Usage data has been aggregated' });
      queryClient.invalidateQueries({ queryKey: ['/api/root-admin/usage/tenants'] });
    },
    onError: (error: any) => {
      toast({ title: 'Rollup failed', description: error.message, variant: 'destructive' });
    },
  });

  const allTenants = data?.tenants || [];

  const filteredTenants = allTenants.filter(t => {
    const matchesSearch = searchTerm === '' || 
      (t.business_name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (t.tenant_name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      t.tenant_id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPlan = planFilter === 'all' || (t.plan_tier || 'free') === planFilter;
    return matchesSearch && matchesPlan;
  });

  const sortedTenants = [...filteredTenants].sort((a, b) => {
    switch (sortBy) {
      case 'cost':
        return parseFloat(b.estimated_monthly_cost) - parseFloat(a.estimated_monthly_cost);
      case 'sms':
        return Number(b.sms_total) - Number(a.sms_total);
      case 'voice':
        return Number(b.voice_total) - Number(a.voice_total);
      case 'ai':
        return Number(b.ai_tokens_total) - Number(a.ai_tokens_total);
      case 'name':
        return (a.business_name || a.tenant_name || '').localeCompare(b.business_name || b.tenant_name || '');
      default:
        return 0;
    }
  });

  const tenants = sortedTenants;

  const totalCost = allTenants.reduce((sum, t) => sum + parseFloat(t.estimated_monthly_cost || '0'), 0);
  const totalSms = allTenants.reduce((sum, t) => sum + Number(t.sms_total || 0), 0);
  const totalVoice = allTenants.reduce((sum, t) => sum + Number(t.voice_total || 0), 0);
  const totalAiTokens = allTenants.reduce((sum, t) => sum + Number(t.ai_tokens_total || 0), 0);

  const topTenants = allTenants
    .slice()
    .sort((a, b) => parseFloat(b.estimated_monthly_cost) - parseFloat(a.estimated_monthly_cost))
    .slice(0, 8);

  const chartData = topTenants.map((t) => ({
    name: t.business_name || t.tenant_name || t.tenant_id.slice(0, 8),
    cost: parseFloat(t.estimated_monthly_cost) || 0,
    sms: Number(t.sms_total) || 0,
    voice: Number(t.voice_total) || 0,
  }));

  const planDistribution = allTenants.reduce((acc, t) => {
    const plan = t.plan_tier || 'free';
    acc[plan] = (acc[plan] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const pieData = Object.entries(planDistribution).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
  }));

  const pageActions = (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        onClick={handleExportCSV}
        size="sm"
        data-testid="button-export-csv"
      >
        <Download className="w-4 h-4 mr-2" />
        Export CSV
      </Button>
      <Button
        onClick={() => rollupMutation.mutate()}
        disabled={rollupMutation.isPending}
        data-testid="button-run-rollup"
        size="sm"
      >
        <RefreshCw className={`w-4 h-4 mr-2 ${rollupMutation.isPending ? 'animate-spin' : ''}`} />
        Run Rollup
      </Button>
    </div>
  );

  if (isLoading) {
    return (
      <AppShell title="System Usage (Admin)" pageActions={pageActions}>
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
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
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="System Usage (Admin)" pageActions={pageActions}>
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card data-testid="card-total-tenants">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Tenants</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{tenants.length}</div>
              <p className="text-xs text-muted-foreground">with usage this month</p>
            </CardContent>
          </Card>

          <Card data-testid="card-total-revenue">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Est. Monthly Cost</CardTitle>
              <DollarSign className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalCost.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">all tenants combined</p>
            </CardContent>
          </Card>

          <Card data-testid="card-total-sms">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total SMS</CardTitle>
              <MessageSquare className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalSms.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">messages this month</p>
            </CardContent>
          </Card>

          <Card data-testid="card-total-ai">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">AI Tokens</CardTitle>
              <Bot className="h-4 w-4 text-cyan-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {totalAiTokens >= 1000000
                  ? `${(totalAiTokens / 1000000).toFixed(1)}M`
                  : totalAiTokens >= 1000
                  ? `${(totalAiTokens / 1000).toFixed(1)}K`
                  : totalAiTokens.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">tokens used</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Top Tenants by Cost
              </CardTitle>
              <CardDescription>Highest usage tenants this month</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(v) => `$${v}`} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value: number) => `$${value.toFixed(4)}`} />
                  <Bar dataKey="cost" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Plan Distribution
              </CardTitle>
              <CardDescription>Tenants by plan tier</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <CardTitle>All Tenant Usage</CardTitle>
                <CardDescription>Month-to-date usage breakdown by tenant ({tenants.length} of {allTenants.length})</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search tenants..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 w-48"
                    data-testid="input-search-tenants"
                  />
                </div>
                <Select value={planFilter} onValueChange={setPlanFilter}>
                  <SelectTrigger className="w-32" data-testid="select-plan-filter">
                    <SelectValue placeholder="All Plans" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Plans</SelectItem>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="starter">Starter</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="elite">Elite</SelectItem>
                    <SelectItem value="internal">Internal</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-32" data-testid="select-sort-by">
                    <SelectValue placeholder="Sort By" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cost">Cost (High)</SelectItem>
                    <SelectItem value="sms">SMS (High)</SelectItem>
                    <SelectItem value="voice">Voice (High)</SelectItem>
                    <SelectItem value="ai">AI Tokens (High)</SelectItem>
                    <SelectItem value="name">Name (A-Z)</SelectItem>
                  </SelectContent>
                </Select>
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
                    <TableHead className="text-right">AI Tokens</TableHead>
                    <TableHead className="text-right">Est. Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenants.map((t, idx) => (
                    <TableRow key={t.tenant_id} data-testid={`row-tenant-${idx}`}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{t.business_name || t.tenant_name}</div>
                          <div className="text-xs text-muted-foreground">{t.tenant_id.slice(0, 12)}...</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={planColors[t.plan_tier || 'free'] || planColors.free}>
                          {t.plan_tier || 'free'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{Number(t.sms_total || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right">{Number(t.mms_total || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right">{Number(t.voice_total || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right">{Number(t.email_total || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right">{Number(t.ai_tokens_total || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right font-semibold">
                        ${parseFloat(t.estimated_monthly_cost || '0').toFixed(4)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {tenants.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        No tenant usage data available. Run the daily rollup to generate data.
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
