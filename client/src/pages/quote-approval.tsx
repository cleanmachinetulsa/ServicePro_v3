/**
 * Public Quote Approval Page
 * 
 * Mobile-optimized page for customers/third-party payers to review and approve specialty job quotes.
 * Features:
 * - OTP security with token validation
 * - Quote details display with photos
 * - Approve/Decline actions
 * - Mobile-first responsive design
 */

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute } from "wouter";
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
  DollarSign,
  AlertCircle,
  User,
  FileText,
  AlertTriangle,
  Phone,
  Image as ImageIcon,
} from "lucide-react";
import { format } from "date-fns";

interface QuoteApprovalData {
  quote: {
    id: number;
    customerName: string;
    phone: string;
    issueDescription: string;
    damageType: string;
    photoUrls: string[];
    customQuoteAmount: number;
    quoteNotes: string | null;
    status: 'pending_review' | 'quoted' | 'approved' | 'declined' | 'completed';
    thirdPartyPayerName: string | null;
    thirdPartyPayerEmail: string | null;
    thirdPartyPayerPhone: string | null;
    poNumber: string | null;
    createdAt: string;
  };
  approverType: 'customer' | 'third_party';
  businessName: string;
  businessPhone: string;
}

export default function QuoteApprovalPage() {
  const [, params] = useRoute('/quote-approval/:token');
  const token = params?.token || '';
  
  const [otp, setOtp] = useState('');
  const [isOtpVerified, setIsOtpVerified] = useState(false);
  const [declineReason, setDeclineReason] = useState('');

  // Fetch quote data
  const { data, isLoading, error } = useQuery<QuoteApprovalData>({
    queryKey: ['/api/quote-approval', token],
    queryFn: async () => {
      const response = await fetch(`/api/quote-approval/${token}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch quote data');
      }
      return response.json();
    },
    enabled: !!token && token.length > 10,
    retry: false,
  });

  // Verify OTP mutation
  const verifyOtpMutation = useMutation({
    mutationFn: async (otpCode: string) => {
      const response = await apiRequest('POST', `/api/quote-approval/${token}/verify-otp`, {
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
      const response = await apiRequest('POST', `/api/quote-approval/${token}/approve`, {
        otp,
        ipAddress: window.location.hostname,
        userAgent: navigator.userAgent,
      });
      return response.json();
    },
    onSuccess: () => {
      // Quote approved successfully
    },
    onError: (error: any) => {
      alert(error.message || 'Failed to approve quote. Please try again.');
    },
  });

  // Decline mutation
  const declineMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/quote-approval/${token}/decline`, {
        otp,
        reason: declineReason,
        ipAddress: window.location.hostname,
        userAgent: navigator.userAgent,
      });
      return response.json();
    },
    onSuccess: () => {
      // Quote declined successfully
    },
    onError: (error: any) => {
      alert(error.message || 'Failed to decline quote. Please try again.');
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
          <CardContent className="p-8">
            <div className="flex flex-col items-center gap-4">
              <Clock className="w-12 h-12 animate-spin text-blue-600" />
              <p className="text-center text-muted-foreground">Loading quote details...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-red-200">
          <CardContent className="p-8">
            <div className="flex flex-col items-center gap-4">
              <AlertCircle className="w-12 h-12 text-red-600" />
              <div className="text-center">
                <h2 className="text-xl font-semibold mb-2">Quote Not Found</h2>
                <p className="text-muted-foreground">
                  {error?.message || 'This quote link is invalid or has expired.'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Already processed states
  if (data.quote.status === 'approved') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-green-200">
          <CardContent className="p-8">
            <div className="flex flex-col items-center gap-4 text-center">
              <CheckCircle2 className="w-16 h-16 text-green-600" />
              <h2 className="text-2xl font-bold">Quote Already Approved</h2>
              <p className="text-muted-foreground">
                This quote was approved. The business will contact you to schedule the service.
              </p>
              <p className="text-sm text-muted-foreground mt-4">
                Questions? Call {data.businessName} at {data.businessPhone}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (data.quote.status === 'declined') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-red-200">
          <CardContent className="p-8">
            <div className="flex flex-col items-center gap-4 text-center">
              <XCircle className="w-16 h-16 text-red-600" />
              <h2 className="text-2xl font-bold">Quote Declined</h2>
              <p className="text-muted-foreground">
                This quote was previously declined.
              </p>
              <p className="text-sm text-muted-foreground mt-4">
                Questions? Call {data.businessName} at {data.businessPhone}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success states after approval/decline
  if (approveMutation.isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-green-200">
          <CardContent className="p-8">
            <div className="flex flex-col items-center gap-4 text-center">
              <CheckCircle2 className="w-16 h-16 text-green-600" />
              <h2 className="text-2xl font-bold">Quote Approved!</h2>
              <p className="text-muted-foreground">
                Thank you for approving the quote. {data.businessName} will contact you shortly to schedule the service.
              </p>
              <Separator className="my-4" />
              <div className="w-full text-left space-y-2">
                <p className="text-sm font-medium">Next Steps:</p>
                <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                  <li>You'll receive a call/text to schedule the appointment</li>
                  <li>Service will be completed as quoted</li>
                  <li>Payment will be collected as discussed</li>
                </ul>
              </div>
              <p className="text-sm text-muted-foreground mt-4">
                Questions? Call {data.businessName} at {data.businessPhone}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (declineMutation.isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-orange-200">
          <CardContent className="p-8">
            <div className="flex flex-col items-center gap-4 text-center">
              <AlertTriangle className="w-16 h-16 text-orange-600" />
              <h2 className="text-2xl font-bold">Quote Declined</h2>
              <p className="text-muted-foreground">
                Your feedback has been recorded. {data.businessName} may reach out to discuss alternatives.
              </p>
              <p className="text-sm text-muted-foreground mt-4">
                Questions? Call {data.businessName} at {data.businessPhone}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // OTP Verification Step
  if (!isOtpVerified) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <CardTitle className="text-2xl">Verify Your Identity</CardTitle>
            <CardDescription>
              We've sent a verification code to your phone/email
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="otp">Verification Code</Label>
              <Input
                id="otp"
                type="text"
                placeholder="Enter 6-digit code"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                maxLength={6}
                className="text-center text-2xl tracking-widest"
                data-testid="input-otp"
              />
            </div>

            <Button
              onClick={handleVerifyOtp}
              disabled={verifyOtpMutation.isPending || !otp || otp.length < 4}
              className="w-full"
              size="lg"
              data-testid="button-verify-otp"
            >
              {verifyOtpMutation.isPending ? 'Verifying...' : 'Verify Code'}
            </Button>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Didn't receive a code? It may take a few moments to arrive. 
                If you need help, call {data.businessName} at {data.businessPhone}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main Quote Approval View
  const quote = data.quote;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800 p-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mb-4">
              <DollarSign className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <CardTitle className="text-2xl">Specialty Job Quote</CardTitle>
            <CardDescription>
              Review the quote details and approve or decline
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Customer Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="w-5 h-5" />
              Customer Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Name</p>
              <p className="font-medium">{quote.customerName}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Phone</p>
              <p className="font-medium flex items-center gap-2">
                <Phone className="w-4 h-4" />
                {quote.phone}
              </p>
            </div>
            <Separator />
            <div>
              <p className="text-sm text-muted-foreground mb-1">Submitted</p>
              <p className="text-sm">{format(new Date(quote.createdAt), 'MMMM d, yyyy \'at\' h:mm a')}</p>
            </div>
          </CardContent>
        </Card>

        {/* Third-Party Payer Alert */}
        {quote.thirdPartyPayerName && (
          <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <AlertDescription>
              <p className="font-medium mb-1">Third-Party Billing</p>
              <p className="text-sm">
                This quote is being reviewed by: <strong>{quote.thirdPartyPayerName}</strong>
              </p>
              {quote.poNumber && (
                <p className="text-sm mt-1">PO Number: {quote.poNumber}</p>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Job Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Job Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Type of Damage</p>
              <Badge variant="outline" className="text-base px-3 py-1">
                {quote.damageType}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">Description</p>
              <p className="text-sm bg-muted p-3 rounded-md">
                {quote.issueDescription}
              </p>
            </div>
            {quote.quoteNotes && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">Notes from Business</p>
                <p className="text-sm bg-blue-50 dark:bg-blue-950/20 p-3 rounded-md border border-blue-200 dark:border-blue-800">
                  {quote.quoteNotes}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Photos */}
        {quote.photoUrls.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ImageIcon className="w-5 h-5" />
                Photos ({quote.photoUrls.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {quote.photoUrls.map((url, index) => (
                  <a
                    key={index}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block aspect-square rounded-lg overflow-hidden bg-muted hover:opacity-75 transition-opacity"
                    data-testid={`photo-${index}`}
                  >
                    <img
                      src={url}
                      alt={`Damage photo ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quote Amount */}
        <Card className="border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Custom Quote
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-6">
              <p className="text-5xl font-bold text-green-600 dark:text-green-400">
                ${quote.customQuoteAmount.toFixed(2)}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Total price for this specialty job
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <Button
              onClick={handleApprove}
              disabled={approveMutation.isPending}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
              size="lg"
              data-testid="button-approve-quote"
            >
              <CheckCircle2 className="w-5 h-5 mr-2" />
              {approveMutation.isPending ? 'Approving...' : 'Approve Quote'}
            </Button>

            <Separator />

            <div className="space-y-3">
              <Label htmlFor="decline-reason" className="text-red-600 dark:text-red-400">
                Or decline with a reason:
              </Label>
              <Textarea
                id="decline-reason"
                placeholder="Please let us know why you're declining (optional)"
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                rows={3}
                data-testid="input-decline-reason"
              />
              <Button
                onClick={handleDecline}
                disabled={declineMutation.isPending}
                variant="destructive"
                className="w-full"
                size="lg"
                data-testid="button-decline-quote"
              >
                <XCircle className="w-5 h-5 mr-2" />
                {declineMutation.isPending ? 'Declining...' : 'Decline Quote'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <Card className="bg-muted/50">
          <CardContent className="p-4 text-center text-sm text-muted-foreground">
            <p>Questions about this quote?</p>
            <p className="font-medium mt-1">
              Call {data.businessName} at {data.businessPhone}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
