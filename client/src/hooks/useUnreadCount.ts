/**
 * useUnreadCount — global inbound-message counter for the AppShell nav badge.
 *
 * Responsibilities:
 *   1. Subscribe to the existing socket.io `new_message` monitoring channel
 *      (same channel used by messages.tsx — socket.io multiplexes on one transport)
 *   2. Increment unread counter for every inbound customer message while the
 *      operator is NOT on /messages
 *   3. Reset counter when the operator navigates to /messages
 *   4. Show a toast with customer name + "View" button when a message arrives
 *      off-page
 *   5. Keep the PWA app-icon badge in sync via PwaContext.updateBadge
 *
 * Guardrails:
 *   - Never requests notification permission — uses only already-granted access
 *   - Does NOT block or swallow errors in the fetch for customer name (fail-open)
 *   - Only fires toast / increments for sender === 'customer' to avoid noise
 *     from agent/AI outbound messages being echoed back
 */
import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import io from 'socket.io-client';
import { useToast } from '@/hooks/use-toast';
import { usePwa } from '@/contexts/PwaContext';
import { ToastAction } from '@/components/ui/toast';
import React from 'react';

interface NewMessagePayload {
  conversationId?: number;
  message?: {
    sender?: string;
    content?: string;
  };
}

interface ConversationLookup {
  data?: {
    customerName?: string | null;
    customerPhone?: string | null;
  };
}

export function useUnreadCount(): number {
  const [unreadCount, setUnreadCount] = useState(0);
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const { updateBadge } = usePwa();

  // Stable ref to location so the socket handler never closes over a stale value
  const locationRef = useRef(location);
  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  // Part A — reset counter when operator opens /messages
  useEffect(() => {
    if (location === '/messages') {
      setUnreadCount(0);
    }
  }, [location]);

  // Part C — keep PWA app-icon badge in sync
  useEffect(() => {
    updateBadge(unreadCount);
  }, [unreadCount, updateBadge]);

  // Part A + B — socket listener
  useEffect(() => {
    const socket = io();

    socket.on('connect', () => {
      socket.emit('join_monitoring');
    });

    socket.on('new_message', async (data: NewMessagePayload) => {
      // Only alert on inbound customer messages
      const sender = data?.message?.sender;
      if (sender && sender !== 'customer') return;

      // Operator is already looking at messages — no toast needed
      if (locationRef.current === '/messages') return;

      setUnreadCount(prev => prev + 1);

      // --- Part B toast ---
      // Best-effort fetch of customer name; fall back to generic label on any error
      let displayName: string | null = null;
      if (data?.conversationId) {
        try {
          const res = await fetch(`/api/conversations/${data.conversationId}`, {
            credentials: 'include',
          });
          if (res.ok) {
            const json: ConversationLookup = await res.json();
            displayName =
              json?.data?.customerName || json?.data?.customerPhone || null;
          }
        } catch {
          // ignore — use generic label
        }
      }

      toast({
        title: 'New message',
        description: displayName
          ? `New message from ${displayName}`
          : 'New inbound message',
        action: React.createElement(
          ToastAction,
          {
            altText: 'View messages',
            onClick: () => navigate('/messages'),
          },
          'View',
        ),
      });

      // --- Part C browser Notification (only if already granted, no prompt) ---
      if (
        typeof Notification !== 'undefined' &&
        Notification.permission === 'granted'
      ) {
        try {
          new Notification('New message', {
            body: displayName
              ? `New message from ${displayName}`
              : 'New inbound message',
            icon: '/favicon.ico',
          });
        } catch {
          // ignore — notifications are best-effort
        }
      }
    });

    return () => {
      socket.emit('leave_monitoring');
      socket.disconnect();
    };
  }, []); // mount/unmount only; location changes handled via locationRef

  return unreadCount;
}
