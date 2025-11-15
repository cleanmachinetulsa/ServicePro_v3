import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Phone, PhoneCall, PhoneOff, Clock, Mic, FileText, TrendingUp, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AppShell } from '@/components/AppShell';

interface CallMetrics {
  totalCalls: number;
  completedCalls: number;
  failedCalls: number;
  successRate: string;
  avgDuration: string;
  callsWithRecordings: number;
  callsWithTranscriptions: number;
}

interface CallEvent {
  id: number;
  callSid: string;
  from: string;
  to: string;
  direction: 'inbound' | 'outbound';
  status: string;
  duration: number | null;
  recordingUrl: string | null;
  transcription: string | null;
  createdAt: string;
}

interface CallMetricsData {
  metrics: CallMetrics;
  recentCalls: CallEvent[];
  healthStatus: {
    systemOperational: boolean;
    callLoggingWorking: boolean;
    recordingWorking: boolean;
    transcriptionWorking: boolean;
  };
}

export default function CallMetricsPage() {
  const { data, isLoading, error } = useQuery<CallMetricsData>({
    queryKey: ['/api/voice-testing/test/call-quality-metrics'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Card className="w-96">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Error Loading Metrics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {error instanceof Error ? error.message : 'Failed to load call metrics'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const metrics = data?.metrics;
  const healthStatus = data?.healthStatus;
  const recentCalls = data?.recentCalls || [];

  // Page-specific actions
  const pageActions = (
    <Badge variant={healthStatus?.systemOperational ? 'default' : 'destructive'} className="text-sm">
      {healthStatus?.systemOperational ? 'System Operational' : 'System Issues Detected'}
    </Badge>
  );

  return (
    <AppShell title="Call Quality Metrics" pageActions={pageActions}>
      <div className="p-6 space-y-6">
        <p className="text-muted-foreground">Real-time monitoring of voice system performance</p>

      {/* Key Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalCalls || 0}</div>
            <p className="text-xs text-muted-foreground">Last 50 calls tracked</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {metrics?.successRate || '0%'}
            </div>
            <Progress 
              value={parseFloat(metrics?.successRate || '0')} 
              className="mt-2" 
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.avgDuration || '0s'}</div>
            <p className="text-xs text-muted-foreground">Per completed call</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed Calls</CardTitle>
            <PhoneOff className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{metrics?.failedCalls || 0}</div>
            <p className="text-xs text-muted-foreground">Requires attention</p>
          </CardContent>
        </Card>
      </div>

      {/* System Health Status */}
      <Card>
        <CardHeader>
          <CardTitle>System Health</CardTitle>
          <CardDescription>Voice infrastructure component status</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${healthStatus?.callLoggingWorking ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm">Call Logging</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${healthStatus?.recordingWorking ? 'bg-green-500' : 'bg-yellow-500'}`} />
            <span className="text-sm">Recording</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${healthStatus?.transcriptionWorking ? 'bg-green-500' : 'bg-yellow-500'}`} />
            <span className="text-sm">Transcription</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${healthStatus?.systemOperational ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm">System Status</span>
          </div>
        </CardContent>
      </Card>

      {/* Recent Calls */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Call Activity</CardTitle>
          <CardDescription>Latest call events and their status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentCalls.slice(0, 10).map((call) => (
              <div key={call.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors">
                <div className="flex items-center gap-3">
                  {call.direction === 'inbound' ? (
                    <PhoneCall className="h-4 w-4 text-blue-500" />
                  ) : (
                    <Phone className="h-4 w-4 text-purple-500" />
                  )}
                  <div>
                    <div className="font-medium text-sm">{call.from}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(call.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {call.recordingUrl && (
                    <Mic className="h-4 w-4 text-muted-foreground" data-testid="icon-recording" />
                  )}
                  {call.transcription && (
                    <FileText className="h-4 w-4 text-muted-foreground" data-testid="icon-transcription" />
                  )}
                  <Badge variant={
                    call.status === 'completed' ? 'default' :
                    call.status === 'failed' ? 'destructive' :
                    'secondary'
                  }>
                    {call.status}
                  </Badge>
                  {call.duration && (
                    <span className="text-sm text-muted-foreground">{call.duration}s</span>
                  )}
                </div>
              </div>
            ))}
            
            {recentCalls.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Phone className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No call activity yet</p>
                <p className="text-sm">Call events will appear here once calls are made</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Additional Stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic className="h-5 w-5" />
              Recording Stats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Calls with recordings</span>
                <span className="font-bold">{metrics?.callsWithRecordings || 0}</span>
              </div>
              <Progress 
                value={metrics?.totalCalls ? (metrics.callsWithRecordings / metrics.totalCalls) * 100 : 0} 
                className="h-2"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Transcription Stats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Calls with transcriptions</span>
                <span className="font-bold">{metrics?.callsWithTranscriptions || 0}</span>
              </div>
              <Progress 
                value={metrics?.totalCalls ? (metrics.callsWithTranscriptions / metrics.totalCalls) * 100 : 0} 
                className="h-2"
              />
            </div>
          </CardContent>
        </Card>
      </div>
      </div>
    </AppShell>
  );
}
