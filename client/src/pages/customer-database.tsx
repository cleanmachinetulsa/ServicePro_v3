import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import CustomerSearch from "@/components/CustomerSearch";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  BarChart, 
  Trash2, 
  Users, 
  Calendar, 
  Car, 
  Clock, 
  AlertCircle, 
  CheckCircle,
  Loader2
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface PhotoCleanupResult {
  success: boolean;
  deletedCount: number;
  errorCount: number;
  processedPhotos: number;
}

const CustomerDatabasePage = () => {
  const { toast } = useToast();
  const [cleanupMonths, setCleanupMonths] = useState(6);
  const [isCleanupDialogOpen, setIsCleanupDialogOpen] = useState(false);

  // Query to fetch customer statistics
  const customerStatsQuery = useQuery({
    queryKey: ['/api/customers/stats'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/customers');
        if (!response.ok) {
          throw new Error('Failed to fetch customer data');
        }
        const data = await response.json();
        const customers = data.customers || [];
        
        // Calculate basic statistics
        return {
          totalCustomers: customers.length,
          repeatCustomers: customers.filter((c: any) => c.serviceHistory?.length > 1).length,
          vehicleTypes: calculateVehicleTypes(customers),
          servicePreferences: calculateServicePreferences(customers),
          customersByMonth: calculateCustomersByMonth(customers)
        };
      } catch (error) {
        console.error('Error fetching customer stats:', error);
        return {
          totalCustomers: 0,
          repeatCustomers: 0,
          vehicleTypes: {},
          servicePreferences: {},
          customersByMonth: {}
        };
      }
    }
  });

  // Mutation for triggering photo cleanup
  const cleanupMutation = useMutation({
    mutationFn: async (months: number): Promise<PhotoCleanupResult> => {
      const response = await apiRequest(
        "POST", 
        "/api/photos/cleanup", 
        { thresholdMonths: months }
      );
      
      if (!response.ok) {
        throw new Error('Failed to clean up photos');
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Photo Cleanup Complete",
        description: `Processed ${data.processedPhotos} photos, deleted ${data.deletedCount} older than ${cleanupMonths} months.`,
        variant: data.success ? "default" : "destructive",
      });
      setIsCleanupDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Photo Cleanup Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handlePhotoCleanup = () => {
    cleanupMutation.mutate(cleanupMonths);
  };

  // Helper functions for statistics calculations
  function calculateVehicleTypes(customers: any[]) {
    const types: Record<string, number> = {};
    
    customers.forEach(customer => {
      if (!customer.vehicleInfo) return;
      
      const vehicleInfo = customer.vehicleInfo.toLowerCase();
      
      if (vehicleInfo.includes('suv')) {
        types['SUV'] = (types['SUV'] || 0) + 1;
      } else if (vehicleInfo.includes('truck')) {
        types['Truck'] = (types['Truck'] || 0) + 1;
      } else if (vehicleInfo.includes('sedan')) {
        types['Sedan'] = (types['Sedan'] || 0) + 1;
      } else if (vehicleInfo.includes('coupe')) {
        types['Coupe'] = (types['Coupe'] || 0) + 1;
      } else {
        types['Other'] = (types['Other'] || 0) + 1;
      }
    });
    
    return types;
  }
  
  function calculateServicePreferences(customers: any[]) {
    const services: Record<string, number> = {};
    
    customers.forEach(customer => {
      if (!customer.selectedServices) return;
      
      const selectedServices = customer.selectedServices.toLowerCase();
      
      if (selectedServices.includes('full detail')) {
        services['Full Detail'] = (services['Full Detail'] || 0) + 1;
      } else if (selectedServices.includes('interior')) {
        services['Interior Only'] = (services['Interior Only'] || 0) + 1;
      } else if (selectedServices.includes('exterior')) {
        services['Exterior Only'] = (services['Exterior Only'] || 0) + 1;
      } else if (selectedServices.includes('express')) {
        services['Express Wash'] = (services['Express Wash'] || 0) + 1;
      } else {
        services['Other Services'] = (services['Other Services'] || 0) + 1;
      }
    });
    
    return services;
  }
  
  function calculateCustomersByMonth(customers: any[]) {
    const months: Record<string, number> = {};
    const currentYear = new Date().getFullYear();
    
    // Initialize months
    ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      .forEach(month => {
        months[month] = 0;
      });
    
    customers.forEach(customer => {
      if (!customer.lastContact) return;
      
      try {
        const contactDate = new Date(customer.lastContact);
        
        // Only count current year
        if (contactDate.getFullYear() === currentYear) {
          const monthName = contactDate.toLocaleString('default', { month: 'short' });
          months[monthName] = (months[monthName] || 0) + 1;
        }
      } catch (e) {
        // Skip invalid dates
      }
    });
    
    return months;
  }

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">Customer Database</h1>
      
      <Tabs defaultValue="search">
        <TabsList className="mb-6">
          <TabsTrigger value="search" className="flex items-center">
            <Users className="mr-2 h-4 w-4" />
            Customer Search
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="flex items-center">
            <BarChart className="mr-2 h-4 w-4" />
            Dashboard
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="search">
          <CustomerSearch />
        </TabsContent>
        
        <TabsContent value="dashboard">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {customerStatsQuery.isLoading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    customerStatsQuery.data?.totalCustomers || 0
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Lifetime customer count
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Repeat Customers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {customerStatsQuery.isLoading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    customerStatsQuery.data?.repeatCustomers || 0
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Customers with multiple services
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Most Common Vehicle</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold flex items-center">
                  {customerStatsQuery.isLoading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    getMostCommon(customerStatsQuery.data?.vehicleTypes || {}) || "N/A"
                  )}
                  <Car className="ml-2 h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Most frequently serviced type
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Popular Service</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {customerStatsQuery.isLoading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    getMostCommon(customerStatsQuery.data?.servicePreferences || {}) || "N/A"
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Most requested service
                </p>
              </CardContent>
            </Card>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Customer Activity</CardTitle>
                <CardDescription>
                  Monthly customer activity for the current year
                </CardDescription>
              </CardHeader>
              <CardContent>
                {customerStatsQuery.isLoading ? (
                  <div className="h-[300px] flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : (
                  <div className="h-[300px] flex items-end justify-between">
                    {Object.entries(customerStatsQuery.data?.customersByMonth || {}).map(([month, count]) => (
                      <div key={month} className="flex flex-col items-center space-y-2">
                        <div className="w-12 bg-primary rounded-t-md" 
                             style={{ 
                               height: `${Math.max(20, (count / (Math.max(...Object.values(customerStatsQuery.data?.customersByMonth || {})) || 1)) * 250)}px` 
                             }}>
                        </div>
                        <span className="text-xs font-medium">{month}</span>
                        <span className="text-xs text-muted-foreground">{count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Photo Management</CardTitle>
                <CardDescription>
                  Manage customer photos stored in Google Drive
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm">
                  Customer photos older than 6 months can be automatically cleaned up to save storage space.
                </p>
                
                <div className="rounded-md bg-muted p-4">
                  <div className="flex items-center space-x-4">
                    <Clock className="h-6 w-6 text-muted-foreground" />
                    <div>
                      <h4 className="text-sm font-semibold">Scheduled Cleanup</h4>
                      <p className="text-xs text-muted-foreground">
                        Photos are automatically cleaned up every 7 days
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Dialog open={isCleanupDialogOpen} onOpenChange={setIsCleanupDialogOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => setIsCleanupDialogOpen(true)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Run Manual Cleanup
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>Clean Up Old Photos</DialogTitle>
                      <DialogDescription>
                        This will permanently delete customer photos older than the specified number of months.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="months">Age threshold (months)</Label>
                        <Input
                          id="months"
                          type="number"
                          value={cleanupMonths}
                          onChange={(e) => setCleanupMonths(parseInt(e.target.value) || 6)}
                          min={1}
                          max={24}
                        />
                        <p className="text-xs text-muted-foreground">
                          Photos older than {cleanupMonths} months will be deleted
                        </p>
                      </div>
                      <div className="rounded-md bg-amber-50 p-3 text-amber-800 text-sm">
                        <div className="flex items-start">
                          <AlertCircle className="h-4 w-4 mr-2 mt-0.5" />
                          <div>
                            <p className="font-medium">Warning</p>
                            <p className="text-xs mt-1">
                              This action cannot be undone. Deleted photos cannot be recovered.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button 
                        variant="outline" 
                        onClick={() => setIsCleanupDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button 
                        variant="destructive"
                        onClick={handlePhotoCleanup}
                        disabled={cleanupMutation.isPending}
                      >
                        {cleanupMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Cleaning...
                          </>
                        ) : (
                          <>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Old Photos
                          </>
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardFooter>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Helper function to get the most common item from an object of counts
function getMostCommon(countObject: Record<string, number>): string {
  if (Object.keys(countObject).length === 0) return "";
  
  return Object.entries(countObject)
    .sort((a, b) => b[1] - a[1])
    [0][0];
}

export default CustomerDatabasePage;