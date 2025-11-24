import { useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Loader2, Phone, KeyRound } from 'lucide-react';
import { InstallPromptBanner } from '@/components/PwaComponents';

export default function CustomerLogin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [maskedPhone, setMaskedPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!phone.trim()) {
      toast({
        title: 'Phone Required',
        description: 'Please enter your phone number',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const res = await apiRequest(
        'POST',
        '/api/public/customer-auth/request-otp',
        {
          channel: 'sms',
          phone: phone.trim(),
        }
      );

      const response = await res.json() as {
        success: boolean;
        maskedDestination?: string;
        message?: string;
        error?: string;
        reason?: string;
      };

      if (response.success && response.maskedDestination) {
        setMaskedPhone(response.maskedDestination);
        setStep('code');
        toast({
          title: 'Code Sent',
          description: `Verification code sent to ${response.maskedDestination}`,
        });
      } else {
        toast({
          title: 'Error',
          description: response.error || 'Failed to send verification code',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Request OTP error:', error);
      toast({
        title: 'Error',
        description: 'Failed to send verification code. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!code.trim() || code.length !== 6) {
      toast({
        title: 'Invalid Code',
        description: 'Please enter the 6-digit verification code',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const res = await apiRequest(
        'POST',
        '/api/public/customer-auth/verify-otp',
        {
          channel: 'sms',
          phone: phone.trim(),
          code: code.trim(),
        }
      );

      const response = await res.json() as {
        success: boolean;
        customerId?: number;
        expiresAt?: string;
        message?: string;
        error?: string;
        reason?: string;
      };

      if (response.success) {
        toast({
          title: 'Success',
          description: 'You are now logged in',
        });
        // Redirect to customer portal
        setLocation('/portal');
      } else {
        toast({
          title: 'Verification Failed',
          description: response.error || 'Invalid or expired code',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Verify OTP error:', error);
      toast({
        title: 'Error',
        description: 'Failed to verify code. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToPhone = () => {
    setStep('phone');
    setCode('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <InstallPromptBanner />
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">
            Customer Portal
          </CardTitle>
          <CardDescription className="text-center">
            {step === 'phone' 
              ? 'Enter your phone number to log in'
              : `Enter the code sent to ${maskedPhone}`
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 'phone' ? (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="(918) 555-1234"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="pl-10"
                    disabled={isLoading}
                    data-testid="input-customer-phone"
                  />
                </div>
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
                data-testid="button-send-code"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending Code...
                  </>
                ) : (
                  'Send Verification Code'
                )}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Verification Code</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="000000"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    className="pl-10 text-center text-2xl tracking-widest font-mono"
                    disabled={isLoading}
                    autoFocus
                    data-testid="input-otp-code"
                  />
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  Code expires in 10 minutes
                </p>
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || code.length !== 6}
                data-testid="button-verify-code"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Verify & Log In'
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={handleBackToPhone}
                disabled={isLoading}
                data-testid="button-back"
              >
                Use Different Phone Number
              </Button>
              <Button
                type="button"
                variant="link"
                className="w-full text-sm"
                onClick={handleRequestOtp}
                disabled={isLoading}
                data-testid="button-resend"
              >
                Resend Code
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
