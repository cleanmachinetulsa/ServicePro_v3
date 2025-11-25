import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, MessageCircle, Star, Archive, Pin } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

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

interface ConversationListPaneProps {
  conversations: Conversation[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  isLoading: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filter: string;
  onFilterChange: (filter: string) => void;
}

export function ConversationListPane({
  conversations,
  selectedId,
  onSelect,
  isLoading,
  searchQuery,
  onSearchChange,
  filter,
  onFilterChange
}: ConversationListPaneProps) {

  const filteredConversations = conversations.filter((conv) => {
    // Filter by type
    if (filter === 'unread' && conv.unreadCount === 0) return false;
    if (filter === 'sms' && conv.platform !== 'sms') return false;
    if (filter === 'web' && conv.platform !== 'web') return false;

    // Search filter
    if (!searchQuery.trim()) return true;
    const searchLower = searchQuery.toLowerCase();
    return (
      conv.customerName?.toLowerCase().includes(searchLower) ||
      conv.customerPhone.includes(searchLower) ||
      conv.latestMessage?.content.toLowerCase().includes(searchLower)
    );
  });

  const sortedConversations = [...filteredConversations].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
  });

  const getPlatformColor = (platform: string) => {
    switch (platform) {
      case 'sms': return 'bg-blue-500';
      case 'web': return 'bg-green-500';
      case 'facebook': return 'bg-blue-600';
      case 'instagram': return 'bg-purple-500';
      case 'email': return 'bg-gray-500';
      default: return 'bg-gray-400';
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800">
      {/* Search Bar */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-800">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-9"
            data-testid="input-search-conversations"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-800 flex gap-1.5 overflow-x-auto">
        <Button
          size="sm"
          variant={filter === 'all' ? 'default' : 'ghost'}
          onClick={() => onFilterChange('all')}
          className="text-xs h-7 px-3"
          data-testid="filter-all"
        >
          All
        </Button>
        <Button
          size="sm"
          variant={filter === 'unread' ? 'default' : 'ghost'}
          onClick={() => onFilterChange('unread')}
          className="text-xs h-7 px-3"
          data-testid="filter-unread"
        >
          Unread
        </Button>
        <Button
          size="sm"
          variant={filter === 'sms' ? 'default' : 'ghost'}
          onClick={() => onFilterChange('sms')}
          className="text-xs h-7 px-3"
          data-testid="filter-sms"
        >
          SMS
        </Button>
        <Button
          size="sm"
          variant={filter === 'web' ? 'default' : 'ghost'}
          onClick={() => onFilterChange('web')}
          className="text-xs h-7 px-3"
          data-testid="filter-web"
        >
          Web
        </Button>
      </div>

      {/* Conversation List */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="p-3 space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : sortedConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center p-6">
            <MessageCircle className="h-12 w-12 text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {searchQuery ? 'No conversations match your search' : 'No conversations yet'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {sortedConversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => onSelect(conv.id)}
                className={`w-full text-left p-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 ${
                  selectedId === conv.id ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-500' : ''
                }`}
                data-testid={`conversation-${conv.id}`}
              >
                <div className="flex items-start gap-2">
                  {/* Platform Indicator */}
                  <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${getPlatformColor(conv.platform)}`} />

                  <div className="flex-1 min-w-0">
                    {/* Header Row */}
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                          {conv.customerName || conv.customerPhone}
                        </span>
                        {conv.pinned && <Pin className="h-3 w-3 text-blue-500 flex-shrink-0" />}
                        {conv.starred && <Star className="h-3 w-3 text-yellow-500 flex-shrink-0 fill-yellow-500" />}
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0 ml-2">
                        {formatDistanceToNow(new Date(conv.lastMessageTime), { addSuffix: true })}
                      </span>
                    </div>

                    {/* Message Preview */}
                    <p className="text-xs text-gray-600 dark:text-gray-400 truncate mb-1">
                      {conv.latestMessage?.sender === 'customer' ? '' : 'You: '}
                      {conv.latestMessage?.content || 'No messages yet'}
                    </p>

                    {/* Badges */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {conv.unreadCount > 0 && (
                        <Badge variant="default" className="text-xs h-5 px-1.5">
                          {conv.unreadCount}
                        </Badge>
                      )}
                      {conv.needsHumanAttention && (
                        <Badge variant="destructive" className="text-xs h-5 px-1.5">
                          Needs Attention
                        </Badge>
                      )}
                      {(conv.controlMode === 'ai' || conv.controlMode === 'auto') && (
                        <Badge variant="secondary" className="text-xs h-5 px-1.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200">
                          AI
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
