import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquare, CheckCircle2, RotateCcw, Loader2, Trash2, ChevronDown, ChevronUp, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useState } from 'react';
import type { Suggestion } from '@shared/schema';

export default function TenantSuggestionsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [expandedNotes, setExpandedNotes] = useState<Record<number, boolean>>({});
  const [notesInput, setNotesInput] = useState<Record<number, string>>({});

  const { data, isLoading, error } = useQuery<{ success: boolean; suggestions: Suggestion[] }>({
    queryKey: ['/api/suggestions/tenant'],
  });

  const handleMutation = useMutation({
    mutationFn: async ({ id, handled, notes }: { id: number; handled?: boolean; notes?: string }) => {
      return apiRequest(`/api/suggestions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ handled, notes }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/suggestions/tenant'] });
      toast({ title: 'Suggestion updated' });
    },
    onError: (err: Error) => {
      toast({ title: 'Update failed', description: err.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/suggestions/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/suggestions/tenant'] });
      toast({ title: 'Suggestion deleted' });
    },
    onError: (err: Error) => {
      toast({ title: 'Delete failed', description: err.message, variant: 'destructive' });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">Failed to load suggestions. Please try again.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const suggestions = data?.suggestions || [];
  const customerSuggestions = suggestions.filter(s => s.source === 'tenant_customer');
  const staffSuggestions = suggestions.filter(s => s.source === 'tenant_owner');
  const openCount = suggestions.filter(s => !s.handled).length;

  const renderSuggestion = (s: Suggestion) => (
    <Card key={s.id} className={s.handled ? 'opacity-70' : ''} data-testid={`suggestion-card-${s.id}`}>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>#{s.id}</span>
            <span>•</span>
            <span>{new Date(s.createdAt).toLocaleString()}</span>
            {s.context && (
              <>
                <span>•</span>
                <Badge variant="outline" className="text-xs">{s.context}</Badge>
              </>
            )}
            <Badge variant="outline" className="text-xs">
              {s.source === 'tenant_customer' ? 'Customer' : 'Staff'}
            </Badge>
          </div>
          <Badge
            variant={s.handled ? 'default' : 'secondary'}
            className={s.handled ? 'bg-emerald-500' : 'bg-amber-500 text-white'}
          >
            {s.handled ? 'Handled' : 'Open'}
          </Badge>
        </div>

        <p className="text-sm whitespace-pre-wrap mb-3" data-testid={`suggestion-message-${s.id}`}>
          {s.message}
        </p>

        {(s.name || s.contact) && (
          <div className="text-xs text-muted-foreground mb-3 flex items-center gap-2">
            {s.name && <span>From: {s.name}</span>}
            {s.contact && <span>• Contact: {s.contact}</span>}
          </div>
        )}

        {s.handledBy && s.handledAt && (
          <div className="text-xs text-muted-foreground mb-3">
            Handled by {s.handledBy} on {new Date(s.handledAt).toLocaleString()}
          </div>
        )}

        <div className="flex items-center gap-2 mt-4">
          {!s.handled ? (
            <Button
              size="sm"
              onClick={() => handleMutation.mutate({ id: s.id, handled: true })}
              disabled={handleMutation.isPending}
              data-testid={`button-handle-${s.id}`}
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Mark as Handled
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleMutation.mutate({ id: s.id, handled: false })}
              disabled={handleMutation.isPending}
              data-testid={`button-reopen-${s.id}`}
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Reopen
            </Button>
          )}

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setExpandedNotes(prev => ({ ...prev, [s.id]: !prev[s.id] }))}
            data-testid={`button-notes-${s.id}`}
          >
            {expandedNotes[s.id] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            Notes
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={() => {
              if (confirm('Are you sure you want to delete this suggestion?')) {
                deleteMutation.mutate(s.id);
              }
            }}
            disabled={deleteMutation.isPending}
            data-testid={`button-delete-${s.id}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        {expandedNotes[s.id] && (
          <div className="mt-3 pt-3 border-t">
            <Textarea
              placeholder="Add internal notes about this suggestion..."
              value={notesInput[s.id] ?? s.notes ?? ''}
              onChange={(e) => setNotesInput(prev => ({ ...prev, [s.id]: e.target.value }))}
              className="text-sm mb-2"
              rows={3}
              data-testid={`input-notes-${s.id}`}
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={() => handleMutation.mutate({ id: s.id, notes: notesInput[s.id] ?? s.notes ?? '' })}
              disabled={handleMutation.isPending}
              data-testid={`button-save-notes-${s.id}`}
            >
              Save Notes
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex items-center gap-3 mb-6">
        <Users className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Customer & Staff Suggestions</h1>
          <p className="text-sm text-muted-foreground">
            Feedback from your customers and staff about your business
          </p>
        </div>
        {openCount > 0 && (
          <Badge variant="secondary" className="ml-auto">
            {openCount} open
          </Badge>
        )}
      </div>

      {suggestions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No suggestions yet.</p>
            <p className="text-sm text-muted-foreground mt-2">
              Customer suggestions will appear here when they submit feedback through your website.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {customerSuggestions.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Users className="h-5 w-5" />
                Customer Feedback ({customerSuggestions.length})
              </h2>
              <div className="space-y-4">
                {customerSuggestions.map(renderSuggestion)}
              </div>
            </div>
          )}

          {staffSuggestions.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Staff Suggestions ({staffSuggestions.length})
              </h2>
              <div className="space-y-4">
                {staffSuggestions.map(renderSuggestion)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
