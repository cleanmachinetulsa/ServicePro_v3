import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Database, Users, MessageSquare, Calendar, Gift, Mail, Trophy, TrendingUp } from 'lucide-react';

interface TenantSnapshot {
  success: boolean;
  tenantContext?: {
    tenantId: string;
    tenantSlug: string;
    isRootTenant: boolean;
  };
  coreCounts?: {
    customers: number;
    conversations: number;
    messages: number;
    appointments: number;
  };
  engagementCounts?: {
    loyalty_points: number;
    reward_services: number;
    redeemed_rewards: number;
    sms_campaigns: number;
    email_campaigns: number;
    sms_templates: number;
    email_templates: number;
    upsell_offers: number;
  };
  timestamp?: string;
  error?: string;
}

export default function TenantDebugPage() {
  const { data, isLoading, error, refetch } = useQuery<TenantSnapshot>({
    queryKey: ['/api/debug/tenant/snapshot'],
    refetchOnWindowFocus: false
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading tenant snapshot...</span>
      </div>
    );
  }

  if (error || !data?.success) {
    return (
      <div className="p-8">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Tenant Debug Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive">
              {error instanceof Error ? error.message : data?.error || 'Unknown error'}
            </p>
            <button 
              onClick={() => refetch()}
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
              data-testid="button-retry"
            >
              Retry
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { tenantContext, coreCounts, engagementCounts, timestamp } = data;

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Tenant Debug Snapshot</h1>
        <Badge variant={tenantContext?.isRootTenant ? "default" : "secondary"}>
          {tenantContext?.isRootTenant ? 'Root Tenant' : 'Child Tenant'}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Tenant Context
          </CardTitle>
          <CardDescription>Current tenant identification</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Tenant ID</p>
            <p className="font-mono text-sm" data-testid="text-tenant-id">{tenantContext?.tenantId}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Tenant Slug</p>
            <p className="font-mono text-sm" data-testid="text-tenant-slug">{tenantContext?.tenantSlug}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Snapshot Timestamp</p>
            <p className="font-mono text-xs" data-testid="text-timestamp">{timestamp}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Core Data Counts
          </CardTitle>
          <CardDescription>Primary business data (via tenantDb)</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-muted rounded-lg text-center">
            <Users className="h-6 w-6 mx-auto mb-2 text-blue-500" />
            <p className="text-2xl font-bold" data-testid="count-customers">{coreCounts?.customers ?? 'N/A'}</p>
            <p className="text-sm text-muted-foreground">Customers</p>
          </div>
          <div className="p-4 bg-muted rounded-lg text-center">
            <MessageSquare className="h-6 w-6 mx-auto mb-2 text-green-500" />
            <p className="text-2xl font-bold" data-testid="count-conversations">{coreCounts?.conversations ?? 'N/A'}</p>
            <p className="text-sm text-muted-foreground">Conversations</p>
          </div>
          <div className="p-4 bg-muted rounded-lg text-center">
            <Mail className="h-6 w-6 mx-auto mb-2 text-purple-500" />
            <p className="text-2xl font-bold" data-testid="count-messages">{coreCounts?.messages ?? 'N/A'}</p>
            <p className="text-sm text-muted-foreground">Messages</p>
          </div>
          <div className="p-4 bg-muted rounded-lg text-center">
            <Calendar className="h-6 w-6 mx-auto mb-2 text-orange-500" />
            <p className="text-2xl font-bold" data-testid="count-appointments">{coreCounts?.appointments ?? 'N/A'}</p>
            <p className="text-sm text-muted-foreground">Appointments</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Engagement Data Counts
          </CardTitle>
          <CardDescription>Loyalty, campaigns, and upselling data (via tenantDb)</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3 bg-muted rounded-lg text-center">
            <Gift className="h-5 w-5 mx-auto mb-1 text-yellow-500" />
            <p className="text-xl font-bold" data-testid="count-loyalty-points">{engagementCounts?.loyalty_points ?? 'N/A'}</p>
            <p className="text-xs text-muted-foreground">Loyalty Points</p>
          </div>
          <div className="p-3 bg-muted rounded-lg text-center">
            <Trophy className="h-5 w-5 mx-auto mb-1 text-amber-500" />
            <p className="text-xl font-bold" data-testid="count-reward-services">{engagementCounts?.reward_services ?? 'N/A'}</p>
            <p className="text-xs text-muted-foreground">Reward Services</p>
          </div>
          <div className="p-3 bg-muted rounded-lg text-center">
            <Gift className="h-5 w-5 mx-auto mb-1 text-emerald-500" />
            <p className="text-xl font-bold" data-testid="count-redeemed-rewards">{engagementCounts?.redeemed_rewards ?? 'N/A'}</p>
            <p className="text-xs text-muted-foreground">Redeemed Rewards</p>
          </div>
          <div className="p-3 bg-muted rounded-lg text-center">
            <TrendingUp className="h-5 w-5 mx-auto mb-1 text-pink-500" />
            <p className="text-xl font-bold" data-testid="count-upsell-offers">{engagementCounts?.upsell_offers ?? 'N/A'}</p>
            <p className="text-xs text-muted-foreground">Upsell Offers</p>
          </div>
          <div className="p-3 bg-muted rounded-lg text-center">
            <MessageSquare className="h-5 w-5 mx-auto mb-1 text-cyan-500" />
            <p className="text-xl font-bold" data-testid="count-sms-campaigns">{engagementCounts?.sms_campaigns ?? 'N/A'}</p>
            <p className="text-xs text-muted-foreground">SMS Campaigns</p>
          </div>
          <div className="p-3 bg-muted rounded-lg text-center">
            <Mail className="h-5 w-5 mx-auto mb-1 text-indigo-500" />
            <p className="text-xl font-bold" data-testid="count-email-campaigns">{engagementCounts?.email_campaigns ?? 'N/A'}</p>
            <p className="text-xs text-muted-foreground">Email Campaigns</p>
          </div>
          <div className="p-3 bg-muted rounded-lg text-center">
            <MessageSquare className="h-5 w-5 mx-auto mb-1 text-teal-500" />
            <p className="text-xl font-bold" data-testid="count-sms-templates">{engagementCounts?.sms_templates ?? 'N/A'}</p>
            <p className="text-xs text-muted-foreground">SMS Templates</p>
          </div>
          <div className="p-3 bg-muted rounded-lg text-center">
            <Mail className="h-5 w-5 mx-auto mb-1 text-violet-500" />
            <p className="text-xl font-bold" data-testid="count-email-templates">{engagementCounts?.email_templates ?? 'N/A'}</p>
            <p className="text-xs text-muted-foreground">Email Templates</p>
          </div>
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground text-center">
        This debug page shows data as seen through the tenant isolation layer (tenantDb).
        <br />
        All counts should match what the config pages would see via their API routes.
      </div>
    </div>
  );
}
