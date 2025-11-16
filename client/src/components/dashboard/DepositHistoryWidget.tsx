import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { History, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface DepositWithTechnician {
  id: number;
  technicianId: number;
  technicianName: string;
  depositDate: string;
  cashAmount: string;
  checkAmount: string;
  totalAmount: string;
  status: string;
  depositedAt: string | null;
}

export function DepositHistoryWidget() {
  const { data, isLoading } = useQuery<{ success: boolean; data: DepositWithTechnician[] }>({
    queryKey: ['/api/tech-deposits/history'],
  });

  const deposits = data?.data || [];

  const getStatusVariant = (status: string): "default" | "secondary" | "outline" => {
    switch (status) {
      case 'deposited':
        return 'default';
      case 'pending':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5 text-blue-600" />
          Recent Deposits
          <span className="text-sm font-normal text-muted-foreground ml-1">
            (Last 7 days)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8" data-testid="loader-deposit-history">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : deposits.length === 0 ? (
          <div className="text-center py-8" data-testid="empty-deposit-history">
            <History className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-20" />
            <p className="text-sm text-muted-foreground">No deposits in the last 7 days</p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Technician</TableHead>
                  <TableHead className="text-right">Cash</TableHead>
                  <TableHead className="text-right">Check</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deposits.map((deposit) => (
                  <TableRow key={deposit.id} data-testid={`row-deposit-${deposit.id}`}>
                    <TableCell className="font-medium">
                      {format(new Date(deposit.depositDate), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell data-testid={`text-tech-${deposit.id}`}>
                      {deposit.technicianName}
                    </TableCell>
                    <TableCell className="text-right" data-testid={`text-cash-${deposit.id}`}>
                      ${parseFloat(deposit.cashAmount || '0').toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right" data-testid={`text-check-${deposit.id}`}>
                      ${parseFloat(deposit.checkAmount || '0').toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-semibold" data-testid={`text-total-${deposit.id}`}>
                      ${parseFloat(deposit.totalAmount || '0').toFixed(2)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge 
                        variant={getStatusVariant(deposit.status)}
                        data-testid={`badge-status-${deposit.id}`}
                      >
                        {deposit.status === 'deposited' ? '✓ Deposited' : 'Pending'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {deposits.length > 0 && (
          <div className="mt-4 text-center text-sm text-muted-foreground">
            Showing {deposits.length} {deposits.length === 1 ? 'deposit' : 'deposits'}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
