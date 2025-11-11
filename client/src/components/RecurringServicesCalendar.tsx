import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, parse, addDays } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface CalendarDay {
  date: string; // YYYY-MM-DD
  isAvailable: boolean;
  reason?: string;
  timeSlots?: TimeSlot[];
}

interface TimeSlot {
  start: string; // ISO 8601
  end: string;
  available: boolean;
  reason?: string;
}

interface RecurringServicesCalendarProps {
  serviceDurationMinutes: number;
  selectedDates?: string[]; // Array of selected dates (YYYY-MM-DD)
  onDateSelect?: (date: string) => void;
  onMultiDateSelect?: (dates: string[]) => void;
  multiSelectMode?: boolean;
  maxSelections?: number; // Max dates for multi-select (default 5)
  availabilityData?: CalendarDay[];
  loading?: boolean;
}

export function RecurringServicesCalendar({
  serviceDurationMinutes,
  selectedDates = [],
  onDateSelect,
  onMultiDateSelect,
  multiSelectMode = false,
  maxSelections = 5,
  availabilityData = [],
  loading = false,
}: RecurringServicesCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeSlot | null>(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const handlePreviousMonth = () => {
    setCurrentMonth(prev => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(prev => addMonths(prev, 1));
  };

  const handleDateClick = (dateStr: string, dayAvailability: CalendarDay) => {
    if (!dayAvailability.isAvailable) return;

    if (multiSelectMode && onMultiDateSelect) {
      const newSelection = selectedDates.includes(dateStr)
        ? selectedDates.filter(d => d !== dateStr)
        : selectedDates.length < maxSelections
        ? [...selectedDates, dateStr]
        : selectedDates;

      onMultiDateSelect(newSelection);
    } else if (onDateSelect) {
      onDateSelect(dateStr);
    }
  };

  const getDayAvailability = (date: Date): CalendarDay => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return availabilityData.find(d => d.date === dateStr) || {
      date: dateStr,
      isAvailable: false,
      reason: 'loading',
    };
  };

  const getDayIcon = (dayAvailability: CalendarDay) => {
    if (loading) return <Clock className="h-4 w-4 text-gray-400" />;
    if (dayAvailability.isAvailable) return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    if (dayAvailability.reason === 'closed') return <XCircle className="h-4 w-4 text-gray-400" />;
    if (dayAvailability.reason === 'fully_booked') return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    return null;
  };

  const getDayClasses = (date: Date, dayAvailability: CalendarDay) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const isSelected = selectedDates.includes(dateStr);
    const isCurrentToday = isToday(date);

    return cn(
      'min-h-[80px] p-2 border rounded-lg transition-all cursor-pointer',
      !isSameMonth(date, currentMonth) && 'opacity-40',
      isCurrentToday && 'ring-2 ring-blue-500',
      isSelected && 'bg-blue-100 dark:bg-blue-900 border-blue-500',
      dayAvailability.isAvailable && !isSelected && 'hover:bg-green-50 dark:hover:bg-green-900/20 border-green-200',
      !dayAvailability.isAvailable && 'bg-gray-50 dark:bg-gray-800 cursor-not-allowed',
      loading && 'animate-pulse'
    );
  };

  const getAvailableSlotsCount = (dayAvailability: CalendarDay): number => {
    if (!dayAvailability.timeSlots) return 0;
    return dayAvailability.timeSlots.filter(slot => slot.available).length;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Select {multiSelectMode ? 'Dates' : 'Date'}
            </CardTitle>
            <CardDescription>
              {multiSelectMode
                ? `Choose up to ${maxSelections} dates for your recurring service`
                : 'Choose a date for your service appointment'}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handlePreviousMonth}
              data-testid="button-prev-month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-lg font-semibold min-w-[140px] text-center">
              {format(currentMonth, 'MMMM yyyy')}
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={handleNextMonth}
              data-testid="button-next-month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {multiSelectMode && (
          <div className="mt-4">
            <Badge variant="outline" className="text-sm">
              {selectedDates.length} / {maxSelections} dates selected
            </Badge>
          </div>
        )}
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-7 gap-2">
          {/* Day headers */}
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center text-sm font-semibold text-gray-600 dark:text-gray-400 py-2">
              {day}
            </div>
          ))}

          {/* Calendar days */}
          {monthDays.map((date, idx) => {
            const dayAvailability = getDayAvailability(date);
            const dateStr = format(date, 'yyyy-MM-dd');
            const availableSlotsCount = getAvailableSlotsCount(dayAvailability);

            return (
              <div
                key={idx}
                className={getDayClasses(date, dayAvailability)}
                onClick={() => handleDateClick(dateStr, dayAvailability)}
                data-testid={`calendar-day-${dateStr}`}
              >
                <div className="flex items-start justify-between">
                  <span className={cn(
                    'text-sm font-medium',
                    !isSameMonth(date, currentMonth) && 'text-gray-400',
                    isToday(date) && 'text-blue-600 dark:text-blue-400'
                  )}>
                    {format(date, 'd')}
                  </span>
                  {getDayIcon(dayAvailability)}
                </div>

                {dayAvailability.isAvailable && availableSlotsCount > 0 && (
                  <div className="mt-1">
                    <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                      {availableSlotsCount} slots
                    </span>
                  </div>
                )}

                {!dayAvailability.isAvailable && dayAvailability.reason && (
                  <div className="mt-1">
                    <span className="text-xs text-gray-500 capitalize">
                      {dayAvailability.reason.replace('_', ' ')}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-6 flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span className="text-gray-600 dark:text-gray-400">Available</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-yellow-500" />
            <span className="text-gray-600 dark:text-gray-400">Fully Booked</span>
          </div>
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-gray-400" />
            <span className="text-gray-600 dark:text-gray-400">Closed</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
