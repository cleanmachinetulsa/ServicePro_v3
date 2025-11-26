import { useState } from 'react';
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
  Mic
} from 'lucide-react';
import { SiFacebook, SiInstagram } from 'react-icons/si';
import { formatDistanceToNow } from 'date-fns';

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

interface NightOpsConversationListProps {
  conversations: Conversation[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  isLoading: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filter: string;
  onFilterChange: (filter: string) => void;
}

export function NightOpsConversationList({
  conversations,
  selectedId,
  onSelect,
  isLoading,
  searchQuery,
  onSearchChange,
  filter,
  onFilterChange
}: NightOpsConversationListProps) {

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

  return (
    <div className="flex flex-col h-full">
      <div className="p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-9 nightops-input bg-slate-900/60 border-slate-700/60 text-slate-200 placeholder:text-slate-500"
            data-testid="input-search-conversations"
          />
        </div>
      </div>

      <div className="px-3 py-2 flex gap-1.5 overflow-x-auto border-b border-slate-700/40">
        {['all', 'unread', 'sms', 'web'].map((f) => (
          <Button
            key={f}
            size="sm"
            variant="ghost"
            onClick={() => onFilterChange(f)}
            className={cn(
              "text-xs h-7 px-3 rounded-full transition-all",
              filter === f
                ? "bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/40"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            )}
            data-testid={`filter-${f}`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </Button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto nightops-scroll px-2 py-2">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-20 rounded-xl bg-slate-800/40 animate-pulse" />
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center p-6">
            <div className="w-16 h-16 rounded-full bg-slate-800/60 flex items-center justify-center mb-4">
              <MessageCircle className="h-8 w-8 text-slate-600" />
            </div>
            <p className="text-sm text-slate-500">
              {searchQuery ? 'No conversations match your search' : 'No conversations yet'}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {conversations.map((conv, index) => (
              <motion.button
                key={conv.id}
                onClick={() => onSelect(conv.id)}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03, duration: 0.2 }}
                className={cn(
                  "w-full text-left p-3 rounded-xl transition-all duration-200",
                  "nightops-conversation-row",
                  selectedId === conv.id && "selected"
                )}
                data-testid={`conversation-${conv.id}`}
              >
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "nightops-avatar w-10 h-10 text-sm flex-shrink-0",
                    conv.unreadCount > 0 && "ring-2 ring-cyan-400/60"
                  )}>
                    {getInitials(conv.customerName, conv.customerPhone)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-medium text-sm text-slate-100 truncate">
                          {conv.customerName || conv.customerPhone}
                        </span>
                        {conv.pinned && <Pin className="h-3 w-3 text-cyan-400 flex-shrink-0" />}
                        {conv.starred && <Star className="h-3 w-3 text-yellow-400 flex-shrink-0 fill-yellow-400" />}
                      </div>
                      <span className="text-[0.65rem] text-slate-500 flex-shrink-0 ml-2">
                        {formatDistanceToNow(new Date(conv.lastMessageTime), { addSuffix: false })}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 truncate mb-1.5">
                      {conv.latestMessage?.sender === 'customer' ? '' : 
                        conv.latestMessage?.sender === 'ai' ? '🤖 ' : 'You: '}
                      {conv.latestMessage?.content?.startsWith('🎙️ Voicemail:') 
                        ? conv.latestMessage.content.replace('🎙️ Voicemail:\n\n', '🎙️ ')
                        : conv.latestMessage?.content || 'No messages yet'}
                    </p>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={cn("p-1 rounded-md bg-slate-800/60", getPlatformColor(conv.platform))}>
                        {getPlatformIcon(conv.platform)}
                      </span>
                      
                      {conv.unreadCount > 0 && (
                        <span className="nightops-badge">
                          {conv.unreadCount}
                        </span>
                      )}
                      
                      {conv.needsHumanAttention && (
                        <span className="nightops-badge nightops-badge-danger flex items-center gap-1">
                          <AlertCircle className="h-2.5 w-2.5" />
                          Needs Attention
                        </span>
                      )}
                      
                      {(conv.controlMode === 'ai' || conv.controlMode === 'auto') && (
                        <span className="nightops-badge nightops-badge-purple flex items-center gap-1">
                          <Bot className="h-2.5 w-2.5" />
                          AI
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
