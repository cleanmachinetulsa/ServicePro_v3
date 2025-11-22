import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { motion } from "framer-motion";
import { 
  Car, 
  CalendarClock, 
  MessageSquare, 
  Navigation, 
  Phone, 
  User, 
  FileText,
  Clock,
  CloudRain,
  ChevronLeft,
  ChevronRight,
  Star,
  Users,
  HelpCircle,
  Sparkles,
  Plus
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

interface DashboardOverviewProps {
  appointments: Appointment[];
  appointmentCounts: Record<string, number>;
  weatherData: Record<string, any>;
  todayDate: Date;
  currentMonth: Date;
  onDateChange: (date: Date) => void;
  onMonthChange: (month: Date) => void;
  onCall: (phone: string) => void;
  onChat: (phone: string, name: string) => void;
  onNavigate: (address: string, phone: string) => void;
  onViewHistory: (phone: string) => void;
  onSendInvoice: (appointment: Appointment) => void;
}

export function DashboardOverview({
  appointments,
  appointmentCounts,
  weatherData,
  todayDate,
  currentMonth,
  onDateChange,
  onMonthChange,
  onCall,
  onChat,
  onNavigate,
  onViewHistory,
  onSendInvoice,
}: DashboardOverviewProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newAppointmentForm, setNewAppointmentForm] = useState({
    customerName: '',
    phone: '',
    service: '',
    scheduledTime: '',
    address: '',
  });

  // Fetch services for dropdown
  const { data: servicesData } = useQuery<{ success: boolean; services: any[] }>({
    queryKey: ['/api/services'],
  });

  const services = servicesData?.services || [];

  // Create appointment mutation
  const createAppointmentMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('POST', '/api/appointments/create-manual', data);
    },
    onSuccess: () => {
      toast({
        title: 'Appointment created',
        description: 'The appointment has been created successfully.',
      });
      setShowCreateDialog(false);
      setNewAppointmentForm({
        customerName: '',
        phone: '',
        service: '',
        scheduledTime: '',
        address: '',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/today'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/appointment-counts'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error creating appointment',
        description: error.message || 'Failed to create appointment',
        variant: 'destructive',
      });
    },
  });

  const handleCreateAppointment = () => {
    // Validate all required fields
    if (!newAppointmentForm.customerName || !newAppointmentForm.customerName.trim()) {
      toast({
        title: 'Customer name required',
        description: 'Please enter a customer name',
        variant: 'destructive',
      });
      return;
    }

    if (!newAppointmentForm.phone || !newAppointmentForm.phone.trim()) {
      toast({
        title: 'Phone number required',
        description: 'Please enter a phone number',
        variant: 'destructive',
      });
      return;
    }

    if (!newAppointmentForm.service || newAppointmentForm.service === '0' || newAppointmentForm.service === '') {
      toast({
        title: 'Service required',
        description: 'Please select a service',
        variant: 'destructive',
      });
      return;
    }

    if (!newAppointmentForm.scheduledTime || newAppointmentForm.scheduledTime.trim() === '') {
      toast({
        title: 'Date & time required',
        description: 'Please select a date and time',
        variant: 'destructive',
      });
      return;
    }

    if (!newAppointmentForm.address || !newAppointmentForm.address.trim()) {
      toast({
        title: 'Address required',
        description: 'Please enter a service address',
        variant: 'destructive',
      });
      return;
    }

    createAppointmentMutation.mutate(newAppointmentForm);
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "MMM d, yyyy h:mm a");
    } catch (error) {
      return dateString;
    }
  };

  return (
    <div className="space-y-4 p-6">
      {/* Monthly Statistics Bar */}
      <Card className="backdrop-blur-xl bg-white/10 dark:bg-white/5 border border-white/20 text-white shadow-xl">
        <CardContent className="py-4">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-center px-1"
            >
              <div className="text-2xl sm:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-300">
                {Object.values(appointmentCounts).reduce((sum, count) => sum + count, 0)}
              </div>
              <div className="text-xs text-blue-100 line-clamp-2">Total This Month</div>
            </motion.div>
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="text-center px-1"
            >
              <div className="text-2xl sm:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-300">
                {Object.keys(appointmentCounts).length}
              </div>
              <div className="text-xs text-blue-100 line-clamp-2">Busy Days</div>
            </motion.div>
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-center px-1"
            >
              <div className="text-2xl sm:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-300">
                {Math.max(...Object.values(appointmentCounts), 0)}
              </div>
              <div className="text-xs text-blue-100 line-clamp-2">Peak Daily</div>
            </motion.div>
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.25 }}
              className="text-center px-1"
            >
              <div className="text-2xl sm:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-emerald-300">
                {appointments.length}
              </div>
              <div className="text-xs text-blue-100 line-clamp-2">Today</div>
            </motion.div>
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="text-center px-1"
            >
              <div className="text-2xl sm:text-3xl font-bold truncate bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 to-orange-300">
                ${appointments.reduce((sum, apt) => {
                  const price = apt.price ? parseInt(apt.price.replace(/\D/g, '')) || 150 : 150;
                  return sum + price;
                }, 0).toLocaleString()}
              </div>
              <div className="text-xs text-blue-100 line-clamp-2">Today's Revenue</div>
            </motion.div>
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.35 }}
              className="text-center px-1"
            >
              <div className="text-2xl sm:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-rose-300">
                {appointments.filter(apt => 
                  apt.status !== 'completed' && apt.status !== 'cancelled'
                ).length}
              </div>
              <div className="text-xs text-blue-100 line-clamp-2">Uncompleted</div>
            </motion.div>
          </motion.div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Large Central Calendar */}
        <div className="lg:col-span-2 space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Card className="rounded-xl backdrop-blur-xl bg-white/10 dark:bg-white/5 border border-white/20 shadow-xl overflow-hidden" data-testid="calendar-card">
              <CardHeader className="bg-gradient-to-r from-blue-600/80 to-purple-600/80 backdrop-blur-md text-white pb-6 border-b border-white/20">
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
                        onMonthChange(newMonth);
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
                        onMonthChange(newMonth);
                      }}
                      data-testid="button-next-month"
                      aria-label="Next month"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
                <div className="flex gap-1 sm:gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="bg-green-500/80 hover:bg-green-600/80 text-white border-green-400/20 backdrop-blur-sm transition-all h-9 px-3 font-medium"
                    onClick={() => setShowCreateDialog(true)}
                    data-testid="button-create-appointment"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    New
                  </Button>
                  <TooltipProvider>
                    <Tooltip delayDuration={200}>
                      <TooltipTrigger asChild>
                        <button 
                          className="hidden sm:flex p-2 rounded-lg bg-white/20 hover:bg-white/30 backdrop-blur-sm transition-all"
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
                    className="bg-white/20 hover:bg-white/30 text-white border-white/20 backdrop-blur-sm transition-all h-9 px-2 sm:px-3"
                    onClick={() => onDateChange(new Date())}
                    data-testid="button-today"
                  >
                    <Clock className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Today</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="bg-white/20 hover:bg-white/30 text-white border-white/20 backdrop-blur-sm transition-all h-9 w-9 p-0"
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
              <CardContent className="p-8 backdrop-blur-sm">
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
                  onMonthChange={onMonthChange}
                  onSelect={(date) => {
                    if (date) {
                      onDateChange(date);
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
          </motion.div>

          {/* Selected Day Appointments */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <Card className="backdrop-blur-xl bg-white/10 dark:bg-white/5 border border-white/20 text-gray-800 dark:text-gray-100 shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CalendarClock className="mr-2 h-5 w-5 text-cyan-400" />
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-300">
                    {format(todayDate, 'MMM d, yyyy') === format(new Date(), 'MMM d, yyyy') 
                      ? "Today's Schedule" 
                      : `Schedule for ${format(todayDate, 'MMM d, yyyy')}`} ({appointments.length})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {appointments.length > 0 ? (
                  <div className="space-y-4">
                    {appointments.map((appointment, index) => {
                      // Color-code appointments for easier distinction
                      const accentColors = [
                        'from-purple-500 to-pink-500',
                        'from-blue-500 to-cyan-500',
                        'from-green-500 to-emerald-500',
                        'from-orange-500 to-yellow-500',
                        'from-pink-500 to-rose-500'
                      ];
                      const gradientClass = accentColors[index % accentColors.length];
                      
                      return (
                      <motion.div
                        key={appointment.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.4, delay: index * 0.1 }}
                      >
                        <Card className={`backdrop-blur-xl bg-white/5 border border-white/20 hover:bg-white/10 transition-all duration-300 relative overflow-hidden group`}>
                          <div className={`absolute top-0 left-0 w-1 h-full bg-gradient-to-b ${gradientClass}`}></div>
                          <CardHeader className="pb-2">
                            <div className="flex justify-between items-start">
                              <div>
                                <CardTitle className="text-lg bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-300">{appointment.customerName}</CardTitle>
                                <CardDescription className="text-gray-300">{appointment.service}</CardDescription>
                              </div>
                              <Badge variant="outline" className="font-mono backdrop-blur-md bg-white/10 border-white/20 text-cyan-300">
                                {formatDate(appointment.time).split(',')[1]}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="pb-2 space-y-2">
                            <div className="flex items-center text-sm text-gray-300">
                              <Car className="mr-2 h-4 w-4 text-cyan-400" />
                              {appointment.vehicleInfo || "Vehicle info not available"}
                            </div>
                            <div className="flex items-center text-sm text-gray-300">
                              <Navigation className="mr-2 h-4 w-4 text-blue-400" />
                              {appointment.address}
                            </div>
                            <div className="flex items-center text-sm text-gray-300">
                              <Phone className="mr-2 h-4 w-4 text-purple-400" />
                              {appointment.phone}
                            </div>
                          </CardContent>
                          <CardFooter className="flex justify-between pt-2 flex-wrap gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="backdrop-blur-md bg-white/5 border-white/20 hover:bg-white/10 text-white"
                              onClick={() => onViewHistory(appointment.phone)}
                            >
                              History
                            </Button>
                            <div className="flex flex-wrap gap-2">
                              <Button 
                                variant="outline" 
                                size="sm"
                                className="backdrop-blur-md bg-white/5 border-white/20 hover:bg-white/10 text-white"
                                onClick={() => onCall(appointment.phone)}
                              >
                                <Phone className="h-4 w-4 mr-2" />
                                Call
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                className="backdrop-blur-md bg-white/5 border-white/20 hover:bg-white/10 text-white"
                                onClick={() => onChat(appointment.phone, appointment.customerName)}
                              >
                                <MessageSquare className="h-4 w-4 mr-2" />
                                Chat
                              </Button>
                              <Button 
                                variant="default" 
                                size="sm"
                                className="backdrop-blur-md bg-gradient-to-r from-blue-500/80 to-cyan-500/80 hover:from-blue-600/80 hover:to-cyan-600/80 border-white/20 text-white"
                                onClick={() => onNavigate(appointment.address, appointment.phone)}
                              >
                                <Navigation className="h-4 w-4 mr-2" />
                                Navigate
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                className="backdrop-blur-md bg-green-500/20 border-green-400/30 text-green-300 hover:bg-green-500/30"
                                onClick={() => onSendInvoice(appointment)}
                              >
                                <FileText className="h-4 w-4 mr-2" />
                                Invoice
                              </Button>
                            </div>
                          </CardFooter>
                        </Card>
                      </motion.div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-300">
                    <Sparkles className="h-12 w-12 mx-auto mb-3 text-cyan-400/50" />
                    <p className="text-lg">No appointments scheduled for this date</p>
                    <p className="text-sm text-gray-400 mt-1">Select a different date to view appointments</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Right Side Panel - Quick Actions and Insights */}
        <div className="space-y-4">
          {/* Daily Insights Card */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <Card className="backdrop-blur-xl bg-white/10 dark:bg-white/5 border border-white/20 shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Star className="mr-2 h-5 w-5 text-yellow-400" />
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-300">
                    {format(todayDate, 'MMM d')} Insights
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {appointments.length > 0 ? (
                  <>
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: 0.5 }}
                      className="flex items-center justify-between p-3 backdrop-blur-md bg-white/5 border border-white/20 rounded-lg"
                    >
                      <span className="text-sm text-gray-300">Appointments:</span>
                      <Badge className="backdrop-blur-md bg-gradient-to-r from-purple-500 to-pink-500 border-0">{appointments.length}</Badge>
                    </motion.div>
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: 0.6 }}
                      className="flex items-center justify-between p-3 backdrop-blur-md bg-white/5 border border-white/20 rounded-lg"
                    >
                      <span className="text-sm text-gray-300">Popular Service:</span>
                      <Badge variant="outline" className="border-purple-400/50 text-purple-300 backdrop-blur-md bg-white/5">
                        {(() => {
                          const serviceCounts = appointments.reduce((acc: any, apt) => {
                            acc[apt.service] = (acc[apt.service] || 0) + 1;
                            return acc;
                          }, {});
                          const mostPopular = Object.entries(serviceCounts).sort((a: any, b: any) => b[1] - a[1])[0];
                          return mostPopular ? mostPopular[0] : 'N/A';
                        })()}
                      </Badge>
                    </motion.div>
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: 0.7 }}
                      className="flex items-center justify-between p-3 backdrop-blur-md bg-white/5 border border-white/20 rounded-lg"
                    >
                      <span className="text-sm text-gray-300">Revenue:</span>
                      <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-emerald-300">
                        ${(() => {
                          const total = appointments.reduce((sum, apt) => {
                            const price = apt.price ? parseInt(apt.price.replace(/\D/g, '')) || 150 : 150;
                            return sum + price;
                          }, 0);
                          return total.toLocaleString();
                        })()}
                      </span>
                    </motion.div>
                  </>
                ) : (
                  <div className="text-center py-4 text-gray-300">
                    <Sparkles className="h-8 w-8 mx-auto mb-2 text-purple-400/50" />
                    <p>No appointments for this date</p>
                    <p className="text-sm mt-1 text-gray-400">Select a different date to view insights</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            <Card className="backdrop-blur-xl bg-white/10 dark:bg-white/5 border border-white/20 shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Sparkles className="mr-2 h-5 w-5 text-cyan-400" />
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-300">
                    Quick Actions
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button 
                  className="w-full justify-start backdrop-blur-md bg-gradient-to-r from-blue-500/80 to-cyan-500/80 hover:from-blue-600/80 hover:to-cyan-600/80 border-white/20 text-white transition-all duration-300" 
                  onClick={() => setLocation('/service-history')}
                >
                  <User className="mr-2 h-4 w-4" />
                  Customer Service History
                </Button>

                <Button 
                  className="w-full justify-start backdrop-blur-md bg-gradient-to-r from-purple-500/80 to-pink-500/80 hover:from-purple-600/80 hover:to-pink-600/80 border-white/20 text-white transition-all duration-300" 
                  onClick={() => setLocation('/user-management')}
                >
                  <Users className="mr-2 h-4 w-4" />
                  User Management
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      {/* Create Appointment Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-green-600" />
              Create New Appointment
            </DialogTitle>
            <DialogDescription>
              Manually create a new appointment for a customer.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="customer-name">Customer Name *</Label>
              <Input
                id="customer-name"
                placeholder="John Doe"
                value={newAppointmentForm.customerName}
                onChange={(e) => setNewAppointmentForm({ ...newAppointmentForm, customerName: e.target.value })}
                data-testid="input-customer-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer-phone">Phone Number *</Label>
              <Input
                id="customer-phone"
                placeholder="+1 (555) 123-4567"
                value={newAppointmentForm.phone}
                onChange={(e) => setNewAppointmentForm({ ...newAppointmentForm, phone: e.target.value })}
                data-testid="input-customer-phone"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="service">Service *</Label>
              <Select
                value={newAppointmentForm.service}
                onValueChange={(value) => setNewAppointmentForm({ ...newAppointmentForm, service: value })}
              >
                <SelectTrigger id="service" data-testid="select-service">
                  <SelectValue placeholder="Select a service" />
                </SelectTrigger>
                <SelectContent>
                  {services.map((service: any) => (
                    <SelectItem key={service.id} value={service.id.toString()}>
                      {service.name} ({service.priceRange})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="scheduled-time">Date & Time *</Label>
              <Input
                id="scheduled-time"
                type="datetime-local"
                value={newAppointmentForm.scheduledTime}
                onChange={(e) => setNewAppointmentForm({ ...newAppointmentForm, scheduledTime: e.target.value })}
                data-testid="input-scheduled-time"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address *</Label>
              <Input
                id="address"
                placeholder="123 Main St, City, State 12345"
                value={newAppointmentForm.address}
                onChange={(e) => setNewAppointmentForm({ ...newAppointmentForm, address: e.target.value })}
                data-testid="input-address"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
              data-testid="button-cancel-create"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateAppointment}
              disabled={createAppointmentMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
              data-testid="button-confirm-create"
            >
              {createAppointmentMutation.isPending ? 'Creating...' : 'Create Appointment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
