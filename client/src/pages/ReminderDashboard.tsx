import { useQuery, useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Clock, Send, Users, CheckCircle, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';

export default function ReminderDashboard() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [manualSendDialogOpen, setManualSendDialogOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const { toast } = useToast();

  // Fetch analytics
  const { data: analytics } = useQuery({
    queryKey: ['/api/reminders/analytics'],
    refetchInterval: 30000, // Auto-refresh every 30s
  });

  // Fetch reminder jobs with filter
  const { data: jobsData, isLoading } = useQuery({
    queryKey: ['/api/reminders/jobs', statusFilter],
    queryFn: async () => {
      const query = statusFilter === 'all' ? '' : `?status=${statusFilter}`;
      const response = await fetch(`/api/reminders/jobs${query}`);
      if (!response.ok) throw new Error('Failed to fetch jobs');
      return response.json();
    },
    refetchInterval: 30000, // Auto-refresh every 30s
  });

  // Manual send mutation
  const sendNowMutation = useMutation({
    mutationFn: async (customerId: number) => {
      return await apiRequest(`/api/reminders/send-now/${customerId}`, 'POST', {});
    },
    onSuccess: () => {
      toast({
        title: 'Reminder Sent',
        description: 'Reminder sent successfully to customer',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/reminders/jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/reminders/analytics'] });
      setManualSendDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Send Failed',
        description: error.message || 'Failed to send reminder',
        variant: 'destructive',
      });
    },
  });

  const jobs = (jobsData as any)?.jobs || [];
  const stats = (analytics as any)?.analytics || {};

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Reminder Management</h1>
          <p className="text-muted-foreground mt-1">Monitor and manage automated customer reminders</p>
        </div>
        <Dialog open={manualSendDialogOpen} onOpenChange={setManualSendDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-manual-send">
              <Send className="w-4 h-4 mr-2" />
              Send Manual Reminder
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Send Manual Reminder</DialogTitle>
              <DialogDescription>
                Send an immediate reminder to a specific customer
              </DialogDescription>
            </DialogHeader>
            {/* Manual send form - simplified for MVP */}
            <Alert>
              <AlertDescription>
                Manual send requires customer ID. Coming soon: customer search and selection.
              </AlertDescription>
            </Alert>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card data-testid="card-pending-reminders">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Reminders</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending || 0}</div>
            <p className="text-xs text-muted-foreground">Scheduled to send</p>
          </CardContent>
        </Card>

        <Card data-testid="card-sent-7days">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sent (7 Days)</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.sentLast7Days || 0}</div>
            <p className="text-xs text-muted-foreground">Last 7 days</p>
          </CardContent>
        </Card>

        <Card data-testid="card-success-rate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.successRate || 0}%</div>
            <p className="text-xs text-muted-foreground">Delivery success</p>
          </CardContent>
        </Card>

        <Card data-testid="card-opt-outs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Opt-Outs</CardTitle>
            <Users className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalOptOuts || 0}</div>
            <p className="text-xs text-muted-foreground">Total opted out</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Queue */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Reminder Queue</CardTitle>
              <CardDescription>View and manage scheduled reminders</CardDescription>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="snoozed">Snoozed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading reminders...</div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No reminders found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Scheduled For</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job: any) => (
                  <TableRow key={job.id} data-testid={`row-job-${job.id}`}>
                    <TableCell className="font-medium">
                      {job.customer?.name || 'Unknown'}
                    </TableCell>
                    <TableCell>{job.rule?.service?.name || 'General'}</TableCell>
                    <TableCell>{format(new Date(job.scheduledFor), 'MMM dd, yyyy h:mm a')}</TableCell>
                    <TableCell>
                      <Badge variant={
                        job.status === 'sent' ? 'default' :
                        job.status === 'failed' ? 'destructive' :
                        job.status === 'pending' ? 'secondary' : 'outline'
                      }>
                        {job.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-md truncate">
                      {job.messageContent?.substring(0, 100)}...
                    </TableCell>
                    <TableCell>
                      {job.status === 'pending' && (
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => sendNowMutation.mutate(job.customerId)}
                          disabled={sendNowMutation.isPending}
                          data-testid={`button-send-now-${job.id}`}
                        >
                          Send Now
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
