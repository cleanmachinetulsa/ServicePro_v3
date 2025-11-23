
import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Lock, Fingerprint } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isBiometricAvailable, setIsBiometricAvailable] = useState(false);
  const [isBiometricLoading, setIsBiometricLoading] = useState(false);
  
  // 2FA state
  const [requires2FA, setRequires2FA] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [is2FALoading, setIs2FALoading] = useState(false);

  useEffect(() => {
    // Check if WebAuthn is supported
    if (window.PublicKeyCredential) {
      setIsBiometricAvailable(true);
    }
    
    // Check for OAuth/auth errors in URL
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');
    
    if (error === 'token_expired') {
      toast({
        variant: "destructive",
        title: "Session Expired",
        description: "Your session has expired. Please log in again.",
      });
    } else if (error === 'oauth_failed') {
      toast({
        variant: "destructive",
        title: "Google Sign-In Failed",
        description: "Unable to sign in with Google. Please try again or use username/password.",
      });
    } else if (error === 'account_inactive') {
      toast({
        variant: "destructive",
        title: "Account Pending Approval",
        description: "Your account has been created but is awaiting admin approval. Please contact your administrator.",
      });
    }
  }, [toast]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        credentials: 'include', // CRITICAL: Allow cookies to be sent/received
      });

      const data = await response.json();

      if (data.success) {
        // Login complete (no 2FA required)
        toast({ title: 'Login successful', description: 'Welcome back!' });
        
        // Dismiss mobile keyboard
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        
        setTimeout(() => {
          setLocation('/launch');
        }, 100);
      } else if (data.requires2FA) {
        // Password verified, now need 2FA code
        setRequires2FA(true);
        
        // Dismiss mobile keyboard
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        
        toast({ 
          title: '2FA Required', 
          description: 'Enter the code from your authenticator app',
        });
      } else {
        // Login failed
        toast({ 
          title: 'Login failed', 
          description: data.message || 'Invalid credentials',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({ 
        title: 'Error', 
        description: 'Failed to login',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!twoFactorCode || twoFactorCode.length !== 6) {
      toast({
        title: 'Invalid code',
        description: 'Please enter a 6-digit code',
        variant: 'destructive'
      });
      return;
    }

    setIs2FALoading(true);

    try {
      const response = await fetch('/api/auth/login/verify-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: twoFactorCode }),
        credentials: 'include',
      });

      const data = await response.json();

      if (data.success) {
        toast({ title: 'Verification successful', description: 'Welcome back!' });
        
        // Dismiss mobile keyboard
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        
        setTimeout(() => {
          setLocation('/launch');
        }, 100);
      } else {
        toast({ 
          title: 'Verification failed', 
          description: data.message || 'Invalid code',
          variant: 'destructive'
        });
        
        if (data.expired || data.locked) {
          // Session expired or locked, reset to password entry
          setRequires2FA(false);
          setTwoFactorCode('');
          setPassword('');
        }
      }
    } catch (error) {
      toast({ 
        title: 'Error', 
        description: 'Failed to verify code',
        variant: 'destructive'
      });
    } finally {
      setIs2FALoading(false);
    }
  };

  // Base64URL decode helper (WebAuthn uses Base64URL, not standard Base64)
  const base64UrlDecode = (base64url: string): Uint8Array => {
    // Replace URL-safe characters
    let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    
    // Add padding if necessary
    const padding = base64.length % 4;
    if (padding === 2) {
      base64 += '==';
    } else if (padding === 3) {
      base64 += '=';
    }
    
    const rawData = atob(base64);
    return Uint8Array.from(rawData, c => c.charCodeAt(0));
  };

  // Base64URL encode helper
  const base64UrlEncode = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  };

  const handleBiometricLogin = async () => {
    setIsBiometricLoading(true);

    try {
      // Get authentication options from server (TRUE PASSWORDLESS - no username required)
      const optionsResponse = await fetch('/api/webauthn/authenticate/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}), // No username - authenticator will discover credentials
      });

      if (!optionsResponse.ok) {
        throw new Error('Failed to get authentication options');
      }

      const data = await optionsResponse.json();
      
      // Extract options from API response
      const options = data.options;

      // Build credential request options
      const credentialRequestOptions: any = {
        challenge: base64UrlDecode(options.challenge),
        timeout: 60000,
        rpId: options.rpId,
        userVerification: options.userVerification || 'required',
      };

      // If server sent allowCredentials (legacy flow), include them
      if (options.allowCredentials && options.allowCredentials.length > 0) {
        credentialRequestOptions.allowCredentials = options.allowCredentials.map((cred: any) => ({
          ...cred,
          id: base64UrlDecode(cred.id),
        }));
      }

      // Use WebAuthn to authenticate (passwordless with resident key discovery)
      const credential = await navigator.credentials.get({
        publicKey: credentialRequestOptions,
      }) as PublicKeyCredential;

      if (!credential) {
        throw new Error('Authentication cancelled');
      }

      // Send credential to server for verification with Base64URL encoding
      const response = credential.response as AuthenticatorAssertionResponse;
      const verifyResponse = await fetch('/api/webauthn/authenticate/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          id: base64UrlEncode(credential.rawId),
          response: {
            authenticatorData: base64UrlEncode(response.authenticatorData),
            clientDataJSON: base64UrlEncode(response.clientDataJSON),
            signature: base64UrlEncode(response.signature),
            userHandle: response.userHandle ? base64UrlEncode(response.userHandle) : null,
          },
        }),
      });

      const verifyData = await verifyResponse.json();

      if (verifyData.success) {
        toast({ 
          title: 'Biometric login successful', 
          description: 'Welcome back!' 
        });
        
        // Dismiss mobile keyboard
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        
        setTimeout(() => {
          setLocation('/launch');
        }, 100);
      } else {
        toast({ 
          title: 'Biometric login failed', 
          description: verifyData.message || 'Authentication failed',
          variant: 'destructive'
        });
      }
    } catch (error: any) {
      console.error('Biometric login error:', error);
      toast({ 
        title: 'Biometric login failed', 
        description: error.message || 'Please try again or use password',
        variant: 'destructive'
      });
    } finally {
      setIsBiometricLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 p-4 relative z-50">
      <Card className="w-full max-w-md relative z-10">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Lock className="h-12 w-12 text-blue-600" />
          </div>
          <CardTitle className="text-2xl">Admin Login</CardTitle>
          <CardDescription>
            Sign in to access the admin dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!requires2FA ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  data-testid="input-username"
                />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  data-testid="input-password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-login">
                {isLoading ? 'Signing in...' : 'Sign In'}
              </Button>
              <div className="text-center">
                <Button
                  type="button"
                  variant="link"
                  className="text-sm text-blue-600"
                  onClick={() => setLocation('/forgot-password')}
                  data-testid="link-forgot-password"
                >
                  Forgot your password?
                </Button>
              </div>
              
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <Separator className="w-full" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-gray-500">Or continue with</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full flex items-center justify-center gap-2 hover:bg-gray-50"
                onClick={() => window.location.href = '/api/auth/google'}
                data-testid="button-login-google"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Sign in with Google
              </Button>

              <div className="text-center text-sm mt-4 pt-4 border-t border-gray-200">
                <span className="text-gray-600">New to ServicePro? </span>
                <Button
                  type="button"
                  variant="link"
                  className="text-blue-600 font-medium p-0 h-auto"
                  onClick={() => setLocation('/onboarding/industry')}
                  data-testid="link-get-started"
                >
                  Get started
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleVerify2FA} className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  Enter the 6-digit code from your authenticator app
                </p>
              </div>
              
              <div>
                <Label htmlFor="2fa-code">Verification Code</Label>
                <Input
                  id="2fa-code"
                  type="text"
                  maxLength={6}
                  placeholder="000000"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
                  required
                  autoFocus
                  className="text-center text-2xl tracking-widest"
                  data-testid="input-2fa-code"
                />
              </div>
              
              <Button type="submit" className="w-full" disabled={is2FALoading || twoFactorCode.length !== 6} data-testid="button-verify-2fa">
                {is2FALoading ? 'Verifying...' : 'Verify'}
              </Button>

              <div className="text-center">
                <Button
                  type="button"
                  variant="link"
                  className="text-sm text-slate-600"
                  onClick={() => {
                    setRequires2FA(false);
                    setTwoFactorCode('');
                    setPassword('');
                  }}
                  data-testid="button-back-to-login"
                >
                  Back to login
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
