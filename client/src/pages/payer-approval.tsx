/**
 * Public Payer Approval Page
 * 
 * Mobile-optimized page for payers to review and approve third-party billing jobs.
 * Features:
 * - OTP security with token validation
 * - Job details display with privacy-aware pricing
 * - Approve/Decline actions
 * - Integrated Stripe payment link for deposits
 * - Mobile-first responsive design
 * - Gift mode support
 */

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  Car,
  DollarSign,
  AlertCircle,
  User,
  Calendar,
  Sparkles,
  Gift,
} from "lucide-react";
import { format } from "date-fns";

interface ApprovalData {
  authorization: {
    id: number;
    token: string;
    expiresAt: string;
    status: 'pending' | 'approved' | 'declined' | 'expired';
  };
  appointment: {
    id: number;
    serviceName: string;
    scheduledTime: string;
    estimatedPrice?: number;
    depositPercent?: number;
    depositAmount?: number;
    address: string;
    isGift?: boolean;
    giftMessage?: string;
    vehicleDesc?: string;
  };
  serviceContact: {
    name: string;
    phone: string;
  };
  payer: {
    name: string;
    phone: string;
  };
  businessName: string;
  businessPhone: string;
}

export default function PayerApprovalPage() {
  const [, params] = useRoute('/approve/:token');
  const [, navigate] = useLocation();
  const token = params?.token || '';
  
  const [otp, setOtp] = useState('');
  const [isOtpVerified, setIsOtpVerified] = useState(false);
  const [declineReason, setDeclineReason] = useState('');

  // Fetch approval data
  const { data, isLoading, error } = useQuery<ApprovalData>({
    queryKey: ['/api/payer-approval', token],
    queryFn: async () => {
      const response = await fetch(`/api/payer-approval/${token}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch approval data');
      }
      return response.json();
    },
    enabled: !!token && token.length > 10,
    retry: false,
  });

  // Verify OTP mutation
  const verifyOtpMutation = useMutation({
    mutationFn: async (otpCode: string) => {
      const response = await apiRequest('POST', `/api/payer-approval/${token}/verify-otp`, {
        otp: otpCode,
      });
      return response.json();
    },
    onSuccess: () => {
      setIsOtpVerified(true);
    },
    onError: (error: any) => {
      alert(error.message || 'Invalid OTP code. Please try again.');
    },
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/payer-approval/${token}/approve`, {
        ipAddress: window.location.hostname,
        userAgent: navigator.userAgent,
      });
      return response.json();
    },
    onSuccess: (data) => {
      // If there's a deposit payment link, redirect to it
      if (data.paymentLink) {
        window.location.href = data.paymentLink;
      }
    },
    onError: (error: any) => {
      alert(error.message || 'Failed to approve. Please try again.');
    },
  });

  // Decline mutation
  const declineMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/payer-approval/${token}/decline`, {
        reason: declineReason,
        ipAddress: window.location.hostname,
        userAgent: navigator.userAgent,
      });
      return response.json();
    },
    onSuccess: () => {
      // Show success message
    },
    onError: (error: any) => {
      alert(error.message || 'Failed to decline. Please try again.');
    },
  });

  const handleVerifyOtp = () => {
    if (!otp || otp.length < 4) {
      alert('Please enter a valid OTP code');
      return;
    }
    verifyOtpMutation.mutate(otp);
  };

  const handleApprove = () => {
    approveMutation.mutate();
  };

  const handleDecline = () => {
    if (!declineReason.trim()) {
      alert('Please provide a reason for declining');
      return;
    }
    declineMutation.mutate();
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading approval details...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-6 w-6 text-destructive" />
              <CardTitle>Invalid or Expired Link</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertDescription>
                {(error as Error)?.message || 'This approval link is invalid or has expired. Please contact the business for a new link.'}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { authorization, appointment, serviceContact, payer, businessName, businessPhone } = data;

  // Already processed states
  if (authorization.status === 'approved') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
              <CardTitle>Already Approved</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                This job has already been approved. Thank you!
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (authorization.status === 'declined') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <XCircle className="h-6 w-6 text-destructive" />
              <CardTitle>Previously Declined</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <Alert>
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                This job has been declined. If you'd like to reconsider, please contact {businessName} at {businessPhone}.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if expired
  const isExpired = new Date(authorization.expiresAt) < new Date();
  if (isExpired) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-yellow-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-6 w-6 text-orange-600" />
              <CardTitle>Link Expired</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This approval link expired on {format(new Date(authorization.expiresAt), 'PPp')}. 
                Please contact {businessName} at {businessPhone} for a new approval link.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  // OTP Verification Screen (if not verified yet)
  if (!isOtpVerified) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl">Verify Your Identity</CardTitle>
            <CardDescription>
              We sent a security code to {payer.phone}. Please enter it below to continue.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="otp">Security Code</Label>
              <Input
                id="otp"
                type="text"
                placeholder="Enter 6-digit code"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                className="text-center text-2xl tracking-widest"
                data-testid="input-otp"
              />
            </div>
            <Button 
              onClick={handleVerifyOtp}
              className="w-full"
              disabled={verifyOtpMutation.isPending || otp.length < 4}
              data-testid="button-verify-otp"
            >
              {verifyOtpMutation.isPending ? 'Verifying...' : 'Verify Code'}
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Didn't receive a code? Check your spam folder or contact {businessName}.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main Approval Screen
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800 p-4">
      <div className="max-w-2xl mx-auto space-y-6 py-8">
        {/* Header */}
        <Card className="border-2 border-primary">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              {appointment.isGift ? (
                <Gift className="h-8 w-8 text-pink-600" />
              ) : (
                <Sparkles className="h-8 w-8 text-primary" />
              )}
            </div>
            <CardTitle className="text-2xl">
              {appointment.isGift ? 'Gift Service Approval' : 'Payment Approval Request'}
            </CardTitle>
            <CardDescription>
              From {businessName}
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Gift Message */}
        {appointment.isGift && appointment.giftMessage && (
          <Card className="bg-pink-50 border-pink-200 dark:bg-pink-900/20 dark:border-pink-800">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Gift className="h-5 w-5" />
                Gift Message
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm italic">{appointment.giftMessage}</p>
            </CardContent>
          </Card>
        )}

        {/* Service Details */}
        <Card>
          <CardHeader>
            <CardTitle>Service Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <Car className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Service</p>
                  <p className="font-medium">{appointment.serviceName}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Scheduled</p>
                  <p className="font-medium">{format(new Date(appointment.scheduledTime), 'PPp')}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Location</p>
                  <p className="font-medium">{appointment.address}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Service Contact</p>
                  <p className="font-medium">{serviceContact.name}</p>
                  <p className="text-sm text-muted-foreground">{serviceContact.phone}</p>
                </div>
              </div>

              {appointment.vehicleDesc && (
                <div className="flex items-start gap-3 col-span-full">
                  <Car className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Vehicle</p>
                    <p className="font-medium">{appointment.vehicleDesc}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Pricing Details */}
        {appointment.estimatedPrice && !appointment.isGift && (
          <Card>
            <CardHeader>
              <CardTitle>Payment Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Estimated Total</span>
                <span className="text-2xl font-bold">${appointment.estimatedPrice.toFixed(2)}</span>
              </div>

              {appointment.depositPercent && appointment.depositAmount && (
                <>
                  <Separator />
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">Deposit Required ({appointment.depositPercent}%)</span>
                      <span className="text-xl font-bold text-blue-600">${appointment.depositAmount.toFixed(2)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Deposit secures your appointment. Balance due upon completion.
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Button
            size="lg"
            onClick={handleApprove}
            disabled={approveMutation.isPending}
            className="h-16 text-lg"
            data-testid="button-approve"
          >
            {approveMutation.isPending ? (
              'Processing...'
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-5 w-5" />
                Approve & {appointment.depositAmount ? 'Pay Deposit' : 'Continue'}
              </>
            )}
          </Button>

          <Button
            size="lg"
            variant="destructive"
            onClick={() => {
              const reason = prompt('Why are you declining? (Optional)');
              if (reason !== null) {
                setDeclineReason(reason || 'No reason provided');
                handleDecline();
              }
            }}
            disabled={declineMutation.isPending}
            className="h-16 text-lg"
            data-testid="button-decline"
          >
            {declineMutation.isPending ? (
              'Processing...'
            ) : (
              <>
                <XCircle className="mr-2 h-5 w-5" />
                Decline
              </>
            )}
          </Button>
        </div>

        {/* Footer Info */}
        <Card className="bg-muted/50">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="text-sm text-muted-foreground space-y-1">
                <p>
                  <strong>What happens next?</strong>
                </p>
                <p>
                  If you approve, {appointment.depositAmount ? "you'll be redirected to securely pay the deposit" : "we'll confirm your appointment"}. 
                  You'll receive a confirmation via text message.
                </p>
                <p className="mt-2">
                  Questions? Contact {businessName} at {businessPhone}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
