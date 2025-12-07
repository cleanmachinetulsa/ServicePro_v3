import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Package, Zap, Shield, Users, Phone, MapPin, Palette, Check, Clock, Lock, Info, ShieldAlert } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AddonCatalogItem {
  key: string;
  name: string;
  shortLabel: string;
  description: string;
  monthlyPrice: number;
  recommendedTier: string;
  minTier: string;
  featureFlags: string[];
  isVisible: boolean;
  currentStatus: 'active' | 'pending_cancel' | 'available' | 'unavailable';
  quantity?: number;
  activatedAt?: string;
}

interface AddonsResponse {
  tenantId: string;
  planTier: string;
  catalog: AddonCatalogItem[];
  billingNote: string;
  isProtectedTenant?: boolean;
}

const ADDON_ICONS: Record<string, typeof Package> = {
  extra_phone_number: Phone,
  extra_user_seats: Users,
  ai_power_pack: Zap,
  priority_support: Shield,
  multi_location: MapPin,
  white_label_plus: Palette,
};

export default function AddonsPage() {
  const { toast } = useToast();

  const { data, isLoading, error } = useQuery<AddonsResponse>({
    queryKey: ["/api/billing/addons/my"],
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ addonKey, action }: { addonKey: string; action: 'activate' | 'cancel' }) => {
      const res = await apiRequest("POST", "/api/billing/addons/my/toggle", { addonKey, action });
      return res.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/billing/addons/my"] });
      toast({
        title: "Success",
        description: result.message,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update add-on",
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800"><Check className="h-3 w-3 mr-1" /> Active</Badge>;
      case 'pending_cancel':
        return <Badge className="bg-amber-100 text-amber-800"><Clock className="h-3 w-3 mr-1" /> Canceling</Badge>;
      case 'unavailable':
        return <Badge variant="secondary"><Lock className="h-3 w-3 mr-1" /> Upgrade Required</Badge>;
      default:
        return null;
    }
  };

  const getTierLabel = (tier: string) => {
    return tier.charAt(0).toUpperCase() + tier.slice(1);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-6 max-w-4xl">
        <Alert variant="destructive">
          <AlertDescription>Failed to load add-ons. Please try again later.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const activeAddons = data?.catalog.filter(a => a.currentStatus === 'active' || a.currentStatus === 'pending_cancel') || [];
  const availableAddons = data?.catalog.filter(a => a.currentStatus === 'available') || [];
  const unavailableAddons = data?.catalog.filter(a => a.currentStatus === 'unavailable') || [];

  // SP-20: Show protected tenant state for Clean Machine
  if (data?.isProtectedTenant) {
    return (
      <div className="container mx-auto py-6 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Package className="h-6 w-6" />
            My Add-Ons
          </h1>
          <p className="text-muted-foreground mt-1">
            Enhance your plan with powerful add-ons
          </p>
        </div>

        <Card className="border-amber-200 bg-amber-50/30" data-testid="card-protected-tenant">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-100 rounded-lg">
                <ShieldAlert className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <CardTitle className="text-lg">Protected Account</CardTitle>
                <CardDescription>
                  This account is managed by ServicePro and add-on modifications are not available.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              If you need to modify add-ons for this account, please contact the ServicePro team directly.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <Package className="h-6 w-6" />
          My Add-Ons
        </h1>
        <p className="text-muted-foreground mt-1">
          Enhance your {getTierLabel(data?.planTier || 'starter')} plan with powerful add-ons
        </p>
      </div>

      <Alert className="mb-6 bg-blue-50 border-blue-200">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          {data?.billingNote}
        </AlertDescription>
      </Alert>

      {activeAddons.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Your Active Add-Ons</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {activeAddons.map((addon) => {
              const IconComponent = ADDON_ICONS[addon.key] || Package;
              return (
                <Card key={addon.key} className="border-green-200 bg-green-50/30" data-testid={`card-addon-active-${addon.key}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <IconComponent className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{addon.name}</CardTitle>
                          <div className="flex items-center gap-2 mt-1">
                            {getStatusBadge(addon.currentStatus)}
                            <span className="text-sm text-muted-foreground">
                              ${addon.monthlyPrice}/mo
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      {addon.description}
                    </p>
                    {addon.currentStatus === 'active' && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => toggleMutation.mutate({ addonKey: addon.key, action: 'cancel' })}
                        disabled={toggleMutation.isPending}
                        data-testid={`button-cancel-${addon.key}`}
                      >
                        {toggleMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Cancel at End of Period
                      </Button>
                    )}
                    {addon.currentStatus === 'pending_cancel' && (
                      <Button 
                        variant="default" 
                        size="sm"
                        onClick={() => toggleMutation.mutate({ addonKey: addon.key, action: 'activate' })}
                        disabled={toggleMutation.isPending}
                        data-testid={`button-reactivate-${addon.key}`}
                      >
                        {toggleMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Keep Add-On
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {availableAddons.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Available Add-Ons</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {availableAddons.map((addon) => {
              const IconComponent = ADDON_ICONS[addon.key] || Package;
              return (
                <Card key={addon.key} data-testid={`card-addon-available-${addon.key}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <IconComponent className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{addon.name}</CardTitle>
                          <Badge variant="outline" className="mt-1">
                            ${addon.monthlyPrice}/mo
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      {addon.description}
                    </p>
                    <Button 
                      size="sm"
                      onClick={() => toggleMutation.mutate({ addonKey: addon.key, action: 'activate' })}
                      disabled={toggleMutation.isPending}
                      data-testid={`button-add-${addon.key}`}
                    >
                      {toggleMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Add to My Account
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {unavailableAddons.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4 text-muted-foreground">Requires Plan Upgrade</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {unavailableAddons.map((addon) => {
              const IconComponent = ADDON_ICONS[addon.key] || Package;
              return (
                <Card key={addon.key} className="opacity-60" data-testid={`card-addon-locked-${addon.key}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-100 rounded-lg">
                          <IconComponent className="h-5 w-5 text-gray-400" />
                        </div>
                        <div>
                          <CardTitle className="text-base text-muted-foreground">{addon.name}</CardTitle>
                          <div className="flex items-center gap-2 mt-1">
                            {getStatusBadge(addon.currentStatus)}
                            <span className="text-sm text-muted-foreground">
                              ${addon.monthlyPrice}/mo
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-2">
                      {addon.description}
                    </p>
                    <p className="text-xs text-amber-600">
                      Requires {getTierLabel(addon.minTier)} plan or higher
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
