import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Phone, MessageSquare, PhoneIncoming, PhoneOutgoing, PhoneMissed, RefreshCw } from 'lucide-react';
import { useLocation } from 'wouter';

interface RecentCall {
  id: number;
  customerPhone: string;
  customerName: string;
  direction: string;
  status: string;
  duration: number | null;
  createdAt: string;
}

export function RecentCallersWidget() {
  const [, setLocation] = useLocation();

  const { data: calls, isLoading, refetch } = useQuery<RecentCall[]>({
    queryKey: ['/api/call-events/recent'],
    refetchInterval: 30000,
  });

  const formatPhoneNumber = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      const number = cleaned.substring(1);
      return `(${number.substring(0, 3)}) ${number.substring(3, 6)}-${number.substring(6)}`;
    }
    return phone;
  };

  const getCallIcon = (direction: string, status: string) => {
    if (direction === 'inbound') {
      if (status === 'completed' || status === 'in-progress') {
        return <PhoneIncoming className="h-4 w-4 text-green-600" />;
      }
      return <PhoneMissed className="h-4 w-4 text-red-600" />;
    }
    return <PhoneOutgoing className="h-4 w-4 text-blue-600" />;
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffMins < 1440) {
      return `${Math.floor(diffMins / 60)}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Recent Callers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Recent Callers
            </CardTitle>
            <CardDescription>Last 20 incoming calls - Click to message or call back</CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            data-testid="button-refresh-calls"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {calls?.map((call) => (
            <div
              key={call.id}
              className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors"
              data-testid={`call-item-${call.id}`}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {getCallIcon(call.direction, call.status)}
                
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{call.customerName}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatPhoneNumber(call.customerPhone)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatTimestamp(call.createdAt)}
                    {call.duration && ` • ${Math.floor(call.duration / 60)}m ${call.duration % 60}s`}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  data-testid={`button-message-${call.customerPhone}`}
                  onClick={() => {
                    setLocation(`/messages?phone=${encodeURIComponent(call.customerPhone)}`);
                  }}
                  title="Send message"
                >
                  <MessageSquare className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}

          {!calls?.length && (
            <div className="text-center py-12 text-muted-foreground">
              <Phone className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="font-medium">No recent calls</p>
              <p className="text-sm">Incoming calls will appear here</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
