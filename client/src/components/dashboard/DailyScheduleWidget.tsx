import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { CalendarClock, Car, Navigation, Phone, MessageSquare, FileText, Sparkles } from "lucide-react";

interface Appointment {
  id: string;
  customerName: string;
  service: string;
  time: string;
  date: string;
  address: string;
  phone: string;
  vehicleInfo?: string;
  price?: string;
}

interface DailyScheduleWidgetProps {
  appointments: Appointment[];
  todayDate: Date;
  onCall: (phone: string) => void;
  onChat: (phone: string, name: string) => void;
  onNavigate: (address: string, phone: string) => void;
  onViewHistory: (phone: string) => void;
  onSendInvoice: (appointment: Appointment) => void;
}

export function DailyScheduleWidget({
  appointments,
  todayDate,
  onCall,
  onChat,
  onNavigate,
  onViewHistory,
  onSendInvoice,
}: DailyScheduleWidgetProps) {
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "MMM d, yyyy h:mm a");
    } catch (error) {
      return dateString;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.3 }}
    >
      <Card className="backdrop-blur-xl bg-white dark:bg-gray-900/95 border border-gray-200 dark:border-white/10 text-gray-800 dark:text-gray-100 shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center">
            <CalendarClock className="mr-2 h-5 w-5 text-cyan-600 dark:text-cyan-400" />
            <span className="text-gray-900 dark:text-transparent dark:bg-clip-text dark:bg-gradient-to-r dark:from-blue-400 dark:to-cyan-300">
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
                    <Card className={`backdrop-blur-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/20 hover:bg-gray-100 dark:hover:bg-white/10 transition-all duration-300 relative overflow-hidden group`}>
                      <div className={`absolute top-0 left-0 w-1 h-full bg-gradient-to-b ${gradientClass}`}></div>
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-lg text-gray-900 dark:text-transparent dark:bg-clip-text dark:bg-gradient-to-r dark:from-blue-400 dark:to-cyan-300">{appointment.customerName}</CardTitle>
                            <CardDescription className="text-gray-600 dark:text-gray-300">{appointment.service}</CardDescription>
                          </div>
                          <Badge variant="outline" className="font-mono bg-blue-50 dark:bg-white/10 border-blue-200 dark:border-white/20 text-blue-700 dark:text-cyan-300">
                            {formatDate(appointment.time).split(',')[1]}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="pb-2 space-y-2">
                        <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                          <Car className="mr-2 h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                          {appointment.vehicleInfo || "Vehicle info not available"}
                        </div>
                        <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                          <Navigation className="mr-2 h-4 w-4 text-blue-600 dark:text-blue-400" />
                          {appointment.address}
                        </div>
                        <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                          <Phone className="mr-2 h-4 w-4 text-purple-600 dark:text-purple-400" />
                          {appointment.phone}
                        </div>
                      </CardContent>
                      <CardFooter className="flex justify-between pt-2 flex-wrap gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="bg-gray-100 dark:bg-white/5 border-gray-300 dark:border-white/20 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-white"
                          onClick={() => onViewHistory(appointment.phone)}
                        >
                          History
                        </Button>
                        <div className="flex flex-wrap gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="bg-gray-100 dark:bg-white/5 border-gray-300 dark:border-white/20 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-white"
                            onClick={() => onCall(appointment.phone)}
                          >
                            <Phone className="h-4 w-4 mr-2" />
                            Call
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="bg-gray-100 dark:bg-white/5 border-gray-300 dark:border-white/20 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-white"
                            onClick={() => onChat(appointment.phone, appointment.customerName)}
                          >
                            <MessageSquare className="h-4 w-4 mr-2" />
                            Chat
                          </Button>
                          <Button 
                            variant="default" 
                            size="sm"
                            className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white"
                            onClick={() => onNavigate(appointment.address, appointment.phone)}
                          >
                            <Navigation className="h-4 w-4 mr-2" />
                            Navigate
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="bg-green-50 dark:bg-green-500/20 border-green-300 dark:border-green-400/30 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-500/30"
                            onClick={() => onSendInvoice(appointment)}
                          >
                            <FileText className="h-4 w-4 mr-2" />
                            Invoice
                          </Button>
                        </div>
                      </CardFooter>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-600 dark:text-gray-300">
              <Sparkles className="h-12 w-12 mx-auto mb-3 text-cyan-600/50 dark:text-cyan-400/50" />
              <p className="text-lg">No appointments scheduled for this date</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Select a different date to view appointments</p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
