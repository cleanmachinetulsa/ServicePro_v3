import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { usePhoneLine } from '@/contexts/PhoneLineContext';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { 
  Bot, 
  User, 
  Phone, 
  Send, 
  Loader2, 
  ArrowLeftRight,
  ArrowDown,
  Clock,
  Sparkles,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  Code2,
  AlertCircle,
  RefreshCw,
  Paperclip,
  X,
  FileText,
  Image as ImageIcon,
  Smile,
  Search,
  XCircle,
  ArrowLeft,
  Smartphone
} from 'lucide-react';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import { format, formatDistanceToNow, isToday, isYesterday, isSameDay } from 'date-fns';
import io from 'socket.io-client';
import type { Conversation, Message, QuickReplyCategory, QuickReplyTemplate } from '@shared/schema';
import BookingPanel from './BookingPanel';
import MessageBubble from './messages/MessageBubble';
import SmartComposeRail from './messages/SmartComposeRail';
import { useToast } from '@/hooks/use-toast';
import { useReadReceipts } from '@/hooks/useReadReceipts';
import { ConversationMetaBar } from './conversations/ConversationMetaBar';
import { SmartSchedulePanel } from './conversations/SmartSchedulePanel';
import { HandoffControls } from './conversations/HandoffControls';
import { HandbackAnalysisPanel } from './conversations/HandbackAnalysisPanel';

interface ReplySuggestion {
  id: string;
  content: string;
  type: 'informational' | 'scheduling' | 'service_related' | 'closing' | 'general';
  confidence: number;
}

interface CategoryWithTemplates extends QuickReplyCategory {
  templates: QuickReplyTemplate[];
}

interface ThreadViewProps {
  conversationId: number;
  onBack?: () => void;
  
  messageReactionSlot?: (message: Message) => React.ReactNode;
  scheduledMetaSlot?: (message: Message) => React.ReactNode;
  deliveryIndicatorSlot?: (message: Message) => React.ReactNode;
  messageActionSlot?: (message: Message) => React.ReactNode;
  inlineSuggestionsSlot?: React.ReactNode;
  sidePanelSlot?: React.ReactNode;
  scheduledBannerSlot?: React.ReactNode;
}

// Helper function to format date dividers
function formatDateDivider(date: Date): string {
  if (isToday(date)) {
    return 'Today';
  } else if (isYesterday(date)) {
    return 'Yesterday';
  } else {
    return format(date, 'EEEE, MMMM d, yyyy');
  }
}

// Helper function to group messages by date
function groupMessagesByDate(messages: Message[]): Array<{ date: Date; messages: Message[] }> {
  const groups: Array<{ date: Date; messages: Message[] }> = [];
  const today = new Date();
  
  messages.forEach((message) => {
    const messageDate = message.timestamp ? new Date(message.timestamp) : today;
    const lastGroup = groups[groups.length - 1];
    
    if (!lastGroup || !isSameDay(lastGroup.date, messageDate)) {
      groups.push({ date: messageDate, messages: [message] });
    } else {
      lastGroup.messages.push(message);
    }
  });
  
  return groups;
}

export default function ThreadView({ 
  conversationId,
  onBack,
  messageReactionSlot,
  scheduledMetaSlot,
  deliveryIndicatorSlot,
  messageActionSlot,
  inlineSuggestionsSlot,
  sidePanelSlot,
  scheduledBannerSlot,
}: ThreadViewProps) {
  const { activeSendLineId } = usePhoneLine();
  const [messageInput, setMessageInput] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set());
  const [showLoadMore, setShowLoadMore] = useState(true);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [socketStatus, setSocketStatus] = useState<'connected' | 'disconnected' | 'reconnecting'>('connected');
  const [failedMessage, setFailedMessage] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [suggestionsCollapsed, setSuggestionsCollapsed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const socketRef = useRef<ReturnType<typeof io> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);      // whether we should auto-scroll on new messages
  const lastScrollTopRef = useRef(0);         // tracks last scrollTop to detect scroll direction
  const draftRestoredRef = useRef(false); // Track if draft has been restored for current conversation
  const [isAtBottom, setIsAtBottom] = useState(true); // For UI only (Jump to latest button)
  const queryClient = useQueryClient();
  const { toast} = useToast();

  // Fetch current user
  const { data: currentUserData } = useQuery<{ success: boolean; user: { username: string } }>({
    queryKey: ['/api/users/me'],
  });
  const currentUser = currentUserData?.user;

  // Fetch phone lines for active send line indicator
  const { data: phoneLinesData } = useQuery<{ success: boolean; lines: { id: number; label: string; phoneNumber: string; isActive: boolean }[] }>({
    queryKey: ['/api/phone-settings/lines'],
  });
  const phoneLines = phoneLinesData?.lines || [];
  const activeLine = phoneLines.find(line => line.id === activeSendLineId);

  // Booking status type for human handshake flow
  type BookingStatus = 'not_ready' | 'ready_for_draft' | 'ready_for_human_review';
  
  // Fetch conversation details with messages
  const { data: conversationData, isLoading: conversationLoading} = useQuery<{ 
    success: boolean; 
    data: Conversation & { messages: Message[]; bookingStatus?: BookingStatus } 
  }>({
    queryKey: [`/api/conversations/${conversationId}`],
    refetchInterval: 5000,
  });

  const conversation = conversationData?.data;
  const bookingStatus = conversation?.bookingStatus || 'not_ready';
  
  // Filter messages based on search query (client-side search)
  const filteredMessages = conversation?.messages?.filter(msg => {
    if (!searchQuery.trim()) return true;
    return msg.content.toLowerCase().includes(searchQuery.toLowerCase());
  }) || [];
  
  // Fetch reactions for all messages in this conversation
  const { data: reactionsData } = useQuery<{ success: boolean; reactions: Array<{ id: number; messageId: number; userId: number; emoji: string; createdAt: string }> }>({
    queryKey: [`/api/conversations/${conversationId}/reactions`],
    enabled: !!conversationId,
  });
  
  const reactions = reactionsData?.reactions || [];

  // Determine if typing indicator should show (AI is "thinking")
  const showTyping = conversation?.controlMode === 'auto' && 
                     conversation?.messages?.length > 0 && 
                     conversation.messages[conversation.messages.length - 1]?.sender === 'customer';

  // Mark conversation as read when viewing
  useEffect(() => {
    if (conversation && (conversation.unreadCount || 0) > 0) {
      apiRequest('POST', `/api/conversations/${conversationId}/mark-read`).catch(console.error);
    }
  }, [conversationId, conversation?.unreadCount]);

  // Fetch AI suggestions
  const { data: suggestionsData, refetch: refetchSuggestions } = useQuery<{ success: boolean; suggestions: ReplySuggestion[] }>({
    queryKey: [`/api/conversations/${conversationId}/suggestions`],
    enabled: !!conversation && conversation.controlMode === 'manual',
  });

  const suggestions = suggestionsData?.suggestions || [];

  // Fetch quick reply templates
  const { data: quickRepliesData } = useQuery<{ success: boolean; categories: CategoryWithTemplates[] }>({
    queryKey: ['/api/quick-replies/categories'],
  });

  const quickReplyCategories = quickRepliesData?.categories || [];

  // Fetch template variables with REAL values for this conversation
  const { data: templateVariablesData } = useQuery<{ success: boolean; variables: Array<{ variable: string; description: string; value: string }> }>({
    queryKey: [`/api/conversations/${conversationId}/template-variables`],
    enabled: !!conversationId,
  });

  const templateVariables = templateVariablesData?.variables || [];

  // iMessage-quality read receipts (Task 24)
  const { observeMessage } = useReadReceipts({
    conversationId,
    messages: conversation?.messages || [],
    readerRole: 'agent',
    socket: socketRef.current,
    enabled: !!conversation
  });

  // Send message mutation with optimistic updates
  // Reaction mutations
  const addReactionMutation = useMutation({
    mutationFn: async ({ messageId, emoji }: { messageId: number; emoji: string }) => {
      return apiRequest('POST', `/api/messages/${messageId}/reactions`, { emoji });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/conversations/${conversationId}/reactions`] });
    },
  });
  
  const removeReactionMutation = useMutation({
    mutationFn: async (reactionId: number) => {
      return apiRequest('DELETE', `/api/messages/reactions/${reactionId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/conversations/${conversationId}/reactions`] });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (payload: { content: string; attachments?: any[] }) => {
      const response = await apiRequest('POST', `/api/conversations/${conversationId}/send-message`, { 
        content: payload.content,
        channel: conversation?.platform || 'web',
        attachments: payload.attachments || [],
        phoneLineId: conversation?.platform === 'sms' ? activeSendLineId : undefined
      });
      return response.json();
    },
    onMutate: async (payload: { content: string; attachments?: any[] }) => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: [`/api/conversations/${conversationId}`] });

      // Snapshot the previous value for rollback
      const previousConversation = queryClient.getQueryData([`/api/conversations/${conversationId}`]);

      // Optimistically update the cache
      queryClient.setQueryData([`/api/conversations/${conversationId}`], (old: any) => {
        if (!old) return old;
        
        // Create optimistic message
        const optimisticMessage: Message = {
          id: -Date.now(), // Temporary negative ID
          conversationId,
          content: payload.content,
          sender: 'agent',
          fromCustomer: false,
          timestamp: new Date(),
          topics: null,
          channel: conversation?.platform || 'web',
          isAutomated: false,
          deliveryStatus: null,
          readAt: null,
          edited: false,
          editedAt: null,
          metadata: payload.attachments && payload.attachments.length > 0 
            ? { attachments: payload.attachments } 
            : null,
        };

        return {
          ...old,
          data: {
            ...old.data,
            messages: [...(old.data.messages || []), optimisticMessage],
          },
        };
      });

      // Return snapshot for rollback
      return { previousConversation };
    },
    onError: (err, payload, context) => {
      // Rollback on error
      if (context?.previousConversation) {
        queryClient.setQueryData(
          [`/api/conversations/${conversationId}`],
          context.previousConversation
        );
      }
      
      // Save failed message for retry
      setFailedMessage(payload.content);
      
      // Show error toast
      toast({
        title: "Message failed to send",
        description: "Your message couldn't be sent. Click retry to try again.",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      setMessageInput('');
      setFailedMessage(null); // Clear failed message on success
      // Invalidate to get the real message from server (replaces optimistic one)
      queryClient.invalidateQueries({ queryKey: [`/api/conversations/${conversationId}`] });
      refetchSuggestions();
    },
  });

  // Return to AI mutation
  const returnToAIMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/conversations/${conversationId}/return-to-ai`, { 
        agentName: currentUser?.username || 'Agent',
        notifyCustomer: true
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/conversations/${conversationId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
    },
  });

  // Thread management mutations
  const assignToMeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/conversations/${conversationId}/assign`, {
        agentName: currentUser?.username || 'Agent',
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/conversations/${conversationId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
    },
  });

  const snoozeMutation = useMutation({
    mutationFn: async (snoozedUntil: string | null) => {
      const response = await apiRequest('POST', `/api/conversations/${conversationId}/snooze`, {
        snoozedUntil,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/conversations/${conversationId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/conversations/${conversationId}/resolve`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/conversations/${conversationId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
    },
  });

  // WebSocket for real-time updates
  useEffect(() => {
    const socket = io();
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[THREAD VIEW] Connected to WebSocket');
      setSocketStatus('connected');
      socket.emit('join_conversation', conversationId);
    });

    socket.on('disconnect', () => {
      console.log('[THREAD VIEW] Disconnected from WebSocket');
      setSocketStatus('disconnected');
    });

    socket.io.on('reconnect_attempt', () => {
      console.log('[THREAD VIEW] Attempting to reconnect...');
      setSocketStatus('reconnecting');
    });

    socket.io.on('reconnect', () => {
      console.log('[THREAD VIEW] Reconnected to WebSocket');
      setSocketStatus('connected');
      socket.emit('join_conversation', conversationId);
    });

    socket.on('new_message', (data: any) => {
      if (data.conversationId === conversationId) {
        console.log('[THREAD VIEW] New message received:', data);
        queryClient.invalidateQueries({ queryKey: [`/api/conversations/${conversationId}`] });
        refetchSuggestions();
      }
    });

    socket.on('conversation_updated', (data: any) => {
      if (data.conversationId === conversationId) {
        console.log('[THREAD VIEW] Conversation updated:', data);
        queryClient.invalidateQueries({ queryKey: [`/api/conversations/${conversationId}`] });
      }
    });

    socket.on('control_mode_changed', (data: any) => {
      if (data.conversationId === conversationId) {
        console.log('[THREAD VIEW] Control mode changed:', data);
        queryClient.invalidateQueries({ queryKey: [`/api/conversations/${conversationId}`] });
      }
    });

    // Typing indicator events
    socket.on('user_typing', (data: { conversationId: number; username: string; isTyping: boolean }) => {
      if (data.conversationId === conversationId && data.username !== currentUser?.username) {
        console.log('[THREAD VIEW] Typing event:', data);
        setTypingUsers(prev => {
          const newSet = new Set(prev);
          if (data.isTyping) {
            newSet.add(data.username);
          } else {
            newSet.delete(data.username);
          }
          return newSet;
        });
      }
    });

    return () => {
      // Clean up typing timeout on unmount
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Emit typing stop before disconnecting
      if (currentUser?.username) {
        socket.emit('typing_stop', {
          conversationId,
          username: currentUser.username,
        });
      }
      
      socket.emit('leave_conversation', conversationId);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [conversationId, queryClient, currentUser?.username]);

  // ============================================================================
  // PREMIUM SCROLL BEHAVIOR (iMessage/WhatsApp style) - MutationObserver Pattern
  // ============================================================================
  // Uses MutationObserver to detect when DOM content stabilizes before scrolling.
  // stickToBottomRef ONLY set true via scrollToBottom() or on new conversation.
  // Jump button visibility updated directly (no RAF loop needed).
  // ============================================================================

  // Guard to ignore scroll events during programmatic scroll
  const isRestoringScrollRef = useRef(false);
  const isProgrammaticScrollRef = useRef(false);
  // Track the last conversation we initialized for
  const lastInitializedConversationRef = useRef<string | number | null>(null);
  // Track previous message count for new message detection
  const prevMessageCountRef = useRef(0);
  // Content wrapper ref for MutationObserver
  const contentRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom - called by Jump button or after initial hydration
  const scrollToBottom = (behavior: ScrollBehavior = 'auto') => {
    const container = containerRef.current;
    if (!container) return;
    
    isProgrammaticScrollRef.current = true;
    stickToBottomRef.current = true;
    setIsAtBottom(true);
    
    container.scrollTo({ top: container.scrollHeight, behavior });
    
    // Reset programmatic flag after scroll completes
    requestAnimationFrame(() => {
      isProgrammaticScrollRef.current = false;
    });
  };

  // Scroll handler - attached directly to container
  const handleScroll = () => {
    if (isRestoringScrollRef.current || isProgrammaticScrollRef.current) return;
    
    const el = containerRef.current;
    if (!el) return;
    
    const currentTop = el.scrollTop;
    const maxScrollTop = el.scrollHeight - el.clientHeight;
    const atBottom = maxScrollTop - currentTop < 16; // Within 16px of bottom
    const scrolledUp = currentTop < lastScrollTopRef.current - 5; // 5px hysteresis
    lastScrollTopRef.current = currentTop;

    // When user scrolls UP, disable auto-scroll and show Jump button
    if (scrolledUp && stickToBottomRef.current) {
      stickToBottomRef.current = false;
      setIsAtBottom(false);
    }
    // When user manually scrolls TO bottom, re-enable auto-scroll
    else if (atBottom && !stickToBottomRef.current) {
      stickToBottomRef.current = true;
      setIsAtBottom(true);
    }
  };

  // Initial scroll using MutationObserver to wait for DOM hydration
  useEffect(() => {
    const messages = conversation?.messages || [];
    if (messages.length === 0) return;
    
    // Skip if we already initialized this conversation
    if (lastInitializedConversationRef.current === conversationId) {
      return;
    }
    
    // Mark this conversation as being initialized
    lastInitializedConversationRef.current = conversationId;
    
    // Reset state for new conversation
    stickToBottomRef.current = true;
    lastScrollTopRef.current = 0;
    prevMessageCountRef.current = 0;
    setIsAtBottom(true);
    
    // Use MutationObserver to wait for content to stabilize
    const content = contentRef.current;
    const container = containerRef.current;
    if (!content || !container) {
      // Fallback: just scroll after a delay
      setTimeout(() => {
        if (containerRef.current) {
          containerRef.current.scrollTop = containerRef.current.scrollHeight;
          prevMessageCountRef.current = messages.length;
        }
      }, 100);
      return;
    }
    
    let mutationTimeout: NodeJS.Timeout;
    let scrollDone = false;
    
    const doScroll = () => {
      if (scrollDone) return;
      scrollDone = true;
      observer.disconnect();
      
      // Scroll to bottom
      container.scrollTop = container.scrollHeight;
      prevMessageCountRef.current = messages.length;
    };
    
    const observer = new MutationObserver(() => {
      // Reset timeout on each mutation - wait for mutations to stop
      clearTimeout(mutationTimeout);
      mutationTimeout = setTimeout(doScroll, 50);
    });
    
    observer.observe(content, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    
    // Initial timeout in case no mutations occur
    mutationTimeout = setTimeout(doScroll, 150);
    
    return () => {
      observer.disconnect();
      clearTimeout(mutationTimeout);
    };
  }, [conversationId, conversation?.messages]); // Include messages to detect hydration

  // Auto-scroll on new messages (only if stickToBottom is true)
  useEffect(() => {
    const messages = conversation?.messages || [];
    
    // Skip if this is initial load or different conversation
    if (lastInitializedConversationRef.current !== conversationId) return;
    if (messages.length <= prevMessageCountRef.current) {
      prevMessageCountRef.current = messages.length;
      return;
    }
    
    // New messages arrived
    const newCount = messages.length;
    prevMessageCountRef.current = newCount;
    
    if (stickToBottomRef.current && containerRef.current) {
      isProgrammaticScrollRef.current = true;
      containerRef.current.scrollTo({ top: containerRef.current.scrollHeight, behavior: 'smooth' });
      requestAnimationFrame(() => {
        isProgrammaticScrollRef.current = false;
      });
    }
  }, [conversationId, conversation?.messages]);

  // Offline Drafts: Restore draft from localStorage on mount/conversation change
  useEffect(() => {
    // Reset guard when conversation changes to block auto-save until restoration completes
    draftRestoredRef.current = false;
    
    try {
      const draftKey = `message-draft-${conversationId}`;
      const savedDraft = localStorage.getItem(draftKey);
      // Always set messageInput - either to saved draft or empty string
      // Handle both plain strings and JSON (for future compatibility)
      setMessageInput(savedDraft || '');
    } catch (error) {
      // If parsing fails, just use empty string and clear the bad entry
      console.warn('[DRAFTS] Failed to restore draft, clearing:', error);
      try {
        localStorage.removeItem(`message-draft-${conversationId}`);
      } catch (e) {
        // Ignore cleanup errors
      }
      setMessageInput('');
    }
  }, [conversationId]);

  // Offline Drafts: Re-enable auto-save AFTER restoration completes (next render)
  useEffect(() => {
    // Delay enabling guard until messageInput has been updated with restored draft
    const timeoutId = setTimeout(() => {
      draftRestoredRef.current = true;
    }, 0); // Schedule after current render completes
    
    return () => clearTimeout(timeoutId);
  }, [conversationId]); // Run whenever conversation changes

  // Offline Drafts: Auto-save draft to localStorage (with restoration guard)
  useEffect(() => {
    // Skip auto-save if draft hasn't been restored yet (prevents saving stale state)
    if (!draftRestoredRef.current) return;
    
    const draftKey = `message-draft-${conversationId}`;
    const timeoutId = setTimeout(() => {
      try {
        if (messageInput.trim()) {
          localStorage.setItem(draftKey, messageInput);
        } else {
          localStorage.removeItem(draftKey);
        }
      } catch (error) {
        // Silently fail if localStorage is unavailable (privacy mode, quota exceeded, etc.)
        console.warn('[DRAFTS] Failed to save draft:', error);
      }
    }, 300); // Debounce to batch rapid typing
    
    return () => clearTimeout(timeoutId);
  }, [messageInput, conversationId]);

  // Emit typing events using the persistent socket
  const emitTyping = (isTyping: boolean) => {
    if (!currentUser?.username || !socketRef.current) return;
    
    socketRef.current.emit(isTyping ? 'typing_start' : 'typing_stop', {
      conversationId,
      username: currentUser.username,
    });
  };

  // Handle typing in input
  const handleInputChange = (value: string) => {
    // Hard limit at 1600 characters for SMS compatibility
    if (value.length > 1600) {
      toast({
        title: "Character limit reached",
        description: "SMS messages are limited to 1600 characters",
        variant: "destructive",
      });
      return;
    }
    
    setMessageInput(value);
    
    // Emit typing start
    if (conversation?.controlMode === 'manual' && value.trim()) {
      emitTyping(true);
      
      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Set timeout to emit typing stop after 2 seconds of no typing
      typingTimeoutRef.current = setTimeout(() => {
        emitTyping(false);
      }, 2000);
    } else {
      emitTyping(false);
    }
  };

  // Load more messages (pagination)
  const handleLoadMore = async () => {
    if (!conversation?.messages || conversation.messages.length === 0 || isLoadingMore) return;
    
    const container = containerRef.current;
    if (!container) return;
    
    // Find the ACTUAL first visible message at the top of the viewport
    const viewportRect = container.getBoundingClientRect();
    let anchorMessageId: number | null = null;
    let relativeOffset = 0;
    
    for (const msg of conversation.messages) {
      const msgElement = document.querySelector(`[data-message-id="${msg.id}"]`);
      if (msgElement) {
        const msgRect = msgElement.getBoundingClientRect();
        if (msgRect.bottom > viewportRect.top && msgRect.top < viewportRect.bottom) {
          anchorMessageId = msg.id;
          relativeOffset = msgRect.top - viewportRect.top;
          break;
        }
      }
    }
    
    if (!anchorMessageId && conversation.messages[0]) {
      anchorMessageId = conversation.messages[0].id;
      const el = document.querySelector(`[data-message-id="${anchorMessageId}"]`);
      relativeOffset = el ? el.getBoundingClientRect().top - viewportRect.top : 0;
    }
    
    if (!anchorMessageId) return;
    
    setIsLoadingMore(true);
    isRestoringScrollRef.current = true;
    
    try {
      const oldestMessage = conversation.messages[0];
      const beforeTimestamp = oldestMessage.timestamp ? new Date(oldestMessage.timestamp).toISOString() : '';
      
      const response = await fetch(`/api/conversations/${conversationId}?before=${beforeTimestamp}&limit=50`);
      const data = await response.json();
      
      if (data.success && data.data) {
        queryClient.setQueryData(
          [`/api/conversations/${conversationId}`],
          (old: any) => {
            if (!old) return old;
            return {
              ...old,
              data: {
                ...old.data,
                messages: [...data.data.messages, ...old.data.messages],
                hasMore: data.data.hasMore,
              },
            };
          }
        );
        
        setHasMoreMessages(data.data.hasMore || false);
        
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const anchorAfter = document.querySelector(`[data-message-id="${anchorMessageId}"]`);
            
            if (container && anchorAfter) {
              const anchorOffsetAfter = anchorAfter.getBoundingClientRect().top;
              const containerTopAfter = container.getBoundingClientRect().top;
              const currentRelativeOffset = anchorOffsetAfter - containerTopAfter;
              const scrollAdjustment = relativeOffset - currentRelativeOffset;
              container.scrollTop += scrollAdjustment;
            }
            
            isRestoringScrollRef.current = false;
          });
        });
      } else {
        isRestoringScrollRef.current = false;
      }
    } catch (error) {
      console.error('Error loading more messages:', error);
      isRestoringScrollRef.current = false;
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Handle file selection and upload
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0]; // MVP: single file only
    
    // Validate file type
    const isImage = file.type.startsWith('image/');
    const isPDF = file.type === 'application/pdf';
    if (!isImage && !isPDF) {
      toast({
        title: "Invalid file type",
        description: "Only images and PDFs are supported",
        variant: "destructive",
      });
      return;
    }
    
    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Maximum file size is 10MB",
        variant: "destructive",
      });
      return;
    }
    
    setSelectedFiles([file]);
    setUploadError(null);
    
    // Upload immediately
    setUploadingAttachments(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('conversationId', conversationId.toString());
      
      const response = await fetch('/api/messages/upload-attachment', {
        method: 'POST',
        credentials: 'include', // Include auth cookies
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || 'Upload failed');
      }
      
      const data = await response.json();
      
      // Store uploaded attachment info (to be sent with message)
      setSelectedFiles([Object.assign(file, { uploadedData: data.attachment })]);
      setUploadError(null);
      
      toast({
        title: "File uploaded",
        description: `${file.name} is ready to send`,
      });
    } catch (error: any) {
      console.error('File upload error:', error);
      const errorMessage = error.message || 'Could not upload file';
      setUploadError(errorMessage);
      
      toast({
        title: "Upload failed",
        description: errorMessage,
        variant: "destructive",
      });
      // Keep file in list to allow retry
    } finally {
      setUploadingAttachments(false);
    }
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveAttachment = () => {
    setSelectedFiles([]);
    setUploadError(null);
  };
  
  const handleRetryUpload = async () => {
    if (selectedFiles.length === 0) return;
    
    const file = selectedFiles[0];
    setUploadError(null);
    setUploadingAttachments(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('conversationId', conversationId.toString());
      
      const response = await fetch('/api/messages/upload-attachment', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || 'Upload failed');
      }
      
      const data = await response.json();
      
      setSelectedFiles([Object.assign(file, { uploadedData: data.attachment })]);
      setUploadError(null);
      
      toast({
        title: "File uploaded",
        description: `${file.name} is ready to send`,
      });
    } catch (error: any) {
      console.error('File upload retry error:', error);
      const errorMessage = error.message || 'Could not upload file';
      setUploadError(errorMessage);
      
      toast({
        title: "Upload failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setUploadingAttachments(false);
    }
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || 0;
    const textBefore = messageInput.substring(0, start);
    const textAfter = messageInput.substring(end);
    
    const newText = textBefore + emojiData.emoji + textAfter;
    setMessageInput(newText);
    
    // Move cursor after emoji
    setTimeout(() => {
      const newPosition = start + emojiData.emoji.length;
      textarea.setSelectionRange(newPosition, newPosition);
      textarea.focus();
    }, 0);
    
    setShowEmojiPicker(false);
  };

  const handleSendMessage = () => {
    if (messageInput.trim() || selectedFiles.length > 0) {
      const messageToSend = messageInput;
      const attachments = selectedFiles.map((f: any) => f.uploadedData).filter(Boolean);
      
      setMessageInput(''); // Clear immediately (optimistic)
      setSelectedFiles([]); // Clear attachments
      setShowEmojiPicker(false); // Close emoji picker
      emitTyping(false); // Stop typing indicator
      
      // Clear draft from localStorage
      localStorage.removeItem(`message-draft-${conversationId}`);
      
      // Send with attachments metadata
      sendMessageMutation.mutate({ content: messageToSend, attachments });
    }
  };

  const handleSuggestionClick = (suggestionContent: string) => {
    setMessageInput(suggestionContent);
  };

  const insertTemplateVariable = (variable: string) => {
    setMessageInput(prev => prev + variable + ' ');
  };

  const handleQuickReplyClick = async (templateId: number, content: string) => {
    // Update last used timestamp
    await apiRequest('POST', `/api/quick-replies/templates/${templateId}/use`);
    
    // Send immediately
    sendMessageMutation.mutate({ content, attachments: [] });
  };

  const toggleCategory = (categoryId: number) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const getStatusBadge = () => {
    if (!conversation) return null;

    switch (conversation.controlMode) {
      case 'manual':
        return (
          <Badge variant="default" className="gap-1 bg-purple-600" data-testid="badge-status-manual">
            <User className="h-3 w-3" />
            Manual Mode
          </Badge>
        );
      case 'auto':
        return (
          <Badge variant="secondary" className="gap-1" data-testid="badge-status-ai">
            <Bot className="h-3 w-3" />
            AI Mode
          </Badge>
        );
      case 'paused':
        return (
          <Badge variant="outline" className="gap-1" data-testid="badge-status-paused">
            <Clock className="h-3 w-3" />
            Paused
          </Badge>
        );
      default:
        return null;
    }
  };


  if (conversationLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Conversation not found</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-950">
      {/* Conversation Controls Toolbar */}
      <div className="border-b dark:border-gray-800 bg-white dark:bg-gray-900 px-6 py-4 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            {/* MOBILE BACK BUTTON - ALWAYS VISIBLE ON MOBILE */}
            {onBack && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onBack}
                className="md:hidden flex items-center gap-2 -ml-2 hover:bg-gray-100 dark:hover:bg-gray-800"
                data-testid="button-back-mobile"
              >
                <ArrowLeft className="h-5 w-5" />
                <span className="font-medium">Back</span>
              </Button>
            )}
            <div className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-primary" />
              <div>
                <h2 className="font-semibold" data-testid="text-customer-name">
                  {conversation.customerName || conversation.customerPhone}
                </h2>
                {conversation.customerName && (
                  <p className="text-sm text-muted-foreground" data-testid="text-customer-phone">
                    {conversation.customerPhone}
                  </p>
                )}
              </div>
            </div>
            {getStatusBadge()}
          </div>

          <div className="flex items-center gap-2 flex-wrap max-w-full">
            {/* Assign to Me */}
            {!conversation.assignedAgent && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => assignToMeMutation.mutate()}
                disabled={assignToMeMutation.isPending}
                className="gap-2"
                data-testid="button-assign-to-me"
              >
                {assignToMeMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <User className="h-4 w-4" />
                )}
                Assign to Me
              </Button>
            )}

            {/* Snooze */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  data-testid="button-snooze"
                >
                  <Clock className="h-4 w-4" />
                  Snooze
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-2">
                <div className="space-y-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => {
                      const snoozeUntil = new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString();
                      snoozeMutation.mutate(snoozeUntil);
                    }}
                  >
                    1 hour
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => {
                      const snoozeUntil = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
                      snoozeMutation.mutate(snoozeUntil);
                    }}
                  >
                    4 hours
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => {
                      const tomorrow = new Date();
                      tomorrow.setDate(tomorrow.getDate() + 1);
                      tomorrow.setHours(9, 0, 0, 0);
                      snoozeMutation.mutate(tomorrow.toISOString());
                    }}
                  >
                    Tomorrow 9 AM
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => {
                      const nextWeek = new Date();
                      nextWeek.setDate(nextWeek.getDate() + 7);
                      nextWeek.setHours(9, 0, 0, 0);
                      snoozeMutation.mutate(nextWeek.toISOString());
                    }}
                  >
                    Next week
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            {/* Mark as Resolved */}
            {conversation.status !== 'closed' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => resolveMutation.mutate()}
                disabled={resolveMutation.isPending}
                className="gap-2"
                data-testid="button-resolve"
              >
                {resolveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MessageSquare className="h-4 w-4" />
                )}
                Mark Resolved
              </Button>
            )}

            {conversation.controlMode === 'manual' && (
              <Button
                variant="default"
                size="sm"
                onClick={() => returnToAIMutation.mutate()}
                disabled={returnToAIMutation.isPending}
                className="gap-2 bg-blue-600 hover:bg-blue-700"
                data-testid="button-hand-to-ai"
              >
                {returnToAIMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Bot className="h-4 w-4" />
                )}
                Return to AI
              </Button>
            )}
            
            {/* Search Messages */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSearch(!showSearch)}
              className="gap-2"
              data-testid="button-search-messages"
            >
              {showSearch ? (
                <XCircle className="h-4 w-4" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              {showSearch ? 'Close' : 'Search'}
            </Button>
          </div>
        </div>
        
        {/* Search Input Row */}
        {showSearch && (
          <div className="px-6 py-3 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search messages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  data-testid="input-search-messages"
                  autoFocus
                />
              </div>
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSearchQuery('')}
                  data-testid="button-clear-search"
                >
                  Clear
                </Button>
              )}
            </div>
            {searchQuery && (
              <p className="text-xs text-muted-foreground mt-2">
                {filteredMessages.length} {filteredMessages.length === 1 ? 'result' : 'results'} found
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
        {/* Main Message Area */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
          {/* Scheduled Banner Slot - Extension point for Phase 2 scheduled message summaries */}
          {scheduledBannerSlot && (
            <div className="border-b dark:border-gray-800 bg-amber-50 dark:bg-amber-950/20 px-4 py-3">
              {scheduledBannerSlot}
            </div>
          )}
          
          {/* WebSocket Connection Status Indicator */}
          {socketStatus !== 'connected' && (
            <div className={`border-b px-4 py-2.5 text-sm flex items-center gap-2 ${
              socketStatus === 'disconnected' 
                ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
                : 'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300'
            }`} data-testid="socket-status-banner">
              {socketStatus === 'disconnected' ? (
                <>
                  <div className="h-2 w-2 rounded-full bg-red-500 dark:bg-red-400" />
                  <span className="font-medium">Connection lost - Messages may not be sent or received</span>
                </>
              ) : (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span className="font-medium">Reconnecting to server...</span>
                </>
              )}
            </div>
          )}
          
          {/* Customer Info Header - Always visible at top of thread (outside scroll area) */}
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900" data-testid="thread-customer-header">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                {(conversation.customerName || conversation.customerPhone || '?')[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900 dark:text-gray-100 truncate" data-testid="thread-customer-name">
                    {conversation.customerName || 'Unknown Contact'}
                  </span>
                  {conversation.starred && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-300 dark:border-amber-700">
                      Starred
                    </Badge>
                  )}
                  {conversation.needsHumanAttention && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-300 dark:border-red-700">
                      Needs Attention
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <Phone className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate" data-testid="thread-customer-phone">{conversation.customerPhone || 'No phone'}</span>
                  {conversation.platform && conversation.platform !== 'sms' && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {conversation.platform}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="flex-shrink-0 flex items-center gap-2">
              {conversation.controlMode === 'manual' && (
                <Badge className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-0">
                  <User className="h-3 w-3 mr-1" />
                  Manual
                </Badge>
              )}
              {conversation.controlMode === 'auto' && (
                <Badge className="text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-0">
                  <Bot className="h-3 w-3 mr-1" />
                  AI
                </Badge>
              )}
            </div>
          </div>
          
          {/* Messages - Native scrollable div with MutationObserver for hydration detection */}
          <div 
            ref={containerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900/50"
          >
            <div ref={contentRef} className="max-w-4xl mx-auto py-6 px-4">
              {filteredMessages && filteredMessages.length > 0 ? (
                <>
                  {/* Load More Button */}
                  {!searchQuery && hasMoreMessages && conversation.messages && conversation.messages.length >= 20 && (
                    <div className="flex justify-center mb-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleLoadMore}
                        disabled={isLoadingMore}
                        className="text-xs bg-white dark:bg-gray-800 shadow-sm"
                        data-testid="button-load-more"
                      >
                        {isLoadingMore ? (
                          <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                        ) : (
                          <Clock className="h-3 w-3 mr-1.5" />
                        )}
                        {isLoadingMore ? 'Loading...' : 'Load older messages'}
                      </Button>
                    </div>
                  )}
                  
                  {groupMessagesByDate(filteredMessages).map((group, groupIndex) => (
                    <div key={groupIndex} className="mb-6">
                      {/* Date Divider */}
                      <div className="flex items-center justify-center mb-4">
                        <div className="bg-white dark:bg-gray-800 px-3 py-1 rounded-full shadow-sm border border-gray-200 dark:border-gray-700">
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                            {formatDateDivider(group.date)}
                          </span>
                        </div>
                      </div>
                      
                      {/* Messages in this date group */}
                      <div className="space-y-0.5">
                        {group.messages.map((message) => (
                          <div
                            key={message.id}
                            ref={(el) => observeMessage(el, message)}
                            data-message-id={message.id}
                          >
                            <MessageBubble
                              message={message}
                              conversationCustomerName={conversation.customerName}
                              conversationCustomerPhone={conversation.customerPhone}
                              conversationAssignedAgent={conversation.assignedAgent}
                              reactions={reactions.filter(r => r.messageId === message.id)}
                              onAddReaction={(emoji) => addReactionMutation.mutate({ messageId: message.id, emoji })}
                              onRemoveReaction={(reactionId) => removeReactionMutation.mutate(reactionId)}
                              currentUserId={(currentUser as any)?.id}
                              reactionSlot={messageReactionSlot}
                              scheduledMetaSlot={scheduledMetaSlot}
                              deliveryIndicatorSlot={deliveryIndicatorSlot}
                              messageActionSlot={messageActionSlot}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  
                  {/* Typing Indicator - AI or Users */}
                  {(showTyping || typingUsers.size > 0) && (
                    <div className="flex justify-start mb-1 px-2 animate-fadeIn">
                      <div className="bg-gray-200 dark:bg-gray-700 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                        <div className="flex flex-col gap-2">
                          {typingUsers.size > 0 && (
                            <div className="text-xs text-gray-600 dark:text-gray-300 mb-1">
                              {Array.from(typingUsers).join(', ')} {typingUsers.size === 1 ? 'is' : 'are'} typing...
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-gray-500 dark:bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <div className="w-2 h-2 bg-gray-500 dark:bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <div className="w-2 h-2 bg-gray-500 dark:bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div ref={messagesEndRef} data-testid="thread-bottom-anchor" />
                </>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No messages yet</p>
                  <p className="text-sm mt-1">Start the conversation!</p>
                </div>
              )}
            </div>
          </div>

          {/* Jump to Latest Button - Shows when user has scrolled up (reading history) */}
          {!isAtBottom && filteredMessages.length > 0 && (
            <div className="absolute bottom-32 left-1/2 -translate-x-1/2 z-10">
              <Button
                onClick={() => scrollToBottom('smooth')}
                size="sm"
                className="gap-2 rounded-full shadow-lg bg-blue-600 hover:bg-blue-700 text-white px-4"
                data-testid="button-jump-to-latest"
              >
                <ArrowDown className="h-4 w-4" />
                Jump to latest
              </Button>
            </div>
          )}

          {/* AI Suggestions - Enhanced UI with Mobile Collapse */}
          {conversation.controlMode === 'manual' && suggestions.length > 0 && (
            <div className="border-t dark:border-gray-800 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20">
              {/* Header - Always Visible */}
              <button
                onClick={() => setSuggestionsCollapsed(!suggestionsCollapsed)}
                className="w-full flex items-center gap-2 px-4 py-3 hover:bg-blue-100/50 dark:hover:bg-blue-900/20 transition-colors"
                data-testid="button-toggle-suggestions"
              >
                <div className="bg-gradient-to-r from-blue-500 to-purple-500 p-1.5 rounded-lg">
                  <Sparkles className="h-3.5 w-3.5 text-white" />
                </div>
                <span className="text-sm font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  AI-Powered Suggestions
                </span>
                <Badge variant="secondary" className="text-xs">
                  {suggestions.length}
                </Badge>
                <div className="ml-auto">
                  <ChevronDown
                    className={`h-4 w-4 text-blue-600 dark:text-blue-400 transition-transform ${
                      suggestionsCollapsed ? '-rotate-180' : ''
                    }`}
                  />
                </div>
              </button>
              
              {/* Suggestions - Collapsible */}
              {!suggestionsCollapsed && (
                <div className="px-4 pb-3">
                  <div className="flex flex-wrap gap-2 max-w-4xl mx-auto">
                    {suggestions.map((suggestion, index) => (
                      <Button
                        key={suggestion.id}
                        variant="outline"
                        size="sm"
                        onClick={() => handleSuggestionClick(suggestion.content)}
                        className="text-xs h-auto py-2.5 px-4 whitespace-normal text-left bg-white dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 border-blue-200 dark:border-blue-800 transition-all hover:scale-105 hover:shadow-md"
                        data-testid={`suggestion-${suggestion.id}`}
                      >
                        <div className="flex items-start gap-2">
                          <span className="font-mono text-blue-600 dark:text-blue-400 text-[10px] mt-0.5">
                            {index + 1}
                          </span>
                          <span className="flex-1">{suggestion.content}</span>
                          {suggestion.confidence >= 0.9 && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                              High
                            </Badge>
                          )}
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Booking Status Banner - Shows readiness for appointment creation */}
          {bookingStatus !== 'not_ready' && (
            <div className="border-t dark:border-gray-800 px-4 py-3 bg-gradient-to-r from-emerald-50 to-blue-50 dark:from-emerald-950/20 dark:to-blue-950/20">
              <div className="flex items-center gap-3 max-w-4xl mx-auto">
                {bookingStatus === 'ready_for_draft' && (
                  <>
                    <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" data-testid="badge-ready-to-book">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5 animate-pulse" />
                      Ready to book
                    </span>
                    <span className="text-xs text-emerald-700 dark:text-emerald-300">
                      All required information collected. Click "Create Appointment" to submit.
                    </span>
                  </>
                )}
                {bookingStatus === 'ready_for_human_review' && (
                  <>
                    <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200" data-testid="badge-needs-approval">
                      <span className="w-1.5 h-1.5 bg-amber-500 rounded-full mr-1.5 animate-pulse" />
                      Needs manual approval
                    </span>
                    <span className="text-xs text-amber-700 dark:text-amber-300">
                      Customer may be outside service area or requires special review.
                    </span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Integrated Booking Panel */}
          <BookingPanel conversationId={conversationId} />

          {/* Smart Compose Rail - Extension point for Phase 2 AI features */}
          {conversation.controlMode === 'manual' && (
            <SmartComposeRail
              inlineSuggestionsSlot={inlineSuggestionsSlot}
              sidePanelSlot={sidePanelSlot}
            />
          )}

          {/* Message Send Error Banner with Retry */}
          {failedMessage && conversation.controlMode === 'manual' && (
            <div className="border-t border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-4 py-3">
              <div className="flex items-center justify-between gap-3 max-w-4xl mx-auto">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-red-800 dark:text-red-200">Message failed to send</p>
                    <p className="text-xs text-red-600 dark:text-red-400 truncate">{failedMessage}</p>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      sendMessageMutation.mutate({ content: failedMessage, attachments: [] });
                    }}
                    disabled={sendMessageMutation.isPending}
                    className="gap-1 border-red-300 dark:border-red-700 hover:bg-red-100 dark:hover:bg-red-900/50"
                    data-testid="button-retry-message"
                  >
                    {sendMessageMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                    Retry
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFailedMessage(null)}
                    className="hover:bg-red-100 dark:hover:bg-red-900/50"
                    data-testid="button-dismiss-error"
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Message Input - Always Visible */}
          <div className="border-t dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-4 shadow-lg">
              {/* Active Phone Line Indicator - Only for SMS conversations */}
              {conversation?.platform === 'sms' && activeLine && (
                <div className="mb-3 max-w-4xl mx-auto">
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${
                    conversation.phoneLineId && conversation.phoneLineId !== activeSendLineId
                      ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'
                      : 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800'
                  }`}>
                    <Smartphone className={`h-3.5 w-3.5 flex-shrink-0 ${
                      conversation.phoneLineId && conversation.phoneLineId !== activeSendLineId
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-blue-600 dark:text-blue-400'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <span className={`font-medium ${
                        conversation.phoneLineId && conversation.phoneLineId !== activeSendLineId
                          ? 'text-amber-900 dark:text-amber-100'
                          : 'text-blue-900 dark:text-blue-100'
                      }`}>
                        Sending from: {activeLine.label} ({activeLine.phoneNumber})
                      </span>
                      {conversation.phoneLineId && conversation.phoneLineId !== activeSendLineId && (
                        <span className="text-amber-700 dark:text-amber-300 ml-1">
                          • Different from conversation's original line
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              {/* File Attachment Preview */}
              {selectedFiles.length > 0 && (
                <div className="mb-3 max-w-4xl mx-auto">
                  <div className={`flex items-center gap-2 p-2 rounded-lg border ${
                    uploadError
                      ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
                      : 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800'
                  }`}>
                    {selectedFiles[0].type.startsWith('image/') ? (
                      <ImageIcon className={`h-5 w-5 flex-shrink-0 ${
                        uploadError ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'
                      }`} />
                    ) : (
                      <FileText className={`h-5 w-5 flex-shrink-0 ${
                        uploadError ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'
                      }`} />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${
                        uploadError ? 'text-red-900 dark:text-red-100' : 'text-blue-900 dark:text-blue-100'
                      }`}>
                        {selectedFiles[0].name}
                      </p>
                      <p className={`text-xs ${
                        uploadError ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'
                      }`}>
                        {uploadError ? (
                          uploadError
                        ) : (
                          <>
                            {(selectedFiles[0].size / 1024).toFixed(1)} KB
                            {uploadingAttachments && <span className="ml-2">• Uploading...</span>}
                          </>
                        )}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      {uploadingAttachments ? (
                        <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
                      ) : uploadError ? (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleRetryUpload}
                            className="h-6 px-2 text-xs hover:bg-red-100 dark:hover:bg-red-900"
                            data-testid="button-retry-upload"
                          >
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Retry
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleRemoveAttachment}
                            className="h-6 w-6 p-0 hover:bg-red-100 dark:hover:bg-red-900"
                            data-testid="button-remove-attachment"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleRemoveAttachment}
                          className="h-6 w-6 p-0 hover:bg-blue-100 dark:hover:bg-blue-900"
                          data-testid="button-remove-attachment"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              <div className="flex gap-2.5 max-w-4xl mx-auto items-end">
                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                  data-testid="input-file-attachment"
                />
                
                {/* Attachment Button - iMessage Style */}
                <Button
                  variant="ghost"
                  className="h-11 w-11 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors p-0 flex items-center justify-center"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAttachments || selectedFiles.length > 0}
                  data-testid="button-attach-file"
                  title="Attach file"
                >
                  <Paperclip className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                </Button>
                
                <div className="flex-1 relative min-w-0">
                  <Textarea
                    ref={textareaRef}
                    value={messageInput}
                    onChange={(e) => handleInputChange(e.target.value)}
                    placeholder="Message"
                    className="w-full min-h-[44px] max-h-[200px] resize-none text-[15px] leading-[1.4] bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-blue-400 rounded-[22px] px-4 py-[11px] placeholder:text-gray-400 dark:placeholder:text-gray-500 transition-all duration-200 shadow-sm hover:border-gray-400 dark:hover:border-gray-600"
                    disabled={sendMessageMutation.isPending}
                    data-testid="input-message"
                    rows={1}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (messageInput.trim()) {
                          handleSendMessage();
                        }
                      }
                    }}
                  />
                  {messageInput.length > 0 && (
                    <div className="absolute bottom-2.5 right-3.5 text-[11px] text-gray-400 dark:text-gray-500 pointer-events-none select-none">
                      <span className={`font-medium transition-colors ${
                        messageInput.length >= 1600 
                          ? 'text-red-500 dark:text-red-400' 
                          : messageInput.length >= 1000 
                            ? 'text-amber-500 dark:text-amber-400' 
                            : ''
                      }`}>
                        {messageInput.length}
                      </span>
                    </div>
                  )}
                </div>
                
                {/* Template Variables Button - iMessage Style */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      className="h-11 w-11 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors p-0 flex items-center justify-center"
                      data-testid="button-template-variables"
                      title="Insert template variable"
                    >
                      <Code2 className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0" align="end">
                    <div className="p-3 border-b dark:border-gray-800">
                      <h3 className="font-semibold text-sm flex items-center gap-2">
                        <Code2 className="h-4 w-4 text-primary" />
                        Template Variables
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        Click to insert dynamic content
                      </p>
                    </div>
                    <ScrollArea className="max-h-[300px]">
                      <div className="p-2">
                        {templateVariables.map((template) => (
                          <button
                            key={template.variable}
                            onClick={() => insertTemplateVariable(template.variable)}
                            className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            data-testid={`template-var-${template.variable}`}
                          >
                            <div className="flex flex-col gap-1">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="font-mono text-xs font-semibold text-primary truncate">
                                    {template.variable}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {template.description}
                                  </div>
                                </div>
                              </div>
                              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded px-2 py-1.5 mt-1">
                                <div className="text-[10px] text-muted-foreground mb-0.5">Preview:</div>
                                <div className="text-xs font-medium text-blue-900 dark:text-blue-100 truncate">
                                  {template.value}
                                </div>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </ScrollArea>
                  </PopoverContent>
                </Popover>

                <Button
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim() || sendMessageMutation.isPending}
                  className="h-11 w-11 bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white rounded-full shadow-md hover:shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed p-0 flex items-center justify-center disabled:bg-gray-300 dark:disabled:bg-gray-700"
                  data-testid="button-send"
                >
                  {sendMessageMutation.isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5 translate-x-[1px]" />
                  )}
                </Button>
              </div>
            </div>
        </div>

        {/* Right Sidebar - Professional Controls & Quick Replies */}
        {conversation.controlMode === 'manual' && (
          <div className="lg:w-80 border-t lg:border-t-0 lg:border-l dark:border-gray-800 bg-gray-50 dark:bg-gray-900 overflow-y-auto max-h-[400px] lg:max-h-full">
            <div className="p-4 space-y-4">
              {/* Phase 12: Professional Conversation Management */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Professional Controls
                </h3>
                
                <ConversationMetaBar
                  controlMode={conversation.controlMode}
                  assignedAgent={conversation.assignedAgent}
                  lastHandoffAt={conversation.lastHandoffAt}
                  manualModeStartedAt={conversation.manualModeStartedAt}
                />
                
                <HandoffControls
                  conversationId={conversationId}
                  controlMode={conversation.controlMode}
                />
                
                <SmartSchedulePanel conversationId={conversationId} />
                
                <HandbackAnalysisPanel conversationId={conversationId} />
              </div>

              {/* Quick Reply Templates */}
              {quickReplyCategories.length > 0 && (
                <div className="pt-4 border-t dark:border-gray-800">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold flex items-center gap-2">
                      <div className="bg-primary/10 p-1.5 rounded-lg">
                        <MessageSquare className="h-4 w-4 text-primary" />
                      </div>
                      Quick Replies
                    </h3>
                    <Badge variant="outline" className="text-xs">
                      {quickReplyCategories.reduce((sum, cat) => sum + cat.templates.length, 0)} templates
                    </Badge>
                  </div>
                  
                  <div className="space-y-2">
                    {quickReplyCategories.map((category) => (
                      <Collapsible
                        key={category.id}
                        open={expandedCategories.has(category.id)}
                        onOpenChange={() => toggleCategory(category.id)}
                      >
                        <CollapsibleTrigger asChild>
                          <Button
                            variant="ghost"
                            className="w-full justify-between"
                            data-testid={`category-${category.id}`}
                          >
                            <span className="flex items-center gap-2">
                              {category.icon && <span>{category.icon}</span>}
                              {category.name}
                            </span>
                            {expandedCategories.has(category.id) ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-1 mt-1">
                          {category.templates.map((template) => (
                            <Button
                              key={template.id}
                              variant="outline"
                              size="sm"
                              onClick={() => handleQuickReplyClick(template.id, template.content)}
                              className="w-full text-left justify-start text-xs h-auto py-2 px-3 whitespace-normal"
                              disabled={sendMessageMutation.isPending}
                              data-testid={`template-${template.id}`}
                            >
                              {template.content}
                            </Button>
                          ))}
                        </CollapsibleContent>
                      </Collapsible>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
