import { useState, useEffect } from 'react';
import { Calendar, Clock, Repeat } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { format, addMonths, addDays } from 'date-fns';
import { cn } from '@/lib/utils';

export type IntervalType =
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'every_2_months'
  | 'every_3_months'
  | 'quarterly'
  | 'every_6_months'
  | 'yearly'
  | 'first_of_month'
  | '15th_of_month'
  | 'last_of_month'
  | 'custom_dates';

interface IntervalOption {
  value: IntervalType;
  label: string;
  description: string;
  category: 'regular' | 'monthly_anchor' | 'custom';
}

const intervalOptions: IntervalOption[] = [
  // Regular intervals
  { value: 'weekly', label: 'Weekly', description: 'Every week', category: 'regular' },
  { value: 'biweekly', label: 'Every 2 Weeks', description: 'Twice a month', category: 'regular' },
  { value: 'monthly', label: 'Monthly', description: 'Once a month', category: 'regular' },
  { value: 'every_2_months', label: 'Every 2 Months', description: 'Six times a year', category: 'regular' },
  { value: 'every_3_months', label: 'Every 3 Months', description: 'Four times a year', category: 'regular' },
  { value: 'quarterly', label: 'Quarterly', description: 'Every 3 months', category: 'regular' },
  { value: 'every_6_months', label: 'Every 6 Months', description: 'Twice a year', category: 'regular' },
  { value: 'yearly', label: 'Yearly', description: 'Once a year', category: 'regular' },

  // Monthly anchors
  { value: 'first_of_month', label: '1st of Each Month', description: 'Always on the 1st', category: 'monthly_anchor' },
  { value: '15th_of_month', label: '15th of Each Month', description: 'Always on the 15th', category: 'monthly_anchor' },
  { value: 'last_of_month', label: 'Last Day of Month', description: 'End of each month', category: 'monthly_anchor' },

  // Custom
  { value: 'custom_dates', label: 'Specific Dates', description: 'Pick 1-5 custom dates', category: 'custom' },
];

interface FlexibleIntervalPickerProps {
  value?: IntervalType;
  onChange?: (interval: IntervalType) => void;
  onPreferredDayChange?: (day: number) => void; // For weekly/monthly intervals
  preferredDay?: number;
  showPreview?: boolean;
  className?: string;
}

export function FlexibleIntervalPicker({
  value = 'monthly',
  onChange,
  onPreferredDayChange,
  preferredDay,
  showPreview = true,
  className,
}: FlexibleIntervalPickerProps) {
  const [selectedInterval, setSelectedInterval] = useState<IntervalType>(value);

  const handleIntervalChange = (newInterval: string) => {
    const interval = newInterval as IntervalType;
    setSelectedInterval(interval);
    onChange?.(interval);
  };

  const selectedOption = intervalOptions.find(opt => opt.value === selectedInterval);

  // Generate preview dates
  const generatePreviewDates = (): string[] => {
    const today = new Date();
    const preview: string[] = [];

    switch (selectedInterval) {
      case 'weekly':
        for (let i = 0; i < 4; i++) {
          preview.push(format(addDays(today, i * 7), 'MMM d, yyyy'));
        }
        break;
      case 'biweekly':
        for (let i = 0; i < 4; i++) {
          preview.push(format(addDays(today, i * 14), 'MMM d, yyyy'));
        }
        break;
      case 'monthly':
        for (let i = 0; i < 4; i++) {
          preview.push(format(addMonths(today, i), 'MMM d, yyyy'));
        }
        break;
      case 'every_2_months':
        for (let i = 0; i < 3; i++) {
          preview.push(format(addMonths(today, i * 2), 'MMM d, yyyy'));
        }
        break;
      case 'every_3_months':
      case 'quarterly':
        for (let i = 0; i < 4; i++) {
          preview.push(format(addMonths(today, i * 3), 'MMM d, yyyy'));
        }
        break;
      case 'every_6_months':
        preview.push(format(today, 'MMM d, yyyy'));
        preview.push(format(addMonths(today, 6), 'MMM d, yyyy'));
        break;
      case 'yearly':
        preview.push(format(today, 'MMM d, yyyy'));
        preview.push(format(addMonths(today, 12), 'MMM d, yyyy'));
        break;
      case 'first_of_month':
        for (let i = 0; i < 4; i++) {
          const date = addMonths(today, i);
          date.setDate(1);
          preview.push(format(date, 'MMM d, yyyy'));
        }
        break;
      case '15th_of_month':
        for (let i = 0; i < 4; i++) {
          const date = addMonths(today, i);
          date.setDate(15);
          preview.push(format(date, 'MMM d, yyyy'));
        }
        break;
      case 'last_of_month':
        for (let i = 0; i < 4; i++) {
          const date = addMonths(today, i + 1);
          date.setDate(0); // Last day of previous month
          preview.push(format(date, 'MMM d, yyyy'));
        }
        break;
      case 'custom_dates':
        preview.push('Select dates from calendar →');
        break;
    }

    return preview;
  };

  const previewDates = showPreview ? generatePreviewDates() : [];

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Repeat className="h-5 w-5" />
          Recurring Schedule
        </CardTitle>
        <CardDescription>
          Choose how often you'd like this service
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Interval selector */}
        <div className="space-y-2">
          <Label htmlFor="interval-select">Frequency</Label>
          <Select
            value={selectedInterval}
            onValueChange={handleIntervalChange}
          >
            <SelectTrigger id="interval-select" data-testid="select-interval">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {/* Regular intervals */}
              <div className="px-2 py-1.5 text-xs font-semibold text-gray-500">
                Regular Intervals
              </div>
              {intervalOptions
                .filter(opt => opt.category === 'regular')
                .map(option => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    data-testid={`interval-option-${option.value}`}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{option.label}</span>
                      <span className="text-xs text-gray-500">{option.description}</span>
                    </div>
                  </SelectItem>
                ))}

              {/* Monthly anchors */}
              <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 mt-2">
                Monthly Anchors
              </div>
              {intervalOptions
                .filter(opt => opt.category === 'monthly_anchor')
                .map(option => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    data-testid={`interval-option-${option.value}`}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{option.label}</span>
                      <span className="text-xs text-gray-500">{option.description}</span>
                    </div>
                  </SelectItem>
                ))}

              {/* Custom */}
              <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 mt-2">
                Custom
              </div>
              {intervalOptions
                .filter(opt => opt.category === 'custom')
                .map(option => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    data-testid={`interval-option-${option.value}`}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{option.label}</span>
                      <span className="text-xs text-gray-500">{option.description}</span>
                    </div>
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        {/* Preview */}
        {showPreview && previewDates.length > 0 && (
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4" />
              Schedule Preview
            </Label>
            <div className="flex flex-wrap gap-2">
              {previewDates.map((date, idx) => (
                <Badge
                  key={idx}
                  variant="outline"
                  className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                >
                  {idx === 0 && <Clock className="h-3 w-3 mr-1" />}
                  {date}
                </Badge>
              ))}
            </div>
            {selectedInterval !== 'custom_dates' && (
              <p className="text-xs text-gray-500 mt-2">
                ...and continues {selectedOption?.description}
              </p>
            )}
          </div>
        )}

        {/* Help text */}
        <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-3 text-sm text-blue-700 dark:text-blue-300">
          <p className="font-medium">💡 Tip</p>
          <p className="mt-1 text-xs">
            {selectedInterval === 'custom_dates'
              ? 'Perfect for seasonal services! Pick specific dates from the calendar (up to 5 dates per year).'
              : selectedInterval.includes('_of_month')
              ? 'Your service will always happen on the same day each month, making it easy to remember.'
              : 'Your service will repeat automatically at the selected interval. You can pause or adjust anytime.'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
