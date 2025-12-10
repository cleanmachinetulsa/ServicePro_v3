import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Gift, Check, X, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface GiftCardApplicationResult {
  valid: boolean;
  giftCardId?: number;
  referenceCode?: string;
  originalBalanceCents?: number;
  appliedCents?: number;
  remainingCardBalanceCents?: number;
  newAmountCents?: number;
  currency?: string;
  error?: string;
}

interface AppliedGiftCard {
  giftCardId: number;
  referenceCode: string;
  appliedCents: number;
  remainingBalanceCents: number;
  currency: string;
}

interface GiftCardApplyProps {
  currentAmountCents: number;
  tenantId: string;
  onApply: (giftCard: AppliedGiftCard) => void;
  onRemove: () => void;
  appliedCard?: AppliedGiftCard | null;
}

function formatCents(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

export default function GiftCardApply({
  currentAmountCents,
  tenantId,
  onApply,
  onRemove,
  appliedCard,
}: GiftCardApplyProps) {
  const [code, setCode] = useState("");
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInput, setShowInput] = useState(false);

  const handleApply = async () => {
    if (!code.trim()) {
      setError("Please enter a gift card code");
      return;
    }

    setIsApplying(true);
    setError(null);

    try {
      const response = await apiRequest("POST", "/api/public/gift-cards/apply", {
        tenantId,
        giftCardCode: code.trim(),
        currentAmountCents,
      });
      
      const result: GiftCardApplicationResult = await response.json();

      if (!result.valid) {
        setError(result.error || "Invalid gift card");
        return;
      }

      onApply({
        giftCardId: result.giftCardId!,
        referenceCode: result.referenceCode!,
        appliedCents: result.appliedCents!,
        remainingBalanceCents: result.remainingCardBalanceCents!,
        currency: result.currency || "USD",
      });

      setCode("");
      setShowInput(false);
    } catch (err: any) {
      setError(err.message || "Failed to apply gift card");
    } finally {
      setIsApplying(false);
    }
  };

  const handleRemove = () => {
    onRemove();
    setCode("");
    setError(null);
  };

  if (appliedCard) {
    return (
      <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950" data-testid="card-gift-card-applied">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-green-100 dark:bg-green-900 p-2 rounded-full">
                <Gift className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <div className="font-medium flex items-center gap-2" data-testid="text-applied-card">
                  Gift Card Applied
                  <Badge variant="secondary" data-testid="badge-card-code">****{appliedCard.referenceCode}</Badge>
                </div>
                <div className="text-sm text-muted-foreground" data-testid="text-applied-amount">
                  {formatCents(appliedCard.appliedCents, appliedCard.currency)} applied
                  {appliedCard.remainingBalanceCents > 0 && (
                    <span className="ml-2">
                      ({formatCents(appliedCard.remainingBalanceCents, appliedCard.currency)} remaining on card)
                    </span>
                  )}
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
              data-testid="button-remove-gift-card"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!showInput) {
    return (
      <Button
        variant="outline"
        onClick={() => setShowInput(true)}
        className="w-full"
        data-testid="button-have-gift-card"
      >
        <Gift className="mr-2 h-4 w-4" />
        I have a gift card
      </Button>
    );
  }

  return (
    <Card data-testid="card-gift-card-input">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Gift className="h-5 w-5" />
          Apply Gift Card
        </CardTitle>
        <CardDescription>
          Enter your gift card number to apply it to this booking
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <div className="flex-1">
            <Label htmlFor="gift-card-code" className="sr-only">Gift Card Code</Label>
            <Input
              id="gift-card-code"
              placeholder="Enter last 4 digits"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && handleApply()}
              maxLength={10}
              data-testid="input-gift-card-code"
            />
          </div>
          <Button
            onClick={handleApply}
            disabled={isApplying || !code.trim()}
            data-testid="button-apply-gift-card"
          >
            {isApplying ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Apply
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setShowInput(false);
              setCode("");
              setError(null);
            }}
            data-testid="button-cancel-gift-card"
          >
            Cancel
          </Button>
        </div>

        {error && (
          <Alert variant="destructive" data-testid="alert-gift-card-error">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <p className="text-xs text-muted-foreground">
          You can redeem Clean Machine gift cards at checkout.
        </p>
      </CardContent>
    </Card>
  );
}
