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
  );
}
