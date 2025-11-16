import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Clock, Phone, MessageSquare } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { AppShell } from '@/components/AppShell';

interface HumanEscalationRequest {
  id: number;
  conversationId: number;
  customerId: number;
  customerPhone: string;
  customerName: string | null;
  triggerPhrase: string | null;
  triggerMessageId: number | null;
  status: string;
  recentMessageSummary: string | null;
  customerVehicle: string | null;
  lastServiceDate: string | null;
  requestedAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  expiresAt: string;
  smsNotificationSent: boolean;
  pushNotificationSent: boolean;
  createdAt: string;
}

export default function EscalationsPage() {
  const { toast } = useToast();

  const { data: escalations, isLoading } = useQuery<HumanEscalationRequest[]>({
    queryKey: ['/api/escalations'],
  });

  const acknowledgeMutation = useMutation({
    mutationFn: (escalationId: number) => 
      apiRequest(`/api/escalations/${escalationId}/acknowledge`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/escalations'] });
      toast({ title: 'Escalation acknowledged' });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: (escalationId: number) => 
      apiRequest(`/api/escalations/${escalationId}/resolve`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/escalations'] });
      toast({ title: 'Escalation resolved - AI resumed' });
    },
  });

  if (isLoading) {
    return <AppShell><div className="p-6">Loading escalations...</div></AppShell>;
  }

  const activeEscalations = escalations?.filter(e => e.status === 'pending' || e.status === 'acknowledged') || [];
  const resolvedEscalations = escalations?.filter(e => e.status === 'resolved' || e.status === 'expired') || [];

  return (
    <AppShell>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Customer Escalations</h1>
          <p className="text-muted-foreground">Customers requesting to speak with you directly</p>
        </div>

        <section>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-orange-500" />
            Active Escalations ({activeEscalations.length})
          </h2>

          {activeEscalations.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
                <p>No active escalations - all clear!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {activeEscalations.map((escalation) => (
                <Card key={escalation.id} className="border-orange-200 dark:border-orange-900">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2">
                          {escalation.customerName || escalation.customerPhone}
                          <Badge variant={escalation.status === 'acknowledged' ? 'default' : 'destructive'}>
                            {escalation.status}
                          </Badge>
                        </CardTitle>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4" />
                            {escalation.customerPhone}
                          </div>
                          {escalation.customerVehicle && (
                            <div>{escalation.customerVehicle}</div>
                          )}
                          <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
                            <Clock className="w-4 h-4" />
                            Requested {formatDistanceToNow(new Date(escalation.requestedAt), { addSuffix: true })}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(`/messages?phone=${escalation.customerPhone}`, '_blank')}
                          data-testid={`button-view-conversation-${escalation.id}`}
                        >
                          <MessageSquare className="w-4 h-4 mr-2" />
                          View Chat
                        </Button>
                        {escalation.status === 'pending' && (
                          <Button
                            size="sm"
                            onClick={() => acknowledgeMutation.mutate(escalation.id)}
                            disabled={acknowledgeMutation.isPending}
                            data-testid={`button-acknowledge-${escalation.id}`}
                          >
                            Acknowledge
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => resolveMutation.mutate(escalation.id)}
                          disabled={resolveMutation.isPending}
                          data-testid={`button-resolve-${escalation.id}`}
                        >
                          Resolve & Resume AI
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div>
                        <span className="font-semibold">Trigger:</span> "{escalation.triggerPhrase}"
                      </div>
                      {escalation.recentMessageSummary && (
                        <div className="bg-muted p-3 rounded-md">
                          <div className="font-semibold mb-1 text-sm">Recent Conversation:</div>
                          <pre className="text-xs whitespace-pre-wrap font-mono">
                            {escalation.recentMessageSummary}
                          </pre>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {resolvedEscalations.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold mb-4">Recent History ({resolvedEscalations.length})</h2>
            <div className="grid gap-3">
              {resolvedEscalations.slice(0, 10).map((escalation) => (
                <Card key={escalation.id} className="opacity-60">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{escalation.customerName || escalation.customerPhone}</div>
                        <div className="text-sm text-muted-foreground">
                          {escalation.status === 'resolved' ? 'Resolved' : 'Expired'}{' '}
                          {formatDistanceToNow(new Date(escalation.resolvedAt || escalation.requestedAt), { addSuffix: true })}
                        </div>
                      </div>
                      <Badge variant="secondary">{escalation.status}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
