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
  reader: { role: string };
  readAt: string;
}

/**
 * Audit T2: Atomic "read up to" receipts.
 * Tracks the highest visible customer-message id and posts a single
 * PATCH /api/messages/read-up-to/:messageId per debounce window. The server
 * marks every message in the conversation up to that id as read in one query.
 */
export function useReadReceipts({
  conversationId,
  messages,
  readerRole,
  socket,
  enabled = true,
}: UseReadReceiptsOptions) {
  const queryClient = useQueryClient();
  const observerRef = useRef<IntersectionObserver | null>(null);
  const highestSeenIdRef = useRef<number>(0);
  const lastSentHighestRef = useRef<number>(0);
  const flushTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const markUpTo = useMutation({
    mutationFn: async (messageId: number) => {
      return apiRequest('PATCH', `/api/messages/read-up-to/${messageId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/conversations/${conversationId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
    },
  });

  const flush = useCallback(() => {
    const id = highestSeenIdRef.current;
    if (id <= lastSentHighestRef.current) return;
    lastSentHighestRef.current = id;
    markUpTo.mutate(id);
  }, [markUpTo]);

  const queueId = useCallback(
    (messageId: number) => {
      if (messageId <= highestSeenIdRef.current) return;
      highestSeenIdRef.current = messageId;
      if (flushTimeoutRef.current) clearTimeout(flushTimeoutRef.current);
      flushTimeoutRef.current = setTimeout(flush, 500);
    },
    [flush],
  );

  const handleIntersection = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = parseInt(entry.target.getAttribute('data-message-id') || '0');
          if (id > 0) queueId(id);
        }
      });
    },
    [queueId],
  );

  useEffect(() => {
    if (!enabled) return;
    observerRef.current = new IntersectionObserver(handleIntersection, {
      root: null,
      rootMargin: '0px',
      threshold: 0.5,
    });
    return () => {
      observerRef.current?.disconnect();
      if (flushTimeoutRef.current) clearTimeout(flushTimeoutRef.current);
    };
  }, [enabled, handleIntersection]);

  // Reset state when conversation changes
  useEffect(() => {
    highestSeenIdRef.current = 0;
    lastSentHighestRef.current = 0;
  }, [conversationId]);

  // Real-time read receipt updates from peers
  useEffect(() => {
    if (!socket || !enabled) return;
    const handler = (data: MessagesReadEvent) => {
      if (data.conversationId !== conversationId) return;
      queryClient.setQueryData([`/api/conversations/${conversationId}`], (oldData: any) => {
        if (!oldData?.data?.messages) return oldData;
        return {
          ...oldData,
          data: {
            ...oldData.data,
            messages: oldData.data.messages.map((msg: Message) =>
              data.messageIds.includes(msg.id)
                ? { ...msg, deliveryStatus: 'read', readAt: data.readAt }
                : msg,
            ),
          },
        };
      });
    };
    socket.on('messages_read', handler);
    return () => {
      socket.off('messages_read', handler);
    };
  }, [socket, conversationId, queryClient, enabled]);

  const observeMessage = useCallback(
    (element: HTMLElement | null, message: Message) => {
      if (!element || !observerRef.current || !enabled) return;
      const shouldObserve =
        (readerRole === 'agent' && message.sender === 'customer') ||
        (readerRole === 'customer' && (message.sender === 'agent' || message.sender === 'ai'));
      const notYetRead = message.deliveryStatus !== 'read';
      if (shouldObserve && notYetRead) {
        observerRef.current.observe(element);
      }
    },
    [readerRole, enabled],
  );

  return {
    observeMessage,
    isMarking: markUpTo.isPending,
  };
}
