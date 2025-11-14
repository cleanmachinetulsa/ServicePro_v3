import { useEffect, useState, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { 
  Copy, 
  MessageSquare, 
  Share2, 
  Gift, 
  Users, 
  CheckCircle2, 
  Clock, 
  TrendingUp,
  QrCode as QrCodeIcon
} from 'lucide-react';
import QRCode from 'qrcode';
import BackNavigation from '@/components/BackNavigation';

interface ReferralStats {
  totalReferrals: number;
  pending: number;
  signedUp: number;
  completed: number;
  totalPointsEarned: number;
}

interface Referral {
  id: number;
  referralCode: string;
  refereeName: string | null;
  refereePhone: string | null;
  refereeEmail: string | null;
  status: string;
  pointsAwarded: number;
  createdAt: string;
  signedUpAt: string | null;
  completedAt: string | null;
  rewardedAt: string | null;
}

export default function ReferralPage() {
  const { toast } = useToast();
  const [customerId] = useState(1); // TODO: Get from auth context
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [showSmsForm, setShowSmsForm] = useState(false);
  const [friendPhone, setFriendPhone] = useState('');
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  // Fetch referral code
  const { data: codeData, isLoading: codeLoading } = useQuery<{ success: boolean; data: { code: string }; message: string }>({
    queryKey: ['/api/referral/code', customerId],
    enabled: !!customerId,
  });

  // Fetch referral stats
  const { data: statsData, isLoading: statsLoading } = useQuery<{ success: boolean; data: ReferralStats }>({
    queryKey: ['/api/referral/stats', customerId],
    enabled: !!customerId,
  });

  // Fetch referral list
  const { data: listData, isLoading: listLoading } = useQuery<{ success: boolean; data: Referral[] }>({
    queryKey: ['/api/referral/list', customerId],
    enabled: !!customerId,
  });

  const referralCode = codeData?.data?.code;
  const stats = statsData?.data;
  const referrals = listData?.data || [];

  // Generate QR code
  useEffect(() => {
    if (referralCode && qrCanvasRef.current) {
      const shareUrl = `${window.location.origin}/book?ref=${referralCode}`;
      
      QRCode.toCanvas(
        qrCanvasRef.current,
        shareUrl,
        {
          width: 200,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#ffffff',
          },
        },
        (error) => {
          if (error) {
            console.error('QR code generation failed:', error);
          } else {
            // Also generate data URL for download
            QRCode.toDataURL(shareUrl, { width: 400 }).then(setQrCodeUrl);
          }
        }
      );
    }
  }, [referralCode]);

  // Send SMS invite mutation
  const sendInviteMutation = useMutation({
    mutationFn: async (phone: string) => {
      const response = await fetch('/api/sms/send-referral-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          customerId,
          friendPhone: phone,
          referralCode 
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to send invite');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Invite sent! 🎉',
        description: 'Your friend will receive a text message with your referral code.',
      });
      setFriendPhone('');
      setShowSmsForm(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to send invite',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: 'Copied!',
        description: `${label} copied to clipboard`,
      });
    } catch (error) {
      toast({
        title: 'Failed to copy',
        description: 'Please try again',
        variant: 'destructive',
      });
    }
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/book?ref=${referralCode}`;
    const shareText = `Get $25 off your first auto detail with Clean Machine! Use my code: ${referralCode}\n\n${shareUrl}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Clean Machine Referral',
          text: shareText,
        });
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          copyToClipboard(shareText, 'Referral message');
        }
      }
    } else {
      copyToClipboard(shareText, 'Referral message');
    }
  };

  const downloadQrCode = () => {
    if (qrCodeUrl) {
      const link = document.createElement('a');
      link.download = `referral-${referralCode}.png`;
      link.href = qrCodeUrl;
      link.click();
    }
  };

  const handleSendInvite = () => {
    if (!friendPhone.trim()) {
      toast({
        title: 'Phone number required',
        description: 'Please enter your friend\'s phone number',
        variant: 'destructive',
      });
      return;
    }
    sendInviteMutation.mutate(friendPhone);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'signed_up':
        return <Users className="h-4 w-4 text-blue-600" />;
      case 'first_service_completed':
      case 'rewarded':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'signed_up':
        return 'Signed Up';
      case 'first_service_completed':
        return 'Service Completed';
      case 'rewarded':
        return 'Rewarded';
      default:
        return status;
    }
  };

  if (codeLoading || statsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 p-6">
        <div className="max-w-4xl mx-auto">
          <BackNavigation fallbackPath="/" label="Back to Home" />
          <div className="text-center py-20">
            <p className="text-gray-600 dark:text-gray-400">Loading your referral code...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <BackNavigation fallbackPath="/" label="Back to Home" />

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Gift className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold">Refer Friends, Earn Rewards</h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            Share your code and both you and your friend get 500 loyalty points!
          </p>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6 text-center">
                <Users className="h-6 w-6 mx-auto mb-2 text-blue-600" />
                <div className="text-2xl font-bold">{stats.totalReferrals}</div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Total Referrals</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <Clock className="h-6 w-6 mx-auto mb-2 text-yellow-600" />
                <div className="text-2xl font-bold">{stats.pending}</div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Pending</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <CheckCircle2 className="h-6 w-6 mx-auto mb-2 text-green-600" />
                <div className="text-2xl font-bold">{stats.completed}</div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Completed</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <TrendingUp className="h-6 w-6 mx-auto mb-2 text-purple-600" />
                <div className="text-2xl font-bold">{stats.totalPointsEarned}</div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Points Earned</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Referral Code Card */}
        <Card className="border-2 border-blue-200 dark:border-blue-800">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Your Referral Code</CardTitle>
            <CardDescription>Share this code with friends and family</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Code Display */}
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-6 text-center">
              <div className="text-white text-5xl font-bold tracking-wider mb-2">
                {referralCode}
              </div>
              <Badge variant="secondary" className="bg-white text-blue-600">
                500 points for each friend
              </Badge>
            </div>

            {/* QR Code */}
            <div className="text-center space-y-2">
              <div className="inline-block bg-white p-4 rounded-lg shadow-lg">
                <canvas ref={qrCanvasRef} />
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Scan to get your friend's discount
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={downloadQrCode}
                data-testid="button-download-qr"
              >
                <QrCodeIcon className="h-4 w-4 mr-2" />
                Download QR Code
              </Button>
            </div>

            <Separator />

            {/* Action Buttons */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Button
                variant="outline"
                onClick={() => copyToClipboard(referralCode || '', 'Referral code')}
                data-testid="button-copy-code"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy Code
              </Button>
              <Button
                variant="outline"
                onClick={handleShare}
                data-testid="button-share-code"
              >
                <Share2 className="h-4 w-4 mr-2" />
                Share Link
              </Button>
              <Button
                onClick={() => setShowSmsForm(!showSmsForm)}
                data-testid="button-send-sms-invite"
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Send SMS Invite
              </Button>
            </div>

            {/* SMS Invite Form */}
            {showSmsForm && (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3">
                <label className="text-sm font-medium">Friend's Phone Number</label>
                <div className="flex gap-2">
                  <Input
                    type="tel"
                    placeholder="(918) 555-0123"
                    value={friendPhone}
                    onChange={(e) => setFriendPhone(e.target.value)}
                    data-testid="input-friend-phone"
                  />
                  <Button
                    onClick={handleSendInvite}
                    disabled={sendInviteMutation.isPending}
                    data-testid="button-send-invite"
                  >
                    {sendInviteMutation.isPending ? 'Sending...' : 'Send'}
                  </Button>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  They'll receive a text with your code and a link to book
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Referral History */}
        {referrals.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Your Referrals</CardTitle>
              <CardDescription>Track your friend's progress</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {referrals.map((referral) => (
                  <div
                    key={referral.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                    data-testid={`referral-${referral.id}`}
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(referral.status)}
                      <div>
                        <div className="font-medium">
                          {referral.refereeName || referral.refereePhone || referral.refereeEmail || 'Friend'}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {getStatusLabel(referral.status)}
                          {referral.rewardedAt && ` • ${referral.pointsAwarded} points earned`}
                        </div>
                      </div>
                    </div>
                    <div className="text-right text-sm text-gray-500">
                      {new Date(referral.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* How It Works */}
        <Card>
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
              <div className="space-y-2">
                <div className="bg-blue-100 dark:bg-blue-900 w-12 h-12 rounded-full flex items-center justify-center mx-auto">
                  <span className="text-xl font-bold text-blue-600 dark:text-blue-300">1</span>
                </div>
                <h3 className="font-semibold">Share Your Code</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Send your unique code to friends via SMS, email, or social media
                </p>
              </div>
              <div className="space-y-2">
                <div className="bg-purple-100 dark:bg-purple-900 w-12 h-12 rounded-full flex items-center justify-center mx-auto">
                  <span className="text-xl font-bold text-purple-600 dark:text-purple-300">2</span>
                </div>
                <h3 className="font-semibold">Friend Books Service</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  They use your code when booking their first detail
                </p>
              </div>
              <div className="space-y-2">
                <div className="bg-green-100 dark:bg-green-900 w-12 h-12 rounded-full flex items-center justify-center mx-auto">
                  <span className="text-xl font-bold text-green-600 dark:text-green-300">3</span>
                </div>
                <h3 className="font-semibold">Both Get Rewarded</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  You both receive 500 loyalty points after their first service
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
