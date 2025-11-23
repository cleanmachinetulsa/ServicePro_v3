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
import { useToast } from "@/hooks/use-toast";
import { INDUSTRY_PACKS } from "@/config/industryPacks";

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

  const handleToggle = (name: string) => {
    setPhotoToggles((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const handleSubmit = async () => {
    if (!selectedIndustry) return;

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
      const resp = await fetch("/api/onboarding/industry", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await resp.json().catch(() => ({}));

      if (!resp.ok || !data?.success) {
        throw new Error(data?.message || "Failed to save industry selection");
      }

      setDebugPayload({
        sent: payload,
        serverResponse: data,
      });

      toast({
        title: "Industry saved",
        description: data.persisted 
          ? "Your industry selection has been saved. Redirecting to dashboard..."
          : "Your industry selection was logged (no tenant context).",
      });

      // Redirect to dashboard after successful save
      setTimeout(() => {
        navigate("/dashboard");
      }, 1500);
    } catch (err: any) {
      console.error("[OnboardingIndustry] Save error:", err);
      toast({
        title: "Save failed",
        description:
          err?.message ||
          "There was a problem sending your selection to the server.",
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

      {/* SUBMIT */}
      <div className="pt-4 border-t border-border flex items-center justify-between gap-4">
        <div className="text-sm text-muted-foreground">
          You can change this later in admin settings. This just gives you a
          smart starting point.
        </div>
        <Button
          size="lg"
          disabled={!selectedIndustry || isSaving}
          onClick={handleSubmit}
          data-testid="button-save-continue"
        >
          {isSaving ? "Saving..." : "Save & Continue"}
        </Button>
      </div>

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
