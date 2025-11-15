import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  Phone, 
  PhoneIncoming, 
  PhoneOutgoing, 
  PhoneMissed,
  MessageCircle,
  Info
} from 'lucide-react';
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import CallDetailsModal from './CallDetailsModal';
import { CallHistorySkeleton } from './SkeletonLoader';

interface Call {
  id: number;
  direction: 'inbound' | 'outbound';
  from: string;
  to: string;
  status: 'completed' | 'missed' | 'voicemail' | 'busy' | 'failed';
  duration: number | null;
  timestamp: string;
  recordingUrl: string | null;
}

function getCallIcon(call: Call) {
  if (call.direction === 'inbound' && call.status === 'missed') {
    return <PhoneMissed className="h-5 w-5 text-red-600 dark:text-red-400" />;
  }
  if (call.direction === 'inbound') {
    return <PhoneIncoming className="h-5 w-5 text-green-600 dark:text-green-400" />;
  }
  return <PhoneOutgoing className="h-5 w-5 text-blue-600 dark:text-blue-400" />;
}

function formatCallDuration(seconds: number | null): string {
  if (!seconds) return '';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

function formatCallTime(dateString: string): string {
  const date = new Date(dateString);
  
  if (isToday(date)) {
    return format(date, 'h:mm a');
  } else if (isYesterday(date)) {
    return 'Yesterday';
  } else {
    return format(date, 'MMM d');
  }
}

export default function RecentCalls() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);

  const { data, isLoading, isError, error } = useQuery<{ calls?: Call[] }>({
    queryKey: ['/api/calls/recent'],
    refetchInterval: 10000, // Refresh every 10 seconds
    retry: 3,
  });

  const calls: Call[] = data?.calls || [];

  // Call back mutation
  const callBackMutation = useMutation({
    mutationFn: async (phoneNumber: string) => {
      return await apiRequest('POST', '/api/calls/initiate', { to: phoneNumber });
    },
    onSuccess: (_, phoneNumber) => {
      toast({ title: 'Calling...', description: `Connecting to ${phoneNumber}` });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Call failed', 
        description: error.message || 'Unable to initiate call',
        variant: 'destructive'
      });
    },
  });

  const handleMessage = (phoneNumber: string) => {
    setLocation(`/messages?new=${encodeURIComponent(phoneNumber)}`);
  };

  const handleCallBack = (phoneNumber: string) => {
    callBackMutation.mutate(phoneNumber);
  };

  if (isLoading) {
    return (
      <ScrollArea className="h-full">
        <CallHistorySkeleton />
      </ScrollArea>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center px-4">
          <Phone className="h-16 w-16 mx-auto mb-4 text-destructive" />
          <h3 className="text-lg font-semibold mb-2 dark:text-white">Unable to load call history</h3>
          <p className="text-muted-foreground mb-4">
            {error instanceof Error ? error.message : 'Please try again later'}
          </p>
          <Button 
            variant="outline" 
            onClick={() => window.location.reload()}
            data-testid="button-retry-calls"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (calls.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center px-4">
          <Phone className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2 dark:text-white">No recent calls</h3>
          <p className="text-muted-foreground">
            Your call history will appear here
          </p>
        </div>
      </div>
    );
  }

  const missedCount = calls.filter(c => c.status === 'missed').length;
  const inboundCount = calls.filter(c => c.direction === 'inbound').length;
  const outboundCount = calls.filter(c => c.direction === 'outbound').length;

  return (
    <>
      <CallDetailsModal
        call={selectedCall}
        open={!!selectedCall}
        onOpenChange={(open) => !open && setSelectedCall(null)}
        onCallBack={() => selectedCall && handleCallBack(selectedCall.direction === 'inbound' ? selectedCall.from : selectedCall.to)}
        onMessage={() => selectedCall && handleMessage(selectedCall.direction === 'inbound' ? selectedCall.from : selectedCall.to)}
      />
      
      <div className="h-full flex flex-col bg-gradient-to-br from-gray-50/30 to-gray-100/20 dark:from-gray-950/50 dark:to-gray-900/30">
        {/* Glass Stats Header */}
        <div className="glass-card m-4 mb-0 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-gradient-to-br from-green-500 to-blue-500">
                <Phone className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-lg dark:text-white">Recent Calls</h3>
                <p className="text-sm text-muted-foreground">
                  {calls.length} call{calls.length !== 1 ? 's' : ''}
                  {missedCount > 0 && ` • ${missedCount} missed`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {missedCount > 0 && (
                <Badge className="bg-gradient-to-br from-red-600 to-red-700 text-white border-0">
                  {missedCount} Missed
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Single ScrollArea for call list */}
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-3">
            {calls.map((call) => {
            const phoneNumber = call.direction === 'inbound' ? call.from : call.to;
            const isMissed = call.status === 'missed';
            
            return (
              <div
                key={call.id}
                className={`glass-card p-4 transition-all duration-200 hover:scale-[1.01] ${
                  isMissed ? 'bg-gradient-to-br from-red-50/30 to-red-100/20 dark:from-red-900/20 dark:to-red-950/10' : ''
                }`}
                data-testid={`call-${call.id}`}
              >
                <div className="flex items-center gap-4">
                  {/* Icon */}
                  <div className="flex-shrink-0">
                    {getCallIcon(call)}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`font-medium dark:text-white ${isMissed ? 'text-red-700 dark:text-red-400' : ''}`}>
                        {phoneNumber}
                      </p>
                      {isMissed && (
                        <Badge variant="destructive" className="text-xs">
                          Missed
                        </Badge>
                      )}
                      {call.status === 'voicemail' && (
                        <Badge className="text-xs bg-gradient-to-br from-blue-600 to-purple-600 text-white border-0">
                          Voicemail
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{call.direction === 'inbound' ? 'Incoming' : 'Outgoing'}</span>
                      {call.duration !== null && (
                        <>
                          <span>•</span>
                          <span>{formatCallDuration(call.duration)}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Time */}
                  <div className="text-sm text-muted-foreground text-right hidden sm:block">
                    {formatCallTime(call.timestamp)}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMessage(phoneNumber)}
                      className="h-9 w-9 p-0 transition-all duration-200 hover:scale-110"
                      title="Send message"
                      data-testid={`button-message-${call.id}`}
                    >
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCallBack(phoneNumber)}
                      disabled={callBackMutation.isPending}
                      className="h-9 w-9 p-0 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950 transition-all duration-200 hover:scale-110"
                      title="Call back"
                      data-testid={`button-call-${call.id}`}
                    >
                      <Phone className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedCall(call)}
                      className="h-9 w-9 p-0 transition-all duration-200 hover:scale-110"
                      title="Details"
                      data-testid={`button-info-${call.id}`}
                    >
                      <Info className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
            })}
          </div>
        </ScrollArea>
      </div>
    </>
  );
}
