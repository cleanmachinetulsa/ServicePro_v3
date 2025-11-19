import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { ClipboardCheck, Check, X, Calendar as CalendarIcon, User } from 'lucide-react';
import { format } from 'date-fns';
import { AppShell } from '@/components/AppShell';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type PtoRequest = {
  id: number;
  technicianId: number;
  requestType: string;
  startDate: string;
  endDate: string;
  totalDays: string;
  reason: string | null;
  status: 'pending' | 'approved' | 'denied' | 'cancelled';
  requestedAt: string;
  reviewedBy: number | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  technician: {
    id: number;
    preferredName: string;
    fullName: string;
  };
};

type ApiResponse = {
  success: boolean;
  requests: PtoRequest[];
};

export default function AdminPTO() {
  const [selectedRequest, setSelectedRequest] = useState<PtoRequest | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'approved' | 'denied'>('approved');
  const { toast } = useToast();

  const { data, isLoading } = useQuery<ApiResponse>({
    queryKey: ['/api/admin/pto'],
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: number; status: 'approved' | 'denied'; notes: string }) => {
      return await apiRequest(`/api/admin/pto/${id}`, 'PUT', {
        status,
        adminNotes: notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/pto'] });
      toast({ title: 'PTO request updated successfully' });
      setDialogOpen(false);
      setSelectedRequest(null);
      setAdminNotes('');
    },
    onError: () => {
      toast({ title: 'Failed to update request', variant: 'destructive' });
    },
  });

  const handleAction = (request: PtoRequest, action: 'approved' | 'denied') => {
    setSelectedRequest(request);
    setActionType(action);
    setAdminNotes('');
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!selectedRequest) return;
    updateMutation.mutate({
      id: selectedRequest.id,
      status: actionType,
      notes: adminNotes,
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pending: 'secondary',
      approved: 'default',
      denied: 'destructive',
      cancelled: 'outline',
    };
    
    return (
      <Badge variant={variants[status] || 'outline'} data-testid={`badge-status-${status}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      vacation: 'text-blue-600',
      sick: 'text-red-600',
      personal: 'text-purple-600',
      unpaid: 'text-gray-600',
    };
    return colors[type] || 'text-gray-600';
  };

  const filterRequests = (status?: string) => {
    if (!data?.requests) return [];
    if (!status) return data.requests;
    return data.requests.filter(req => req.status === status);
  };

  const pendingCount = data?.requests.filter(r => r.status === 'pending').length || 0;

  const pageActions = pendingCount > 0 ? (
    <Badge variant="destructive">{pendingCount} Pending</Badge>
  ) : null;

  const PtoRequestCard = ({ request }: { request: PtoRequest }) => (
    <Card key={request.id} data-testid={`card-pto-${request.id}`}>
      <CardContent className="p-4 md:p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 flex-shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold" data-testid={`text-technician-${request.id}`}>
                {request.technician.preferredName}
              </h3>
              <p className="text-sm text-muted-foreground">
                Requested {format(new Date(request.requestedAt), 'MMM d, yyyy')}
              </p>
            </div>
          </div>
          {getStatusBadge(request.status)}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-4">
          <div>
            <p className="text-sm text-muted-foreground">Type</p>
            <p className={`font-medium ${getTypeColor(request.requestType)}`} data-testid={`text-type-${request.id}`}>
              {request.requestType.charAt(0).toUpperCase() + request.requestType.slice(1)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Duration</p>
            <p className="font-medium" data-testid={`text-duration-${request.id}`}>
              {request.totalDays} {parseFloat(request.totalDays) === 1 ? 'day' : 'days'}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Start Date</p>
            <p className="font-medium" data-testid={`text-start-${request.id}`}>
              {format(new Date(request.startDate), 'MMM d, yyyy')}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">End Date</p>
            <p className="font-medium" data-testid={`text-end-${request.id}`}>
              {format(new Date(request.endDate), 'MMM d, yyyy')}
            </p>
          </div>
        </div>

        {request.reason && (
          <div className="mb-4">
            <p className="text-sm text-muted-foreground">Notes</p>
            <p className="text-sm" data-testid={`text-reason-${request.id}`}>{request.reason}</p>
          </div>
        )}

        {request.reviewNotes && (
          <div className="mb-4 bg-muted p-3 rounded-lg">
            <p className="text-sm text-muted-foreground">Admin Notes</p>
            <p className="text-sm" data-testid={`text-admin-notes-${request.id}`}>{request.reviewNotes}</p>
          </div>
        )}

        {request.status === 'pending' && (
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              onClick={() => handleAction(request, 'approved')}
              variant="default"
              size="sm"
              className="flex-1 min-h-[44px]"
              data-testid={`button-approve-${request.id}`}
            >
              <Check className="h-4 w-4 mr-1" />
              Approve
            </Button>
            <Button
              onClick={() => handleAction(request, 'denied')}
              variant="destructive"
              size="sm"
              className="flex-1 min-h-[44px]"
              data-testid={`button-deny-${request.id}`}
            >
              <X className="h-4 w-4 mr-1" />
              Deny
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <AppShell title="PTO Requests" pageActions={pageActions}>
        <div className="p-6">
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">Loading PTO requests...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  const pendingCountStats = filterRequests('pending').length;
  const approvedCount = filterRequests('approved').length;
  const deniedCount = filterRequests('denied').length;

  return (
    <AppShell title="PTO Requests" pageActions={pageActions}>
      <div className="p-6">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5" />
            PTO Request Management
          </CardTitle>
        </CardHeader>
      </Card>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="all" data-testid="tab-all">
            All ({data?.requests.length || 0})
          </TabsTrigger>
          <TabsTrigger value="pending" data-testid="tab-pending">
            Pending ({pendingCount})
          </TabsTrigger>
          <TabsTrigger value="approved" data-testid="tab-approved">
            Approved ({approvedCount})
          </TabsTrigger>
          <TabsTrigger value="denied" data-testid="tab-denied">
            Denied ({deniedCount})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <div className="grid gap-4">
            {data?.requests.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <CalendarIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No PTO requests found</p>
                </CardContent>
              </Card>
            ) : (
              data?.requests.map((request) => <PtoRequestCard key={request.id} request={request} />)
            )}
          </div>
        </TabsContent>

        <TabsContent value="pending" className="mt-6">
          <div className="grid gap-4" data-testid="list-pending">
            {filterRequests('pending').length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <CalendarIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No pending PTO requests</p>
                </CardContent>
              </Card>
            ) : (
              filterRequests('pending').map((request) => <PtoRequestCard key={request.id} request={request} />)
            )}
          </div>
        </TabsContent>

        <TabsContent value="approved" className="mt-6">
          <div className="grid gap-4" data-testid="list-approved">
            {filterRequests('approved').length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <CalendarIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No approved PTO requests</p>
                </CardContent>
              </Card>
            ) : (
              filterRequests('approved').map((request) => <PtoRequestCard key={request.id} request={request} />)
            )}
          </div>
        </TabsContent>

        <TabsContent value="denied" className="mt-6">
          <div className="grid gap-4" data-testid="list-denied">
            {filterRequests('denied').length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <CalendarIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No denied PTO requests</p>
                </CardContent>
              </Card>
            ) : (
              filterRequests('denied').map((request) => <PtoRequestCard key={request.id} request={request} />)
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent data-testid="dialog-review">
          <DialogHeader>
            <DialogTitle>
              {actionType === 'approved' ? 'Approve' : 'Deny'} PTO Request
            </DialogTitle>
            <DialogDescription>
              {selectedRequest && (
                <>
                  {selectedRequest.technician.preferredName} - {selectedRequest.requestType} from{' '}
                  {format(new Date(selectedRequest.startDate), 'MMM d')} to{' '}
                  {format(new Date(selectedRequest.endDate), 'MMM d, yyyy')} ({selectedRequest.totalDays} days)
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Admin Notes {actionType === 'denied' && '(Required for denial)'}
              </label>
              <Textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder={
                  actionType === 'approved'
                    ? 'Optional notes about this approval...'
                    : 'Please provide a reason for denial...'
                }
                rows={4}
                data-testid="textarea-admin-notes"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              data-testid="button-cancel-review"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={updateMutation.isPending || (actionType === 'denied' && !adminNotes.trim())}
              variant={actionType === 'approved' ? 'default' : 'destructive'}
              data-testid="button-confirm-review"
            >
              {updateMutation.isPending ? 'Submitting...' : `Confirm ${actionType === 'approved' ? 'Approval' : 'Denial'}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </AppShell>
  );
}
