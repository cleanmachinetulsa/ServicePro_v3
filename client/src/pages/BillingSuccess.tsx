import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle } from 'lucide-react';

export default function BillingSuccess() {
  const [, setLocation] = useLocation();

  // Redirect to billing page after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setLocation('/billing');
    }, 5000);

    return () => clearTimeout(timer);
  }, [setLocation]);

  return (
    <div className="container max-w-2xl mx-auto py-16 px-4">
      <Card className="text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <CardTitle className="text-3xl">Subscription Activated!</CardTitle>
          <CardDescription className="text-lg mt-2">
            Your plan upgrade has been processed successfully
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2 text-muted-foreground">
            <p>
              Thank you for upgrading! Your new features are now active and ready to use.
            </p>
            <p className="text-sm">
              You'll receive a confirmation email with your invoice shortly.
            </p>
          </div>

          <div className="flex gap-3 justify-center pt-4">
            <Button
              onClick={() => setLocation('/billing')}
              variant="default"
              data-testid="button-view-billing"
            >
              View Billing Details
            </Button>
            <Button
              onClick={() => setLocation('/dashboard')}
              variant="outline"
              data-testid="button-go-dashboard"
            >
              Go to Dashboard
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Redirecting to billing page in 5 seconds...
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
