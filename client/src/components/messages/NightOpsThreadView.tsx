import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  MessageSquare,
  Inbox,
  Sparkles,
  ArrowLeftRight,
  Phone,
  Globe,
  Mail,
} from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';
import type { IconType } from 'react-icons';
import { SiFacebook, SiInstagram } from 'react-icons/si';

type ChannelIcon = ComponentType<SVGProps<SVGSVGElement> & { className?: string }> | IconType;
type ChannelKey = 'sms' | 'web' | 'email' | 'facebook' | 'instagram';
interface ChannelOption { value: ChannelKey; label: string; icon: ChannelIcon }
interface SwitchChannelResponse {
  success: boolean;
  data?: { targetConversationId: number; platform: ChannelKey };
  message?: string;
}
import { useEffect } from 'react';
import ThreadView from '@/components/ThreadView';
import { AutopilotBanner } from './AutopilotBanner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMessagingSocket } from '@/contexts/MessagingSocketContext';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface NightOpsThreadViewProps {
  conversationId: number | null;
  onBack?: () => void;
  onTakeOver?: () => void;
  controlMode?: 'ai' | 'human' | 'hybrid' | 'auto' | 'manual' | 'paused';
  // Audit T3 Task #21: select a sibling conversation after channel switch
  onConversationSelected?: (id: number) => void;
}

export function NightOpsThreadView({
  conversationId,
  onBack,
  onTakeOver,
  controlMode = 'auto',
  onConversationSelected,
}: NightOpsThreadViewProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Return-to-AI mutation — wires the "Hand back to AI" button in AutopilotBanner
  const returnToAIMutation = useMutation({
    mutationFn: async () => {
      if (!conversationId) return;
      const res = await apiRequest('POST', `/api/conversations/${conversationId}/return-to-ai`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      toast({ title: 'AI resumed', description: 'Conversation handed back to AI autopilot' });
    },
    onError: () => {
      toast({ title: 'Failed to hand back', variant: 'destructive' });
    },
  });

  if (!conversationId) {
    return (
      <div
        className="flex-1 flex flex-col items-center justify-center p-8 text-center"
        data-testid="thread-empty-state"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="w-20 h-20 rounded-full bg-slate-800/60 flex items-center justify-center mb-6 ring-1 ring-slate-700/60"
        >
          <Inbox className="h-10 w-10 text-slate-600" />
        </motion.div>
        <motion.h3
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          className="text-lg font-semibold text-slate-200 mb-2"
        >
          Select a conversation
        </motion.h3>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.3 }}
          className="text-sm text-slate-500 max-w-sm"
        >
          Choose a conversation from the inbox to view messages and start communicating
        </motion.p>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.3 }}
          className="mt-6 text-xs text-slate-600"
        >
          <kbd className="px-2 py-1 rounded bg-slate-800/60 border border-slate-700/50 mr-1">↑</kbd>
          <kbd className="px-2 py-1 rounded bg-slate-800/60 border border-slate-700/50">↓</kbd>
          <span className="ml-2">to navigate</span>
          <span className="mx-2 text-slate-700">·</span>
          <kbd className="px-2 py-1 rounded bg-slate-800/60 border border-slate-700/50">?</kbd>
          <span className="ml-2">for shortcuts</span>
        </motion.div>
      </div>
    );
  }

  return (
    <div
      className="flex-1 flex flex-col min-h-0 nightops-thread-wrapper"
      data-testid="thread-view"
    >
      {onBack && (
        <div className="p-2 border-b border-slate-700/40 lg:hidden">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="text-slate-300 hover:text-slate-100 hover:bg-slate-800/60"
            data-testid="button-back-mobile"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
      )}

      <div className="border-b border-slate-700/40">
        <AutopilotBanner
          controlMode={controlMode}
          onTakeOver={onTakeOver || (() => {})}
          onReturnToAI={() => returnToAIMutation.mutate()}
        />
      </div>

      {/* Audit T3 Task #21: thread summary banner + channel switch action */}
      <ThreadActionsRow
        conversationId={conversationId}
        onConversationSelected={onConversationSelected}
      />
      <ThreadSummaryBanner conversationId={conversationId} />

      <div className="flex-1 min-h-0 flex flex-col nightops-threadview-container">
        <ThreadView
          conversationId={conversationId}
          onBack={undefined}
          hideHeader={true}
        />
      </div>
    </div>
  );
}

// Audit T3 Task #21: lazy thread summary using gpt-4o-mini. Server returns
// null summary if the thread has <= 20 messages, in which case we hide.
function ThreadSummaryBanner({ conversationId }: { conversationId: number }) {
  const queryClient = useQueryClient();
  const { socket: sharedSocket } = useMessagingSocket();
  const { data, isLoading } = useQuery<{
    success: boolean;
    data: { summary: string | null; messageCount: number; cached?: boolean };
  }>({
    queryKey: ['/api/conversations', conversationId, 'summary'],
    queryFn: async () => {
      const res = await fetch(`/api/conversations/${conversationId}/summary`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to load summary');
      return res.json();
    },
    enabled: !!conversationId,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!conversationId || !sharedSocket) return;
    const invalidate = () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/conversations', conversationId, 'summary'],
      });
    };
    sharedSocket.on('new_message', invalidate);
    sharedSocket.on('conversation_updated', invalidate);
    return () => {
      sharedSocket.off('new_message', invalidate);
      sharedSocket.off('conversation_updated', invalidate);
    };
  }, [conversationId, queryClient, sharedSocket]);

  const summary = data?.data?.summary;
  if (isLoading) return null;
  if (!summary) return null;
  return (
    <div
      className="px-4 py-2 border-b border-slate-700/40 bg-slate-900/60"
      data-testid="thread-summary-banner"
    >
      <div className="flex items-start gap-2">
        <Sparkles className="h-3.5 w-3.5 text-cyan-400 mt-0.5 flex-shrink-0" />
        <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
          {summary}
        </div>
      </div>
    </div>
  );
}

// Audit T3 Task #21: channel switch dropdown. Sends a handoff message on the
// current channel and creates/finds the sibling conversation on the target.
function ThreadActionsRow({
  conversationId,
  onConversationSelected,
}: {
  conversationId: number;
  onConversationSelected?: (id: number) => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const channels: ChannelOption[] = [
    { value: 'sms', label: 'SMS', icon: Phone },
    { value: 'web', label: 'Web chat', icon: Globe },
    { value: 'email', label: 'Email', icon: Mail },
    { value: 'facebook', label: 'Facebook', icon: SiFacebook },
    { value: 'instagram', label: 'Instagram', icon: SiInstagram },
  ];

  const switchMutation = useMutation<SwitchChannelResponse, Error, ChannelKey>({
    mutationFn: async (to) => {
      const res = await apiRequest('POST', `/api/conversations/${conversationId}/switch-channel`, { to });
      return res.json();
    },
    onSuccess: (json) => {
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      const targetId = json?.data?.targetConversationId;
      if (targetId && onConversationSelected) onConversationSelected(targetId);
      toast({ title: 'Channel switched', description: `Continuing on ${json?.data?.platform?.toUpperCase() ?? ''}` });
    },
    onError: (err) => {
      toast({
        title: 'Switch failed',
        description: err?.message || 'Could not switch channel',
        variant: 'destructive',
      });
    },
  });

  return (
    <div className="px-3 py-1.5 border-b border-slate-700/40 flex items-center justify-end gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            data-testid="button-switch-channel"
          >
            <ArrowLeftRight className="h-3.5 w-3.5 mr-1.5" />
            Switch channel
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-slate-900 border-slate-700">
          <DropdownMenuLabel className="text-xs text-slate-400">Continue on...</DropdownMenuLabel>
          {channels.map(c => {
            const Icon = c.icon;
            return (
              <DropdownMenuItem
                key={c.value}
                onClick={() => switchMutation.mutate(c.value)}
                disabled={switchMutation.isPending}
                className="text-slate-200 focus:bg-slate-800 focus:text-slate-100 cursor-pointer"
                data-testid={`switch-channel-${c.value}`}
              >
                <Icon className="h-3.5 w-3.5 mr-2" />
                {c.label}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
