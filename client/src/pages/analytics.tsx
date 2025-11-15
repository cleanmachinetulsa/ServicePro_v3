import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, DollarSign, Calendar, Mail, Target, Users, ArrowUp, ArrowDown, ArrowLeft } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { AppShell } from '@/components/AppShell';

const COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];

export default function AnalyticsPage() {
  const [, navigate] = useLocation();
  const [timeRange, setTimeRange] = useState('12');

  // Fetch seasonal trends
  const { data: seasonalData, isLoading: loadingSeasonal } = useQuery({
    queryKey: ['/api/analytics/seasonal-trends', timeRange],
  });

  // Fetch service popularity
  const { data: serviceData, isLoading: loadingServices } = useQuery({
    queryKey: ['/api/analytics/service-popularity', timeRange],
  });

  // Fetch campaign effectiveness
  const { data: campaignData, isLoading: loadingCampaigns } = useQuery({
    queryKey: ['/api/analytics/campaign-effectiveness'],
  });

  // Fetch financial forecast
  const { data: forecastData, isLoading: loadingForecast } = useQuery({
    queryKey: ['/api/analytics/financial-forecast'],
  });

  // Fetch upsell performance
  const { data: upsellData, isLoading: loadingUpsells } = useQuery({
    queryKey: ['/api/analytics/upsell-performance', timeRange],
  });

  // Prepare chart data
  const seasonalChartData = seasonalData?.appointments?.map((apt: any) => {
    const revenue = seasonalData?.revenue?.find((r: any) => r.month === apt.month);
    return {
      month: apt.month,
      appointments: apt.count,
      completed: apt.completed,
      revenue: Number(revenue?.paidRevenue || 0)
    };
  }) || [];

  const serviceChartData = serviceData?.services?.map((service: any) => ({
    name: service.serviceName.length > 20 ? service.serviceName.slice(0, 20) + '...' : service.serviceName,
    fullName: service.serviceName,
    total: service.count,
    completed: service.completed,
    cancelled: service.cancelled
  })) || [];

  const campaignChartData = campaignData?.campaigns?.map((campaign: any) => ({
    name: campaign.campaignName.length > 15 ? campaign.campaignName.slice(0, 15) + '...' : campaign.campaignName,
    fullName: campaign.campaignName,
    appointments: campaign.appointmentsGenerated,
    revenue: Number(campaign.revenueGenerated),
    roi: campaign.recipientCount > 0 ? ((Number(campaign.revenueGenerated) / campaign.recipientCount) * 100).toFixed(2) : 0
  })) || [];

  // Combine historical and forecast data
  const forecastChartData = [
    ...(forecastData?.historical?.map((h: any) => ({
      month: h.month,
      actual: Number(h.revenue),
      type: 'historical'
    })) || []),
    ...(forecastData?.forecast?.map((f: any) => ({
      month: f.month,
      predicted: f.predictedRevenue,
      type: 'forecast'
    })) || [])
  ];

  const upsellChartData = upsellData?.upsells?.map((u: any) => ({
    month: u.month,
    offered: u.offered,
    accepted: u.accepted,
    acceptanceRate: u.offered > 0 ? ((u.accepted / u.offered) * 100).toFixed(1) : 0,
    revenue: Number(u.revenue || 0)
  })) || [];

  // Calculate summary metrics
  const totalAppointments = seasonalChartData.reduce((sum: number, item: any) => sum + item.appointments, 0);
  const totalRevenue = seasonalChartData.reduce((sum: number, item: any) => sum + item.revenue, 0);
  const avgMonthlyRevenue = seasonalChartData.length > 0 ? totalRevenue / seasonalChartData.length : 0;
  
  const currentMonthRevenue = seasonalChartData[seasonalChartData.length - 1]?.revenue || 0;
  const previousMonthRevenue = seasonalChartData[seasonalChartData.length - 2]?.revenue || 0;
  const revenueGrowth = previousMonthRevenue > 0 
    ? ((currentMonthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100 
    : 0;

  // Page-specific actions
  const pageActions = (
    <div className="flex items-center gap-2">
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={() => navigate('/dashboard')}
        className="gap-2"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>
      <Select value={timeRange} onValueChange={setTimeRange}>
        <SelectTrigger className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="3">Last 3 months</SelectItem>
          <SelectItem value="6">Last 6 months</SelectItem>
          <SelectItem value="12">Last 12 months</SelectItem>
          <SelectItem value="24">Last 24 months</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <AppShell title="Business Analytics" pageActions={pageActions}>
      <div className="p-6 space-y-6">{/* Header Description */}
        <p className="text-gray-600 dark:text-gray-400">
          Insights into seasonal trends, service popularity, and financial forecasting
        </p>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                Total Revenue
                <DollarSign className="h-5 w-5" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">${totalRevenue.toLocaleString()}</div>
              <p className="text-xs text-blue-100 mt-1">Last {timeRange} months</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                Total Appointments
                <Calendar className="h-5 w-5" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{totalAppointments}</div>
              <p className="text-xs text-purple-100 mt-1">Across all services</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                Avg Monthly Revenue
                <Target className="h-5 w-5" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">${Math.round(avgMonthlyRevenue).toLocaleString()}</div>
              <p className="text-xs text-green-100 mt-1">Monthly average</p>
            </CardContent>
          </Card>

          <Card className={`bg-gradient-to-br ${revenueGrowth >= 0 ? 'from-emerald-500 to-emerald-600' : 'from-red-500 to-red-600'} text-white`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                Revenue Growth
                {revenueGrowth >= 0 ? <ArrowUp className="h-5 w-5" /> : <ArrowDown className="h-5 w-5" />}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{revenueGrowth >= 0 ? '+' : ''}{revenueGrowth.toFixed(1)}%</div>
              <p className="text-xs text-white/80 mt-1">Month-over-month</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Analytics Tabs */}
        <Tabs defaultValue="seasonal" className="space-y-6">
          <TabsList className="grid grid-cols-5 w-full lg:w-auto">
            <TabsTrigger value="seasonal">Seasonal Trends</TabsTrigger>
            <TabsTrigger value="services">Services</TabsTrigger>
            <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
            <TabsTrigger value="forecast">Forecast</TabsTrigger>
            <TabsTrigger value="upsells">Upsells</TabsTrigger>
          </TabsList>

          {/* Seasonal Trends Tab */}
          <TabsContent value="seasonal" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Appointments & Revenue Over Time</CardTitle>
                <CardDescription>Track your busy and slow seasons to optimize scheduling and marketing</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingSeasonal ? (
                  <Skeleton className="h-80 w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={seasonalChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip />
                      <Legend />
                      <Line yAxisId="left" type="monotone" dataKey="appointments" stroke="#3b82f6" strokeWidth={2} name="Appointments" />
                      <Line yAxisId="left" type="monotone" dataKey="completed" stroke="#10b981" strokeWidth={2} name="Completed" />
                      <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#8b5cf6" strokeWidth={2} name="Revenue ($)" />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Service Popularity Tab */}
          <TabsContent value="services" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Service Popularity</CardTitle>
                <CardDescription>Identify your most booked services and optimize your offerings</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingServices ? (
                  <Skeleton className="h-80 w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={serviceChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
                              <p className="font-semibold">{data.fullName}</p>
                              <p className="text-sm text-blue-600">Total: {data.total}</p>
                              <p className="text-sm text-green-600">Completed: {data.completed}</p>
                              <p className="text-sm text-red-600">Cancelled: {data.cancelled}</p>
                            </div>
                          );
                        }
                        return null;
                      }} />
                      <Legend />
                      <Bar dataKey="total" fill="#3b82f6" name="Total Bookings" />
                      <Bar dataKey="completed" fill="#10b981" name="Completed" />
                      <Bar dataKey="cancelled" fill="#ef4444" name="Cancelled" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Campaign Effectiveness Tab */}
          <TabsContent value="campaigns" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Marketing Campaign Performance</CardTitle>
                <CardDescription>Measure ROI and effectiveness of your email marketing campaigns</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingCampaigns ? (
                  <Skeleton className="h-80 w-full" />
                ) : campaignChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={campaignChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
                              <p className="font-semibold">{data.fullName}</p>
                              <p className="text-sm text-blue-600">Appointments: {data.appointments}</p>
                              <p className="text-sm text-green-600">Revenue: ${data.revenue}</p>
                              <p className="text-sm text-purple-600">ROI: {data.roi}%</p>
                            </div>
                          );
                        }
                        return null;
                      }} />
                      <Legend />
                      <Bar yAxisId="left" dataKey="appointments" fill="#3b82f6" name="Appointments Generated" />
                      <Bar yAxisId="right" dataKey="revenue" fill="#10b981" name="Revenue ($)" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-80 flex items-center justify-center text-gray-500 dark:text-gray-400">
                    <div className="text-center">
                      <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No email campaigns sent yet</p>
                      <p className="text-sm mt-2">Send your first campaign to see performance data here</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Financial Forecast Tab */}
          <TabsContent value="forecast" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Revenue Forecast</CardTitle>
                <CardDescription>6-month revenue prediction based on historical trends</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingForecast ? (
                  <Skeleton className="h-80 w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={forecastChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="actual" stroke="#3b82f6" strokeWidth={2} name="Actual Revenue" />
                      <Line type="monotone" dataKey="predicted" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="5 5" name="Predicted Revenue" />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Forecast Metrics */}
            {forecastData?.metrics && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Monthly Revenue</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      ${(forecastData.metrics.avgMonthlyRevenue || 0).toLocaleString()}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Growth Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold ${(forecastData.metrics.growthRate || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {(forecastData.metrics.growthRate || 0) >= 0 ? '+' : ''}{((forecastData.metrics.growthRate || 0) * 100).toFixed(1)}%
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Revenue (12mo)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      ${Number(forecastData.metrics.totalRevenue || 0).toLocaleString()}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* Upsell Performance Tab */}
          <TabsContent value="upsells" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Upsell Performance</CardTitle>
                <CardDescription>Track acceptance rates and revenue from upsell offers</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingUpsells ? (
                  <Skeleton className="h-80 w-full" />
                ) : upsellChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={upsellChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip />
                      <Legend />
                      <Bar yAxisId="left" dataKey="offered" fill="#3b82f6" name="Offered" />
                      <Bar yAxisId="left" dataKey="accepted" fill="#10b981" name="Accepted" />
                      <Bar yAxisId="right" dataKey="revenue" fill="#8b5cf6" name="Revenue ($)" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-80 flex items-center justify-center text-gray-500 dark:text-gray-400">
                    <div className="text-center">
                      <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No upsell data available</p>
                      <p className="text-sm mt-2">Create upsell offers to start tracking performance</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
