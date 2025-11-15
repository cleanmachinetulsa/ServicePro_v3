import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

interface DashboardOverviewProps {
  darkMode: boolean;
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
  darkMode,
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
              <div className="text-2xl sm:text-3xl font-bold">{appointments.length}</div>
              <div className="text-xs text-blue-100 line-clamp-2">Today</div>
            </div>
            <div className="text-center px-1">
              <div className="text-2xl sm:text-3xl font-bold truncate">
                ${appointments.reduce((sum, apt) => {
                  const price = apt.price ? parseInt(apt.price.replace(/\D/g, '')) || 150 : 150;
                  return sum + price;
                }, 0).toLocaleString()}
              </div>
              <div className="text-xs text-blue-100 line-clamp-2">Today's Revenue</div>
            </div>
            <div className="text-center px-1">
              <div className="text-2xl sm:text-3xl font-bold">
                {appointments.filter(apt => 
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
                    onClick={() => onDateChange(new Date())}
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

          {/* Selected Day Appointments */}
          <Card className="bg-blue-50/95 dark:bg-gray-800/95 text-gray-800 dark:text-gray-100 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center text-blue-800 dark:text-blue-200">
                <CalendarClock className="mr-2 h-5 w-5 text-blue-600 dark:text-blue-400" />
                {format(todayDate, 'MMM d, yyyy') === format(new Date(), 'MMM d, yyyy') 
                  ? "Today's Schedule" 
                  : `Schedule for ${format(todayDate, 'MMM d, yyyy')}`} ({appointments.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {appointments.length > 0 ? (
                <div className="space-y-4">
                  {appointments.map((appointment, index) => {
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
                          onClick={() => onViewHistory(appointment.phone)}
                        >
                          History
                        </Button>
                        <div className="space-x-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => onCall(appointment.phone)}
                          >
                            <Phone className="h-4 w-4 mr-2" />
                            Call
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => onChat(appointment.phone, appointment.customerName)}
                          >
                            <MessageSquare className="h-4 w-4 mr-2" />
                            Chat
                          </Button>
                          <Button 
                            variant="default" 
                            size="sm"
                            onClick={() => onNavigate(appointment.address, appointment.phone)}
                          >
                            <Navigation className="h-4 w-4 mr-2" />
                            Navigate
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50 border-green-300 dark:border-green-700"
                            onClick={() => onSendInvoice(appointment)}
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
                  No appointments scheduled for this date
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
              {appointments.length > 0 ? (
                <>
                  <div className="flex items-center justify-between p-2 bg-white dark:bg-gray-700 rounded-lg">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Appointments:</span>
                    <Badge className="bg-purple-600">{appointments.length}</Badge>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-white dark:bg-gray-700 rounded-lg">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Popular Service:</span>
                    <Badge variant="outline" className="border-purple-400 text-purple-700">
                      {(() => {
                        const serviceCounts = appointments.reduce((acc: any, apt) => {
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
                        const total = appointments.reduce((sum, apt) => {
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
    </div>
  );
}
