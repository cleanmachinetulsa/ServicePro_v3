import { format } from 'date-fns';
import { Bot, User, MessageSquare, Check, CheckCheck, FileText, ExternalLink, CheckCircle2, Smile, Edit2, Trash2, Copy, Forward, Star, Mic, Play, Volume2 } from 'lucide-react';
import type { Message } from '@shared/schema';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';

/**
 * MessageBubble Component - Extensible message display with render-prop slots
 * 
 * This component renders individual message bubbles in a conversation thread.
 * It provides extension points (slots) for future features like:
 * - Emoji reactions (Phase 2: Tapback-style reactions beneath messages)
 * - Scheduled message badges (Phase 2: Show "Scheduled for..." next to timestamp)
 * - Delivery indicators (Phase 2: Read receipts, delivery checkmarks)
 * - Message actions (Phase 2: Edit/delete hover toolbar)
 * 
 * All slots are optional and accept render props that receive the message object.
 */

// Quick reaction emojis (iMessage/Slack style)
const QUICK_REACTIONS = ['❤️', '👍', '👎', '😂', '😮', '😢'];

interface MessageReaction {
  id: number;
  messageId: number;
  userId: number;
  emoji: string;
  createdAt: string;
}

interface MessageBubbleProps {
  message: Message;
  conversationCustomerName?: string | null;
  conversationCustomerPhone?: string | null;
  conversationAssignedAgent?: string | null;
  reactions?: MessageReaction[];
  onAddReaction?: (emoji: string) => void;
  onRemoveReaction?: (reactionId: number) => void;
  currentUserId?: number;
  onEditMessage?: (messageId: number) => void;
  onDeleteMessage?: (messageId: number) => void;
  onForwardMessage?: (messageId: number) => void;
  onStarMessage?: (messageId: number) => void;
  
  /**
   * EXTENSION POINT: Reaction Slot
   * Renders emoji reactions beneath the message bubble (e.g., 👍 ❤️ 😂)
   * Position: Below timestamp row, flex-aligned with bubble
   * Phase 2 Feature: Tapback-style reactions like iMessage
   * @example reactionSlot={(msg) => <ReactionBar messageId={msg.id} reactions={reactions} />}
   */
  reactionSlot?: (message: Message) => React.ReactNode;
  
  /**
   * EXTENSION POINT: Scheduled Meta Slot
   * Renders scheduled message indicators next to timestamp
   * Position: Adjacent to timestamp badge, inline
   * Phase 2 Feature: "Scheduled for 2:30 PM" badge for queued messages
   * @example scheduledMetaSlot={(msg) => <ScheduledBadge scheduledFor={msg.scheduledFor} />}
   */
  scheduledMetaSlot?: (message: Message) => React.ReactNode;
  
  /**
   * EXTENSION POINT: Delivery Indicator Slot
   * Renders delivery status checkmarks (sent/delivered/read)
   * Position: Next to timestamp, inline with sender name
   * Phase 2 Feature: WhatsApp-style delivery indicators
   * @example deliveryIndicatorSlot={(msg) => <DeliveryCheckmarks status={msg.deliveryStatus} />}
   */
  deliveryIndicatorSlot?: (message: Message) => React.ReactNode;
  
  /**
   * EXTENSION POINT: Message Action Slot
   * Renders edit/delete/forward actions on hover
   * Position: Top-right corner of bubble, appears on hover
   * Phase 2 Feature: Message editing, deletion, forwarding
   * @example messageActionSlot={(msg) => <MessageActions onEdit={...} onDelete={...} />}
   */
  messageActionSlot?: (message: Message) => React.ReactNode;
}

export default function MessageBubble({
  message,
  conversationCustomerName,
  conversationCustomerPhone,
  conversationAssignedAgent,
  reactions = [],
  onAddReaction,
  onRemoveReaction,
  currentUserId,
  onEditMessage,
  onDeleteMessage,
  onForwardMessage,
  onStarMessage,
  reactionSlot,
  scheduledMetaSlot,
  deliveryIndicatorSlot,
  messageActionSlot,
}: MessageBubbleProps) {
  
  const { toast } = useToast();
  const isCustomer = message.sender === 'customer';
  const isSent = message.sender === 'agent' || message.sender === 'ai';
  
  const handleCopyMessage = () => {
    if (message.content) {
      navigator.clipboard.writeText(message.content);
      toast({
        title: "Message copied",
        description: "Message text copied to clipboard",
      });
    }
  };
  
  // Group reactions by emoji
  const groupedReactions = reactions.reduce((acc, reaction) => {
    if (!acc[reaction.emoji]) {
      acc[reaction.emoji] = [];
    }
    acc[reaction.emoji].push(reaction);
    return acc;
  }, {} as Record<string, MessageReaction[]>);
  
  const handleReactionClick = (emoji: string) => {
    if (!currentUserId || !onAddReaction || !onRemoveReaction) return;
    
    // Check if user already reacted with this emoji
    const existingReaction = reactions.find(r => r.emoji === emoji && r.userId === currentUserId);
    
    if (existingReaction) {
      onRemoveReaction(existingReaction.id);
    } else {
      onAddReaction(emoji);
    }
  };
  
  const getSenderLabel = (sender: string) => {
    switch (sender) {
      case 'customer':
        return conversationCustomerName || conversationCustomerPhone || 'Customer';
      case 'ai':
        return 'AI';
      case 'agent':
        return 'You';
      default:
        return sender;
    }
  };
  
  const metadata = message.metadata as Record<string, any> | null;
  const isVoicemail = metadata?.type === 'voicemail' || (message.content && (message.content as string).startsWith('🎙️ Voicemail:'));
  const voicemailRecordingUrl = metadata?.recordingUrl || null;

  return (
    <div
      className={`flex ${isCustomer ? 'justify-start' : 'justify-end'} mb-1 px-2`}
      data-testid={`message-${message.id}`}
    >
      <div className="relative max-w-[75%] sm:max-w-[65%] group">
        {/* Message Actions Toolbar - Appears on hover AND on focus/mobile tap */}
        <div className={`absolute -top-1 ${isCustomer ? '-right-1' : '-left-1'} opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-200 z-10 sm:opacity-0`}>
          <div className="flex items-center gap-0.5 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-0.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={handleCopyMessage}
              title="Copy message"
              data-testid="button-copy-message"
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
            {isSent && onEditMessage && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => onEditMessage(message.id)}
                title="Edit message"
                data-testid="button-edit-message"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </Button>
            )}
            {onForwardMessage && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => onForwardMessage(message.id)}
                title="Forward message"
                data-testid="button-forward-message"
              >
                <Forward className="h-3.5 w-3.5" />
              </Button>
            )}
            {onStarMessage && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => onStarMessage(message.id)}
                title="Star message"
                data-testid="button-star-message"
              >
                <Star className="h-3.5 w-3.5" />
              </Button>
            )}
            {isSent && onDeleteMessage && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 hover:bg-red-100 dark:hover:bg-red-900 text-red-600 dark:text-red-400"
                onClick={() => onDeleteMessage(message.id)}
                title="Delete message"
                data-testid="button-delete-message"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
        
        {/* Message Action Slot - Appears on hover (Phase 2) */}
        {messageActionSlot && (
          <div className="absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
               style={{ [isCustomer ? 'right' : 'left']: '-40px' }}>
            {messageActionSlot(message)}
          </div>
        )}
        
        {/* Message Bubble - iMessage Style */}
        <div className={`
          relative px-3.5 py-2 shadow-sm
          ${isCustomer 
            ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-2xl rounded-bl-md'
            : 'bg-blue-500 dark:bg-blue-600 text-white rounded-2xl rounded-br-md'
          }
          ${isVoicemail ? 'border-l-4 border-cyan-500 dark:border-cyan-400' : ''}
        `}>
          {/* Voicemail Header */}
          {isVoicemail && (
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-300/50 dark:border-gray-600/50">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-cyan-500/20 dark:bg-cyan-400/20">
                <Mic className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
              </div>
              <div className="flex-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
                  Voicemail Transcription
                </span>
              </div>
              {voicemailRecordingUrl && (
                <a
                  href={voicemailRecordingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    isCustomer 
                      ? 'bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-700 dark:text-cyan-300'
                      : 'bg-white/20 hover:bg-white/30 text-white'
                  }`}
                  data-testid="button-play-voicemail"
                >
                  <Play className="h-3 w-3" />
                  Play
                </a>
              )}
            </div>
          )}
          
          {/* Message Content */}
          {message.content && (
            <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words" data-testid={`content-${message.id}`}>
              {isVoicemail && message.content.startsWith('🎙️ Voicemail:') 
                ? (message.content as string).replace('🎙️ Voicemail:\n\n', '')
                : (message.content as string)}
            </p>
          )}
          
          {/* Attachments */}
          {message.metadata && (message.metadata as any).attachments?.length > 0 && (
            <div className={`${message.content ? 'mt-2' : ''} space-y-1.5`}>
              {((message.metadata as any).attachments as any[]).map((attachment: any, index: number) => {
                const isImage = attachment.type?.startsWith('image/');
                
                if (isImage) {
                  return (
                    <a
                      key={index}
                      href={attachment.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block overflow-hidden rounded-lg border-2 border-white/20"
                      data-testid={`attachment-image-${index}`}
                    >
                      <img
                        src={attachment.directUrl || attachment.url}
                        alt={attachment.name}
                        className="max-w-full h-auto max-h-64 object-contain"
                        loading="lazy"
                      />
                    </a>
                  );
                } else {
                  return (
                    <a
                      key={index}
                      href={attachment.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center gap-2 p-2 rounded-lg ${
                        isCustomer 
                          ? 'bg-gray-300/50 dark:bg-gray-600/50 hover:bg-gray-300 dark:hover:bg-gray-600'
                          : 'bg-blue-400/30 hover:bg-blue-400/50'
                      } transition-colors`}
                      data-testid={`attachment-file-${index}`}
                    >
                      <FileText className="h-4 w-4 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{attachment.name}</p>
                        {attachment.size && (
                          <p className="text-xs opacity-75">
                            {(parseInt(attachment.size) / 1024).toFixed(1)} KB
                          </p>
                        )}
                      </div>
                      <ExternalLink className="h-3.5 w-3.5 flex-shrink-0 opacity-75" />
                    </a>
                  );
                }
              })}
            </div>
          )}
          
          {/* Scheduled Meta Slot - Inline at bottom (Phase 2) */}
          {scheduledMetaSlot && (
            <div className="mt-1">
              {scheduledMetaSlot(message)}
            </div>
          )}
        </div>
        
        {/* Timestamp + Delivery Status - Below bubble */}
        <div className={`flex flex-col ${isCustomer ? 'items-start' : 'items-end'} gap-0.5 mt-0.5 px-1`}>
          <div className="flex items-center gap-1">
            {/* Delivery Indicator for sent messages - Production-grade checkmarks */}
            {isSent && (
              <div className="flex items-center" data-testid={`delivery-status-${message.deliveryStatus || 'sent'}`}>
                {message.deliveryStatus === 'failed' ? (
                  <div title="Failed to send" className="text-red-500 dark:text-red-400">
                    <MessageSquare className="h-3 w-3" />
                  </div>
                ) : message.deliveryStatus === 'read' ? (
                  <div title="Read" className="text-blue-500 dark:text-blue-400">
                    <CheckCheck className="h-3 w-3 fill-current" />
                  </div>
                ) : message.deliveryStatus === 'delivered' ? (
                  <div title="Delivered" className="text-gray-500 dark:text-gray-400">
                    <CheckCheck className="h-3 w-3" />
                  </div>
                ) : (
                  <div title="Sent" className="text-gray-500 dark:text-gray-400">
                    <Check className="h-3 w-3" />
                  </div>
                )}
              </div>
            )}
            {deliveryIndicatorSlot && deliveryIndicatorSlot(message)}
            
            <span className="text-[11px] text-muted-foreground" data-testid={`timestamp-${message.id}`}>
              {message.timestamp ? format(new Date(message.timestamp), 'h:mm a') : 'Now'}
            </span>
          </div>
          
          {/* Read Receipt - Show "Read" timestamp for sent messages that are read */}
          {isSent && message.deliveryStatus === 'read' && message.readAt && (
            <span className="text-[10px] text-blue-500 dark:text-blue-400" data-testid={`read-receipt-${message.id}`}>
              Read {format(new Date(message.readAt), 'h:mm a')}
            </span>
          )}
        </div>
        
        {/* Reactions - iMessage/Slack style tapbacks */}
        {(reactions.length > 0 || onAddReaction) && (
          <div className={`mt-1 flex items-center gap-1 flex-wrap ${isCustomer ? 'justify-start' : 'justify-end'}`}>
            {/* Existing reactions */}
            {(Object.entries(groupedReactions) as [string, MessageReaction[]][]).map(([emoji, reactionList]) => {
              const userReacted = currentUserId && reactionList.some(r => r.userId === currentUserId);
              return (
                <button
                  key={emoji}
                  onClick={() => handleReactionClick(emoji)}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-all ${
                    userReacted 
                      ? 'bg-blue-100 dark:bg-blue-900 border border-blue-300 dark:border-blue-700' 
                      : 'bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                  data-testid={`reaction-${emoji}-count-${reactionList.length}`}
                  title={`${reactionList.length} reaction${reactionList.length > 1 ? 's' : ''}`}
                >
                  <span>{emoji}</span>
                  <span className="font-medium">{reactionList.length}</span>
                </button>
              );
            })}
            
            {/* Add reaction button */}
            {onAddReaction && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 opacity-0 group-hover:opacity-100 transition-opacity"
                    data-testid="button-add-reaction"
                  >
                    <Smile className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2" align={isCustomer ? 'start' : 'end'}>
                  <div className="flex items-center gap-1">
                    {QUICK_REACTIONS.map(emoji => (
                      <button
                        key={emoji}
                        onClick={() => handleReactionClick(emoji)}
                        className="text-2xl hover:scale-125 transition-transform p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                        data-testid={`quick-reaction-${emoji}`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        )}
        
        {/* Reaction Slot - Below timestamp (Phase 2) */}
        {reactionSlot && (
          <div className={`mt-1 flex items-center gap-1 ${isCustomer ? 'justify-start' : 'justify-end'}`}>
            {reactionSlot(message)}
          </div>
        )}
      </div>
    </div>
  );
}
