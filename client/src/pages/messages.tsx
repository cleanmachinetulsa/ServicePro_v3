import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ButtonWithTooltip, TooltipButtonGroup } from '@/components/ui/button-with-tooltip';
import { PhoneLineProvider, usePhoneLine } from '@/contexts/PhoneLineContext';
import { useLocation, useSearch } from 'wouter';
import { 
  PlusCircle, 
  Phone,
  CalendarDays,
  LayoutDashboard,
  Keyboard,
  CheckCircle2,
  Clock,
  Archive,
  X,
  MailOpen,
  UserPlus,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { shouldHandleHotkey } from '@/lib/messagesHotkeys';
import { MessagingSocketProvider, useMessagingSocket } from '@/contexts/MessagingSocketContext';

// Audit T3 Task #21: bulk-action contracts shared between page and API
interface StaffUser {
  id: number;
  username: string;
  fullName: string | null;
  isActive: boolean | null;
}
type BulkAction = 'mark-read' | 'snooze' | 'resolve' | 'archive' | 'assign';
interface BulkActionPayload {
  agentUsername?: string;
  snoozedUntil?: string;
}

import { NightOpsMessagesLayout } from '@/components/messages/NightOpsMessagesLayout';
import { NightOpsConversationList } from '@/components/messages/NightOpsConversationList';
import { NightOpsThreadPanel } from '@/components/messages/NightOpsThreadPanel';
import { NightOpsContextPanel } from '@/components/messages/NightOpsContextPanel';
import Composer from '@/components/messages/Composer';
import { useToast } from '@/hooks/use-toast';
import { ShareAvailabilityModal } from '@/components/ShareAvailabilityModal';
import { apiRequest } from '@/lib/queryClient';
import { useCustomerSidebarData } from '@/hooks/useCustomerSidebarData';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

interface Conversation {
  id: number;
  customerName: string | null;
  customerPhone: string;
  platform: string;
  controlMode: string;
  needsHumanAttention: boolean;
  lastMessageTime: string;
  messageCount: number;
  latestMessage: {
    content: string;
    sender: string;
    timestamp: string;
  } | null;
  status: string;
  unreadCount: number;
  starred: boolean;
  archived: boolean;
  pinned: boolean;
  pinnedAt: string | null;
  archivedAt: string | null;
  starredAt: string | null;
  phoneLineId: number | null;
}

function MessagesPageContent() {
  const { conversationFilter } = usePhoneLine();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const [selectedConversation, setSelectedConversation] = useState<number | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showComposeDialog, setShowComposeDialog] = useState(false);
  const [showShareAvailabilityModal, setShowShareAvailabilityModal] = useState(false);
  const [includeWebchatInAll, setIncludeWebchatInAll] = useState(false);
  // Audit T3 Task #21: bulk selection + cheatsheet modal
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showCheatsheet, setShowCheatsheet] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Get current user for takeover functionality
  const { data: currentUserData } = useQuery<{
    success: boolean;
    user: { id: number; username: string; role: string };
  }>({
    queryKey: ['/api/users/me'],
  });
  const currentUser = currentUserData?.user;

  const { data: conversationsData, isLoading } = useQuery<{ success: boolean; data: Conversation[] }>({
    queryKey: ['/api/conversations', filter, conversationFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ status: filter });
      if (conversationFilter !== null) {
        params.append('phoneLineId', conversationFilter.toString());
      }
      const response = await apiRequest('GET', `/api/conversations?${params.toString()}`);
      return response.json();
    },
    refetchInterval: 10000,
  });

  const conversations = conversationsData?.data || [];

  useEffect(() => {
    const params = new URLSearchParams(search);
    const phoneParam = params.get('phone');
    const conversationParam = params.get('conversation');
    
    if (conversations.length === 0) return;
    
    if (phoneParam) {
      const matchingConv = conversations.find(c => c.customerPhone === phoneParam);
      if (matchingConv) {
        setSelectedConversation(matchingConv.id);
        setLocation('/messages', { replace: true });
      }
    } else if (conversationParam) {
      const conversationId = parseInt(conversationParam, 10);
      if (!isNaN(conversationId)) {
        setSelectedConversation(conversationId);
        setLocation('/messages', { replace: true });
      }
    }
  }, [search, conversations, setLocation]);

  const filteredConversations = conversations.filter((conv) => {
    let categoryMatch = false;
    switch (filter) {
      case 'all': 
        // Exclude webchat by default in "All" tab unless toggle is enabled
        categoryMatch = includeWebchatInAll ? true : conv.platform !== 'web';
        break;
      case 'attention':
        // Audit T2: "Needs you" = needs_human_attention OR control_mode = 'manual'
        // (manual takeovers don't always set needsHumanAttention)
        categoryMatch =
          (conv.needsHumanAttention || conv.controlMode === 'manual') &&
          conv.status !== 'resolved' &&
          conv.status !== 'closed';
        break;
      case 'unread':
        categoryMatch = (conv.unreadCount ?? 0) > 0;
        break;
      case 'sms': categoryMatch = conv.platform === 'sms'; break;
      case 'web': categoryMatch = conv.platform === 'web'; break;
      case 'facebook': categoryMatch = conv.platform === 'facebook'; break;
      case 'instagram': categoryMatch = conv.platform === 'instagram'; break;
      case 'email': categoryMatch = conv.platform === 'email'; break;
      default: categoryMatch = true; break;
    }
    if (!categoryMatch) return false;
    if (!searchQuery.trim()) return true;
    
    const searchLower = searchQuery.toLowerCase();
    return (
      conv.customerName?.toLowerCase().includes(searchLower) ||
      conv.customerPhone?.includes(searchLower) ||
      conv.latestMessage?.content?.toLowerCase().includes(searchLower)
    );
  });

  // Audit T2: thread-aware grouping. Collapse multiple conversations for the
  // same customer (matched by normalized phone, falling back to id) into a
  // single representative thread row. The representative is the most recently
  // active conversation; unreadCount, needsHumanAttention, controlMode='manual',
  // pinned, and starred are aggregated across sibling channels so the row
  // surfaces the strongest signal regardless of which channel triggered it.
  const normalizePhone = (p: string | null | undefined) =>
    (p || '').replace(/[^\d+]/g, '').toLowerCase();
  const threadGroups = new Map<string, Conversation[]>();
  filteredConversations.forEach(conv => {
    const key = normalizePhone(conv.customerPhone) || `id:${conv.id}`;
    if (!threadGroups.has(key)) threadGroups.set(key, []);
    threadGroups.get(key)!.push(conv);
  });
  const threadRows = Array.from(threadGroups.values()).map(group => {
    const sorted = [...group].sort(
      (a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime(),
    );
    const rep = sorted[0];
    const unreadCount = group.reduce((s, c) => s + (c.unreadCount ?? 0), 0);
    const needsHumanAttention = group.some(c => c.needsHumanAttention);
    const controlMode = group.some(c => c.controlMode === 'manual') ? 'manual' : rep.controlMode;
    const pinned = group.some(c => c.pinned);
    const starred = group.some(c => c.starred);
    const reachableChannels = Array.from(new Set(group.map(c => c.platform)));
    const siblingConversationIds = group.map(c => c.id);
    return {
      ...rep,
      unreadCount,
      needsHumanAttention,
      controlMode,
      pinned,
      starred,
      reachableChannels,
      siblingConversationIds,
    } as Conversation & { reachableChannels: string[]; siblingConversationIds: number[] };
  });
  const sortedConversations = threadRows.sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
  });

  const handleTakeOver = async () => {
    if (!selectedConversation) return;

    try {
      // Pass the current user's username for agent assignment
      const agentUsername = currentUser?.username || 'admin';
      await apiRequest('POST', `/api/conversations/${selectedConversation}/takeover`, {
        agentUsername,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      toast({
        title: 'Control taken',
        description: 'You now have manual control of this conversation',
      });
    } catch (error) {
      console.error('Failed to take control:', error);
      toast({
        title: 'Failed to take control',
        description: 'Could not switch to manual mode',
        variant: 'destructive',
      });
    }
  };

  const { socket: sharedSocket } = useMessagingSocket();

  useEffect(() => {
    if (!sharedSocket) return;

    const handleConnect = () => {
      sharedSocket.emit('join_monitoring');
    };
    const handleNewMessage = () => {
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      if (selectedConversation) {
        queryClient.invalidateQueries({
          queryKey: ['/api/conversations', selectedConversation, 'summary'],
        });
        queryClient.invalidateQueries({
          queryKey: ['/api/conversations', selectedConversation, 'ai-usage'],
        });
      }
    };
    const handleConversationUpdated = () => {
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
    };
    const handleControlModeChanged = () => {
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
    };

    if (sharedSocket.connected) handleConnect();
    sharedSocket.on('connect', handleConnect);
    sharedSocket.on('new_message', handleNewMessage);
    sharedSocket.on('conversation_updated', handleConversationUpdated);
    sharedSocket.on('control_mode_changed', handleControlModeChanged);

    return () => {
      sharedSocket.emit('leave_monitoring');
      sharedSocket.off('connect', handleConnect);
      sharedSocket.off('new_message', handleNewMessage);
      sharedSocket.off('conversation_updated', handleConversationUpdated);
      sharedSocket.off('control_mode_changed', handleControlModeChanged);
    };
  }, [queryClient, sharedSocket]);

  const selectedConv = conversations.find(c => c.id === selectedConversation);
  const { customerInfo, isLoading: isLoadingCustomer } = useCustomerSidebarData(selectedConversation);

  const { data: phoneLinesData } = useQuery<{ success: boolean; lines: { id: number; label: string; phoneNumber: string; isActive: boolean }[] }>({
    queryKey: ['/api/phone-settings/lines'],
  });
  const phoneLines = phoneLinesData?.lines || [];

  // Audit T3 Task #21: selection helpers
  const toggleSelected = useCallback((id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);
  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  // Map of representative id -> [siblingConversationIds] so bulk actions on a
  // thread row can fan out to every sibling conversation (e.g. archive both
  // SMS and web rows for the same customer).
  // Build sibling map from the UNFILTERED conversations list so that bulk
  // actions on a thread row still fan out to channel siblings hidden by the
  // current filter (e.g. webchat off in "All"). Otherwise archiving from the
  // SMS view would orphan the customer's web/email conversations.
  const siblingMap = useMemo(() => {
    const groups = new Map<string, number[]>();
    for (const c of conversations) {
      const key = normalizePhone(c.customerPhone) || `id:${c.id}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(c.id);
    }
    const m = new Map<number, number[]>();
    for (const c of conversations) {
      const key = normalizePhone(c.customerPhone) || `id:${c.id}`;
      m.set(c.id, groups.get(key) || [c.id]);
    }
    return m;
  }, [conversations]);

  const expandedSelectedIds = useMemo(() => {
    const out = new Set<number>();
    selectedIds.forEach(id => {
      (siblingMap.get(id) || [id]).forEach(sid => out.add(sid));
    });
    return Array.from(out);
  }, [selectedIds, siblingMap]);

  // Audit T3 Task #21: staff users for bulk assign menu
  const { data: staffData } = useQuery<{ success: boolean; users: StaffUser[] }>({
    queryKey: ['/api/users/all'],
  });
  const staffUsers = (staffData?.users || []).filter(u => u.isActive !== false);

  const bulkMutation = useMutation<
    { success: boolean; data: { action: BulkAction; requested: number; updated: number } },
    Error,
    { action: BulkAction; payload?: BulkActionPayload }
  >({
    mutationFn: async ({ action, payload }) => {
      const res = await apiRequest('POST', '/api/conversations/bulk-action', {
        action,
        ids: expandedSelectedIds,
        payload,
      });
      return res.json();
    },
    onSuccess: (json, { action }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      clearSelection();
      toast({
        title: 'Bulk update applied',
        description: `${action} → ${json?.data?.updated ?? 0} conversation(s)`,
      });
    },
    onError: (err) => {
      toast({
        title: 'Bulk update failed',
        description: err?.message || 'Could not apply action',
        variant: 'destructive',
      });
    },
  });

  // ----- Audit T3 Task #21: keyboard shortcuts -----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const allow = shouldHandleHotkey({
        key: e.key,
        metaKey: e.metaKey,
        ctrlKey: e.ctrlKey,
        altKey: e.altKey,
        target,
      });

      // Always allow Esc even from inputs.
      if (e.key === 'Escape') {
        if (showCheatsheet) setShowCheatsheet(false);
        if (selectedIds.size > 0) clearSelection();
        return;
      }
      if (!allow) return;

      const key = e.key;
      // ? cheatsheet (Shift + /)
      if (key === '?') {
        e.preventDefault();
        setShowCheatsheet(v => !v);
        return;
      }
      if (key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (key === 'j' || key === 'k') {
        e.preventDefault();
        if (sortedConversations.length === 0) return;
        const curr = selectedConversation
          ? sortedConversations.findIndex(c => c.id === selectedConversation)
          : -1;
        const len = sortedConversations.length;
        const next = key === 'j'
          ? (curr < len - 1 ? curr + 1 : 0)
          : (curr > 0 ? curr - 1 : len - 1);
        setSelectedConversation(sortedConversations[next].id);
        return;
      }

      if (!selectedConversation) return;
      switch (key) {
        case 'e':
          e.preventDefault();
          apiRequest('POST', `/api/conversations/${selectedConversation}/resolve`)
            .then(() => {
              queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
              toast({ title: 'Resolved', description: 'Conversation marked as resolved' });
            })
            .catch(() => toast({ title: 'Failed to resolve', variant: 'destructive' }));
          break;
        case 'r':
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('composer:focus', {
            detail: { conversationId: selectedConversation },
          }));
          break;
        case 's': {
          e.preventDefault();
          const until = new Date(Date.now() + 60 * 60 * 1000).toISOString();
          apiRequest('POST', `/api/conversations/${selectedConversation}/snooze`, { snoozedUntil: until })
            .then(() => {
              queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
              toast({ title: 'Snoozed', description: 'Snoozed for 1 hour' });
            })
            .catch(() => toast({ title: 'Snooze failed', variant: 'destructive' }));
          break;
        }
        case 't':
          e.preventDefault();
          handleTakeOver();
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    sortedConversations,
    selectedConversation,
    showCheatsheet,
    selectedIds.size,
    clearSelection,
    queryClient,
    toast,
  ]);

  const conversationListNode = (
    <NightOpsConversationList
      conversations={sortedConversations}
      selectedId={selectedConversation}
      onSelect={setSelectedConversation}
      isLoading={isLoading}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      filter={filter}
      onFilterChange={setFilter}
      phoneLines={phoneLines}
      includeWebchatInAll={includeWebchatInAll}
      onIncludeWebchatToggle={setIncludeWebchatInAll}
      selectedIds={selectedIds}
      onToggleSelected={toggleSelected}
      searchInputRef={searchInputRef}
    />
  );

  const threadViewNode = (onMobileBack: () => void) => (
    <NightOpsThreadPanel
      conversationId={selectedConversation}
      onBack={() => setSelectedConversation(null)}
      onMobileBack={onMobileBack}
      onTakeOver={handleTakeOver}
      controlMode={
        (selectedConv?.controlMode as
          | 'ai'
          | 'human'
          | 'hybrid'
          | 'auto'
          | 'manual'
          | 'paused'
          | undefined) ?? 'auto'
      }
      onConversationSelected={setSelectedConversation}
    />
  );

  const contextPanelNode = (
    <NightOpsContextPanel
      customerInfo={selectedConversation ? customerInfo : null}
      isLoading={selectedConversation ? isLoadingCustomer : false}
      hasSelectedConversation={!!selectedConversation}
      conversationId={selectedConversation}
      onBookAppointment={
        selectedConv
          ? () => {
              const params = new URLSearchParams({
                phone: selectedConv.customerPhone || '',
              });
              if (selectedConv.customerName) params.set('name', selectedConv.customerName);
              setLocation(`/bookings/new?${params.toString()}`);
            }
          : undefined
      }
    />
  );

  return (
    <>
      <NightOpsMessagesLayout
        conversationList={conversationListNode}
        threadView={threadViewNode}
        contextPanel={contextPanelNode}
        showContextPanel={!!selectedConversation}
        selectedConversationId={selectedConversation}
        headerActions={
          <TooltipButtonGroup delayDuration={150}>
            <div className="flex items-center gap-2">
              <ButtonWithTooltip 
                size="sm" 
                onClick={() => setLocation('/dashboard')}
                data-testid="button-dashboard"
                className="nightops-button text-xs"
                tooltip="Go to Dashboard"
                tooltipSide="bottom"
              >
                <LayoutDashboard className="h-3.5 w-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Dashboard</span>
              </ButtonWithTooltip>
              <ButtonWithTooltip 
                size="sm" 
                onClick={() => setShowComposeDialog(true)}
                data-testid="button-compose"
                className="nightops-button text-xs"
                tooltip="Compose new message"
                tooltipSide="bottom"
              >
                <PlusCircle className="h-3.5 w-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">New</span>
              </ButtonWithTooltip>
              {selectedConversation && (
                <>
                  <ButtonWithTooltip 
                    size="sm" 
                    onClick={() => setShowShareAvailabilityModal(true)}
                    data-testid="button-share-availability"
                    className="nightops-button text-xs"
                    tooltip="Share calendar availability"
                    tooltipSide="bottom"
                  >
                    <CalendarDays className="h-3.5 w-3.5 sm:mr-1.5" />
                    <span className="hidden sm:inline">Share</span>
                  </ButtonWithTooltip>
                </>
              )}
              <ButtonWithTooltip 
                size="sm" 
                onClick={() => setLocation('/phone')}
                data-testid="button-phone"
                className="nightops-button text-xs"
                tooltip="Phone & Voicemail"
                tooltipSide="bottom"
              >
                <Phone className="h-3.5 w-3.5" />
              </ButtonWithTooltip>
              <LanguageSwitcher variant="ghost" size="icon" showLabel={false} />
            </div>
          </TooltipButtonGroup>
        }
      />

      <Composer
        isOpen={showComposeDialog}
        onOpenChange={setShowComposeDialog}
        onSuccess={(conversationId) => {
          if (conversationId) setSelectedConversation(conversationId);
        }}
      />

      {selectedConv && (
        <ShareAvailabilityModal
          open={showShareAvailabilityModal}
          onClose={() => setShowShareAvailabilityModal(false)}
          contactName={selectedConv.customerName || undefined}
          contactFirstName={selectedConv.customerName?.split(' ')[0] || undefined}
          channelType={selectedConv.platform as 'sms' | 'email' | 'facebook' | 'instagram'}
          onMessageGenerated={(messageText) => {
            // Audit T2: insert directly into composer instead of clipboard.
            window.dispatchEvent(
              new CustomEvent('composer:insert', {
                detail: { conversationId: selectedConversation, text: messageText },
              }),
            );
            toast({
              title: 'Added to composer',
              description: 'Availability message inserted — review and send.',
            });
            setShowShareAvailabilityModal(false);
          }}
        />
      )}

      <Button
        onClick={() => setShowComposeDialog(true)}
        className="lg:hidden fixed bottom-6 right-6 h-14 w-14 rounded-full nightops-button-primary shadow-[0_0_20px_rgba(34,211,238,0.5)] z-page-header"
        size="icon"
        data-testid="fab-compose-mobile"
      >
        <PlusCircle className="h-6 w-6" />
      </Button>

      {/* Audit T3 Task #21: bulk action bar */}
      {selectedIds.size > 0 && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-page-header bg-slate-900/95 backdrop-blur border border-cyan-500/40 rounded-full shadow-[0_0_20px_rgba(34,211,238,0.4)] px-4 py-2 flex items-center gap-2"
          data-testid="bulk-action-bar"
        >
          <span className="text-xs text-cyan-300 tabular-nums mr-1">
            {selectedIds.size} selected
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-slate-200 hover:bg-slate-800"
            onClick={() => bulkMutation.mutate({ action: 'mark-read' })}
            disabled={bulkMutation.isPending}
            data-testid="bulk-mark-read"
          >
            <MailOpen className="h-3.5 w-3.5 mr-1" /> Mark read
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-slate-200 hover:bg-slate-800"
            onClick={() => bulkMutation.mutate({
              action: 'snooze',
              payload: { snoozedUntil: new Date(Date.now() + 60 * 60 * 1000).toISOString() },
            })}
            disabled={bulkMutation.isPending}
            data-testid="bulk-snooze"
          >
            <Clock className="h-3.5 w-3.5 mr-1" /> Snooze 1h
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-slate-200 hover:bg-slate-800"
            onClick={() => bulkMutation.mutate({ action: 'resolve' })}
            disabled={bulkMutation.isPending}
            data-testid="bulk-resolve"
          >
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Resolve
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-slate-200 hover:bg-slate-800"
            onClick={() => bulkMutation.mutate({ action: 'archive' })}
            disabled={bulkMutation.isPending}
            data-testid="bulk-archive"
          >
            <Archive className="h-3.5 w-3.5 mr-1" /> Archive
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-slate-200 hover:bg-slate-800"
                disabled={bulkMutation.isPending || staffUsers.length === 0}
                data-testid="bulk-assign"
              >
                <UserPlus className="h-3.5 w-3.5 mr-1" /> Assign
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="bg-slate-900 border-slate-700 max-h-72 overflow-auto">
              <DropdownMenuLabel className="text-xs text-slate-400">Assign to...</DropdownMenuLabel>
              {staffUsers.length === 0 && (
                <div className="px-2 py-1.5 text-xs text-slate-500">No teammates</div>
              )}
              {staffUsers.map(u => (
                <DropdownMenuItem
                  key={u.id}
                  onClick={() => bulkMutation.mutate({
                    action: 'assign',
                    payload: { agentUsername: u.username },
                  })}
                  className="text-slate-200 focus:bg-slate-800 focus:text-slate-100 cursor-pointer"
                  data-testid={`bulk-assign-${u.username}`}
                >
                  {u.fullName || u.username}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            onClick={clearSelection}
            data-testid="bulk-clear"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Audit T3 Task #21: keyboard cheatsheet */}
      <Dialog open={showCheatsheet} onOpenChange={setShowCheatsheet}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 sm:max-w-md" data-testid="cheatsheet-modal">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Keyboard className="h-4 w-4 text-cyan-400" />
              Keyboard shortcuts
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Move faster through the inbox.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-2 text-sm">
            {[
              ['j / k', 'Next / previous conversation'],
              ['e', 'Resolve current conversation'],
              ['r', 'Reply (focus composer)'],
              ['s', 'Snooze 1 hour'],
              ['t', 'Take over (manual control)'],
              ['/', 'Focus search'],
              ['?', 'Toggle this cheatsheet'],
              ['Esc', 'Clear selection / close modal'],
            ].map(([k, label]) => (
              <div key={k} className="flex items-center justify-between py-1.5 border-b border-slate-800 last:border-0">
                <span className="text-slate-300">{label}</span>
                <kbd className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-xs font-mono text-cyan-300">
                  {k}
                </kbd>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function MessagesPage() {
  return (
    <MessagingSocketProvider>
      <PhoneLineProvider>
        <MessagesPageContent />
      </PhoneLineProvider>
    </MessagingSocketProvider>
  );
}
