import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";

interface Appointment {
  status?: string;
  price?: string;
}

interface MonthlyStatsWidgetProps {
  appointments: Appointment[];
  appointmentCounts: Record<string, number>;
}

export function MonthlyStatsWidget({
  appointments,
  appointmentCounts,
}: MonthlyStatsWidgetProps) {
  return (
    <Card className="backdrop-blur-xl bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-gray-800/90 dark:to-gray-900/90 border border-blue-500/20 dark:border-white/10 text-white shadow-xl">
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
            <div className="text-2xl sm:text-3xl font-bold text-white drop-shadow-sm">
              {Object.values(appointmentCounts).reduce((sum, count) => sum + count, 0)}
            </div>
            <div className="text-xs text-white/80 line-clamp-2">Total This Month</div>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="text-center px-1"
          >
            <div className="text-2xl sm:text-3xl font-bold text-white drop-shadow-sm">
              {Object.keys(appointmentCounts).length}
            </div>
            <div className="text-xs text-white/80 line-clamp-2">Busy Days</div>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-center px-1"
          >
            <div className="text-2xl sm:text-3xl font-bold text-white drop-shadow-sm">
              {Math.max(...Object.values(appointmentCounts), 0)}
            </div>
            <div className="text-xs text-white/80 line-clamp-2">Peak Daily</div>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="text-center px-1"
          >
            <div className="text-2xl sm:text-3xl font-bold text-white drop-shadow-sm">
              {appointments.length}
            </div>
            <div className="text-xs text-white/80 line-clamp-2">Today</div>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="text-center px-1"
          >
            <div className="text-2xl sm:text-3xl font-bold truncate text-white drop-shadow-sm">
              ${appointments.reduce((sum, apt) => {
                const price = apt.price ? parseInt(apt.price.replace(/\D/g, '')) || 150 : 150;
                return sum + price;
              }, 0).toLocaleString()}
            </div>
            <div className="text-xs text-white/80 line-clamp-2">Today's Revenue</div>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.35 }}
            className="text-center px-1"
          >
            <div className="text-2xl sm:text-3xl font-bold text-white drop-shadow-sm">
              {appointments.filter(apt => 
                apt.status !== 'completed' && apt.status !== 'cancelled'
              ).length}
            </div>
            <div className="text-xs text-white/80 line-clamp-2">Uncompleted</div>
          </motion.div>
        </motion.div>
      </CardContent>
    </Card>
  );
}
