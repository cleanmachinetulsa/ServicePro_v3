import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Sparkles, User, Users } from "lucide-react";

export function QuickActionsWidget() {
  const [, setLocation] = useLocation();

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6, delay: 0.5 }}
    >
      <Card className="backdrop-blur-xl bg-white dark:bg-gray-900/95 border border-gray-200 dark:border-white/10 shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Sparkles className="mr-2 h-5 w-5 text-cyan-600 dark:text-cyan-400" />
            <span className="text-gray-900 dark:text-transparent dark:bg-clip-text dark:bg-gradient-to-r dark:from-blue-400 dark:to-cyan-300">
              Quick Actions
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button 
            className="w-full justify-start bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white transition-all duration-300" 
            onClick={() => setLocation('/service-history')}
          >
            <User className="mr-2 h-4 w-4" />
            Customer Service History
          </Button>

          <Button 
            className="w-full justify-start bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white transition-all duration-300" 
            onClick={() => setLocation('/user-management')}
          >
            <Users className="mr-2 h-4 w-4" />
            User Management
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
