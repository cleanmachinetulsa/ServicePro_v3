import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { AppShell } from '@/components/AppShell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  Phone, 
  Mail, 
  Users, 
  Gift, 
  MessageSquare, 
  Loader2, 
  PlayCircle, 
  CheckCircle, 
  AlertCircle,
  Send,
  Target,
  Star,
  RefreshCw,
  Beaker
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { PortRecoveryCampaign } from '@shared/schema';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-500',
  scheduled: 'bg-yellow-500',
  running: 'bg-blue-500',
  completed: 'bg-green-500',
  cancelled: 'bg-red-500',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  running: 'Running',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

interface PreviewStats {
  totalFromCustomers: number;
  totalFromConversations: number;
  totalFromGoogleVoice: number;
  totalUnique: number;
  totalWithPhone: number;
  totalWithEmail: number;
}

interface SampleTarget {
  phone: string | null;
  email: string | null;
  customerName: string | null;
  source: string;
}

export default function AdminPortRecovery() {
  const { toast } = useToast();
  const [isRunning, setIsRunning] = useState(false);

  const { data: previewData, isLoading: previewLoading, refetch: refetchPreview } = useQuery<{
    success: boolean;
    stats: PreviewStats;
    sampleTargets: SampleTarget[];
  }>({
    queryKey: ['/api/port-recovery/preview'],
  });

  const { data: campaignsData, isLoading: campaignsLoading, refetch: refetchCampaigns } = useQuery<{
    success: boolean;
    campaigns: PortRecoveryCampaign[];
  }>({
    queryKey: ['/api/port-recovery/campaigns'],
  });

  const createCampaignMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/port-recovery/campaigns', {
        name: `port-recovery-${new Date().toISOString().split('T')[0]}`,
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: 'Campaign Created',
        description: `Created campaign with ${data.targetCount} targets`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/port-recovery/campaigns'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create campaign',
        variant: 'destructive',
      });
    },
  });

  const testSmsMutation = useMutation({
    mutationFn: async (campaignId: number) => {
      return await apiRequest('POST', `/api/port-recovery/campaigns/${campaignId}/test-sms`, {});
    },
    onSuccess: () => {
      toast({
        title: 'Test SMS Sent',
        description: 'Check your phone for the test message',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Test SMS Failed',
        description: error.message || 'Failed to send test SMS',
        variant: 'destructive',
      });
    },
  });

  const runBatchMutation = useMutation({
    mutationFn: async (campaignId: number) => {
      setIsRunning(true);
      return await apiRequest('POST', `/api/port-recovery/campaigns/${campaignId}/run-batch`, {
        limit: 50,
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: data.isComplete ? 'Campaign Completed' : 'Batch Processed',
        description: `Sent ${data.smsSent} SMS, ${data.emailSent} emails, granted ${data.pointsGranted} points`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/port-recovery/campaigns'] });
      setIsRunning(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to run batch',
        variant: 'destructive',
      });
      setIsRunning(false);
    },
  });

  const stats = previewData?.stats;
  const campaigns = campaignsData?.campaigns || [];
  const activeCampaign = campaigns.find(c => c.status === 'draft' || c.status === 'running');

  const formatPhone = (phone: string | null) => {
    if (!phone) return '—';
    return phone.replace(/^\+1/, '').replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
  };

  return (
    <AppShell>
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-slate-900 to-slate-800 p-4 pb-24">
        <div className="max-w-lg mx-auto space-y-4">
          <div className="pt-2 pb-4">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <RefreshCw className="h-6 w-6 text-purple-400" />
              Port Recovery
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Win back customers who may have been lost during number porting
            </p>
          </div>

          {/* Stats Overview */}
          {previewLoading ? (
            <Card className="bg-slate-800/80 border-slate-700/50 backdrop-blur-md">
              <CardContent className="py-8 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
              </CardContent>
            </Card>
          ) : stats ? (
            <Card className="bg-slate-800/80 border-slate-700/50 backdrop-blur-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-white flex items-center gap-2">
                  <Target className="h-5 w-5 text-green-400" />
                  Target Audience
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Consolidated from all customer sources
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-white">{stats.totalUnique}</div>
                    <div className="text-xs text-gray-400">Total Unique</div>
                  </div>
                  <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-green-400">{stats.totalWithPhone}</div>
                    <div className="text-xs text-gray-400">With Phone</div>
                  </div>
                  <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-blue-400">{stats.totalWithEmail}</div>
                    <div className="text-xs text-gray-400">With Email</div>
                  </div>
                  <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-yellow-400">500</div>
                    <div className="text-xs text-gray-400">Points Each</div>
                  </div>
                </div>

                <Separator className="bg-slate-700/50" />

                <div className="space-y-2">
                  <div className="text-xs text-gray-400 font-medium">Sources Breakdown</div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="bg-purple-900/30 text-purple-300 border-purple-700/50">
                      <Users className="h-3 w-3 mr-1" />
                      {stats.totalFromCustomers} Customers
                    </Badge>
                    <Badge variant="outline" className="bg-blue-900/30 text-blue-300 border-blue-700/50">
                      <MessageSquare className="h-3 w-3 mr-1" />
                      {stats.totalFromConversations} Conversations
                    </Badge>
                    <Badge variant="outline" className="bg-green-900/30 text-green-300 border-green-700/50">
                      <Phone className="h-3 w-3 mr-1" />
                      {stats.totalFromGoogleVoice} GVoice Import
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* Sample Targets Preview */}
          {previewData?.sampleTargets && previewData.sampleTargets.length > 0 && (
            <Card className="bg-slate-800/80 border-slate-700/50 backdrop-blur-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <Users className="h-4 w-4 text-purple-400" />
                  Sample Recipients
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {previewData.sampleTargets.slice(0, 5).map((target, idx) => (
                    <div 
                      key={idx} 
                      className="flex items-center justify-between py-2 px-3 bg-slate-900/50 rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-purple-900/50 flex items-center justify-center">
                          <span className="text-xs text-purple-300 font-medium">
                            {target.customerName?.charAt(0) || '?'}
                          </span>
                        </div>
                        <div>
                          <div className="text-sm text-white">
                            {target.customerName || formatPhone(target.phone)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {target.source === 'google_voice_import' ? 'GVoice' : target.source}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {target.phone && (
                          <Phone className="h-4 w-4 text-green-400" />
                        )}
                        {target.email && (
                          <Mail className="h-4 w-4 text-blue-400" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Active/Recent Campaign */}
          {campaignsLoading ? (
            <Card className="bg-slate-800/80 border-slate-700/50 backdrop-blur-md">
              <CardContent className="py-8 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
              </CardContent>
            </Card>
          ) : activeCampaign ? (
            <Card className="bg-slate-800/80 border-slate-700/50 backdrop-blur-md border-l-4 border-l-purple-500">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white flex items-center gap-2">
                    <Send className="h-5 w-5 text-purple-400" />
                    {activeCampaign.name}
                  </CardTitle>
                  <Badge 
                    className={`${STATUS_COLORS[activeCampaign.status]} text-white`}
                  >
                    {STATUS_LABELS[activeCampaign.status]}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Progress */}
                {activeCampaign.totalTargets > 0 && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>Progress</span>
                      <span>
                        {activeCampaign.totalSmsSent}/{activeCampaign.totalTargets} sent
                      </span>
                    </div>
                    <Progress 
                      value={(activeCampaign.totalSmsSent / activeCampaign.totalTargets) * 100} 
                      className="h-2"
                    />
                  </div>
                )}

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-slate-900/50 rounded-lg p-2 text-center">
                    <div className="text-lg font-bold text-green-400">
                      {activeCampaign.totalSmsSent}
                    </div>
                    <div className="text-[10px] text-gray-400">SMS Sent</div>
                  </div>
                  <div className="bg-slate-900/50 rounded-lg p-2 text-center">
                    <div className="text-lg font-bold text-blue-400">
                      {activeCampaign.totalEmailSent}
                    </div>
                    <div className="text-[10px] text-gray-400">Emails</div>
                  </div>
                  <div className="bg-slate-900/50 rounded-lg p-2 text-center">
                    <div className="text-lg font-bold text-yellow-400">
                      {activeCampaign.totalPointsGranted?.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-gray-400">Points</div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 bg-slate-900/50 border-slate-700/50 text-gray-300 hover:bg-slate-800"
                    onClick={() => testSmsMutation.mutate(activeCampaign.id)}
                    disabled={testSmsMutation.isPending}
                    data-testid="button-test-sms"
                  >
                    {testSmsMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Beaker className="h-4 w-4 mr-1" />
                    )}
                    Test SMS
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                    onClick={() => runBatchMutation.mutate(activeCampaign.id)}
                    disabled={isRunning || activeCampaign.status === 'completed'}
                    data-testid="button-run-batch"
                  >
                    {isRunning ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        Sending...
                      </>
                    ) : activeCampaign.status === 'completed' ? (
                      <>
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Complete
                      </>
                    ) : (
                      <>
                        <PlayCircle className="h-4 w-4 mr-1" />
                        Send Next 50
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : campaigns.length > 0 ? (
            <Card className="bg-slate-800/80 border-slate-700/50 backdrop-blur-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-sm">Completed Campaigns</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {campaigns.slice(0, 3).map((c) => (
                    <div 
                      key={c.id} 
                      className="flex items-center justify-between py-2 px-3 bg-slate-900/50 rounded-lg"
                    >
                      <div>
                        <div className="text-sm text-white">{c.name}</div>
                        <div className="text-xs text-gray-500">
                          {c.totalSmsSent} SMS, {c.totalPointsGranted?.toLocaleString()} pts
                        </div>
                      </div>
                      <Badge 
                        className={`${STATUS_COLORS[c.status]} text-white text-xs`}
                      >
                        {STATUS_LABELS[c.status]}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* Create Campaign Button */}
          {!activeCampaign && stats && stats.totalUnique > 0 && (
            <Button
              size="lg"
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-6 rounded-xl shadow-lg"
              onClick={() => createCampaignMutation.mutate()}
              disabled={createCampaignMutation.isPending}
              data-testid="button-create-campaign"
            >
              {createCampaignMutation.isPending ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Creating Campaign...
                </>
              ) : (
                <>
                  <Gift className="h-5 w-5 mr-2" />
                  Create Recovery Campaign
                  <Badge variant="secondary" className="ml-2 bg-white/20 text-white">
                    {stats.totalUnique} recipients
                  </Badge>
                </>
              )}
            </Button>
          )}

          {/* What Gets Sent */}
          <Card className="bg-slate-800/80 border-slate-700/50 backdrop-blur-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-sm flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-purple-400" />
                What Gets Sent
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="bg-slate-900/50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Phone className="h-4 w-4 text-green-400" />
                  <span className="text-xs font-medium text-green-400">SMS Message</span>
                </div>
                <p className="text-xs text-gray-300 leading-relaxed">
                  Hey this is Jody with Clean Machine Auto Detail. We recently upgraded our phone & text system, 
                  and there's a small chance we missed a message from you. I'm really sorry if that happened. 
                  To make it right, we've added <span className="text-yellow-400 font-semibold">500 reward points</span> to your account – 
                  you can use them toward interior protection, engine bay cleaning, or save them up toward a maintenance detail. 
                  Tap here to view options & book: [link]. Reply STOP to unsubscribe.
                </p>
              </div>

              <div className="bg-slate-900/50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Star className="h-4 w-4 text-yellow-400" />
                  <span className="text-xs font-medium text-yellow-400">Points Awarded</span>
                </div>
                <p className="text-xs text-gray-300">
                  500 loyalty points automatically credited to each customer's account. 
                  Points can be redeemed on future services.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Compliance Info */}
          <Alert className="bg-slate-800/80 border-slate-700/50">
            <AlertCircle className="h-4 w-4 text-blue-400" />
            <AlertTitle className="text-white text-sm">Compliance Note</AlertTitle>
            <AlertDescription className="text-gray-400 text-xs">
              Messages include STOP opt-out. Only customers with valid SMS consent are included. 
              Sending pauses if any delivery issues are detected.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </AppShell>
  );
}
