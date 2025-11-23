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
  );
}
