import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Calendar, Clock, ArrowRightLeft, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AppShell } from '@/components/AppShell';

export default function ShiftTrades() {
  const { toast } = useToast();
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [selectedTradeId, setSelectedTradeId] = useState<number | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewAction, setReviewAction] = useState<'approved' | 'denied'>('approved');

  // Fetch current user to determine if admin
  const { data: userData } = useQuery({
    queryKey: ['/api/user'],
  });

  const isAdmin = userData?.user?.role === 'owner' || userData?.user?.role === 'manager';

  // Fetch trades - use admin endpoint if admin, otherwise technician endpoint
  const { data, isLoading } = useQuery({
    queryKey: isAdmin ? ['/api/admin/shift-trades'] : ['/api/tech/shift-trades'],
  });

  const approveMutation = useMutation({
    mutationFn: async ({ tradeId, status, notes }: { tradeId: number; status: 'approved' | 'denied'; notes?: string }) => {
      return await apiRequest(`/api/admin/shift-trades/${tradeId}`, 'PUT', {
        status,
        reviewNotes: notes,
      });
    },
    onSuccess: (_, variables) => {
      toast({ 
        title: `Trade ${variables.status}!`,
        description: `Shift trade has been ${variables.status}.`
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/shift-trades'] });
      setReviewDialogOpen(false);
      setReviewNotes('');
      setSelectedTradeId(null);
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to update trade', 
        description: error.message || 'Please try again',
        variant: 'destructive' 
      });
    },
  });

  const handleReviewClick = (tradeId: number, action: 'approved' | 'denied') => {
    setSelectedTradeId(tradeId);
    setReviewAction(action);
    setReviewDialogOpen(true);
  };

  const handleReviewSubmit = () => {
    if (selectedTradeId) {
      approveMutation.mutate({
        tradeId: selectedTradeId,
        status: reviewAction,
        notes: reviewNotes,
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" data-testid={`badge-status-pending`}>Pending</Badge>;
      case 'approved':
        return <Badge className="bg-green-500" data-testid={`badge-status-approved`}>Approved</Badge>;
      case 'denied':
        return <Badge variant="destructive" data-testid={`badge-status-denied`}>Denied</Badge>;
      case 'cancelled':
        return <Badge variant="outline" data-testid={`badge-status-cancelled`}>Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const trades = data?.trades || [];

  return (
    <AppShell>
    <div className="container mx-auto p-4 md:p-6 space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Shift Trades</h1>
        <p className="text-sm md:text-base text-muted-foreground">
          {isAdmin ? 'Review and manage shift trade requests' : 'View your shift trade requests'}
        </p>
      </div>

      {isLoading ? (
        <div className="text-center py-8">Loading shift trades...</div>
      ) : trades.length === 0 ? (
        <Card className="p-6 md:p-8 text-center text-muted-foreground">
          <p>No shift trade requests at this time</p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {trades.map((trade: any) => (
            <Card key={trade.id} data-testid={`card-shift-trade-${trade.id}`}>
              <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0 pb-2 p-4 md:p-6">
                <CardTitle className="text-sm md:text-base font-medium flex items-center gap-2">
                  <ArrowRightLeft className="w-4 h-4 flex-shrink-0" />
                  {trade.tradeType === 'giveaway' ? 'Shift Giveaway' : 'Shift Trade'}
                </CardTitle>
                {getStatusBadge(trade.status)}
              </CardHeader>
              <CardContent className="space-y-4 p-4 md:p-6 pt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Offering Technician</div>
                    <div className="text-sm">
                      {trade.offeringTech?.preferredName || 'Unknown'}
                    </div>
                  </div>
                  {trade.requestingTech && (
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">Requesting Technician</div>
                      <div className="text-sm">
                        {trade.requestingTech?.preferredName || 'Unknown'}
                      </div>
                    </div>
                  )}
                </div>

                {trade.originalShift && (
                  <div className="border-t pt-3">
                    <div className="text-sm font-medium text-muted-foreground mb-1">Shift Details</div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4 flex-shrink-0" />
                        {format(new Date(trade.originalShift.shiftDate), 'MMM dd, yyyy')}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4 flex-shrink-0" />
                        {trade.originalShift.startTime} - {trade.originalShift.endTime}
                      </div>
                    </div>
                  </div>
                )}

                {trade.message && (
                  <div className="border-t pt-3">
                    <div className="text-sm font-medium text-muted-foreground mb-1">Reason</div>
                    <div className="text-sm">{trade.message}</div>
                  </div>
                )}

                {trade.reviewNotes && (
                  <div className="border-t pt-3">
                    <div className="text-sm font-medium text-muted-foreground mb-1">Review Notes</div>
                    <div className="text-sm">{trade.reviewNotes}</div>
                  </div>
                )}

                {isAdmin && trade.status === 'pending' && (
                  <div className="flex flex-col sm:flex-row gap-2 border-t pt-3">
                    <Button
                      size="sm"
                      variant="default"
                      className="flex-1 min-h-[44px]"
                      onClick={() => handleReviewClick(trade.id, 'approved')}
                      disabled={approveMutation.isPending}
                      data-testid={`button-approve-trade-${trade.id}`}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1 min-h-[44px]"
                      onClick={() => handleReviewClick(trade.id, 'denied')}
                      disabled={approveMutation.isPending}
                      data-testid={`button-deny-trade-${trade.id}`}
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Deny
                    </Button>
                  </div>
                )}

                <div className="text-xs text-muted-foreground">
                  Requested: {format(new Date(trade.requestedAt), 'MMM dd, yyyy h:mm a')}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent data-testid="dialog-review-trade">
          <DialogHeader>
            <DialogTitle>
              {reviewAction === 'approved' ? 'Approve' : 'Deny'} Shift Trade
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="reviewNotes">Review Notes (Optional)</Label>
              <Textarea
                id="reviewNotes"
                placeholder="Add any notes about this decision..."
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                data-testid="textarea-review-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReviewDialogOpen(false)}
              data-testid="button-cancel-review"
            >
              Cancel
            </Button>
            <Button
              onClick={handleReviewSubmit}
              disabled={approveMutation.isPending}
              data-testid="button-submit-review"
            >
              {approveMutation.isPending ? 'Submitting...' : `Confirm ${reviewAction === 'approved' ? 'Approval' : 'Denial'}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </AppShell>
  );
}
