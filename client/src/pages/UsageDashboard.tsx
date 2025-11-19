import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { AppShell } from '@/components/AppShell';
import { 
  DollarSign, 
  Activity, 
  Server, 
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface ServiceHealth {
  service: string;
  status: string;
  lastCheck: string;
  lastSuccess: string | null;
  lastError: string | null;
  consecutiveFailures: number;
}

interface UsageLog {
  service: string;
  apiType: string;
  quantity: number;
  cost: string;
  timestamp: string;
}

export default function UsageDashboard() {
  const { toast } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ['/api/usage-dashboard'],
    refetchInterval: 60000,
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/usage-sync', 'POST', {});
    },
    onSuccess: () => {
      toast({ title: 'Sync complete!', description: 'Usage data updated from APIs' });
      queryClient.invalidateQueries({ queryKey: ['/api/usage-dashboard'] });
    },
    onError: (error: any) => {
      toast({ title: 'Sync failed', description: error.message, variant: 'destructive' });
    },
  });

  if (isLoading) return <div className="container mx-auto p-6">Loading...</div>;

  const summary = data?.summary || {};
  const health: ServiceHealth[] = data?.health || [];
  const logs: UsageLog[] = data?.recentLogs || [];

  const serviceData = Object.entries(summary.byService || {}).map(([service, stats]: [string, any]) => ({
    name: service.toUpperCase(),
    cost: parseFloat(stats.cost),
    calls: stats.calls,
  }));

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'degraded': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'down': return <XCircle className="w-5 h-5 text-red-500" />;
      default: return <Server className="w-5 h-5 text-gray-500" />;
    }
  };

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-100 text-green-800 border-green-200';
      case 'degraded': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'down': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const healthyCount = health.filter(h => h.status === 'healthy').length;

  const pageActions = (
    <Button
      onClick={() => syncMutation.mutate()}
      disabled={syncMutation.isPending}
      data-testid="button-sync"
      size="sm"
    >
      <RefreshCw className={`w-4 h-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
      Sync Now
    </Button>
  );

  return (
    <AppShell title="API Usage & Costs" pageActions={pageActions}>
      <div className="p-6 space-y-6">

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">30-Day Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${summary.totalCost || '0.00'}</div>
            <p className="text-xs text-muted-foreground">Last {summary.period || '30 days'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total API Calls</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {logs.reduce((sum, log) => sum + log.quantity, 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Across all services</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Services</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{health.length}</div>
            <p className="text-xs text-muted-foreground">Monitored integrations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{healthyCount}/{health.length}</div>
            <p className="text-xs text-muted-foreground">Services healthy</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Cost by Service</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={serviceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                <Bar dataKey="cost" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>API Calls by Service</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={serviceData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="calls"
                >
                  {serviceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Service Health Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {health.map((service) => (
              <Card 
                key={service.service} 
                className={`border-2 ${getHealthColor(service.status)}`}
                data-testid={`card-health-${service.service}`}
              >
                <CardContent className="pt-6 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-lg uppercase">{service.service}</span>
                    {getHealthIcon(service.status)}
                  </div>
                  <Badge variant="outline">{service.status}</Badge>
                  <p className="text-xs text-muted-foreground">
                    Last checked: {new Date(service.lastCheck).toLocaleTimeString()}
                  </p>
                  {service.consecutiveFailures > 0 && (
                    <p className="text-xs text-red-600">
                      Failures: {service.consecutiveFailures}
                    </p>
                  )}
                  {service.lastError && (
                    <p className="text-xs text-red-600 truncate" title={service.lastError}>
                      {service.lastError}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.slice(0, 50).map((log, idx) => (
                  <TableRow key={idx} data-testid={`row-log-${idx}`}>
                    <TableCell className="text-sm">
                      {new Date(log.timestamp).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{log.service.toUpperCase()}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{log.apiType}</TableCell>
                    <TableCell className="text-right">{log.quantity.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-semibold">${parseFloat(log.cost).toFixed(4)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      </div>
    </AppShell>
  );
}
