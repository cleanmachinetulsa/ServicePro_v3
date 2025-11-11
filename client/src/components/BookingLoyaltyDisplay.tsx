import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

interface LoyaltyDisplayProps {
  phoneNumber: string;
  selectedService: string;
  selectedAddOns: string[];
  vehicleConditions: string[];
  estimatedPrice: number;
  pointsEarningRate?: number; // Points per dollar (default is 1)
}

interface LoyaltyInfo {
  customer: {
    name: string;
    loyaltyProgramOptIn: boolean;
  };
  loyaltyPoints: {
    points: number;
    expiryDate?: string;
  } | null;
  transactions?: any[];
}

export default function BookingLoyaltyDisplay({
  phoneNumber,
  selectedService,
  selectedAddOns,
  vehicleConditions,
  estimatedPrice,
  pointsEarningRate = 1
}: LoyaltyDisplayProps) {
  const [loyaltyInfo, setLoyaltyInfo] = useState<LoyaltyInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pointsToEarn, setPointsToEarn] = useState(0);
  const { toast } = useToast();

  // Format phone number for API call (remove non-digits)
  const formattedPhone = phoneNumber.replace(/\D/g, '');

  // Fetch loyalty information when phone number is available
  useEffect(() => {
    async function fetchLoyaltyInfo() {
      if (!formattedPhone || formattedPhone.length < 10) return;
      
      setIsLoading(true);
      try {
        const response = await fetch(`/api/loyalty/points/phone/${formattedPhone}`);
        
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setLoyaltyInfo(data.data);
          } else {
            // Customer not found or not in loyalty program - that's okay
            setLoyaltyInfo(null);
          }
        } else {
          // Handle API errors
          console.error('Error fetching loyalty information');
        }
      } catch (error) {
        console.error('Error fetching loyalty data:', error);
      } finally {
        setIsLoading(false);
      }
    }

    if (formattedPhone) {
      fetchLoyaltyInfo();
    }
  }, [formattedPhone]);

  // Calculate points that will be earned from this service
  useEffect(() => {
    if (estimatedPrice > 0) {
      // Default earning rate: 1 point per dollar spent
      setPointsToEarn(Math.floor(estimatedPrice * pointsEarningRate));
    } else {
      setPointsToEarn(0);
    }
  }, [estimatedPrice, pointsEarningRate]);

  // If no phone number or invalid phone, don't display anything
  if (!formattedPhone || formattedPhone.length < 10) {
    return null;
  }

  return (
    <Card className="bg-muted/50 border-dashed border-muted-foreground/50 my-4">
      <CardContent className="pt-4">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <h4 className="font-medium">Clean Machine Loyalty</h4>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : loyaltyInfo && loyaltyInfo.customer ? (
              <Badge variant="outline" className="bg-blue-100 text-blue-800">
                {loyaltyInfo.loyaltyPoints ? `${loyaltyInfo.loyaltyPoints.points} points` : "Enrolled"}
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-gray-100">Not Enrolled</Badge>
            )}
          </div>

          <Separator className="my-2" />

          {loyaltyInfo && loyaltyInfo.customer ? (
            <div className="space-y-1 text-sm">
              <p className="text-muted-foreground">
                Welcome back, {loyaltyInfo.customer.name}!
              </p>
              
              {loyaltyInfo.loyaltyPoints && (
                <p>
                  Current balance: <span className="font-semibold">{loyaltyInfo.loyaltyPoints.points} points</span>
                </p>
              )}
              
              <p className="text-green-600 font-medium">
                You'll earn <span className="font-bold">{pointsToEarn}</span> points from this service!
              </p>
              
              {loyaltyInfo.loyaltyPoints && loyaltyInfo.loyaltyPoints.expiryDate && (
                <p className="text-xs text-muted-foreground">
                  Points expire: {new Date(loyaltyInfo.loyaltyPoints.expiryDate).toLocaleDateString()}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-1 text-sm">
              <p>You're not enrolled in our loyalty program yet.</p>
              <p className="text-green-600">
                Join today and earn <span className="font-bold">{pointsToEarn}</span> points from this service!
              </p>
              <p className="text-xs text-muted-foreground">
                We'll automatically enroll you when you book your first appointment.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}