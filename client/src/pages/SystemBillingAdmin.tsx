import { useQuery, useMutation } from '@tanstack/react-query';
import { AppShell } from '@/components/AppShell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
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
  AlertTriangle, 
  CheckCircle2, 
  Building2,
  Clock,
  Users,
  TrendingUp,
  Search,
} from 'lucide-react';
import { useState, useMemo } from 'react';

interface TenantBillingInfo {
  tenantId: string;
  name: string;
  planTier: string;
  status: string;
  stripeCustomerId: string | null;
  overdueDays: number;
  lastInvoiceStatus: string | null;
  lastInvoiceAmount: number | null;
}

interface BillingResponse {
  success: boolean;
  tenants: TenantBillingInfo[];
}

const PLAN_DISPLAY_NAMES: Record<string, string> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Professional',
  elite: 'Elite',
  internal: 'Internal',
};

export default function SystemBillingAdmin() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');

  const { data, isLoading, error } = useQuery<BillingResponse>({
    queryKey: ['/api/root-admin/billing/tenants'],
  });

  const filteredTenants = useMemo(() => {
    if (!data?.tenants) return [];
    if (!searchQuery.trim()) return data.tenants;

    const query = searchQuery.toLowerCase();
    return data.tenants.filter(t => 
      t.name.toLowerCase().includes(query) || 
      t.planTier.toLowerCase().includes(query) ||
      t.status.toLowerCase().includes(query)
    );
  }, [data?.tenants, searchQuery]);

  const formatCurrency = (amountCents: number | null) => {
    if (amountCents === null) return '-';
    return `$${(amountCents / 100).toFixed(2)}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500" data-testid="badge-active">Active</Badge>;
      case 'trial':
        return <Badge variant="secondary" data-testid="badge-trial">Trial</Badge>;
      case 'past_due':
        return <Badge className="bg-amber-500" data-testid="badge-past-due">Past Due</Badge>;
      case 'suspended':
        return <Badge variant="destructive" data-testid="badge-suspended">Suspended</Badge>;
      case 'cancelled':
        return <Badge variant="outline" data-testid="badge-cancelled">Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getPlanBadge = (tier: string) => {
    const colorMap: Record<string, string> = {
      free: 'bg-gray-500',
      starter: 'bg-blue-500',
      pro: 'bg-purple-500',
      elite: 'bg-amber-500',
      internal: 'bg-green-500',
    };
    return (
      <Badge className={colorMap[tier] || 'bg-gray-500'}>
        {PLAN_DISPLAY_NAMES[tier] || tier}
      </Badge>
    );
  };

  const stats = useMemo(() => {
    if (!data?.tenants) return { total: 0, active: 0, overdue: 0, suspended: 0 };
    return {
      total: data.tenants.length,
      active: data.tenants.filter(t => t.status === 'active').length,
      overdue: data.tenants.filter(t => t.overdueDays > 0).length,
      suspended: data.tenants.filter(t => t.status === 'suspended').length,
    };
  }, [data?.tenants]);

  if (isLoading) {
    return (
      <AppShell title="System Billing" showSearch={false}>
        <div className="p-6 max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-12 w-64" />
          <div className="grid grid-cols-4 gap-4">
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

  if (error || !data?.success) {
    return (
      <AppShell title="System Billing" showSearch={false}>
        <div className="p-6 max-w-7xl mx-auto">
          <Card className="border-red-200 bg-red-50 dark:bg-red-900/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-6 w-6 text-red-600" />
                <p className="text-red-800 dark:text-red-200">
                  Failed to load billing data. Please try again later.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="System Billing" showSearch={false}>
      <div className="p-6 max-w-7xl mx-auto space-y-6" data-testid="system-billing-page">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">System Billing Overview</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Monitor billing status across all tenants
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card data-testid="stat-total-tenants">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Total Tenants</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <Building2 className="h-8 w-8 text-blue-500 opacity-75" />
              </div>
            </CardContent>
          </Card>

          <Card data-testid="stat-active-tenants">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Active</p>
                  <p className="text-2xl font-bold text-green-600">{stats.active}</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-green-500 opacity-75" />
              </div>
            </CardContent>
          </Card>

          <Card data-testid="stat-overdue-tenants">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Overdue</p>
                  <p className="text-2xl font-bold text-amber-600">{stats.overdue}</p>
                </div>
                <Clock className="h-8 w-8 text-amber-500 opacity-75" />
              </div>
            </CardContent>
          </Card>

          <Card data-testid="stat-suspended-tenants">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Suspended</p>
                  <p className="text-2xl font-bold text-red-600">{stats.suspended}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-500 opacity-75" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle>All Tenants</CardTitle>
                <CardDescription>
                  Billing status and invoice history for all tenants
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
                    <TableHead>Status</TableHead>
                    <TableHead>Overdue Days</TableHead>
                    <TableHead>Last Invoice</TableHead>
                    <TableHead>Stripe</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTenants.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                        No tenants found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTenants.map((tenant) => (
                      <TableRow key={tenant.tenantId} data-testid={`row-tenant-${tenant.tenantId}`}>
                        <TableCell>
                          <div className="font-medium" data-testid={`text-tenant-name-${tenant.tenantId}`}>
                            {tenant.name}
                          </div>
                          <div className="text-xs text-gray-400">{tenant.tenantId}</div>
                        </TableCell>
                        <TableCell>{getPlanBadge(tenant.planTier)}</TableCell>
                        <TableCell>{getStatusBadge(tenant.status)}</TableCell>
                        <TableCell>
                          {tenant.overdueDays > 0 ? (
                            <span className="text-amber-600 font-medium">
                              {tenant.overdueDays} days
                            </span>
                          ) : (
                            <span className="text-green-600">Current</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div>{formatCurrency(tenant.lastInvoiceAmount)}</div>
                            {tenant.lastInvoiceStatus && (
                              <div className="text-xs text-gray-400">
                                {tenant.lastInvoiceStatus}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {tenant.stripeCustomerId ? (
                            <Badge variant="outline" className="bg-green-50 dark:bg-green-900/20">
                              Connected
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-gray-50 dark:bg-gray-900/20">
                              Not Set
                            </Badge>
                          )}
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
