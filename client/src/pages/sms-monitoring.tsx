import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  MessageSquare,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertTriangle,
  Activity,
  Phone,
  Calendar,
  BarChart3,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { SmsDeliveryStatus } from '@shared/schema';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface DeliveryStats {
  total: number;
  delivered: number;
  failed: number;
  pending: number;
  deliveryRate: number;
  totalCost: number;
  avgSegments: number;
}

interface StatsResponse {
  success: boolean;
  stats: DeliveryStats;
  records: SmsDeliveryStatus[];
}

interface TrendDataPoint {
  date: string;
  total: number;
  delivered: number;
  failed: number;
  pending: number;
  cost: number;
  deliveryRate: number;
}

interface TrendsResponse {
  success: boolean;
  trends: TrendDataPoint[];
  period: string;
  daysAnalyzed: number;
}

interface ErrorBreakdownResponse {
  success: boolean;
  totalFailed: number;
  errorBreakdown: Record<number, {
    count: number;
    message: string;
    examples: string[];
  }>;
}

export default function SmsMonitoring() {
  const [activeTab, setActiveTab] = useState('trends');
  const [dateRange, setDateRange] = useState('30'); // days

  // Fetch delivery statistics with date range
  const { data: statsData, isLoading: statsLoading } = useQuery<StatsResponse>({
    queryKey: ['/api/twilio/delivery-stats', { days: dateRange }],
    refetchInterval: 30000,
  });

  // Fetch time-series trends
  const { data: trendsData, isLoading: trendsLoading } = useQuery<TrendsResponse>({
    queryKey: ['/api/twilio/trends', { days: dateRange, groupBy: 'day' }],
    refetchInterval: 60000,
  });

  // Fetch error breakdown
  const { data: errorsData } = useQuery<ErrorBreakdownResponse>({
    queryKey: ['/api/twilio/error-breakdown'],
    refetchInterval: 60000,
  });

  const stats = statsData?.stats;
  const recentMessages = statsData?.records || [];
  const trendsArray = trendsData?.trends || [];
  const errorBreakdown = errorsData?.errorBreakdown || {};

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'failed':
      case 'undelivered':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      case 'sent':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'queued':
      case 'sending':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
    }
  };

  const getTwilioErrorDescription = (errorCode: number): string => {
    const errorDescriptions: Record<number, string> = {
      21211: 'Invalid phone number',
      21408: 'Permission to send SMS has not been enabled',
      21610: 'Message blocked - unsubscribed recipient',
      21614: 'Message blocked - invalid destination number',
      30003: 'Unreachable destination carrier',
      30004: 'Message blocked by carrier',
      30005: 'Unknown destination handset',
      30006: 'Landline or unreachable carrier',
      30007: 'Message filtered by carrier (spam)',
      30008: 'Unknown error from carrier',
    };
    return errorDescriptions[errorCode] || 'Unknown error';
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-950">
      {/* Header - Enhanced with Better Design */}
      <div className="border-b bg-gradient-to-r from-white via-blue-50/30 to-purple-50/30 dark:from-gray-900 dark:via-blue-950/30 dark:to-purple-950/30 shadow-lg dark:border-gray-800">
        <div className="px-6 py-5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Title Section */}
            <div className="flex items-center gap-4">
              {/* Animated Icon */}
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl blur opacity-40 animate-pulse"></div>
                <div className="relative bg-gradient-to-br from-blue-500 to-purple-600 p-3 rounded-xl shadow-lg transform hover:scale-110 transition-transform duration-300">
                  <BarChart3 className="h-7 w-7 text-white" />
                </div>
              </div>
              
              {/* Text Content */}
              <div>
                <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
                  SMS Analytics Dashboard
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-2">
                  <Activity className="h-3.5 w-3.5 animate-pulse text-green-500" />
                  Live delivery monitoring and trend analysis
                </p>
              </div>
            </div>

            {/* Date Range Selector - Better Responsive */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-2 bg-white dark:bg-gray-800 px-3 py-1.5 rounded-lg border dark:border-gray-700 shadow-sm">
                <Calendar className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-muted-foreground">Time Range</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {['7', '30', '90', '365'].map((days) => (
                  <Button
                    key={days}
                    variant={dateRange === days ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setDateRange(days)}
                    className={`
                      transition-all duration-200 shadow-sm
                      ${dateRange === days 
                        ? 'shadow-md shadow-primary/25 scale-105' 
                        : 'hover:scale-105'
                      }
                    `}
                    data-testid={`date-range-${days}`}
                  >
                    {days === '365' ? '1 Year' : `${days}d`}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Stats Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-l-4 border-l-blue-500">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Messages
                  </CardTitle>
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {statsLoading ? '...' : (stats?.total || 0).toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Last {dateRange} days
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-green-500">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Delivery Rate
                  </CardTitle>
                  <TrendingUp className="h-4 w-4 text-green-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">
                  {statsLoading ? '...' : `${stats?.deliveryRate.toFixed(1) || 0}%`}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats?.delivered || 0} delivered / {(stats?.delivered || 0) + (stats?.failed || 0)} sent
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-red-500">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Failed
                  </CardTitle>
                  <XCircle className="h-4 w-4 text-red-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-600">
                  {statsLoading ? '...' : (stats?.failed || 0).toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {errorsData?.totalFailed || 0} unique error types
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-purple-500">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Cost
                  </CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  ${statsLoading ? '...' : stats?.totalCost.toFixed(2) || '0.00'}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Avg: ${stats?.total ? (stats.totalCost / stats.total).toFixed(4) : '0.0000'}/msg
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Tabs for Different Views */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3 max-w-md">
              <TabsTrigger value="trends">📈 Trends</TabsTrigger>
              <TabsTrigger value="messages">💬 Messages</TabsTrigger>
              <TabsTrigger value="errors">⚠️ Errors</TabsTrigger>
            </TabsList>

            {/* Trends Tab - VISUAL CHARTS */}
            <TabsContent value="trends" className="mt-4 space-y-6">
              {/* Message Volume Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Message Volume Over Time</CardTitle>
                  <CardDescription>
                    Daily message counts showing traffic patterns and promotional impacts
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {trendsLoading ? (
                    <div className="h-80 flex items-center justify-center text-muted-foreground">
                      <Activity className="h-8 w-8 animate-pulse" />
                    </div>
                  ) : trendsArray.length === 0 ? (
                    <div className="h-80 flex flex-col items-center justify-center text-muted-foreground">
                      <MessageSquare className="h-12 w-12 mb-3 opacity-50" />
                      <p>No message data available yet</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={320}>
                      <LineChart data={trendsArray}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                        <XAxis 
                          dataKey="date" 
                          stroke="#9CA3AF"
                          fontSize={12}
                          tickFormatter={(value) => {
                            const date = new Date(value);
                            return `${date.getMonth() + 1}/${date.getDate()}`;
                          }}
                        />
                        <YAxis stroke="#9CA3AF" fontSize={12} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#1F2937', 
                            border: '1px solid #374151',
                            borderRadius: '8px'
                          }}
                        />
                        <Legend />
                        <Line 
                          type="monotone" 
                          dataKey="total" 
                          stroke="#3B82F6" 
                          strokeWidth={3}
                          name="Total Messages"
                          dot={{ r: 4 }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="delivered" 
                          stroke="#10B981" 
                          strokeWidth={2}
                          name="Delivered"
                          dot={{ r: 3 }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="failed" 
                          stroke="#EF4444" 
                          strokeWidth={2}
                          name="Failed"
                          dot={{ r: 3 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Delivery Success Rate Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Delivery Success Rate Trend</CardTitle>
                  <CardDescription>
                    Track reliability and identify periods with delivery issues
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {trendsArray.length === 0 ? (
                    <div className="h-80 flex items-center justify-center text-muted-foreground">
                      No trend data available
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={320}>
                      <AreaChart data={trendsArray}>
                        <defs>
                          <linearGradient id="deliveryGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                        <XAxis 
                          dataKey="date" 
                          stroke="#9CA3AF"
                          fontSize={12}
                          tickFormatter={(value) => {
                            const date = new Date(value);
                            return `${date.getMonth() + 1}/${date.getDate()}`;
                          }}
                        />
                        <YAxis 
                          stroke="#9CA3AF" 
                          fontSize={12}
                          domain={[0, 100]}
                          tickFormatter={(value) => `${value}%`}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#1F2937', 
                            border: '1px solid #374151',
                            borderRadius: '8px'
                          }}
                          formatter={(value: number) => `${value.toFixed(1)}%`}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="deliveryRate" 
                          stroke="#10B981" 
                          strokeWidth={3}
                          fillOpacity={1} 
                          fill="url(#deliveryGradient)"
                          name="Success Rate"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Cost Tracking Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Daily SMS Costs</CardTitle>
                  <CardDescription>
                    Monitor spending patterns and budget against marketing campaigns
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {trendsArray.length === 0 ? (
                    <div className="h-80 flex items-center justify-center text-muted-foreground">
                      No cost data available
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart data={trendsArray}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                        <XAxis 
                          dataKey="date" 
                          stroke="#9CA3AF"
                          fontSize={12}
                          tickFormatter={(value) => {
                            const date = new Date(value);
                            return `${date.getMonth() + 1}/${date.getDate()}`;
                          }}
                        />
                        <YAxis 
                          stroke="#9CA3AF" 
                          fontSize={12}
                          tickFormatter={(value) => `$${value.toFixed(2)}`}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#1F2937', 
                            border: '1px solid #374151',
                            borderRadius: '8px'
                          }}
                          formatter={(value: number) => [`$${value.toFixed(4)}`, 'Cost']}
                        />
                        <Bar 
                          dataKey="cost" 
                          fill="#8B5CF6" 
                          radius={[8, 8, 0, 0]}
                          name="Daily Cost"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Messages Tab */}
            <TabsContent value="messages" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Recent SMS Messages</CardTitle>
                  <CardDescription>
                    Last 50 messages sent through your system
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[600px] pr-4">
                    <div className="space-y-3">
                      {recentMessages.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                          <p>No SMS messages tracked yet</p>
                        </div>
                      ) : (
                        recentMessages.map((msg) => (
                          <div
                            key={msg.id}
                            className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Phone className="h-4 w-4 text-muted-foreground" />
                                <span className="font-mono text-sm">{msg.to}</span>
                              </div>
                              <Badge className={getStatusColor(msg.status)}>
                                {msg.status}
                              </Badge>
                            </div>
                            
                            <p className="text-sm text-gray-700 dark:text-gray-300 mb-2 line-clamp-2">
                              {msg.body}
                            </p>

                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <div className="flex items-center gap-4">
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {msg.createdAt ? formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true }) : 'Unknown'}
                                </span>
                                {msg.price && (
                                  <span className="flex items-center gap-1">
                                    <DollarSign className="h-3 w-3" />
                                    ${parseFloat(msg.price as string).toFixed(4)}
                                  </span>
                                )}
                              </div>
                              <span className="font-mono text-xs opacity-60">
                                {msg.messageSid.substring(0, 20)}...
                              </span>
                            </div>

                            {msg.errorMessage && (
                              <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
                                <p className="text-xs text-red-700 dark:text-red-400 flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3" />
                                  Error {msg.errorCode}: {msg.errorMessage}
                                </p>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Errors Tab */}
            <TabsContent value="errors" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Error Analysis</CardTitle>
                  <CardDescription>
                    Failed messages grouped by error code for troubleshooting
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[600px] pr-4">
                    {Object.keys(errorBreakdown).length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-50 text-green-600" />
                        <p>No delivery errors!</p>
                        <p className="text-sm mt-1">All messages delivered successfully</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {Object.entries(errorBreakdown).map(([code, details]) => (
                          <div key={code} className="border rounded-lg p-4 hover:border-red-500 transition-colors">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <h3 className="font-semibold flex items-center gap-2">
                                  Error Code {code}
                                  <Badge variant="destructive">{details.count} failures</Badge>
                                </h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {getTwilioErrorDescription(parseInt(code))}
                                </p>
                              </div>
                            </div>

                            <Separator className="my-3" />

                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-2">
                                Twilio Message:
                              </p>
                              <p className="text-sm">{details.message}</p>
                            </div>

                            {details.examples.length > 0 && (
                              <div className="mt-3">
                                <p className="text-xs font-medium text-muted-foreground mb-2">
                                  Affected Numbers:
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {details.examples.map((phone, idx) => (
                                    <Badge key={idx} variant="outline" className="font-mono">
                                      {phone}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
