import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Calendar, Trophy, LogOut, User, Phone, Mail, MapPin, Car } from 'lucide-react';
import { format } from 'date-fns';

interface CustomerPortalData {
  customer: {
    id: number;
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    vehicleInfo: string | null;
    loyaltyTier: string;
    isVip: boolean;
  };
  identity: {
    lastLoginAt: Date | null;
  } | null;
  appointments: {
    upcoming: Array<{
      id: number;
      scheduledTime: Date;
      serviceId: number;
      status: string;
      address: string | null;
      additionalRequests: string | null;
    }>;
    recent: Array<{
      id: number;
      scheduledTime: Date;
      serviceId: number;
      status: string;
      completedAt: Date | null;
    }>;
  };
  loyalty: {
    totalPoints: number;
    tier: string;
    recentTransactions: Array<{
      id: number;
      points: number;
      description: string | null;
      source: string | null;
      createdAt: Date;
    }>;
  };
}

export default function CustomerPortalDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data, isLoading, error } = useQuery<CustomerPortalData>({
    queryKey: ['/api/portal/me'],
  });

  const handleLogout = async () => {
    try {
      await apiRequest('/api/public/customer-auth/logout', { method: 'POST' });
      toast({
        title: 'Logged Out',
        description: 'You have been logged out successfully',
      });
      setLocation('/portal/login');
    } catch (error) {
      console.error('Logout error:', error);
      toast({
        title: 'Error',
        description: 'Failed to log out',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <div className="max-w-6xl mx-auto space-y-6">
          <Skeleton className="h-12 w-64" />
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Error</CardTitle>
            <CardDescription>Failed to load your account information</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation('/portal/login')} className="w-full">
              Back to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const firstName = data.customer.name.split(' ')[0];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Welcome back, {firstName}!
            </h1>
            <p className="text-muted-foreground">
              Your customer portal
            </p>
          </div>
          <Button variant="outline" onClick={handleLogout} data-testid="button-logout">
            <LogOut className="mr-2 h-4 w-4" />
            Log Out
          </Button>
        </div>

        {/* Profile Card */}
        <Card data-testid="card-profile">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Your Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Name:</span>
              <span data-testid="text-customer-name">{data.customer.name}</span>
            </div>
            {data.customer.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Phone:</span>
                <span data-testid="text-customer-phone">{data.customer.phone}</span>
              </div>
            )}
            {data.customer.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Email:</span>
                <span data-testid="text-customer-email">{data.customer.email}</span>
              </div>
            )}
            {data.customer.address && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Address:</span>
                <span>{data.customer.address}</span>
              </div>
            )}
            {data.customer.vehicleInfo && (
              <div className="flex items-center gap-2 text-sm">
                <Car className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Vehicle:</span>
                <span>{data.customer.vehicleInfo}</span>
              </div>
            )}
            {data.customer.isVip && (
              <Badge variant="secondary" className="bg-yellow-500 text-white">
                VIP Customer
              </Badge>
            )}
          </CardContent>
        </Card>

        {/* Appointments Card */}
        <Card data-testid="card-appointments">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Appointments
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.appointments.upcoming.length > 0 ? (
              <div className="space-y-3">
                <h3 className="font-semibold">Upcoming</h3>
                {data.appointments.upcoming.map((apt) => (
                  <div
                    key={apt.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                    data-testid={`appointment-${apt.id}`}
                  >
                    <div>
                      <p className="font-medium">
                        {format(new Date(apt.scheduledTime), 'MMM d, yyyy')}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(apt.scheduledTime), 'h:mm a')}
                      </p>
                    </div>
                    <Badge>{apt.status}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-muted-foreground mb-4">No upcoming appointments</p>
                <Button onClick={() => setLocation('/book')} data-testid="button-book-appointment">
                  Book an Appointment
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Loyalty Card */}
        <Card data-testid="card-loyalty">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Loyalty Rewards
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center mb-4">
              <p className="text-4xl font-bold text-primary" data-testid="text-loyalty-points">
                {data.loyalty.totalPoints}
              </p>
              <p className="text-muted-foreground">Points</p>
              <Badge variant="outline" className="mt-2">
                {data.loyalty.tier}
              </Badge>
            </div>
            {data.loyalty.recentTransactions.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">Recent Activity</h3>
                {data.loyalty.recentTransactions.slice(0, 5).map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between text-sm border-b pb-2"
                    data-testid={`transaction-${tx.id}`}
                  >
                    <span className="text-muted-foreground">
                      {tx.description || 'Points earned'}
                    </span>
                    <span className={tx.points > 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                      {tx.points > 0 ? '+' : ''}{tx.points}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
