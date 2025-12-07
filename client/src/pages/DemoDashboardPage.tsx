import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Shield,
  MessageSquare,
  Calendar,
  Trophy,
  Users,
  Clock,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';
import { DEMO_BANNER_MESSAGE } from '@shared/demoConfig';
import { useQuery } from '@tanstack/react-query';

interface DemoSessionInfo {
  verified: boolean;
  phone?: string;
  expiresAt?: string;
}

export default function DemoDashboardPage() {
  const [, setLocation] = useLocation();
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const demoSessionToken = sessionStorage.getItem('demoSessionToken');
  const demoVerified = sessionStorage.getItem('demoVerified');

  useEffect(() => {
    if (!demoSessionToken || !demoVerified) {
      setLocation('/demo');
      return;
    }

    const expiresAt = sessionStorage.getItem('demoExpiresAt');
    if (expiresAt) {
      const updateTimer = () => {
        const now = new Date();
        const expiry = new Date(expiresAt);
        const diff = expiry.getTime() - now.getTime();
        
        if (diff <= 0) {
          setTimeRemaining('Expired');
          sessionStorage.clear();
          setLocation('/demo');
          return;
        }
        
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        setTimeRemaining(`${hours}h ${minutes}m remaining`);
      };
      
      updateTimer();
      const interval = setInterval(updateTimer, 60000);
      return () => clearInterval(interval);
    }
  }, [demoSessionToken, demoVerified, setLocation]);

  const { data: sessionInfo } = useQuery<DemoSessionInfo>({
    queryKey: ['/api/demo/session', demoSessionToken],
    enabled: !!demoSessionToken,
  });

  const demoStats = {
    customers: 47,
    appointments: 12,
    messages: 156,
    rewardsEarned: 2350,
  };

  const navigateTo = (path: string) => {
    setLocation(path);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="bg-amber-500/90 text-black px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          <span className="text-sm font-medium">{DEMO_BANNER_MESSAGE}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Clock className="w-4 h-4" />
          <span>{timeRemaining}</span>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Badge variant="secondary" className="mb-2 bg-blue-500/20 text-blue-300 border-blue-500/30">
              <Shield className="w-3 h-3 mr-1" /> Demo Mode
            </Badge>
            <h1 className="text-2xl font-bold text-white">Demo Dashboard</h1>
            <p className="text-slate-400">Explore Clean Machine's features with simulated data</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <Users className="w-8 h-8 text-blue-400" />
                <div>
                  <p className="text-2xl font-bold text-white">{demoStats.customers}</p>
                  <p className="text-xs text-slate-400">Demo Customers</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <Calendar className="w-8 h-8 text-green-400" />
                <div>
                  <p className="text-2xl font-bold text-white">{demoStats.appointments}</p>
                  <p className="text-xs text-slate-400">Appointments</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <MessageSquare className="w-8 h-8 text-purple-400" />
                <div>
                  <p className="text-2xl font-bold text-white">{demoStats.messages}</p>
                  <p className="text-xs text-slate-400">Messages</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <Trophy className="w-8 h-8 text-amber-400" />
                <div>
                  <p className="text-2xl font-bold text-white">{demoStats.rewardsEarned}</p>
                  <p className="text-xs text-slate-400">Points Earned</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Alert className="mb-8 bg-blue-500/10 border-blue-500/30">
          <Shield className="w-4 h-4 text-blue-400" />
          <AlertDescription className="text-slate-300">
            This demo uses simulated customer data. All SMS and email actions are redirected to your verified phone number.
          </AlertDescription>
        </Alert>

        <h2 className="text-lg font-semibold text-white mb-4">Explore Features</h2>
        
        <div className="grid md:grid-cols-2 gap-4">
          <Card 
            className="bg-slate-800/50 border-slate-700 hover:border-blue-500/50 transition-colors cursor-pointer"
            onClick={() => navigateTo('/demo/messages')}
            data-testid="card-demo-messages"
          >
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-white">
                <span className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-blue-400" />
                  Message Center
                </span>
                <ChevronRight className="w-5 h-5 text-slate-500" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-400">
                View demo conversations and see how AI handles customer inquiries
              </p>
            </CardContent>
          </Card>

          <Card 
            className="bg-slate-800/50 border-slate-700 hover:border-blue-500/50 transition-colors cursor-pointer"
            onClick={() => navigateTo('/demo/schedule')}
            data-testid="card-demo-schedule"
          >
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-white">
                <span className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-green-400" />
                  Schedule
                </span>
                <ChevronRight className="w-5 h-5 text-slate-500" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-400">
                Browse demo appointments and explore scheduling features
              </p>
            </CardContent>
          </Card>

          <Card 
            className="bg-slate-800/50 border-slate-700 hover:border-blue-500/50 transition-colors cursor-pointer"
            onClick={() => navigateTo('/demo/rewards')}
            data-testid="card-demo-rewards"
          >
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-white">
                <span className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-400" />
                  Loyalty & Rewards
                </span>
                <ChevronRight className="w-5 h-5 text-slate-500" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-400">
                Explore the gamified loyalty system with points, tiers, and rewards
              </p>
            </CardContent>
          </Card>

          <Card 
            className="bg-slate-800/50 border-slate-700 hover:border-blue-500/50 transition-colors cursor-pointer"
            onClick={() => navigateTo('/demo/customers')}
            data-testid="card-demo-customers"
          >
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-white">
                <span className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-400" />
                  Customer Database
                </span>
                <ChevronRight className="w-5 h-5 text-slate-500" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-400">
                View demo customer profiles and service history
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 text-center">
          <Button
            variant="outline"
            onClick={() => {
              sessionStorage.clear();
              setLocation('/demo');
            }}
            className="border-slate-600 text-slate-300 hover:bg-slate-800"
            data-testid="button-exit-demo"
          >
            Exit Demo
          </Button>
        </div>
      </div>
    </div>
  );
}
