import React, { useState, useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { CloudRain, AlertTriangle, CalendarDays } from 'lucide-react';
import { format, parseISO, isSameDay, isBefore, isWeekend } from 'date-fns';

interface WeatherAlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProceed: () => void;
  onReschedule: (newDate?: Date) => void;
  weatherRiskLevel: 'none' | 'low' | 'moderate' | 'high' | 'very-high' | 'severe';
  precipitationChance: number;
  date: string;
  selectedService?: string;
}

const WeatherAlertDialog: React.FC<WeatherAlertDialogProps> = ({
  open,
  onOpenChange,
  onProceed,
  onReschedule,
  weatherRiskLevel,
  precipitationChance,
  date,
  selectedService
}) => {
  const [showRescheduling, setShowRescheduling] = useState(false);
  const [availableDates, setAvailableDates] = useState<Date[]>([]);
  const [selectedNewDate, setSelectedNewDate] = useState<Date | undefined>(undefined);
  const [isLoadingDates, setIsLoadingDates] = useState(false);

  // Fetch available dates when rescheduling view is shown
  useEffect(() => {
    if (showRescheduling && selectedService && availableDates.length === 0) {
      fetchAvailableDates();
    }
  }, [showRescheduling, selectedService]);

  const fetchAvailableDates = async () => {
    setIsLoadingDates(true);
    try {
      const response = await fetch(`/api/available-slots?service=${encodeURIComponent(selectedService || '')}`);
      if (!response.ok) {
        throw new Error('Failed to fetch available slots');
      }
      
      const data = await response.json();
      if (data.success && data.slots && Array.isArray(data.slots)) {
        // Extract unique dates from slots
        const dates = data.slots.map((slot: string) => {
          const slotDate = new Date(slot);
          slotDate.setHours(0, 0, 0, 0);
          return slotDate;
        });
        
        // Remove duplicates
        const uniqueDates = dates.filter((date: Date, index: number, self: Date[]) => 
          self.findIndex(d => d.getTime() === date.getTime()) === index
        );
        
        setAvailableDates(uniqueDates);
      }
    } catch (error) {
      console.error('Error fetching available dates:', error);
    } finally {
      setIsLoadingDates(false);
    }
  };

  const handleRescheduleClick = () => {
    setShowRescheduling(true);
  };

  const handleConfirmReschedule = () => {
    if (selectedNewDate) {
      onReschedule(selectedNewDate);
    }
  };

  const handleBackToAlert = () => {
    setShowRescheduling(false);
    setSelectedNewDate(undefined);
  };

  // Helper function to get color and message based on risk level
  const getRiskData = () => {
    switch (weatherRiskLevel) {
      case 'severe':
        return {
          color: 'bg-red-600 bg-opacity-20 text-red-800',
          icon: <AlertTriangle className="h-5 w-5 text-red-800 mr-2" />,
          title: 'Severe Weather Warning',
          description: `There is an extremely high chance (${precipitationChance}%) of rain on the selected date. This will almost certainly prevent us from performing quality detailing work.`
        };
      case 'very-high':
        return {
          color: 'bg-orange-500 bg-opacity-30 text-orange-800',
          icon: <CloudRain className="h-5 w-5 text-orange-800 mr-2" />,
          title: 'Very High Chance of Rain',
          description: `There is a very high chance (${precipitationChance}%) of rain on the selected date. This may significantly impact our ability to provide quality service.`
        };
      case 'high':
        return {
          color: 'bg-orange-400 bg-opacity-25 text-orange-800',
          icon: <CloudRain className="h-5 w-5 text-orange-800 mr-2" />,
          title: 'High Chance of Rain',
          description: `There is a high chance (${precipitationChance}%) of rain on the selected date. This may affect the quality of our detailing service.`
        };
      case 'moderate':
        return {
          color: 'bg-yellow-400 bg-opacity-30 text-yellow-800',
          icon: <CloudRain className="h-5 w-5 text-yellow-800 mr-2" />,
          title: 'Moderate Chance of Rain',
          description: `There is a moderate chance (${precipitationChance}%) of rain on the selected date. We can still perform the service, but exterior detailing might be affected.`
        };
      default:
        return {
          color: 'bg-green-500 bg-opacity-20 text-green-800',
          icon: <CloudRain className="h-5 w-5 text-green-800 mr-2" />,
          title: 'Weather Notice',
          description: `There is a low chance (${precipitationChance}%) of rain on the selected date.`
        };
    }
  };

  const { color, icon, title, description } = getRiskData();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        {!showRescheduling ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center">
                {icon} {title}
              </AlertDialogTitle>
              <div className={`p-3 rounded-md ${color} mb-3 mt-1`}>
                <AlertDialogDescription className="text-inherit">
                  {description}
                </AlertDialogDescription>
              </div>
              <AlertDialogDescription>
                Would you like to proceed with this appointment time or choose a different date?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => onOpenChange(false)}>Cancel</AlertDialogCancel>
              <Button variant="outline" onClick={handleRescheduleClick}>
                <CalendarDays className="h-4 w-4 mr-2" />
                Reschedule
              </Button>
              <AlertDialogAction onClick={onProceed}>
                Proceed Anyway
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center">
                <CalendarDays className="h-5 w-5 mr-2 text-blue-600" />
                Choose a New Date
              </AlertDialogTitle>
              <AlertDialogDescription>
                Select a date with better weather conditions for your appointment.
              </AlertDialogDescription>
            </AlertDialogHeader>
            
            <div className="py-4">
              {isLoadingDates ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-gray-500">Loading available dates...</div>
                </div>
              ) : (
                <Calendar
                  mode="single"
                  selected={selectedNewDate}
                  onSelect={setSelectedNewDate}
                  disabled={(date) => {
                    return (
                      isBefore(date, new Date()) ||
                      isWeekend(date) ||
                      !availableDates.some(availableDate => 
                        isSameDay(availableDate, date)
                      )
                    );
                  }}
                  className="rounded-md border"
                />
              )}
              
              {selectedNewDate && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
                  <p className="text-sm text-green-800">
                    <strong>New Date:</strong> {format(selectedNewDate, 'EEEE, MMMM d, yyyy')}
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    You'll be able to select a specific time on the next step.
                  </p>
                </div>
              )}
            </div>
            
            <AlertDialogFooter>
              <Button variant="outline" onClick={handleBackToAlert}>
                Back
              </Button>
              <Button 
                onClick={handleConfirmReschedule}
                disabled={!selectedNewDate}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Continue with This Date
              </Button>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default WeatherAlertDialog;