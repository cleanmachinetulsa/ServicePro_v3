import { useEffect, useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Gift, Users, Calendar, Star, Sparkles, ArrowRight, CheckCircle2 } from 'lucide-react';

interface ReferralValidation {
  valid: boolean;
  message: string;
  referral?: {
    id: number;
    referralCode: string;
    referrerId: number;
    status: string;
  };
  referrerName?: string;
  businessName?: string;
}

export default function ReferralLanding() {
  const params = useParams();
  const code = params.code as string;
  const [, setLocation] = useLocation();
  const [isRedirecting, setIsRedirecting] = useState(false);

  const { data, isLoading, error } = useQuery<ReferralValidation>({
    queryKey: ['/api/referral/landing', code],
    queryFn: async () => {
      const response = await fetch(`/api/referral/landing/${encodeURIComponent(code)}`);
      if (!response.ok) throw new Error('Failed to validate referral');
      return response.json();
    },
    enabled: !!code,
    retry: false,
  });

  const handleBookNow = () => {
    setIsRedirecting(true);
    const referralData = {
      code,
      businessName: data?.businessName,
      savedAt: Date.now(),
      expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days expiry
    };
    localStorage.setItem('referralData', JSON.stringify(referralData));
    setLocation('/portal/welcome');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="text-center" data-testid="loading-spinner">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading referral...</p>
        </div>
      </div>
    );
  }

  if (error || !data?.valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4">
        <Card className="max-w-md w-full" data-testid="referral-error">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
              <Users className="h-8 w-8 text-red-600" />
            </div>
            <CardTitle className="text-xl">Invalid Referral Link</CardTitle>
            <CardDescription>
              {data?.message || "This referral code is invalid or has expired."}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button 
              onClick={() => setLocation('/')}
              data-testid="button-go-home"
            >
              Visit Our Website
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const referrerFirstName = data.referrerName?.split(' ')[0] || 'Your friend';
  const businessName = data.businessName || 'Our Business';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4">
      <div className="max-w-lg mx-auto pt-8 pb-12" data-testid="referral-landing-page">
        <div className="text-center mb-8">
          <Badge variant="secondary" className="mb-4 px-4 py-1" data-testid="badge-special-invite">
            <Sparkles className="h-3 w-3 mr-1" />
            Special Invitation
          </Badge>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2" data-testid="text-business-name">
            {businessName}
          </h1>
        </div>

        <Card className="mb-6 border-2 border-blue-200 dark:border-blue-900 shadow-lg" data-testid="card-referral-invite">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-4 shadow-lg">
              <Gift className="h-10 w-10 text-white" />
            </div>
            <CardTitle className="text-2xl" data-testid="text-invite-message">
              {referrerFirstName} invited you!
            </CardTitle>
            <CardDescription className="text-base mt-2">
              You've been personally referred by someone who loves our service
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl p-6 text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Your Welcome Bonus</p>
              <div className="flex items-center justify-center gap-2">
                <Star className="h-6 w-6 text-yellow-500" />
                <span className="text-3xl font-bold text-gray-900 dark:text-white" data-testid="text-bonus-amount">
                  $25 OFF
                </span>
                <Star className="h-6 w-6 text-yellow-500" />
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                Your first service
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
                <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                <span className="text-sm">Instant discount applied at checkout</span>
              </div>
              <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
                <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                <span className="text-sm">No minimum purchase required</span>
              </div>
              <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
                <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                <span className="text-sm">{referrerFirstName} also earns rewards when you book</span>
              </div>
            </div>

            <Button 
              className="w-full h-14 text-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              onClick={handleBookNow}
              disabled={isRedirecting}
              data-testid="button-book-now"
            >
              {isRedirecting ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Redirecting...
                </>
              ) : (
                <>
                  <Calendar className="h-5 w-5 mr-2" />
                  Book Now & Save
                  <ArrowRight className="h-5 w-5 ml-2" />
                </>
              )}
            </Button>

            <p className="text-xs text-center text-gray-500 dark:text-gray-400">
              Referral code: <span className="font-mono font-medium" data-testid="text-referral-code">{code}</span>
            </p>
          </CardContent>
        </Card>

        <div className="text-center text-sm text-gray-500 dark:text-gray-400">
          <p>Questions? Contact us anytime.</p>
        </div>
      </div>
    </div>
  );
}
