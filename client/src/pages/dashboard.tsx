import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { AppShell } from "@/components/AppShell";
import { DashboardOverview } from "@/components/DashboardOverview";
import BusinessChatInterface from "@/components/BusinessChatInterface";
import { Home, Mail, Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { CashCollectionsWidget } from "@/components/dashboard/CashCollectionsWidget";
import { DepositHistoryWidget } from "@/components/dashboard/DepositHistoryWidget";
import { InstallPromptBanner, OfflineIndicator } from "@/components/PwaComponents";
import { useDashboardOnboarding } from "@/hooks/useDashboardOnboarding";
import { DashboardTour } from "@/components/onboarding/DashboardTour";
import { dashboardTourSteps } from "@/config/dashboardTourSteps";

interface Appointment {
  id: string;
  customerName: string;
  service: string;
  time: string;
  date: string;
  address: string;
  phone: string;
  vehicleInfo?: string;
  email?: string;
  status?: string;
  price?: string;
}

interface InvoiceItem {
  service: string;
  price: number;
  quantity: number;
}

interface InvoiceDetails {
  customerName: string;
  customerEmail: string;
  phone: string;
  address: string;
  vehicleInfo: string;
  serviceDate?: string;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  total: number;
  notes: string;
  includeReviewLink: boolean;
  invoiceId?: number;
}

export default function Dashboard() {
  const [location, navigate] = useLocation();
  const { data: currentUserData } = useQuery<{ 
    success: boolean; 
    user: { 
      id: number; 
      role: string;
      hasSeenDashboardTour?: boolean;
    } 
  }>({
    queryKey: ['/api/users/me'],
  });
  const currentUser = currentUserData?.user;

  // Dashboard tour
  const {
    shouldShowTour,
    setShouldShowTour,
    markTourCompleted,
  } = useDashboardOnboarding({
    initialHasSeenTour: currentUser?.hasSeenDashboardTour ?? false,
    userId: currentUser?.id,
  });
  const [todayDate, setTodayDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  
  // Parallel data fetching with React Query
  const { data: appointmentsData, isLoading: isLoadingAppointments } = useQuery<{ success: boolean; appointments: Appointment[] }>({
    queryKey: ['/api/dashboard/today', todayDate.toISOString()],
    queryFn: async () => {
      const response = await fetch(`/api/dashboard/today?date=${todayDate.toISOString()}`);
      return await response.json();
    },
  });
  
  const { data: appointmentCountsData, isLoading: isLoadingCounts } = useQuery<{ success: boolean; counts: Record<string, number> }>({
    queryKey: ['/api/dashboard/appointment-counts', currentMonth.getFullYear(), currentMonth.getMonth() + 1],
    queryFn: async () => {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth() + 1;
      const response = await fetch(`/api/dashboard/appointment-counts?year=${year}&month=${month}`);
      return await response.json();
    },
  });
  
  const { data: weatherDataResponse, isLoading: isLoadingWeather } = useQuery<{ success: boolean; weather: Record<string, any> }>({
    queryKey: ['/api/dashboard/weather'],
    queryFn: async () => {
      const response = await fetch('/api/dashboard/weather?days=14');
      return await response.json();
    },
  });
  
  const isLoadingData = isLoadingAppointments || isLoadingCounts || isLoadingWeather;
  
  // Extract data from queries with fallbacks
  const appointments = appointmentsData?.appointments || [];
  const appointmentCounts = appointmentCountsData?.counts || {};
  const weatherData = weatherDataResponse?.weather || {};
  
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceDetails, setInvoiceDetails] = useState<InvoiceDetails | null>(null);
  const [isManualInvoice, setIsManualInvoice] = useState(false);
  const [showBusinessChat, setShowBusinessChat] = useState(false);
  const [chatCustomer, setChatCustomer] = useState<{ phone: string; name: string } | null>(null);
  const [invoiceSettings] = useState({
    taxRate: 0.0,
    taxEnabled: false,
    autoFillEmail: true
  });
  
  const { toast } = useToast();

  // Tab Compatibility Mapping - Redirect old ?tab= URLs to new routes
  const tabCompatibilityMap: Record<string, string> = {
    'customers': '/customer-database',
    'messages': '/messages',
    'gallery': '/gallery',
    'analytics': '/analytics',
    'technician': '/technician',
    'security': '/security-settings',
    'settings': '/settings',
    'notifications': '/settings',
    'agent': '/settings',
    'business-settings': '/settings',
    'upsell': '/settings',
    'loyalty': '/settings',
    'recurring-services': '/settings',
    'cancellation-feedback': '/settings',
    'email-campaigns': '/settings',
    'subscriptions': '/settings',
  };

  // Compatibility redirect for old ?tab= URLs
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam && tabCompatibilityMap[tabParam]) {
        navigate(tabCompatibilityMap[tabParam]);
      }
    }
  }, [location]);

  // Navigate to directions page
  const goToDirections = (address: string, phone: string) => {
    navigate(`/directions?address=${encodeURIComponent(address)}&phone=${encodeURIComponent(phone)}`);
  };

  // Navigate to service history
  const viewServiceHistory = (phone: string) => {
    navigate(`/service-history?phone=${encodeURIComponent(phone)}`);
  };

  // Handle call
  const handleCall = (phone: string) => {
    window.open(`tel:${phone}`);
  };

  // Handle chat
  const handleChat = (phone: string, name: string) => {
    setChatCustomer({ phone, name });
    setShowBusinessChat(true);
  };

  // Open invoice modal for an appointment
  const openInvoiceModal = async (appointment: Appointment) => {
    let customerEmail = "";
    if (invoiceSettings.autoFillEmail) {
      try {
        const response = await fetch(`/api/enhanced/customers/${encodeURIComponent(appointment.phone)}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.customer && data.customer.email) {
            customerEmail = data.customer.email;
          }
        }
      } catch (error) {
        console.error('Error fetching customer email:', error);
      }
    }

    // Extract price from service
    const extractPrice = (priceString?: string): number => {
      if (!priceString) return 150;
      const match = priceString.match(/\$?(\d+)/);
      if (match && match[1]) {
        return parseFloat(match[1]);
      }
      return 150;
    };

    const basePrice = extractPrice(appointment.price);
    const tax = invoiceSettings.taxEnabled ? Math.round(basePrice * invoiceSettings.taxRate * 100) / 100 : 0;
    const total = basePrice + tax;

    setInvoiceDetails({
      customerName: appointment.customerName,
      customerEmail: customerEmail,
      phone: appointment.phone,
      address: appointment.address,
      vehicleInfo: appointment.vehicleInfo || "",
      serviceDate: new Date().toLocaleDateString(),
      items: [{
        service: appointment.service,
        price: basePrice,
        quantity: 1
      }],
      subtotal: basePrice,
      tax,
      total,
      notes: "Thank you for choosing Clean Machine Auto Detail!",
      includeReviewLink: true
    });

    setIsManualInvoice(false);
    setShowInvoiceModal(true);
  };

  // Open invoice modal for manual entry (walk-in customers)
  const openManualInvoiceModal = () => {
    const basePrice = 150;
    const tax = invoiceSettings.taxEnabled ? Math.round(basePrice * invoiceSettings.taxRate * 100) / 100 : 0;
    const total = basePrice + tax;

    setInvoiceDetails({
      customerName: "",
      customerEmail: "",
      phone: "",
      address: "",
      vehicleInfo: "",
      serviceDate: new Date().toLocaleDateString(),
      items: [{
        service: "Service",
        price: basePrice,
        quantity: 1
      }],
      subtotal: basePrice,
      tax,
      total,
      notes: "Thank you for choosing Clean Machine Auto Detail!",
      includeReviewLink: true
    });

    setIsManualInvoice(true);
    setShowInvoiceModal(true);
  };

  // Validate manual invoice before sending
  const validateManualInvoice = (): boolean => {
    if (!invoiceDetails) return false;

    if (!invoiceDetails.customerName.trim()) {
      toast({
        title: 'Missing Information',
        description: 'Customer name is required',
        variant: 'destructive'
      });
      return false;
    }

    if (!invoiceDetails.phone.trim()) {
      toast({
        title: 'Missing Information',
        description: 'Phone number is required',
        variant: 'destructive'
      });
      return false;
    }

    // Validate phone format (basic check)
    const phoneDigits = invoiceDetails.phone.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      toast({
        title: 'Invalid Phone',
        description: 'Please enter a valid phone number (at least 10 digits)',
        variant: 'destructive'
      });
      return false;
    }

    if (!invoiceDetails.items[0].service || invoiceDetails.items[0].service === "Service") {
      toast({
        title: 'Missing Information',
        description: 'Service description is required',
        variant: 'destructive'
      });
      return false;
    }

    if (invoiceDetails.total <= 0) {
      toast({
        title: 'Invalid Amount',
        description: 'Invoice amount must be greater than $0',
        variant: 'destructive'
      });
      return false;
    }

    return true;
  };

  // Handle date change
  const handleDateChange = (date: Date) => {
    setTodayDate(date);
  };

  // Page-specific actions
  const pageActions = (
    <>
      {currentUser && (currentUser.role === 'owner' || currentUser.role === 'manager') && (
        <Button
          size="sm"
          onClick={openManualInvoiceModal}
          data-testid="button-create-manual-invoice"
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          Walk-in Invoice
        </Button>
      )}
      <Button
        size="sm"
        variant="ghost"
        onClick={() => navigate('/')}
        data-testid="button-home"
      >
        <Home className="h-4 w-4 mr-2" />
        Home
      </Button>
    </>
  );

  return (
    <>
      <OfflineIndicator />
      <InstallPromptBanner />
      <AppShell title="Dashboard" pageActions={pageActions}>
        <div data-tour-id="main-dashboard-root">
        {isLoadingData ? (
          <div className="space-y-4 p-6">
            {/* Statistics Bar Skeleton */}
            <Card className="backdrop-blur-xl bg-white/10 dark:bg-white/5 border border-white/20 shadow-xl">
              <div className="py-4 px-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="text-center space-y-2">
                      <Skeleton className="h-8 w-16 mx-auto bg-white/20" />
                      <Skeleton className="h-3 w-20 mx-auto bg-white/20" />
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* Calendar and Schedule Skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <Skeleton className="h-[500px] rounded-xl bg-white/10" />
                <Skeleton className="h-[300px] rounded-xl bg-white/10" />
              </div>
              <div className="space-y-4">
                <Skeleton className="h-[250px] rounded-xl bg-white/10" />
                <Skeleton className="h-[250px] rounded-xl bg-white/10" />
              </div>
            </div>
          </div>
        ) : (
          <>
            <DashboardOverview
              appointments={appointments}
              appointmentCounts={appointmentCounts}
              weatherData={weatherData}
              todayDate={todayDate}
              currentMonth={currentMonth}
              onDateChange={handleDateChange}
              onMonthChange={setCurrentMonth}
              onCall={handleCall}
              onChat={handleChat}
              onNavigate={goToDirections}
              onViewHistory={viewServiceHistory}
              onSendInvoice={openInvoiceModal}
            />

            {/* Cash Deposit Tracking Widgets - Owner/Manager Only */}
            {currentUser && (currentUser.role === 'owner' || currentUser.role === 'manager') && (
              <div className="space-y-4 p-6 pt-0">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <CashCollectionsWidget />
                  <DepositHistoryWidget />
                </div>
              </div>
            )}
          </>
        )}
        </div>
      </AppShell>

      {/* Invoice Modal */}
      <Dialog open={showInvoiceModal} onOpenChange={setShowInvoiceModal}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-white dark:bg-gray-900">
          <DialogHeader>
            <DialogTitle className="text-2xl text-blue-800 dark:text-blue-200">
              {isManualInvoice ? 'Create Walk-in Invoice' : 'Send Invoice & Thank You Message'}
            </DialogTitle>
            <DialogDescription className="text-blue-600 dark:text-blue-400">
              {isManualInvoice 
                ? 'Enter customer information and service details for walk-in customer'
                : 'Send an invoice and thank you message to your customer via SMS and email'}
            </DialogDescription>
          </DialogHeader>

          {invoiceDetails && (
            <div className="space-y-4">
              {/* Customer Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="customerName" className="text-blue-700 dark:text-blue-300">
                    Customer Name {isManualInvoice && <span className="text-red-500">*</span>}
                  </Label>
                  <Input
                    id="customerName"
                    data-testid="input-manual-customer-name"
                    value={invoiceDetails.customerName}
                    onChange={(e) => setInvoiceDetails({ ...invoiceDetails, customerName: e.target.value })}
                    className="border-blue-200"
                    placeholder={isManualInvoice ? "John Doe" : ""}
                  />
                </div>
                <div>
                  <Label htmlFor="phone" className="text-blue-700 dark:text-blue-300">
                    Phone {isManualInvoice && <span className="text-red-500">*</span>}
                  </Label>
                  <Input
                    id="phone"
                    data-testid="input-manual-customer-phone"
                    value={invoiceDetails.phone}
                    onChange={(e) => setInvoiceDetails({ ...invoiceDetails, phone: e.target.value })}
                    className="border-blue-200"
                    placeholder={isManualInvoice ? "555-0100" : ""}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="email" className="text-blue-700 dark:text-blue-300">Email (Optional)</Label>
                <Input
                  id="email"
                  data-testid="input-manual-customer-email"
                  type="email"
                  value={invoiceDetails.customerEmail}
                  onChange={(e) => setInvoiceDetails({ ...invoiceDetails, customerEmail: e.target.value })}
                  placeholder="customer@email.com"
                  className="border-blue-200"
                />
              </div>

              {/* Service Details */}
              <div className="space-y-2">
                <Label className="text-blue-700 dark:text-blue-300">Service Details</Label>
                {isManualInvoice ? (
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="serviceName" className="text-sm">
                        Service Name <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="serviceName"
                        data-testid="input-manual-service-name"
                        value={invoiceDetails.items[0].service}
                        onChange={(e) => {
                          const updatedItems = [...invoiceDetails.items];
                          updatedItems[0].service = e.target.value;
                          setInvoiceDetails({ ...invoiceDetails, items: updatedItems });
                        }}
                        placeholder="Full Detail, Interior Clean, etc."
                        className="border-blue-200"
                      />
                    </div>
                    <div>
                      <Label htmlFor="servicePrice" className="text-sm">
                        Amount <span className="text-red-500">*</span>
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                        <Input
                          id="servicePrice"
                          data-testid="input-manual-service-amount"
                          type="number"
                          step="0.01"
                          min="0"
                          value={invoiceDetails.items[0].price}
                          onChange={(e) => {
                            const price = parseFloat(e.target.value) || 0;
                            const tax = invoiceSettings.taxEnabled ? Math.round(price * invoiceSettings.taxRate * 100) / 100 : 0;
                            const total = price + tax;
                            const updatedItems = [...invoiceDetails.items];
                            updatedItems[0].price = price;
                            setInvoiceDetails({ 
                              ...invoiceDetails, 
                              items: updatedItems,
                              subtotal: price,
                              tax,
                              total
                            });
                          }}
                          placeholder="150.00"
                          className="border-blue-200 pl-7"
                        />
                      </div>
                    </div>
                    <Card className="p-4 bg-blue-50/50 dark:bg-gray-800">
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Subtotal:</span>
                          <span>${invoiceDetails.subtotal.toFixed(2)}</span>
                        </div>
                        {invoiceDetails.tax > 0 && (
                          <div className="flex justify-between text-sm">
                            <span>Tax:</span>
                            <span>${invoiceDetails.tax.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-bold text-lg pt-2 border-t border-blue-200 dark:border-gray-700">
                          <span>Total:</span>
                          <span>${invoiceDetails.total.toFixed(2)}</span>
                        </div>
                      </div>
                    </Card>
                  </div>
                ) : (
                  <Card className="p-4 bg-blue-50/50 dark:bg-gray-800">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="font-medium">{invoiceDetails.items[0].service}</span>
                        <span>${invoiceDetails.items[0].price.toFixed(2)}</span>
                      </div>
                      <div className="border-t border-blue-200 dark:border-gray-700 pt-2">
                        <div className="flex justify-between text-sm">
                          <span>Subtotal:</span>
                          <span>${invoiceDetails.subtotal.toFixed(2)}</span>
                        </div>
                        {invoiceDetails.tax > 0 && (
                          <div className="flex justify-between text-sm">
                            <span>Tax:</span>
                            <span>${invoiceDetails.tax.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-bold text-lg mt-2 pt-2 border-t border-blue-200 dark:border-gray-700">
                          <span>Total:</span>
                          <span>${invoiceDetails.total.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                )}
              </div>

              {/* Notes */}
              <div>
                <Label htmlFor="notes" className="text-blue-700 dark:text-blue-300">Thank You Note</Label>
                <Textarea
                  id="notes"
                  value={invoiceDetails.notes}
                  onChange={(e) => setInvoiceDetails({ ...invoiceDetails, notes: e.target.value })}
                  className="w-full rounded-md border border-blue-200 bg-white px-3 py-2 text-sm"
                  placeholder="Add a thank you note or special instructions..."
                />
              </div>

              {/* Preview Section */}
              <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-md font-semibold text-blue-800 dark:text-blue-200">Preview Message</h3>
                <Card className="bg-blue-50/70 p-4 border-blue-200">
                  <p className="text-gray-800">
                    "Thank you {invoiceDetails.customerName} for choosing Clean Machine Auto Detail for your {invoiceDetails.items[0].service.toLowerCase()}! Your total is ${invoiceDetails.total.toFixed(2)}. {invoiceDetails.notes}"
                    {invoiceDetails.includeReviewLink && (
                      <span> We'd appreciate it if you could leave us a review here: [Google Review Link]</span>
                    )}
                  </p>
                </Card>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowInvoiceModal(false)}
              className="border-blue-300 dark:border-gray-600 text-blue-700 dark:text-blue-300 hover:bg-blue-100"
            >
              Cancel
            </Button>
            <Button 
              onClick={async () => {
                if (!invoiceDetails) return;

                // Validate manual invoice fields
                if (isManualInvoice && !validateManualInvoice()) {
                  return;
                }

                const notificationMethods = ['SMS'];
                if (invoiceDetails.customerEmail.trim() !== '') {
                  notificationMethods.push('email');
                }

                try {
                  const pointsToAward = Math.floor(invoiceDetails.total);

                  const loyaltyResponse = await fetch('/api/invoice/award-loyalty-points', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      customerPhone: invoiceDetails.phone,
                      invoiceId: Date.now(),
                      amount: invoiceDetails.total,
                      customerName: invoiceDetails.customerName
                    })
                  });

                  const loyaltyResult = await loyaltyResponse.json();
                  
                  if (!loyaltyResponse.ok || !loyaltyResult.success) {
                    console.error('Loyalty points award failed:', loyaltyResult);
                    toast({
                      title: "Points Award Failed",
                      description: loyaltyResult.message || "Could not award loyalty points. Check Google Sheets setup.",
                      variant: "destructive"
                    });
                  }

                  const sendResponse = await fetch('/api/dashboard/send-invoice', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      customerPhone: invoiceDetails.phone,
                      customerEmail: invoiceDetails.customerEmail,
                      customerName: invoiceDetails.customerName,
                      amount: invoiceDetails.total,
                      service: invoiceDetails.items[0].service,
                      notes: invoiceDetails.notes
                    })
                  });

                  const sendResult = await sendResponse.json();

                  if (sendResponse.ok && sendResult.success) {
                    const pointsMessage = loyaltyResult.success 
                      ? ` ${pointsToAward} loyalty points awarded!`
                      : ` (Note: Loyalty points could not be awarded)`;
                    
                    toast({
                      title: "Invoice Sent!",
                      description: `${isManualInvoice ? 'Walk-in invoice' : 'Thank you message and invoice'} sent to ${invoiceDetails.customerName} via ${notificationMethods.join(' and ')}.${pointsMessage}`,
                    });
                  } else {
                    toast({
                      title: "Send Failed",
                      description: sendResult.message || "Failed to send invoice",
                      variant: "destructive"
                    });
                  }
                } catch (error) {
                  toast({
                    title: "Error",
                    description: "Failed to send invoice. Please try again.",
                    variant: "destructive"
                  });
                  console.error('Error sending invoice:', error);
                }

                setShowInvoiceModal(false);
              }}
              className="bg-green-600 hover:bg-green-700"
              disabled={!invoiceDetails}
              data-testid="button-send-invoice"
            >
              <Mail className="mr-2 h-4 w-4" />
              {isManualInvoice ? 'Send Walk-in Invoice' : 'Send Invoice & Thank You'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Business Chat Interface */}
      <Dialog open={showBusinessChat} onOpenChange={setShowBusinessChat}>
        <DialogContent className="max-w-4xl h-[80vh] p-0">
          {chatCustomer && (
            <BusinessChatInterface
              customerPhone={chatCustomer.phone}
              customerName={chatCustomer.name}
              onClose={() => setShowBusinessChat(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Dashboard Tour */}
      <DashboardTour
        steps={dashboardTourSteps}
        isOpen={shouldShowTour}
        onClose={() => setShouldShowTour(false)}
        onFinish={markTourCompleted}
      />
    </>
  );
}
