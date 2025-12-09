import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Calendar, Clock, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { AppShell } from '@/components/AppShell';

export default function OpenShifts() {
  const { toast } = useToast();
  const { data, isLoading } = useQuery({
    queryKey: ['/api/tech/open-shifts'],
  });

  const claimMutation = useMutation({
    mutationFn: async (shiftId: number) => {
      return await apiRequest(`/api/tech/claim-shift/${shiftId}`, 'POST', {});
    },
    onSuccess: () => {
      toast({ title: 'Shift claimed successfully!' });
      queryClient.invalidateQueries({ queryKey: ['/api/tech/open-shifts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tech/my-shifts'] });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to claim shift', 
        description: error.message || 'Shift may no longer be available',
        variant: 'destructive' 
      });
    },
  });

  const shifts = data?.shifts || [];

  return (
    <AppShell>
    <div className="container mx-auto p-4 md:p-6 space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Open Shifts</h1>
        <p className="text-sm md:text-base text-muted-foreground">Claim available shifts</p>
      </div>

      {isLoading ? (
        <div className="text-center py-8">Loading open shifts...</div>
      ) : shifts.length === 0 ? (
        <Card className="p-6 md:p-8 text-center text-muted-foreground">
          <p>No open shifts available at this time</p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {shifts.map((shift: any) => (
            <Card key={shift.id} data-testid={`card-open-shift-${shift.id}`}>
              <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0 pb-2 p-4 md:p-6">
                <CardTitle className="text-sm md:text-base font-medium">
                  <Calendar className="inline w-4 h-4 mr-2" />
                  <span className="break-words">{format(new Date(shift.shiftDate), 'EEEE, MMMM dd, yyyy')}</span>
                </CardTitle>
                <Badge variant="secondary">Open</Badge>
              </CardHeader>
              <CardContent className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 md:p-6 pt-0">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4 flex-shrink-0" />
                  <span className="break-words">{shift.template?.name || 'Shift'}: {shift.startTime} - {shift.endTime}</span>
                </div>
                <Button
                  size="sm"
                  className="w-full sm:w-auto min-h-[44px]"
                  onClick={() => claimMutation.mutate(shift.id)}
                  disabled={claimMutation.isPending}
                  data-testid={`button-claim-shift-${shift.id}`}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Claim Shift
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
    </AppShell>
  );
}
