import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DollarSign, ChevronDown, ChevronRight, CheckCircle, Wallet, FileText, Loader2 } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface PendingDepositGroup {
  technicianId: number;
  technicianName: string;
  deposits: any[];
  totalCash: number;
  totalCheck: number;
  totalAmount: number;
  invoiceCount: number;
}

export function CashCollectionsWidget() {
  const { toast } = useToast();
  const [expandedTechId, setExpandedTechId] = useState<number | null>(null);

  const { data, isLoading } = useQuery<{ success: boolean; data: PendingDepositGroup[] }>({
    queryKey: ['/api/tech-deposits/pending'],
  });

  const markDepositedMutation = useMutation({
    mutationFn: async (depositId: number) => {
      return await apiRequest(`/api/tech-deposits/${depositId}/mark-deposited`, {
        method: 'POST',
      });
    },
    onSuccess: (response: any, depositId) => {
      toast({
        title: 'Deposit Confirmed',
        description: response.message || 'Deposit has been marked as deposited',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/tech-deposits/pending'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tech-deposits/history'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to mark deposit as deposited',
        variant: 'destructive',
      });
    },
  });

  const pendingGroups = data?.data || [];
  const totalPending = pendingGroups.reduce((sum, group) => sum + group.totalAmount, 0);
  const totalCount = pendingGroups.reduce((sum, group) => sum + group.invoiceCount, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            Pending Cash Deposits
          </CardTitle>
          {totalCount > 0 && (
            <Badge variant="default" className="bg-green-600">
              {totalCount} {totalCount === 1 ? 'payment' : 'payments'}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8" data-testid="loader-pending-deposits">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : pendingGroups.length === 0 ? (
          <div className="text-center py-8" data-testid="empty-pending-deposits">
            <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-20" />
            <p className="text-sm text-muted-foreground">No pending deposits</p>
            <p className="text-xs text-muted-foreground mt-1">
              Cash and check payments will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Total Summary */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Total Pending
                </span>
                <span className="text-2xl font-bold text-green-700 dark:text-green-400" data-testid="text-total-pending">
                  ${totalPending.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Technician Groups */}
            {pendingGroups.map((group) => (
              <Collapsible
                key={group.technicianId}
                open={expandedTechId === group.technicianId}
                onOpenChange={(open) => setExpandedTechId(open ? group.technicianId : null)}
              >
                <div className="border rounded-lg p-4 bg-card hover:bg-accent/5 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <CollapsibleTrigger className="flex items-center gap-2 flex-1" data-testid={`button-expand-tech-${group.technicianId}`}>
                      {expandedTechId === group.technicianId ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <div className="text-left flex-1">
                        <p className="font-semibold text-sm" data-testid={`text-tech-name-${group.technicianId}`}>
                          {group.technicianName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {group.invoiceCount} {group.invoiceCount === 1 ? 'payment' : 'payments'}
                        </p>
                      </div>
                    </CollapsibleTrigger>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="bg-background p-2 rounded border">
                      <div className="flex items-center gap-1 mb-1">
                        <Wallet className="h-3 w-3 text-green-600" />
                        <span className="text-xs text-muted-foreground">Cash</span>
                      </div>
                      <p className="text-sm font-semibold" data-testid={`text-cash-${group.technicianId}`}>
                        ${group.totalCash.toFixed(2)}
                      </p>
                    </div>
                    <div className="bg-background p-2 rounded border">
                      <div className="flex items-center gap-1 mb-1">
                        <FileText className="h-3 w-3 text-blue-600" />
                        <span className="text-xs text-muted-foreground">Check</span>
                      </div>
                      <p className="text-sm font-semibold" data-testid={`text-check-${group.technicianId}`}>
                        ${group.totalCheck.toFixed(2)}
                      </p>
                    </div>
                    <div className="bg-background p-2 rounded border">
                      <div className="flex items-center gap-1 mb-1">
                        <DollarSign className="h-3 w-3 text-purple-600" />
                        <span className="text-xs text-muted-foreground">Total</span>
                      </div>
                      <p className="text-sm font-bold text-purple-700 dark:text-purple-400" data-testid={`text-total-${group.technicianId}`}>
                        ${group.totalAmount.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  <CollapsibleContent className="mt-3 space-y-2">
                    {group.deposits.map((deposit: any) => (
                      <div
                        key={deposit.id}
                        className="bg-muted/30 p-3 rounded-lg border space-y-2"
                        data-testid={`deposit-card-${deposit.id}`}
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">
                            {new Date(deposit.depositDate).toLocaleDateString()}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {deposit.status}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">
                            ${deposit.totalAmount}
                          </span>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => markDepositedMutation.mutate(deposit.id)}
                            disabled={markDepositedMutation.isPending}
                            data-testid={`button-mark-deposited-${deposit.id}`}
                          >
                            {markDepositedMutation.isPending ? (
                              <>
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                Confirming...
                              </>
                            ) : (
                              <>
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Mark Deposited
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </CollapsibleContent>

                  {/* Quick Mark All Deposited */}
                  {group.deposits.length === 1 && (
                    <Button
                      size="sm"
                      variant="default"
                      className="w-full mt-2"
                      onClick={() => markDepositedMutation.mutate(group.deposits[0].id)}
                      disabled={markDepositedMutation.isPending}
                      data-testid={`button-quick-mark-${group.technicianId}`}
                    >
                      {markDepositedMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Confirming...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Confirm Deposit
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </Collapsible>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
