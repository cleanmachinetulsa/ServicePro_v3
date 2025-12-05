import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  HelpCircle, 
  MessageSquarePlus, 
  FileText, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  BookOpen,
  Search,
  ChevronRight,
  ExternalLink
} from "lucide-react";

interface KbArticle {
  slug: string;
  title: string;
  scope: string;
  category: string;
  summary: string;
  lastVerifiedAt: string | null;
}

interface SupportTicket {
  id: number;
  subject: string;
  message: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  priority: "low" | "normal" | "high" | "urgent";
  source: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
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

export default function SupportCenter() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("tickets");
  const [isNewTicketOpen, setIsNewTicketOpen] = useState(false);
  const [newTicketForm, setNewTicketForm] = useState({
    subject: "",
    message: "",
    priority: "normal" as "low" | "normal" | "high" | "urgent"
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedArticle, setSelectedArticle] = useState<KbArticle | null>(null);
  const [fullArticle, setFullArticle] = useState<{ contentMarkdown: string } | null>(null);

  const { data: ticketsData, isLoading: ticketsLoading } = useQuery<{ success: boolean; tickets: SupportTicket[] }>({
    queryKey: ["/api/support/tickets"],
  });

  const { data: articlesData, isLoading: articlesLoading } = useQuery<{ success: boolean; articles: KbArticle[] }>({
    queryKey: ["/api/support/kb/articles"],
  });

  const { data: articleDetailData, isLoading: articleDetailLoading } = useQuery<{ success: boolean; article: any }>({
    queryKey: ["/api/support/kb/articles", selectedArticle?.slug],
    enabled: !!selectedArticle?.slug,
  });

  const createTicketMutation = useMutation({
    mutationFn: async (data: { subject: string; message: string; priority: string }) => {
      const response = await apiRequest("POST", "/api/support/tickets", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets"] });
      setIsNewTicketOpen(false);
      setNewTicketForm({ subject: "", message: "", priority: "normal" });
      toast({
        title: "Ticket Created",
        description: "Your support request has been submitted. We'll get back to you soon.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create ticket. Please try again.",
        variant: "destructive",
      });
    },
  });

  const closeTicketMutation = useMutation({
    mutationFn: async (ticketId: number) => {
      const response = await apiRequest("PATCH", `/api/support/tickets/${ticketId}/status`, { status: "closed" });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets"] });
      toast({
        title: "Ticket Closed",
        description: "The ticket has been closed.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to close ticket.",
        variant: "destructive",
      });
    },
  });

  const tickets = ticketsData?.tickets || [];
  const articles = articlesData?.articles || [];

  const filteredArticles = articles.filter(article =>
    article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    article.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
    article.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openTickets = tickets.filter(t => t.status === "open" || t.status === "in_progress");
  const closedTickets = tickets.filter(t => t.status === "resolved" || t.status === "closed");

  const handleSubmitTicket = () => {
    if (!newTicketForm.subject.trim() || !newTicketForm.message.trim()) {
      toast({
        title: "Missing Information",
        description: "Please fill in both subject and message.",
        variant: "destructive",
      });
      return;
    }
    createTicketMutation.mutate(newTicketForm);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <HelpCircle className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Help & Support</h1>
              <p className="text-muted-foreground text-sm">Get help with ServicePro setup and features</p>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-2 mb-6">
            <TabsTrigger value="tickets" className="flex items-center gap-2" data-testid="tab-tickets">
              <MessageSquarePlus className="h-4 w-4" />
              <span>My Tickets</span>
              {openTickets.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {openTickets.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="kb" className="flex items-center gap-2" data-testid="tab-kb">
              <BookOpen className="h-4 w-4" />
              <span>Knowledge Base</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tickets" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                {openTickets.length > 0 
                  ? `You have ${openTickets.length} open ticket${openTickets.length > 1 ? 's' : ''}`
                  : 'No open tickets'
                }
              </p>
              <Dialog open={isNewTicketOpen} onOpenChange={setIsNewTicketOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2" data-testid="button-new-ticket">
                    <MessageSquarePlus className="h-4 w-4" />
                    New Ticket
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <MessageSquarePlus className="h-5 w-5" />
                      Submit Support Request
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="subject">Subject</Label>
                      <Input
                        id="subject"
                        placeholder="Brief description of your issue"
                        value={newTicketForm.subject}
                        onChange={(e) => setNewTicketForm(prev => ({ ...prev, subject: e.target.value }))}
                        data-testid="input-ticket-subject"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="priority">Priority</Label>
                      <Select
                        value={newTicketForm.priority}
                        onValueChange={(value: "low" | "normal" | "high" | "urgent") => 
                          setNewTicketForm(prev => ({ ...prev, priority: value }))
                        }
                      >
                        <SelectTrigger data-testid="select-ticket-priority">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low - General question</SelectItem>
                          <SelectItem value="normal">Normal - Need help soon</SelectItem>
                          <SelectItem value="high">High - Affecting my business</SelectItem>
                          <SelectItem value="urgent">Urgent - System is down</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="message">Message</Label>
                      <Textarea
                        id="message"
                        placeholder="Describe your issue in detail. Include any error messages or steps to reproduce the problem."
                        rows={5}
                        value={newTicketForm.message}
                        onChange={(e) => setNewTicketForm(prev => ({ ...prev, message: e.target.value }))}
                        data-testid="input-ticket-message"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsNewTicketOpen(false)}>
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleSubmitTicket}
                      disabled={createTicketMutation.isPending}
                      data-testid="button-submit-ticket"
                    >
                      {createTicketMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        "Submit Ticket"
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {ticketsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : tickets.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <div className="rounded-full bg-muted p-4 mb-4">
                    <MessageSquarePlus className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-medium mb-1">No Support Tickets</h3>
                  <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
                    Have a question or need help? Submit a ticket and our team will get back to you.
                  </p>
                  <Button onClick={() => setIsNewTicketOpen(true)} className="gap-2">
                    <MessageSquarePlus className="h-4 w-4" />
                    Create Your First Ticket
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {openTickets.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                      Active Tickets
                    </h3>
                    {openTickets.map((ticket) => {
                      const StatusIcon = statusConfig[ticket.status].icon;
                      return (
                        <Card key={ticket.id} className="hover:border-primary/50 transition-colors">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium truncate">{ticket.subject}</span>
                                  <Badge className={priorityConfig[ticket.priority].color} variant="secondary">
                                    {priorityConfig[ticket.priority].label}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                                  {ticket.message}
                                </p>
                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {formatDate(ticket.createdAt)}
                                  </span>
                                  <Badge className={statusConfig[ticket.status].color} variant="secondary">
                                    <StatusIcon className="h-3 w-3 mr-1" />
                                    {statusConfig[ticket.status].label}
                                  </Badge>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => closeTicketMutation.mutate(ticket.id)}
                                disabled={closeTicketMutation.isPending}
                                data-testid={`button-close-ticket-${ticket.id}`}
                              >
                                Close
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}

                {closedTickets.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                      Resolved Tickets
                    </h3>
                    {closedTickets.slice(0, 5).map((ticket) => (
                      <Card key={ticket.id} className="opacity-60 hover:opacity-100 transition-opacity">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                <span className="font-medium truncate">{ticket.subject}</span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                {ticket.resolvedAt ? `Resolved ${formatDate(ticket.resolvedAt)}` : formatDate(ticket.updatedAt)}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="kb" className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search articles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-kb-search"
              />
            </div>

            {articlesLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredArticles.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <div className="rounded-full bg-muted p-4 mb-4">
                    <BookOpen className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-medium mb-1">No Articles Found</h3>
                  <p className="text-sm text-muted-foreground text-center max-w-sm">
                    {searchQuery 
                      ? "Try a different search term or browse all articles."
                      : "Knowledge base articles are being prepared."
                    }
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3">
                {filteredArticles.map((article) => (
                  <Card 
                    key={article.slug} 
                    className="cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => setSelectedArticle(article)}
                    data-testid={`card-article-${article.slug}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                            <span className="font-medium">{article.title}</span>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                            {article.summary}
                          </p>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {article.category.replace(/_/g, ' ')}
                            </Badge>
                            <Badge variant="outline" className="text-xs capitalize">
                              {article.scope}
                            </Badge>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <Dialog open={!!selectedArticle} onOpenChange={(open) => !open && setSelectedArticle(null)}>
              <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    {selectedArticle?.title}
                  </DialogTitle>
                </DialogHeader>
                <div className="py-4">
                  {articleDetailLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : articleDetailData?.article ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <div 
                        className="whitespace-pre-wrap text-sm leading-relaxed"
                        dangerouslySetInnerHTML={{ 
                          __html: articleDetailData.article.contentMarkdown
                            .replace(/^### (.*$)/gim, '<h3 class="text-base font-semibold mt-4 mb-2">$1</h3>')
                            .replace(/^## (.*$)/gim, '<h2 class="text-lg font-semibold mt-4 mb-2">$1</h2>')
                            .replace(/^# (.*$)/gim, '<h1 class="text-xl font-bold mt-4 mb-2">$1</h1>')
                            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                            .replace(/\*(.*?)\*/g, '<em>$1</em>')
                            .replace(/`(.*?)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-xs">$1</code>')
                            .replace(/^- (.*$)/gim, '<li class="ml-4">$1</li>')
                            .replace(/^\d+\. (.*$)/gim, '<li class="ml-4">$1</li>')
                            .replace(/\n\n/g, '</p><p class="my-2">')
                            .replace(/\n/g, '<br/>')
                        }}
                      />
                    </div>
                  ) : (
                    <p className="text-muted-foreground">Article content could not be loaded.</p>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </TabsContent>
        </Tabs>

        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-sm mb-1">Need Immediate Help?</h4>
                <p className="text-sm text-muted-foreground">
                  For urgent issues, create a ticket with "Urgent" priority and we'll respond as quickly as possible.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
