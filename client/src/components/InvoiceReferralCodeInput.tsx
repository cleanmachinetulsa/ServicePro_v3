import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Tag, Loader2, CheckCircle2, XCircle, Clock, Gift } from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';

interface InvoiceReferralCodeInputProps {
  invoiceId: number;
  currentAmount: number;
  onDiscountApplied: (newAmount: number) => void;
}

interface CodeValidation {
  success: boolean;
  valid: boolean;
  code?: string;
  referrerName?: string;
  reward?: string;
  rewardType?: string;
  rewardValue?: number;
  expiresAt?: string | null;
  message?: string;
}

export function InvoiceReferralCodeInput({
  invoiceId,
  currentAmount,
  onDiscountApplied
}: InvoiceReferralCodeInputProps) {
  const { toast } = useToast();
  const [code, setCode] = useState('');
  const [debouncedCode, setDebouncedCode] = useState('');
  const [isApplied, setIsApplied] = useState(false);

  // Debounce code input for validation
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedCode(code.trim().toUpperCase());
    }, 500);

    return () => clearTimeout(timer);
  }, [code]);

  // Validate code as user types
  const { data: validation, isLoading: isValidating } = useQuery<CodeValidation>({
    queryKey: ['/api/referral/validate', debouncedCode],
    enabled: debouncedCode.length >= 5, // Only validate if code looks reasonable
    retry: false,
    refetchOnWindowFocus: false,
  });

  // Apply code mutation
  const applyMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/invoices/${invoiceId}/apply-referral`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ referralCode: code.trim().toUpperCase() }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to apply referral code');
      }

      return response.json();
    },
    onSuccess: (data) => {
      if (data.isInformational) {
        // Non-discount reward type - show informational message
        toast({
          title: 'Referral code saved! ℹ️',
          description: data.message,
        });
        setIsApplied(true);
      } else {
        // Discount applied successfully
        setIsApplied(true);
        onDiscountApplied(data.newAmount);
        toast({
          title: 'Code applied! 🎉',
          description: `You saved $${data.discountAmount.toFixed(2)}`,
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to apply code',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleApply = () => {
    if (!code.trim()) {
      toast({
        title: 'Code required',
        description: 'Please enter a referral code',
        variant: 'destructive',
      });
      return;
    }

    applyMutation.mutate();
  };

  const isCodeValid = validation?.valid === true;
  const showValidation = debouncedCode.length >= 5 && !isValidating;

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
                disabled={isApplied || applyMutation.isPending}
                className="pr-10 font-mono uppercase"
                maxLength={20}
                data-testid="input-referral-code"
              />
              {/* Validation icon */}
              {showValidation && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {isCodeValid ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                  )}
                </div>
              )}
              {isValidating && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-spin" />
                </div>
              )}
            </div>

            <Button
              onClick={handleApply}
              disabled={!isCodeValid || isApplied || applyMutation.isPending}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              data-testid="button-apply-code"
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

          {/* Code Properties Display */}
          {showValidation && validation && (
            <Alert
              className={
                isCodeValid
                  ? 'border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-950/30'
                  : 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30'
              }
            >
              <AlertDescription className="space-y-2">
                <div className="flex items-center gap-2">
                  {isCodeValid ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                  )}
                  <span className={isCodeValid ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}>
                    {validation.message}
                  </span>
                </div>

                {/* Display code properties when valid */}
                {isCodeValid && validation.code && (
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Code:</span>
                      <Badge variant="outline" className="font-mono">
                        {validation.code}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-gray-600 dark:text-gray-400">From:</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {validation.referrerName || 'a friend'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Reward:</span>
                      <Badge className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
                        {validation.reward}
                      </Badge>
                    </div>

                    {validation.expiresAt && (
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <Clock className="h-3 w-3" />
                        <span className="text-xs">
                          Expires: {new Date(validation.expiresAt).toLocaleDateString()}
                        </span>
                      </div>
                    )}

                    {/* Savings preview */}
                    {validation.rewardType === 'fixed_discount' && validation.rewardValue && (
                      <div className="pt-2 mt-2 border-t border-green-200 dark:border-green-800">
                        <div className="flex items-center justify-between font-semibold">
                          <span className="text-gray-700 dark:text-gray-300">You'll save:</span>
                          <span className="text-green-700 dark:text-green-300">
                            ${Math.min(validation.rewardValue, currentAmount).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">New total:</span>
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            ${Math.max(0, currentAmount - validation.rewardValue).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    )}

                    {validation.rewardType === 'percent_discount' && validation.rewardValue && (
                      <div className="pt-2 mt-2 border-t border-green-200 dark:border-green-800">
                        <div className="flex items-center justify-between font-semibold">
                          <span className="text-gray-700 dark:text-gray-300">You'll save:</span>
                          <span className="text-green-700 dark:text-green-300">
                            ${((currentAmount * validation.rewardValue) / 100).toFixed(2)} ({validation.rewardValue}%)
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">New total:</span>
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            ${(currentAmount - (currentAmount * validation.rewardValue) / 100).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Success message after applied */}
          {isApplied && (
            <Alert className="border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-950/30">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-green-800 dark:text-green-200">
                Referral code applied successfully! The discount has been applied to your invoice.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
