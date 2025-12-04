import { cn } from '@/lib/utils';

export function ConversationItemSkeleton() {
  return (
    <div className="p-3 rounded-xl">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-slate-700/50 animate-pulse" />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center justify-between">
            <div className="h-4 w-24 bg-slate-700/50 rounded animate-pulse" />
            <div className="h-3 w-12 bg-slate-700/30 rounded animate-pulse" />
          </div>
          <div className="h-3 w-3/4 bg-slate-700/40 rounded animate-pulse" />
          <div className="flex items-center gap-1.5">
            <div className="h-5 w-5 rounded bg-slate-700/30 animate-pulse" />
            <div className="h-4 w-12 rounded-full bg-slate-700/30 animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ConversationListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-1" data-testid="inbox-skeleton">
      {Array.from({ length: count }).map((_, i) => (
        <ConversationItemSkeleton key={i} />
      ))}
    </div>
  );
}

export function ThreadHeaderSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-700/40">
      <div className="w-10 h-10 rounded-full bg-slate-700/50 animate-pulse" />
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="h-4 w-32 bg-slate-700/50 rounded animate-pulse" />
        <div className="h-3 w-20 bg-slate-700/30 rounded animate-pulse" />
      </div>
      <div className="flex gap-2">
        <div className="w-8 h-8 rounded-lg bg-slate-700/30 animate-pulse" />
        <div className="w-8 h-8 rounded-lg bg-slate-700/30 animate-pulse" />
      </div>
    </div>
  );
}

export function MessageBubbleSkeleton({ 
  isOwn = false, 
  short = false 
}: { 
  isOwn?: boolean;
  short?: boolean;
}) {
  return (
    <div className={cn("flex", isOwn ? "justify-end" : "justify-start")}>
      <div 
        className={cn(
          "rounded-2xl animate-pulse",
          isOwn ? "bg-cyan-500/20" : "bg-slate-700/40",
          short ? "h-8 w-24" : "h-12 w-48"
        )}
      />
    </div>
  );
}

export function ThreadMessagesSkeleton() {
  return (
    <div className="flex-1 overflow-hidden flex flex-col p-4 space-y-3" data-testid="thread-skeleton">
      <div className="h-4 w-20 mx-auto bg-slate-700/30 rounded animate-pulse" />
      <MessageBubbleSkeleton isOwn={false} />
      <MessageBubbleSkeleton isOwn={true} short />
      <MessageBubbleSkeleton isOwn={false} />
      <MessageBubbleSkeleton isOwn={false} short />
      <MessageBubbleSkeleton isOwn={true} />
      <MessageBubbleSkeleton isOwn={false} />
      <MessageBubbleSkeleton isOwn={true} short />
    </div>
  );
}

export function ThreadComposerSkeleton() {
  return (
    <div className="p-3 border-t border-slate-700/40">
      <div className="flex items-end gap-2">
        <div className="flex-1 h-10 bg-slate-700/40 rounded-xl animate-pulse" />
        <div className="w-10 h-10 bg-slate-700/30 rounded-xl animate-pulse" />
      </div>
    </div>
  );
}

export function ThreadViewSkeleton() {
  return (
    <div className="flex flex-col h-full bg-slate-900/80" data-testid="thread-view-skeleton">
      <ThreadHeaderSkeleton />
      <ThreadMessagesSkeleton />
      <ThreadComposerSkeleton />
    </div>
  );
}

export function MessagesPageSkeleton() {
  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800">
      <div className="w-80 md:w-96 flex-shrink-0 border-r border-slate-700/40 flex flex-col">
        <div className="p-3">
          <div className="h-9 bg-slate-800/60 rounded-lg animate-pulse" />
        </div>
        <div className="px-3 py-2 flex gap-1 border-b border-slate-700/40">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-7 w-14 rounded-full bg-slate-800/40 animate-pulse" />
          ))}
        </div>
        <div className="flex-1 overflow-hidden px-2 py-2">
          <ConversationListSkeleton count={8} />
        </div>
      </div>
      <div className="flex-1 flex flex-col">
        <ThreadViewSkeleton />
      </div>
    </div>
  );
}
