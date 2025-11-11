import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface VehicleInfo {
  make: string;
  model: string;
  year: string;
  color: string;
  conditions: string[];
}

interface PriceCalculatorProps {
  selectedService: string;
  selectedAddOns: string[];
  vehicles: VehicleInfo[];
  basePriceEstimate: number;
  addOnPrices: Record<string, number>;
  conditionPrices: Record<string, number>;
}

export default function BookingPriceCalculator({
  selectedService,
  selectedAddOns,
  vehicles,
  basePriceEstimate,
  addOnPrices,
  conditionPrices
}: PriceCalculatorProps) {
  const [totalPrice, setTotalPrice] = useState(0);
  const [breakdownItems, setBreakdownItems] = useState<Array<{
    name: string;
    price: number;
    type: 'service' | 'addon' | 'condition' | 'vehicle' | 'discount';
  }>>([]);

  // Calculate price whenever inputs change
  useEffect(() => {
    if (!selectedService) {
      setTotalPrice(0);
      setBreakdownItems([]);
      return;
    }

    const newBreakdownItems: Array<{
      name: string;
      price: number;
      type: 'service' | 'addon' | 'condition' | 'vehicle' | 'discount';
    }> = [];

    // Add base service
    newBreakdownItems.push({
      name: selectedService,
      price: basePriceEstimate,
      type: 'service'
    });

    // Add add-ons
    selectedAddOns.forEach(addon => {
      if (addOnPrices[addon]) {
        newBreakdownItems.push({
          name: addon,
          price: addOnPrices[addon],
          type: 'addon'
        });
      }
    });

    // Add vehicle condition surcharges
    let vehicleIndex = 1;
    for (const vehicle of vehicles) {
      if (vehicle.make && vehicle.model) {
        // Only include complete vehicles
        const vehicleConditions = vehicle.conditions || [];
        
        // Base multiple vehicle surcharge (after first vehicle)
        if (vehicleIndex > 1) {
          newBreakdownItems.push({
            name: `Additional Vehicle (${vehicle.make} ${vehicle.model})`,
            price: Math.round(basePriceEstimate * 0.75), // 75% of base price for additional vehicles
            type: 'vehicle'
          });
        }
        
        // Add condition-based surcharges
        vehicleConditions.forEach(condition => {
          if (conditionPrices[condition]) {
            newBreakdownItems.push({
              name: `${condition} (${vehicle.make} ${vehicle.model})`,
              price: conditionPrices[condition],
              type: 'condition'
            });
          }
        });
        
        vehicleIndex++;
      }
    }

    // Calculate total
    const newTotal = newBreakdownItems.reduce((sum, item) => sum + item.price, 0);
    
    setBreakdownItems(newBreakdownItems);
    setTotalPrice(newTotal);
  }, [selectedService, selectedAddOns, vehicles, basePriceEstimate, addOnPrices, conditionPrices]);

  if (!selectedService) {
    return null;
  }

  return (
    <Card className="mt-4">
      <CardContent className="pt-4">
        <h3 className="font-medium text-lg mb-2">Price Estimate</h3>
        <Separator className="my-2" />
        
        <div className="space-y-2">
          {breakdownItems.map((item, index) => (
            <div key={index} className="flex justify-between text-sm">
              <span className={item.type === 'service' ? 'font-medium' : ''}>{item.name}</span>
              <span>${item.price}</span>
            </div>
          ))}
          
          <Separator className="my-1" />
          
          <div className="flex justify-between font-bold">
            <span>Total Estimate</span>
            <span>${totalPrice} - ${Math.round(totalPrice * 1.67)}</span>
          </div>
          
          <div className="mt-2 p-2 bg-blue-50 rounded-md">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-blue-600 font-medium">💰 Loyalty Points:</span>
              <span className="text-blue-800">Earn {totalPrice}-{Math.round(totalPrice * 1.67)} points from this booking!</span>
            </div>
            <p className="text-xs text-blue-600 mt-1">
              Points awarded based on final invoice amount (1 point per $1)
            </p>
          </div>
          
          <p className="text-xs text-muted-foreground">
            *Final price may vary based on actual vehicle condition and service requirements.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}