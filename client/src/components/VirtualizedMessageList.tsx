import { useMemo, useEffect, RefObject } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import MessageBubble from './messages/MessageBubble';

function formatDateDivider(date: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

function groupMessagesByDate(messages: any[]): Array<{ date: Date; messages: any[] }> {
  const groups: Record<string, { date: Date; messages: any[] }> = {};
  messages.forEach(m => {
    const d = new Date(m.timestamp || Date.now());
    const key = d.toDateString();
    if (!groups[key]) groups[key] = { date: d, messages: [] };
    groups[key].messages.push(m);
  });
  return Object.values(groups).sort((a, b) => a.date.getTime() - b.date.getTime());
}

interface FlatItem {
  type: 'divider' | 'message';
  key: string;
  date?: Date;
  message?: any;
}

interface Props {
  messages: any[];
  scrollParentRef: RefObject<HTMLDivElement>;
  conversation: any;
  reactions: any[];
  addReactionMutation: any;
  removeReactionMutation: any;
  currentUser: any;
  messageReactionSlot?: any;
  scheduledMetaSlot?: any;
  deliveryIndicatorSlot?: any;
  messageActionSlot?: any;
  observeMessage: (el: HTMLElement | null, message: any) => void;
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
  // Audit T2: virtualize the message list with @tanstack/react-virtual.
  // We flatten date-grouped messages into a single list of rows (date dividers
  // + bubbles) so the virtualizer can manage variable heights. The existing
  // scroll container (containerRef) remains the scroll element so the
  // ThreadView's pinned-to-bottom logic, image re-pin, jump-to-latest, and
  // read-up-to IntersectionObserver flows all keep working.
  const items: FlatItem[] = useMemo(() => {
    const out: FlatItem[] = [];
    groupMessagesByDate(messages).forEach((group, gi) => {
      out.push({ type: 'divider', key: `d-${gi}-${group.date.toDateString()}`, date: group.date });
      group.messages.forEach(m => {
        out.push({ type: 'message', key: `m-${m.id}`, message: m });
      });
    });
    return out;
  }, [messages]);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollParentRef.current,
    estimateSize: index => (items[index].type === 'divider' ? 44 : 76),
    overscan: 12,
    measureElement: el => el?.getBoundingClientRect().height ?? 76,
    getItemKey: index => items[index].key,
  });

  // Re-measure on conversation switch so cached heights don't bleed across
  // different conversations.
  useEffect(() => {
    virtualizer.measure();
  }, [conversation?.id]);

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  return (
    <div style={{ height: totalSize, position: 'relative', width: '100%' }} data-testid="virtualized-message-list">
      {virtualItems.map(vi => {
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
            {item.type === 'divider' ? (
              <div className="flex items-center justify-center my-3">
                <div className="bg-white dark:bg-gray-800 px-3 py-1 rounded-full shadow-sm border border-gray-200 dark:border-gray-700">
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                    {formatDateDivider(item.date!)}
                  </span>
                </div>
              </div>
            ) : (
              <div
                ref={el => observeMessage(el, item.message)}
                data-message-id={item.message.id}
                className="px-0"
              >
                <MessageBubble
                  message={item.message}
                  conversationCustomerName={conversation.customerName}
                  conversationCustomerPhone={conversation.customerPhone}
                  conversationAssignedAgent={conversation.assignedAgent}
                  reactions={reactions.filter(r => r.messageId === item.message.id)}
                  onAddReaction={(emoji: string) =>
                    addReactionMutation.mutate({ messageId: item.message.id, emoji })
                  }
                  onRemoveReaction={(reactionId: number) => removeReactionMutation.mutate(reactionId)}
                  currentUserId={(currentUser as any)?.id}
                  reactionSlot={messageReactionSlot}
                  scheduledMetaSlot={scheduledMetaSlot}
                  deliveryIndicatorSlot={deliveryIndicatorSlot}
                  messageActionSlot={messageActionSlot}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
