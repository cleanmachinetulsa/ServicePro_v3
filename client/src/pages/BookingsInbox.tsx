import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Search, Phone, AlertTriangle, CheckCircle, Clock, Copy, ChevronLeft, ChevronRight, RefreshCw, MessageSquare, Calendar, User } from "lucide-react";

interface BookingInboxRow {
  conversationId: number;
  phone: string | null;
  customerName: string | null;
  customerId: number | null;
  service: string | null;
  requestedDateTime: string | null;
  stage: string | null;
  stageReason: string | null;
  status: string | null;
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
  needsHuman: boolean;
  needsHumanReason: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  lastErrorAt: string | null;
  bookingId: number | null;
  calendarEventId: string | null;
  lastMessageTime: string | null;
  platform: string;
}

interface ConversationDetail {
  conversation: any;
  messages: any[];
  smsBookingState: any;
}

const STAGE_LABELS: Record<string, string> = {
  selecting_service: "Selecting Service",
  confirming_address: "Confirming Address",
  choosing_slot: "Choosing Slot",
  offering_upsells: "Offering Upsells",
  booked: "Booked",
};

const STAGE_COLORS: Record<string, string> = {
  selecting_service: "bg-blue-100 text-blue-800",
  confirming_address: "bg-yellow-100 text-yellow-800",
  choosing_slot: "bg-purple-100 text-purple-800",
  offering_upsells: "bg-orange-100 text-orange-800",
  booked: "bg-green-100 text-green-800",
};

export default function BookingsInbox() {
  const { toast } = useToast();
  const [filters, setFilters] = useState({
    status: "",
    stage: "",
    needsHuman: "",
    phone: "",
    page: 1,
    limit: 25,
  });
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const { data: inboxData, isLoading, refetch } = useQuery<{ rows: BookingInboxRow[]; totalCount: number }>({
    queryKey: ["/api/admin/bookings/inbox", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.status) params.set("status", filters.status);
      if (filters.stage) params.set("stage", filters.stage);
      if (filters.needsHuman) params.set("needsHuman", filters.needsHuman);
      if (filters.phone) params.set("phone", filters.phone);
      params.set("page", String(filters.page));
      params.set("limit", String(filters.limit));
      
      const res = await fetch(`/api/admin/bookings/inbox?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch bookings inbox");
      return res.json();
    },
  });

  const { data: conversationDetail, isLoading: isLoadingDetail } = useQuery<ConversationDetail>({
    queryKey: ["/api/admin/bookings/inbox", selectedConversationId, "messages"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/bookings/inbox/${selectedConversationId}/messages`);
      if (!res.ok) throw new Error("Failed to fetch conversation");
      return res.json();
    },
    enabled: !!selectedConversationId,
  });

  const handleRowClick = (row: BookingInboxRow) => {
    setSelectedConversationId(row.conversationId);
    setIsDrawerOpen(true);
  };

  const handleCopyDebugBundle = async () => {
    if (!selectedConversationId) return;
    
    try {
      const res = await fetch(`/api/admin/bookings/inbox/${selectedConversationId}/debug-bundle`);
      if (!res.ok) throw new Error("Failed to fetch debug bundle");
      const bundle = await res.json();
      await navigator.clipboard.writeText(JSON.stringify(bundle, null, 2));
      toast({ title: "Debug bundle copied to clipboard" });
    } catch (error) {
      toast({ title: "Failed to copy debug bundle", variant: "destructive" });
    }
  };

  const formatTime = (iso: string | null) => {
    if (!iso) return "—";
    try {
      return format(new Date(iso), "MMM d, h:mm a");
    } catch {
      return iso;
    }
  };

  const rows = inboxData?.rows || [];
  const totalCount = inboxData?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / filters.limit);

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold" data-testid="heading-bookings-inbox">SMS Booking Inbox</h1>
            <p className="text-muted-foreground">Monitor and debug SMS booking conversations</p>
          </div>
          <Button onClick={() => refetch()} variant="outline" size="sm" data-testid="button-refresh">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <div className="w-40">
                <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v, page: 1 })}>
                  <SelectTrigger data-testid="select-status">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-48">
                <Select value={filters.stage} onValueChange={(v) => setFilters({ ...filters, stage: v, page: 1 })}>
                  <SelectTrigger data-testid="select-stage">
                    <SelectValue placeholder="Stage" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Stages</SelectItem>
                    <SelectItem value="selecting_service">Selecting Service</SelectItem>
                    <SelectItem value="confirming_address">Confirming Address</SelectItem>
                    <SelectItem value="choosing_slot">Choosing Slot</SelectItem>
                    <SelectItem value="offering_upsells">Offering Upsells</SelectItem>
                    <SelectItem value="booked">Booked</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-44">
                <Select value={filters.needsHuman} onValueChange={(v) => setFilters({ ...filters, needsHuman: v, page: 1 })}>
                  <SelectTrigger data-testid="select-needs-human">
                    <SelectValue placeholder="Needs Human" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All</SelectItem>
                    <SelectItem value="true">Needs Human</SelectItem>
                    <SelectItem value="false">AI Handled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by phone..."
                    value={filters.phone}
                    onChange={(e) => setFilters({ ...filters, phone: e.target.value, page: 1 })}
                    className="pl-9"
                    data-testid="input-phone-search"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium text-sm">Phone</th>
                    <th className="text-left p-3 font-medium text-sm">Customer</th>
                    <th className="text-left p-3 font-medium text-sm">Service</th>
                    <th className="text-left p-3 font-medium text-sm">Stage</th>
                    <th className="text-left p-3 font-medium text-sm">Status</th>
                    <th className="text-left p-3 font-medium text-sm">Last Activity</th>
                    <th className="text-left p-3 font-medium text-sm">Attention</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="text-center p-8 text-muted-foreground">Loading...</td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center p-8 text-muted-foreground">No conversations found</td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <tr
                        key={row.conversationId}
                        className="border-b hover:bg-muted/30 cursor-pointer"
                        onClick={() => handleRowClick(row)}
                        data-testid={`row-conversation-${row.conversationId}`}
                      >
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <span className="font-mono text-sm">{row.phone || "—"}</span>
                          </div>
                        </td>
                        <td className="p-3">{row.customerName || "Unknown"}</td>
                        <td className="p-3">{row.service || "—"}</td>
                        <td className="p-3">
                          {row.stage ? (
                            <Badge className={`${STAGE_COLORS[row.stage] || "bg-gray-100 text-gray-800"}`}>
                              {STAGE_LABELS[row.stage] || row.stage}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="p-3">
                          <Badge variant={row.status === "active" ? "default" : "secondary"}>
                            {row.status || "—"}
                          </Badge>
                        </td>
                        <td className="p-3 text-sm text-muted-foreground">
                          {formatTime(row.lastMessageTime)}
                        </td>
                        <td className="p-3">
                          {row.needsHuman ? (
                            <div className="flex items-center gap-1 text-amber-600">
                              <AlertTriangle className="h-4 w-4" />
                              <span className="text-sm">Needs Human</span>
                            </div>
                          ) : row.lastErrorCode ? (
                            <div className="flex items-center gap-1 text-red-600">
                              <AlertTriangle className="h-4 w-4" />
                              <span className="text-sm">Error</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-green-600">
                              <CheckCircle className="h-4 w-4" />
                              <span className="text-sm">OK</span>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t">
                <span className="text-sm text-muted-foreground">
                  Showing {(filters.page - 1) * filters.limit + 1} - {Math.min(filters.page * filters.limit, totalCount)} of {totalCount}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={filters.page <= 1}
                    onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
                    data-testid="button-prev-page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">Page {filters.page} of {totalPages}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={filters.page >= totalPages}
                    onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
                    data-testid="button-next-page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Conversation Details
            </SheetTitle>
            <SheetDescription>
              {conversationDetail?.conversation?.customerPhone || "Loading..."}
            </SheetDescription>
          </SheetHeader>

          {isLoadingDetail ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : conversationDetail ? (
            <div className="space-y-6 mt-6">
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={handleCopyDebugBundle} data-testid="button-copy-debug">
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Debug Bundle
                </Button>
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <User className="h-4 w-4" /> Customer Info
                </h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-muted-foreground">Name:</div>
                  <div>{conversationDetail.conversation?.customerName || "Unknown"}</div>
                  <div className="text-muted-foreground">Phone:</div>
                  <div className="font-mono">{conversationDetail.conversation?.customerPhone || "—"}</div>
                  <div className="text-muted-foreground">Status:</div>
                  <div>
                    <Badge variant={conversationDetail.conversation?.status === "active" ? "default" : "secondary"}>
                      {conversationDetail.conversation?.status || "—"}
                    </Badge>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Calendar className="h-4 w-4" /> Booking State
                </h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-muted-foreground">Stage:</div>
                  <div>
                    {conversationDetail.smsBookingState?.stage ? (
                      <Badge className={STAGE_COLORS[conversationDetail.smsBookingState.stage] || ""}>
                        {STAGE_LABELS[conversationDetail.smsBookingState.stage] || conversationDetail.smsBookingState.stage}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </div>
                  <div className="text-muted-foreground">Service:</div>
                  <div>{conversationDetail.smsBookingState?.service || "—"}</div>
                  <div className="text-muted-foreground">Address:</div>
                  <div>{conversationDetail.smsBookingState?.address || "—"}</div>
                  <div className="text-muted-foreground">Chosen Slot:</div>
                  <div>{conversationDetail.smsBookingState?.chosenSlotLabel || "—"}</div>
                  <div className="text-muted-foreground">Vehicle:</div>
                  <div>{conversationDetail.smsBookingState?.vehicle || "—"}</div>
                </div>
                {conversationDetail.smsBookingState?.lastResetReason && (
                  <div className="text-sm bg-amber-50 dark:bg-amber-950 p-2 rounded">
                    <span className="font-medium">Last Reset:</span> {conversationDetail.smsBookingState.lastResetReason}
                  </div>
                )}
              </div>

              {(conversationDetail.conversation?.needsHumanAttention || conversationDetail.conversation?.lastBookingErrorCode) && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <h3 className="font-semibold flex items-center gap-2 text-amber-600">
                      <AlertTriangle className="h-4 w-4" /> Attention Required
                    </h3>
                    {conversationDetail.conversation?.needsHumanAttention && (
                      <div className="text-sm bg-amber-50 dark:bg-amber-950 p-2 rounded">
                        <div className="font-medium">Needs Human Attention</div>
                        {conversationDetail.conversation?.needsHumanReason && (
                          <div className="text-muted-foreground mt-1">{conversationDetail.conversation.needsHumanReason}</div>
                        )}
                      </div>
                    )}
                    {conversationDetail.conversation?.lastBookingErrorCode && (
                      <div className="text-sm bg-red-50 dark:bg-red-950 p-2 rounded">
                        <div className="font-medium">Error: {conversationDetail.conversation.lastBookingErrorCode}</div>
                        {conversationDetail.conversation?.lastBookingErrorMessage && (
                          <div className="text-muted-foreground mt-1">{conversationDetail.conversation.lastBookingErrorMessage}</div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}

              <Separator />

              <div className="space-y-3">
                <h3 className="font-semibold">Conversation Thread</h3>
                <ScrollArea className="h-[300px] border rounded-md p-3">
                  <div className="space-y-3">
                    {conversationDetail.messages?.map((msg: any) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.sender === "customer" ? "justify-start" : "justify-end"}`}
                      >
                        <div
                          className={`max-w-[85%] p-2 rounded-lg text-sm ${
                            msg.sender === "customer"
                              ? "bg-muted"
                              : "bg-primary text-primary-foreground"
                          }`}
                        >
                          <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                          <div className={`text-xs mt-1 ${msg.sender === "customer" ? "text-muted-foreground" : "opacity-70"}`}>
                            {formatTime(msg.timestamp)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              Failed to load conversation details
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
