import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  MessageCircle,
  Bell,
  User,
  Bot,
  Clock,
  Smartphone,
  Star,
  Pin,
  Mail,
  Mic,
  AlertTriangle,
  Timer,
} from 'lucide-react';
import { FaFacebook, FaInstagram } from 'react-icons/fa';
import { format, isToday, isYesterday, formatDistanceToNow, differenceInMinutes } from 'date-fns';

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

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  isLoading: boolean;
}

function getPlatformBadge(platform: string) {
  const getBadgeClass = (baseColor: string, darkColor: string) => 
    `inline-flex items-center justify-center h-6 w-6 rounded-full ${baseColor} ${darkColor} shadow-sm`;
  
  switch (platform) {
    case 'facebook':
      return (
        <div className={getBadgeClass('bg-blue-100', 'dark:bg-blue-900/40')} title="Facebook Messenger">
          <FaFacebook className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
        </div>
      );
    case 'instagram':
      return (
        <div className={getBadgeClass('bg-gradient-to-br from-purple-100 to-pink-100', 'dark:from-purple-900/40 dark:to-pink-900/40')} title="Instagram DM">
          <FaInstagram className="h-3.5 w-3.5 text-pink-600 dark:text-pink-400" />
        </div>
      );
    case 'sms':
      return (
        <div className={getBadgeClass('bg-green-100', 'dark:bg-green-900/40')} title="SMS">
          <Smartphone className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
        </div>
      );
    case 'email':
      return (
        <div className={getBadgeClass('bg-orange-100', 'dark:bg-orange-900/40')} title="Email">
          <Mail className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
        </div>
      );
    case 'web':
      return (
        <div className={getBadgeClass('bg-purple-100', 'dark:bg-purple-900/40')} title="Web Chat">
          <MessageCircle className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
        </div>
      );
    default:
      return (
        <div className={getBadgeClass('bg-gray-100', 'dark:bg-gray-800')} title="Unknown">
          <MessageCircle className="h-3.5 w-3.5 text-gray-600 dark:text-gray-400" />
        </div>
      );
  }
}

function formatTimestamp(dateString: string): string {
  const date = new Date(dateString);
  
  if (isToday(date)) {
    return format(date, 'h:mm a');
  } else if (isYesterday(date)) {
    return 'Yesterday';
  } else {
    const daysDiff = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff < 7) {
      return format(date, 'EEEE');
    } else if (daysDiff < 365) {
      return format(date, 'MMM d');
    } else {
      return format(date, 'M/d/yy');
    }
  }
}

function getStatusBadge(conversation: Conversation) {
  if (conversation.needsHumanAttention) {
    return (
      <Badge variant="destructive" className="text-[10px] px-1.5 py-0.5 gap-1 font-semibold">
        <Bell className="h-2.5 w-2.5" />
        Alert
      </Badge>
    );
  }

  switch (conversation.controlMode) {
    case 'manual':
      return (
        <Badge variant="default" className="text-[10px] px-1.5 py-0.5 gap-1 bg-purple-600 font-semibold">
          <User className="h-2.5 w-2.5" />
          Manual
        </Badge>
      );
    case 'auto':
      return (
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 gap-1 font-semibold">
          <Bot className="h-2.5 w-2.5" />
          AI
        </Badge>
      );
    case 'paused':
      return (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 gap-1 font-semibold">
          <Clock className="h-2.5 w-2.5" />
          Paused
        </Badge>
      );
    default:
      return null;
  }
}

function getResponseTimeIndicator(conversation: Conversation) {
  if (!conversation.latestMessage || conversation.latestMessage.sender !== 'customer') {
    return null;
  }
  
  const minutesWaiting = differenceInMinutes(new Date(), new Date(conversation.latestMessage.timestamp));
  
  if (minutesWaiting < 15) {
    return null;
  }
  
  if (minutesWaiting >= 60) {
    const hours = Math.floor(minutesWaiting / 60);
    return (
      <Badge 
        variant="outline" 
        className="text-[10px] px-1.5 py-0.5 gap-1 font-medium bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800"
        data-testid="response-time-urgent"
      >
        <AlertTriangle className="h-2.5 w-2.5" />
        {hours}h wait
      </Badge>
    );
  }
  
  if (minutesWaiting >= 30) {
    return (
      <Badge 
        variant="outline" 
        className="text-[10px] px-1.5 py-0.5 gap-1 font-medium bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800"
        data-testid="response-time-warning"
      >
        <Timer className="h-2.5 w-2.5" />
        {minutesWaiting}m wait
      </Badge>
    );
  }
  
  return (
    <Badge 
      variant="outline" 
      className="text-[10px] px-1.5 py-0.5 gap-1 font-medium bg-gray-50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700"
      data-testid="response-time-normal"
    >
      <Timer className="h-2.5 w-2.5" />
      {minutesWaiting}m
    </Badge>
  );
}

export default function ConversationList({
  conversations,
  selectedId,
  onSelect,
  isLoading,
}: ConversationListProps) {
  return (
    <ScrollArea className="flex-1">
      {isLoading ? (
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="p-4 border-l-4 border-transparent">
              {/* Header skeleton */}
              <div className="flex items-start gap-3 mb-2">
                <Skeleton className="h-6 w-6 rounded-full flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              
              {/* Message preview skeleton */}
              <div className="flex items-start justify-between gap-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-5 w-8 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : conversations.length === 0 ? (
        <div className="p-4 text-center text-muted-foreground">
          No conversations found
        </div>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {conversations.map((conversation) => {
            const isPinned = conversation.pinned;
            const isUnread = conversation.unreadCount > 0;
            const isSelected = selectedId === conversation.id;
            
            return (
              <div
                key={conversation.id}
                onClick={() => onSelect(conversation.id)}
                className={`
                  relative p-4 cursor-pointer transition-all duration-200 ease-in-out
                  hover:shadow-sm hover:z-10
                  ${isSelected 
                    ? 'bg-primary/10 dark:bg-primary/20 border-l-4 border-primary shadow-sm' 
                    : isPinned
                      ? 'bg-blue-50/50 dark:bg-blue-950/20 border-l-4 border-blue-300 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30'
                      : 'border-l-4 border-transparent hover:bg-gray-50 dark:hover:bg-gray-800/50'
                  }
                  active:bg-gray-100 dark:active:bg-gray-800
                `}
                data-testid={`conversation-item-${conversation.id}`}
              >
                {/* Header: Avatar + Name + Timestamp */}
                <div className="flex items-start gap-3 mb-2">
                  {/* Platform Badge Avatar */}
                  {getPlatformBadge(conversation.platform)}
                  
                  {/* Name + Phone */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <h3 className={`truncate ${isUnread ? 'font-bold' : 'font-semibold'} dark:text-white`}>
                          {conversation.customerName || conversation.customerPhone}
                        </h3>
                        {isPinned && (
                          <Pin className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 fill-blue-600 dark:fill-blue-400 flex-shrink-0" data-testid={`pin-icon-${conversation.id}`} />
                        )}
                        {conversation.starred && (
                          <Star className="h-3.5 w-3.5 text-yellow-500 dark:text-yellow-400 fill-yellow-500 dark:fill-yellow-400 flex-shrink-0" data-testid={`star-icon-${conversation.id}`} />
                        )}
                      </div>
                      
                      {/* Timestamp */}
                      <span className={`text-xs flex-shrink-0 ${isUnread ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>
                        {formatTimestamp(conversation.lastMessageTime)}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {conversation.customerName && (
                        <p className="text-xs text-muted-foreground truncate">
                          {conversation.customerPhone}
                        </p>
                      )}
                      {/* Phone line badge for SMS only */}
                      {conversation.platform === 'sms' && conversation.phoneLineId && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-medium bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800">
                          {conversation.phoneLineId === 1 ? 'Main' : conversation.phoneLineId === 2 ? 'Owner' : `Line ${conversation.phoneLineId}`}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Message Preview */}
                <div className="flex items-start justify-between gap-2">
                  {conversation.latestMessage && (
                    <p className={`text-sm flex-1 min-w-0 line-clamp-2 break-words ${
                      isUnread 
                        ? 'text-gray-900 dark:text-gray-100 font-medium' 
                        : 'text-muted-foreground'
                    }`}>
                      <span className="font-medium">
                        {conversation.latestMessage.sender === 'customer'
                          ? ''
                          : conversation.latestMessage.sender === 'ai'
                          ? 'AI: '
                          : 'You: '}
                      </span>
                      {conversation.latestMessage.content.startsWith('🎙️ Voicemail:') 
                        ? conversation.latestMessage.content.replace('🎙️ Voicemail:\n\n', '🎙️ ')
                        : conversation.latestMessage.content}
                    </p>
                  )}
                  
                  {/* Unread Badge + Status + Response Time */}
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    {isUnread && (
                      <Badge
                        variant="default"
                        className="bg-primary text-white px-2 py-0.5 text-xs font-bold rounded-full shadow-sm"
                        data-testid={`unread-badge-${conversation.id}`}
                      >
                        {conversation.unreadCount}
                      </Badge>
                    )}
                    {getResponseTimeIndicator(conversation)}
                    {getStatusBadge(conversation)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </ScrollArea>
  );
}
