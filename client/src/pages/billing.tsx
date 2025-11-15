import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { AppShell } from '@/components/AppShell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { DollarSign, AlertCircle, CheckCircle2, Calendar, User, Phone, Mail } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';

interface UnpaidInvoice {
  id: number;
  createdAt: string;
  appointmentId: number | null;
  serviceDescription: string;
  amount: string;
  paymentStatus: string;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
}

export default function Billing() {
  const { toast } = useToast();
  const [selectedInvoice, setSelectedInvoice] = useState<UnpaidInvoice | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState(false);

  // Fetch current user to check permissions
  const { data: currentUserData } = useQuery<{ success: boolean; user: { id: number; username: string; role: string } }>({
    queryKey: ['/api/users/me'],
  });

  const currentUser = currentUserData?.user;

  // Query unpaid invoices
  const { data, isLoading, error } = useQuery<{ success: boolean; invoices: UnpaidInvoice[] }>({
    queryKey: ['/api/invoices/unpaid'],
  });

  // Mutation to mark invoice as paid
  const markAsPaidMutation = useMutation({
    mutationFn: async ({ invoiceId, method }: { invoiceId: number; method: string }) => {
      const response = await apiRequest(
        'POST',
        `/api/invoices/${invoiceId}/pay`,
        { paymentMethod: method }
      );
      return response.json();
    },
    onSuccess: (_, variables) => {
      // Invalidate and refetch unpaid invoices
      queryClient.invalidateQueries({ queryKey: ['/api/invoices/unpaid'] });
      
      // Show success toast
      const methodLabel = variables.method.charAt(0).toUpperCase() + variables.method.slice(1);
      toast({
        title: 'Invoice Marked as Paid',
        description: `Invoice marked as paid with ${methodLabel}. Review request sent to customer.`,
        variant: 'default',
      });

      // Close dialog and reset state
      setDialogOpen(false);
      setSelectedInvoice(null);
      setPaymentMethod('');
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to mark invoice as paid',
        variant: 'destructive',
      });
    },
  });

  const handleMarkAsPaid = (invoice: UnpaidInvoice) => {
    setSelectedInvoice(invoice);
    setPaymentMethod('');
    setDialogOpen(true);
  };

  const handleConfirmPayment = () => {
    if (!selectedInvoice || !paymentMethod) {
      toast({
        title: 'Error',
        description: 'Please select a payment method',
        variant: 'destructive',
      });
      return;
    }

    markAsPaidMutation.mutate({
      invoiceId: selectedInvoice.id,
      method: paymentMethod,
    });
  };

  const isInvoiceOld = (createdAt: string) => {
    const daysDiff = differenceInDays(new Date(), new Date(createdAt));
    return daysDiff > 14;
  };

  const formatCurrency = (amount: string) => {
    return `$${parseFloat(amount).toFixed(2)}`;
  };

  // Check if user has required role
  if (currentUser && !['owner', 'manager'].includes(currentUser.role)) {
    return (
      <AppShell title="Billing" showSearch={false}>
        <div className="flex items-center justify-center h-screen">
          <p className="text-muted-foreground">Access denied. This page is only available to owners and managers.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Billing" showSearch={false}>
      <div className="p-6 max-w-7xl mx-auto space-y-6" data-testid="billing-page">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Billing</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Manage unpaid invoices and process cash payments
            </p>
          </div>
          <div className="flex items-center gap-2">
            <DollarSign className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Unpaid Invoices</CardTitle>
            <CardDescription>
              Mark invoices as paid when customers pay with cash or alternative methods
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3" data-testid="loading-skeleton">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : error ? (
              <div 
                className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
                data-testid="error-message"
              >
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                <p className="text-red-800 dark:text-red-200">
                  Failed to load unpaid invoices. Please try again.
                </p>
              </div>
            ) : !data?.invoices || data.invoices.length === 0 ? (
              <div 
                className="flex flex-col items-center justify-center py-12 text-center"
                data-testid="empty-state"
              >
                <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  All Caught Up!
                </h3>
                <p className="text-gray-500 dark:text-gray-400 max-w-md">
                  There are no unpaid invoices at the moment. Great work!
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Service</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.invoices.map((invoice) => (
                      <TableRow key={invoice.id} data-testid={`invoice-row-${invoice.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            <span data-testid={`text-date-${invoice.id}`}>
                              {format(new Date(invoice.createdAt), 'MMM d, yyyy')}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-gray-400" />
                              <span className="font-medium" data-testid={`text-customer-${invoice.id}`}>
                                {invoice.customerName || 'Unknown'}
                              </span>
                            </div>
                            {invoice.customerPhone && (
                              <div className="flex items-center gap-2 text-sm text-gray-500">
                                <Phone className="h-3 w-3" />
                                <span>{invoice.customerPhone}</span>
                              </div>
                            )}
                            {invoice.customerEmail && (
                              <div className="flex items-center gap-2 text-sm text-gray-500">
                                <Mail className="h-3 w-3" />
                                <span>{invoice.customerEmail}</span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell data-testid={`text-service-${invoice.id}`}>
                          <div className="max-w-xs truncate" title={invoice.serviceDescription}>
                            {invoice.serviceDescription}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-semibold text-lg" data-testid={`text-amount-${invoice.id}`}>
                            {formatCurrency(invoice.amount)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge 
                              variant="secondary" 
                              className="w-fit"
                              data-testid={`badge-status-${invoice.id}`}
                            >
                              Unpaid
                            </Badge>
                            {isInvoiceOld(invoice.createdAt) && (
                              <Badge 
                                variant="destructive" 
                                className="w-fit text-xs"
                                data-testid={`badge-overdue-${invoice.id}`}
                              >
                                {'>'}14 days old
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            onClick={() => handleMarkAsPaid(invoice)}
                            size="sm"
                            data-testid={`button-mark-paid-${invoice.id}`}
                          >
                            Mark as Paid
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Method Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent data-testid="dialog-mark-paid">
            <DialogHeader>
              <DialogTitle>Mark Invoice as Paid</DialogTitle>
              <DialogDescription>
                Record payment and send review request to customer
              </DialogDescription>
            </DialogHeader>

            {selectedInvoice && (
              <div className="space-y-4 py-4">
                {/* Invoice Details */}
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Customer:</span>
                    <span className="font-medium" data-testid="dialog-customer">
                      {selectedInvoice.customerName || 'Unknown'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Service:</span>
                    <span className="font-medium text-right" data-testid="dialog-service">
                      {selectedInvoice.serviceDescription}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Amount:</span>
                    <span className="font-bold text-lg text-green-600" data-testid="dialog-amount">
                      {formatCurrency(selectedInvoice.amount)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Date:</span>
                    <span className="font-medium" data-testid="dialog-date">
                      {format(new Date(selectedInvoice.createdAt), 'MMM d, yyyy')}
                    </span>
                  </div>
                </div>

                {/* Payment Method Selector */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Payment Method</label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger data-testid="select-payment-method">
                      <SelectValue placeholder="Select payment method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash" data-testid="option-cash">Cash</SelectItem>
                      <SelectItem value="venmo" data-testid="option-venmo">Venmo</SelectItem>
                      <SelectItem value="cashapp" data-testid="option-cashapp">CashApp</SelectItem>
                      <SelectItem value="paypal" data-testid="option-paypal">PayPal</SelectItem>
                      <SelectItem value="check" data-testid="option-check">Check</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={markAsPaidMutation.isPending}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmPayment}
                disabled={!paymentMethod || markAsPaidMutation.isPending}
                data-testid="button-confirm-payment"
              >
                {markAsPaidMutation.isPending ? 'Processing...' : 'Confirm Payment'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
