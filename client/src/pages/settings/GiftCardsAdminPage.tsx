import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RefreshCw, Gift, DollarSign, CreditCard, AlertCircle, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface GiftCard {
  id: number;
  tenantId: string;
  provider: string;
  providerCardId: string;
  referenceCode: string;
  purchaserName: string | null;
  recipientName: string | null;
  recipientEmail: string | null;
  initialAmountCents: number;
  currentBalanceCents: number;
  currency: string;
  status: string;
  externalUrl: string | null;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

interface GiftCardSummary {
  totalCards: number;
  activeCards: number;
  redeemedCards: number;
  totalInitialCents: number;
  totalCurrentBalanceCents: number;
  totalRedeemedCents: number;
}

interface GiftCardsResponse {
  cards: GiftCard[];
  summary: GiftCardSummary;
}

interface ConfigResponse {
  provider: string;
  configured: boolean;
  message: string;
}

interface SyncResponse {
  success: boolean;
  created: number;
  updated: number;
  errors: string[];
}

function formatCents(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

function getStatusBadge(status: string) {
  switch (status.toUpperCase()) {
    case "ACTIVE":
      return <Badge className="bg-green-500" data-testid="badge-status-active">Active</Badge>;
    case "REDEEMED":
      return <Badge className="bg-gray-500" data-testid="badge-status-redeemed">Redeemed</Badge>;
    case "VOID":
      return <Badge className="bg-red-500" data-testid="badge-status-void">Void</Badge>;
    case "EXPIRED":
      return <Badge className="bg-yellow-500" data-testid="badge-status-expired">Expired</Badge>;
    case "PENDING":
      return <Badge className="bg-blue-500" data-testid="badge-status-pending">Pending</Badge>;
    default:
      return <Badge data-testid="badge-status-unknown">{status}</Badge>;
  }
}

export default function GiftCardsAdminPage() {
  const { toast } = useToast();
  const [syncResult, setSyncResult] = useState<SyncResponse | null>(null);

  const { data: config, isLoading: configLoading } = useQuery<ConfigResponse>({
    queryKey: ["/api/admin/gift-cards/config"],
  });

  const { data: giftCardsData, isLoading: cardsLoading, refetch } = useQuery<GiftCardsResponse>({
    queryKey: ["/api/admin/gift-cards"],
    enabled: config?.configured,
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/gift-cards/sync");
      return response.json() as Promise<SyncResponse>;
    },
    onSuccess: (data) => {
      setSyncResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/gift-cards"] });
      toast({
        title: "Sync Complete",
        description: `Created ${data.created} cards, updated ${data.updated} cards`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Sync Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (configLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Gift Cards</h1>
          <p className="text-muted-foreground">
            Manage and sync gift cards from Square
          </p>
        </div>
        <Button
          onClick={() => syncMutation.mutate()}
          disabled={!config?.configured || syncMutation.isPending}
          data-testid="button-sync"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${syncMutation.isPending ? "animate-spin" : ""}`} />
          {syncMutation.isPending ? "Syncing..." : "Sync from Square"}
        </Button>
      </div>

      {!config?.configured && (
        <Alert variant="destructive" data-testid="alert-not-configured">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {config?.message || "Square is not configured. Add SQUARE_ACCESS_TOKEN and SQUARE_LOCATION_ID to your secrets."}
          </AlertDescription>
        </Alert>
      )}

      {syncResult && (
        <Alert className="border-green-500" data-testid="alert-sync-result">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <AlertDescription>
            Sync complete: {syncResult.created} created, {syncResult.updated} updated
            {syncResult.errors.length > 0 && (
              <span className="text-red-500 ml-2">
                ({syncResult.errors.length} errors)
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card data-testid="card-total-cards">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cards</CardTitle>
            <Gift className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-cards">
              {cardsLoading ? <Skeleton className="h-8 w-16" /> : giftCardsData?.summary.totalCards || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {giftCardsData?.summary.activeCards || 0} active
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-outstanding-balance">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding Balance</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-outstanding-balance">
              {cardsLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                formatCents(giftCardsData?.summary.totalCurrentBalanceCents || 0)
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Remaining value on all cards
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-redeemed">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Redeemed</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-redeemed">
              {cardsLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                formatCents(giftCardsData?.summary.totalRedeemedCents || 0)
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {giftCardsData?.summary.redeemedCards || 0} fully redeemed
            </p>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-gift-cards-table">
        <CardHeader>
          <CardTitle>Gift Cards</CardTitle>
          <CardDescription>
            All gift cards synced from Square
          </CardDescription>
        </CardHeader>
        <CardContent>
          {cardsLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !giftCardsData?.cards.length ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="text-no-cards">
              No gift cards found. Click "Sync from Square" to import your gift cards.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Initial Amount</TableHead>
                  <TableHead>Current Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {giftCardsData.cards.map((card) => (
                  <TableRow key={card.id} data-testid={`row-gift-card-${card.id}`}>
                    <TableCell className="font-mono" data-testid={`text-reference-${card.id}`}>
                      ****{card.referenceCode}
                    </TableCell>
                    <TableCell data-testid={`text-recipient-${card.id}`}>
                      {card.recipientName || card.recipientEmail || "-"}
                    </TableCell>
                    <TableCell data-testid={`text-initial-amount-${card.id}`}>
                      {formatCents(card.initialAmountCents, card.currency)}
                    </TableCell>
                    <TableCell data-testid={`text-balance-${card.id}`}>
                      {formatCents(card.currentBalanceCents, card.currency)}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(card.status)}
                    </TableCell>
                    <TableCell data-testid={`text-created-${card.id}`}>
                      {new Date(card.createdAt).toLocaleDateString()}
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
