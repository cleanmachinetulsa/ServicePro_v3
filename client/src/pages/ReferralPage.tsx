import { useEffect, useState, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Copy, 
  MessageSquare, 
  Share2, 
  Gift, 
  Users, 
  CheckCircle2, 
  Clock, 
  TrendingUp,
  QrCode as QrCodeIcon,
  Search,
  Download,
  Sparkles
} from 'lucide-react';
import QRCode from 'react-qr-code';
import { AppShell } from '@/components/AppShell';

interface BusinessSettings {
  businessName?: string;
  referralDiscount?: string;
  referralPoints?: number;
}

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
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [searchPhone, setSearchPhone] = useState('');
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [showSmsForm, setShowSmsForm] = useState(false);
  const [friendPhone, setFriendPhone] = useState('');
  const qrRef = useRef<HTMLDivElement>(null);

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

  // Fetch QR action configuration
  const { data: qrActionData } = useQuery<{ success: boolean; data: { actionType: string; actionUrl: string; trackingEnabled: boolean; scans: number } }>({
    queryKey: [`/api/qr/action/${customerId}`],
    enabled: !!customerId,
  });

  // Fetch signed QR code ID
  const { data: qrCodeIdData } = useQuery<{ success: boolean; data: { qrCodeId: string; customerId: number } }>({
    queryKey: [`/api/qr/generate-id/${customerId}`],
    enabled: !!customerId,
  });

  // Fetch business settings for tenant-aware branding
  const { data: businessSettingsData } = useQuery<{ success: boolean; settings: BusinessSettings }>({
    queryKey: ['/api/business-settings'],
  });

  const businessName = businessSettingsData?.settings?.businessName || 'Our Business';
  const referralDiscount = businessSettingsData?.settings?.referralDiscount || '$25';

  // Search for customer by phone
  const handleSearch = async () => {
    if (!searchPhone.trim()) {
      toast({
        title: 'Phone number required',
        description: 'Please enter your phone number to view your referral code',
        variant: 'destructive',
      });
      return;
    }

    setSearching(true);
    setHasSearched(true);

    try {
      // Use admin-protected customer search endpoint
      const response = await fetch(`/api/customers/lookup/phone/${encodeURIComponent(searchPhone)}`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Customer not found');
      }

      const data = await response.json();
      
      if (data.success && data.customer) {
        setCustomerId(data.customer.id);
        toast({
          title: 'Account found!',
          description: `Welcome back, ${data.customer.name}!`,
        });
      } else {
        setCustomerId(null);
        toast({
          title: 'Not found',
          description: 'No account found with this phone number. Please book a service first to join our referral program!',
          variant: 'destructive',
        });
      }
    } catch (error) {
      setCustomerId(null);
      toast({
        title: 'Search failed',
        description: 'Could not find your account. Please check your phone number.',
        variant: 'destructive',
      });
    } finally {
      setSearching(false);
    }
  };

  const referralCode = codeData?.data?.code;
  const stats = statsData?.data;
  const referrals = listData?.data || [];
  const qrAction = qrActionData?.data;
  const qrCodeId = qrCodeIdData?.data?.qrCodeId;
  
  const qrUrl = qrCodeId ? `${window.location.origin}/api/qr/scan/${qrCodeId}` : '';

  const handleDownloadQr = () => {
    if (!qrRef.current || !referralCode) return;

    const svg = qrRef.current.querySelector('svg');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width * 2;
      canvas.height = img.height * 2;
      ctx?.scale(2, 2);
      ctx?.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL('image/png');
      
      const downloadLink = document.createElement('a');
      downloadLink.download = `referral-qr-${referralCode}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

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
    const shareText = `Get ${referralDiscount} off your first service with ${businessName}! Use my code: ${referralCode}\n\n${shareUrl}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `${businessName} Referral`,
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

  const downloadQrCode = handleDownloadQr;

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
      <AppShell title="Customer Referrals">
        <div className="p-6 max-w-4xl mx-auto">
          <div className="text-center py-20">
            <p className="text-gray-600 dark:text-gray-400">Loading your referral code...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Customer Referral Management">
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
          Look up customers and manage their referral codes
        </p>

        {/* Customer Search */}
        {!customerId && (
          <Card>
            <CardHeader>
              <CardTitle>Find Customer</CardTitle>
              <CardDescription>Search by phone number to view referral information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  type="tel"
                  placeholder="(918) 555-0123"
                  value={searchPhone}
                  onChange={(e) => setSearchPhone(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  data-testid="input-customer-search-phone"
                />
                <Button
                  onClick={handleSearch}
                  disabled={searching}
                  data-testid="button-search-customer"
                >
                  {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                  {searching ? 'Searching...' : 'Search'}
                </Button>
              </div>
              {hasSearched && !customerId && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No customer found with this phone number.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}
        
        {!customerId && hasSearched && (
          <p className="text-center text-gray-500">Enter a phone number to get started</p>
        )}

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

            {/* QR Code Section */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 rounded-xl blur-sm" />
              <div className="relative bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-xl p-6">
                <div className="flex flex-col md:flex-row items-center gap-6">
                  {/* QR Code */}
                  <div className="flex-shrink-0">
                    <div ref={qrRef} className="inline-block bg-white p-4 rounded-xl shadow-lg ring-2 ring-blue-100 dark:ring-blue-900">
                      {qrUrl ? (
                        <QRCode
                          value={qrUrl}
                          size={180}
                          level="H"
                          data-testid="qr-code-image"
                        />
                      ) : (
                        <div className="w-[180px] h-[180px] flex items-center justify-center text-gray-400">
                          <Sparkles className="h-8 w-8 animate-pulse" />
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* QR Description */}
                  <div className="flex-1 text-center md:text-left space-y-3">
                    <div className="flex items-center gap-2 justify-center md:justify-start">
                      <QrCodeIcon className="h-5 w-5 text-blue-600" />
                      <h3 className="font-semibold text-lg">Share via QR Code</h3>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Friends can scan this code to instantly get your referral discount. 
                      Download it to print on cards or share in person.
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={downloadQrCode}
                        disabled={!qrUrl}
                        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                        data-testid="button-download-qr"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download QR
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(qrUrl, 'QR link')}
                        disabled={!qrUrl}
                        data-testid="button-copy-qr-url"
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Copy Link
                      </Button>
                    </div>
                    {qrActionData?.data?.scans !== undefined && qrActionData.data.scans > 0 && (
                      <div className="inline-flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded-full">
                        <TrendingUp className="h-3 w-3" />
                        {qrActionData.data.scans} scan{qrActionData.data.scans !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                </div>
              </div>
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
                disabled={!customerId || !referralCode}
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
                    disabled={!customerId || !referralCode || !friendPhone.trim() || sendInviteMutation.isPending}
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
    </AppShell>
  );
}
