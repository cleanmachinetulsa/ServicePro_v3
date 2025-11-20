import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { XCircle, Phone } from 'lucide-react';

export default function DepositPaymentCancelled() {
  const [, setLocation] = useLocation();
  const [authToken, setAuthToken] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('auth');
    if (token) {
      setAuthToken(token);
    }
  }, []);

  const handleRetryPayment = () => {
    if (authToken) {
      setLocation(`/payer-approval/${authToken}`);
    } else {
      setLocation('/');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-yellow-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 text-center">
        <XCircle className="w-16 h-16 text-orange-600 mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Payment Cancelled</h1>
        <p className="text-muted-foreground mb-6">
          Your payment was cancelled. No charges have been made to your card.
        </p>
        
        <div className="space-y-3 mb-6">
          {authToken && (
            <Button onClick={handleRetryPayment} className="w-full" data-testid="button-retry-payment">
              Try Payment Again
            </Button>
          )}
          <Button onClick={() => setLocation('/')} variant="outline" className="w-full" data-testid="button-home">
            Return Home
          </Button>
        </div>

        <div className="pt-6 border-t">
          <p className="text-sm text-muted-foreground mb-3">
            Prefer to pay another way?
          </p>
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => window.location.href = 'tel:918-856-5304'}
            data-testid="button-call"
          >
            <Phone className="w-4 h-4 mr-2" />
            Call Us: 918-856-5304
          </Button>
        </div>
      </Card>
    </div>
  );
}
