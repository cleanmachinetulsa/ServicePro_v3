import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Shield, AlertTriangle, Info } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function DemoModeSettings() {
  const { toast } = useToast();
  
  const { data: settings, isLoading } = useQuery<{ success: boolean; demoModeEnabled: boolean }>({
    queryKey: ['/api/admin/demo-settings'],
  });

  const toggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      return apiRequest('/api/admin/demo-settings', 'PUT', { demoModeEnabled: enabled });
    },
    onSuccess: (data: { success: boolean; demoModeEnabled: boolean }) => {
      toast({
        title: data.demoModeEnabled ? "Demo Mode Enabled" : "Demo Mode Disabled",
        description: data.demoModeEnabled 
          ? "Demo access is now available. Visitors can explore the platform safely." 
          : "Demo access has been disabled.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/demo-settings'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update demo mode settings",
        variant: "destructive",
      });
    },
  });

  const handleToggle = (checked: boolean) => {
    toggleMutation.mutate(checked);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Demo Mode
          </CardTitle>
          <CardDescription>
            <Skeleton className="h-4 w-full" />
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Demo Mode
        </CardTitle>
        <CardDescription>
          Control white-label demonstration access for potential customers
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between space-x-4">
          <div className="flex-1 space-y-1">
            <Label htmlFor="demo-mode-toggle" className="text-base font-medium">
              Enable Demo Access
            </Label>
            <p className="text-sm text-muted-foreground">
              Allow visitors to explore the platform with safe, isolated demo data
            </p>
          </div>
          <Switch
            id="demo-mode-toggle"
            data-testid="switch-demo-mode"
            checked={settings?.demoModeEnabled || false}
            onCheckedChange={handleToggle}
            disabled={toggleMutation.isPending}
          />
        </div>

        {settings?.demoModeEnabled && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Demo mode is <strong>enabled</strong>. Visitors can access a secure sandbox environment with mock data.
              Demo sessions expire after 2 hours and cannot modify real data or send communications.
            </AlertDescription>
          </Alert>
        )}

        {!settings?.demoModeEnabled && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Demo mode is <strong>disabled</strong>. Visitors cannot access the demo environment.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-3 rounded-lg border p-4">
          <h4 className="text-sm font-semibold">Security Features</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <Shield className="h-4 w-4 mt-0.5 text-green-600" />
              <span>Demo users are isolated from real customer data and files</span>
            </li>
            <li className="flex items-start gap-2">
              <Shield className="h-4 w-4 mt-0.5 text-green-600" />
              <span>All mutation operations (SMS, email, payments) are blocked</span>
            </li>
            <li className="flex items-start gap-2">
              <Shield className="h-4 w-4 mt-0.5 text-green-600" />
              <span>Sessions automatically expire after 2 hours</span>
            </li>
            <li className="flex items-start gap-2">
              <Shield className="h-4 w-4 mt-0.5 text-green-600" />
              <span>AI interactions are rate-limited for demo users</span>
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
