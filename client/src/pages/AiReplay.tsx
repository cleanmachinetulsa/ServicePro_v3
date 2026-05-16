import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AiToolPill } from "@/components/AiToolPill";

interface ReplayMessage {
  id: number;
  conversationId: number;
  content: string;
  timestamp: string | null;
  toolCalls: string[];
}

interface ReplayPayload {
  threadId: number;
  messages: ReplayMessage[];
  conversations: Array<{ id: number; customerPhone: string | null }>;
}

export default function AiReplayPage() {
  const params = useParams<{ threadId: string }>();
  const threadId = params.threadId;
  const { data, isLoading, error } = useQuery<ReplayPayload>({
    queryKey: ["/api/admin/ai-replay", threadId],
  });

  return (
    <div className="container mx-auto max-w-3xl p-4">
      <Card>
        <CardHeader>
          <CardTitle>AI Replay · Thread {threadId}</CardTitle>
          <p className="text-sm text-muted-foreground">
            Every AI reply on this thread, in order. Pills show which tools the assistant invoked.
          </p>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          )}
          {error && <p className="text-sm text-red-600">Failed to load replay.</p>}
          {data && data.messages.length === 0 && (
            <p className="text-sm text-muted-foreground">No AI messages found on this thread.</p>
          )}
          {data && data.messages.length > 0 && (
            <ol className="space-y-3" data-testid="ai-replay-list">
              {data.messages.map((m) => (
                <li
                  key={m.id}
                  className="rounded-md border bg-card p-3"
                  data-testid={`ai-replay-msg-${m.id}`}
                >
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span>conv #{m.conversationId} · msg #{m.id}</span>
                    <span>{m.timestamp ? new Date(m.timestamp).toLocaleString() : "—"}</span>
                  </div>
                  <div className="whitespace-pre-wrap text-sm">{m.content}</div>
                  {m.toolCalls.length > 0 && (
                    <div className="mt-2"><AiToolPill toolNames={m.toolCalls} /></div>
                  )}
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
