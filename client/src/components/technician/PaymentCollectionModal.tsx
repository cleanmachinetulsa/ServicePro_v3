import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DollarSign, Wallet, FileText, Loader2 } from 'lucide-react';

interface PaymentCollectionModalProps {
  jobId: number;
  customerName: string;
  amount: number;
  onSuccess: () => void;
  onCancel: () => void;
}

export function PaymentCollectionModal({
  jobId,
  customerName,
  amount,
  onSuccess,
  onCancel,
}: PaymentCollectionModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<'cash' | 'check' | null>(null);
  const { toast } = useToast();

  const completeJobMutation = useMutation({
    mutationFn: async ({ paymentMethod, amount }: { paymentMethod: string; amount: number }) => {
      return await apiRequest(`/api/tech/jobs/${jobId}/complete`, {
        method: 'POST',
        body: JSON.stringify({ paymentMethod, amount }),
      });
    },
    onSuccess: (data) => {
      toast({
        title: 'Payment Recorded!',
        description: `${selectedMethod?.toUpperCase()} payment of $${amount.toFixed(2)} recorded successfully`,
        variant: 'default',
      });
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/tech/jobs/today'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tech-deposits/today'] });
      
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to record payment',
        variant: 'destructive',
      });
    },
  });

  const handleConfirm = () => {
    if (!selectedMethod) return;
    
    completeJobMutation.mutate({
      paymentMethod: selectedMethod,
      amount,
    });
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md" data-testid="modal-payment-collection">
        <DialogHeader>
          <DialogTitle className="text-2xl" data-testid="text-modal-title">
            Collect Payment
          </DialogTitle>
          <DialogDescription>
            Record the payment method for this service
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Customer Name */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Customer</p>
            <p className="text-lg font-medium" data-testid="text-customer-name">
              {customerName}
            </p>
          </div>

          {/* Amount Display */}
          <div className="text-center py-4 bg-primary/5 rounded-lg border-2 border-primary/20">
            <p className="text-sm text-muted-foreground mb-1">Total Amount</p>
            <p className="text-4xl font-bold text-primary flex items-center justify-center gap-1" data-testid="text-payment-amount">
              <DollarSign className="h-8 w-8" />
              {amount.toFixed(2)}
            </p>
          </div>

          {/* Payment Method Selection */}
          <div>
            <p className="text-sm text-muted-foreground mb-3 text-center">
              Select Payment Method
            </p>
            <div className="grid grid-cols-2 gap-4">
              {/* Cash Button */}
              <Button
                type="button"
                variant={selectedMethod === 'cash' ? 'default' : 'outline'}
                size="lg"
                className="h-24 flex flex-col gap-2"
                onClick={() => setSelectedMethod('cash')}
                data-testid="button-payment-cash"
              >
                <Wallet className="h-8 w-8" />
                <span className="text-lg font-semibold">Cash</span>
              </Button>

              {/* Check Button */}
              <Button
                type="button"
                variant={selectedMethod === 'check' ? 'default' : 'outline'}
                size="lg"
                className="h-24 flex flex-col gap-2"
                onClick={() => setSelectedMethod('check')}
                data-testid="button-payment-check"
              >
                <FileText className="h-8 w-8" />
                <span className="text-lg font-semibold">Check</span>
              </Button>
            </div>
          </div>

          {/* Selection Indicator */}
          {selectedMethod && (
            <div className="text-center text-sm text-muted-foreground animate-in fade-in slide-in-from-bottom-2">
              <p data-testid="text-selected-method">
                Selected: <span className="font-semibold text-foreground">{selectedMethod.toUpperCase()}</span>
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={completeJobMutation.isPending}
            className="flex-1"
            data-testid="button-cancel"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedMethod || completeJobMutation.isPending}
            className="flex-1"
            data-testid="button-confirm-payment"
          >
            {completeJobMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Recording...
              </>
            ) : (
              <>
                <DollarSign className="mr-2 h-4 w-4" />
                Confirm Payment
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
