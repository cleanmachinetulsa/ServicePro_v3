import { useEffect, useRef, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Socket } from 'socket.io-client';

interface Message {
  id: number;
  sender: 'customer' | 'agent' | 'ai';
  deliveryStatus?: string;
  readAt?: string | Date | null;
}

interface UseReadReceiptsOptions {
  conversationId: number;
  messages: Message[];
  readerRole: 'agent' | 'customer';
  socket: Socket | null;
  enabled?: boolean;
}

interface MessagesReadEvent {
  conversationId: number;
  messageIds: number[];
  reader: {
    role: string;
  };
  readAt: string;
}

export function useReadReceipts({ 
  conversationId, 
  messages, 
  readerRole,
  socket,
  enabled = true 
}: UseReadReceiptsOptions) {
  const queryClient = useQueryClient();
  const observerRef = useRef<IntersectionObserver | null>(null);
  const pendingMessageIds = useRef<Set<number>>(new Set());
  const markAsReadTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Mutation to mark messages as read
  const markMessagesAsRead = useMutation({
    mutationFn: async (messageIds: number[]) => {
      const response = await apiRequest(
        'POST',
        `/api/conversations/${conversationId}/messages/read`,
        { messageIds, readerRole }
      );
      return response;
    },
    onSuccess: () => {
      // Invalidate conversation query to refresh message list
      queryClient.invalidateQueries({ queryKey: [`/api/conversations/${conversationId}`] });
    },
  });

  // Batch mark messages as read (debounced)
  const batchMarkAsRead = useCallback(() => {
    if (pendingMessageIds.current.size === 0) return;

    const idsToMark = Array.from(pendingMessageIds.current);
    pendingMessageIds.current.clear();
    
    markMessagesAsRead.mutate(idsToMark);
  }, [markMessagesAsRead]);

  // Add message to pending queue
  const queueMessageForRead = useCallback((messageId: number) => {
    pendingMessageIds.current.add(messageId);

    // Clear existing timeout
    if (markAsReadTimeoutRef.current) {
      clearTimeout(markAsReadTimeoutRef.current);
    }

    // Debounce: wait 500ms before marking as read
    markAsReadTimeoutRef.current = setTimeout(() => {
      batchMarkAsRead();
    }, 500);
  }, [batchMarkAsRead]);

  // Observer callback when message enters viewport
  const handleIntersection = useCallback((entries: IntersectionObserverEntry[]) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const messageId = parseInt(entry.target.getAttribute('data-message-id') || '0');
        if (messageId > 0) {
          queueMessageForRead(messageId);
        }
      }
    });
  }, [queueMessageForRead]);

  // Setup IntersectionObserver
  useEffect(() => {
    if (!enabled) return;

    observerRef.current = new IntersectionObserver(handleIntersection, {
      root: null,
      rootMargin: '0px',
      threshold: 0.5, // Message must be 50% visible
    });

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
      if (markAsReadTimeoutRef.current) {
        clearTimeout(markAsReadTimeoutRef.current);
      }
    };
  }, [enabled, handleIntersection]);

  // Listen for WebSocket read receipt events
  useEffect(() => {
    if (!socket || !enabled) return;

    const handleMessagesRead = (data: MessagesReadEvent) => {
      if (data.conversationId === conversationId) {
        // Update query cache with read status
        queryClient.setQueryData(
          [`/api/conversations/${conversationId}`],
          (oldData: any) => {
            if (!oldData?.data?.messages) return oldData;

            return {
              ...oldData,
              data: {
                ...oldData.data,
                messages: oldData.data.messages.map((msg: Message) =>
                  data.messageIds.includes(msg.id)
                    ? { ...msg, deliveryStatus: 'read', readAt: data.readAt }
                    : msg
                ),
              },
            };
          }
        );
      }
    };

    socket.on('messages_read', handleMessagesRead);

    return () => {
      socket.off('messages_read', handleMessagesRead);
    };
  }, [socket, conversationId, queryClient, enabled]);

  // Observe eligible messages (only those not authored by the reader)
  // Note: This is used as a callback ref, so it must NOT return a function
  const observeMessage = useCallback((element: HTMLElement | null, message: Message) => {
    if (!element || !observerRef.current || !enabled) return;

    // Only observe messages that:
    // 1. Weren't authored by the current reader
    // 2. Haven't been marked as read yet
    const shouldObserve = 
      (readerRole === 'agent' && message.sender === 'customer') ||
      (readerRole === 'customer' && (message.sender === 'agent' || message.sender === 'ai'));

    const notYetRead = message.deliveryStatus !== 'read';

    if (shouldObserve && notYetRead) {
      observerRef.current.observe(element);
    }
    // Cleanup is handled by the IntersectionObserver.disconnect() in the useEffect above
  }, [readerRole, enabled]);

  return {
    observeMessage,
    isMarking: markMessagesAsRead.isPending,
  };
}
