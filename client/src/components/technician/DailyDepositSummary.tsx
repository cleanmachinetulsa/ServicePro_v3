import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DollarSign, RefreshCw, Wallet, FileText } from 'lucide-react';
import { useUser } from '@/hooks/use-user';
import { queryClient } from '@/lib/queryClient';

interface DepositData {
  depositRecord: any;
  cashAmount: string;
  checkAmount: string;
  totalAmount: string;
  invoiceCount: number;
  invoices: any[];
}

export function DailyDepositSummary() {
  const { user } = useUser();
  
  const { data, isLoading, refetch } = useQuery<{ success: boolean; data: DepositData }>({
    queryKey: ['/api/tech-deposits/today', user?.id],
    enabled: !!user?.id,
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/tech-deposits/today'] });
    refetch();
  };

  const depositData = data?.data;
  const cashAmount = parseFloat(depositData?.cashAmount || '0');
  const checkAmount = parseFloat(depositData?.checkAmount || '0');
  const totalAmount = parseFloat(depositData?.totalAmount || '0');
  const invoiceCount = depositData?.invoiceCount || 0;

  return (
    <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-green-900 dark:text-green-100 flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Today's Collections
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
            className="h-8 w-8 p-0"
            data-testid="button-refresh-deposits"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Cash Amount */}
        <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-green-100 dark:border-green-900">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-green-100 dark:bg-green-900 rounded-full">
              <Wallet className="h-4 w-4 text-green-700 dark:text-green-300" />
            </div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Cash</span>
          </div>
          <span className="text-lg font-bold text-gray-900 dark:text-white" data-testid="text-cash-amount">
            ${cashAmount.toFixed(2)}
          </span>
        </div>

        {/* Check Amount */}
        <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-green-100 dark:border-green-900">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-full">
              <FileText className="h-4 w-4 text-blue-700 dark:text-blue-300" />
            </div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Check</span>
          </div>
          <span className="text-lg font-bold text-gray-900 dark:text-white" data-testid="text-check-amount">
            ${checkAmount.toFixed(2)}
          </span>
        </div>

        {/* Total Amount */}
        <div className="pt-3 border-t-2 border-green-200 dark:border-green-800">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-green-900 dark:text-green-100">
              TOTAL
            </span>
            <span className="text-3xl font-extrabold text-green-700 dark:text-green-400" data-testid="text-total-amount">
              ${totalAmount.toFixed(2)}
            </span>
          </div>
          
          {/* Invoice Count */}
          {invoiceCount > 0 && (
            <div className="mt-2 text-center">
              <span className="text-xs text-gray-600 dark:text-gray-400" data-testid="text-invoice-count">
                {invoiceCount} {invoiceCount === 1 ? 'payment' : 'payments'} recorded
              </span>
            </div>
          )}
        </div>

        {/* Empty State */}
        {totalAmount === 0 && (
          <div className="text-center py-2">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No cash/check payments yet today
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
