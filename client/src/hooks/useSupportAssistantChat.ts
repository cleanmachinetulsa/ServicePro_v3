import { useState, useCallback } from 'react';
import type { SupportAssistantMessage, SupportAssistantContext } from '@shared/supportAssistantTypes';
import { reportFromAssistant } from '@/lib/supportIssueReporter';

function nowIso() {
  return new Date().toISOString();
}

export function useSupportAssistantChat(initialContext: SupportAssistantContext | null) {
  const [messages, setMessages] = useState<SupportAssistantMessage[]>(() => {
    if (!initialContext) return [];
    return [
      {
        id: 'welcome',
        role: 'assistant',
        createdAt: nowIso(),
        content:
          "Hi! I'm your ServicePro setup & support assistant.\n\n" +
          "I can help you with onboarding, phone & SMS setup, A2P registration, website & booking, loyalty/points, and more.\n\n" +
          "Tell me what you're working on, or try:\n" +
          "• \"Help me finish setup\"\n" +
          "• \"Help me with phone & text messages\"\n" +
          "• \"Explain my A2P campaign status\"\n" +
          "• \"Help me customize my website\"",
        source: 'system',
      },
    ];
  });

  const [isOpen, setIsOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleOpen = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!initialContext || !text.trim()) return;
      setError(null);

      const userMessage: SupportAssistantMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: text.trim(),
        createdAt: nowIso(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsSending(true);

      try {
        const res = await fetch('/api/support/assistant/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            message: text.trim(),
            currentRoute: initialContext.currentRoute,
          }),
        });

        if (!res.ok) {
          if (res.status === 429) {
            throw new Error('rate_limit');
          }
          throw new Error(`Assistant error: ${res.status}`);
        }

        const data = await res.json();

        if (data?.success && data?.reply?.replyText) {
          const assistantMessage: SupportAssistantMessage = {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            createdAt: data.reply.meta?.createdAt || nowIso(),
            content: data.reply.replyText,
            source: 'agent',
          };
          setMessages((prev) => [...prev, assistantMessage]);
        } else {
          setMessages((prev) => [
            ...prev,
            {
              id: `assistant-${Date.now()}`,
              role: 'assistant',
              createdAt: nowIso(),
              content:
                "I wasn't able to get a proper response. Please try again or open a support ticket from the Help & Support page.",
              source: 'system',
            },
          ]);
        }
      } catch (err: unknown) {
        console.error('Support assistant error', err);
        
        const isRateLimit = err instanceof Error && err.message === 'rate_limit';
        
        if (isRateLimit) {
          setError('Rate limit reached. Try again in a few minutes.');
          setMessages((prev) => [
            ...prev,
            {
              id: `assistant-error-${Date.now()}`,
              role: 'assistant',
              createdAt: nowIso(),
              content:
                "You've reached the hourly limit for assistant requests. Please wait a few minutes and try again, or open a support ticket from the Help & Support page for immediate help.",
              source: 'system',
            },
          ]);
        } else {
          setError('Something went wrong talking to the assistant.');
          setMessages((prev) => [
            ...prev,
            {
              id: `assistant-error-${Date.now()}`,
              role: 'assistant',
              createdAt: nowIso(),
              content:
                "I hit an error reaching the assistant. Please check your connection or try again. If this keeps happening, use the Help & Support page to open a ticket.",
              source: 'system',
            },
          ]);
          reportFromAssistant(
            text.trim(),
            err instanceof Error ? err.message : 'Unknown error',
            'error',
            `Route: ${initialContext.currentRoute}`
          ).catch(() => {});
        }
      } finally {
        setIsSending(false);
      }
    },
    [initialContext],
  );

  return {
    isOpen,
    toggleOpen,
    messages,
    isSending,
    error,
    sendMessage,
  };
}
