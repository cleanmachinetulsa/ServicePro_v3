import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Search, Phone, AlertTriangle, CheckCircle, Clock, Copy, ChevronLeft, ChevronRight, RefreshCw, MessageSquare, Calendar, User, Plus, CalendarDays, X } from "lucide-react";
import { BOOKING_STATUS_META, ALL_BOOKING_STATUSES, deriveBookingStatus, type BookingStatus } from "@shared/bookingStatus";

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
  bookingStatus: string | null;
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
  address: string | null;
  vehicle: string | null;
}

interface ConversationDetail {
  conversation: any;
  messages: any[];
  smsBookingState: any;
  customer: any;
}

const STAGE_LABELS: Record<string, string> = {
  selecting_service: "Selecting Service",
  confirming_address: "Confirming Address",
  ask_address: "Asking Address",
  choosing_slot: "Choosing Slot",
  awaiting_confirm: "Awaiting Confirm",
  creating_booking: "Creating Booking",
  calendar_insert: "Calendar Insert",
  offering_upsells: "Offering Upsells",
  email_collection: "Email Collection",
  booked: "Booked",
  completed: "Completed",
};

const STAGE_COLORS: Record<string, string> = {
  selecting_service: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  confirming_address: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  ask_address: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  choosing_slot: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  awaiting_confirm: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  creating_booking: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  calendar_insert: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  offering_upsells: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  email_collection: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  booked: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};


export default function BookingsInbox() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [filters, setFilters] = useState({
    bookingStatus: "",
    stage: "",
    needsHuman: "",
    phone: "",
    bookingId: "",
    dateFrom: "",
    dateTo: "",
    page: 1,
    limit: 25,
  });
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const { data: inboxData, isLoading, refetch } = useQuery<{ rows: BookingInboxRow[]; totalCount: number }>({
    queryKey: ["/api/admin/bookings/inbox", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.bookingStatus) params.set("bookingStatus", filters.bookingStatus);
      if (filters.stage) params.set("stage", filters.stage);
      if (filters.needsHuman) params.set("needsHuman", filters.needsHuman);
      if (filters.phone) params.set("phone", filters.phone);
      if (filters.bookingId) params.set("bookingId", filters.bookingId);
      if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
      if (filters.dateTo) params.set("dateTo", filters.dateTo);
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

  const linkBookingMutation = useMutation({
    mutationFn: async (data: { conversationId: number; bookingId: number; calendarEventId: string }) => {
      return apiRequest("POST", `/api/admin/bookings/inbox/${data.conversationId}/link-booking`, {
        bookingId: data.bookingId,
        calendarEventId: data.calendarEventId,
      });
    },
    onSuccess: () => {
      toast({ title: "Booking created and linked to conversation." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bookings/inbox"] });
      setIsDrawerOpen(false);
    },
    onError: () => {
      toast({ title: "Failed to link booking", variant: "destructive" });
    },
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

  const getManualBookingUrl = () => {
    if (!conversationDetail) return "/schedule";
    
    const params = new URLSearchParams();
    const customerName = conversationDetail.conversation?.customerName || conversationDetail.customer?.name;
    const customerPhone = conversationDetail.conversation?.customerPhone || conversationDetail.customer?.phone;
    const service = conversationDetail.smsBookingState?.service;
    const address = conversationDetail.smsBookingState?.address || conversationDetail.customer?.address;
    const vehicle = conversationDetail.smsBookingState?.vehicle || conversationDetail.customer?.vehicleInfo;
    // Prefer ISO datetime for accurate parsing; fallback to human-readable label
    const chosenSlotIso = conversationDetail.smsBookingState?.chosenSlotIso;
    const chosenSlotLabel = conversationDetail.smsBookingState?.chosenSlotLabel;
    
    if (customerName) params.set("name", customerName);
    if (customerPhone) params.set("phone", customerPhone);
    if (service) params.set("service", service);
    if (address) params.set("address", address);
    if (vehicle) params.set("vehicle", vehicle);
    if (chosenSlotIso) {
      params.set("datetime", chosenSlotIso);
    } else if (chosenSlotLabel) {
      params.set("datetime", chosenSlotLabel);
    }
    params.set("conversationId", String(selectedConversationId));
    
    return `/schedule?${params.toString()}`;
  };

  const formatTime = (iso: string | null) => {
    if (!iso) return "—";
    try {
      return format(new Date(iso), "MMM d, h:mm a");
    } catch {
      return iso;
    }
  };

  const clearFilters = () => {
    setFilters({
      bookingStatus: "",
      stage: "",
      needsHuman: "",
      phone: "",
      bookingId: "",
      dateFrom: "",
      dateTo: "",
      page: 1,
      limit: 25,
    });
  };

  const hasActiveFilters = filters.bookingStatus || filters.stage || filters.needsHuman || filters.phone || filters.bookingId || filters.dateFrom || filters.dateTo;

  const rows = inboxData?.rows || [];
  const totalCount = inboxData?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / filters.limit);

  const selectedRow = rows.find(r => r.conversationId === selectedConversationId);
  const selectedBookingStatus = selectedRow ? deriveBookingStatus(selectedRow) : null;
  const showCreateBookingButton = selectedBookingStatus && selectedBookingStatus !== "CONFIRMED";

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background p-4 sm:p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold" data-testid="heading-bookings-inbox">SMS Booking Inbox</h1>
              <p className="text-muted-foreground">Monitor and recover SMS booking conversations</p>
            </div>
            <Button onClick={() => refetch()} variant="outline" size="sm" data-testid="button-refresh">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Filters</CardTitle>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="button-clear-filters">
                    <X className="h-4 w-4 mr-1" />
                    Clear
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <div className="w-44">
                  <Select value={filters.bookingStatus} onValueChange={(v) => setFilters({ ...filters, bookingStatus: v, page: 1 })}>
                    <SelectTrigger data-testid="select-booking-status">
                      <SelectValue placeholder="Booking Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Statuses</SelectItem>
                      {ALL_BOOKING_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {BOOKING_STATUS_META[status].label}
                        </SelectItem>
                      ))}
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
                      <SelectItem value="awaiting_confirm">Awaiting Confirm</SelectItem>
                      <SelectItem value="creating_booking">Creating Booking</SelectItem>
                      <SelectItem value="offering_upsells">Offering Upsells</SelectItem>
                      <SelectItem value="email_collection">Email Collection</SelectItem>
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
                <div className="w-40">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Phone..."
                      value={filters.phone}
                      onChange={(e) => setFilters({ ...filters, phone: e.target.value, page: 1 })}
                      className="pl-9"
                      data-testid="input-phone-search"
                    />
                  </div>
                </div>
                <div className="w-32">
                  <Input
                    placeholder="Booking ID"
                    value={filters.bookingId}
                    onChange={(e) => setFilters({ ...filters, bookingId: e.target.value, page: 1 })}
                    data-testid="input-booking-id"
                  />
                </div>
                <div className="w-36">
                  <Input
                    type="date"
                    placeholder="From"
                    value={filters.dateFrom}
                    onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value, page: 1 })}
                    data-testid="input-date-from"
                  />
                </div>
                <div className="w-36">
                  <Input
                    type="date"
                    placeholder="To"
                    value={filters.dateTo}
                    onChange={(e) => setFilters({ ...filters, dateTo: e.target.value, page: 1 })}
                    data-testid="input-date-to"
                  />
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
                      <th className="text-left p-3 font-medium text-sm">Status</th>
                      <th className="text-left p-3 font-medium text-sm">Phone</th>
                      <th className="text-left p-3 font-medium text-sm">Customer</th>
                      <th className="text-left p-3 font-medium text-sm">Service</th>
                      <th className="text-left p-3 font-medium text-sm">Stage</th>
                      <th className="text-left p-3 font-medium text-sm">Last Activity</th>
                      <th className="text-left p-3 font-medium text-sm">Reason</th>
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
                      rows.map((row) => {
                        const bookingStatus = deriveBookingStatus(row);
                        return (
                          <tr
                            key={row.conversationId}
                            className={`border-b hover:bg-muted/30 cursor-pointer ${bookingStatus === "NEEDS_HUMAN" ? "bg-red-50 dark:bg-red-950/20" : ""}`}
                            onClick={() => handleRowClick(row)}
                            data-testid={`row-conversation-${row.conversationId}`}
                          >
                            <td className="p-3">
                              <Badge className={BOOKING_STATUS_META[bookingStatus].colorClass}>
                                {BOOKING_STATUS_META[bookingStatus].label}
                              </Badge>
                            </td>
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
                                <Badge variant="outline" className={`text-xs ${STAGE_COLORS[row.stage] || ""}`}>
                                  {STAGE_LABELS[row.stage] || row.stage}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="p-3 text-sm text-muted-foreground">
                              {formatTime(row.lastMessageTime)}
                            </td>
                            <td className="p-3">
                              {row.needsHumanReason || row.lastErrorCode ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex items-center gap-1 text-red-600 cursor-help">
                                      <AlertTriangle className="h-4 w-4" />
                                      <span className="text-xs truncate max-w-[100px]">
                                        {row.lastErrorCode || row.needsHumanReason}
                                      </span>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs">
                                    <p className="font-medium">{row.lastErrorCode || "Needs Human"}</p>
                                    <p className="text-xs">{row.needsHumanReason || row.lastErrorMessage}</p>
                                  </TooltipContent>
                                </Tooltip>
                              ) : row.bookingId ? (
                                <div className="flex items-center gap-1 text-green-600">
                                  <CheckCircle className="h-4 w-4" />
                                  <span className="text-xs">#{row.bookingId}</span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
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
                <div className="flex flex-wrap justify-end gap-2">
                  {showCreateBookingButton && (
                    <Link href={getManualBookingUrl()}>
                      <Button variant="default" size="sm" data-testid="button-create-booking-manually">
                        <Plus className="h-4 w-4 mr-2" />
                        Create Booking Manually
                      </Button>
                    </Link>
                  )}
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
                    <div>{conversationDetail.conversation?.customerName || conversationDetail.customer?.name || "Unknown"}</div>
                    <div className="text-muted-foreground">Phone:</div>
                    <div className="font-mono">{conversationDetail.conversation?.customerPhone || "—"}</div>
                    <div className="text-muted-foreground">Status:</div>
                    <div>
                      {selectedBookingStatus && (
                        <Badge className={BOOKING_STATUS_COLORS[selectedBookingStatus]}>
                          {BOOKING_STATUS_LABELS[selectedBookingStatus]}
                        </Badge>
                      )}
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
                        <Badge variant="outline" className={STAGE_COLORS[conversationDetail.smsBookingState.stage] || ""}>
                          {STAGE_LABELS[conversationDetail.smsBookingState.stage] || conversationDetail.smsBookingState.stage}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </div>
                    <div className="text-muted-foreground">Service:</div>
                    <div>{conversationDetail.smsBookingState?.service || "—"}</div>
                    <div className="text-muted-foreground">Address:</div>
                    <div>{conversationDetail.smsBookingState?.address || conversationDetail.customer?.address || "—"}</div>
                    <div className="text-muted-foreground">Chosen Slot:</div>
                    <div>{conversationDetail.smsBookingState?.chosenSlotLabel || "—"}</div>
                    <div className="text-muted-foreground">Vehicle:</div>
                    <div>{conversationDetail.smsBookingState?.vehicle || conversationDetail.customer?.vehicleInfo || "—"}</div>
                    {conversationDetail.conversation?.appointmentId && (
                      <>
                        <div className="text-muted-foreground">Booking ID:</div>
                        <div className="font-mono text-green-600">#{conversationDetail.conversation.appointmentId}</div>
                      </>
                    )}
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
                      <h3 className="font-semibold flex items-center gap-2 text-red-600">
                        <AlertTriangle className="h-4 w-4" /> Attention Required
                      </h3>
                      {conversationDetail.conversation?.needsHumanAttention && (
                        <div className="text-sm bg-red-50 dark:bg-red-950 p-2 rounded border border-red-200 dark:border-red-800">
                          <div className="font-medium text-red-700 dark:text-red-300">Needs Human Attention</div>
                          {conversationDetail.conversation?.needsHumanReason && (
                            <div className="text-red-600 dark:text-red-400 mt-1">{conversationDetail.conversation.needsHumanReason}</div>
                          )}
                        </div>
                      )}
                      {conversationDetail.conversation?.lastBookingErrorCode && (
                        <div className="text-sm bg-red-50 dark:bg-red-950 p-2 rounded border border-red-200 dark:border-red-800">
                          <div className="font-medium text-red-700 dark:text-red-300">Error: {conversationDetail.conversation.lastBookingErrorCode}</div>
                          {conversationDetail.conversation?.lastBookingErrorMessage && (
                            <div className="text-red-600 dark:text-red-400 mt-1">{conversationDetail.conversation.lastBookingErrorMessage}</div>
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
    </TooltipProvider>
  );
}
