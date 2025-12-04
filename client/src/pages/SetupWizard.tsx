import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2,
  Circle,
  Building2,
  Phone,
  Globe,
  ArrowRight,
  ExternalLink,
  Settings,
  Sparkles,
  ChevronRight,
  Loader2,
  AlertCircle,
  Rocket,
} from "lucide-react";

interface OnboardingProgress {
  businessSetupDone: boolean;
  phoneSetupDone: boolean;
  sitePublished: boolean;
  businessName: string;
  subdomain: string | null;
  industry: string | null;
  phoneConfigured: boolean;
  phoneNumber: string | null;
  websiteUrl: string | null;
  heroTitle: string | null;
  heroSubtitle: string | null;
  ctaButtonText: string | null;
}

export default function SetupWizard() {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const { data, isLoading, refetch } = useQuery<{ success: boolean; progress: OnboardingProgress }>({
    queryKey: ["/api/onboarding/progress"],
  });

  const updateProgressMutation = useMutation({
    mutationFn: async (updates: Partial<{ businessSetupDone: boolean; phoneSetupDone: boolean; sitePublished: boolean }>) => {
      return apiRequest<{ success: boolean }>("/api/onboarding/progress", {
        method: "POST",
        body: JSON.stringify(updates),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/progress"] });
      toast({
        title: "Progress saved",
        description: "Your setup progress has been updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save progress",
        variant: "destructive",
      });
    },
  });

  const progress = data?.progress;
  const completedSteps = [
    progress?.businessSetupDone,
    progress?.phoneSetupDone,
    progress?.sitePublished,
  ].filter(Boolean).length;
  const totalSteps = 3;
  const progressPercent = (completedSteps / totalSteps) * 100;

  const allComplete = completedSteps === totalSteps;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading setup wizard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-3xl font-bold mb-2">Welcome to ServicePro!</h1>
          <p className="text-muted-foreground">
            Complete these 3 steps to get your AI-powered business up and running.
          </p>
        </motion.div>

        {/* Progress Bar */}
        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Setup Progress</span>
              <span className="text-sm text-muted-foreground">
                {completedSteps} of {totalSteps} complete
              </span>
            </div>
            <Progress value={progressPercent} className="h-3" />
            {allComplete && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-4 p-4 rounded-lg bg-green-500/10 border border-green-500/30 flex items-center gap-3"
              >
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                <div>
                  <p className="font-medium text-green-700 dark:text-green-400">Setup Complete!</p>
                  <p className="text-sm text-muted-foreground">
                    You're ready to start taking bookings with AI.
                  </p>
                </div>
                <Button
                  className="ml-auto"
                  onClick={() => navigate("/dashboard")}
                  data-testid="button-go-to-dashboard"
                >
                  Go to Dashboard
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </motion.div>
            )}
          </CardContent>
        </Card>

        {/* Step Cards */}
        <div className="space-y-4">
          {/* Step 1: Business Basics */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className={progress?.businessSetupDone ? "border-green-500/50" : ""}>
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    progress?.businessSetupDone 
                      ? "bg-green-500 text-white" 
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {progress?.businessSetupDone ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <span className="font-bold">1</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="w-5 h-5" />
                      Business Basics & Services
                      {progress?.businessSetupDone && (
                        <Badge variant="secondary" className="bg-green-500/20 text-green-700">
                          Complete
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription>
                      Review your business info and services
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground text-xs">Business Name</Label>
                    <p className="font-medium">{progress?.businessName || "Not set"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Industry</Label>
                    <p className="font-medium capitalize">
                      {progress?.industry?.replace(/_/g, " ") || "Not set"}
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Your industry-specific services and pricing have been pre-loaded.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    data-testid="button-review-services"
                  >
                    <Link href="/settings/services">
                      Review Services & Pricing
                      <ChevronRight className="ml-1 w-4 h-4" />
                    </Link>
                  </Button>
                </div>

                {!progress?.businessSetupDone && (
                  <Button
                    className="w-full"
                    onClick={() => updateProgressMutation.mutate({ businessSetupDone: true })}
                    disabled={updateProgressMutation.isPending}
                    data-testid="button-mark-business-complete"
                  >
                    {updateProgressMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                    )}
                    Mark as Complete
                  </Button>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Step 2: Phone & SMS */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className={progress?.phoneSetupDone ? "border-green-500/50" : ""}>
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    progress?.phoneSetupDone 
                      ? "bg-green-500 text-white" 
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {progress?.phoneSetupDone ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <span className="font-bold">2</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      <Phone className="w-5 h-5" />
                      Phone & SMS Setup
                      {progress?.phoneSetupDone && (
                        <Badge variant="secondary" className="bg-green-500/20 text-green-700">
                          Complete
                        </Badge>
                      )}
                      {progress?.phoneConfigured && !progress?.phoneSetupDone && (
                        <Badge variant="secondary" className="bg-blue-500/20 text-blue-700">
                          Ready
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription>
                      Connect your phone for AI-powered calls and SMS
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {progress?.phoneConfigured ? (
                  <>
                    <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <span className="font-medium text-green-700 dark:text-green-400">
                          Phone Connected
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Phone: {progress.phoneNumber || "Configured"}
                      </p>
                    </div>

                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        Your Twilio phone is ready to receive calls and SMS.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        data-testid="button-phone-settings"
                      >
                        <Link href="/admin/phone-config">
                          Phone Settings
                          <Settings className="ml-1 w-4 h-4" />
                        </Link>
                      </Button>
                    </div>

                    {!progress?.phoneSetupDone && (
                      <Button
                        className="w-full"
                        onClick={() => updateProgressMutation.mutate({ phoneSetupDone: true })}
                        disabled={updateProgressMutation.isPending}
                        data-testid="button-mark-phone-complete"
                      >
                        {updateProgressMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                        )}
                        Mark as Complete
                      </Button>
                    )}
                  </>
                ) : (
                  <>
                    <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="w-4 h-4 text-yellow-500" />
                        <span className="font-medium text-yellow-700 dark:text-yellow-400">
                          Phone Not Configured
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        ServicePro uses Twilio to send/receive calls and SMS via the AI agent.
                      </p>
                    </div>

                    <Button
                      variant="outline"
                      className="w-full"
                      asChild
                      data-testid="button-configure-phone"
                    >
                      <Link href="/admin/phone-config">
                        Open Phone Settings
                        <ChevronRight className="ml-1 w-4 h-4" />
                      </Link>
                    </Button>

                    <p className="text-xs text-muted-foreground text-center">
                      Need help? Contact support for phone setup assistance.
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Step 3: Website */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className={progress?.sitePublished ? "border-green-500/50" : ""}>
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    progress?.sitePublished 
                      ? "bg-green-500 text-white" 
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {progress?.sitePublished ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <span className="font-bold">3</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      <Globe className="w-5 h-5" />
                      Public Website & Booking
                      {progress?.sitePublished && (
                        <Badge variant="secondary" className="bg-green-500/20 text-green-700">
                          Published
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription>
                      Preview and publish your customer booking site
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {progress?.subdomain ? (
                  <>
                    <div className="space-y-3">
                      <div>
                        <Label className="text-muted-foreground text-xs">Your Public URL</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <code className="flex-1 px-3 py-2 rounded-md bg-muted text-sm truncate">
                            {progress.websiteUrl || `https://${window.location.host}/site/${progress.subdomain}`}
                          </code>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(`/site/${progress.subdomain}`, "_blank")}
                            data-testid="button-preview-site"
                          >
                            Preview
                            <ExternalLink className="ml-1 w-3 h-3" />
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <Label className="text-muted-foreground text-xs">Hero Title</Label>
                          <p className="font-medium">{progress.heroTitle || progress.businessName}</p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground text-xs">CTA Button</Label>
                          <p className="font-medium">{progress.ctaButtonText || "Book Now"}</p>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={progress.sitePublished}
                          onCheckedChange={(checked) => 
                            updateProgressMutation.mutate({ sitePublished: checked })
                          }
                          disabled={updateProgressMutation.isPending}
                          data-testid="switch-publish-site"
                        />
                        <Label>
                          {progress.sitePublished ? "Site is published" : "Mark as published"}
                        </Label>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        data-testid="button-edit-website"
                      >
                        <Link href="/admin/homepage-editor">
                          Edit Website
                          <Settings className="ml-1 w-4 h-4" />
                        </Link>
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="w-4 h-4 text-yellow-500" />
                        <span className="font-medium text-yellow-700 dark:text-yellow-400">
                          Website Not Set Up
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Your business needs a subdomain to create a public booking site.
                      </p>
                    </div>

                    <Button
                      variant="outline"
                      className="w-full"
                      asChild
                      data-testid="button-configure-website"
                    >
                      <Link href="/admin/homepage-editor">
                        Configure Website
                        <ChevronRight className="ml-1 w-4 h-4" />
                      </Link>
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Footer Actions */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-8 text-center"
        >
          <p className="text-sm text-muted-foreground mb-4">
            You can always come back to this page from Settings or your Dashboard.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Button
              variant="outline"
              onClick={() => navigate("/dashboard")}
              data-testid="button-skip-to-dashboard"
            >
              Skip to Dashboard
            </Button>
            {allComplete && (
              <Button
                className="bg-gradient-to-r from-primary to-primary/80"
                onClick={() => navigate("/dashboard")}
                data-testid="button-launch-dashboard"
              >
                <Rocket className="mr-2 w-4 h-4" />
                Launch Dashboard
              </Button>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
