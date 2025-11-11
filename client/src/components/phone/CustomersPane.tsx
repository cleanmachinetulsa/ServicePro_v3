import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Phone, 
  MessageCircle,
  Calendar,
  Clock,
  AlertCircle,
  Search,
  X
} from 'lucide-react';
import { format, formatDistanceToNow, isToday, isTomorrow } from 'date-fns';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { CustomersSkeleton } from './SkeletonLoader';

interface Customer {
  id: number;
  type: 'conversation' | 'appointment';
  name: string;
  phone: string | null;
  lastContact: string;
  status: string;
  preview: string;
  scheduledDate?: string | null;
}

function getStatusBadge(status: string) {
  const variants: Record<string, { variant: any; label: string; className?: string }> = {
    'scheduled': { variant: 'default', label: 'Scheduled', className: 'bg-green-600' },
    'pending': { variant: 'default', label: 'Pending Approval', className: 'bg-yellow-600' },
    'recent_contact': { variant: 'secondary', label: 'Recent' },
  };

  const config = variants[status] || { variant: 'secondary', label: status };
  
  return (
    <Badge variant={config.variant} className={`text-xs ${config.className || ''}`}>
      {config.label}
    </Badge>
  );
}

function formatScheduledDate(dateString: string | null | undefined): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  
  if (isToday(date)) {
    return `Today at ${format(date, 'h:mm a')}`;
  } else if (isTomorrow(date)) {
    return `Tomorrow at ${format(date, 'h:mm a')}`;
  } else {
    return format(date, 'MMM d, h:mm a');
  }
}

export default function CustomersPane() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['/api/calls/customers'],
    refetchInterval: 30000,
    retry: 3,
  });

  const allCustomers: Customer[] = data?.customers || [];

  // Filter customers based on search query
  const customers = useMemo(() => {
    if (!searchQuery.trim()) return allCustomers;

    const query = searchQuery.toLowerCase();
    return allCustomers.filter(customer => {
      const nameMatch = customer.name.toLowerCase().includes(query);
      const phoneMatch = customer.phone?.toLowerCase().includes(query);
      const previewMatch = customer.preview?.toLowerCase().includes(query);
      return nameMatch || phoneMatch || previewMatch;
    });
  }, [allCustomers, searchQuery]);

  const handleMessage = (phoneNumber: string) => {
    setLocation(`/messages?new=${encodeURIComponent(phoneNumber)}`);
  };

  const callMutation = useMutation({
    mutationFn: async (phoneNumber: string) => {
      return await apiRequest('POST', '/api/calls/initiate', { to: phoneNumber });
    },
    onSuccess: (_, phoneNumber) => {
      toast({ title: 'Calling...', description: `Connecting to ${phoneNumber}` });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Call failed', 
        description: error.message || 'Unable to initiate call',
        variant: 'destructive'
      });
    },
  });

  const handleCall = (phoneNumber: string) => {
    callMutation.mutate(phoneNumber);
  };

  if (isLoading) {
    return (
      <ScrollArea className="h-full">
        <CustomersSkeleton />
      </ScrollArea>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center px-4">
          <AlertCircle className="h-16 w-16 mx-auto mb-4 text-destructive" />
          <h3 className="text-lg font-semibold mb-2 dark:text-white">Unable to load customers</h3>
          <p className="text-muted-foreground mb-4">
            {error instanceof Error ? error.message : 'Connection error. Please try again.'}
          </p>
          <Button 
            variant="outline" 
            onClick={() => refetch()}
            data-testid="button-retry-customers"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const hasCustomers = allCustomers.length > 0;
  const noResults = hasCustomers && customers.length === 0 && searchQuery.trim();

  if (!hasCustomers) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center px-4">
          <AlertCircle className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2 dark:text-white">No active customers</h3>
          <p className="text-muted-foreground">
            Customers with recent messages or scheduled services will appear here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Search Bar */}
      <div className="p-3 border-b dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search customers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-9 dark:bg-gray-800 dark:text-white"
            data-testid="input-search-customers"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchQuery('')}
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
              data-testid="button-clear-search"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        {searchQuery && (
          <p className="text-xs text-muted-foreground mt-2">
            {customers.length} result{customers.length !== 1 ? 's' : ''} found
          </p>
        )}
      </div>

      {/* Results */}
      {noResults ? (
        <div className="flex items-center justify-center flex-1">
          <div className="text-center px-4">
            <Search className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
            <p className="font-medium dark:text-white mb-1">No customers found</p>
            <p className="text-sm text-muted-foreground">
              Try a different search term
            </p>
          </div>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="divide-y dark:divide-gray-800">
            {customers.map((customer) => {
          const isAppointment = customer.type === 'appointment';
          const isPending = customer.status === 'pending';
          
          return (
            <div
              key={`${customer.type}-${customer.id}`}
              className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                isPending ? 'bg-yellow-50/30 dark:bg-yellow-950/20' : ''
              }`}
              data-testid={`customer-${customer.id}`}
            >
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className="flex-shrink-0 mt-1">
                  {isAppointment ? (
                    <Calendar className={`h-5 w-5 ${
                      isPending 
                        ? 'text-yellow-600 dark:text-yellow-400' 
                        : 'text-blue-600 dark:text-blue-400'
                    }`} />
                  ) : (
                    <MessageCircle className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium dark:text-white truncate">
                      {customer.name}
                    </p>
                    {getStatusBadge(customer.status)}
                  </div>
                  
                  {customer.phone && (
                    <p className="text-sm text-muted-foreground mb-1">
                      {customer.phone}
                    </p>
                  )}

                  {isAppointment && customer.scheduledDate && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mb-1">
                      <Clock className="h-3 w-3" />
                      <span>{formatScheduledDate(customer.scheduledDate)}</span>
                    </div>
                  )}

                  {customer.preview && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {customer.preview}
                    </p>
                  )}

                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(customer.lastContact), { addSuffix: true })}
                  </p>
                </div>

                {/* Actions */}
                {customer.phone && (
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCall(customer.phone!)}
                      disabled={callMutation.isPending}
                      className="h-9 w-9 p-0 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950"
                      title="Call customer"
                      data-testid={`button-call-customer-${customer.id}`}
                    >
                      <Phone className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMessage(customer.phone!)}
                      className="h-9 w-9 p-0"
                      title="Send message"
                      data-testid={`button-message-customer-${customer.id}`}
                    >
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
            );
          })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
