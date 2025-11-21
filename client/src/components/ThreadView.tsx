import { useState, useEffect, useRef } from 'react';
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
  ArrowLeft
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const socketRef = useRef<ReturnType<typeof io> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const draftRestoredRef = useRef(false); // Track if draft has been restored for current conversation
  const queryClient = useQueryClient();
  const { toast} = useToast();

  // Fetch current user
  const { data: currentUserData } = useQuery<{ success: boolean; user: { username: string } }>({
    queryKey: ['/api/users/me'],
  });
  const currentUser = currentUserData?.user;

  // Fetch conversation details with messages
  const { data: conversationData, isLoading: conversationLoading} = useQuery<{ success: boolean; data: Conversation & { messages: Message[] } }>({
    queryKey: [`/api/conversations/${conversationId}`],
    refetchInterval: 5000,
  });

  const conversation = conversationData?.data;
  
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

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation?.messages]);

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
    
    // Capture current scroll position BEFORE loading
    const scrollContainer = scrollContainerRef.current;
    const scrollParent = scrollContainer?.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
    const previousScrollHeight = scrollParent?.scrollHeight || 0;
    const previousScrollTop = scrollParent?.scrollTop || 0;
    
    setIsLoadingMore(true);
    
    try {
      // Get oldest message timestamp
      const oldestMessage = conversation.messages[0];
      const beforeTimestamp = oldestMessage.timestamp ? new Date(oldestMessage.timestamp).toISOString() : '';
      
      // Fetch older messages
      const response = await fetch(`/api/conversations/${conversationId}?before=${beforeTimestamp}&limit=50`);
      const data = await response.json();
      
      if (data.success && data.data) {
        // Update query cache with combined messages
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
        
        // Update hasMore state
        setHasMoreMessages(data.data.hasMore || false);
        
        // Restore scroll position AFTER DOM updates
        // Use setTimeout to ensure DOM has been updated
        setTimeout(() => {
          if (scrollParent) {
            const newScrollHeight = scrollParent.scrollHeight;
            const scrollHeightDifference = newScrollHeight - previousScrollHeight;
            scrollParent.scrollTop = previousScrollTop + scrollHeightDifference;
          }
        }, 0);
      }
    } catch (error) {
      console.error('Error loading more messages:', error);
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
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
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
          
          {/* Messages */}
          <ScrollArea ref={scrollContainerRef} className="flex-1 bg-gray-50 dark:bg-gray-900/50">
            <div className="max-w-4xl mx-auto py-6">
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
                  
                  <div ref={messagesEndRef} />
                </>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No messages yet</p>
                  <p className="text-sm mt-1">Start the conversation!</p>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* AI Suggestions - Enhanced UI */}
          {conversation.controlMode === 'manual' && suggestions.length > 0 && (
            <div className="border-t dark:border-gray-800 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 px-4 py-3">
              <div className="flex items-center gap-2 mb-3">
                <div className="bg-gradient-to-r from-blue-500 to-purple-500 p-1.5 rounded-lg">
                  <Sparkles className="h-3.5 w-3.5 text-white" />
                </div>
                <span className="text-sm font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  AI-Powered Suggestions
                </span>
                <Badge variant="secondary" className="text-xs">
                  {suggestions.length} available
                </Badge>
              </div>
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
              
              <div className="flex gap-3 max-w-4xl mx-auto items-end">
                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                  data-testid="input-file-attachment"
                />
                
                {/* Attachment Button */}
                <Button
                  variant="outline"
                  className="h-16 w-12 rounded-lg border-2 border-gray-300 dark:border-gray-700 hover:border-primary dark:hover:border-primary transition-all"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAttachments || selectedFiles.length > 0}
                  data-testid="button-attach-file"
                  title="Attach file"
                >
                  <div className="flex flex-col items-center gap-0.5">
                    <Paperclip className="h-4 w-4 text-primary" />
                    <span className="text-[9px] font-medium">File</span>
                  </div>
                </Button>
                
                <div className="flex-1 relative min-w-0">
                  <Textarea
                    ref={textareaRef}
                    value={messageInput}
                    onChange={(e) => handleInputChange(e.target.value)}
                    placeholder="Type your message here..."
                    className="w-full min-h-[64px] max-h-[240px] resize-none text-base leading-relaxed bg-gray-50 dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-700 focus:ring-2 focus:ring-primary/30 focus:border-primary rounded-xl pr-20 pb-8 font-sans"
                    disabled={sendMessageMutation.isPending}
                    data-testid="input-message"
                    rows={2}
                  />
                  {messageInput.length > 0 && (
                    <div className="absolute bottom-2 right-3 text-xs text-muted-foreground pointer-events-none">
                      <span className={`font-medium ${
                        messageInput.length >= 1600 
                          ? 'text-red-600 dark:text-red-400' 
                          : messageInput.length >= 1000 
                            ? 'text-amber-600 dark:text-amber-400' 
                            : ''
                      }`}>
                        {messageInput.length} chars
                        {messageInput.length >= 1600 && ' (limit reached)'}
                        {messageInput.length >= 1000 && messageInput.length < 1600 && ' (approaching SMS limit)'}
                      </span>
                    </div>
                  )}
                </div>
                
                {/* Template Variables Button */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-16 w-12 rounded-lg border-2 border-gray-300 dark:border-gray-700 hover:border-primary dark:hover:border-primary transition-all"
                      data-testid="button-template-variables"
                      title="Insert template variable"
                    >
                      <div className="flex flex-col items-center gap-0.5">
                        <Code2 className="h-4 w-4 text-primary" />
                        <span className="text-[9px] font-medium">Vars</span>
                      </div>
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
                  className="h-16 w-16 bg-primary hover:bg-primary/90 text-white rounded-lg shadow-lg hover:shadow-xl transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="button-send"
                >
                  {sendMessageMutation.isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <div className="flex flex-col items-center gap-0.5">
                      <Send className="h-5 w-5" />
                      <span className="text-[9px] font-medium">Send</span>
                    </div>
                  )}
                </Button>
              </div>
            </div>
        </div>

        {/* Quick Reply Templates Sidebar - Enhanced */}
        {conversation.controlMode === 'manual' && quickReplyCategories.length > 0 && (
          <div className="lg:w-80 border-t lg:border-t-0 lg:border-l dark:border-gray-800 bg-gray-50 dark:bg-gray-900 overflow-y-auto max-h-[400px] lg:max-h-full">
            <div className="p-4">
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
          </div>
        )}
      </div>
    </div>
  );
}
