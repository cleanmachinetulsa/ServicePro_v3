import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { AppShell } from '@/components/AppShell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
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
  Beaker,
  History,
  Clock,
  AlertTriangle,
  Sparkles
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { PortRecoveryCampaign } from '@shared/schema';
import { format } from 'date-fns';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-500',
  scheduled: 'bg-yellow-500',
  running: 'bg-blue-500',
  completed: 'bg-green-500',
  cancelled: 'bg-red-500',
  PENDING: 'bg-yellow-500',
  RUNNING: 'bg-blue-500',
  COMPLETED: 'bg-green-500',
  FAILED: 'bg-red-500',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  running: 'Running',
  completed: 'Completed',
  cancelled: 'Cancelled',
  PENDING: 'Pending',
  RUNNING: 'Running',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
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

interface AdminPreviewData {
  success: boolean;
  canRun: boolean;
  totalTargets: number;
  sampleSms: string;
  sampleCustomerName?: string;
  runInProgress: boolean;
  lastRun?: {
    startedAt: string;
    finishedAt?: string;
    totalSent: number;
    totalFailed: number;
  };
  stats: PreviewStats;
  sampleTargets: SampleTarget[];
}

interface HistoryRun {
  id: string;
  startedAt: string;
  finishedAt?: string;
  totalTargets: number;
  totalSent: number;
  totalFailed: number;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
}

export default function AdminPortRecovery() {
  const { toast } = useToast();
  const [isRunning, setIsRunning] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);

  const { data: previewData, isLoading: previewLoading, refetch: refetchPreview } = useQuery<AdminPreviewData>({
    queryKey: ['/api/port-recovery/admin/preview'],
  });

  const { data: historyData, isLoading: historyLoading, refetch: refetchHistory } = useQuery<{
    success: boolean;
    runs: HistoryRun[];
  }>({
    queryKey: ['/api/port-recovery/admin/history'],
  });

  const { data: campaignsData, isLoading: campaignsLoading, refetch: refetchCampaigns } = useQuery<{
    success: boolean;
    campaigns: PortRecoveryCampaign[];
  }>({
    queryKey: ['/api/port-recovery/campaigns'],
  });

  const runCampaignMutation = useMutation({
    mutationFn: async () => {
      setIsRunning(true);
      return await apiRequest('POST', '/api/port-recovery/admin/run', {});
    },
    onSuccess: (data: any) => {
      toast({
        title: 'Port Recovery Campaign Launched!',
        description: `Campaign started with ${data.totalQueued} customers queued. You can watch delivery stats on the Messaging Logs page.`,
      });
      setConfirmSend(false);
      queryClient.invalidateQueries({ queryKey: ['/api/port-recovery/admin/preview'] });
      queryClient.invalidateQueries({ queryKey: ['/api/port-recovery/admin/history'] });
      queryClient.invalidateQueries({ queryKey: ['/api/port-recovery/campaigns'] });
      setIsRunning(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Campaign Failed',
        description: error.message || 'Failed to start campaign',
        variant: 'destructive',
      });
      setIsRunning(false);
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
      queryClient.invalidateQueries({ queryKey: ['/api/port-recovery/admin/history'] });
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
  const runs = historyData?.runs || [];

  const formatPhone = (phone: string | null) => {
    if (!phone) return '—';
    return phone.replace(/^\+1/, '').replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
  };

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '—';
    try {
      return format(new Date(dateStr), 'MMM d, h:mm a');
    } catch {
      return dateStr;
    }
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

          {/* Run In Progress Warning */}
          {previewData?.runInProgress && (
            <Alert className="bg-yellow-900/30 border-yellow-700/50">
              <AlertTriangle className="h-4 w-4 text-yellow-400" />
              <AlertTitle className="text-yellow-300 text-sm">Campaign In Progress</AlertTitle>
              <AlertDescription className="text-yellow-200/70 text-xs">
                A campaign is currently running. Please wait for it to complete before starting another.
              </AlertDescription>
            </Alert>
          )}

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

                {/* Last Run Info */}
                {previewData?.lastRun && (
                  <>
                    <Separator className="bg-slate-700/50" />
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Last campaign: {formatDate(previewData.lastRun.startedAt)}
                      </span>
                      <span>
                        {previewData.lastRun.totalSent} sent
                        {previewData.lastRun.totalFailed > 0 && (
                          <span className="text-red-400 ml-1">
                            ({previewData.lastRun.totalFailed} failed)
                          </span>
                        )}
                      </span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ) : null}

          {/* Sample SMS Preview */}
          {previewData?.sampleSms && (
            <Card className="bg-slate-800/80 border-slate-700/50 backdrop-blur-md border-l-4 border-l-green-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-green-400" />
                  Sample Message
                </CardTitle>
                <CardDescription className="text-gray-400 text-xs">
                  How the message will appear to "{previewData.sampleCustomerName}"
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-slate-900/50 rounded-lg p-3">
                  <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">
                    {previewData.sampleSms}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

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
                      data-testid={`sample-recipient-${idx}`}
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
          ) : null}

          {/* Send Campaign Panel - NEW for Block B */}
          {!activeCampaign && previewData?.canRun && stats && stats.totalUnique > 0 && (
            <Card className="bg-slate-800/80 border-slate-700/50 backdrop-blur-md border-2 border-dashed border-purple-500/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-white flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-400" />
                  Send Campaign
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Ready to launch the port recovery campaign
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Confirmation Checkbox */}
                <div className="bg-red-900/20 border border-red-700/30 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="confirm-send"
                      checked={confirmSend}
                      onCheckedChange={(checked) => setConfirmSend(checked === true)}
                      className="mt-0.5 border-red-500/50 data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600"
                      data-testid="checkbox-confirm-send"
                    />
                    <label 
                      htmlFor="confirm-send" 
                      className="text-sm text-red-200/90 cursor-pointer leading-relaxed"
                    >
                      I understand this will send one apology message + <span className="font-semibold text-yellow-400">500 points</span> to all {stats.totalUnique} eligible customers.
                    </label>
                  </div>
                </div>

                {/* Send Button */}
                <Button
                  size="lg"
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-6 rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => runCampaignMutation.mutate()}
                  disabled={!confirmSend || runCampaignMutation.isPending || isRunning}
                  data-testid="button-send-campaign"
                >
                  {runCampaignMutation.isPending || isRunning ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Launching Campaign...
                    </>
                  ) : (
                    <>
                      <Send className="h-5 w-5 mr-2" />
                      Send Now
                      <Badge variant="secondary" className="ml-2 bg-white/20 text-white">
                        {stats.totalUnique} recipients
                      </Badge>
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* History Panel - NEW for Block B */}
          {runs.length > 0 && (
            <Card className="bg-slate-800/80 border-slate-700/50 backdrop-blur-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <History className="h-4 w-4 text-blue-400" />
                  Campaign History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {runs.map((run) => (
                    <div 
                      key={run.id} 
                      className="flex items-center justify-between py-2 px-3 bg-slate-900/50 rounded-lg"
                      data-testid={`history-run-${run.id}`}
                    >
                      <div>
                        <div className="text-sm text-white flex items-center gap-2">
                          <Clock className="h-3 w-3 text-gray-400" />
                          {formatDate(run.startedAt)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {run.totalSent} sent
                          {run.totalFailed > 0 && (
                            <span className="text-red-400 ml-1">
                              / {run.totalFailed} failed
                            </span>
                          )}
                        </div>
                      </div>
                      <Badge 
                        className={`${STATUS_COLORS[run.status]} text-white text-xs`}
                      >
                        {STATUS_LABELS[run.status]}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
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
