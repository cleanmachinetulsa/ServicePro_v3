import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calendar as CalendarIcon, Clock, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { AppShell } from '@/components/AppShell';

export default function TechnicianSchedule() {
  const { data, isLoading } = useQuery<{ success: boolean; shifts: any[] }>({
    queryKey: ['/api/tech/my-shifts'],
  });

  const { data: hoursData } = useQuery<{ success: boolean; summary: { totalHours: number; isOvertime: boolean; hoursRemaining: number } }>({
    queryKey: ['/api/tech/hours-summary'],
  });

  const shifts = data?.shifts || [];
  const summary = hoursData?.summary;

  return (
    <AppShell>
    <div className="container mx-auto p-4 md:p-6 space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">My Schedule</h1>
        <p className="text-sm md:text-base text-muted-foreground">Your upcoming shifts for the next 30 days</p>
      </div>

      {summary && summary.isOvertime && (
        <Alert variant="destructive" data-testid="alert-overtime">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Overtime Warning:</strong> You've worked {summary.totalHours} hours this week (40+ hours)
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="text-center py-8">Loading your schedule...</div>
      ) : shifts.length === 0 ? (
        <Card className="p-6 md:p-8 text-center text-muted-foreground">
          <p>No shifts scheduled for the next 30 days</p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {shifts.map((shift: any) => (
            <Card key={shift.id} data-testid={`card-shift-${shift.id}`}>
              <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0 pb-2 p-4 md:p-6">
                <CardTitle className="text-sm md:text-base font-medium">
                  <CalendarIcon className="inline w-4 h-4 mr-2" />
                  <span className="break-words">{format(new Date(shift.shiftDate), 'EEEE, MMMM dd, yyyy')}</span>
                </CardTitle>
                <Badge variant={shift.status === 'scheduled' ? 'default' : 'secondary'}>
                  {shift.status}
                </Badge>
              </CardHeader>
              <CardContent className="p-4 md:p-6 pt-0">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4 flex-shrink-0" />
                  <span className="break-words">{shift.template?.name || 'N/A'}: {shift.template?.startTime} - {shift.template?.endTime}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
    </AppShell>
  );
}
