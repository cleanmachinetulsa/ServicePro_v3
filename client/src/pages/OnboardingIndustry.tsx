// src/pages/OnboardingIndustry.tsx
import { useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch as Toggle } from "@/components/ui/switch";

const INDUSTRIES = [
  { id: "auto-detailing", name: "Mobile Auto Detailing" },
  { id: "lawn-care", name: "Lawn Care" },
  { id: "house-cleaning", name: "House Cleaning" },
  { id: "pressure-washing", name: "Pressure Washing" },
  { id: "mobile-mechanic", name: "Mobile Mechanic" },
  { id: "pool-service", name: "Pool Service" },
  { id: "handyman", name: "Handyman Services" },
  { id: "pest-control", name: "Pest Control" },
  { id: "window-cleaning", name: "Window Cleaning" },
  { id: "pet-grooming", name: "Pet Grooming" },
  { id: "photography", name: "Photography & Media Studio" }, // mega pack
];

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
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);
  const [photoToggles, setPhotoToggles] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(PHOTOGRAPHY_SUBPACKS.map((p) => [p, false]))
  );

  const handleToggle = (name: string) => {
    setPhotoToggles((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const handleSubmit = () => {
    const payload = {
      industry: selectedIndustry,
      photoOptions:
        selectedIndustry === "photography"
          ? Object.entries(photoToggles)
              .filter(([_, enabled]) => enabled)
              .map(([k]) => k)
          : [],
    };

    console.log("ONBOARDING SUBMIT →", payload);
    alert("Industry saved! Check console for payload.");
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">
        What kind of business is this?
      </h1>

      {/* INDUSTRY GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        {INDUSTRIES.map((ind) => (
          <Card
            key={ind.id}
            onClick={() => setSelectedIndustry(ind.id)}
            className={`cursor-pointer transition ${
              selectedIndustry === ind.id ? "ring-2 ring-blue-500" : ""
            }`}
            data-testid={`industry-${ind.id}`}
          >
            <CardHeader>
              <CardTitle>{ind.name}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      {/* PHOTOGRAPHY SUBPACKS */}
      {selectedIndustry === "photography" && (
        <div className="mb-10">
          <h2 className="text-2xl font-semibold mb-4">
            What types of photography do you offer?
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {PHOTOGRAPHY_SUBPACKS.map((sub) => (
              <Card key={sub} className="p-4 flex justify-between items-center" data-testid={`photo-option-${sub.replace(/\s+/g, '-').toLowerCase()}`}>
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
      {selectedIndustry && (
        <Button size="lg" onClick={handleSubmit} data-testid="button-save-continue">
          Save & Continue
        </Button>
      )}
    </div>
  );
}
