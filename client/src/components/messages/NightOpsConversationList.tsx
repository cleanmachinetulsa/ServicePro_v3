import { useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Search, 
  MessageCircle, 
  Star, 
  Pin, 
  Bot,
  AlertCircle,
  Phone,
  Globe,
  Mail,
  Mic,
  Clock,
  CheckCircle2,
  Circle
} from 'lucide-react';
import { SiFacebook, SiInstagram } from 'react-icons/si';
import { formatDistanceToNow } from 'date-fns';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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

interface PhoneLine {
  id: number;
  label: string;
  phoneNumber: string;
  isActive: boolean;
}

interface NightOpsConversationListProps {
  conversations: Conversation[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  isLoading: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filter: string;
  onFilterChange: (filter: string) => void;
  phoneLines?: PhoneLine[];
}

export function NightOpsConversationList({
  conversations,
  selectedId,
  onSelect,
  isLoading,
  searchQuery,
  onSearchChange,
  filter,
  onFilterChange,
  phoneLines = []
}: NightOpsConversationListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const getInitials = (name: string | null, phone: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return phone.slice(-2);
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'sms': return <Phone className="h-3 w-3" />;
      case 'web': return <Globe className="h-3 w-3" />;
      case 'facebook': return <SiFacebook className="h-3 w-3" />;
      case 'instagram': return <SiInstagram className="h-3 w-3" />;
      case 'email': return <Mail className="h-3 w-3" />;
      default: return <MessageCircle className="h-3 w-3" />;
    }
  };

  const getPlatformColor = (platform: string) => {
    switch (platform) {
      case 'sms': return 'text-blue-400';
      case 'web': return 'text-green-400';
      case 'facebook': return 'text-blue-500';
      case 'instagram': return 'text-purple-400';
      case 'email': return 'text-gray-400';
      default: return 'text-slate-400';
    }
  };

  const getPhoneLineLabel = (phoneLineId: number | null) => {
    if (!phoneLineId || phoneLines.length === 0) return null;
    const line = phoneLines.find(l => l.id === phoneLineId);
    return line ? line.label : null;
  };

  const getStatusIndicator = (conv: Conversation) => {
    if (conv.status === 'resolved' || conv.status === 'closed') {
      return { icon: CheckCircle2, color: 'text-green-400', label: 'Resolved' };
    }
    if (conv.needsHumanAttention) {
      return { icon: AlertCircle, color: 'text-red-400', label: 'Needs Attention' };
    }
    if (conv.status === 'waiting' || conv.status === 'pending') {
      return { icon: Clock, color: 'text-yellow-400', label: 'Waiting' };
    }
    return { icon: Circle, color: 'text-cyan-400', label: 'Active' };
  };

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!conversations.length) return;
    
    const currentIndex = selectedId 
      ? conversations.findIndex(c => c.id === selectedId) 
      : -1;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = currentIndex < conversations.length - 1 ? currentIndex + 1 : 0;
      onSelect(conversations[nextIndex].id);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : conversations.length - 1;
      onSelect(conversations[prevIndex].id);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      searchInputRef.current?.blur();
    }
  }, [conversations, selectedId, onSelect]);

  useEffect(() => {
    if (selectedId && listRef.current) {
      const selectedElement = listRef.current.querySelector(`[data-conversation-id="${selectedId}"]`);
      if (selectedElement) {
        selectedElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [selectedId]);

  const filterOptions = [
    { value: 'all', label: 'All' },
    { value: 'unread', label: 'Unread' },
    { value: 'attention', label: 'Attention' },
    { value: 'sms', label: 'SMS' },
    { value: 'web', label: 'Web' },
  ];

  return (
    <TooltipProvider>
      <div 
        className="flex flex-col h-full" 
        onKeyDown={handleKeyDown}
        data-testid="night-ops-inbox"
      >
        <div className="p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              ref={searchInputRef}
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9 h-9 nightops-input bg-slate-900/60 border-slate-700/60 text-slate-200 placeholder:text-slate-500"
              data-testid="input-search-conversations"
            />
          </div>
        </div>

        <div className="px-3 py-2 flex gap-1 overflow-x-auto border-b border-slate-700/40 scrollbar-hide">
          {filterOptions.map((f) => (
            <Button
              key={f.value}
              size="sm"
              variant="ghost"
              onClick={() => onFilterChange(f.value)}
              className={cn(
                "text-xs h-7 px-2.5 rounded-full transition-all whitespace-nowrap",
                filter === f.value
                  ? "bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/40"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              )}
              data-testid={`filter-${f.value}`}
            >
              {f.label}
            </Button>
          ))}
        </div>

        <div 
          ref={listRef}
          className="flex-1 overflow-y-auto nightops-scroll px-2 py-2"
          tabIndex={0}
        >
          {isLoading ? (
            <div className="space-y-2" data-testid="inbox-loading">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-20 rounded-xl bg-slate-800/40 animate-pulse" />
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center p-6" data-testid="inbox-empty">
              <div className="w-16 h-16 rounded-full bg-slate-800/60 flex items-center justify-center mb-4">
                <MessageCircle className="h-8 w-8 text-slate-600" />
              </div>
              <p className="text-sm text-slate-500">
                {searchQuery ? 'No conversations match your search' : 'No conversations yet'}
              </p>
              <p className="text-xs text-slate-600 mt-1">
                {searchQuery ? 'Try a different search term' : 'New messages will appear here'}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {conversations.map((conv, index) => {
                const statusInfo = getStatusIndicator(conv);
                const StatusIcon = statusInfo.icon;
                const phoneLineLabel = getPhoneLineLabel(conv.phoneLineId);
                
                return (
                  <motion.button
                    key={conv.id}
                    onClick={() => onSelect(conv.id)}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index * 0.02, 0.2), duration: 0.15 }}
                    className={cn(
                      "w-full text-left p-3 rounded-xl transition-all duration-200",
                      "nightops-conversation-row focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50",
                      selectedId === conv.id && "selected"
                    )}
                    data-testid={`conversation-${conv.id}`}
                    data-conversation-id={conv.id}
                  >
                    <div className="flex items-start gap-3">
                      <div className="relative flex-shrink-0">
                        <div className={cn(
                          "nightops-avatar w-10 h-10 text-sm",
                          conv.unreadCount > 0 && "ring-2 ring-cyan-400/60"
                        )}>
                          {getInitials(conv.customerName, conv.customerPhone)}
                        </div>
                        <div className={cn(
                          "absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center",
                          "bg-slate-900 ring-1 ring-slate-700"
                        )}>
                          <StatusIcon className={cn("h-2.5 w-2.5", statusInfo.color)} />
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className={cn(
                              "font-medium text-sm truncate",
                              conv.unreadCount > 0 ? "text-slate-50" : "text-slate-200"
                            )}>
                              {conv.customerName || conv.customerPhone}
                            </span>
                            {conv.pinned && (
                              <Pin className="h-3 w-3 text-cyan-400 flex-shrink-0" />
                            )}
                            {conv.starred && (
                              <Star className="h-3 w-3 text-yellow-400 flex-shrink-0 fill-yellow-400" />
                            )}
                          </div>
                          <span className="text-[0.65rem] text-slate-500 flex-shrink-0 ml-2 tabular-nums">
                            {formatDistanceToNow(new Date(conv.lastMessageTime), { addSuffix: false })}
                          </span>
                        </div>

                        <p className={cn(
                          "text-xs truncate mb-1.5",
                          conv.unreadCount > 0 ? "text-slate-300 font-medium" : "text-slate-400"
                        )}>
                          {conv.latestMessage?.sender === 'customer' ? '' : 
                            conv.latestMessage?.sender === 'ai' ? '🤖 ' : 'You: '}
                          {conv.latestMessage?.content?.startsWith('🎙️ Voicemail:') 
                            ? conv.latestMessage.content.replace('🎙️ Voicemail:\n\n', '🎙️ ')
                            : conv.latestMessage?.content || 'No messages yet'}
                        </p>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className={cn("p-1 rounded-md bg-slate-800/60", getPlatformColor(conv.platform))}>
                                {getPlatformIcon(conv.platform)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-xs">
                              {conv.platform.charAt(0).toUpperCase() + conv.platform.slice(1)}
                            </TooltipContent>
                          </Tooltip>
                          
                          {phoneLineLabel && (
                            <span className="text-[0.6rem] px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-400 border border-slate-700/50">
                              {phoneLineLabel}
                            </span>
                          )}
                          
                          {conv.unreadCount > 0 && (
                            <span className="nightops-badge min-w-[1.25rem] text-center">
                              {conv.unreadCount}
                            </span>
                          )}
                          
                          {conv.needsHumanAttention && (
                            <span className="nightops-badge nightops-badge-danger flex items-center gap-1">
                              <AlertCircle className="h-2.5 w-2.5" />
                              <span className="hidden sm:inline">Attention</span>
                            </span>
                          )}
                          
                          {(conv.controlMode === 'ai' || conv.controlMode === 'auto') && (
                            <span className="nightops-badge nightops-badge-purple flex items-center gap-1">
                              <Bot className="h-2.5 w-2.5" />
                              <span className="hidden sm:inline">AI</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>
        
        <div className="px-3 py-2 border-t border-slate-700/40 text-xs text-slate-500">
          <div className="flex items-center justify-between">
            <span>{conversations.length} conversation{conversations.length !== 1 ? 's' : ''}</span>
            <span className="text-[0.65rem] text-slate-600">↑↓ to navigate</span>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
