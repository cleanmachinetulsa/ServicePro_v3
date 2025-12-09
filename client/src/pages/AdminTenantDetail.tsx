import { useQuery } from '@tanstack/react-query';
import { useParams, useLocation, Link } from 'wouter';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft,
  Building2,
  Shield,
  Globe,
  Phone,
  Mail,
  Calendar,
  Palette,
  UserCircle,
  ExternalLink,
  Settings,
} from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { TenantReadinessCard } from '@/components/admin/TenantReadinessCard';
import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface TenantDetail {
  id: string;
  name: string;
  subdomain: string | null;
  planTier: string;
  status: string;
  createdAt: string;
  isRoot: boolean;
  businessName?: string;
  logoUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  industry?: string;
  phoneNumber?: string;
  email?: string;
}

function getTierBadge(tier: string) {
  const colors: Record<string, string> = {
    starter: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
    pro: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    elite: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
    internal: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
    free: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  };
  return colors[tier] || colors.starter;
}

function getStatusBadge(status: string) {
  const colors: Record<string, string> = {
    trialing: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300',
    active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    past_due: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
    suspended: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  };
  return colors[status] || colors.trialing;
}

function getTierLabel(tier: string) {
  const labels: Record<string, string> = {
    starter: 'Starter',
    pro: 'Pro',
    elite: 'Elite',
    internal: 'INTERNAL (at-cost)',
    free: 'Free',
  };
  return labels[tier] || tier;
}

function getStatusLabel(status: string) {
  const labels: Record<string, string> = {
    trialing: 'Trialing',
    active: 'Active',
    past_due: 'Past Due',
    suspended: 'Suspended',
    cancelled: 'Cancelled',
  };
  return labels[status] || status;
}

export default function AdminTenantDetail() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: tenantData, isLoading } = useQuery<{ success: boolean; tenant: TenantDetail }>({
    queryKey: ['/api/admin/tenants', tenantId],
    queryFn: async () => {
      const response = await fetch(`/api/admin/tenants/${tenantId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch tenant details');
      }
      return response.json();
    },
    enabled: !!tenantId,
  });

  const impersonateMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('POST', '/api/admin/impersonate/start', { tenantId: id });
    },
    onSuccess: (data: any) => {
      toast({
        title: 'Impersonation Active',
        description: `You are now viewing the app as ${data.tenantName}`,
      });
      navigate('/');
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to start impersonation',
        variant: 'destructive',
      });
    },
  });

  const tenant = tenantData?.tenant;

  if (isLoading) {
    return (
      <AppShell title="Tenant Details">
        <div className="p-6 space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10" />
            <Skeleton className="h-8 w-64" />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </AppShell>
    );
  }

  if (!tenant) {
    return (
      <AppShell title="Tenant Not Found">
        <div className="p-6">
          <Card className="p-12 text-center">
            <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Tenant Not Found
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              The tenant you're looking for doesn't exist or you don't have permission to view it.
            </p>
            <Link href="/admin/tenants">
              <Button data-testid="button-back-to-tenants">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Tenants
              </Button>
            </Link>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title={`Tenant: ${tenant.businessName || tenant.name}`}>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin/tenants">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                {tenant.isRoot ? (
                  <Shield className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                ) : (
                  <Building2 className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {tenant.businessName || tenant.name}
                  </h1>
                  {tenant.isRoot && (
                    <Badge variant="outline" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300 border-0">
                      ROOT
                    </Badge>
                  )}
                </div>
                <p className="text-gray-600 dark:text-gray-400">
                  Tenant ID: <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-xs">{tenant.id}</code>
                </p>
              </div>
            </div>
          </div>

          {!tenant.isRoot && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => impersonateMutation.mutate(tenant.id)}
                disabled={impersonateMutation.isPending}
                data-testid="button-impersonate"
              >
                <UserCircle className="w-4 h-4 mr-2" />
                Login as Tenant
              </Button>
            </div>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-6" data-testid="card-tenant-info">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Tenant Information
            </h2>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-500 dark:text-gray-400">Plan Tier</label>
                  <div className="mt-1">
                    <Badge className={getTierBadge(tenant.planTier || 'starter')}>
                      {getTierLabel(tenant.planTier || 'starter')}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-sm text-gray-500 dark:text-gray-400">Status</label>
                  <div className="mt-1">
                    <Badge className={getStatusBadge(tenant.status || 'trialing')}>
                      {getStatusLabel(tenant.status || 'trialing')}
                    </Badge>
                  </div>
                </div>
              </div>

              {tenant.subdomain && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <Globe className="w-5 h-5 text-gray-400" />
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 dark:text-gray-400">Public Website</label>
                    <a
                      href={`https://${tenant.subdomain}.serviceproapp.com`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline text-sm"
                    >
                      {tenant.subdomain}.serviceproapp.com
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              )}

              {tenant.industry && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <Building2 className="w-5 h-5 text-gray-400" />
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400">Industry</label>
                    <p className="text-sm text-gray-900 dark:text-gray-100 capitalize">
                      {tenant.industry.replace(/_/g, ' ')}
                    </p>
                  </div>
                </div>
              )}

              {tenant.phoneNumber && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <Phone className="w-5 h-5 text-gray-400" />
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400">Phone</label>
                    <p className="text-sm text-gray-900 dark:text-gray-100">{tenant.phoneNumber}</p>
                  </div>
                </div>
              )}

              {tenant.email && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <Mail className="w-5 h-5 text-gray-400" />
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400">Email</label>
                    <p className="text-sm text-gray-900 dark:text-gray-100">{tenant.email}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <Calendar className="w-5 h-5 text-gray-400" />
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400">Created</label>
                  <p className="text-sm text-gray-900 dark:text-gray-100">
                    {new Date(tenant.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              </div>

              {(tenant.primaryColor || tenant.logoUrl) && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <Palette className="w-5 h-5 text-gray-400" />
                  <div className="flex items-center gap-3">
                    {tenant.primaryColor && (
                      <div className="flex items-center gap-2">
                        <div
                          className="w-6 h-6 rounded border border-gray-300 dark:border-gray-600"
                          style={{ backgroundColor: tenant.primaryColor }}
                        />
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {tenant.primaryColor}
                        </span>
                      </div>
                    )}
                    {tenant.logoUrl && (
                      <img
                        src={tenant.logoUrl}
                        alt="Tenant Logo"
                        className="h-8 w-auto rounded"
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          </Card>

          <TenantReadinessCard
            tenantId={tenant.id}
            tenantSlug={tenant.subdomain || undefined}
            tenantName={tenant.businessName || tenant.name}
          />
        </div>
      </div>
    </AppShell>
  );
}
