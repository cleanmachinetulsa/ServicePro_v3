import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Search,
  User,
  Phone,
  Mail,
  Car,
  MapPin,
  Calendar,
  Edit,
  Save,
  X,
  FileText,
  Star,
  History,
  DollarSign,
  AlertCircle,
  Loader2
} from "lucide-react";

interface Customer {
  id?: string;
  phone: string;
  name: string;
  email?: string;
  vehicleInfo?: string;
  address?: string;
  lastServiceDate?: string;
  servicesHistory?: string;
  notes?: string;
  loyaltyPoints?: number;
  loyaltyTier?: string;
  smsConsent?: boolean;
  photoFolder?: string;
  found?: boolean;
  serviceHistory?: any[];
  totalSpent?: number;
  vehicleCount?: number;
}

export function CustomerManagement() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editedCustomer, setEditedCustomer] = useState<Customer | null>(null);
  const [viewTab, setViewTab] = useState("details");

  // Fetch all customers
  const { data: customersData, isLoading, refetch } = useQuery<{
    success: boolean;
    customers: Customer[];
  }>({
    queryKey: ['/api/enhanced/customers'],
    enabled: true,
    refetchInterval: 30000, // Refetch every 30 seconds to stay synced
  });

  // Search customers
  const { data: searchResults, isLoading: isSearching, refetch: searchCustomers } = useQuery<{
    success: boolean;
    results: Customer[];
  }>({
    queryKey: ['/api/enhanced/customers/search', searchQuery],
    enabled: false, // Only search when triggered
  });

  // Update customer mutation
  const updateCustomer = useMutation({
    mutationFn: async (customer: Customer) => {
      const response = await fetch(`/api/customers/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customer)
      });
      if (!response.ok) throw new Error('Failed to update customer');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Customer Updated",
        description: "Customer information has been successfully updated.",
      });
      refetch();
      setEditMode(false);
      setEditedCustomer(null);
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Failed to update customer information. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Fetch detailed customer info when selected
  const fetchCustomerDetails = async (phone: string) => {
    try {
      const response = await fetch(`/api/enhanced/customers/${encodeURIComponent(phone)}`);
      const data = await response.json();
      if (data.success && data.customer) {
        setSelectedCustomer(data.customer);
        setEditedCustomer(data.customer);
      }
    } catch (error) {
      console.error('Error fetching customer details:', error);
      toast({
        title: "Error",
        description: "Failed to load customer details",
        variant: "destructive"
      });
    }
  };

  const handleSearch = () => {
    if (searchQuery.trim()) {
      searchCustomers();
    }
  };

  const handleEdit = () => {
    setEditMode(true);
    setEditedCustomer(selectedCustomer);
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    setEditedCustomer(selectedCustomer);
  };

  const handleSave = () => {
    if (editedCustomer) {
      updateCustomer.mutate(editedCustomer);
    }
  };

  const handleInputChange = (field: keyof Customer, value: any) => {
    if (editedCustomer) {
      setEditedCustomer({
        ...editedCustomer,
        [field]: value
      });
    }
  };

  const customers = searchQuery && searchResults?.results 
    ? searchResults.results 
    : customersData?.customers || [];

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-white flex items-center gap-2">
            <User className="h-6 w-6" />
            Customer Management
          </CardTitle>
          <CardDescription className="text-gray-300">
            View and manage customer information from your Google Sheets database
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search by name, phone, email, or vehicle..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10 bg-gray-800 border-gray-600 text-white placeholder-gray-400"
              />
            </div>
            <Button 
              onClick={handleSearch}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={isSearching}
            >
              {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
            </Button>
            <Button 
              onClick={() => {
                setSearchQuery("");
                refetch();
              }}
              variant="outline"
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer List */}
        <Card className="lg:col-span-1 bg-gray-900 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">
              Customers ({customers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px] pr-4">
              {isLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                </div>
              ) : customers.length === 0 ? (
                <div className="text-center text-gray-400 py-8">
                  <User className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No customers found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {customers.map((customer: Customer, index: number) => (
                    <button
                      key={customer.phone || index}
                      onClick={() => fetchCustomerDetails(customer.phone)}
                      className={`w-full text-left p-3 rounded-lg transition-all ${
                        selectedCustomer?.phone === customer.phone
                          ? 'bg-blue-600/20 border border-blue-500'
                          : 'bg-gray-800 hover:bg-gray-700 border border-gray-700'
                      }`}
                      data-testid={`customer-card-${customer.phone}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-white">
                            {customer.name || 'Unknown'}
                          </h4>
                          <p className="text-sm text-gray-400 flex items-center gap-1 mt-1">
                            <Phone className="h-3 w-3" />
                            {customer.phone}
                          </p>
                          {customer.email && (
                            <p className="text-sm text-gray-400 flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {customer.email}
                            </p>
                          )}
                          {customer.vehicleInfo && (
                            <p className="text-sm text-gray-400 flex items-center gap-1">
                              <Car className="h-3 w-3" />
                              {customer.vehicleInfo}
                            </p>
                          )}
                        </div>
                        {customer.loyaltyTier && (
                          <Badge className="bg-yellow-600/20 text-yellow-400 border-yellow-500">
                            {customer.loyaltyTier}
                          </Badge>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Customer Details */}
        <Card className="lg:col-span-2 bg-gray-900 border-gray-700">
          {selectedCustomer ? (
            <>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-2xl text-white">
                      {editMode && editedCustomer ? (
                        <Input
                          value={editedCustomer.name || ''}
                          onChange={(e) => handleInputChange('name', e.target.value)}
                          className="text-2xl font-bold bg-gray-800 border-gray-600"
                          data-testid="input-customer-name"
                        />
                      ) : (
                        selectedCustomer.name || 'Unknown Customer'
                      )}
                    </CardTitle>
                    <CardDescription className="text-gray-400 mt-2">
                      Customer since {selectedCustomer.lastServiceDate 
                        ? new Date(selectedCustomer.lastServiceDate).toLocaleDateString() 
                        : 'N/A'}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {editMode ? (
                      <>
                        <Button
                          onClick={handleSave}
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                          disabled={updateCustomer.isPending}
                          data-testid="button-save-customer"
                        >
                          {updateCustomer.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          onClick={handleCancelEdit}
                          size="sm"
                          variant="outline"
                          className="border-gray-600 hover:bg-gray-700"
                          data-testid="button-cancel-edit"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <Button
                        onClick={handleEdit}
                        size="sm"
                        variant="outline"
                        className="border-gray-600 hover:bg-gray-700 text-white"
                        data-testid="button-edit-customer"
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs value={viewTab} onValueChange={setViewTab}>
                  <TabsList className="grid w-full grid-cols-3 bg-gray-800">
                    <TabsTrigger value="details" className="data-[state=active]:bg-gray-700">
                      Details
                    </TabsTrigger>
                    <TabsTrigger value="history" className="data-[state=active]:bg-gray-700">
                      Service History
                    </TabsTrigger>
                    <TabsTrigger value="loyalty" className="data-[state=active]:bg-gray-700">
                      Loyalty
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="details" className="space-y-4 mt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-gray-400">Phone</Label>
                        {editMode && editedCustomer ? (
                          <Input
                            value={editedCustomer.phone}
                            onChange={(e) => handleInputChange('phone', e.target.value)}
                            className="bg-gray-800 border-gray-600 text-white"
                            data-testid="input-customer-phone"
                          />
                        ) : (
                          <p className="text-white flex items-center gap-2 mt-1">
                            <Phone className="h-4 w-4 text-gray-400" />
                            {selectedCustomer.phone}
                          </p>
                        )}
                      </div>

                      <div>
                        <Label className="text-gray-400">Email</Label>
                        {editMode && editedCustomer ? (
                          <Input
                            value={editedCustomer.email || ''}
                            onChange={(e) => handleInputChange('email', e.target.value)}
                            className="bg-gray-800 border-gray-600 text-white"
                            placeholder="customer@example.com"
                            data-testid="input-customer-email"
                          />
                        ) : (
                          <p className="text-white flex items-center gap-2 mt-1">
                            <Mail className="h-4 w-4 text-gray-400" />
                            {selectedCustomer.email || 'Not provided'}
                          </p>
                        )}
                      </div>

                      <div>
                        <Label className="text-gray-400">Address</Label>
                        {editMode && editedCustomer ? (
                          <Input
                            value={editedCustomer.address || ''}
                            onChange={(e) => handleInputChange('address', e.target.value)}
                            className="bg-gray-800 border-gray-600 text-white"
                            placeholder="Enter address"
                            data-testid="input-customer-address"
                          />
                        ) : (
                          <p className="text-white flex items-center gap-2 mt-1">
                            <MapPin className="h-4 w-4 text-gray-400" />
                            {selectedCustomer.address || 'Not provided'}
                          </p>
                        )}
                      </div>

                      <div>
                        <Label className="text-gray-400">Vehicle Information</Label>
                        {editMode && editedCustomer ? (
                          <Input
                            value={editedCustomer.vehicleInfo || ''}
                            onChange={(e) => handleInputChange('vehicleInfo', e.target.value)}
                            className="bg-gray-800 border-gray-600 text-white"
                            placeholder="Year Make Model Color"
                            data-testid="input-customer-vehicle"
                          />
                        ) : (
                          <p className="text-white flex items-center gap-2 mt-1">
                            <Car className="h-4 w-4 text-gray-400" />
                            {selectedCustomer.vehicleInfo || 'Not provided'}
                          </p>
                        )}
                      </div>
                    </div>

                    <div>
                      <Label className="text-gray-400">Notes</Label>
                      {editMode && editedCustomer ? (
                        <Textarea
                          value={editedCustomer.notes || ''}
                          onChange={(e) => handleInputChange('notes', e.target.value)}
                          className="bg-gray-800 border-gray-600 text-white mt-1"
                          rows={4}
                          placeholder="Add notes about this customer..."
                          data-testid="textarea-customer-notes"
                        />
                      ) : (
                        <div className="bg-gray-800 rounded-lg p-3 mt-1">
                          <p className="text-gray-300">
                            {selectedCustomer.notes || 'No notes available'}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center space-x-4">
                      <Label className="text-gray-400">SMS Consent</Label>
                      {editMode && editedCustomer ? (
                        <input
                          type="checkbox"
                          checked={editedCustomer.smsConsent || false}
                          onChange={(e) => handleInputChange('smsConsent', e.target.checked)}
                          className="h-4 w-4 rounded border-gray-600"
                          data-testid="checkbox-sms-consent"
                        />
                      ) : (
                        <Badge 
                          className={selectedCustomer.smsConsent 
                            ? "bg-green-600/20 text-green-400 border-green-500"
                            : "bg-gray-600/20 text-gray-400 border-gray-500"
                          }
                        >
                          {selectedCustomer.smsConsent ? 'Consented' : 'Not Consented'}
                        </Badge>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="history" className="mt-4">
                    <div className="space-y-4">
                      {selectedCustomer.serviceHistory && selectedCustomer.serviceHistory.length > 0 ? (
                        <div className="space-y-3">
                          {selectedCustomer.serviceHistory.map((service: any, index: number) => (
                            <div 
                              key={index} 
                              className="bg-gray-800 rounded-lg p-4 border border-gray-700"
                              data-testid={`service-history-${index}`}
                            >
                              <div className="flex justify-between items-start">
                                <div>
                                  <h4 className="font-semibold text-white">
                                    {service.service}
                                  </h4>
                                  <p className="text-sm text-gray-400 mt-1">
                                    <Calendar className="inline h-3 w-3 mr-1" />
                                    {new Date(service.date).toLocaleDateString()}
                                  </p>
                                  {service.notes && (
                                    <p className="text-sm text-gray-300 mt-2">
                                      {service.notes}
                                    </p>
                                  )}
                                </div>
                                {service.price && (
                                  <Badge className="bg-green-600/20 text-green-400 border-green-500">
                                    ${service.price}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-400">
                          <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
                          <p>No service history available</p>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="loyalty" className="mt-4">
                    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <Label className="text-gray-400">Loyalty Points</Label>
                          <p className="text-3xl font-bold text-white mt-2 flex items-center gap-2">
                            <Star className="h-6 w-6 text-yellow-500" />
                            {selectedCustomer.loyaltyPoints || 0}
                          </p>
                        </div>
                        <div>
                          <Label className="text-gray-400">Loyalty Tier</Label>
                          <p className="text-2xl font-semibold text-white mt-2">
                            {selectedCustomer.loyaltyTier || 'Standard'}
                          </p>
                        </div>
                      </div>
                      
                      {selectedCustomer.totalSpent && (
                        <div className="mt-6 pt-6 border-t border-gray-700">
                          <Label className="text-gray-400">Total Spent</Label>
                          <p className="text-2xl font-bold text-green-400 mt-2 flex items-center gap-2">
                            <DollarSign className="h-5 w-5" />
                            {selectedCustomer.totalSpent.toFixed(2)}
                          </p>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </>
          ) : (
            <CardContent className="flex items-center justify-center h-96">
              <div className="text-center text-gray-400">
                <User className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg">Select a customer to view details</p>
                <p className="text-sm mt-2">Search or browse the customer list on the left</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}