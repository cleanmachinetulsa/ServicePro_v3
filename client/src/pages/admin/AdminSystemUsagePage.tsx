/**
 * SP-18: Admin System Usage Page
 * 
 * Root admin view of all tenants' usage with filtering by status and tier.
 */

import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/AppShell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshCw, AlertTriangle, CheckCircle, XCircle, Building2, TrendingUp } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

interface TenantUsageRow {
  tenantId: string;
  tenantName: string;
  planTier: string;
  smsUsed: number;
  mmsUsed: number;
  voiceUsed: number;
  emailUsed: number;
  aiUsed: number;
  overallStatus: 'ok' | 'warning' | 'over_cap';
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'ok': return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">OK</Badge>;
    case 'warning': return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Warning</Badge>;
    case 'over_cap': return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Over Cap</Badge>;
    default: return <Badge variant="outline">Unknown</Badge>;
  }
}

function getTierBadge(tier: string) {
  const colors: Record<string, string> = {
    free: 'bg-gray-100 text-gray-700',
    starter: 'bg-blue-100 text-blue-700',
    pro: 'bg-purple-100 text-purple-700',
    elite: 'bg-amber-100 text-amber-700',
    internal: 'bg-slate-100 text-slate-700',
  };
  return <Badge variant="outline" className={colors[tier] || 'bg-gray-100'}>{tier}</Badge>;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

export default function AdminSystemUsagePage() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [isRebuilding, setIsRebuilding] = useState(false);

  const queryParams = new URLSearchParams();
  if (statusFilter !== 'all') queryParams.append('status', statusFilter);
  if (tierFilter !== 'all') queryParams.append('tier', tierFilter);
  
  const queryString = queryParams.toString();
  const apiPath = queryString 
    ? `/api/admin/usage/v2/system-summary?${queryString}` 
    : '/api/admin/usage/v2/system-summary';

  const { data, isLoading, refetch } = useQuery<{ success: boolean; data: TenantUsageRow[]; count: number }>({
    queryKey: ['/api/admin/usage/v2/system-summary', statusFilter, tierFilter],
    queryFn: async () => {
      const res = await fetch(apiPath, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch usage data');
      return res.json();
    },
  });

  const handleRebuild = async () => {
    setIsRebuilding(true);
    try {
      await apiRequest('POST', '/api/admin/usage/v2/rebuild');
      await refetch();
      toast({
        title: 'Usage Rebuilt',
        description: 'All tenant usage has been recalculated.',
      });
    } catch (error) {
      toast({
        title: 'Rebuild Failed',
        description: 'Could not rebuild usage data. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsRebuilding(false);
    }
  };

  const tenants = data?.data || [];

  const statusCounts = {
    ok: tenants.filter(t => t.overallStatus === 'ok').length,
    warning: tenants.filter(t => t.overallStatus === 'warning').length,
    over_cap: tenants.filter(t => t.overallStatus === 'over_cap').length,
  };

  return (
    <AppShell title="System Usage">
      <div className="space-y-6 p-6" data-testid="admin-system-usage-page">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold">System Usage Overview</h1>
            <p className="text-muted-foreground">
              Monitor usage across all tenants
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => refetch()}
              data-testid="button-refresh-system-usage"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button 
              variant="default" 
              size="sm" 
              onClick={handleRebuild}
              disabled={isRebuilding}
              data-testid="button-rebuild-usage"
            >
              <TrendingUp className={`w-4 h-4 mr-2 ${isRebuilding ? 'animate-pulse' : ''}`} />
              {isRebuilding ? 'Rebuilding...' : 'Rebuild All'}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Tenants</p>
                  <p className="text-2xl font-bold">{tenants.length}</p>
                </div>
                <Building2 className="w-8 h-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">OK Status</p>
                  <p className="text-2xl font-bold text-green-600">{statusCounts.ok}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Warning</p>
                  <p className="text-2xl font-bold text-yellow-600">{statusCounts.warning}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Over Cap</p>
                  <p className="text-2xl font-bold text-red-600">{statusCounts.over_cap}</p>
                </div>
                <XCircle className="w-8 h-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <CardTitle>Tenant Usage</CardTitle>
                <CardDescription>Current month usage by tenant</CardDescription>
              </div>
              <div className="flex gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px]" data-testid="select-status-filter">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="ok">OK</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="over_cap">Over Cap</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={tierFilter} onValueChange={setTierFilter}>
                  <SelectTrigger className="w-[120px]" data-testid="select-tier-filter">
                    <SelectValue placeholder="Tier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tiers</SelectItem>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="starter">Starter</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="elite">Elite</SelectItem>
                    <SelectItem value="internal">Internal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : tenants.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No tenants found matching the selected filters.
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
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
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tenants.map((tenant) => (
                      <TableRow key={tenant.tenantId} data-testid={`tenant-row-${tenant.tenantId}`}>
                        <TableCell className="font-medium max-w-[200px] truncate">
                          {tenant.tenantName}
                        </TableCell>
                        <TableCell>{getTierBadge(tenant.planTier || 'free')}</TableCell>
                        <TableCell className="text-right font-mono">{formatNumber(tenant.smsUsed)}</TableCell>
                        <TableCell className="text-right font-mono">{formatNumber(tenant.mmsUsed)}</TableCell>
                        <TableCell className="text-right font-mono">{formatNumber(tenant.voiceUsed)}</TableCell>
                        <TableCell className="text-right font-mono">{formatNumber(tenant.emailUsed)}</TableCell>
                        <TableCell className="text-right font-mono">{formatNumber(tenant.aiUsed)}</TableCell>
                        <TableCell>{getStatusBadge(tenant.overallStatus)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
