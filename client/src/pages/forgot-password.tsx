import { useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Mail, ArrowLeft } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (data.success) {
        setEmailSent(true);
        toast({ 
          title: 'Reset link sent', 
          description: 'Check your email for password reset instructions' 
        });
      } else {
        toast({ 
          title: 'Error', 
          description: data.message || 'Failed to send reset link',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({ 
        title: 'Error', 
        description: 'Failed to process request',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Mail className="h-12 w-12 text-blue-600" />
          </div>
          <CardTitle className="text-2xl">Forgot Password</CardTitle>
          <CardDescription>
            {emailSent 
              ? 'Check your email for reset instructions'
              : 'Enter your email to receive a password reset link'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!emailSent ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="your@email.com"
                  data-testid="input-email"
                />
              </div>
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading}
                data-testid="button-submit"
              >
                {isLoading ? 'Sending...' : 'Send Reset Link'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setLocation('/login')}
                data-testid="button-back-to-login"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Login
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-center text-muted-foreground">
                If an account exists with that email, you'll receive reset instructions shortly.
              </p>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setLocation('/login')}
                data-testid="button-return-to-login"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Return to Login
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
