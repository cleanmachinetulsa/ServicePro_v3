import { useMemo, useRef, useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Loader2, Sparkles, Send, AlertCircle } from 'lucide-react';
import { useSupportAssistantChat } from '../hooks/useSupportAssistantChat';
import type { SupportAssistantContext } from '@shared/supportAssistantTypes';

interface AuthContext {
  success: boolean;
  user: {
    id: number;
    username: string;
    role: string;
  };
  impersonation: {
    isActive: boolean;
    tenantId: string | null;
    tenantName: string | null;
  };
}

const PUBLIC_ROUTE_PREFIXES = [
  '/rewards',
  '/site/',
  '/portal',
  '/customer-login',
  '/home',
  '/pricing',
  '/careers',
  '/login',
  '/forgot-password',
  '/reset-password',
  '/sms-consent',
  '/privacy-policy',
  '/showcase',
  '/demo',
  '/directions',
  '/chat',
  '/payer-approval',
  '/quote-approval',
];

const HIDDEN_ROUTES: string[] = [
  // Empty for now - widget should be available on all authenticated pages
  // If specific pages need hiding, add them here
];

export function SupportAssistantWidget() {
  const [location] = useLocation();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const { data: authContext, isLoading: authLoading } = useQuery<AuthContext>({
    queryKey: ['/api/auth/context'],
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
    staleTime: 1000,
  });

  const context: SupportAssistantContext | null = useMemo(() => {
    if (!authContext?.success || !authContext?.user) return null;

    const isOwner = authContext.user.role === 'owner';
    const isAdmin = isOwner || authContext.user.role === 'admin';

    const tenantId = authContext.impersonation?.isActive 
      ? authContext.impersonation.tenantId || 'root'
      : 'root';

    return {
      tenantId,
      userId: authContext.user.id,
      userName: authContext.user.username,
      currentRoute: location,
      isOwner,
      isAdmin,
      lastErrorMessage: null,
    };
  }, [authContext, location]);

  const { isOpen, toggleOpen, messages, isSending, error, sendMessage } =
    useSupportAssistantChat(context);

  useEffect(() => {
    if (!isOpen) return;
    const el = messagesEndRef.current;
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages, isOpen]);

  const isPublicRoute = PUBLIC_ROUTE_PREFIXES.some(prefix => location.startsWith(prefix));
  const isHiddenRoute = HIDDEN_ROUTES.some(route => location.startsWith(route));
  
  if (authLoading) return null;
  if (!context || isPublicRoute || isHiddenRoute) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isSending) return;
    const text = input.trim();
    setInput('');
    void sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  return (
    <>
      <div className="fixed bottom-4 left-3 z-40 sm:bottom-5 sm:left-4 md:bottom-6 md:left-6" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <button
          type="button"
          onClick={toggleOpen}
          data-testid="button-support-assistant-fab"
          className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 p-2.5 sm:px-4 sm:py-2.5 text-sm font-semibold text-white shadow-lg shadow-purple-500/30 hover:shadow-xl hover:scale-105 transition-all focus:outline-none focus:ring-2 focus:ring-purple-300"
        >
          {isOpen ? (
            <X className="h-5 w-5 sm:h-4 sm:w-4" />
          ) : (
            <MessageCircle className="h-5 w-5 sm:h-4 sm:w-4" />
          )}
          <span className="hidden sm:inline">
            {isOpen ? 'Close' : 'AI Help'}
          </span>
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed bottom-16 left-2 z-40 w-[94vw] max-w-md sm:bottom-20 sm:left-4 md:bottom-24 md:left-6"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
            data-testid="support-assistant-panel"
          >
            <div className="flex max-h-[min(420px,calc(100vh-140px))] min-h-[320px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900/98 via-slate-900/95 to-slate-950/98 shadow-2xl backdrop-blur-xl sm:max-h-[480px]">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-xs text-white shadow-md">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold uppercase tracking-wide text-violet-200/90">
                      ServicePro Assistant
                    </span>
                    <span className="text-[11px] text-slate-300/70">
                      Setup & support help
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={toggleOpen}
                  className="rounded-full p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors"
                  data-testid="button-close-assistant"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3 text-sm">
                <div className="rounded-lg bg-slate-800/50 px-3 py-2 text-[11px] text-slate-400">
                  <span className="font-medium text-violet-300">
                    Current page:{" "}
                  </span>
                  <span className="font-mono text-slate-300">
                    {location}
                  </span>
                </div>

                {messages.map((m) => {
                  const isUser = m.role === 'user';
                  return (
                    <div
                      key={m.id}
                      className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={[
                          'max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed shadow-sm',
                          isUser
                            ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-br-md'
                            : 'bg-slate-800/90 text-slate-100 rounded-bl-md border border-white/5',
                        ].join(' ')}
                      >
                        {!isUser && (
                          <div className="mb-1.5 flex items-center gap-1 text-[10px] uppercase tracking-wide text-violet-300/80">
                            <Sparkles className="h-3 w-3" />
                            <span>Assistant</span>
                          </div>
                        )}
                        <div className="whitespace-pre-wrap">{m.content}</div>
                      </div>
                    </div>
                  );
                })}

                {isSending && (
                  <div className="flex w-full justify-start">
                    <div className="flex items-center gap-2 rounded-2xl border border-white/5 bg-slate-800/80 px-3.5 py-2.5 text-[12px] text-slate-300">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-400" />
                      <span>Thinking with your account settings...</span>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-950/40 px-3 py-2.5 text-[12px] text-rose-200">
                    <AlertCircle className="h-4 w-4 flex-shrink-0 text-rose-400 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              <div className="border-t border-white/10 bg-slate-950/90 px-3 py-3">
                <form onSubmit={handleSubmit} className="flex items-end gap-2">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={1}
                    className="max-h-24 min-h-[42px] flex-1 resize-none rounded-xl border border-slate-700/60 bg-slate-900/90 px-3.5 py-2.5 text-[13px] text-slate-100 placeholder:text-slate-500 focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400/50"
                    placeholder="Ask about setup, SMS, A2P, etc..."
                    data-testid="input-assistant-message"
                  />
                  <button
                    type="submit"
                    disabled={isSending || !input.trim()}
                    className="inline-flex h-[42px] items-center justify-center rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 px-4 text-xs font-semibold text-white shadow-md shadow-purple-500/30 disabled:cursor-not-allowed disabled:opacity-50 hover:shadow-lg transition-all"
                    data-testid="button-send-assistant-message"
                  >
                    {isSending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </button>
                </form>
                <p className="mt-2 text-[10px] text-slate-500">
                  Tip: Describe what you're trying to do for the best help.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
