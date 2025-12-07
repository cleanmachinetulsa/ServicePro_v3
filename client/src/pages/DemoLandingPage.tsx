import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Play, Shield, Clock, MessageSquare, Calendar, Trophy, Smartphone, CheckCircle } from 'lucide-react';
import { useLocation } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export default function DemoLandingPage() {
  const [, setLocation] = useLocation();
  const [isStarting, setIsStarting] = useState(false);
  const { toast } = useToast();

  const handleStartDemo = async () => {
    setIsStarting(true);
    try {
      const response = await apiRequest('/api/demo/start', {
        method: 'POST',
      });

      if (response.success) {
        sessionStorage.setItem('demoSessionToken', response.demoSessionToken);
        sessionStorage.setItem('demoExpiresAt', response.expiresAt);
        setLocation('/demo/verify');
      } else {
        throw new Error(response.error || 'Failed to start demo');
      }
    } catch (error) {
      console.error('Failed to start demo:', error);
      toast({
        title: 'Demo Unavailable',
        description: 'Unable to start demo session. Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="text-center mb-12">
          <Badge variant="secondary" className="mb-4 bg-blue-500/20 text-blue-300 border-blue-500/30">
            <Shield className="w-3 h-3 mr-1" /> Sandbox Demo
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Experience Clean Machine
          </h1>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto">
            Try our full-featured auto detailing management platform. 
            All data is simulated—no real customers are contacted.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <Card className="bg-slate-800/50 border-slate-700 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <MessageSquare className="w-5 h-5 text-blue-400" />
                AI-Powered Messaging
              </CardTitle>
              <CardDescription className="text-slate-400">
                See how our AI handles customer inquiries, scheduling, and more
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-slate-300">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  Multi-channel inbox (SMS, web chat)
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  Intelligent auto-responses
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  Service recommendations
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Calendar className="w-5 h-5 text-blue-400" />
                Smart Scheduling
              </CardTitle>
              <CardDescription className="text-slate-400">
                Explore our intelligent appointment booking system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-slate-300">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  Weather-aware scheduling
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  Calendar integration
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  Automated reminders
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Trophy className="w-5 h-5 text-blue-400" />
                Loyalty & Rewards
              </CardTitle>
              <CardDescription className="text-slate-400">
                Discover our gamified customer retention features
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-slate-300">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  Points & tier system
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  Referral program
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  Reward redemption
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Smartphone className="w-5 h-5 text-blue-400" />
                Mobile-First Design
              </CardTitle>
              <CardDescription className="text-slate-400">
                Optimized for on-the-go technicians and owners
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-slate-300">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  Responsive dashboard
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  Quick actions
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  Real-time updates
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <div className="text-center">
          <Card className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border-blue-500/30 max-w-md mx-auto">
            <CardContent className="pt-6">
              <div className="flex items-center justify-center gap-2 text-slate-300 mb-4">
                <Clock className="w-4 h-4" />
                <span>2-hour demo session</span>
              </div>
              <Button
                size="lg"
                onClick={handleStartDemo}
                disabled={isStarting}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                data-testid="button-start-demo"
              >
                {isStarting ? (
                  <>Starting Demo...</>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Try Live Demo
                  </>
                )}
              </Button>
              <p className="text-xs text-slate-400 mt-4">
                Phone verification required to prevent abuse. 
                Your number is only used to verify you're human.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
