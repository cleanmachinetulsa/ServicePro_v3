import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, CheckCircle, PlayIcon, StopCircle } from 'lucide-react';

export default function DemoMode() {
  const [demoModeEnabled, setDemoModeEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Check if demo mode is enabled on component mount
  useEffect(() => {
    const checkDemoMode = async () => {
      try {
        const response = await fetch('/api/demo-mode');
        const data = await response.json();
        
        if (data.success) {
          setDemoModeEnabled(data.demoMode);
        }
      } catch (error) {
        console.error('Error checking demo mode:', error);
      }
    };
    
    checkDemoMode();
  }, []);

  // Toggle demo mode on/off
  const toggleDemoMode = async () => {
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/toggle-demo-mode', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enabled: !demoModeEnabled }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setDemoModeEnabled(data.demoMode);
        
        toast({
          title: data.demoMode ? "Demo Mode Activated" : "Demo Mode Deactivated",
          description: data.demoMode 
            ? "The system is now in demo mode. No real messages will be sent."
            : "The system is now in production mode. Real messages will be sent.",
          variant: data.demoMode ? "default" : "destructive",
        });
      } else {
        throw new Error(data.message || 'Failed to toggle demo mode');
      }
    } catch (error) {
      console.error('Error toggling demo mode:', error);
      
      toast({
        title: "Error",
        description: "Failed to toggle demo mode. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Demonstration Mode
          {demoModeEnabled ? (
            <Badge variant="outline" className="bg-blue-100 text-blue-800 hover:bg-blue-100">
              <PlayIcon className="h-3 w-3 mr-1" /> Demo Active
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-green-100 text-green-800 hover:bg-green-100">
              <CheckCircle className="h-3 w-3 mr-1" /> Production Mode
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Enable demo mode to showcase the agent's capabilities without affecting real customer data
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Switch 
              id="demo-mode-toggle" 
              checked={demoModeEnabled}
              disabled={isLoading}
              onCheckedChange={toggleDemoMode}
            />
            <Label htmlFor="demo-mode-toggle" className="text-sm font-medium">
              {demoModeEnabled ? "Demo Mode Enabled" : "Demo Mode Disabled"}
            </Label>
          </div>
          
          {demoModeEnabled && (
            <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-800">
              <div className="flex items-start">
                <AlertCircle className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Demo Mode is active</p>
                  <ul className="mt-2 list-disc list-inside space-y-1">
                    <li>No real SMS messages will be sent</li>
                    <li>No real emails will be sent</li>
                    <li>Demo customer data is being used</li>
                    <li>Calendar events will not be created</li>
                    <li>Weather alerts are simulated</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open('/documentation.pdf', '_blank')}
        >
          View Documentation
        </Button>
        
        <Button
          variant={demoModeEnabled ? "destructive" : "default"}
          size="sm"
          disabled={isLoading}
          onClick={toggleDemoMode}
        >
          {isLoading ? (
            <>
              <div className="animate-spin mr-2 h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
              Processing...
            </>
          ) : demoModeEnabled ? (
            <>
              <StopCircle className="mr-2 h-4 w-4" />
              Disable Demo Mode
            </>
          ) : (
            <>
              <PlayIcon className="mr-2 h-4 w-4" />
              Enable Demo Mode
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}