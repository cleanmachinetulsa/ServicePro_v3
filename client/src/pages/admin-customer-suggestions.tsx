/**
 * Admin Customer Suggestions Page
 * 
 * View and manage customer suggestions/feedback received through the public suggestion box
 * Mobile-first design (393px primary viewport)
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { 
  MessageSquarePlus, 
  Trash2, 
  Phone, 
  Mail, 
  User,
  Calendar,
  Inbox,
  Settings2,
  Loader2,
  AlertCircle
} from "lucide-react";
import type { CustomerSuggestion } from "@shared/schema";

export default function AdminCustomerSuggestions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch customer suggestions
  const { data: suggestions, isLoading: suggestionsLoading } = useQuery<CustomerSuggestion[]>({
    queryKey: ['/api/customer-suggestions'],
  });

  // Fetch suggestion box setting
  const { data: settingData } = useQuery<{ enabled: boolean }>({
    queryKey: ['/api/settings/suggestions-box'],
  });

  // Toggle suggestion box mutation
  const toggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const response = await apiRequest("PATCH", "/api/settings/suggestions-box", { enabled });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings/suggestions-box'] });
      toast({
        title: data.enabled ? "Suggestion box enabled" : "Suggestion box disabled",
        description: data.enabled 
          ? "Customers can now submit feedback on your public site."
          : "The suggestion box is now hidden from your public site.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to update setting",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete suggestion mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/customer-suggestions/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/customer-suggestions'] });
      toast({
        title: "Suggestion deleted",
        description: "The feedback has been removed.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to delete",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleToggle = (checked: boolean) => {
    toggleMutation.mutate(checked);
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this feedback?")) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <AppShell title="Customer Feedback">
      <div className="container max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <MessageSquarePlus className="h-6 w-6 text-purple-600" />
              Customer Feedback
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              View suggestions and feedback from your customers
            </p>
          </div>
        </div>

        {/* Settings Card */}
        <Card className="border-purple-200 dark:border-purple-800">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-purple-600" />
              <CardTitle className="text-lg">Suggestion Box Settings</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="suggestions-toggle" className="font-medium">
                  Enable Public Suggestion Box
                </Label>
                <p className="text-sm text-muted-foreground">
                  Show a feedback form on your public website
                </p>
              </div>
              <Switch
                id="suggestions-toggle"
                checked={settingData?.enabled ?? true}
                onCheckedChange={handleToggle}
                disabled={toggleMutation.isPending}
                data-testid="switch-suggestions-box"
              />
            </div>
          </CardContent>
        </Card>

        <Separator />

        {/* Suggestions List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Inbox className="h-5 w-5" />
              Recent Feedback
              {suggestions && suggestions.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {suggestions.length}
                </Badge>
              )}
            </h2>
          </div>

          {suggestionsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="pt-6">
                    <Skeleton className="h-4 w-3/4 mb-2" />
                    <Skeleton className="h-3 w-1/2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : suggestions && suggestions.length > 0 ? (
            <div className="space-y-3">
              {suggestions.map((suggestion) => (
                <Card 
                  key={suggestion.id} 
                  className="hover:border-purple-300 dark:hover:border-purple-700 transition-colors"
                >
                  <CardContent className="pt-5">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1 min-w-0">
                        {/* Message */}
                        <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words">
                          {suggestion.message}
                        </p>

                        {/* Contact Info */}
                        <div className="flex flex-wrap gap-3 mt-3">
                          {suggestion.contactPhone && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Phone className="h-3.5 w-3.5" />
                              <a 
                                href={`tel:${suggestion.contactPhone}`}
                                className="hover:text-purple-600 hover:underline"
                              >
                                {suggestion.contactPhone}
                              </a>
                            </div>
                          )}
                          {suggestion.contactEmail && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Mail className="h-3.5 w-3.5" />
                              <a 
                                href={`mailto:${suggestion.contactEmail}`}
                                className="hover:text-purple-600 hover:underline"
                              >
                                {suggestion.contactEmail}
                              </a>
                            </div>
                          )}
                          {suggestion.customerId && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <User className="h-3.5 w-3.5" />
                              <span>Customer #{suggestion.customerId}</span>
                            </div>
                          )}
                        </div>

                        {/* Timestamp */}
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>
                            {format(new Date(suggestion.createdAt), 'MMM d, yyyy \'at\' h:mm a')}
                          </span>
                        </div>
                      </div>

                      {/* Delete Button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(suggestion.id)}
                        disabled={deleteMutation.isPending}
                        className="shrink-0 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                        data-testid={`button-delete-suggestion-${suggestion.id}`}
                      >
                        {deleteMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-12">
                <div className="text-center">
                  <div className="mx-auto w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-4">
                    <Inbox className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h3 className="font-medium text-gray-900 dark:text-white mb-1">
                    No feedback yet
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                    {settingData?.enabled 
                      ? "Customer suggestions will appear here once they submit feedback on your public website."
                      : "Enable the suggestion box to start collecting customer feedback."}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}
