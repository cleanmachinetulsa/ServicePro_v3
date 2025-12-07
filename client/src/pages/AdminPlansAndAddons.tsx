import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Loader2, Package, Crown, Zap, Shield, Users, Phone, MapPin, Palette } from "lucide-react";
import { PRICING_PLANS } from "@shared/pricingConfig";

interface AddonDefinition {
  key: string;
  name: string;
  shortLabel: string;
  description: string;
  monthlyPrice: number;
  recommendedTier: string;
  minTier: string;
  featureFlags: string[];
  isVisible: boolean;
}

const ADDON_ICONS: Record<string, typeof Package> = {
  extra_phone_number: Phone,
  extra_user_seats: Users,
  ai_power_pack: Zap,
  priority_support: Shield,
  multi_location: MapPin,
  white_label_plus: Palette,
};

export default function AdminPlansAndAddons() {
  const [activeTab, setActiveTab] = useState("plans");

  const { data: catalogData, isLoading } = useQuery<{ catalog: AddonDefinition[] }>({
    queryKey: ["/api/billing/addons/catalog"],
  });

  const getTierBadgeColor = (tier: string) => {
    switch (tier) {
      case "free": return "bg-gray-100 text-gray-800";
      case "starter": return "bg-blue-100 text-blue-800";
      case "pro": return "bg-purple-100 text-purple-800";
      case "elite": return "bg-amber-100 text-amber-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="container mx-auto py-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <Crown className="h-6 w-6 text-amber-500" />
          Plans & Add-Ons Configuration
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage pricing plans and add-on catalog for the platform
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="plans" data-testid="tab-plans">Plans</TabsTrigger>
          <TabsTrigger value="addons" data-testid="tab-addons">Add-Ons</TabsTrigger>
        </TabsList>

        <TabsContent value="plans">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {PRICING_PLANS.map((plan) => (
              <Card 
                key={plan.id} 
                className={plan.recommended ? "border-purple-500 border-2" : ""}
                data-testid={`card-plan-${plan.id}`}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                    {plan.recommended && (
                      <Badge className="bg-purple-500">Recommended</Badge>
                    )}
                  </div>
                  <CardDescription>{plan.tagline}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <span className="text-3xl font-bold">${plan.monthlyPrice}</span>
                    <span className="text-muted-foreground">/mo</span>
                  </div>
                  <ul className="space-y-2 text-sm">
                    {plan.bulletPoints.slice(0, 4).map((point, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-green-500 mt-0.5">✓</span>
                        <span>{point}</span>
                      </li>
                    ))}
                    {plan.bulletPoints.length > 4 && (
                      <li className="text-muted-foreground text-xs">
                        +{plan.bulletPoints.length - 4} more features
                      </li>
                    )}
                  </ul>
                  {plan.maxUsers && (
                    <div className="mt-4 pt-4 border-t text-sm text-muted-foreground">
                      Up to {plan.maxUsers} user{plan.maxUsers > 1 ? 's' : ''}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="text-sm text-muted-foreground mt-4 text-center">
            Plan configuration is read-only. Contact engineering to modify pricing tiers.
          </p>
        </TabsContent>

        <TabsContent value="addons">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {catalogData?.catalog.map((addon) => {
                const IconComponent = ADDON_ICONS[addon.key] || Package;
                return (
                  <Card key={addon.key} data-testid={`card-addon-${addon.key}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary/10 rounded-lg">
                            <IconComponent className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-base">{addon.name}</CardTitle>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                ${addon.monthlyPrice}/mo
                              </Badge>
                              <Badge className={`text-xs ${getTierBadgeColor(addon.minTier)}`}>
                                Min: {addon.minTier}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Visible</span>
                          <Switch 
                            checked={addon.isVisible} 
                            disabled 
                            data-testid={`switch-visible-${addon.key}`}
                          />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-3">
                        {addon.description}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {addon.featureFlags.map((flag) => (
                          <Badge key={flag} variant="secondary" className="text-xs">
                            {flag}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
          <p className="text-sm text-muted-foreground mt-4 text-center">
            Add-on catalog is managed in shared/addonsConfig.ts. Toggle visibility and pricing there.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
