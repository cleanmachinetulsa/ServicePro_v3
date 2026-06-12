import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Bot,
  User,
  MoreVertical,
  Clock,
  CheckCircle2,
  Inbox,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { AutopilotBanner } from './AutopilotBanner';
import ThreadView from '@/components/ThreadView';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface NightOpsThreadPanelProps {
  conversationId: number | null;
  controlMode?: 'ai' | 'human' | 'hybrid' | 'auto' | 'manual' | 'paused';
  onBack?: () => void;
  onMobileBack?: () => void;
  onTakeOver?: () => void;
  onConversationSelected?: (id: number) => void;
}

export function NightOpsThreadPanel({
  conversationId,
  controlMode = 'auto',
  onBack,
  onMobileBack,
  onTakeOver,
}: NightOpsThreadPanelProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Piggybacks ThreadView's cache key — no extra network request
  const { data: convData } = useQuery<{
    success: boolean;
    data: { customerName: string | null; customerPhone: string; status: string; controlMode: string };
  }>({
    queryKey: [`/api/conversations/${conversationId}`],
    enabled: !!conversationId,
    staleTime: 5000,
  });
  const conv = convData?.data;

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

  const resolveMutation = useMutation({
    mutationFn: async () => {
      if (!conversationId) return;
      const res = await apiRequest('POST', `/api/conversations/${conversationId}/resolve`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      queryClient.invalidateQueries({ queryKey: [`/api/conversations/${conversationId}`] });
      toast({ title: 'Resolved', description: 'Conversation marked as resolved' });
    },
    onError: () => {
      toast({ title: 'Failed to resolve', variant: 'destructive' });
    },
  });

  const snoozeMutation = useMutation({
    mutationFn: async (snoozedUntil: string) => {
      if (!conversationId) return;
      const res = await apiRequest('POST', `/api/conversations/${conversationId}/snooze`, { snoozedUntil });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      toast({ title: 'Snoozed', description: 'Conversation snoozed' });
    },
    onError: () => {
      toast({ title: 'Failed to snooze', variant: 'destructive' });
    },
  });

  if (!conversationId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center" data-testid="thread-empty-state">
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

  const displayName = conv?.customerName || conv?.customerPhone || '…';
  const initials = displayName[0]?.toUpperCase() ?? '?';
  const isManual = controlMode === 'manual' || controlMode === 'human';
  const isAI = controlMode === 'ai' || controlMode === 'auto';

  return (
    <div className="flex flex-col h-full" data-testid="night-ops-thread-panel">
      {/* Single 56px NightOps dark header */}
      <div className="h-14 flex-shrink-0 flex items-center gap-2 px-3 border-b border-slate-700/60 bg-slate-950/80">
        {/* Back button — mobile only */}
        <button
          onClick={() => { onBack?.(); onMobileBack?.(); }}
          className="lg:hidden flex items-center gap-1 text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 rounded-md px-2 py-1.5 -ml-1 transition-colors"
          data-testid="button-back-mobile"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="text-sm">Back</span>
        </button>

        {/* Avatar — customer initials */}
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-cyan-700 to-slate-600 flex items-center justify-center text-white text-sm font-semibold select-none">
          {initials}
        </div>

        {/* Customer name + AI/Manual pill */}
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold text-slate-100 truncate" data-testid="panel-customer-name">
            {displayName}
          </span>
          {isManual && (
            <span className="flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-amber-900/40 text-amber-300 ring-1 ring-amber-700/50">
              <User className="h-2.5 w-2.5" />
              Manual
            </span>
          )}
          {isAI && (
            <span className="flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-cyan-900/40 text-cyan-300 ring-1 ring-cyan-700/50">
              <Bot className="h-2.5 w-2.5" />
              AI
            </span>
          )}
        </div>

        {/* Overflow menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex-shrink-0 h-8 w-8 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 transition-colors"
              data-testid="button-thread-overflow"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-slate-900 border-slate-700 text-slate-200">
            {conv?.status !== 'closed' && (
              <DropdownMenuItem
                onClick={() => resolveMutation.mutate()}
                disabled={resolveMutation.isPending}
                className="focus:bg-slate-800 focus:text-slate-100 cursor-pointer"
                data-testid="menu-resolve"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Resolve
              </DropdownMenuItem>
            )}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="focus:bg-slate-800 focus:text-slate-100 cursor-pointer">
                <Clock className="h-4 w-4 mr-2" />
                Snooze
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="bg-slate-900 border-slate-700">
                <DropdownMenuItem
                  onClick={() => snoozeMutation.mutate(new Date(Date.now() + 60 * 60 * 1000).toISOString())}
                  className="text-slate-200 focus:bg-slate-800 focus:text-slate-100 cursor-pointer"
                >
                  1 hour
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => snoozeMutation.mutate(new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString())}
                  className="text-slate-200 focus:bg-slate-800 focus:text-slate-100 cursor-pointer"
                >
                  4 hours
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() + 1);
                    d.setHours(9, 0, 0, 0);
                    snoozeMutation.mutate(d.toISOString());
                  }}
                  className="text-slate-200 focus:bg-slate-800 focus:text-slate-100 cursor-pointer"
                >
                  Tomorrow 9 AM
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            {isManual && (
              <>
                <DropdownMenuSeparator className="bg-slate-700" />
                <DropdownMenuItem
                  onClick={() => returnToAIMutation.mutate()}
                  disabled={returnToAIMutation.isPending}
                  className="text-cyan-400 focus:bg-slate-800 focus:text-cyan-300 cursor-pointer"
                  data-testid="menu-return-to-ai"
                >
                  <Bot className="h-4 w-4 mr-2" />
                  Hand back to AI
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* AutopilotBanner — existing component, unchanged */}
      <AutopilotBanner
        controlMode={controlMode}
        onTakeOver={onTakeOver || (() => {})}
        onReturnToAI={() => returnToAIMutation.mutate()}
      />

      {/* ThreadView — full engine, both headers suppressed */}
      <div className="flex-1 min-h-0 flex flex-col">
        <ThreadView
          conversationId={conversationId}
          onBack={undefined}
          hideHeader={true}
          suppressCompactHeader={true}
        />
      </div>
    </div>
  );
}
