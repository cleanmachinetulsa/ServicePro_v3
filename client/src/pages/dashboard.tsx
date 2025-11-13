import React, { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { WeatherForecast } from "@/components/WeatherForecast";
import InstantChatButton from "@/components/InstantChatButton";
import { 
  Table, 
  TableBody, 
  TableCaption, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import AgentSettings from "../components/AgentSettings";
import NotificationsSettings from "./notifications-settings";
import BusinessSettings from "./business-settings";
import { UpsellManagement } from "../components/UpsellManagement";
import { LoyaltyPointsSystem } from "../components/LoyaltyPointsSystem";
import { EmailCampaignsManager } from "../components/EmailCampaignsManager";
import CleanMachineLogo from "../components/CleanMachineLogo";
import logoImage from '@assets/generated_images/Clean_Machine_white_logo_transparent_f0645d6c.png';
import CancellationDemo from "../components/CancellationDemo";
import BusinessChatInterface from "../components/BusinessChatInterface";
import { CustomerManagement } from "../components/CustomerManagement";
import { CustomerSelector } from "../components/CustomerSelector";
import { AiHelpSearch } from "@/components/AiHelpSearch";
import { ActionableNotificationsBanner } from "@/components/ActionableNotificationsBanner";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import GalleryPhotoManager from "@/components/GalleryPhotoManager";
import SubscriptionManager from "@/components/SubscriptionManager";
import RecurringServicesManager from "@/components/RecurringServicesManager";
import SettingsWorkspace from "@/components/SettingsWorkspace";
import SecuritySettingsPage from "./security-settings";
import { 
  Car, 
  CalendarClock, 
  MessageSquare, 
  Navigation, 
  Phone, 
  User, 
  Settings, 
  DollarSign,
  Loader2,
  Search,
  Pencil,
  Save,
  CloudRain,
  Clock,
  FileText,
  Mail,
  ExternalLink,
  CheckCircle,
  Star,
  PlusCircle,
  RefreshCw,
  Moon,
  Sun,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Home,
  Users,
  TrendingUp,
  Zap,
  Heart,
  HelpCircle
} from "lucide-react";

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

interface Message {
  id: string;
  customerName: string;
  phone: string;
  content: string;
  timestamp: string;
  needsAttention: boolean;
}

interface ServiceInfo {
  name: string;
  priceRange: string;
  description: string; // This will now be 'overview'
  overview?: string; // For the main page card
  detailedDescription?: string; // For the dropdown data
  duration: string;
  durationHours: number;
  isAddon?: boolean;
  imageUrl?: string;
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
  const [location, setLocation] = useLocation();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [services, setServices] = useState<ServiceInfo[]>([]);
  const [todayDate, setTodayDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedService, setSelectedService] = useState<ServiceInfo | null>(null);
  const [isEditingService, setIsEditingService] = useState(false);
  const [serviceType, setServiceType] = useState<'main' | 'addon'>('main');
  const [searchQuery, setSearchQuery] = useState("");
  const [appointmentCounts, setAppointmentCounts] = useState<Record<string, number>>({});
  const [weatherData, setWeatherData] = useState<Record<string, any>>({});
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceDetails, setInvoiceDetails] = useState<InvoiceDetails | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showBusinessChat, setShowBusinessChat] = useState(false);
  
  // Read tab from URL query parameter on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam) {
        setActiveTab(tabParam);
      }
    }
  }, [location]);
  
  // Compatibility mapping for old tab names to new structure
  const tabCompatibilityMap: Record<string, string> = {
    'today': 'dashboard',
    'services': 'settings',
    'notifications': 'settings',
    'agent': 'settings',
    'business-settings': 'settings',
    'upsell': 'settings',
    'loyalty': 'settings',
    'recurring-services': 'settings',
    'cancellation-feedback': 'settings',
    'email-campaigns': 'settings',
    'subscriptions': 'settings',
  };
  
  // Tab change handler with compatibility mapping
  const handleTabChange = (newTab: string) => {
    // Special handling for Messages, Analytics, and Technician - redirect to dedicated pages
    if (newTab === 'messages') {
      setLocation('/messages');
      return;
    }
    if (newTab === 'analytics') {
      setLocation('/analytics');
      return;
    }
    if (newTab === 'technician') {
      setLocation('/technician');
      return;
    }
    
    // For Settings tab from new nav, keep as is
    // For all other tabs, use the tab name directly (no mapping needed - old tabs still exist)
    setActiveTab(newTab);
  };
  
  const [chatCustomer, setChatCustomer] = useState<{ phone: string; name: string } | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('darkMode') === 'true';
    }
    return false;
  });
  const [invoiceSettings, setInvoiceSettings] = useState({
    taxRate: 0.0, // Default to 0% tax
    taxEnabled: false,
    autoFillEmail: true
  });
  
  // ETA Padding and Google Place ID - loaded from database via API
  const [etaPadding, setEtaPadding] = useState(15);
  const [googlePlaceId, setGooglePlaceId] = useState('');
  
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState('');
  const [testingConnection, setTestingConnection] = useState(false);
  const { toast } = useToast();

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
      // Format date as ISO string for the API
      const formattedDate = date.toISOString();
      const response = await fetch(`/api/dashboard/today?date=${formattedDate}`);
      const data = await response.json();

      if (data.success && data.appointments) {
        setAppointments(data.appointments);
      } else {
        // If we can't get real data, show empty state
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
    // Fetch appointment counts for the month for calendar highlighting
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
    
    // Fetch weather data for calendar tooltips
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

  // Fetch services and messages when component mounts
  useEffect(() => {
    // Fetch main services from your API
    fetch('/api/services')
      .then(response => response.json())
      .then(data => {
        if (data.success && data.services) {
          // Mark these as main services (not add-ons)
          const mainServices = data.services.map((service: any) => ({
            ...service,
            isAddon: false
          }));

          // Fetch add-on services
          fetch('/api/addon-services')
            .then(response => response.json())
            .then(addonData => {
              if (addonData.success && addonData.addOns) {
                // Mark these as add-on services
                const addonServices = addonData.addOns.map((addon: any) => ({
                  name: addon.name,
                  priceRange: addon.price,
                  description: addon.description || 'Add-on service', // This will be 'overview'
                  overview: addon.overview || addon.description || 'Add-on service',
                  detailedDescription: addon.detailedDescription || addon.description || 'Add-on service',
                  duration: '30-60 min',
                  durationHours: 0.5,
                  isAddon: true
                }));

                // Combine main services and add-ons
                setServices([...mainServices, ...addonServices]);
              } else {
                setServices(mainServices);
              }
            })
            .catch(error => {
              console.error('Error fetching add-on services:', error);
              setServices(mainServices);
            });
        }
      })
      .catch(error => {
        console.error('Error fetching services:', error);
      });

    // Fetch business settings from database
    const fetchBusinessSettings = async () => {
      try {
        const response = await fetch('/api/business-settings', {
          credentials: 'include'
        });
        const data = await response.json();
        
        if (data.success && data.settings) {
          setEtaPadding(data.settings.etaPadding || 15);
          setGooglePlaceId(data.settings.googlePlaceId || '');
        }
      } catch (error) {
        console.error('Error fetching business settings:', error);
      }
    };
    
    // Fetch recent messages from backend
    const fetchRecentMessages = async () => {
      try {
        const response = await fetch('/api/dashboard/messages');
        const data = await response.json();

        if (data.success && data.messages) {
          setMessages(data.messages);
        } else {
          setMessages([]);
          console.error('Failed to fetch messages:', data.error);
        }
      } catch (error) {
        console.error('Error fetching messages:', error);
        setMessages([]);
      }
    };

    fetchBusinessSettings();
    fetchRecentMessages();
  }, []);

  // Format date for display
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "MMM d, yyyy h:mm a");
    } catch (error) {
      return dateString;
    }
  };

  // Navigate to directions page
  const goToDirections = (address: string, phone: string) => {
    setLocation(`/directions?address=${encodeURIComponent(address)}&phone=${encodeURIComponent(phone)}`);
  };

  // Navigate to service history
  const viewServiceHistory = (phone: string) => {
    setLocation(`/service-history?phone=${encodeURIComponent(phone)}`);
  };

  // Helper function to extract price from service description
  const extractPriceFromService = (serviceName: string): number => {
    // Find the service in the services list
    const service = services.find(s => s.name === serviceName);

    if (service) {
      // Extract the numeric part from the price range (e.g., "$150-250" -> 200)
      const priceRange = service.priceRange;
      const priceMatch = priceRange.match(/\$?(\d+)(?:–|\-)?\$?(\d+)?/);

      if (priceMatch) {
        if (priceMatch[2]) {
          // If there's a range, use the average
          return (parseInt(priceMatch[1]) + parseInt(priceMatch[2])) / 2;
        } else {
          // If there's a single price
          return parseInt(priceMatch[1]);
        }
      }
    }

    // Default fallback price
    return 150;
  };

  // Open invoice modal for an appointment
  const openInvoiceModal = async (appointment: Appointment) => {
    // Fetch customer email from database
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

    // Prepare the main service as the first invoice item
    const mainService = {
      service: appointment.service,
      price: extractPriceFromService(appointment.service),
      quantity: 1
    };

    const subtotal = mainService.price;
    const tax = invoiceSettings.taxEnabled ? Math.round(subtotal * invoiceSettings.taxRate * 100) / 100 : 0;
    const total = subtotal + tax;

    // Prepare the invoice details
    setInvoiceDetails({
      customerName: appointment.customerName,
      customerEmail: customerEmail,
      phone: appointment.phone,
      address: appointment.address,
      vehicleInfo: appointment.vehicleInfo || "",
      serviceDate: new Date().toLocaleDateString(),
      items: [mainService],
      subtotal,
      tax,
      total,
      notes: "Thank you for choosing Clean Machine Auto Detail!",
      includeReviewLink: true
    });

    setShowInvoiceModal(true);
  };

  // Handle service edit
  const handleServiceEdit = () => {
    if (selectedService) {
      setIsEditingService(true);
    } else {
      toast({
        title: "No Service Selected",
        description: "Please select a service to edit first.",
        variant: "destructive",
      });
    }
  };

  // Handle service save
  const handleServiceSave = () => {
    if (selectedService) {
      // Here you would update the service in your backend
      // For now, just update the local state
      const updatedServices = services.map(service => 
        service.name === selectedService.name ? selectedService : service
      );

      setServices(updatedServices);
      setIsEditingService(false);

      toast({
        title: "Service Updated",
        description: `${selectedService.name} has been updated successfully.`,
      });
    }
  };

  // Handle direct message
  const handleDirectMessage = (phone: string) => {
    // In a real app, this would open your messaging app with the customer's number
    toast({
      title: "Direct Message",
      description: `Opening direct message to ${phone}`,
    });

    // For web, you could open the SMS app with a prefilled number
    window.open(`sms:${phone}`);
  };

  // Handle call
  const handleCall = (phone: string) => {
    // Open the phone app with the number
    window.open(`tel:${phone}`);
  };

  // Filter appointments based on search
  const filteredAppointments = searchQuery 
    ? appointments.filter(apt => 
        apt.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        apt.phone.includes(searchQuery) ||
        apt.service.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (apt.vehicleInfo && apt.vehicleInfo.toLowerCase().includes(searchQuery.toLowerCase())))
    : appointments;

  // Filter messages based on search
  const filteredMessages = searchQuery
    ? messages.filter(msg => 
        msg.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        msg.phone.includes(searchQuery) ||
        msg.content.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages;

  return (
    <div className="flex h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 text-white overflow-hidden">
      {/* Collapsible Sidebar */}
      <DashboardSidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        mobileOpen={mobileSidebarOpen}
        onMobileOpenChange={setMobileSidebarOpen}
      />

      {/* Main Content Area - Independently Scrollable */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="bg-blue-950 border-b border-blue-800 p-4 md:p-5 flex-shrink-0 relative z-10 overflow-visible">
          <div className="flex flex-col space-y-3 sm:flex-row sm:space-y-0 sm:space-x-3 justify-between items-center">
            <div className="flex items-center gap-3 md:gap-4 w-full sm:w-auto">
              {/* Mobile Menu Button */}
              <Button
                size="sm"
                variant="ghost"
                className="md:hidden text-white hover:bg-blue-900"
                onClick={() => setMobileSidebarOpen(true)}
                data-testid="button-mobile-menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
              
              <img 
                src={logoImage} 
                alt="Clean Machine Logo" 
                className="h-24 w-24 md:h-28 md:w-28 object-cover drop-shadow-lg mix-blend-screen scale-125"
                style={{ filter: 'brightness(1.1)' }}
              />
              <div>
                <h1 className="text-lg md:text-2xl font-bold text-white">
                  CLEAN MACHINE
                </h1>
                <p className="text-xs md:text-sm text-blue-200">Dashboard</p>
              </div>
            </div>

            <div className="w-full sm:w-auto sm:flex-1 sm:max-w-md">
              <AiHelpSearch />
            </div>

            <div className="flex gap-1.5">
              <Button
                size="sm"
                className="h-9 w-9 rounded-lg border border-white/10 bg-white/15 hover:bg-white/25 p-0 text-white"
                onClick={() => setDarkMode(!darkMode)}
                data-testid="button-dark-mode"
              >
                {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Button
                size="sm"
                className="h-9 px-3 gap-1.5 rounded-lg border border-white/10 bg-white/15 hover:bg-white/25 text-sm font-semibold tracking-tight shadow-sm transition-all text-white"
                onClick={() => setLocation('/analytics')}
                data-testid="button-analytics"
              >
                <TrendingUp className="h-4 w-4" />
                <span className="hidden sm:inline">Analytics</span>
              </Button>
              <Button
                size="sm"
                className="h-9 px-3 gap-1.5 rounded-lg border border-white/10 bg-white/15 hover:bg-white/25 text-sm font-semibold tracking-tight shadow-sm transition-all text-white"
                onClick={() => setLocation('/messages')}
                data-testid="button-messages"
              >
                <MessageSquare className="h-4 w-4" />
                <span className="hidden sm:inline">Messages</span>
              </Button>
              <Button 
                size="sm"
                onClick={() => setLocation('/')} 
                className="h-9 px-3 gap-1.5 rounded-lg border border-white/10 bg-white/15 hover:bg-white/25 text-sm font-semibold tracking-tight shadow-sm transition-all text-white"
                data-testid="button-home"
              >
                <Home className="h-4 w-4" />
                <span className="hidden sm:inline">Home</span>
              </Button>
            </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {/* Actionable Notifications Banner */}
          <div className="mb-6">
            <ActionableNotificationsBanner />
          </div>

          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-4">
          {/* Monthly Statistics Bar */}
          <Card className="bg-gradient-to-br from-blue-600 to-blue-800 text-white shadow-xl">
            <CardContent className="py-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
                <div className="text-center px-1">
                  <div className="text-2xl sm:text-3xl font-bold">{Object.values(appointmentCounts).reduce((sum, count) => sum + count, 0)}</div>
                  <div className="text-xs text-blue-100 line-clamp-2">Total This Month</div>
                </div>
                <div className="text-center px-1">
                  <div className="text-2xl sm:text-3xl font-bold">{Object.keys(appointmentCounts).length}</div>
                  <div className="text-xs text-blue-100 line-clamp-2">Busy Days</div>
                </div>
                <div className="text-center px-1">
                  <div className="text-2xl sm:text-3xl font-bold">{Math.max(...Object.values(appointmentCounts), 0)}</div>
                  <div className="text-xs text-blue-100 line-clamp-2">Peak Daily</div>
                </div>
                <div className="text-center px-1">
                  <div className="text-2xl sm:text-3xl font-bold">{filteredAppointments.length}</div>
                  <div className="text-xs text-blue-100 line-clamp-2">Today</div>
                </div>
                <div className="text-center px-1">
                  <div className="text-2xl sm:text-3xl font-bold truncate">
                    ${filteredAppointments.reduce((sum, apt) => {
                      const price = apt.price ? parseInt(apt.price.replace(/\D/g, '')) || 150 : 150;
                      return sum + price;
                    }, 0).toLocaleString()}
                  </div>
                  <div className="text-xs text-blue-100 line-clamp-2">Today's Revenue</div>
                </div>
                <div className="text-center px-1">
                  <div className="text-2xl sm:text-3xl font-bold">
                    {filteredAppointments.filter(apt => 
                      apt.status !== 'completed' && apt.status !== 'cancelled'
                    ).length}
                  </div>
                  <div className="text-xs text-blue-100 line-clamp-2">Uncompleted</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Large Central Calendar */}
            <div className="lg:col-span-2 space-y-4">
              <Card className="rounded-xl border-none bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 shadow-2xl overflow-hidden" data-testid="calendar-card">
                <CardHeader className="bg-gradient-to-r from-blue-600 to-purple-600 text-white pb-6">
                  <CardTitle className="flex items-center justify-between text-2xl">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-9 w-9 p-0 bg-white/10 hover:bg-white/20 text-white transition-all"
                          onClick={() => {
                            const newMonth = new Date(currentMonth);
                            newMonth.setMonth(newMonth.getMonth() - 1);
                            setCurrentMonth(newMonth);
                          }}
                          data-testid="button-prev-month"
                          aria-label="Previous month"
                        >
                          <ChevronLeft className="h-5 w-5" />
                        </Button>
                        <div className="px-2">
                          <div className="text-2xl font-bold">{format(currentMonth, 'MMMM yyyy')}</div>
                          <div className="text-sm text-blue-100 font-normal">
                            {appointmentCounts && Object.values(appointmentCounts).reduce((a, b) => a + b, 0)} appointments this month
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-9 w-9 p-0 bg-white/10 hover:bg-white/20 text-white transition-all"
                          onClick={() => {
                            const newMonth = new Date(currentMonth);
                            newMonth.setMonth(newMonth.getMonth() + 1);
                            setCurrentMonth(newMonth);
                          }}
                          data-testid="button-next-month"
                          aria-label="Next month"
                        >
                          <ChevronRight className="h-5 w-5" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <TooltipProvider>
                        <Tooltip delayDuration={200}>
                          <TooltipTrigger asChild>
                            <button 
                              className="p-2 rounded-lg bg-white/20 hover:bg-white/30 backdrop-blur-sm transition-all"
                              data-testid="button-calendar-legend"
                            >
                              <HelpCircle className="h-4 w-4 text-white" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="left" className="max-w-sm p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl">
                            <div className="space-y-3">
                              <div className="font-semibold text-sm border-b pb-2 dark:border-gray-600">
                                📖 Calendar Legend
                              </div>
                              
                              {/* Appointment Badges */}
                              <div className="space-y-2">
                                <div className="text-xs font-medium text-gray-700 dark:text-gray-300">Appointment Indicators:</div>
                                <div className="flex items-center gap-2 text-xs">
                                  <div className="w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center font-bold text-[10px]">3</div>
                                  <span className="text-gray-600 dark:text-gray-400">Number of appointments</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs">
                                  <div className="flex gap-0.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                  </div>
                                  <span className="text-gray-600 dark:text-gray-400">Quick visual count (max 3 dots)</span>
                                </div>
                              </div>
                              
                              {/* Appointment Card Colors */}
                              <div className="space-y-2 border-t pt-2 dark:border-gray-600">
                                <div className="text-xs font-medium text-gray-700 dark:text-gray-300">Appointment Card Colors:</div>
                                <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">Colors cycle to help distinguish between appointments</div>
                                <div className="grid grid-cols-2 gap-1.5">
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-3 h-3 bg-purple-500 rounded"></div>
                                    <span className="text-[10px] text-gray-600 dark:text-gray-400">1st appointment</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-3 h-3 bg-blue-500 rounded"></div>
                                    <span className="text-[10px] text-gray-600 dark:text-gray-400">2nd appointment</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-3 h-3 bg-green-500 rounded"></div>
                                    <span className="text-[10px] text-gray-600 dark:text-gray-400">3rd appointment</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-3 h-3 bg-orange-500 rounded"></div>
                                    <span className="text-[10px] text-gray-600 dark:text-gray-400">4th appointment</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-3 h-3 bg-pink-500 rounded"></div>
                                    <span className="text-[10px] text-gray-600 dark:text-gray-400">5th+ appointments</span>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Weather Icons */}
                              <div className="space-y-2 border-t pt-2 dark:border-gray-600">
                                <div className="text-xs font-medium text-gray-700 dark:text-gray-300">Weather Icons:</div>
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2 text-xs">
                                    <span className="text-lg">☀️</span>
                                    <span className="text-gray-600 dark:text-gray-400">Sunny</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-xs">
                                    <span className="text-lg">⛅</span>
                                    <span className="text-gray-600 dark:text-gray-400">Partly Cloudy</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-xs">
                                    <span className="text-lg">☁️</span>
                                    <span className="text-gray-600 dark:text-gray-400">Cloudy</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-xs">
                                    <span className="text-lg">🌧️</span>
                                    <span className="text-gray-600 dark:text-gray-400">Rainy</span>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="text-[10px] text-gray-500 dark:text-gray-500 border-t pt-2 dark:border-gray-600">
                                💡 Tip: Hover over any date to see details before clicking!
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="bg-white/20 hover:bg-white/30 text-white border-white/20 backdrop-blur-sm transition-all"
                        onClick={() => setTodayDate(new Date())}
                        data-testid="button-today"
                      >
                        <Clock className="h-4 w-4 mr-2" />
                        Today
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="bg-white/20 hover:bg-white/30 text-white border-white/20 backdrop-blur-sm transition-all"
                        onClick={async () => {
                          toast({
                            title: "Checking Weather",
                            description: "Analyzing weather conditions for upcoming appointments...",
                          });
                        }}
                        data-testid="button-weather"
                      >
                        <CloudRain className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-8">
                  <style>
                    {`
                      .modern-calendar .rdp {
                        --rdp-cell-size: 70px;
                        --rdp-accent-color: #3b82f6;
                      }

                      .modern-calendar .rdp-months {
                        width: 100%;
                      }

                      .modern-calendar .rdp-month {
                        width: 100%;
                      }

                      .modern-calendar .rdp-table {
                        width: 100%;
                        max-width: 100%;
                      }

                      .modern-calendar .rdp-head_cell {
                        color: #6b7280;
                        font-weight: 600;
                        font-size: 0.875rem;
                        padding: 8px 0;
                        text-transform: uppercase;
                        letter-spacing: 0.05em;
                      }

                      .modern-calendar .rdp-cell {
                        padding: 2px;
                      }

                      .modern-calendar .rdp-day {
                        width: 70px;
                        height: 70px;
                        font-size: 16px;
                        font-weight: 500;
                        border-radius: 12px;
                        position: relative;
                        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                        cursor: pointer;
                      }

                      .modern-calendar .rdp-day:hover:not(.rdp-day_selected):not(.rdp-day_disabled) {
                        background: linear-gradient(135deg, #dbeafe 0%, #e0e7ff 100%);
                        transform: translateY(-2px);
                        box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);
                      }

                      .modern-calendar .rdp-day_selected {
                        background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%) !important;
                        color: white !important;
                        box-shadow: 0 8px 20px rgba(59, 130, 246, 0.4);
                        transform: scale(1.05);
                      }

                      .modern-calendar .rdp-day_today:not(.rdp-day_selected) {
                        background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
                        color: #1e40af;
                        font-weight: 700;
                        border: 2px solid #3b82f6;
                      }

                      .modern-calendar .rdp-day_disabled {
                        opacity: 0.3;
                        cursor: not-allowed;
                      }

                      .modern-calendar .rdp-button {
                        width: 100%;
                        height: 100%;
                      }

                      .modern-calendar .rdp-nav_button {
                        width: 40px;
                        height: 40px;
                        border-radius: 10px;
                        background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
                        transition: all 0.2s;
                      }

                      .modern-calendar .rdp-nav_button:hover {
                        background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
                        color: white;
                        transform: scale(1.1);
                      }

                      .modern-calendar .rdp-caption {
                        display: none;
                      }
                      
                      .modern-calendar .rdp-nav {
                        display: none;
                      }

                      .appointment-badge {
                        position: absolute;
                        top: 6px;
                        right: 6px;
                        min-width: 22px;
                        height: 22px;
                        padding: 0 6px;
                        background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                        color: white;
                        font-size: 11px;
                        font-weight: 700;
                        border-radius: 11px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        box-shadow: 0 2px 8px rgba(239, 68, 68, 0.4);
                        animation: pulse-badge 2s infinite;
                      }

                      @keyframes pulse-badge {
                        0%, 100% { transform: scale(1); }
                        50% { transform: scale(1.1); }
                      }

                      .appointment-dots {
                        position: absolute;
                        bottom: 6px;
                        left: 50%;
                        transform: translateX(-50%);
                        display: flex;
                        gap: 3px;
                        align-items: center;
                      }

                      .appointment-dot {
                        width: 8px;
                        height: 8px;
                        border-radius: 50%;
                        animation: dot-bounce 1.4s infinite ease-in-out;
                      }

                      .appointment-dot:nth-child(1) {
                        background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%);
                        animation-delay: -0.32s;
                      }

                      .appointment-dot:nth-child(2) {
                        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                        animation-delay: -0.16s;
                      }

                      .appointment-dot:nth-child(3) {
                        background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
                      }

                      @keyframes dot-bounce {
                        0%, 80%, 100% { transform: scale(0.8); opacity: 0.7; }
                        40% { transform: scale(1.2); opacity: 1; }
                      }

                      .day-content {
                        position: relative;
                        width: 100%;
                        height: 100%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                      }
                    `}
                  </style>
                  <div className="modern-calendar">
                    <Calendar
                      mode="single"
                      selected={todayDate}
                      month={currentMonth}
                      onMonthChange={setCurrentMonth}
                      onSelect={(date) => {
                        if (date) {
                          setTodayDate(date);
                          const formattedDate = date.toISOString();
                          fetch(`/api/dashboard/today?date=${formattedDate}`)
                            .then(response => response.json())
                            .then(data => {
                              if (data.success && data.appointments) {
                                setAppointments(data.appointments);
                              } else {
                                setAppointments([]);
                              }
                            })
                            .catch(error => {
                              console.error('Error fetching appointments:', error);
                              setAppointments([]);
                            });
                        }
                      }}
                      className="w-full"
                      classNames={{
                        months: "w-full",
                        month: "w-full",
                        table: "w-full border-collapse",
                        head_row: "flex w-full",
                        head_cell: "flex-1 text-center",
                        row: "flex w-full mt-1",
                        cell: "flex-1 text-center p-0",
                        day: "w-full h-full",
                        nav_button_previous: "absolute left-2 z-10",
                        nav_button_next: "absolute right-2 z-10",
                        caption: "flex justify-center pt-1 relative items-center text-xl font-bold text-gray-800 dark:text-gray-100 mb-4 min-h-[40px]",
                      }}
                      components={{
                        DayContent: ({ date }) => {
                          const dateStr = date.toISOString().split('T')[0];
                          const count = appointmentCounts[dateStr] || 0;
                          const weather = weatherData[dateStr];
                          
                          const dayContent = (
                            <div className="day-content">
                              <span className="relative z-10">{date.getDate()}</span>
                              {count > 0 && (
                                <>
                                  <div className="appointment-badge" data-testid={`badge-appointment-${dateStr}`}>
                                    {count}
                                  </div>
                                  <div className="appointment-dots">
                                    {Array.from({ length: Math.min(count, 3) }).map((_, i) => (
                                      <div key={i} className="appointment-dot" />
                                    ))}
                                    {count > 3 && (
                                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400 ml-1">
                                        +{count - 3}
                                      </span>
                                    )}
                                  </div>
                                </>
                              )}
                              {weather && weather.icon && (
                                <div className="absolute top-1 left-1 text-lg" style={{ zIndex: 5 }}>
                                  {weather.icon}
                                </div>
                              )}
                            </div>
                          );
                          
                          // Only show tooltip if there's appointment or weather data
                          if (count > 0 || weather) {
                            return (
                              <TooltipProvider>
                                <Tooltip delayDuration={200}>
                                  <TooltipTrigger asChild>
                                    {dayContent}
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-xs p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl">
                                    <div className="space-y-2">
                                      <div className="font-semibold text-sm border-b pb-1 dark:border-gray-600">
                                        {format(date, 'EEE, MMM d')}
                                      </div>
                                      
                                      {count > 0 && (
                                        <div className="text-xs">
                                          <div className="font-medium text-blue-600 dark:text-blue-400 mb-1">
                                            📅 {count} Appointment{count > 1 ? 's' : ''}
                                          </div>
                                          <div className="text-gray-600 dark:text-gray-400">
                                            Click to view details
                                          </div>
                                        </div>
                                      )}
                                      
                                      {weather && (
                                        <div className="text-xs border-t pt-2 dark:border-gray-600">
                                          <div className="flex items-center justify-between">
                                            <span className="text-2xl">{weather.icon}</span>
                                            <div className="text-right">
                                              <div className="font-medium">{weather.high}°F / {weather.low}°F</div>
                                              <div className="text-gray-500 dark:text-gray-400">{weather.description}</div>
                                            </div>
                                          </div>
                                          {weather.rainChance > 20 && (
                                            <div className="mt-1 text-blue-600 dark:text-blue-400">
                                              🌧️ {weather.rainChance}% chance of rain
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            );
                          }
                          
                          return dayContent;
                        },
                      }}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Selected Day Appointments */}
              <Card className="bg-blue-50/95 dark:bg-gray-800/95 text-gray-800 dark:text-gray-100 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center text-blue-800 dark:text-blue-200">
                    <CalendarClock className="mr-2 h-5 w-5 text-blue-600 dark:text-blue-400" />
                    {format(todayDate, 'MMM d, yyyy') === format(new Date(), 'MMM d, yyyy') 
                      ? "Today's Schedule" 
                      : `Schedule for ${format(todayDate, 'MMM d, yyyy')}`} ({filteredAppointments.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {filteredAppointments.length > 0 ? (
                    <div className="space-y-4">
                      {filteredAppointments.map((appointment, index) => {
                        // Color-code appointments for easier distinction
                        const colors = [
                          'border-l-purple-500 bg-purple-50/90 dark:bg-purple-950/30',
                          'border-l-blue-500 bg-blue-50/90 dark:bg-blue-950/30',
                          'border-l-green-500 bg-green-50/90 dark:bg-green-950/30',
                          'border-l-orange-500 bg-orange-50/90 dark:bg-orange-950/30',
                          'border-l-pink-500 bg-pink-50/90 dark:bg-pink-950/30'
                        ];
                        const colorClass = colors[index % colors.length];
                        
                        return (
                        <Card key={appointment.id} className={`border-l-4 ${colorClass} hover:shadow-lg transition-all duration-300 dark:bg-gray-800/90`}>
                          <CardHeader className="pb-2">
                            <div className="flex justify-between items-start">
                              <div>
                                <CardTitle className="text-lg text-blue-700 dark:text-blue-300">{appointment.customerName}</CardTitle>
                                <CardDescription>{appointment.service}</CardDescription>
                              </div>
                              <Badge variant="outline" className="font-mono bg-blue-50 dark:bg-gray-700 text-blue-700 dark:text-blue-300">
                                {formatDate(appointment.time).split(',')[1]}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="pb-2 space-y-2">
                            <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                              <Car className="mr-2 h-4 w-4" />
                              {appointment.vehicleInfo || "Vehicle info not available"}
                            </div>
                            <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                              <Navigation className="mr-2 h-4 w-4" />
                              {appointment.address}
                            </div>
                            <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                              <Phone className="mr-2 h-4 w-4" />
                              {appointment.phone}
                            </div>
                          </CardContent>
                          <CardFooter className="flex justify-between pt-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => viewServiceHistory(appointment.phone)}
                            >
                              History
                            </Button>
                            <div className="space-x-2">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleCall(appointment.phone)}
                              >
                                <Phone className="h-4 w-4 mr-2" />
                                Call
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => {
                                  setChatCustomer({ phone: appointment.phone, name: appointment.customerName });
                                  setShowBusinessChat(true);
                                }}
                              >
                                <MessageSquare className="h-4 w-4 mr-2" />
                                Chat
                              </Button>
                              <Button 
                                variant="default" 
                                size="sm"
                                onClick={() => goToDirections(appointment.address, appointment.phone)}
                              >
                                <Navigation className="h-4 w-4 mr-2" />
                                Navigate
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50 border-green-300 dark:border-green-700"
                                onClick={() => openInvoiceModal(appointment)}
                              >
                                <FileText className="h-4 w-4 mr-2" />
                                Send Invoice
                              </Button>
                            </div>
                          </CardFooter>
                        </Card>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      {searchQuery ? "No matching appointments found" : "No appointments scheduled for today"}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right Side Panel - Quick Actions and Insights */}
            <div className="space-y-4">
              {/* Daily Insights Card */}
              <Card className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30 text-gray-800 dark:text-gray-100 shadow-lg border-purple-200 dark:border-purple-800">
                <CardHeader>
                  <CardTitle className="text-purple-800 dark:text-purple-300 flex items-center">
                    <Star className="mr-2 h-5 w-5 text-purple-600 dark:text-purple-400" />
                    {format(todayDate, 'MMM d')} Insights
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {filteredAppointments.length > 0 ? (
                    <>
                      <div className="flex items-center justify-between p-2 bg-white dark:bg-gray-700 rounded-lg">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Appointments:</span>
                        <Badge className="bg-purple-600">{filteredAppointments.length}</Badge>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-white dark:bg-gray-700 rounded-lg">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Popular Service:</span>
                        <Badge variant="outline" className="border-purple-400 text-purple-700">
                          {(() => {
                            const serviceCounts = filteredAppointments.reduce((acc: any, apt) => {
                              acc[apt.service] = (acc[apt.service] || 0) + 1;
                              return acc;
                            }, {});
                            const mostPopular = Object.entries(serviceCounts).sort((a: any, b: any) => b[1] - a[1])[0];
                            return mostPopular ? mostPopular[0] : 'N/A';
                          })()}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-white dark:bg-gray-700 rounded-lg">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Revenue:</span>
                        <span className="text-lg font-bold text-green-600">
                          ${(() => {
                            const total = filteredAppointments.reduce((sum, apt) => {
                              const price = apt.price ? parseInt(apt.price.replace(/\D/g, '')) || 150 : 150;
                              return sum + price;
                            }, 0);
                            return total.toLocaleString();
                          })()}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                      <p>No appointments for this date</p>
                      <p className="text-sm mt-1">Select a different date to view insights</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="mt-4 bg-white/95 dark:bg-gray-800/95 text-gray-800 dark:text-gray-100 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-blue-800 dark:text-blue-200">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {/* New Invoice Quick Action Button - auto-populates with last appointment info */}
                  <Button 
                    className="w-full justify-start bg-green-600 hover:bg-green-700" 
                    onClick={() => {
                      // Find most recently completed appointment to auto-populate invoice
                      const completedAppointments = appointments.filter(apt => 
                        new Date(apt.date) < new Date() && 
                        apt.status === 'completed'
                      ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                      if (completedAppointments.length > 0) {
                        const lastCompleted = completedAppointments[0];

                        // Extract price from the service (handle ranges like $150-200)
                        const extractPrice = (priceString?: string): number => {
                          if (!priceString) return 150;

                          // Extract the first number from strings like "$150-200" or "$150"
                          const match = priceString.match(/\$?(\d+)/);
                          if (match && match[1]) {
                            return parseFloat(match[1]);
                          }
                          return 150; // Default price if extraction fails
                        };

                        const basePrice = extractPrice(lastCompleted.price);
                        const calculatedTax = invoiceSettings.taxEnabled ? 
                          parseFloat((basePrice * invoiceSettings.taxRate).toFixed(2)) : 0;
                        const totalPrice = basePrice + calculatedTax;

                        // Auto-populate invoice details from the appointment
                        setInvoiceDetails({
                          customerName: lastCompleted.customerName,
                          phone: lastCompleted.phone,
                          customerEmail: lastCompleted.email || '',
                          address: lastCompleted.address,
                          vehicleInfo: lastCompleted.vehicleInfo || '',
                          serviceDate: format(new Date(lastCompleted.date), 'PPP'),
                          items: [{
                            service: lastCompleted.service,
                            price: basePrice,
                            quantity: 1
                          }],
                          subtotal: basePrice,
                          tax: calculatedTax,
                          total: totalPrice,
                          notes: `Thank you for choosing Clean Machine Auto Detail! We hope you're enjoying your freshly detailed ${lastCompleted.vehicleInfo || 'vehicle'}.`,
                          includeReviewLink: true
                        });

                        // Show the invoice modal
                        setShowInvoiceModal(true);
                      } else {
                        // No completed appointments found
                        toast({
                          title: "No Completed Appointments",
                          description: "No recently completed appointments found to generate an invoice.",
                          variant: "destructive"
                        });
                      }
                    }}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Send Invoice & Thank You
                  </Button>

                  <Button className="w-full justify-start bg-blue-600 hover:bg-blue-700" onClick={() => setLocation('/service-history')}>
                    <User className="mr-2 h-4 w-4" />
                    Customer Service History
                  </Button>

                  <Button className="w-full justify-start bg-purple-600 hover:bg-purple-700" onClick={() => setLocation('/user-management')}>
                    <Users className="mr-2 h-4 w-4" />
                    User Management
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Services Tab */}
        <TabsContent value="services" className="space-y-4">
          {/* Added refresh button and heading for the Services tab */}
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-100">Manage Services</h2>
            <Button
              onClick={async () => {
                try {
                  const response = await fetch('/api/reload-sheets', { method: 'POST' });
                  const data = await response.json();
                  if (data.success) {
                    toast({
                      title: "Data Refreshed",
                      description: "Google Sheets data has been reloaded successfully",
                    });
                    // Refresh the services data
                    window.location.reload();
                  } else {
                    toast({
                      title: "Refresh Failed",
                      description: "Failed to reload Google Sheets data",
                      variant: "destructive"
                    });
                  }
                } catch (error) {
                  toast({
                    title: "Error",
                    description: "An error occurred while refreshing data",
                    variant: "destructive"
                  });
                }
              }}
              variant="outline"
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh from Google Sheets
            </Button>
          </div>

          <Tabs defaultValue="services" className="w-full">
            <TabsList className="grid w-full grid-cols-4 bg-gray-900/50">
              <TabsTrigger value="services">Services</TabsTrigger>
              <TabsTrigger value="addons">Add-Ons</TabsTrigger>
              <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
              <TabsTrigger value="today">Today</TabsTrigger>
            </TabsList>
          
            <TabsContent value="services" className="space-y-4">
              <Card className="bg-blue-50/95 dark:bg-gray-800/95 text-gray-800 dark:text-gray-100 shadow-lg">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div>
                    <CardTitle className="flex items-center text-blue-800 dark:text-blue-200">
                      <DollarSign className="mr-2 h-5 w-5 text-blue-600 dark:text-blue-400" />
                      Manage {serviceType === 'main' ? 'Main Services' : 'Add-on Services'}
                    </CardTitle>
                    <CardDescription>
                      View and update your service offerings and pricing
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {/* Toggle between Main Services and Add-ons */}
                    <div className="flex items-center bg-blue-100 dark:bg-gray-700 rounded-lg p-1 mr-2">
                      <button
                        className={`px-3 py-1 text-sm rounded-md transition-colors ${
                          serviceType === 'main' 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-transparent text-blue-800 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-gray-600'
                        }`}
                        onClick={() => setServiceType('main')}
                      >
                        Main Services
                      </button>
                      <button
                        className={`px-3 py-1 text-sm rounded-md transition-colors ${
                          serviceType === 'addon' 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-transparent text-blue-800 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-gray-600'
                        }`}
                        onClick={() => setServiceType('addon')}
                      >
                        Add-ons
                      </button>
                    </div>
                    {isEditingService ? (
                      <Button onClick={handleServiceSave} className="bg-blue-600 hover:bg-blue-700">
                        <Save className="h-4 w-4 mr-2" />
                        Save Changes
                      </Button>
                    ) : (
                      <Button onClick={handleServiceEdit} className="bg-blue-600 hover:bg-blue-700">
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit Services
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-blue-900">Image</TableHead>
                        <TableHead className="text-blue-900">Service Name</TableHead>
                        <TableHead className="text-blue-900">Price Range</TableHead>
                        <TableHead className="text-blue-900">Overview</TableHead>
                        <TableHead className="text-blue-900">Detailed Description</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {services
                        .filter(service => 
                          serviceType === 'main' 
                            ? !service.isAddon 
                            : service.isAddon
                        )
                        .map((service) => (
                        <TableRow 
                          key={service.name}
                          className={selectedService?.name === service.name ? "bg-blue-50" : ""}
                          onClick={() => setSelectedService(service)}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <div className="flex flex-col gap-2 items-center">
                              {service.imageUrl && (
                                <img 
                                  src={service.imageUrl} 
                                  alt={service.name}
                                  className="w-20 h-20 object-cover rounded-md"
                                />
                              )}
                              <input
                                id={`file-upload-${service.name}`}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const formData = new FormData();
                                    formData.append('image', file);
                                    try {
                                      // Upload the image
                                      const response = await fetch('/api/upload-service-image', {
                                        method: 'POST',
                                        body: formData
                                      });
                                      const data = await response.json();
                                      if (data.success) {
                                        // Save the image URL to database
                                        const saveResponse = await fetch('/api/save-service-image', {
                                          method: 'POST',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({
                                            serviceName: service.name,
                                            imageUrl: data.imageUrl
                                          })
                                        });
                                        
                                        if (!saveResponse.ok) {
                                          toast({
                                            title: "Save failed",
                                            description: "Image uploaded but failed to save to database",
                                            variant: "destructive"
                                          });
                                          return;
                                        }
                                        
                                        const saveData = await saveResponse.json();
                                        
                                        if (saveData.success) {
                                          // Update the service with the new image URL
                                          const updatedService = { ...service, imageUrl: data.imageUrl };
                                          setServices(services.map(s => s.name === service.name ? updatedService : s));
                                          toast({
                                            title: "Image uploaded",
                                            description: "Service image has been saved successfully"
                                          });
                                        } else {
                                          toast({
                                            title: "Save failed",
                                            description: "Image uploaded but failed to save to database",
                                            variant: "destructive"
                                          });
                                        }
                                      }
                                    } catch (error) {
                                      toast({
                                        title: "Upload failed",
                                        description: "Failed to upload image",
                                        variant: "destructive"
                                      });
                                    }
                                  }
                                }}
                              />
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="text-xs"
                                type="button"
                                onClick={() => document.getElementById(`file-upload-${service.name}`)?.click()}
                                data-testid={`button-upload-image-${service.name}`}
                              >
                                {service.imageUrl ? 'Change' : 'Upload'} Image
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">
                            {isEditingService && selectedService?.name === service.name ? (
                              <Input 
                                value={selectedService.name}
                                onChange={(e) => setSelectedService({...selectedService, name: e.target.value})}
                              />
                            ) : (
                              service.name
                            )}
                          </TableCell>
                          <TableCell>
                            {isEditingService && selectedService?.name === service.name ? (
                              <Input 
                                value={selectedService.priceRange}
                                onChange={(e) => setSelectedService({...selectedService, priceRange: e.target.value})}
                              />
                            ) : (
                              service.priceRange
                            )}
                          </TableCell>
                          <TableCell>
                            {isEditingService && selectedService?.name === service.name ? (
                              <Input 
                                value={selectedService.overview}
                                onChange={(e) => setSelectedService({...selectedService, overview: e.target.value})}
                                placeholder="Brief overview for service card"
                              />
                            ) : (
                              service.overview
                            )}
                          </TableCell>
                          <TableCell>
                            {isEditingService && selectedService?.name === service.name ? (
                              <textarea 
                                className="w-full min-h-[100px] p-2 border rounded-md"
                                value={selectedService.detailedDescription}
                                onChange={(e) => setSelectedService({...selectedService, detailedDescription: e.target.value})}
                                placeholder="Detailed description with bullet points (use • or - for bullets)"
                              />
                            ) : (
                              <div className="max-w-md text-sm whitespace-pre-line">
                                {service.detailedDescription}
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
            {/* Add TabsContent for addons, upcoming, and today if they exist elsewhere in your app */}
            <TabsContent value="addons" className="space-y-4">
              {/* Placeholder for Add-ons tab content */}
              <Card className="bg-blue-50/95 dark:bg-gray-800/95 text-gray-800 dark:text-gray-100 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center text-blue-800 dark:text-blue-200">
                    <DollarSign className="mr-2 h-5 w-5 text-blue-600 dark:text-blue-400" />
                    Manage Add-on Services
                  </CardTitle>
                  <CardDescription>
                    View and update your add-on service offerings and pricing
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-blue-900">Image</TableHead>
                        <TableHead className="text-blue-900">Add-on Name</TableHead>
                        <TableHead className="text-blue-900">Price</TableHead>
                        <TableHead className="text-blue-900">Description</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {services
                        .filter(service => service.isAddon)
                        .map((service) => (
                        <TableRow key={service.name}>
                          <TableCell>
                            <div className="flex flex-col gap-2 items-center">
                              {service.imageUrl && (
                                <img 
                                  src={service.imageUrl} 
                                  alt={service.name}
                                  className="w-20 h-20 object-cover rounded-md"
                                />
                              )}
                              <input
                                id={`file-upload-addon-${service.name}`}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const formData = new FormData();
                                    formData.append('image', file);
                                    try {
                                      // Upload the image
                                      const response = await fetch('/api/upload-service-image', {
                                        method: 'POST',
                                        body: formData
                                      });
                                      const data = await response.json();
                                      if (data.success) {
                                        // Save the image URL to database
                                        const saveResponse = await fetch('/api/save-service-image', {
                                          method: 'POST',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({
                                            serviceName: service.name,
                                            imageUrl: data.imageUrl
                                          })
                                        });
                                        
                                        if (!saveResponse.ok) {
                                          toast({
                                            title: "Save failed",
                                            description: "Image uploaded but failed to save to database",
                                            variant: "destructive"
                                          });
                                          return;
                                        }
                                        
                                        const saveData = await saveResponse.json();
                                        
                                        if (saveData.success) {
                                          // Update the service with the new image URL
                                          const updatedService = { ...service, imageUrl: data.imageUrl };
                                          setServices(services.map(s => s.name === service.name ? updatedService : s));
                                          toast({
                                            title: "Image uploaded",
                                            description: "Add-on image has been saved successfully"
                                          });
                                        } else {
                                          toast({
                                            title: "Save failed",
                                            description: "Image uploaded but failed to save to database",
                                            variant: "destructive"
                                          });
                                        }
                                      }
                                    } catch (error) {
                                      toast({
                                        title: "Upload failed",
                                        description: "Failed to upload image",
                                        variant: "destructive"
                                      });
                                    }
                                  }
                                }}
                              />
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="text-xs"
                                type="button"
                                onClick={() => document.getElementById(`file-upload-addon-${service.name}`)?.click()}
                                data-testid={`button-upload-image-${service.name}`}
                              >
                                {service.imageUrl ? 'Change' : 'Upload'} Image
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{service.name}</TableCell>
                          <TableCell>{service.priceRange}</TableCell>
                          <TableCell>{service.overview}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="upcoming" className="space-y-4">
              {/* Placeholder for Upcoming tab content */}
              <Card className="bg-blue-50/95 dark:bg-gray-800/95 text-gray-800 dark:text-gray-100 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center text-blue-800 dark:text-blue-200">
                    <CalendarClock className="mr-2 h-5 w-5 text-blue-600 dark:text-blue-400" />
                    Upcoming Appointments
                  </CardTitle>
                  <CardDescription>
                    View appointments scheduled for the future
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-center text-gray-500 dark:text-gray-400">Upcoming appointments list would go here.</p>
                  {/* Add logic to display upcoming appointments */}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="today" className="space-y-4">
              {/* Placeholder for Today tab content - already handled by the main 'today' tab */}
              <p>Today's appointments are displayed above.</p>
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* Notification Settings Tab */}
        <TabsContent value="notifications" className="space-y-4">
          <NotificationsSettings />
        </TabsContent>

        {/* Agent Settings Tab */}
        <TabsContent value="agent" className="space-y-4">
          <AgentSettings />
        </TabsContent>

        {/* Business Settings Tab */}
        <TabsContent value="business-settings" className="space-y-4">
          <BusinessSettings />
        </TabsContent>

        {/* Upsell Management Tab */}
        <TabsContent value="upsell" className="space-y-4">
          <UpsellManagement />
        </TabsContent>

        {/* Loyalty Program Tab */}
        <TabsContent value="loyalty" className="space-y-4">
          <LoyaltyPointsSystem />
        </TabsContent>

        {/* Recurring Services Tab */}
        <TabsContent value="recurring-services" className="space-y-4">
          <RecurringServicesManager />
        </TabsContent>

        {/* Cancellation Feedback Tab */}
        <TabsContent value="cancellation-feedback" className="space-y-4">
          <Card className="bg-blue-50/95 dark:bg-gray-800/95 text-gray-800 dark:text-gray-100 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center text-blue-800 dark:text-blue-200">
                <MessageSquare className="mr-2 h-5 w-5 text-blue-600 dark:text-blue-400" />
                Cancellation Feedback System
              </CardTitle>
              <CardDescription>
                Test and preview how customer cancellation feedback is collected and how personalized response templates are generated
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CancellationDemo />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Email Campaigns Tab */}
        <TabsContent value="email-campaigns" className="space-y-4">
          <EmailCampaignsManager />
        </TabsContent>

        {/* Customer Management Tab */}
        <TabsContent value="customers" className="space-y-4">
          <CustomerManagement />
        </TabsContent>

        {/* Gallery Photos Tab */}
        <TabsContent value="gallery" className="space-y-4">
          <GalleryPhotoManager />
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="security" className="space-y-4">
          <SecuritySettingsPage />
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <SettingsWorkspace />
        </TabsContent>
      </Tabs>
        </main>
      </div>

      {/* Invoice Modal */}
      <Dialog open={showInvoiceModal} onOpenChange={setShowInvoiceModal}>
        <DialogContent className="bg-blue-50/95 dark:bg-gray-800/95 max-w-4xl">
          <DialogHeader>
            <DialogTitle className="text-blue-800 dark:text-blue-200 flex items-center">
              <FileText className="mr-2 h-5 w-5" /> 
              Send Invoice & Thank You
            </DialogTitle>
            <DialogDescription>
              Review service details and send invoice information to your customer
            </DialogDescription>
          </DialogHeader>

          {invoiceDetails && (
            <div className="space-y-6 py-4">
              {/* Customer Selector */}
              <div className="space-y-2 pb-4 border-b border-blue-200">
                <Label htmlFor="customer-selector" className="text-blue-800 dark:text-blue-200">Select Customer</Label>
                <CustomerSelector
                  value={invoiceDetails.phone}
                  onValueChange={(customer) => {
                    setInvoiceDetails({
                      ...invoiceDetails,
                      customerName: customer.name,
                      phone: customer.phone || '',
                      customerEmail: customer.email || '',
                      address: customer.address || '',
                      vehicleInfo: customer.vehicleInfo || ''
                    });
                  }}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">Search by name, phone, or email to change invoice recipient</p>
              </div>

              {/* Customer Information Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-md font-semibold text-blue-800 dark:text-blue-200">Customer Information</h3>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <User className="h-4 w-4 text-blue-700 dark:text-blue-300" />
                      <span className="font-semibold text-gray-800">{invoiceDetails.customerName}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Phone className="h-4 w-4 text-blue-700 dark:text-blue-300" />
                      <span className="text-gray-700 dark:text-gray-300">{invoiceDetails.phone}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Navigation className="h-4 w-4 text-blue-700 dark:text-blue-300" />
                      <span className="text-gray-700 dark:text-gray-300">{invoiceDetails.address}</span>
                    </div>
                    {invoiceDetails.vehicleInfo && (
                      <div className="flex items-center space-x-2">
                        <Car className="h-4 w-4 text-blue-700 dark:text-blue-300" />
                        <span className="text-gray-700 dark:text-gray-300">{invoiceDetails.vehicleInfo}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="customerEmail" className="text-blue-800 dark:text-blue-200">Customer Email</Label>
                    <Input 
                      id="customerEmail" 
                      value={invoiceDetails.customerEmail}
                      onChange={(e) => setInvoiceDetails({
                        ...invoiceDetails,
                        customerEmail: e.target.value
                      })}
                      placeholder="customer@example.com"
                      className="border-blue-200"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400">Required to send invoice via email</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-md font-semibold text-blue-800 dark:text-blue-200">Notification Options</h3>

                  <div className="space-y-3">
                    <div className="flex items-start space-x-2">
                      <input
                        type="checkbox"
                        id="sendSms"
                        className="mt-1"
                        checked={true}
                        disabled
                      />
                      <div>
                        <Label htmlFor="sendSms">SMS Notification</Label>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Send invoice and thank you message via text message
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-2">
                      <input
                        type="checkbox"
                        id="sendEmail"
                        className="mt-1"
                        checked={invoiceDetails.customerEmail.trim() !== ''}
                        disabled={invoiceDetails.customerEmail.trim() === ''}
                      />
                      <div>
                        <Label htmlFor="sendEmail">Email Receipt</Label>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Send professional invoice as PDF via email
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-2">
                      <input
                        type="checkbox"
                        id="includeReviewLink"
                        className="mt-1"
                        checked={invoiceDetails.includeReviewLink}
                        onChange={(e) => setInvoiceDetails({
                          ...invoiceDetails,
                          includeReviewLink: e.target.checked
                        })}
                      />
                      <div>
                        <Label htmlFor="includeReviewLink">Include Review Link</Label>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Add Google review link to thank you message
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Invoice Details Section */}
              <div className="space-y-4">
                <h3 className="text-md font-semibold text-blue-800 dark:text-blue-200">Invoice Details</h3>

                <div className="rounded-md border border-blue-200 overflow-hidden">
                  <table className="min-w-full divide-y divide-blue-200">
                    <thead className="bg-blue-100">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-blue-800 dark:text-blue-200 uppercase tracking-wider">Service</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-blue-800 dark:text-blue-200 uppercase tracking-wider">Price</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-blue-800 dark:text-blue-200 uppercase tracking-wider">Quantity</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-blue-800 dark:text-blue-200 uppercase tracking-wider">Total</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-blue-800 dark:text-blue-200 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-blue-100">
                      {invoiceDetails.items.map((item, index) => (
                        <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-blue-50'}>
                          <td className="px-4 py-3 text-sm text-gray-800">{item.service}</td>
                          <td className="px-4 py-3 text-sm text-gray-800 text-right">
                            <Input
                              type="number"
                              value={item.price}
                              onChange={(e) => {
                                const updatedItems = [...invoiceDetails.items];
                                updatedItems[index].price = parseFloat(e.target.value) || 0;

                                const newSubtotal = updatedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                                const newTax = invoiceSettings.taxEnabled ? 
                                  Math.round(newSubtotal * invoiceSettings.taxRate * 100) / 100 : 0;
                                const newTotal = newSubtotal + newTax;

                                setInvoiceDetails({
                                  ...invoiceDetails,
                                  items: updatedItems,
                                  subtotal: newSubtotal,
                                  tax: newTax,
                                  total: newTotal
                                });
                              }}
                              className="w-24 h-8 text-right border-blue-200"
                            />
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-800 text-right">
                            <Input
                              type="number"
                              value={item.quantity}
                              min={1}
                              max={10}
                              onChange={(e) => {
                                const updatedItems = [...invoiceDetails.items];
                                updatedItems[index].quantity = parseInt(e.target.value) || 1;

                                const newSubtotal = updatedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                                const newTax = invoiceSettings.taxEnabled ? 
                                  Math.round(newSubtotal * invoiceSettings.taxRate * 100) / 100 : 0;
                                const newTotal = newSubtotal + newTax;

                                setInvoiceDetails({
                                  ...invoiceDetails,
                                  items: updatedItems,
                                  subtotal: newSubtotal,
                                  tax: newTax,
                                  total: newTotal
                                });
                              }}
                              className="w-20 h-8 text-right border-blue-200"
                            />
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">${(item.price * item.quantity).toFixed(2)}</td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                              onClick={() => {
                                if (invoiceDetails.items.length > 1) {
                                  const updatedItems = invoiceDetails.items.filter((_, i) => i !== index);

                                  const newSubtotal = updatedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                                  const newTax = Math.round(newSubtotal * 0.085 * 100) / 100;
                                  const newTotal = newSubtotal + newTax;

                                  setInvoiceDetails({
                                    ...invoiceDetails,
                                    items: updatedItems,
                                    subtotal: newSubtotal,
                                    tax: newTax,
                                    total: newTotal
                                  });
                                }
                              }}
                              disabled={invoiceDetails.items.length <= 1}
                            >
                              &times;
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-blue-50">
                      <tr>
                        <td colSpan={3} className="px-4 py-2 text-sm font-medium text-blue-800 dark:text-blue-200 text-right">Subtotal:</td>
                        <td className="px-4 py-2 text-sm font-medium text-gray-900 text-right">${invoiceDetails.subtotal.toFixed(2)}</td>
                        <td></td>
                      </tr>
                      <tr>
                        <td colSpan={3} className="px-4 py-2 text-sm font-medium text-blue-800 dark:text-blue-200 text-right">Tax (8.5%):</td>
                        <td className="px-4 py-2 text-sm font-medium text-gray-900 text-right">${invoiceDetails.tax.toFixed(2)}</td>
                        <td></td>
                      </tr>
                      <tr className="bg-blue-100">
                        <td colSpan={3} className="px-4 py-2 text-sm font-medium text-blue-800 dark:text-blue-200 text-right">Total:</td>
                        <td className="px-4 py-2 text-sm font-bold text-blue-900 text-right">${invoiceDetails.total.toFixed(2)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <Button 
                  type="button" 
                  variant="outline"
                  className="text-blue-700 dark:text-blue-300 border-blue-300 dark:border-gray-600 hover:bg-blue-100 text-sm"
                  onClick={() => {
                    // Add a new service item to the invoice
                    const updatedItems = [...invoiceDetails.items, {
                      service: "Additional Service",
                      price: 0,
                      quantity: 1
                    }];

                    setInvoiceDetails({
                      ...invoiceDetails,
                      items: updatedItems
                    });
                  }}
                >
                  <PlusCircle className="h-4 w-4 mr-1" />
                  Add Service
                </Button>
              </div>

              {/* Custom Notes Section */}
              <div className="space-y-2">
                <Label htmlFor="invoiceNotes" className="text-blue-800 dark:text-blue-200">Notes & Thank You Message</Label>
                <textarea
                  id="invoiceNotes"
                  value={invoiceDetails.notes}
                  onChange={(e) => setInvoiceDetails({
                    ...invoiceDetails,
                    notes: e.target.value
                  })}
                  rows={3}
                  className="w-full rounded-md border border-blue-200 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                // Here we send the invoice notifications and award loyalty points
                if (!invoiceDetails) return;

                const notificationMethods = [];

                // SMS is always sent
                notificationMethods.push('SMS');

                // Email is sent if provided
                if (invoiceDetails.customerEmail.trim() !== '') {
                  notificationMethods.push('email');
                }

                try {
                  // Award loyalty points (1 point per dollar spent)
                  const pointsToAward = Math.floor(invoiceDetails.total);

                  // Make API call to award loyalty points
                  const loyaltyResponse = await fetch('/api/invoice/award-loyalty-points', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      customerPhone: invoiceDetails.phone,
                      invoiceId: Date.now(), // Using timestamp as a simple invoice ID
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

                  // ACTUALLY SEND THE INVOICE via SMS/Email
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
    </div>
  );
}