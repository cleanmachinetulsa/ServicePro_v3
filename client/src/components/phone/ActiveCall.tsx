import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { 
  PhoneOff, 
  Mic, 
  MicOff,
  Volume2,
  VolumeX,
  Pause,
  Play,
  User
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ActiveCallProps {
  callId: number;
  onEnd: () => void;
}

export default function ActiveCall({ callId, onEnd }: ActiveCallProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [isHeld, setIsHeld] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch call details
  const { data } = useQuery({
    queryKey: ['/api/calls', callId],
    refetchInterval: 1000, // Poll every second
  });

  const call = data?.call;

  // Timer for call duration
  useEffect(() => {
    if (call?.status === 'in-progress') {
      const interval = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [call?.status]);

  // End call mutation
  const endCallMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', `/api/calls/${callId}/end`);
    },
    onSuccess: () => {
      toast({ title: 'Call ended' });
      queryClient.invalidateQueries({ queryKey: ['/api/calls/recent'] });
      onEnd();
    },
  });

  // Mute mutation
  const muteMutation = useMutation({
    mutationFn: async (muted: boolean) => {
      return await apiRequest('POST', `/api/calls/${callId}/mute`, { muted });
    },
    onSuccess: (_, muted) => {
      setIsMuted(muted);
    },
  });

  // Hold mutation
  const holdMutation = useMutation({
    mutationFn: async (held: boolean) => {
      return await apiRequest('POST', `/api/calls/${callId}/hold`, { held });
    },
    onSuccess: (_, held) => {
      setIsHeld(held);
    },
  });

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const phoneNumber = call?.direction === 'outbound' ? call.to : call.from;
  const callStatus = call?.status || 'connecting';

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-blue-600 to-purple-700 z-50 flex items-center justify-center">
      <div className="text-center text-white px-8 max-w-md w-full">
        {/* Avatar */}
        <div className="mb-8">
          <div className="w-32 h-32 bg-white/20 rounded-full mx-auto flex items-center justify-center backdrop-blur-sm">
            <User className="h-16 w-16" />
          </div>
        </div>

        {/* Phone Number */}
        <h2 className="text-3xl font-light mb-2 tracking-wide">{phoneNumber}</h2>

        {/* Call Status */}
        <p className="text-xl text-white/80 mb-8">
          {callStatus === 'in-progress' ? formatDuration(callDuration) : 
           callStatus === 'ringing' ? 'Ringing...' :
           callStatus === 'connecting' ? 'Connecting...' : 
           callStatus}
        </p>

        {/* Call Controls */}
        <div className="grid grid-cols-3 gap-6 mb-12 max-w-xs mx-auto">
          {/* Mute */}
          <div className="flex flex-col items-center gap-2">
            <Button
              variant={isMuted ? 'default' : 'secondary'}
              size="lg"
              onClick={() => muteMutation.mutate(!isMuted)}
              disabled={muteMutation.isPending}
              className={`rounded-full h-16 w-16 p-0 ${
                isMuted 
                  ? 'bg-white text-blue-600 hover:bg-white/90' 
                  : 'bg-white/20 hover:bg-white/30 backdrop-blur-sm'
              }`}
              data-testid="button-mute"
            >
              {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
            </Button>
            <span className="text-sm">Mute</span>
          </div>

          {/* Speaker */}
          <div className="flex flex-col items-center gap-2">
            <Button
              variant={isSpeaker ? 'default' : 'secondary'}
              size="lg"
              onClick={() => setIsSpeaker(!isSpeaker)}
              className={`rounded-full h-16 w-16 p-0 ${
                isSpeaker 
                  ? 'bg-white text-blue-600 hover:bg-white/90' 
                  : 'bg-white/20 hover:bg-white/30 backdrop-blur-sm'
              }`}
              data-testid="button-speaker"
            >
              {isSpeaker ? <Volume2 className="h-6 w-6" /> : <VolumeX className="h-6 w-6" />}
            </Button>
            <span className="text-sm">Speaker</span>
          </div>

          {/* Hold */}
          <div className="flex flex-col items-center gap-2">
            <Button
              variant={isHeld ? 'default' : 'secondary'}
              size="lg"
              onClick={() => holdMutation.mutate(!isHeld)}
              disabled={holdMutation.isPending}
              className={`rounded-full h-16 w-16 p-0 ${
                isHeld 
                  ? 'bg-white text-blue-600 hover:bg-white/90' 
                  : 'bg-white/20 hover:bg-white/30 backdrop-blur-sm'
              }`}
              data-testid="button-hold"
            >
              {isHeld ? <Play className="h-6 w-6" /> : <Pause className="h-6 w-6" />}
            </Button>
            <span className="text-sm">Hold</span>
          </div>
        </div>

        {/* End Call Button */}
        <Button
          onClick={() => endCallMutation.mutate()}
          disabled={endCallMutation.isPending}
          className="rounded-full h-20 w-20 bg-red-600 hover:bg-red-700 p-0 shadow-2xl mx-auto"
          data-testid="button-end-call"
        >
          <PhoneOff className="h-8 w-8" />
        </Button>
      </div>
    </div>
  );
}
