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

  const { data, isLoading, isError, error } = useQuery({
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

  return (
    <>
      <CallDetailsModal
        call={selectedCall}
        open={!!selectedCall}
        onOpenChange={(open) => !open && setSelectedCall(null)}
        onCallBack={() => selectedCall && handleCallBack(selectedCall.direction === 'inbound' ? selectedCall.from : selectedCall.to)}
        onMessage={() => selectedCall && handleMessage(selectedCall.direction === 'inbound' ? selectedCall.from : selectedCall.to)}
      />
      
      <ScrollArea className="h-full">
        <div className="divide-y dark:divide-gray-800">
          {calls.map((call) => {
          const phoneNumber = call.direction === 'inbound' ? call.from : call.to;
          const isMissed = call.status === 'missed';
          
          return (
            <div
              key={call.id}
              className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                isMissed ? 'bg-red-50/50 dark:bg-red-950/20' : ''
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
                      <Badge variant="default" className="text-xs bg-blue-600">
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
                <div className="text-sm text-muted-foreground text-right">
                  {formatCallTime(call.timestamp)}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleMessage(phoneNumber)}
                    className="h-9 w-9 p-0"
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
                    className="h-9 w-9 p-0 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950"
                    title="Call back"
                    data-testid={`button-call-${call.id}`}
                  >
                    <Phone className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedCall(call)}
                    className="h-9 w-9 p-0"
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
    </>
  );
}
