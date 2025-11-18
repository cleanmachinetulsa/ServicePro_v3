import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Loader2 } from 'lucide-react';

interface PaymentStatus {
  success: boolean;
  paymentStatus: string;
  status: string;
  error?: string;
}

export default function DepositPaymentSuccess() {
  const [, setLocation] = useLocation();
  const [verifying, setVerifying] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    const authToken = params.get('auth');

    if (!sessionId || !authToken) {
      setError('Invalid payment link');
      setVerifying(false);
      return;
    }

    // Verify payment completion with backend before showing success
    const verifyPayment = async () => {
      try {
        const response = await fetch(`/api/payer-approval/verify-payment/${sessionId}`);
        const data: PaymentStatus = await response.json();

        if (!response.ok || !data.success) {
          setError(data.error || 'Payment verification failed');
          setVerifying(false);
          return;
        }

        // Check if payment is actually completed (BOTH conditions must be true)
        if (data.paymentStatus !== 'paid' || data.status !== 'complete') {
          setError(`Payment not completed (Status: ${data.status}, Payment: ${data.paymentStatus}). Please contact us if you were charged.`);
          setVerifying(false);
          return;
        }

        // Payment verified successfully - BOTH conditions met
        setVerifying(false);
      } catch (err) {
        console.error('Payment verification error:', err);
        setError('Unable to verify payment. Please contact us if you were charged.');
        setVerifying(false);
      }
    };

    // Poll for payment status (webhooks may take a few seconds)
    let attempts = 0;
    const maxAttempts = 5;
    const pollInterval = setInterval(() => {
      attempts++;
      verifyPayment();

      if (attempts >= maxAttempts) {
        clearInterval(pollInterval);
      }
    }, 2000); // Check every 2 seconds, up to 10 seconds total

    // Cleanup interval on unmount
    return () => clearInterval(pollInterval);
  }, []);

  if (verifying) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center">
          <Loader2 className="w-16 h-16 text-green-600 mx-auto mb-4 animate-spin" />
          <h1 className="text-2xl font-bold mb-2">Processing Payment...</h1>
          <p className="text-muted-foreground">
            Please wait while we confirm your payment
          </p>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full mx-auto mb-4 flex items-center justify-center">
            <span className="text-3xl">⚠️</span>
          </div>
          <h1 className="text-2xl font-bold mb-2">Payment Error</h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Button onClick={() => setLocation('/')} variant="outline">
            Return Home
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 text-center">
        <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Payment Successful!</h1>
        <p className="text-muted-foreground mb-6">
          Your deposit has been processed successfully. You will receive a confirmation SMS shortly.
        </p>
        <div className="space-y-3">
          <Button onClick={() => setLocation('/')} className="w-full" data-testid="button-home">
            Return Home
          </Button>
          <Button onClick={() => setLocation('/book')} variant="outline" className="w-full" data-testid="button-book-another">
            Book Another Service
          </Button>
        </div>
      </Card>
    </div>
  );
}
