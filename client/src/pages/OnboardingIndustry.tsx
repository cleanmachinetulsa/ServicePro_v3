// src/pages/OnboardingIndustry.tsx
import React, { useState } from "react";
import { useLocation } from "wouter";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch as Toggle } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { INDUSTRY_PACKS } from "@/config/industryPacks";
import { Eye, EyeOff } from "lucide-react";

const PHOTOGRAPHY_SUBPACKS = [
  "Portrait Sessions",
  "Weddings",
  "Engagements",
  "Corporate Headshots",
  "Events",
  "Family Photos",
  "Newborn Photos",
  "Real Estate Photography",
  "Aerial Drone",
  "Product Photography",
  "Automotive Media",
];

export default function OnboardingIndustryPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);
  const [photoToggles, setPhotoToggles] = useState<Record<string, boolean>>(
    () => Object.fromEntries(PHOTOGRAPHY_SUBPACKS.map((p) => [p, false]))
  );
  const [isSaving, setIsSaving] = useState(false);
  const [debugPayload, setDebugPayload] = useState<any | null>(null);

  // Account creation form fields
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleToggle = (name: string) => {
    setPhotoToggles((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const handleSubmit = async () => {
    if (!selectedIndustry) {
      setFormError("Please select an industry first");
      return;
    }

    // Validate account fields
    if (!username.trim()) {
      setFormError("Username is required");
      return;
    }

    if (username.length < 3) {
      setFormError("Username must be at least 3 characters");
      return;
    }

    if (!password) {
      setFormError("Password is required");
      return;
    }

    if (password.length < 6) {
      setFormError("Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      setFormError("Passwords do not match");
      return;
    }

    // Optional email validation
    if (email && !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setFormError("Please enter a valid email address");
      return;
    }

    setFormError(null);
    const industryMeta = INDUSTRY_PACKS.find((i) => i.id === selectedIndustry);

    const featureFlags =
      selectedIndustry === "photography_full"
        ? Object.fromEntries(
            Object.entries(photoToggles).map(([k, v]) => [
              `photography:${k}`,
              v,
            ])
          )
        : {};

    const payload = {
      username: username.trim(),
      email: email.trim() || undefined,
      password,
      industryId: selectedIndustry,
      industryName: industryMeta?.label ?? selectedIndustry,
      featureFlags,
      rawSelection: {
        selectedIndustry,
        photoToggles,
      },
    };

    setIsSaving(true);
    setDebugPayload(null);

    try {
      const resp = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // Required for session cookie
        body: JSON.stringify(payload),
      });

      const data = await resp.json().catch(() => ({}));

      if (!resp.ok || !data?.success) {
        throw new Error(data?.message || "Failed to create account");
      }

      setDebugPayload({
        sent: payload,
        serverResponse: data,
      });

      toast({
        title: "Account created!",
        description: "Taking you to your dashboard...",
      });

      // Verify session is established before redirecting
      try {
        const verifyResp = await fetch("/api/auth/verify", {
          credentials: "include",
        });
        
        if (verifyResp.ok) {
          // Session verified, safe to redirect
          navigate("/dashboard");
        } else {
          // Session not established, redirect to login
          toast({
            title: "Please log in",
            description: "Account created successfully. Please log in with your credentials.",
            variant: "default",
          });
          setTimeout(() => navigate("/login"), 1000);
        }
      } catch (verifyError) {
        // Fallback: redirect to login if verification fails
        console.error("[OnboardingIndustry] Session verification error:", verifyError);
        toast({
          title: "Please log in",
          description: "Account created. Please log in to continue.",
          variant: "default",
        });
        setTimeout(() => navigate("/login"), 1000);
      }
    } catch (err: any) {
      console.error("[OnboardingIndustry] Account creation error:", err);
      setFormError(err?.message || "Failed to create account. Please try again.");
      toast({
        title: "Account creation failed",
        description: err?.message || "There was a problem creating your account.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">
          What kind of business is this?
        </h1>
        <p className="text-muted-foreground">
          Pick the closest match. You&apos;ll be able to fine-tune services,
          pricing, and wording later.
        </p>
      </div>

      {/* INDUSTRY GRID */}
      <div className="grid grid-cols-2 gap-3 max-[360px]:grid-cols-1 sm:gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {INDUSTRY_PACKS.map((ind) => {
          const isSelected = selectedIndustry === ind.id;
          return (
            <Card
              key={ind.id}
              onClick={() => setSelectedIndustry(ind.id)}
              className={`cursor-pointer transition border overflow-hidden ${
                isSelected
                  ? "border-blue-500 ring-2 ring-blue-500/60"
                  : "border-border hover:border-blue-400/60"
              }`}
              data-testid={`industry-${ind.id}`}
            >
              {ind.imageUrl && (
                <div className="w-full h-32 md:h-40 overflow-hidden">
                  <img
                    src={ind.imageUrl}
                    alt={ind.imageAlt || ind.label}
                    className="w-full h-full object-cover transition-transform hover:scale-105"
                    loading="lazy"
                  />
                </div>
              )}
              <CardHeader className="p-3 sm:p-4">
                <CardTitle className="text-sm sm:text-base">{ind.label}</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">{ind.category}</p>
              </CardHeader>
            </Card>
          );
        })}
      </div>

      {/* PHOTOGRAPHY SUBPACKS */}
      {selectedIndustry === "photography_full" && (
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">
            What types of photography do you offer?
          </h2>
          <p className="text-muted-foreground">
            Turn on all that apply. Your website, services, and AI concierge can
            lean into these automatically.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {PHOTOGRAPHY_SUBPACKS.map((sub) => (
              <Card
                key={sub}
                className="p-4 flex justify-between items-center"
                data-testid={`photo-option-${sub.replace(/\s+/g, '-').toLowerCase()}`}
              >
                <span>{sub}</span>
                <Toggle
                  checked={photoToggles[sub]}
                  onCheckedChange={() => handleToggle(sub)}
                  data-testid={`toggle-${sub.replace(/\s+/g, '-').toLowerCase()}`}
                />
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ACCOUNT CREATION FORM - Only show after industry selection */}
      {selectedIndustry && (
        <div className="space-y-6 pt-6 border-t border-border">
          <div>
            <h2 className="text-2xl font-semibold mb-2">Create Your Account</h2>
            <p className="text-muted-foreground">
              Enter your details to save your industry selection and get started.
            </p>
          </div>

          <Card className="p-6">
            <CardContent className="p-0 space-y-4">
              {/* Username */}
              <div className="space-y-2">
                <Label htmlFor="username">
                  Username <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="johndoe"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isSaving}
                  data-testid="input-username"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  At least 3 characters. This will be your login name.
                </p>
              </div>

              {/* Email (optional) */}
              <div className="space-y-2">
                <Label htmlFor="email">Email (optional)</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSaving}
                  data-testid="input-email"
                />
                <p className="text-xs text-muted-foreground">
                  For password recovery and notifications.
                </p>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password">
                  Password <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isSaving}
                    data-testid="input-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    data-testid="toggle-password-visibility"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  At least 6 characters.
                </p>
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">
                  Confirm Password <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isSaving}
                    data-testid="input-confirm-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    data-testid="toggle-confirm-password-visibility"
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {formError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-md">
                  <p className="text-sm text-red-600 dark:text-red-400" data-testid="form-error">
                    {formError}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* SUBMIT */}
      {selectedIndustry && (
        <div className="pt-4 border-t border-border flex items-center justify-between gap-4">
          <div className="text-sm text-muted-foreground">
            Your account will be created and you&apos;ll be logged in automatically.
          </div>
          <Button
            size="lg"
            disabled={!selectedIndustry || isSaving}
            onClick={handleSubmit}
            data-testid="button-create-account"
          >
            {isSaving ? "Creating Account..." : "Create Account & Continue"}
          </Button>
        </div>
      )}

      {/* DEBUG PANEL (Phase 8B visual) */}
      {debugPayload && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-2">
            Phase 8B debug payload (sent to server)
          </h3>
          <pre className="text-xs bg-black/40 rounded-md p-4 overflow-x-auto">
{JSON.stringify(debugPayload, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
