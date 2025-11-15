import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tag, Loader2, CheckCircle2, XCircle, Gift } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface PayerReferralCodeInputProps {
  token: string;
  currentAmount: number;
  onDiscountApplied?: (newAmount: number, newDeposit?: number) => void;
}

interface ApplyResponse {
  success: boolean;
  isInformational: boolean;
  message: string;
  rewardType?: string;
  rewardValue?: number;
  computedDiscount?: number;
  discountedTotal?: number; // AUTHORITATIVE: Server-calculated total after discount
  discountedDeposit?: number; // AUTHORITATIVE: Server-calculated deposit after discount
  referrerName?: string;
}

export function PayerReferralCodeInput({
  token,
  currentAmount,
  onDiscountApplied
}: PayerReferralCodeInputProps) {
  const [code, setCode] = useState('');
  const [isApplied, setIsApplied] = useState(false);
  const [appliedData, setAppliedData] = useState<ApplyResponse | null>(null);

  // Apply code mutation - SECURITY FIX: Backend loads appointment price from DB
  const applyMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/payer-approval/${token}/apply-referral`, {
        referralCode: code.trim().toUpperCase(),
        // SECURITY: Backend loads real price from database - no client input needed
      });
      return response.json();
    },
    onSuccess: (data: ApplyResponse) => {
      setIsApplied(true);
      setAppliedData(data);
      
      // CRITICAL FIX: Trust server-provided total AND deposit, don't calculate
      if (!data.isInformational && data.discountedTotal !== undefined) {
        if (onDiscountApplied) {
          onDiscountApplied(data.discountedTotal, data.discountedDeposit);
        }
      }
    },
    onError: () => {
      // Error handled by mutation error state
    },
  });

  const handleApply = () => {
    if (!code.trim()) {
      alert('Please enter a referral code');
      return;
    }

    applyMutation.mutate();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && code.trim()) {
      handleApply();
    }
  };

  return (
    <Card className="border-dashed border-2 border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30">
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <h3 className="font-semibold text-blue-900 dark:text-blue-100">
              Have a referral code?
            </h3>
          </div>

          {/* Input and Button */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type="text"
                placeholder="Enter code (e.g., JOHN-AB3C5)"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onKeyPress={handleKeyPress}
                disabled={isApplied || applyMutation.isPending}
                className="pr-10 font-mono uppercase"
                maxLength={20}
                data-testid="input-payer-referral-code"
              />
            </div>

            <Button
              onClick={handleApply}
              disabled={!code.trim() || isApplied || applyMutation.isPending}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              data-testid="button-apply-payer-code"
            >
              {applyMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Applying...
                </>
              ) : isApplied ? (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Applied
                </>
              ) : (
                <>
                  <Tag className="h-4 w-4 mr-2" />
                  Apply
                </>
              )}
            </Button>
          </div>

          {/* Success message after applied */}
          {isApplied && appliedData && (
            <Alert className="border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-950/30">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-green-800 dark:text-green-200">
                <div className="space-y-2">
                  <p className="font-medium">{appliedData.message}</p>
                  
                  {appliedData.referrerName && (
                    <p className="text-sm">
                      Referred by: <span className="font-semibold">{appliedData.referrerName}</span>
                    </p>
                  )}
                  
                  {/* Show savings breakdown if it's a discount */}
                  {!appliedData.isInformational && appliedData.computedDiscount !== undefined && (
                    <div className="pt-2 mt-2 border-t border-green-200 dark:border-green-800 text-sm">
                      <div className="flex items-center justify-between">
                        <span>Discount applied:</span>
                        <span className="font-bold text-green-700 dark:text-green-300">
                          -${appliedData.computedDiscount.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Error message */}
          {applyMutation.isError && (
            <Alert className="border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30">
              <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
              <AlertDescription className="text-red-800 dark:text-red-200">
                {(applyMutation.error as Error)?.message || 'Failed to apply referral code'}
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
