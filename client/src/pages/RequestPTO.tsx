import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Palmtree, Calendar as CalendarIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';

export default function RequestPTO() {
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [requestType, setRequestType] = useState('vacation');
  const [notes, setNotes] = useState('');
  const { toast } = useToast();

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!startDate || !endDate) {
        throw new Error('Start and end dates are required');
      }

      if (endDate < startDate) {
        throw new Error('End date must be after start date');
      }

      return await apiRequest('/api/tech/pto', 'POST', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        requestType,
        notes: notes.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast({ title: 'PTO request submitted successfully', description: 'Your manager will review your request.' });
      setStartDate(undefined);
      setEndDate(undefined);
      setNotes('');
      setRequestType('vacation');
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Failed to submit request', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  const calculateDays = () => {
    if (!startDate || !endDate) return 0;
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-2xl">
      <Card>
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
            <Palmtree className="w-5 h-5" />
            Request Time Off
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 md:space-y-6 p-4 md:p-6">
          <div>
            <label className="text-sm font-medium mb-2 block">Request Type</label>
            <Select value={requestType} onValueChange={setRequestType}>
              <SelectTrigger data-testid="select-pto-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vacation">Vacation</SelectItem>
                <SelectItem value="sick">Sick Leave</SelectItem>
                <SelectItem value="personal">Personal Day</SelectItem>
                <SelectItem value="unpaid">Unpaid Leave</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Start Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start text-left font-normal min-h-[44px]"
                    data-testid="button-start-date"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar 
                    mode="single" 
                    selected={startDate} 
                    onSelect={setStartDate}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    data-testid="calendar-start-date"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">End Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start text-left font-normal min-h-[44px]"
                    data-testid="button-end-date"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar 
                    mode="single" 
                    selected={endDate} 
                    onSelect={setEndDate}
                    disabled={(date) => {
                      const today = new Date(new Date().setHours(0, 0, 0, 0));
                      if (date < today) return true;
                      if (startDate && date < startDate) return true;
                      return false;
                    }}
                    data-testid="calendar-end-date"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {startDate && endDate && (
            <div className="bg-muted p-4 rounded-lg" data-testid="text-total-days">
              <p className="text-sm font-medium">
                Total Days: <span className="text-lg font-bold">{calculateDays()}</span>
              </p>
            </div>
          )}

          <div>
            <label className="text-sm font-medium mb-2 block">Notes (Optional)</label>
            <Textarea 
              value={notes} 
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional details about your time off request..."
              rows={4}
              data-testid="textarea-pto-notes"
            />
          </div>

          <Button 
            onClick={() => submitMutation.mutate()}
            disabled={!startDate || !endDate || submitMutation.isPending}
            data-testid="button-submit-pto"
            className="w-full min-h-[44px]"
          >
            {submitMutation.isPending ? 'Submitting...' : 'Submit Request'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
