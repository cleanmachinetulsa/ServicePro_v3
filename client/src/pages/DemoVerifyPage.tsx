import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, Phone, ArrowRight, RefreshCw } from 'lucide-react';
import { useLocation } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export default function DemoVerifyPage() {
  const [, setLocation] = useLocation();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const { toast } = useToast();

  const demoSessionToken = sessionStorage.getItem('demoSessionToken');

  useEffect(() => {
    if (!demoSessionToken) {
      setLocation('/demo');
    }
  }, [demoSessionToken, setLocation]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value);
    setPhone(formatted);
  };

  const getE164Phone = () => {
    const digits = phone.replace(/\D/g, '');
    return `+1${digits}`;
  };

  const handleSendCode = async () => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length !== 10) {
      toast({
        title: 'Invalid Phone Number',
        description: 'Please enter a valid 10-digit phone number.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const res = await apiRequest('POST', '/api/demo/send-code', {
        demoSessionToken,
        phone: getE164Phone(),
      });
      const response = await res.json();

      if (response.success) {
        setStep('code');
        setCountdown(60);
        toast({
          title: 'Code Sent',
          description: 'Check your phone for the verification code.',
        });
      } else {
        throw new Error(response.error || 'Failed to send code');
      }
    } catch (error) {
      console.error('Failed to send code:', error);
      toast({
        title: 'Error',
        description: 'Failed to send verification code. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (code.length !== 6) {
      toast({
        title: 'Invalid Code',
        description: 'Please enter the 6-digit verification code.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const res = await apiRequest('POST', '/api/demo/verify-code', {
        demoSessionToken,
        phone: getE164Phone(),
        code,
      });
      const response = await res.json();

      if (response.success) {
        if (response.newToken) {
          sessionStorage.setItem('demoSessionToken', response.newToken);
        }
        sessionStorage.setItem('demoVerified', 'true');
        sessionStorage.setItem('demoPhone', getE164Phone());
        toast({
          title: 'Verified!',
          description: 'Welcome to the demo. Enjoy exploring!',
        });
        setLocation('/demo/dashboard');
      } else {
        throw new Error(response.error || 'Failed to verify code');
      }
    } catch (error) {
      console.error('Failed to verify code:', error);
      toast({
        title: 'Verification Failed',
        description: error instanceof Error ? error.message : 'Invalid code. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-slate-800/50 border-slate-700 backdrop-blur">
        <CardHeader className="text-center">
          <Badge variant="secondary" className="mx-auto mb-4 bg-blue-500/20 text-blue-300 border-blue-500/30">
            <Shield className="w-3 h-3 mr-1" /> Demo Verification
          </Badge>
          <CardTitle className="text-2xl text-white">
            {step === 'phone' ? 'Verify Your Phone' : 'Enter Verification Code'}
          </CardTitle>
          <CardDescription className="text-slate-400">
            {step === 'phone' 
              ? 'We\'ll send a one-time code to verify you\'re human.'
              : 'Enter the 6-digit code we sent to your phone.'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 'phone' ? (
            <div className="space-y-4">
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={phone}
                  onChange={handlePhoneChange}
                  className="pl-10 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                  data-testid="input-demo-phone"
                />
              </div>
              <Button
                onClick={handleSendCode}
                disabled={isLoading || phone.replace(/\D/g, '').length !== 10}
                className="w-full bg-blue-600 hover:bg-blue-700"
                data-testid="button-send-code"
              >
                {isLoading ? 'Sending...' : (
                  <>
                    Send Code
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <Input
                type="text"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                className="text-center text-2xl tracking-widest bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                data-testid="input-verification-code"
              />
              <Button
                onClick={handleVerifyCode}
                disabled={isLoading || code.length !== 6}
                className="w-full bg-blue-600 hover:bg-blue-700"
                data-testid="button-verify-code"
              >
                {isLoading ? 'Verifying...' : 'Verify & Continue'}
              </Button>
              <div className="text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSendCode}
                  disabled={countdown > 0 || isLoading}
                  className="text-slate-400 hover:text-white"
                  data-testid="button-resend-code"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  {countdown > 0 ? `Resend in ${countdown}s` : 'Resend Code'}
                </Button>
              </div>
              <Button
                variant="link"
                onClick={() => setStep('phone')}
                className="w-full text-slate-400"
                data-testid="button-change-phone"
              >
                Use a different number
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
