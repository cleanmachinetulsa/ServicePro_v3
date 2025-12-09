/**
 * SP-SUPPORT-1: Support Issues Admin Page
 * 
 * Allows owners to view and resolve support issues logged by the Setup Assistant
 * and other frontend flows.
 */

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { formatDistanceToNow } from 'date-fns';
import { AlertCircle, CheckCircle2, Clock, Info, AlertTriangle, Bug, Mail, ExternalLink } from 'lucide-react';
import AppShell from '@/components/AppShell';

interface SupportIssue {
  id: number;
  tenantId: string;
  userId: string | null;
  source: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  status: 'open' | 'in_progress' | 'resolved';
  errorCode: string;
  summary: string;
  detailsJson: Record<string, any>;
  userContactEmail: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  resolutionNotes: string | null;
}

const severityConfig = {
  info: { icon: Info, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  warning: { icon: AlertTriangle, color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' },
  error: { icon: AlertCircle, color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
  critical: { icon: Bug, color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' },
};

const statusConfig = {
  open: { icon: Clock, color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' },
  in_progress: { icon: AlertCircle, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  resolved: { icon: CheckCircle2, color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
};

export default function SupportIssuesPage() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<'open' | 'in_progress' | 'resolved'>('open');
  const [selectedIssue, setSelectedIssue] = useState<SupportIssue | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [notifyUser, setNotifyUser] = useState(false);

  const { data, isLoading, error } = useQuery<{ success: boolean; issues: SupportIssue[] }>({
    queryKey: ['/api/support/issues', { status: statusFilter }],
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ id, notes, notify }: { id: number; notes: string; notify: boolean }) => {
      return apiRequest('POST', `/api/support/issues/${id}/resolve`, {
        resolutionNotes: notes,
        notifyUser: notify,
      });
    },
    onSuccess: () => {
      toast({
        title: 'Issue Resolved',
        description: 'The issue has been marked as resolved.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/support/issues'] });
      setSelectedIssue(null);
      setResolutionNotes('');
      setNotifyUser(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to resolve issue',
        variant: 'destructive',
      });
    },
  });

  const handleResolve = () => {
    if (!selectedIssue || !resolutionNotes.trim()) {
      toast({
        title: 'Required',
        description: 'Please provide resolution notes.',
        variant: 'destructive',
      });
      return;
    }
    resolveMutation.mutate({
      id: selectedIssue.id,
      notes: resolutionNotes,
      notify: notifyUser,
    });
  };

  const issues = data?.issues || [];

  return (
    <AppShell title="Support Issues" subtitle="Errors and setup problems automatically logged by the assistant.">
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Label htmlFor="status-filter">Status:</Label>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <SelectTrigger id="status-filter" className="w-[150px]" data-testid="select-status-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Badge variant="outline" className="text-muted-foreground">
            {issues.length} issue{issues.length !== 1 ? 's' : ''}
          </Badge>
        </div>

        {isLoading && (
          <div className="text-center py-8 text-muted-foreground">
            Loading issues...
          </div>
        )}

        {error && (
          <Card className="border-destructive">
            <CardContent className="py-4">
              <p className="text-destructive">Failed to load support issues. Please try again.</p>
            </CardContent>
          </Card>
        )}

        {!isLoading && !error && issues.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center">
              <CheckCircle2 className="w-12 h-12 mx-auto text-green-500 mb-3" />
              <p className="text-muted-foreground">No {statusFilter} issues found.</p>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4" data-testid="support-issues-list">
          {issues.map((issue) => {
            const SeverityIcon = severityConfig[issue.severity].icon;
            const StatusIcon = statusConfig[issue.status].icon;
            return (
              <Card
                key={issue.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedIssue(issue)}
                data-testid={`support-issue-row-${issue.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-lg ${severityConfig[issue.severity].color}`}>
                      <SeverityIcon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold truncate">{issue.summary}</h3>
                        <Badge variant="outline" className={statusConfig[issue.status].color}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {issue.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{issue.errorCode}</code>
                        <span>{issue.source}</span>
                        <span>{formatDistanceToNow(new Date(issue.createdAt), { addSuffix: true })}</span>
                      </div>
                      {issue.userContactEmail && (
                        <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
                          <Mail className="w-3 h-3" />
                          {issue.userContactEmail}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Dialog open={!!selectedIssue} onOpenChange={() => setSelectedIssue(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="support-issue-detail">
            {selectedIssue && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Badge className={severityConfig[selectedIssue.severity].color}>
                      {selectedIssue.severity}
                    </Badge>
                    {selectedIssue.summary}
                  </DialogTitle>
                  <DialogDescription>
                    Error Code: <code className="bg-muted px-1.5 py-0.5 rounded">{selectedIssue.errorCode}</code>
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <Label className="text-muted-foreground">Source</Label>
                      <p>{selectedIssue.source}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Status</Label>
                      <p className="capitalize">{selectedIssue.status.replace('_', ' ')}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Created</Label>
                      <p>{new Date(selectedIssue.createdAt).toLocaleString()}</p>
                    </div>
                    {selectedIssue.userContactEmail && (
                      <div>
                        <Label className="text-muted-foreground">User Email</Label>
                        <p>{selectedIssue.userContactEmail}</p>
                      </div>
                    )}
                  </div>

                  {Object.keys(selectedIssue.detailsJson).length > 0 && (
                    <div>
                      <Label className="text-muted-foreground">Technical Details</Label>
                      <ScrollArea className="h-[200px] mt-2">
                        <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap">
                          {JSON.stringify(selectedIssue.detailsJson, null, 2)}
                        </pre>
                      </ScrollArea>
                    </div>
                  )}

                  {selectedIssue.resolutionNotes && (
                    <div>
                      <Label className="text-muted-foreground">Resolution Notes</Label>
                      <p className="mt-1">{selectedIssue.resolutionNotes}</p>
                    </div>
                  )}

                  {selectedIssue.status !== 'resolved' && (
                    <>
                      <div>
                        <Label htmlFor="resolution-notes">Resolution Notes</Label>
                        <Textarea
                          id="resolution-notes"
                          value={resolutionNotes}
                          onChange={(e) => setResolutionNotes(e.target.value)}
                          placeholder="Describe how the issue was resolved..."
                          className="mt-1"
                          data-testid="support-issue-resolution-notes"
                        />
                      </div>

                      {selectedIssue.userContactEmail && (
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="notify-user"
                            checked={notifyUser}
                            onCheckedChange={(c) => setNotifyUser(!!c)}
                            data-testid="checkbox-resolve-notify-user"
                          />
                          <Label htmlFor="notify-user" className="text-sm cursor-pointer">
                            Email the user about this resolution
                          </Label>
                        </div>
                      )}
                    </>
                  )}
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setSelectedIssue(null)}>
                    Close
                  </Button>
                  {selectedIssue.status !== 'resolved' && (
                    <Button
                      onClick={handleResolve}
                      disabled={resolveMutation.isPending || !resolutionNotes.trim()}
                      data-testid="button-resolve-issue"
                    >
                      {resolveMutation.isPending ? 'Resolving...' : 'Mark Resolved'}
                    </Button>
                  )}
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
