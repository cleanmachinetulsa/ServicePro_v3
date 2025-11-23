import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { Star, Sparkles } from "lucide-react";

interface Appointment {
  service: string;
  price?: string;
}

interface DailyInsightsWidgetProps {
  appointments: Appointment[];
  todayDate: Date;
}

export function DailyInsightsWidget({
  appointments,
  todayDate,
}: DailyInsightsWidgetProps) {
  return (
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
  );
}
