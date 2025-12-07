import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  Phone, 
  PhoneIncoming, 
  PhoneOutgoing, 
  PhoneMissed,
  Clock,
  Calendar,
  MessageCircle,
  Download,
  PlayCircle
} from 'lucide-react';
import { format, formatDuration, intervalToDuration } from 'date-fns';
import { useLocation } from 'wouter';
import { getProxiedAudioUrl } from '@/lib/twilioMediaProxy';

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

interface CallDetailsModalProps {
  call: Call | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCallBack?: () => void;
  onMessage?: () => void;
}

function formatCallDuration(seconds: number | null): string {
  if (!seconds) return 'N/A';
  const duration = intervalToDuration({ start: 0, end: seconds * 1000 });
  
  if (duration.hours && duration.hours > 0) {
    return `${duration.hours}h ${duration.minutes}m ${duration.seconds}s`;
  } else if (duration.minutes && duration.minutes > 0) {
    return `${duration.minutes}m ${duration.seconds}s`;
  } else {
    return `${duration.seconds}s`;
  }
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    completed: 'bg-green-600',
    missed: 'bg-red-600',
    voicemail: 'bg-blue-600',
    busy: 'bg-yellow-600',
    failed: 'bg-gray-600',
  };
  return colors[status] || 'bg-gray-600';
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    completed: 'Completed',
    missed: 'Missed Call',
    voicemail: 'Voicemail',
    busy: 'Busy',
    failed: 'Failed',
  };
  return labels[status] || status;
}

export default function CallDetailsModal({ 
  call, 
  open, 
  onOpenChange,
  onCallBack,
  onMessage 
}: CallDetailsModalProps) {
  const [, setLocation] = useLocation();

  if (!call) return null;

  const phoneNumber = call.direction === 'inbound' ? call.from : call.to;
  const isMissed = call.status === 'missed';

  const handleMessage = () => {
    if (onMessage) {
      onMessage();
    } else {
      setLocation(`/messages?new=${encodeURIComponent(phoneNumber)}`);
    }
    onOpenChange(false);
  };

  const handleCallBack = () => {
    if (onCallBack) {
      onCallBack();
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {call.direction === 'inbound' ? (
              isMissed ? (
                <PhoneMissed className="h-6 w-6 text-red-600 dark:text-red-400" />
              ) : (
                <PhoneIncoming className="h-6 w-6 text-green-600 dark:text-green-400" />
              )
            ) : (
              <PhoneOutgoing className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            )}
            <span>Call Details</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Phone Number */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">
                {call.direction === 'inbound' ? 'From' : 'To'}
              </p>
              <p className="text-2xl font-semibold dark:text-white">{phoneNumber}</p>
            </div>
            <Badge className={getStatusColor(call.status)}>
              {getStatusLabel(call.status)}
            </Badge>
          </div>

          <Separator />

          {/* Call Info Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <p className="text-sm">Date</p>
              </div>
              <p className="font-medium dark:text-white">
                {format(new Date(call.timestamp), 'MMM d, yyyy')}
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <p className="text-sm">Time</p>
              </div>
              <p className="font-medium dark:text-white">
                {format(new Date(call.timestamp), 'h:mm a')}
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4" />
                <p className="text-sm">Direction</p>
              </div>
              <p className="font-medium dark:text-white capitalize">
                {call.direction}
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <p className="text-sm">Duration</p>
              </div>
              <p className="font-medium dark:text-white">
                {formatCallDuration(call.duration)}
              </p>
            </div>
          </div>

          {/* Recording */}
          {call.recordingUrl && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <PlayCircle className="h-4 w-4" />
                  <p className="text-sm">Recording Available</p>
                </div>
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => window.open(getProxiedAudioUrl(call.recordingUrl) || '#', '_blank')}
                  data-testid="button-download-recording"
                >
                  <Download className="h-4 w-4" />
                  Download Recording
                </Button>
              </div>
            </>
          )}

          <Separator />

          {/* Actions */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={handleCallBack}
              data-testid="button-modal-callback"
            >
              <Phone className="h-4 w-4" />
              Call Back
            </Button>
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={handleMessage}
              data-testid="button-modal-message"
            >
              <MessageCircle className="h-4 w-4" />
              Send Message
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
