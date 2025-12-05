import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Headphones,
  Clock,
  CheckCircle2,
  Loader2,
  Search,
  Filter,
  MessageSquare,
  Building2,
  User,
  AlertTriangle,
  ArrowRight
} from "lucide-react";

interface SupportTicket {
  id: number;
  tenantId: string;
  subject: string;
  message: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  priority: "low" | "normal" | "high" | "urgent";
  source: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  tenantName?: string;
  createdByUsername?: string;
}

const statusConfig = {
  open: { label: "Open", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300", icon: Clock },
  in_progress: { label: "In Progress", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300", icon: Loader2 },
  resolved: { label: "Resolved", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300", icon: CheckCircle2 },
  closed: { label: "Closed", color: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300", icon: CheckCircle2 },
};

const priorityConfig = {
  low: { label: "Low", color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  normal: { label: "Normal", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  high: { label: "High", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" },
  urgent: { label: "Urgent", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
};

export default function AdminSupportTickets() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [updateForm, setUpdateForm] = useState({
    status: "" as "open" | "in_progress" | "resolved" | "closed",
    priority: "" as "low" | "normal" | "high" | "urgent",
    internalNotes: ""
  });

  const { data: ticketsData, isLoading } = useQuery<{ success: boolean; tickets: SupportTicket[] }>({
    queryKey: ["/api/admin/support/tickets", statusFilter, priorityFilter],
  });

  const updateTicketMutation = useMutation({
    mutationFn: async ({ ticketId, data }: { ticketId: number; data: any }) => {
      const response = await apiRequest("PATCH", `/api/admin/support/tickets/${ticketId}/status`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/support/tickets"] });
      setSelectedTicket(null);
      toast({
        title: "Ticket Updated",
        description: "The support ticket has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update ticket.",
        variant: "destructive",
      });
    },
  });

  const tickets = ticketsData?.tickets || [];

  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = !searchQuery || 
      ticket.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.tenantName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.createdByUsername?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "all" || ticket.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || ticket.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  const openCount = tickets.filter(t => t.status === "open").length;
  const inProgressCount = tickets.filter(t => t.status === "in_progress").length;
  const urgentCount = tickets.filter(t => t.priority === "urgent" && t.status !== "closed" && t.status !== "resolved").length;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const handleUpdateTicket = () => {
    if (!selectedTicket) return;
    
    const data: any = {};
    if (updateForm.status) data.status = updateForm.status;
    if (updateForm.priority) data.priority = updateForm.priority;
    if (updateForm.internalNotes) data.internalNotes = updateForm.internalNotes;

    if (Object.keys(data).length === 0) {
      toast({
        title: "No Changes",
        description: "Please make at least one change before updating.",
        variant: "destructive",
      });
      return;
    }

    updateTicketMutation.mutate({ ticketId: selectedTicket.id, data });
  };

  const openTicketDetails = (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setUpdateForm({
      status: ticket.status,
      priority: ticket.priority,
      internalNotes: ""
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <Headphones className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Support Tickets</h1>
              <p className="text-muted-foreground text-sm">Manage tenant support requests</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/50">
                <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{openCount}</p>
                <p className="text-sm text-blue-600/70 dark:text-blue-400/70">Open Tickets</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-full bg-yellow-100 dark:bg-yellow-900/50">
                <Loader2 className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">{inProgressCount}</p>
                <p className="text-sm text-yellow-600/70 dark:text-yellow-400/70">In Progress</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-full bg-red-100 dark:bg-red-900/50">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-700 dark:text-red-300">{urgentCount}</p>
                <p className="text-sm text-red-600/70 dark:text-red-400/70">Urgent</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tickets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-tickets"
                />
              </div>
              <div className="flex gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px]" data-testid="filter-status">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="w-[140px]" data-testid="filter-priority">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priority</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="rounded-full bg-muted p-4 mb-4">
                  <MessageSquare className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-1">No Tickets Found</h3>
                <p className="text-sm text-muted-foreground text-center max-w-sm">
                  {searchQuery || statusFilter !== "all" || priorityFilter !== "all"
                    ? "Try adjusting your filters or search query."
                    : "No support tickets have been submitted yet."
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTickets.map((ticket) => {
                  const StatusIcon = statusConfig[ticket.status].icon;
                  return (
                    <div
                      key={ticket.id}
                      className="p-4 border rounded-lg hover:border-primary/50 transition-colors cursor-pointer"
                      onClick={() => openTicketDetails(ticket)}
                      data-testid={`ticket-row-${ticket.id}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span className="font-medium">{ticket.subject}</span>
                            <Badge className={priorityConfig[ticket.priority].color} variant="secondary">
                              {priorityConfig[ticket.priority].label}
                            </Badge>
                            <Badge className={statusConfig[ticket.status].color} variant="secondary">
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {statusConfig[ticket.status].label}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                            {ticket.message}
                          </p>
                          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                            {ticket.tenantName && (
                              <span className="flex items-center gap-1">
                                <Building2 className="h-3 w-3" />
                                {ticket.tenantName}
                              </span>
                            )}
                            {ticket.createdByUsername && (
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {ticket.createdByUsername}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDate(ticket.createdAt)}
                            </span>
                          </div>
                        </div>
                        <ArrowRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={!!selectedTicket} onOpenChange={(open) => !open && setSelectedTicket(null)}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Ticket #{selectedTicket?.id}
              </DialogTitle>
            </DialogHeader>
            {selectedTicket && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs uppercase tracking-wider">Subject</Label>
                  <p className="font-medium">{selectedTicket.subject}</p>
                </div>

                <div className="flex gap-4">
                  {selectedTicket.tenantName && (
                    <div className="space-y-1">
                      <Label className="text-muted-foreground text-xs uppercase tracking-wider">Tenant</Label>
                      <p className="text-sm flex items-center gap-1">
                        <Building2 className="h-4 w-4" />
                        {selectedTicket.tenantName}
                      </p>
                    </div>
                  )}
                  {selectedTicket.createdByUsername && (
                    <div className="space-y-1">
                      <Label className="text-muted-foreground text-xs uppercase tracking-wider">Submitted By</Label>
                      <p className="text-sm flex items-center gap-1">
                        <User className="h-4 w-4" />
                        {selectedTicket.createdByUsername}
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs uppercase tracking-wider">Message</Label>
                  <div className="p-3 bg-muted/50 rounded-lg text-sm whitespace-pre-wrap">
                    {selectedTicket.message}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={updateForm.status}
                      onValueChange={(value: "open" | "in_progress" | "resolved" | "closed") =>
                        setUpdateForm(prev => ({ ...prev, status: value }))
                      }
                    >
                      <SelectTrigger id="status" data-testid="select-update-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority</Label>
                    <Select
                      value={updateForm.priority}
                      onValueChange={(value: "low" | "normal" | "high" | "urgent") =>
                        setUpdateForm(prev => ({ ...prev, priority: value }))
                      }
                    >
                      <SelectTrigger id="priority" data-testid="select-update-priority">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Internal Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Add internal notes about this ticket..."
                    rows={3}
                    value={updateForm.internalNotes}
                    onChange={(e) => setUpdateForm(prev => ({ ...prev, internalNotes: e.target.value }))}
                    data-testid="input-internal-notes"
                  />
                </div>

                <div className="text-xs text-muted-foreground">
                  Created: {formatDate(selectedTicket.createdAt)}
                  {selectedTicket.resolvedAt && (
                    <> | Resolved: {formatDate(selectedTicket.resolvedAt)}</>
                  )}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedTicket(null)}>
                Cancel
              </Button>
              <Button
                onClick={handleUpdateTicket}
                disabled={updateTicketMutation.isPending}
                data-testid="button-update-ticket"
              >
                {updateTicketMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update Ticket"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
