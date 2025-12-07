import { useQuery, useMutation } from '@tanstack/react-query';
import { AppShell } from '@/components/AppShell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  CreditCard, 
  AlertTriangle, 
  CheckCircle2, 
  FileText, 
  ExternalLink,
  TrendingUp,
  Clock,
  DollarSign,
  Calendar,
} from 'lucide-react';
import { format } from 'date-fns';

interface TenantInvoice {
  id: number;
  periodStart: string;
  periodEnd: string;
  subscriptionAmount: number;
  usageAmount: number;
  discountAmount: number;
  totalAmount: number;
  status: string;
  dueDate: string;
  paidAt: string | null;
  stripeHostedInvoiceUrl: string | null;
  stripePdfUrl: string | null;
  createdAt: string;
}

interface BillingInfo {
  tenantId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  planTier: string;
  status: string;
  overdueDays: number;
  billingStatusSince: string | null;
}

interface DunningStatus {
  overdueDays: number;
  isOverdue: boolean;
  hasReminder: boolean;
  isSuspended: boolean;
  hasLoginRestrictions: boolean;
}

interface BillingData {
  success: boolean;
  billingInfo: BillingInfo;
  dunningStatus: DunningStatus;
  invoices: TenantInvoice[];
}

const PLAN_DISPLAY_NAMES: Record<string, string> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Professional',
  elite: 'Elite',
  internal: 'Internal',
};

const PLAN_PRICES: Record<string, number> = {
  free: 0,
  starter: 39,
  pro: 89,
  elite: 199,
  internal: 0,
};

export default function AdminBilling() {
  const { toast } = useToast();

  const { data, isLoading, error } = useQuery<BillingData>({
    queryKey: ['/api/admin/billing/info'],
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/tenant/billing/portal-session');
      return response.json();
    },
    onSuccess: (data) => {
      if (data.portalUrl) {
        window.open(data.portalUrl, '_blank');
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to open billing portal',
        variant: 'destructive',
      });
    },
  });

  const formatCurrency = (amountCents: number) => {
    return `$${(amountCents / 100).toFixed(2)}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-500" data-testid="badge-paid">Paid</Badge>;
      case 'open':
        return <Badge variant="secondary" data-testid="badge-open">Open</Badge>;
      case 'past_due':
        return <Badge variant="destructive" data-testid="badge-past-due">Past Due</Badge>;
      case 'draft':
        return <Badge variant="outline" data-testid="badge-draft">Draft</Badge>;
      case 'void':
        return <Badge variant="outline" data-testid="badge-void">Voided</Badge>;
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
      <Badge className={colorMap[tier] || 'bg-gray-500'} data-testid="badge-plan-tier">
        {PLAN_DISPLAY_NAMES[tier] || tier}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <AppShell title="Billing & Subscription" showSearch={false}>
        <div className="p-6 max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </AppShell>
    );
  }

  if (error || !data?.success) {
    return (
      <AppShell title="Billing & Subscription" showSearch={false}>
        <div className="p-6 max-w-4xl mx-auto">
          <Card className="border-red-200 bg-red-50 dark:bg-red-900/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-6 w-6 text-red-600" />
                <p className="text-red-800 dark:text-red-200">
                  Failed to load billing information. Please try again later.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  const { billingInfo, dunningStatus, invoices } = data;

  return (
    <AppShell title="Billing & Subscription" showSearch={false}>
      <div className="p-6 max-w-4xl mx-auto space-y-6" data-testid="admin-billing-page">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Billing & Subscription</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Manage your plan, payment methods, and view invoices
            </p>
          </div>
        </div>

        {dunningStatus.isOverdue && (
          <Card className="border-amber-200 bg-amber-50 dark:bg-amber-900/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-6 w-6 text-amber-600" />
                <div>
                  <p className="font-medium text-amber-800 dark:text-amber-200">
                    Payment Overdue - {dunningStatus.overdueDays} Days
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    {dunningStatus.isSuspended 
                      ? 'Your account is suspended. Please update your payment method to restore services.'
                      : 'Please update your payment method to avoid service interruption.'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="plan" className="w-full">
          <TabsList className="grid w-full grid-cols-2" data-testid="billing-tabs">
            <TabsTrigger value="plan" data-testid="tab-plan">Plan & Payment</TabsTrigger>
            <TabsTrigger value="invoices" data-testid="tab-invoices">Invoices</TabsTrigger>
          </TabsList>

          <TabsContent value="plan" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Current Plan
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      {getPlanBadge(billingInfo.planTier)}
                      <span className="text-2xl font-bold" data-testid="text-plan-price">
                        ${PLAN_PRICES[billingInfo.planTier] || 0}/mo
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {billingInfo.status === 'active' ? (
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle2 className="h-4 w-4" />
                          Active Subscription
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-amber-600">
                          <Clock className="h-4 w-4" />
                          {billingInfo.status}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button 
                      variant="outline"
                      onClick={() => window.location.href = '/pricing'}
                      data-testid="button-view-plans"
                    >
                      View Plans
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Payment Method
                </CardTitle>
                <CardDescription>
                  Manage your payment method and billing information
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    {billingInfo.stripeCustomerId ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Manage your payment method through the Stripe billing portal
                      </p>
                    ) : (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        No payment method on file. Upgrade your plan to add a payment method.
                      </p>
                    )}
                  </div>
                  <Button 
                    onClick={() => portalMutation.mutate()}
                    disabled={!billingInfo.stripeCustomerId || portalMutation.isPending}
                    data-testid="button-manage-payment"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    {portalMutation.isPending ? 'Opening...' : 'Manage Payment'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {billingInfo.planTier !== 'free' && billingInfo.planTier !== 'internal' && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Usage-Based Charges
                  </CardTitle>
                  <CardDescription>
                    Additional charges based on your usage (SMS, voice, email, AI)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Usage charges are calculated monthly and added to your subscription invoice.
                    View detailed usage in the <a href="/admin/usage" className="text-blue-600 hover:underline">Usage Dashboard</a>.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="invoices" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Invoice History
                </CardTitle>
                <CardDescription>
                  View and download your past invoices
                </CardDescription>
              </CardHeader>
              <CardContent>
                {invoices.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-gray-400">No invoices yet</p>
                    <p className="text-sm text-gray-400">
                      Your invoices will appear here after your first billing cycle
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {invoices.map((invoice) => (
                      <div 
                        key={invoice.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg gap-4"
                        data-testid={`invoice-row-${invoice.id}`}
                      >
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            <span className="font-medium" data-testid={`text-invoice-period-${invoice.id}`}>
                              {format(new Date(invoice.periodStart), 'MMM d')} - {format(new Date(invoice.periodEnd), 'MMM d, yyyy')}
                            </span>
                            {getStatusBadge(invoice.status)}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            Subscription: {formatCurrency(invoice.subscriptionAmount)} + Usage: {formatCurrency(invoice.usageAmount)}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-lg font-bold" data-testid={`text-invoice-total-${invoice.id}`}>
                            {formatCurrency(invoice.totalAmount)}
                          </span>
                          <div className="flex gap-2">
                            {invoice.stripeHostedInvoiceUrl && (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => window.open(invoice.stripeHostedInvoiceUrl!, '_blank')}
                                data-testid={`button-view-invoice-${invoice.id}`}
                              >
                                View
                              </Button>
                            )}
                            {invoice.stripePdfUrl && (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => window.open(invoice.stripePdfUrl!, '_blank')}
                                data-testid={`button-download-invoice-${invoice.id}`}
                              >
                                PDF
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
