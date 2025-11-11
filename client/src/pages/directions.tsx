import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";

export default function DirectionsPage() {
  const [location, setLocation] = useLocation();
  const [address, setAddress] = useState<string>("");
  const [estimatedTime, setEstimatedTime] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const { toast } = useToast();
  
  // Parse the address from the URL query parameter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const addressParam = params.get("address");
    if (addressParam) {
      setAddress(decodeURIComponent(addressParam));
    }
    
    const phoneParam = params.get("phone");
    if (phoneParam) {
      setCustomerPhone(phoneParam);
    }
  }, []);
  
  // Function to open the address in the maps app
  const openInMaps = () => {
    if (!address) {
      toast({
        title: "Missing Address",
        description: "Please enter a destination address",
        variant: "destructive",
      });
      return;
    }
    
    // Create a maps URL that works on both iOS and Android
    const mapsUrl = `https://maps.google.com/maps?daddr=${encodeURIComponent(address)}`;
    
    // Open the maps app
    window.open(mapsUrl, "_blank");
  };
  
  // Function to get estimated travel time and send on-the-way notification
  const getEstimatedTimeAndNotify = async () => {
    if (!address) {
      toast({
        title: "Missing Address",
        description: "Please enter a destination address",
        variant: "destructive",
      });
      return;
    }
    
    if (!customerPhone) {
      toast({
        title: "Missing Phone Number",
        description: "Please enter the customer's phone number",
        variant: "destructive",
      });
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Get the current location
      const position = await getCurrentPosition();
      const { latitude, longitude } = position.coords;
      
      // Call the API to get travel time
      const response = await fetch('/api/calculate-travel-time', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          origin: `${latitude},${longitude}`,
          destination: address,
          customerPhone: customerPhone,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to calculate travel time');
      }
      
      const data = await response.json();
      
      if (data.success) {
        setEstimatedTime(data.durationMinutes);
        
        toast({
          title: "Notification Sent",
          description: `Customer notified. Estimated arrival: ${data.durationMinutes}-${data.durationMinutes + 10} minutes`,
        });
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err: any) {
      console.error('Error:', err);
      setError(err.message || 'An error occurred');
      toast({
        title: "Error",
        description: err.message || 'Failed to calculate travel time and send notification',
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Get the current device location
  const getCurrentPosition = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser'));
        return;
      }
      
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      });
    });
  };
  
  return (
    <div className="container mx-auto py-8 px-4">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-500 text-white">
          <div className="flex items-center justify-between">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setLocation('/dashboard')}
              className="text-white hover:bg-blue-700 -ml-2"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <CardTitle className="text-xl font-bold">Service Navigation</CardTitle>
            <div className="w-16"></div>
          </div>
        </CardHeader>
        
        <CardContent className="p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="address">Destination Address</Label>
            <Input
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Enter destination address"
              className="w-full"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="phone">Customer Phone</Label>
            <Input
              id="phone"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="Enter customer phone number"
              className="w-full"
            />
          </div>
          
          <div className="pt-4 space-y-4">
            <Button 
              className="w-full bg-blue-600 hover:bg-blue-700"
              onClick={openInMaps}
            >
              Open in Maps
            </Button>
            
            <Separator className="my-4" />
            
            <Button 
              className="w-full bg-green-600 hover:bg-green-700"
              onClick={getEstimatedTimeAndNotify}
              disabled={isLoading}
            >
              {isLoading ? "Calculating..." : "Notify Customer I'm On The Way"}
            </Button>
            
            {estimatedTime !== null && (
              <div className="text-center mt-4 p-4 bg-blue-50 rounded-md">
                <p className="font-medium">Estimated travel time: {estimatedTime} minutes</p>
                <p className="text-sm text-gray-600">Customer was notified of {estimatedTime}-{estimatedTime + 10} minute arrival window</p>
              </div>
            )}
            
            {error && (
              <div className="text-center mt-4 p-4 bg-red-50 text-red-600 rounded-md">
                {error}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}