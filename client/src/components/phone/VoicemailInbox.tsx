import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { 
  Play, 
  Pause,
  Voicemail,
  Trash2,
  Phone,
  MessageCircle,
  Download,
  Volume2
} from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { VoicemailSkeleton } from './SkeletonLoader';

interface VoicemailMessage {
  id: number;
  from: string;
  duration: number;
  timestamp: string;
  transcription: string | null;
  recordingUrl: string;
  isNew: boolean;
}

function AudioPlayer({ url, onEnded }: { url: string; onEnded?: () => void }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      onEnded?.();
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [onEnded]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (value: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = value[0];
    setCurrentTime(value[0]);
  };

  const handleVolumeChange = (value: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = value[0];
    setVolume(value[0]);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-2">
      <audio ref={audioRef} src={url} preload="metadata" />
      
      <div className="flex items-center gap-3">
        <Button
          variant={isPlaying ? 'default' : 'outline'}
          size="sm"
          onClick={togglePlay}
          className="rounded-full h-10 w-10 p-0 flex-shrink-0"
          data-testid="button-audio-play"
        >
          {isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4 ml-0.5" />
          )}
        </Button>

        <div className="flex-1 space-y-1">
          <Slider
            value={[currentTime]}
            max={duration || 100}
            step={0.1}
            onValueChange={handleSeek}
            className="cursor-pointer"
            data-testid="audio-seekbar"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 w-24">
          <Volume2 className="h-4 w-4 text-muted-foreground" />
          <Slider
            value={[volume]}
            max={1}
            step={0.01}
            onValueChange={handleVolumeChange}
            className="cursor-pointer"
            data-testid="audio-volume"
          />
        </div>
      </div>
    </div>
  );
}

export default function VoicemailInbox() {
  const [playingId, setPlayingId] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['/api/voicemail/inbox'],
    retry: 3,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/voicemail/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/voicemail/inbox'] });
      toast({ title: 'Voicemail deleted' });
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('POST', `/api/voicemail/${id}/mark-read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/voicemail/inbox'] });
    },
  });

  const voicemails: VoicemailMessage[] = data?.voicemails || [];
  const newCount = voicemails.filter(v => v.isNew).length;

  const handlePlay = (voicemail: VoicemailMessage) => {
    if (playingId === voicemail.id) {
      setPlayingId(null);
    } else {
      setPlayingId(voicemail.id);
      if (voicemail.isNew) {
        markAsReadMutation.mutate(voicemail.id);
      }
    }
  };

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

  const handleCallBack = (phoneNumber: string) => {
    callBackMutation.mutate(phoneNumber);
  };

  const handleMessage = (phoneNumber: string) => {
    setLocation(`/messages?new=${encodeURIComponent(phoneNumber)}`);
  };

  if (isLoading) {
    return (
      <div className="h-full flex flex-col">
        <ScrollArea className="flex-1">
          <VoicemailSkeleton />
        </ScrollArea>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center px-4">
          <Voicemail className="h-16 w-16 mx-auto mb-4 text-destructive" />
          <h3 className="text-lg font-semibold mb-2 dark:text-white">Unable to load voicemail</h3>
          <p className="text-muted-foreground mb-4">
            {error instanceof Error ? error.message : 'Connection error. Please check your internet.'}
          </p>
          <Button 
            variant="outline" 
            onClick={() => refetch()}
            data-testid="button-retry-voicemail"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (voicemails.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center px-4">
          <Voicemail className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2 dark:text-white">No voicemails</h3>
          <p className="text-muted-foreground">
            Voicemail messages will appear here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      {newCount > 0 && (
        <div className="bg-blue-50 dark:bg-blue-950/30 border-b dark:border-blue-800 px-4 py-3">
          <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">
            You have {newCount} new voicemail{newCount > 1 ? 's' : ''}
          </p>
        </div>
      )}

      {/* List */}
      <ScrollArea className="flex-1">
        <div className="divide-y dark:divide-gray-800">
          {voicemails.map((voicemail) => (
            <div
              key={voicemail.id}
              className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                voicemail.isNew ? 'bg-blue-50/30 dark:bg-blue-950/10' : ''
              }`}
              data-testid={`voicemail-${voicemail.id}`}
            >
              <div className="space-y-3">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <p className="font-medium dark:text-white">{voicemail.from}</p>
                    {voicemail.isNew && (
                      <Badge className="bg-blue-600">New</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(voicemail.timestamp), 'MMM d, h:mm a')}
                  </p>
                </div>

                {/* Audio Player */}
                {playingId === voicemail.id ? (
                  <AudioPlayer 
                    url={voicemail.recordingUrl}
                    onEnded={() => setPlayingId(null)}
                  />
                ) : (
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => handlePlay(voicemail)}
                    className="w-full gap-2"
                    data-testid={`button-play-${voicemail.id}`}
                  >
                    <Play className="h-5 w-5" />
                    Play Voicemail ({Math.floor(voicemail.duration / 60)}:{(voicemail.duration % 60).toString().padStart(2, '0')})
                  </Button>
                )}
                
                {/* Transcription */}
                {voicemail.transcription && (
                  <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1 font-medium">Transcription:</p>
                    <p className="text-sm dark:text-gray-300 italic">
                      "{voicemail.transcription}"
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCallBack(voicemail.from)}
                    disabled={callBackMutation.isPending}
                    className="gap-2"
                    data-testid={`button-callback-${voicemail.id}`}
                  >
                    <Phone className="h-3.5 w-3.5" />
                    Call Back
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleMessage(voicemail.from)}
                    className="gap-2"
                    data-testid={`button-message-${voicemail.id}`}
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    Message
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(voicemail.recordingUrl, '_blank')}
                    className="gap-2"
                    data-testid={`button-download-${voicemail.id}`}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteMutation.mutate(voicemail.id)}
                    disabled={deleteMutation.isPending}
                    className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950 ml-auto"
                    data-testid={`button-delete-${voicemail.id}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
