import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDebounce } from "@/hooks/use-debounce";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Phone, Mail, Car, MapPin, Calendar, History } from "lucide-react";

interface CustomerRecord {
  id: string;
  email: string;
  name: string;
  phone: string;
  address: string;
  vehicleInfo: string;
  selectedServices: string;
  selectedAddOns: string;
  vehicleCondition: string;
  notes: string;
  lastContact: string;
  photoFolder: string;
  [key: string]: string;
}

interface ServiceHistory {
  service: string;
  date: string;
  vehicle: string;
}

const CustomerSearch = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchField, setSearchField] = useState("all");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRecord | null>(null);
  const debouncedSearchQuery = useDebounce(searchQuery, 500);
  const { toast } = useToast();

  // Fetch all customers when no search is active
  const allCustomersQuery = useQuery({
    queryKey: ['/api/customers'],
    queryFn: async () => {
      const response = await fetch('/api/customers?limit=50');
      if (!response.ok) {
        throw new Error('Failed to fetch customers');
      }
      const data = await response.json();
      return data.customers as CustomerRecord[];
    },
    enabled: !debouncedSearchQuery
  });

  // Search customers based on search terms
  const searchCustomersQuery = useQuery({
    queryKey: ['/api/customers/search', debouncedSearchQuery, searchField],
    queryFn: async () => {
      const response = await fetch(`/api/customers/search?query=${encodeURIComponent(debouncedSearchQuery)}&field=${searchField}`);
      if (!response.ok) {
        throw new Error('Failed to search customers');
      }
      const data = await response.json();
      return data.results as CustomerRecord[];
    },
    enabled: debouncedSearchQuery.length > 0
  });

  // Get customer details including service history
  const customerDetailsQuery = useQuery({
    queryKey: ['/api/customers', selectedCustomer?.phone],
    queryFn: async () => {
      if (!selectedCustomer?.phone) {
        throw new Error('No customer selected');
      }
      const response = await fetch(`/api/customers/${encodeURIComponent(selectedCustomer.phone)}`);
      if (!response.ok) {
        throw new Error('Failed to fetch customer details');
      }
      const data = await response.json();
      return {
        customer: data.customer as CustomerRecord,
        serviceHistory: data.serviceHistory as ServiceHistory[]
      };
    },
    enabled: !!selectedCustomer
  });

  const customers = debouncedSearchQuery 
    ? searchCustomersQuery.data || [] 
    : allCustomersQuery.data || [];
  
  const isLoading = debouncedSearchQuery 
    ? searchCustomersQuery.isLoading 
    : allCustomersQuery.isLoading;

  const handleCustomerSelect = (customer: CustomerRecord) => {
    setSelectedCustomer(customer);
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">Customer Database</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Search Customers</CardTitle>
              <CardDescription>
                Find customers by name, phone, email, or vehicle details
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col space-y-4">
                <div className="flex space-x-2">
                  <Input
                    placeholder="Search customers..."
                    value={searchQuery}
                    onChange={handleSearch}
                    className="flex-1"
                  />
                  <Select value={searchField} onValueChange={setSearchField}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Search in..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Fields</SelectItem>
                      <SelectItem value="name">Name</SelectItem>
                      <SelectItem value="phone">Phone</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="vehicle">Vehicle</SelectItem>
                      <SelectItem value="address">Address</SelectItem>
                      <SelectItem value="service">Service</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="border rounded-md">
                  <div className="p-3 bg-muted font-medium">
                    Results ({isLoading ? "..." : customers.length})
                  </div>
                  <div className="max-h-[400px] overflow-y-auto">
                    {isLoading ? (
                      <div className="p-4 space-y-3">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="flex items-center space-x-4">
                            <Skeleton className="h-12 w-12 rounded-full" />
                            <div className="space-y-2">
                              <Skeleton className="h-4 w-[200px]" />
                              <Skeleton className="h-4 w-[160px]" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : customers.length === 0 ? (
                      <div className="p-4 text-center text-muted-foreground">
                        {debouncedSearchQuery 
                          ? "No customers found matching your search." 
                          : "No customers in database."}
                      </div>
                    ) : (
                      <div className="divide-y">
                        {customers.map((customer) => (
                          <div
                            key={customer.id || customer.phone}
                            className={`p-3 cursor-pointer hover:bg-muted transition-colors ${
                              selectedCustomer?.phone === customer.phone
                                ? "bg-muted"
                                : ""
                            }`}
                            onClick={() => handleCustomerSelect(customer)}
                          >
                            <div className="font-medium">{customer.name || "Unnamed Customer"}</div>
                            <div className="text-sm text-muted-foreground flex items-center gap-1">
                              <Phone className="h-3 w-3" /> 
                              {customer.phone || "No phone"}
                            </div>
                            {customer.vehicleInfo && (
                              <div className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                                <Car className="h-3 w-3" /> 
                                {customer.vehicleInfo}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div className="lg:col-span-2">
          {!selectedCustomer ? (
            <Card className="h-full flex items-center justify-center p-6">
              <div className="text-center text-muted-foreground">
                <div className="text-lg font-medium mb-2">No Customer Selected</div>
                <p>Select a customer from the list to view their details and service history.</p>
              </div>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>{selectedCustomer.name || "Unnamed Customer"}</CardTitle>
                    <CardDescription>Customer ID: {selectedCustomer.id || "N/A"}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        if (selectedCustomer.phone) {
                          navigator.clipboard.writeText(selectedCustomer.phone);
                          toast({
                            title: "Phone copied to clipboard",
                            description: selectedCustomer.phone,
                          });
                        }
                      }}
                    >
                      <Phone className="h-4 w-4 mr-2" /> 
                      Copy Phone
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="details">
                  <TabsList className="mb-4">
                    <TabsTrigger value="details">Customer Details</TabsTrigger>
                    <TabsTrigger value="history">Service History</TabsTrigger>
                    {selectedCustomer.photoFolder && (
                      <TabsTrigger value="photos">Photos</TabsTrigger>
                    )}
                  </TabsList>
                  
                  <TabsContent value="details">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="font-medium">Contact Information</div>
                        <div className="grid grid-cols-[20px_1fr] gap-2 items-center">
                          <Phone className="h-4 w-4" />
                          <div>{selectedCustomer.phone || "No phone"}</div>
                        </div>
                        <div className="grid grid-cols-[20px_1fr] gap-2 items-center">
                          <Mail className="h-4 w-4" />
                          <div>{selectedCustomer.email || "No email"}</div>
                        </div>
                        <div className="grid grid-cols-[20px_1fr] gap-2 items-start">
                          <MapPin className="h-4 w-4 mt-1" />
                          <div>{selectedCustomer.address || "No address"}</div>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="font-medium">Vehicle Information</div>
                        <div className="grid grid-cols-[20px_1fr] gap-2 items-center">
                          <Car className="h-4 w-4" />
                          <div>{selectedCustomer.vehicleInfo || "No vehicle information"}</div>
                        </div>
                        <div className="mt-4 font-medium">Condition Notes</div>
                        <div className="bg-muted p-2 rounded-md">
                          {selectedCustomer.vehicleCondition || "No condition notes"}
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-6">
                      <div className="font-medium mb-2">Service Preferences</div>
                      <div className="bg-muted p-3 rounded-md">
                        <div className="mb-2">
                          <span className="font-medium">Selected Services:</span>{" "}
                          {selectedCustomer.selectedServices || "None"}
                        </div>
                        <div>
                          <span className="font-medium">Add-on Services:</span>{" "}
                          {selectedCustomer.selectedAddOns || "None"}
                        </div>
                      </div>
                    </div>
                    
                    {selectedCustomer.notes && (
                      <div className="mt-6">
                        <div className="font-medium mb-2">Notes</div>
                        <div className="bg-muted p-3 rounded-md whitespace-pre-line">
                          {selectedCustomer.notes}
                        </div>
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="history">
                    {customerDetailsQuery.isLoading ? (
                      <div className="space-y-4">
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-24 w-full" />
                      </div>
                    ) : !customerDetailsQuery.data?.serviceHistory.length ? (
                      <div className="text-center p-6 text-muted-foreground">
                        <History className="mx-auto h-12 w-12 mb-3 opacity-30" />
                        <div className="text-lg font-medium mb-1">No Service History</div>
                        <p>This customer hasn't had any services recorded yet.</p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Service</TableHead>
                            <TableHead>Vehicle</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {customerDetailsQuery.data?.serviceHistory.map((record, index) => (
                            <TableRow key={index}>
                              <TableCell>
                                {record.date || "Unknown date"}
                              </TableCell>
                              <TableCell>{record.service}</TableCell>
                              <TableCell>{record.vehicle}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </TabsContent>
                  
                  {selectedCustomer.photoFolder && (
                    <TabsContent value="photos">
                      {selectedCustomer.photoFolder ? (
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <div className="font-medium">Customer Photos</div>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                window.open(selectedCustomer.photoFolder, '_blank');
                              }}
                            >
                              Open Folder
                            </Button>
                          </div>
                          <div className="bg-muted p-4 rounded-md text-center">
                            <div className="mb-2">
                              Photos are stored in Google Drive
                            </div>
                            <Button 
                              onClick={() => {
                                window.open(selectedCustomer.photoFolder, '_blank');
                              }}
                            >
                              View Photos in Google Drive
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center p-6 text-muted-foreground">
                          No photos available for this customer.
                        </div>
                      )}
                    </TabsContent>
                  )}
                </Tabs>
              </CardContent>
              <CardFooter className="flex justify-between">
                <div className="text-sm text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Last contact: {selectedCustomer.lastContact || "Unknown"}
                </div>
              </CardFooter>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomerSearch;