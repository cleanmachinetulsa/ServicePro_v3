import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { AppShell } from '@/components/AppShell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  Users,
  Calendar,
  Clock,
  Palmtree,
  ArrowLeftRight,
  UserPlus,
  LayoutDashboard,
  CheckCircle2,
  XCircle,
  AlertCircle,
  TrendingUp,
  ArrowLeft,
  Search,
  Menu,
  Filter,
  Edit2,
  ChevronRight,
  FileText,
} from 'lucide-react';

interface Employee {
  id: number;
  preferredName: string;
  fullName: string;
  phone: string | null;
  employmentStatus: string;
  role: string;
  photoThumb96: string | null;
  photoOriginal: string | null;
  profileReviewed: boolean;
  bio?: string | null;
  bioAbout?: string | null;
  specialties?: string[] | null;
  tags?: string[] | null;
  hireDate?: string | null;
  // Employee provisioning fields
  generatedEmail?: string | null;
  phoneExtension?: number | null;
  provisioningStatus?: string | null;
  provisioningError?: string | null;
  provisionedAt?: string | null;
}

export default function AdminEmployees() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Fetch employee overview stats
  const { data: overviewData, isLoading: loadingOverview } = useQuery<{
    success: boolean;
    stats: {
      totalTechnicians: number;
      activeTechnicians: number;
      pendingProfileApprovals: number;
      upcomingPTO: number;
      openShiftTrades: number;
      pendingApplicants: number;
    };
  }>({
    queryKey: ['/api/admin/employees/overview'],
  });

  // Fetch employee directory for sidebar
  const { data: directoryData, isLoading: loadingDirectory } = useQuery<{
    success: boolean;
    employees: Employee[];
  }>({
    queryKey: ['/api/admin/employees/directory', searchQuery, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (statusFilter) params.append('status', statusFilter);
      
      const url = `/api/admin/employees/directory${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch employee directory');
      }
      
      return response.json();
    },
  });

  // Fetch full employee profiles for review queue (pending only)
  const { data: profilesData, isLoading: loadingProfiles } = useQuery<{
    success: boolean;
    employees: Employee[];
  }>({
    queryKey: ['/api/admin/employees/profiles', 'pending'],
    queryFn: async () => {
      const response = await fetch('/api/admin/employees/profiles?status=pending', {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch employee profiles');
      }
      
      return response.json();
    },
  });

  // Approve profile mutation
  const approveMutation = useMutation({
    mutationFn: async (employeeId: number) => {
      const response = await fetch(`/api/admin/employees/${employeeId}/approve`, {
        method: 'POST',
        credentials: 'include',
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to approve profile');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/employees/profiles'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/employees/overview'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/employees/directory'], exact: false });
      toast({
        title: "Profile Approved",
        description: "The technician profile has been approved and is now live.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Approval Failed",
        description: error.message || "Failed to approve profile. Please try again.",
      });
    },
  });

  // Request changes mutation
  const requestChangesMutation = useMutation({
    mutationFn: async ({ employeeId, reason }: { employeeId: number; reason?: string }) => {
      const response = await fetch(`/api/admin/employees/${employeeId}/request-changes`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to request changes');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/employees/profiles'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/employees/overview'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/employees/directory'], exact: false });
      toast({
        title: "Changes Requested",
        description: "The technician will be notified to update their profile.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Request Failed",
        description: error.message || "Failed to request changes. Please try again.",
      });
    },
  });

  // Provision employee mutation (email + phone extension)
  const provisionMutation = useMutation({
    mutationFn: async (employeeId: number) => {
      const response = await fetch(`/api/admin/employees/${employeeId}/provision`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      
      const data = await response.json();
      
      if (!response.ok && response.status !== 207) {
        throw new Error(data.error || 'Failed to provision employee');
      }
      
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/employees'], exact: false });
      
      if (data.success) {
        toast({
          title: "Employee Provisioned",
          description: `Email: ${data.provisioning?.email} | Extension: ${data.provisioning?.extension}`,
        });
      } else {
        // Partial success (207 status)
        toast({
          variant: "destructive",
          title: "Partial Provisioning",
          description: data.message || "Manual email setup required. Check employee details for instructions.",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Provisioning Failed",
        description: error.message || "Failed to provision employee. Please try again.",
      });
    },
  });

  // Retry provisioning mutation (only for failed provisions)
  const retryProvisionMutation = useMutation({
    mutationFn: async (employeeId: number) => {
      const response = await fetch(`/api/admin/employees/${employeeId}/retry-provision`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to retry provisioning');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/employees'], exact: false });
      toast({
        title: "Provisioning Successful",
        description: "Email alias has been created in Google Workspace.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Retry Failed",
        description: error.message || "Failed to retry provisioning. You may need to create the alias manually.",
      });
    },
  });

  const stats = overviewData?.stats || {
    totalTechnicians: 0,
    activeTechnicians: 0,
    pendingProfileApprovals: 0,
    upcomingPTO: 0,
    openShiftTrades: 0,
    pendingApplicants: 0,
  };

  const employees = directoryData?.employees || [];
  const profiles = profilesData?.employees || [];

  // Sidebar content component (reused for both desktop and mobile)
  const SidebarContent = () => (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-border">
        <h2 className="text-lg font-semibold mb-3" data-testid="text-sidebar-title">Employee Directory</h2>
        
        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search employees..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-employees"
          />
        </div>

        {/* Status Filter */}
        <div className="flex gap-1">
          {['all', 'active', 'inactive', 'on_leave'].map((status) => (
            <Button
              key={status}
              variant={statusFilter === status ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(status)}
              className="flex-1 text-xs capitalize"
              data-testid={`button-filter-${status}`}
            >
              {status.replace('_', ' ')}
            </Button>
          ))}
        </div>
      </div>

      {/* Employee List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {loadingDirectory ? (
            <p className="text-sm text-muted-foreground p-4 text-center">Loading...</p>
          ) : employees.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4 text-center">No employees found</p>
          ) : (
            employees.map((employee) => (
              <button
                key={employee.id}
                onClick={() => {
                  setSelectedEmployee(employee);
                  setIsMobileSidebarOpen(false);
                }}
                className={`w-full p-3 rounded-lg text-left transition-colors ${
                  selectedEmployee?.id === employee.id
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-accent'
                }`}
                data-testid={`button-employee-${employee.id}`}
              >
                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={employee.photoThumb96 || undefined} />
                    <AvatarFallback>{employee.preferredName.substring(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{employee.preferredName}</p>
                      {employee.profileReviewed && (
                        <CheckCircle2 className="w-3 h-3 text-green-500 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground capitalize">{employee.role}</p>
                  </div>
                  <Badge
                    variant={employee.employmentStatus === 'active' ? 'default' : 'secondary'}
                    className="text-xs flex-shrink-0"
                  >
                    {employee.employmentStatus}
                  </Badge>
                </div>
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );

  const pageActions = (
    <>
      <Badge variant="outline" data-testid="badge-total-employees">
        <Users className="w-3 h-3 mr-1" />
        {stats.totalTechnicians} Total
      </Badge>
      <Badge variant="default" data-testid="badge-active-employees">
        <CheckCircle2 className="w-3 h-3 mr-1" />
        {stats.activeTechnicians} Active
      </Badge>
    </>
  );

  return (
    <AppShell title="Employee Management" pageActions={pageActions}>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
        <div className="flex h-screen">
          {/* Desktop Sidebar */}
          <aside className="hidden lg:block w-80 bg-background border-r border-border" data-testid="sidebar-desktop">
            <SidebarContent />
          </aside>

          {/* Main Content */}
          <div className="flex-1 overflow-auto">
            <div className="container mx-auto py-6 space-y-6">
              {/* Mobile Sidebar Toggle */}
              <div className="lg:hidden mb-4">
                <Sheet open={isMobileSidebarOpen} onOpenChange={setIsMobileSidebarOpen}>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="sm" data-testid="button-mobile-menu">
                      <Menu className="w-4 h-4 mr-2" />
                      Menu
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-80 p-0">
                    <SidebarContent />
                  </SheetContent>
                </Sheet>
              </div>

        {/* Quick Stats Overview */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card data-testid="card-stat-profiles">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Profiles</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-pending-profiles">
                  {stats.pendingProfileApprovals}
                </div>
                <p className="text-xs text-muted-foreground">Awaiting review</p>
              </CardContent>
            </Card>

            <Card data-testid="card-stat-pto">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Upcoming PTO</CardTitle>
                <Palmtree className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-upcoming-pto">
                  {stats.upcomingPTO}
                </div>
                <p className="text-xs text-muted-foreground">Next 30 days</p>
              </CardContent>
            </Card>

            <Card data-testid="card-stat-trades">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Shift Trades</CardTitle>
                <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-open-trades">
                  {stats.openShiftTrades}
                </div>
                <p className="text-xs text-muted-foreground">Pending approval</p>
              </CardContent>
            </Card>

            <Card data-testid="card-stat-applicants">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Applicants</CardTitle>
                <UserPlus className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-pending-applicants">
                  {stats.pendingApplicants}
                </div>
                <p className="text-xs text-muted-foreground">In pipeline</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-8 h-auto" data-testid="tabs-navigation">
            <TabsTrigger value="overview" className="flex items-center gap-2" data-testid="tab-overview">
              <LayoutDashboard className="w-4 h-4" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="profiles" className="flex items-center gap-2" data-testid="tab-profiles">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Profiles</span>
              {stats.pendingProfileApprovals > 0 && (
                <Badge variant="destructive" className="ml-1" data-testid="badge-profiles-pending">
                  {stats.pendingProfileApprovals}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="scheduling" className="flex items-center gap-2" data-testid="tab-scheduling">
              <Calendar className="w-4 h-4" />
              <span className="hidden sm:inline">Scheduling</span>
            </TabsTrigger>
            <TabsTrigger value="time-tracking" className="flex items-center gap-2" data-testid="tab-time-tracking">
              <Clock className="w-4 h-4" />
              <span className="hidden sm:inline">Time</span>
            </TabsTrigger>
            <TabsTrigger value="pto" className="flex items-center gap-2" data-testid="tab-pto">
              <Palmtree className="w-4 h-4" />
              <span className="hidden sm:inline">PTO</span>
            </TabsTrigger>
            <TabsTrigger value="shift-trades" className="flex items-center gap-2" data-testid="tab-shift-trades">
              <ArrowLeftRight className="w-4 h-4" />
              <span className="hidden sm:inline">Trades</span>
              {stats.openShiftTrades > 0 && (
                <Badge variant="secondary" className="ml-1" data-testid="badge-trades-pending">
                  {stats.openShiftTrades}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="applicants" className="flex items-center gap-2" data-testid="tab-applicants">
              <UserPlus className="w-4 h-4" />
              <span className="hidden sm:inline">Applicants</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2" data-testid="tab-analytics">
              <TrendingUp className="w-4 h-4" />
              <span className="hidden sm:inline">Analytics</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Workforce Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card data-testid="card-workforce-capacity">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Workforce Capacity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Total Staff</span>
                      <span className="font-bold" data-testid="text-total-staff">{stats.totalTechnicians}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Active Today</span>
                      <span className="font-bold text-green-600" data-testid="text-active-today">{stats.activeTechnicians}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">On PTO</span>
                      <span className="font-bold text-blue-600" data-testid="text-on-pto">{stats.upcomingPTO}</span>
                    </div>
                    <div className="w-full bg-secondary h-2 rounded-full mt-3">
                      <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${stats.totalTechnicians > 0 ? (stats.activeTechnicians / stats.totalTechnicians) * 100 : 0}%` }}
                        data-testid="progress-capacity"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground text-center mt-1">
                      {stats.totalTechnicians > 0 ? Math.round((stats.activeTechnicians / stats.totalTechnicians) * 100) : 0}% capacity
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-pending-actions">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Pending Actions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <button
                      onClick={() => setActiveTab('profiles')}
                      className="w-full flex justify-between items-center p-2 rounded-lg hover:bg-accent transition-colors text-left"
                      data-testid="button-pending-profiles-action"
                    >
                      <span className="text-sm">Profile Reviews</span>
                      <Badge variant={stats.pendingProfileApprovals > 0 ? 'destructive' : 'secondary'}>
                        {stats.pendingProfileApprovals}
                      </Badge>
                    </button>
                    <button
                      onClick={() => setActiveTab('shift-trades')}
                      className="w-full flex justify-between items-center p-2 rounded-lg hover:bg-accent transition-colors text-left"
                      data-testid="button-pending-trades-action"
                    >
                      <span className="text-sm">Shift Trades</span>
                      <Badge variant={stats.openShiftTrades > 0 ? 'destructive' : 'secondary'}>
                        {stats.openShiftTrades}
                      </Badge>
                    </button>
                    <button
                      onClick={() => setActiveTab('applicants')}
                      className="w-full flex justify-between items-center p-2 rounded-lg hover:bg-accent transition-colors text-left"
                      data-testid="button-pending-applicants-action"
                    >
                      <span className="text-sm">New Applicants</span>
                      <Badge variant={stats.pendingApplicants > 0 ? 'destructive' : 'secondary'}>
                        {stats.pendingApplicants}
                      </Badge>
                    </button>
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-quick-actions">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Quick Actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => setActiveTab('scheduling')}
                    data-testid="button-action-schedule"
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    Create Schedule
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => setActiveTab('time-tracking')}
                    data-testid="button-action-timesheets"
                  >
                    <Clock className="w-4 h-4 mr-2" />
                    View Timesheets
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => setActiveTab('analytics')}
                    data-testid="button-action-analytics"
                  >
                    <TrendingUp className="w-4 h-4 mr-2" />
                    View Analytics
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Alerts & Notifications */}
            {(stats.pendingProfileApprovals > 0 || stats.openShiftTrades > 0 || stats.upcomingPTO > 3) && (
              <Card data-testid="card-alerts">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-yellow-500" />
                    Action Required
                  </CardTitle>
                  <CardDescription>Items that need your attention</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {stats.pendingProfileApprovals > 0 && (
                    <div className="flex items-start gap-3 p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-900">
                      <Users className="w-5 h-5 text-yellow-600 dark:text-yellow-500 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-medium text-sm">
                          {stats.pendingProfileApprovals} technician profile{stats.pendingProfileApprovals > 1 ? 's' : ''} awaiting review
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Review bio, photos, and approve for customer-facing display
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => setActiveTab('profiles')}
                        data-testid="button-alert-profiles"
                      >
                        Review
                      </Button>
                    </div>
                  )}
                  
                  {stats.openShiftTrades > 0 && (
                    <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-900">
                      <ArrowLeftRight className="w-5 h-5 text-blue-600 dark:text-blue-500 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-medium text-sm">
                          {stats.openShiftTrades} shift trade request{stats.openShiftTrades > 1 ? 's' : ''} pending
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Technicians need approval to swap or claim shifts
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => setActiveTab('shift-trades')}
                        data-testid="button-alert-trades"
                      >
                        Approve
                      </Button>
                    </div>
                  )}

                  {stats.upcomingPTO > 3 && (
                    <div className="flex items-start gap-3 p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-900">
                      <Palmtree className="w-5 h-5 text-purple-600 dark:text-purple-500 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-medium text-sm">
                          {stats.upcomingPTO} upcoming PTO days in the next 30 days
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Review schedule coverage and plan accordingly
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setActiveTab('pto')}
                        data-testid="button-alert-pto"
                      >
                        View
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Employee Status Breakdown */}
            <Card data-testid="card-status-breakdown">
              <CardHeader>
                <CardTitle>Employee Status Overview</CardTitle>
                <CardDescription>Current workforce distribution by employment status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                      <span className="text-sm font-medium">Active</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold" data-testid="text-status-active">{stats.activeTechnicians}</span>
                      <span className="text-sm text-muted-foreground">
                        ({stats.totalTechnicians > 0 ? Math.round((stats.activeTechnicians / stats.totalTechnicians) * 100) : 0}%)
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-gray-500" />
                      <span className="text-sm font-medium">Inactive/Other</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold" data-testid="text-status-other">
                        {stats.totalTechnicians - stats.activeTechnicians}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        ({stats.totalTechnicians > 0 ? Math.round(((stats.totalTechnicians - stats.activeTechnicians) / stats.totalTechnicians) * 100) : 0}%)
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Profiles Review Tab */}
          <TabsContent value="profiles" className="space-y-4">
            <Card data-testid="card-profiles-queue">
              <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <CardTitle>Profile Review Queue</CardTitle>
                    <CardDescription>
                      Review and approve technician bio profiles before they go live
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive" data-testid="badge-pending-count">
                      {stats.pendingProfileApprovals} Pending
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadingProfiles ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">Loading profiles...</p>
                  </div>
                ) : profiles.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
                    <p className="font-medium">All profiles reviewed!</p>
                    <p className="text-sm text-muted-foreground">No pending profiles need your attention</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {profiles.map((employee) => (
                        <div
                          key={employee.id}
                          className="border rounded-lg p-4 space-y-4 hover:bg-accent/50 transition-colors"
                          data-testid={`profile-review-${employee.id}`}
                        >
                          {/* Header */}
                          <div className="flex items-start gap-4">
                            <Avatar className="w-16 h-16">
                              <AvatarImage src={employee.photoThumb96 || undefined} />
                              <AvatarFallback className="text-lg">
                                {employee.preferredName.substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <h3 className="font-semibold text-lg" data-testid={`text-name-${employee.id}`}>
                                    {employee.preferredName}
                                  </h3>
                                  <p className="text-sm text-muted-foreground capitalize">
                                    {employee.role} • Hired {employee.hireDate ? new Date(employee.hireDate).toLocaleDateString() : 'N/A'}
                                  </p>
                                </div>
                                <Badge variant="secondary">{employee.employmentStatus}</Badge>
                              </div>
                              
                              {/* Tags */}
                              {employee.tags && employee.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {employee.tags.map((tag, idx) => (
                                    <Badge key={idx} variant="outline" className="text-xs">
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Bio */}
                          {employee.bioAbout && (
                            <div className="space-y-1">
                              <label className="text-xs font-medium text-muted-foreground uppercase">Bio</label>
                              <p className="text-sm leading-relaxed" data-testid={`text-bio-${employee.id}`}>
                                {employee.bioAbout}
                              </p>
                            </div>
                          )}

                          {/* Specialties */}
                          {employee.specialties && employee.specialties.length > 0 && (
                            <div className="space-y-1">
                              <label className="text-xs font-medium text-muted-foreground uppercase">Specialties</label>
                              <div className="flex flex-wrap gap-1">
                                {employee.specialties.map((specialty, idx) => (
                                  <Badge key={idx} className="text-xs">
                                    {specialty}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Photo Preview */}
                          {employee.photoOriginal && (
                            <div className="space-y-1">
                              <label className="text-xs font-medium text-muted-foreground uppercase">Profile Photo</label>
                              <div className="flex gap-2">
                                <img
                                  src={employee.photoThumb96 || employee.photoOriginal}
                                  alt={employee.preferredName}
                                  className="w-24 h-24 object-cover rounded border"
                                  data-testid={`img-photo-${employee.id}`}
                                />
                              </div>
                            </div>
                          )}

                          {/* Employee Provisioning Status */}
                          <div className="space-y-2 p-3 bg-muted/50 rounded border">
                            <label className="text-xs font-medium text-muted-foreground uppercase">Employee Provisioning</label>
                            
                            {employee.provisioningStatus === 'provisioned' && (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                                  <span className="text-sm font-medium text-green-700 dark:text-green-400">Fully Provisioned</span>
                                </div>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                  <div>
                                    <p className="text-xs text-muted-foreground">Email Alias</p>
                                    <p className="font-mono text-xs">{employee.generatedEmail || 'N/A'}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground">Phone Extension</p>
                                    <p className="font-mono text-xs">Ext. {employee.phoneExtension || 'N/A'}</p>
                                  </div>
                                </div>
                                {employee.provisionedAt && (
                                  <p className="text-xs text-muted-foreground">
                                    Provisioned {new Date(employee.provisionedAt).toLocaleDateString()}
                                  </p>
                                )}
                              </div>
                            )}

                            {employee.provisioningStatus === 'failed' && (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <XCircle className="w-4 h-4 text-red-500" />
                                  <span className="text-sm font-medium text-red-700 dark:text-red-400">Provisioning Failed</span>
                                </div>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                  <div>
                                    <p className="text-xs text-muted-foreground">Email Alias</p>
                                    <p className="font-mono text-xs">{employee.generatedEmail || 'N/A'}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground">Phone Extension</p>
                                    <p className="font-mono text-xs">Ext. {employee.phoneExtension || 'N/A'}</p>
                                  </div>
                                </div>
                                {employee.provisioningError && (
                                  <div className="p-2 bg-red-50 dark:bg-red-950/20 rounded border border-red-200 dark:border-red-900">
                                    <p className="text-xs text-red-700 dark:text-red-400">{employee.provisioningError}</p>
                                  </div>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => retryProvisionMutation.mutate(employee.id)}
                                  disabled={retryProvisionMutation.isPending}
                                  data-testid={`button-retry-provision-${employee.id}`}
                                >
                                  <AlertCircle className="w-4 h-4 mr-2" />
                                  {retryProvisionMutation.isPending ? 'Retrying...' : 'Retry Provisioning'}
                                </Button>
                              </div>
                            )}

                            {(!employee.provisioningStatus || employee.provisioningStatus === 'pending') && (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <AlertCircle className="w-4 h-4 text-yellow-500" />
                                  <span className="text-sm font-medium text-yellow-700 dark:text-yellow-400">Not Provisioned</span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  This employee needs email and extension provisioning for full system access.
                                </p>
                                <Button
                                  size="sm"
                                  onClick={() => provisionMutation.mutate(employee.id)}
                                  disabled={provisionMutation.isPending}
                                  data-testid={`button-provision-${employee.id}`}
                                >
                                  <UserPlus className="w-4 h-4 mr-2" />
                                  {provisionMutation.isPending ? 'Provisioning...' : 'Provision Employee'}
                                </Button>
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex gap-2 pt-2 border-t">
                            <Button
                              size="sm"
                              onClick={() => approveMutation.mutate(employee.id)}
                              disabled={approveMutation.isPending}
                              data-testid={`button-approve-${employee.id}`}
                            >
                              <CheckCircle2 className="w-4 h-4 mr-2" />
                              {approveMutation.isPending ? 'Approving...' : 'Approve Profile'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setLocation(`/tech/wizard?mode=edit&id=${employee.id}`);
                              }}
                              data-testid={`button-edit-${employee.id}`}
                            >
                              <Edit2 className="w-4 h-4 mr-2" />
                              Edit Profile
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => requestChangesMutation.mutate({ employeeId: employee.id })}
                              disabled={requestChangesMutation.isPending}
                              data-testid={`button-reject-${employee.id}`}
                            >
                              <XCircle className="w-4 h-4 mr-2" />
                              {requestChangesMutation.isPending ? 'Requesting...' : 'Request Changes'}
                            </Button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Scheduling Tab */}
          <TabsContent value="scheduling">
            <div className="grid gap-4">
              {/* Weekly Schedule Overview */}
              <Card data-testid="card-scheduling">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Weekly Schedule</CardTitle>
                      <CardDescription>
                        Current week's technician assignments
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" data-testid="button-prev-week">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Previous
                      </Button>
                      <Button variant="outline" size="sm" data-testid="button-next-week">
                        Next
                        <ChevronRight className="w-4 h-4 ml-2" />
                      </Button>
                      <Button size="sm" data-testid="button-auto-schedule">
                        <Calendar className="w-4 h-4 mr-2" />
                        Auto-Schedule
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12 bg-muted/20 rounded-lg border-2 border-dashed">
                    <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                    <h3 className="font-semibold mb-1">No Shifts Scheduled</h3>
                    <p className="text-sm text-muted-foreground mb-4">Get started by creating shift templates or using the auto-scheduler</p>
                    <div className="flex gap-2 justify-center">
                      <Button variant="outline" data-testid="button-create-shift">
                        Create Shift Template
                      </Button>
                      <Button data-testid="button-manage-availability">
                        Manage Availability
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Shift Templates */}
              <Card data-testid="card-shift-templates">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Shift Templates</CardTitle>
                      <CardDescription>Reusable shift patterns for quick scheduling</CardDescription>
                    </div>
                    <Button size="sm" data-testid="button-add-template">
                      <UserPlus className="w-4 h-4 mr-2" />
                      New Template
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground text-center py-8">No shift templates created yet</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Time Tracking Tab */}
          <TabsContent value="time-tracking">
            <div className="grid gap-4">
              {/* Today's Active Employees */}
              <Card data-testid="card-time-tracking">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Today's Attendance</CardTitle>
                      <CardDescription>
                        Currently clocked in and geofencing status
                      </CardDescription>
                    </div>
                    <Badge variant="secondary" data-testid="badge-clocked-in-count">
                      0 Clocked In
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12 bg-muted/20 rounded-lg">
                    <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                    <h3 className="font-semibold mb-1">No Active Clock-Ins</h3>
                    <p className="text-sm text-muted-foreground">Technicians will appear here when they clock in</p>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Time Entries */}
              <Card data-testid="card-recent-entries">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Recent Time Entries</CardTitle>
                      <CardDescription>Last 7 days of clock-in/out records</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" data-testid="button-view-timesheets">
                      <FileText className="w-4 h-4 mr-2" />
                      View Timesheets
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground text-center py-8">No time entries recorded</p>
                </CardContent>
              </Card>

              {/* Geofencing Alerts */}
              <Card data-testid="card-geofence-alerts">
                <CardHeader>
                  <CardTitle>Geofencing Alerts</CardTitle>
                  <CardDescription>Out-of-zone clock-ins requiring review</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
                    <p className="font-medium">All Clear!</p>
                    <p className="text-sm text-muted-foreground">No geofencing violations to review</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* PTO Tab */}
          <TabsContent value="pto">
            <div className="grid gap-4">
              {/* Pending PTO Requests */}
              <Card data-testid="card-pto">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Pending PTO Requests</CardTitle>
                      <CardDescription>
                        Time-off requests awaiting approval
                      </CardDescription>
                    </div>
                    <Badge variant="secondary" data-testid="badge-pending-pto">
                      {stats.upcomingPTO} Pending
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12 bg-muted/20 rounded-lg">
                    <Palmtree className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                    <h3 className="font-semibold mb-1">No Pending Requests</h3>
                    <p className="text-sm text-muted-foreground">PTO requests will appear here for approval</p>
                  </div>
                </CardContent>
              </Card>

              {/* Upcoming PTO */}
              <Card data-testid="card-upcoming-pto">
                <CardHeader>
                  <CardTitle>Upcoming Time Off</CardTitle>
                  <CardDescription>Approved PTO in the next 30 days</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground text-center py-8">No upcoming time off scheduled</p>
                </CardContent>
              </Card>

              {/* PTO Balances */}
              <Card data-testid="card-pto-balances">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Employee PTO Balances</CardTitle>
                      <CardDescription>Accrued and remaining time off by employee</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" data-testid="button-export-balances">
                      Export Report
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground text-center py-8">No PTO balances configured</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Shift Trades Tab */}
          <TabsContent value="shift-trades">
            <div className="grid gap-4">
              {/* Pending Trades */}
              <Card data-testid="card-shift-trades">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Pending Shift Trades</CardTitle>
                      <CardDescription>
                        Swap requests awaiting your approval
                      </CardDescription>
                    </div>
                    <Badge variant="secondary" data-testid="badge-pending-trades">
                      {stats.openShiftTrades} Pending
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12 bg-muted/20 rounded-lg">
                    <ArrowLeftRight className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                    <h3 className="font-semibold mb-1">No Pending Trades</h3>
                    <p className="text-sm text-muted-foreground">Shift swap requests will appear here for approval</p>
                  </div>
                </CardContent>
              </Card>

              {/* Available Shifts */}
              <Card data-testid="card-available-shifts">
                <CardHeader>
                  <CardTitle>Available Shifts</CardTitle>
                  <CardDescription>Open shifts technicians can claim</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground text-center py-8">No available shifts to claim</p>
                </CardContent>
              </Card>

              {/* Trade History */}
              <Card data-testid="card-trade-history">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Recent Trade History</CardTitle>
                      <CardDescription>Last 30 days of approved/rejected swaps</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" data-testid="button-view-all-trades">
                      View All
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground text-center py-8">No trade history yet</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Applicants Tab */}
          <TabsContent value="applicants">
            <div className="grid gap-4">
              {/* Applicant Pipeline Overview */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card data-testid="card-new-applicants">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">New Applications</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="text-new-count">0</div>
                    <p className="text-xs text-muted-foreground">Last 7 days</p>
                  </CardContent>
                </Card>
                <Card data-testid="card-screening-applicants">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Screening</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="text-screening-count">0</div>
                    <p className="text-xs text-muted-foreground">In review</p>
                  </CardContent>
                </Card>
                <Card data-testid="card-interview-applicants">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Interviewing</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="text-interview-count">0</div>
                    <p className="text-xs text-muted-foreground">Scheduled</p>
                  </CardContent>
                </Card>
                <Card data-testid="card-offer-applicants">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Offers Extended</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="text-offer-count">0</div>
                    <p className="text-xs text-muted-foreground">Pending acceptance</p>
                  </CardContent>
                </Card>
              </div>

              {/* Recent Applications */}
              <Card data-testid="card-applicants">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Recent Applications</CardTitle>
                      <CardDescription>
                        Latest job applications and their status
                      </CardDescription>
                    </div>
                    <Button size="sm" data-testid="button-add-applicant">
                      <UserPlus className="w-4 h-4 mr-2" />
                      Add Applicant
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12 bg-muted/20 rounded-lg border-2 border-dashed">
                    <UserPlus className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                    <h3 className="font-semibold mb-1">No Applications Yet</h3>
                    <p className="text-sm text-muted-foreground mb-4">Start building your talent pipeline by adding applicants</p>
                    <Button variant="outline" data-testid="button-create-job-post">
                      Create Job Posting
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Upcoming Interviews */}
              <Card data-testid="card-upcoming-interviews">
                <CardHeader>
                  <CardTitle>Upcoming Interviews</CardTitle>
                  <CardDescription>Scheduled interviews in the next 7 days</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground text-center py-8">No interviews scheduled</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics">
            <Card data-testid="card-analytics">
              <CardHeader>
                <CardTitle>Workforce Analytics</CardTitle>
                <CardDescription>
                  Performance metrics, attendance trends, and productivity insights
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Analytics functionality coming soon...</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
