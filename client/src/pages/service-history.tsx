import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { AppShell } from '@/components/AppShell';
import { ArrowLeft } from 'lucide-react';
import { 
  Table, 
  TableBody, 
  TableCaption, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { format } from 'date-fns';

interface ServiceHistoryEntry {
  service: string;
  date: string;
  notes?: string;
}

interface CustomerInfo {
  name: string;
  phone: string;
  address?: string;
  email?: string;
  vehicleInfo?: string;
  serviceHistory: ServiceHistoryEntry[];
  lastInteraction: string;
}

export default function ServiceHistoryPage() {
  const [location, setLocation] = useLocation();
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Parse phone from URL query parameter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const phoneParam = params.get('phone');
    if (phoneParam) {
      setPhoneNumber(phoneParam);
      fetchCustomerInfo(phoneParam);
    }
  }, []);

  // Fetch customer info and service history
  const fetchCustomerInfo = async (phone: string) => {
    if (!phone) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/customer-info?phone=${encodeURIComponent(phone)}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch customer information');
      }
      
      const data = await response.json();
      
      if (data.success) {
        setCustomerInfo(data.customerInfo);
      } else {
        throw new Error(data.error || 'No customer found with this phone number');
      }
    } catch (err: any) {
      console.error('Error fetching customer info:', err);
      setError(err.message || 'An error occurred');
      toast({
        title: 'Error',
        description: err.message || 'Failed to load customer information',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCustomerInfo(phoneNumber);
  };
  
  // Navigate to directions page
  const goToDirections = () => {
    if (customerInfo?.address) {
      setLocation(`/directions?address=${encodeURIComponent(customerInfo.address)}&phone=${encodeURIComponent(customerInfo.phone)}`);
    } else {
      toast({
        title: 'Missing Address',
        description: 'No address available for this customer',
        variant: 'destructive',
      });
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MM/dd/yyyy hh:mm a');
    } catch (error) {
      return dateString;
    }
  };

  return (
    <AppShell title="Service History">
      <div className="p-6">
        <div className="max-w-4xl mx-auto space-y-6">
        
        <Card className="mb-8">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-500 text-white">
            <CardTitle className="text-xl">Find Customer</CardTitle>
          </CardHeader>
          
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="Enter customer phone number"
                    className="w-full"
                  />
                </div>
                <Button type="submit" disabled={isLoading} className="bg-blue-600 hover:bg-blue-700">
                  {isLoading ? 'Loading...' : 'Search'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
        
        {error && (
          <div className="text-center mt-4 p-4 bg-red-50 text-red-600 rounded-md">
            {error}
          </div>
        )}
        
        {customerInfo && (
          <Card>
            <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-500 text-white">
              <CardTitle className="text-xl">Customer Information</CardTitle>
            </CardHeader>
            
            <CardContent className="p-6 space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-medium text-gray-500">Name</h3>
                  <p className="text-lg">{customerInfo.name || 'Not provided'}</p>
                </div>
                
                <div>
                  <h3 className="font-medium text-gray-500">Phone</h3>
                  <p className="text-lg">{customerInfo.phone}</p>
                </div>
                
                {customerInfo.email && (
                  <div>
                    <h3 className="font-medium text-gray-500">Email</h3>
                    <p className="text-lg">{customerInfo.email}</p>
                  </div>
                )}
                
                {customerInfo.address && (
                  <div className="md:col-span-2">
                    <h3 className="font-medium text-gray-500">Address</h3>
                    <div className="flex items-center gap-2">
                      <p className="text-lg cursor-pointer text-blue-600 hover:text-blue-800 underline" 
                         onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(customerInfo.address)}`, '_blank')}>
                        {customerInfo.address}
                      </p>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={goToDirections}
                        className="ml-2"
                      >
                        Navigate
                      </Button>
                    </div>
                  </div>
                )}
                
                {customerInfo.vehicleInfo && (
                  <div className="md:col-span-2">
                    <h3 className="font-medium text-gray-500">Vehicle</h3>
                    <p className="text-lg">{customerInfo.vehicleInfo}</p>
                  </div>
                )}
                
                <div className="md:col-span-2">
                  <h3 className="font-medium text-gray-500">Last Interaction</h3>
                  <p>{formatDate(customerInfo.lastInteraction)}</p>
                </div>
                
                {/* Action Buttons */}
                <div className="md:col-span-2 flex gap-3 pt-4">
                  <Button 
                    onClick={() => window.open(`/business-chat?phone=${encodeURIComponent(customerInfo.phone)}`, '_blank')}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    💬 Message Customer
                  </Button>
                  
                  <Button 
                    variant="outline"
                    onClick={() => window.open(`/schedule?phone=${encodeURIComponent(customerInfo.phone)}`, '_blank')}
                  >
                    📅 Schedule Service
                  </Button>
                </div>
              </div>
              
              <Separator />
              
              <div>
                <h3 className="text-xl font-semibold mb-4">Service History</h3>
                {customerInfo.serviceHistory && customerInfo.serviceHistory.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Service</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customerInfo.serviceHistory.map((entry, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{formatDate(entry.date)}</TableCell>
                          <TableCell>{entry.service}</TableCell>
                          <TableCell>{entry.notes || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-gray-500 text-center py-4">No service history available</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}
        </div>
      </div>
    </AppShell>
  );
}