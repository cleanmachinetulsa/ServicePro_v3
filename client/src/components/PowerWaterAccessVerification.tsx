import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { Info, CheckCircle, AlertCircle, Droplets, Zap } from "lucide-react";

interface PowerWaterAccessVerificationProps {
  onConfirm: (accessInfo: AccessInfo) => void;
  onBack: () => void;
  locationType?: string; // "apartment", "business", "house", etc.
}

export interface AccessInfo {
  hasPowerAccess: boolean;
  hasWaterAccess: boolean;
  locationType: string;
  needsExteriorService: boolean;
  notes: string;
}

export default function PowerWaterAccessVerification({
  onConfirm,
  onBack,
  locationType = "residence"
}: PowerWaterAccessVerificationProps) {
  const [needsExteriorService, setNeedsExteriorService] = useState<boolean | null>(null);
  const [hasPowerAccess, setHasPowerAccess] = useState<boolean | null>(null);
  const [hasWaterAccess, setHasWaterAccess] = useState<boolean | null>(null);
  const [locationTypeState, setLocationTypeState] = useState<string>(locationType);
  const [notes, setNotes] = useState<string>("");
  const { toast } = useToast();

  // Handle form submission
  const handleSubmit = () => {
    // Validate that all required fields are filled
    if (needsExteriorService === null) {
      toast({
        title: "Required Field",
        description: "Please select whether you need exterior service.",
        variant: "destructive",
      });
      return;
    }

    if (hasPowerAccess === null) {
      toast({
        title: "Required Field",
        description: "Please indicate if power is available.",
        variant: "destructive",
      });
      return;
    }

    // Only require water access if exterior service is needed
    if (needsExteriorService && hasWaterAccess === null) {
      toast({
        title: "Required Field",
        description: "Please indicate if water is available for your exterior service.",
        variant: "destructive",
      });
      return;
    }

    onConfirm({
      hasPowerAccess: hasPowerAccess === true,
      hasWaterAccess: needsExteriorService ? hasWaterAccess === true : false,
      locationType: locationTypeState,
      needsExteriorService: needsExteriorService === true,
      notes
    });
  };

  return (
    <div className="w-full space-y-6">
      <div className="text-center pb-4 border-b border-blue-400/10">
        <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-200 via-blue-400 to-blue-200">
          Service Requirements
        </h3>
        <p className="text-sm text-blue-200/60 mt-2">
          Let's verify we can provide service at your location
        </p>
      </div>

      <div className="space-y-6">
        {/* Exterior Service Question */}
        <div className="space-y-3">
          <Label className="text-base text-blue-100">Do you need exterior detailing service?</Label>
          <RadioGroup 
            onValueChange={(value) => setNeedsExteriorService(value === "yes")}
            className="flex flex-col space-y-2"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="yes" id="exterior-yes" className="border-blue-400/40" />
              <Label htmlFor="exterior-yes" className="font-normal text-blue-100">Yes, I need exterior cleaning</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="no" id="exterior-no" className="border-blue-400/40" />
              <Label htmlFor="exterior-no" className="font-normal text-blue-100">No, interior service only</Label>
            </div>
          </RadioGroup>
        </div>

        {/* Power Access Question */}
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Label className="text-base text-blue-100">Is there a power outlet available?</Label>
            <div className="text-blue-400">
              <Zap size={16} />
            </div>
          </div>
          <p className="text-sm text-blue-200/60 mb-2">
            We need a standard 110v outlet within 100ft of your vehicle. I bring 100ft extensions and can run power through doors/windows if needed.
          </p>
          <RadioGroup 
            onValueChange={(value) => setHasPowerAccess(value === "yes")}
            className="flex flex-col space-y-2"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="yes" id="power-yes" className="border-blue-400/40" />
              <Label htmlFor="power-yes" className="font-normal text-blue-100">Yes, power is available</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="no" id="power-no" className="border-blue-400/40" />
              <Label htmlFor="power-no" className="font-normal text-blue-100">No, I'm unsure about power</Label>
            </div>
          </RadioGroup>
          
          {/* Power alternatives information */}
          {hasPowerAccess === false && (
            <div className="mt-2 p-3 bg-blue-50 rounded-md text-sm text-blue-700 dark:bg-blue-950 dark:text-blue-200">
              <div className="flex items-start">
                <Info className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                <div>
                  No problem! For apartments, condos, or tight spaces, I can run my power cable through a door or window. Just mention this in the notes below so I know what to expect.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Water Access Question - only show if exterior service is needed */}
        {needsExteriorService && (
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Label className="text-base">Is there a water spigot/hose connection available?</Label>
              <div className="text-blue-500">
                <Droplets size={16} />
              </div>
            </div>
            <CardDescription className="text-sm text-muted-foreground mb-2">
              For exterior services, we need access to a water spigot within 100ft of your vehicle.
            </CardDescription>
            <RadioGroup 
              onValueChange={(value) => setHasWaterAccess(value === "yes")}
              className="flex flex-col space-y-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id="water-yes" />
                <Label htmlFor="water-yes" className="font-normal">Yes, water access is available</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id="water-no" />
                <Label htmlFor="water-no" className="font-normal">No, I'm unsure about water access</Label>
              </div>
            </RadioGroup>
            
            {/* Water availability information */}
            {hasWaterAccess === false && (
              <div className="mt-2 p-3 bg-amber-50 rounded-md text-sm text-amber-700 dark:bg-amber-950 dark:text-amber-200">
                <div className="flex items-start">
                  <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                  <div>
                    {locationTypeState === "apartment" || locationTypeState === "condo" 
                      ? "For apartments or condos, please check with building maintenance if there's a water spigot you can use."
                      : locationTypeState === "business"
                      ? "For business locations, you might need to check with the facilities manager for water access."
                      : "Water access is required for exterior services. Please check if a spigot is available or add details below."}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Location Type Selection */}
        <div className="space-y-3">
          <Label className="text-base">Location Type</Label>
          <RadioGroup 
            value={locationTypeState}
            onValueChange={setLocationTypeState}
            className="flex flex-col space-y-2"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="house" id="loc-house" />
              <Label htmlFor="loc-house" className="font-normal">House</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="apartment" id="loc-apartment" />
              <Label htmlFor="loc-apartment" className="font-normal">Apartment/Condo</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="business" id="loc-business" />
              <Label htmlFor="loc-business" className="font-normal">Business/Workplace</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="other" id="loc-other" />
              <Label htmlFor="loc-other" className="font-normal">Other</Label>
            </div>
          </RadioGroup>
        </div>

        {/* Notes field */}
        <div className="space-y-3">
          <Label htmlFor="notes" className="text-base">Additional Notes</Label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any details about power/water access or special circumstances."
            className="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
        
        {/* Results summary box */}
        {((needsExteriorService && hasWaterAccess !== null) || (!needsExteriorService)) && hasPowerAccess !== null && (
          <div className="p-4 bg-gray-50 rounded-md dark:bg-gray-900">
            <h3 className="font-medium mb-2 flex items-center">
              <CheckCircle className="h-5 w-5 mr-2 text-green-500" />
              Service Requirements Summary
            </h3>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center">
                <Zap className="h-4 w-4 mr-2 text-blue-500" />
                Power: {hasPowerAccess ? "Available ✓" : "Verification needed"}
              </li>
              {needsExteriorService && (
                <li className="flex items-center">
                  <Droplets className="h-4 w-4 mr-2 text-blue-500" />
                  Water: {hasWaterAccess ? "Available ✓" : "Verification needed"}
                </li>
              )}
              {!needsExteriorService && (
                <li className="flex items-center">
                  <Droplets className="h-4 w-4 mr-2 text-gray-500" />
                  Water: Not required for interior-only service
                </li>
              )}
              <li className="text-xs mt-2 text-gray-500">
                Note: Our technicians bring 100ft extensions for both water and power.
              </li>
            </ul>
          </div>
        )}

        <div className="flex justify-between pt-4">
          <Button
            variant="outline"
            onClick={onBack}
            className="border-blue-400/40 text-blue-200 hover:bg-blue-500/20"
          >
            Back
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              needsExteriorService === null || 
              hasPowerAccess === null || 
              (needsExteriorService && hasWaterAccess === null)
            }
            className="bg-blue-600 hover:bg-blue-700"
          >
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
}