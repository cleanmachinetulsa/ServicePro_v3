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
import { format } from "date-fns";
import { AppShell } from "@/components/AppShell";
import { DashboardOverview } from "@/components/DashboardOverview";
import BusinessChatInterface from "@/components/BusinessChatInterface";
import { Home, Moon, Sun, Mail } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { CashCollectionsWidget } from "@/components/dashboard/CashCollectionsWidget";
import { DepositHistoryWidget } from "@/components/dashboard/DepositHistoryWidget";

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
  const { data: currentUserData } = useQuery<{ success: boolean; user: { id: number; role: string } }>({
    queryKey: ['/api/users/me'],
  });
  const currentUser = currentUserData?.user;
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [todayDate, setTodayDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [appointmentCounts, setAppointmentCounts] = useState<Record<string, number>>({});
  const [weatherData, setWeatherData] = useState<Record<string, any>>({});
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceDetails, setInvoiceDetails] = useState<InvoiceDetails | null>(null);
  const [showBusinessChat, setShowBusinessChat] = useState(false);
  const [chatCustomer, setChatCustomer] = useState<{ phone: string; name: string } | null>(null);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('darkMode') === 'true';
    }
    return false;
  });
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

  // Toggle dark mode
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('darkMode', 'true');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('darkMode', 'false');
    }
  }, [darkMode]);

  // Fetch appointments for a specific date
  const fetchAppointmentsForDate = async (date: Date) => {
    try {
      const formattedDate = date.toISOString();
      const response = await fetch(`/api/dashboard/today?date=${formattedDate}`);
      const data = await response.json();

      if (data.success && data.appointments) {
        setAppointments(data.appointments);
      } else {
        setAppointments([]);
        console.error('Failed to fetch appointments:', data.error);
      }
    } catch (error) {
      console.error('Error fetching appointments:', error);
      setAppointments([]);
    }
  };

  // Fetch appointments when component mounts or when selected date changes
  useEffect(() => {
    fetchAppointmentsForDate(todayDate);
  }, [todayDate]);

  // Fetch appointment counts when current month changes
  useEffect(() => {
    const fetchAppointmentCounts = async () => {
      try {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth() + 1;
        const response = await fetch(`/api/dashboard/appointment-counts?year=${year}&month=${month}`);
        const data = await response.json();

        if (data.success && data.counts) {
          setAppointmentCounts(data.counts);
        }
      } catch (error) {
        console.error('Error fetching appointment counts:', error);
      }
    };

    fetchAppointmentCounts();
    
    const fetchWeatherData = async () => {
      try {
        const response = await fetch('/api/dashboard/weather?days=14');
        const data = await response.json();
        
        if (data.success && data.weather) {
          setWeatherData(data.weather);
        }
      } catch (error) {
        console.error('Error fetching weather data:', error);
      }
    };
    
    fetchWeatherData();
  }, [currentMonth]);

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

    setShowInvoiceModal(true);
  };

  // Handle date change
  const handleDateChange = (date: Date) => {
    setTodayDate(date);
    fetchAppointmentsForDate(date);
  };

  // Page-specific actions
  const pageActions = (
    <>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setDarkMode(!darkMode)}
        data-testid="button-dark-mode"
      >
        {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>
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
      <AppShell title="Dashboard" pageActions={pageActions}>
        <DashboardOverview
          darkMode={darkMode}
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
      </AppShell>

      {/* Invoice Modal */}
      <Dialog open={showInvoiceModal} onOpenChange={setShowInvoiceModal}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-white dark:bg-gray-900">
          <DialogHeader>
            <DialogTitle className="text-2xl text-blue-800 dark:text-blue-200">
              Send Invoice & Thank You Message
            </DialogTitle>
            <DialogDescription className="text-blue-600 dark:text-blue-400">
              Send an invoice and thank you message to your customer via SMS and email
            </DialogDescription>
          </DialogHeader>

          {invoiceDetails && (
            <div className="space-y-4">
              {/* Customer Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="customerName" className="text-blue-700 dark:text-blue-300">Customer Name</Label>
                  <Input
                    id="customerName"
                    value={invoiceDetails.customerName}
                    onChange={(e) => setInvoiceDetails({ ...invoiceDetails, customerName: e.target.value })}
                    className="border-blue-200"
                  />
                </div>
                <div>
                  <Label htmlFor="phone" className="text-blue-700 dark:text-blue-300">Phone</Label>
                  <Input
                    id="phone"
                    value={invoiceDetails.phone}
                    onChange={(e) => setInvoiceDetails({ ...invoiceDetails, phone: e.target.value })}
                    className="border-blue-200"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="email" className="text-blue-700 dark:text-blue-300">Email (Optional)</Label>
                <Input
                  id="email"
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
                      description: `Thank you message and invoice sent to ${invoiceDetails.customerName} via ${notificationMethods.join(' and ')}.${pointsMessage}`,
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
            >
              <Mail className="mr-2 h-4 w-4" />
              Send Invoice & Thank You
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
    </>
  );
}
