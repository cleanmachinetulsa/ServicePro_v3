import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { usePhoneLine } from '@/contexts/PhoneLineContext';
import { 
  Bot, 
  User, 
  Send, 
  Loader2, 
  Sparkles,
  MessageSquare,
  ArrowLeft,
  Paperclip,
  Check,
  CheckCheck,
  Voicemail,
  Phone,
  AlertCircle
} from 'lucide-react';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import io from 'socket.io-client';
import type { Conversation, Message } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';
import { NightOpsVoicemailCard } from './NightOpsVoicemailCard';
import { AutopilotBanner } from './AutopilotBanner';

interface NightOpsThreadViewProps {
  conversationId: number | null;
  onBack?: () => void;
  onTakeOver?: () => void;
  controlMode?: 'ai' | 'human' | 'hybrid' | 'auto' | 'manual' | 'paused';
}

function formatDateDivider(date: Date): string {
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'EEEE, MMMM d');
}

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

export function NightOpsThreadView({
  conversationId,
  onBack,
  onTakeOver,
  controlMode = 'auto'
}: NightOpsThreadViewProps) {
  const { activeSendLineId } = usePhoneLine();
  const [messageInput, setMessageInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: conversationData, isLoading } = useQuery<{ 
    success: boolean; 
    data: Conversation & { messages: Message[] } 
  }>({
    queryKey: [`/api/conversations/${conversationId}`],
    enabled: !!conversationId,
    refetchInterval: 5000,
  });

  const conversation = conversationData?.data;
  const messages = conversation?.messages || [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  useEffect(() => {
    if (conversationId) {
      const socket = io();
      socket.emit('join_conversation', conversationId);
      
      socket.on('new_message', () => {
        queryClient.invalidateQueries({ queryKey: [`/api/conversations/${conversationId}`] });
      });
      
      return () => {
        socket.emit('leave_conversation', conversationId);
        socket.disconnect();
      };
    }
  }, [conversationId, queryClient]);

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest('POST', `/api/conversations/${conversationId}/messages`, {
        content,
        sender: 'agent',
        phoneLineId: activeSendLineId,
      });
      return res;
    },
    onSuccess: () => {
      setMessageInput('');
      queryClient.invalidateQueries({ queryKey: [`/api/conversations/${conversationId}`] });
    },
    onError: () => {
      toast({
        title: 'Failed to send',
        description: 'Message could not be sent. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleSend = () => {
    if (!messageInput.trim() || !conversationId) return;
    setIsSending(true);
    sendMessageMutation.mutate(messageInput, {
      onSettled: () => setIsSending(false),
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!conversationId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <div className="w-20 h-20 rounded-full bg-slate-800/60 flex items-center justify-center mb-6 ring-1 ring-slate-700/60">
          <MessageSquare className="h-10 w-10 text-slate-600" />
        </div>
        <h3 className="text-lg font-semibold text-slate-200 mb-2">
          No conversation selected
        </h3>
        <p className="text-sm text-slate-500 max-w-sm">
          Select a conversation from the inbox to view messages and start communicating
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  const messageGroups = groupMessagesByDate(messages);

  return (
    <div className="flex-1 flex flex-col h-full">
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
        />
      </div>

      <div className="flex-1 overflow-y-auto nightops-scroll px-3 py-4 space-y-4">
        <AnimatePresence>
          {messageGroups.map((group, groupIndex) => (
            <div key={groupIndex}>
              <div className="flex items-center justify-center my-4">
                <div className="px-3 py-1 rounded-full bg-slate-800/60 text-[0.65rem] text-slate-400 uppercase tracking-wider">
                  {formatDateDivider(group.date)}
                </div>
              </div>
              
              {group.messages.map((message, msgIndex) => {
                const isCustomer = message.sender === 'customer';
                const isAI = message.sender === 'ai';
                const isVoicemail = message.messageType === 'voicemail' || 
                  (message.metadata && (message.metadata as any).recordingUrl);
                
                if (isVoicemail) {
                  return (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: msgIndex * 0.02, duration: 0.2 }}
                      className="max-w-[85%] mx-auto"
                    >
                      <NightOpsVoicemailCard
                        fromLabel={conversation?.customerName || conversation?.customerPhone || 'Customer'}
                        createdAt={message.timestamp ? format(new Date(message.timestamp), 'h:mm a') : 'Now'}
                        transcription={(message.metadata as any)?.transcriptionText || message.content}
                        recordingUrl={(message.metadata as any)?.recordingUrl}
                        aiReplied={(message.metadata as any)?.aiReplied}
                      />
                    </motion.div>
                  );
                }
                
                return (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: msgIndex * 0.02, duration: 0.2 }}
                    className={cn(
                      "flex mb-2",
                      isCustomer ? "justify-start" : "justify-end"
                    )}
                    data-testid={`message-${message.id}`}
                  >
                    <div className="max-w-[75%]">
                      <div className={cn(
                        "flex items-center gap-1.5 mb-1 text-[0.65rem]",
                        isCustomer ? "justify-start" : "justify-end"
                      )}>
                        {isCustomer ? (
                          <>
                            <User className="h-3 w-3 text-slate-400" />
                            <span className="text-slate-400">
                              {conversation?.customerName || 'Customer'}
                            </span>
                          </>
                        ) : isAI ? (
                          <>
                            <span className="text-purple-400">AI Assistant</span>
                            <Bot className="h-3 w-3 text-purple-400" />
                          </>
                        ) : (
                          <>
                            <span className="text-cyan-400">You</span>
                            <Sparkles className="h-3 w-3 text-cyan-400" />
                          </>
                        )}
                      </div>
                      
                      <div className={cn(
                        "px-4 py-2.5 rounded-2xl text-sm leading-relaxed",
                        isCustomer 
                          ? "nightops-bubble-inbound rounded-bl-md"
                          : isAI 
                            ? "nightops-bubble-ai rounded-br-md"
                            : "nightops-bubble-outbound rounded-br-md"
                      )}>
                        <p className="whitespace-pre-wrap break-words" data-testid={`content-${message.id}`}>
                          {message.content}
                        </p>
                      </div>
                      
                      <div className={cn(
                        "flex items-center gap-1.5 mt-1 text-[0.6rem] text-slate-500",
                        isCustomer ? "justify-start" : "justify-end"
                      )}>
                        {!isCustomer && (
                          <>
                            {message.deliveryStatus === 'read' ? (
                              <CheckCheck className="h-2.5 w-2.5 text-cyan-400" />
                            ) : message.deliveryStatus === 'delivered' ? (
                              <CheckCheck className="h-2.5 w-2.5" />
                            ) : (
                              <Check className="h-2.5 w-2.5" />
                            )}
                          </>
                        )}
                        <span>
                          {message.timestamp ? format(new Date(message.timestamp), 'h:mm a') : 'Now'}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ))}
        </AnimatePresence>
        
        {conversation?.controlMode === 'auto' && messages.length > 0 && 
         messages[messages.length - 1]?.sender === 'customer' && (
          <div className="flex items-center gap-2 px-4 py-2">
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-purple-400 animate-pulse" />
              <span className="h-2 w-2 rounded-full bg-purple-400 animate-pulse delay-75" />
              <span className="h-2 w-2 rounded-full bg-purple-400 animate-pulse delay-150" />
            </div>
            <span className="text-xs text-purple-400">AI is composing...</span>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-slate-700/40 bg-slate-950/50">
        <div className="flex items-end gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 flex-shrink-0"
            data-testid="button-attach"
          >
            <Paperclip className="h-5 w-5" />
          </Button>
          
          <div className="flex-1 relative">
            <Textarea
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              className="min-h-[44px] max-h-32 resize-none nightops-input pr-12 py-3"
              rows={1}
              data-testid="input-message"
            />
          </div>
          
          <Button
            onClick={handleSend}
            disabled={!messageInput.trim() || isSending}
            className={cn(
              "h-10 w-10 rounded-xl flex-shrink-0 transition-all duration-200",
              messageInput.trim() 
                ? "nightops-button-primary shadow-[0_0_16px_rgba(34,211,238,0.4)]" 
                : "bg-slate-800/60 text-slate-500 cursor-not-allowed"
            )}
            data-testid="button-send"
          >
            {isSending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
        
        {conversation?.controlMode === 'manual' && (
          <p className="text-[0.65rem] text-slate-500 mt-2 text-center">
            You are in <span className="text-cyan-400">manual mode</span>. AI is paused.
          </p>
        )}
      </div>
    </div>
  );
}
