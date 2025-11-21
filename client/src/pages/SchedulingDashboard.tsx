import { useQuery, useMutation } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { format, addDays, startOfWeek, endOfWeek, isSameDay, addWeeks } from 'date-fns';
import { Calendar as CalendarIcon, Plus, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { AppShell } from '@/components/AppShell';

export default function SchedulingDashboard() {
  const [selectedWeek, setSelectedWeek] = useState(new Date());
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedTechnicianId, setSelectedTechnicianId] = useState<string>('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const { toast } = useToast();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const weekParam = params.get('week');
    
    if (weekParam === 'next') {
      setSelectedWeek(addWeeks(new Date(), 1));
    } else if (weekParam === 'after-next') {
      setSelectedWeek(addWeeks(new Date(), 2));
    }
  }, []);

  const weekStart = startOfWeek(selectedWeek, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(selectedWeek, { weekStartsOn: 1 }); // Sunday

  // Generate array of dates for the week
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Fetch shifts for selected week
  const { data: shiftsData, isLoading } = useQuery({
    queryKey: ['/api/admin/shifts', weekStart.toISOString(), weekEnd.toISOString()],
    queryFn: async () => {
      const response = await fetch(
        `/api/admin/shifts?startDate=${format(weekStart, 'yyyy-MM-dd')}&endDate=${format(weekEnd, 'yyyy-MM-dd')}`
      );
      if (!response.ok) throw new Error('Failed to fetch shifts');
      return response.json();
    },
  });

  // Fetch shift templates
  const { data: templatesData } = useQuery({
    queryKey: ['/api/admin/shift-templates'],
  });

  // Fetch technicians
  const { data: techniciansData } = useQuery({
    queryKey: ['/api/technicians'],
  });

  // Create shift mutation
  const createShiftMutation = useMutation({
    mutationFn: async (data: { technicianId: number; shiftDate: string; shiftTemplateId: number }) => {
      return await apiRequest('/api/admin/shifts', 'POST', data);
    },
    onSuccess: () => {
      toast({ title: 'Shift assigned successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/shifts'] });
      setAssignDialogOpen(false);
      setSelectedTechnicianId('');
      setSelectedTemplateId('');
      setSelectedDate('');
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to assign shift', 
        description: error?.message || 'Please try again',
        variant: 'destructive' 
      });
    },
  });

  // Delete shift mutation
  const deleteShiftMutation = useMutation({
    mutationFn: async (shiftId: number) => {
      return await apiRequest(`/api/admin/shifts/${shiftId}`, 'DELETE', {});
    },
    onSuccess: () => {
      toast({ title: 'Shift removed' });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/shifts'] });
    },
    onError: () => {
      toast({ title: 'Failed to remove shift', variant: 'destructive' });
    },
  });

  const shifts = shiftsData?.shifts || [];
  const templates = templatesData?.templates || [];
  const technicians = techniciansData?.technicians || [];

  const handleCellClick = (technicianId: number, date: Date) => {
    setSelectedTechnicianId(technicianId.toString());
    setSelectedDate(format(date, 'yyyy-MM-dd'));
    setAssignDialogOpen(true);
  };

  const handleAssignShift = () => {
    if (!selectedTechnicianId || !selectedTemplateId || !selectedDate) {
      toast({
        title: 'Missing information',
        description: 'Please select technician, shift template, and date',
        variant: 'destructive',
      });
      return;
    }

    createShiftMutation.mutate({
      technicianId: parseInt(selectedTechnicianId),
      shiftDate: selectedDate,
      shiftTemplateId: parseInt(selectedTemplateId),
    });
  };

  // Calculate summary stats
  const totalShifts = shifts.length;
  const scheduledShifts = shifts.filter((s: any) => s.status === 'scheduled').length;
  const completedShifts = shifts.filter((s: any) => s.status === 'completed').length;

  const pageActions = (
    <Button onClick={() => setAssignDialogOpen(true)} data-testid="button-assign-shift">
      <Plus className="mr-2 h-4 w-4" />
      Assign Shift
    </Button>
  );

  return (
    <AppShell title="Shift Scheduling" pageActions={pageActions}>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">Manage technician shifts and schedules</div>
        </div>
        <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto" data-testid="button-assign-shift">
              <Plus className="w-4 h-4 mr-2" />
              Assign Shift
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Shift</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="technician">Technician</Label>
                <Select
                  value={selectedTechnicianId}
                  onValueChange={setSelectedTechnicianId}
                >
                  <SelectTrigger id="technician" data-testid="select-technician">
                    <SelectValue placeholder="Select technician" />
                  </SelectTrigger>
                  <SelectContent>
                    {technicians.map((tech: any) => (
                      <SelectItem key={tech.id} value={tech.id.toString()}>
                        {tech.preferredName || tech.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="template">Shift Template</Label>
                <Select
                  value={selectedTemplateId}
                  onValueChange={setSelectedTemplateId}
                >
                  <SelectTrigger id="template" data-testid="select-template">
                    <SelectValue placeholder="Select shift template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template: any) => (
                      <SelectItem key={template.id} value={template.id.toString()}>
                        {template.name} ({template.startTime} - {template.endTime})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Select
                  value={selectedDate}
                  onValueChange={setSelectedDate}
                >
                  <SelectTrigger id="date" data-testid="select-date">
                    <SelectValue placeholder="Select date" />
                  </SelectTrigger>
                  <SelectContent>
                    {weekDates.map((date) => (
                      <SelectItem key={date.toISOString()} value={format(date, 'yyyy-MM-dd')}>
                        {format(date, 'EEEE, MMM dd, yyyy')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleAssignShift}
                disabled={createShiftMutation.isPending}
                className="w-full"
                data-testid="button-submit-shift"
              >
                {createShiftMutation.isPending ? 'Assigning...' : 'Assign Shift'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="p-4 md:p-6">
          <div className="text-sm text-muted-foreground">Total Shifts</div>
          <div className="text-2xl font-bold" data-testid="stat-total-shifts">{totalShifts}</div>
        </Card>
        <Card className="p-4 md:p-6">
          <div className="text-sm text-muted-foreground">Scheduled</div>
          <div className="text-2xl font-bold" data-testid="stat-scheduled-shifts">{scheduledShifts}</div>
        </Card>
        <Card className="p-4 md:p-6">
          <div className="text-sm text-muted-foreground">Completed</div>
          <div className="text-2xl font-bold" data-testid="stat-completed-shifts">{completedShifts}</div>
        </Card>
      </div>

      {/* Week selector */}
      <Card className="p-4 md:p-6">
        <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
          <Button
            variant="outline"
            className="w-full sm:w-auto min-h-[44px]"
            onClick={() => setSelectedWeek(addDays(selectedWeek, -7))}
            data-testid="button-prev-week"
          >
            <ChevronLeft className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Previous Week</span>
            <span className="sm:hidden">Previous</span>
          </Button>
          <div className="flex-1 text-center font-semibold text-sm md:text-base">
            <CalendarIcon className="w-4 h-4 inline mr-2" />
            {format(weekStart, 'MMM dd')} - {format(weekEnd, 'MMM dd, yyyy')}
          </div>
          <Button
            variant="outline"
            className="w-full sm:w-auto min-h-[44px]"
            onClick={() => setSelectedWeek(addDays(selectedWeek, 7))}
            data-testid="button-next-week"
          >
            <span className="hidden sm:inline">Next Week</span>
            <span className="sm:hidden">Next</span>
            <ChevronRight className="w-4 h-4 sm:ml-2" />
          </Button>
        </div>
      </Card>

      {/* Shifts Views */}
      <Card className="p-4 md:p-6">
        <Tabs defaultValue="table" className="w-full">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <h2 className="text-lg md:text-xl font-semibold">Shift Assignments</h2>
            <TabsList data-testid="tabs-view-selector">
              <TabsTrigger value="table" data-testid="tab-list-view">List View</TabsTrigger>
              <TabsTrigger value="calendar" data-testid="tab-calendar-view">Calendar Grid</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="table" data-testid="content-table-view">
            {isLoading ? (
              <div className="text-center py-8">Loading shifts...</div>
            ) : shifts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No shifts scheduled for this week. Click "Assign Shift" to get started.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Technician</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Shift Type</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shifts.map((shift: any) => (
                      <TableRow key={shift.id} data-testid={`row-shift-${shift.id}`}>
                        <TableCell className="font-medium">
                          {shift.technician?.preferredName || shift.technician?.fullName || 'Unknown'}
                        </TableCell>
                        <TableCell>{format(new Date(shift.shiftDate), 'EEE, MMM dd, yyyy')}</TableCell>
                        <TableCell>{shift.template?.name || 'Custom'}</TableCell>
                        <TableCell>
                          {shift.startTime} - {shift.endTime}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={shift.status === 'scheduled' ? 'default' : shift.status === 'completed' ? 'secondary' : 'outline'}
                            data-testid={`badge-status-${shift.id}`}
                          >
                            {shift.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="min-h-[44px] min-w-[44px]"
                            onClick={() => deleteShiftMutation.mutate(shift.id)}
                            disabled={deleteShiftMutation.isPending}
                            data-testid={`button-delete-shift-${shift.id}`}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="calendar" data-testid="content-calendar-view">
            {isLoading ? (
              <div className="text-center py-8">Loading shifts...</div>
            ) : technicians.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No technicians available. Add technicians to start scheduling.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse" data-testid="table-calendar-grid">
                  <thead>
                    <tr>
                      <th className="border border-border p-2 bg-muted font-semibold text-left min-w-[120px] sticky left-0 z-10">
                        Technician
                      </th>
                      {weekDates.map((day) => (
                        <th 
                          key={day.toISOString()} 
                          className="border border-border p-2 bg-muted font-semibold text-center min-w-[120px]"
                          data-testid={`header-day-${format(day, 'yyyy-MM-dd')}`}
                        >
                          <div className="text-xs md:text-sm">
                            {format(day, 'EEE')}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(day, 'MMM dd')}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {technicians.map((tech: any) => (
                      <tr key={tech.id} data-testid={`row-tech-${tech.id}`}>
                        <td className="border border-border p-2 font-medium bg-background sticky left-0 z-10">
                          {tech.preferredName || tech.fullName}
                        </td>
                        {weekDates.map((day) => {
                          const dayShifts = shifts.filter(
                            (s: any) =>
                              s.technicianId === tech.id &&
                              isSameDay(new Date(s.shiftDate), day)
                          );
                          return (
                            <td
                              key={day.toISOString()}
                              className="border border-border p-2 cursor-pointer hover:bg-muted/50 transition-colors min-h-[60px] align-top"
                              onClick={() => handleCellClick(tech.id, day)}
                              data-testid={`cell-${tech.id}-${format(day, 'yyyy-MM-dd')}`}
                            >
                              <div className="flex flex-col gap-1">
                                {dayShifts.length === 0 ? (
                                  <div className="text-xs text-muted-foreground text-center py-2">
                                    Click to assign
                                  </div>
                                ) : (
                                  dayShifts.map((shift: any) => (
                                    <Badge
                                      key={shift.id}
                                      variant={
                                        shift.status === 'scheduled'
                                          ? 'default'
                                          : shift.status === 'completed'
                                          ? 'secondary'
                                          : 'outline'
                                      }
                                      className="text-xs justify-center"
                                      data-testid={`badge-shift-${shift.id}`}
                                    >
                                      {shift.template?.name || 'Custom'}
                                    </Badge>
                                  ))
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </Card>
    </AppShell>
  );
}
