import * as React from 'react';
import { useMemo, useEffect, RefObject } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { UseMutationResult } from '@tanstack/react-query';
import MessageBubble from './messages/MessageBubble';

interface MessageRow {
  id: number;
  conversationId: number;
  sender: 'customer' | 'agent' | 'ai';
  content: string;
  timestamp?: string | Date;
  deliveryStatus?: string;
  readAt?: string | Date | null;
  attachments?: Array<{ url: string; directUrl?: string; name: string; type?: string; size?: string }>;
  [key: string]: unknown;
}

interface ReactionRow {
  id: number;
  messageId: number;
  emoji: string;
  userId?: number;
}

interface ConversationLite {
  id: number;
  platform?: string;
  customerName?: string | null;
  customerPhone?: string | null;
  assignedAgent?: string | null;
}

type MessageBubbleProps = React.ComponentProps<typeof MessageBubble>;
type SlotProp<K extends keyof MessageBubbleProps> = MessageBubbleProps[K];

interface FlatItem {
  type: 'divider' | 'message';
  key: string;
  date?: Date;
  message?: MessageRow;
}

interface Props {
  messages: MessageRow[];
  scrollParentRef: RefObject<HTMLDivElement>;
  conversation: ConversationLite;
  reactions: ReactionRow[];
  addReactionMutation: UseMutationResult<unknown, unknown, { messageId: number; emoji: string }, unknown>;
  removeReactionMutation: UseMutationResult<unknown, unknown, number, unknown>;
  currentUser: { id?: number } | null | undefined;
  messageReactionSlot?: SlotProp<'reactionSlot'>;
  scheduledMetaSlot?: SlotProp<'scheduledMetaSlot'>;
  deliveryIndicatorSlot?: SlotProp<'deliveryIndicatorSlot'>;
  messageActionSlot?: SlotProp<'messageActionSlot'>;
  observeMessage: (el: HTMLElement | null, message: MessageRow) => void;
}

function formatDateDivider(date: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

function groupMessagesByDate(messages: MessageRow[]): Array<{ date: Date; messages: MessageRow[] }> {
  const groups: Record<string, { date: Date; messages: MessageRow[] }> = {};
  messages.forEach((m) => {
    const d = new Date(m.timestamp || Date.now());
    const key = d.toDateString();
    if (!groups[key]) groups[key] = { date: d, messages: [] };
    groups[key].messages.push(m);
  });
  return Object.values(groups).sort((a, b) => a.date.getTime() - b.date.getTime());
}

export default function VirtualizedMessageList({
  messages,
  scrollParentRef,
  conversation,
  reactions,
  addReactionMutation,
  removeReactionMutation,
  currentUser,
  messageReactionSlot,
  scheduledMetaSlot,
  deliveryIndicatorSlot,
  messageActionSlot,
  observeMessage,
}: Props) {
  const items: FlatItem[] = useMemo(() => {
    const out: FlatItem[] = [];
    groupMessagesByDate(messages).forEach((group, gi) => {
      out.push({ type: 'divider', key: `d-${gi}-${group.date.toDateString()}`, date: group.date });
      group.messages.forEach((m) => {
        out.push({ type: 'message', key: `m-${m.id}`, message: m });
      });
    });
    return out;
  }, [messages]);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollParentRef.current,
    estimateSize: (index) => (items[index].type === 'divider' ? 44 : 76),
    overscan: 12,
    measureElement: (el) => el?.getBoundingClientRect().height ?? 76,
    getItemKey: (index) => items[index].key,
  });

  useEffect(() => {
    virtualizer.measure();
  }, [conversation.id, virtualizer]);

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  return (
    <div
      style={{ height: totalSize, position: 'relative', width: '100%' }}
      data-testid="virtualized-message-list"
    >
      {virtualItems.map((vi) => {
        const item = items[vi.index];
        return (
          <div
            key={vi.key}
            data-index={vi.index}
            ref={virtualizer.measureElement}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              transform: `translateY(${vi.start}px)`,
            }}
          >
            {item.type === 'divider' && item.date ? (
              <div className="flex items-center justify-center my-3">
                <div className="bg-white dark:bg-gray-800 px-3 py-1 rounded-full shadow-sm border border-gray-200 dark:border-gray-700">
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                    {formatDateDivider(item.date)}
                  </span>
                </div>
              </div>
            ) : item.type === 'message' && item.message ? (
              <div
                ref={(el) => observeMessage(el, item.message!)}
                data-message-id={item.message.id}
              >
                <MessageBubble
                  message={item.message as MessageBubbleProps['message']}
                  conversationCustomerName={conversation.customerName ?? undefined}
                  conversationCustomerPhone={conversation.customerPhone ?? undefined}
                  conversationAssignedAgent={conversation.assignedAgent ?? undefined}
                  reactions={reactions.filter((r) => r.messageId === item.message!.id) as MessageBubbleProps['reactions']}
                  onAddReaction={(emoji: string) =>
                    addReactionMutation.mutate({ messageId: item.message!.id, emoji })
                  }
                  onRemoveReaction={(reactionId: number) => removeReactionMutation.mutate(reactionId)}
                  currentUserId={currentUser?.id}
                  reactionSlot={messageReactionSlot}
                  scheduledMetaSlot={scheduledMetaSlot}
                  deliveryIndicatorSlot={deliveryIndicatorSlot}
                  messageActionSlot={messageActionSlot}
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
