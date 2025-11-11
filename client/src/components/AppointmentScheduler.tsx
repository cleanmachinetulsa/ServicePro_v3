import React, { useState, useEffect } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, isWeekend, addMonths, isSameDay, isBefore } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import ServiceAreaCheck from "./ServiceAreaCheck";
import WeatherAlertDialog from "./WeatherAlertDialog";
import { DynamicPricingVisualization } from "./DynamicPricingVisualization";
import BookingLoyaltyDisplay from "./BookingLoyaltyDisplay";
import BookingPriceCalculator from "./BookingPriceCalculator";

interface AppointmentSchedulerProps {
  onClose: () => void;
  onSuccess: (appointment: AppointmentDetails) => void;
}

interface Service {
  name: string;
  priceRange: string;
  description: string;
  duration: string;
  durationHours: number;
}

interface AddOnService {
  name: string;
  priceRange: string;
  description: string;
  recommended: boolean;
}

interface VehicleInfo {
  make: string;
  model: string;
  year: string;
  color: string;
  conditions: string[];
}

interface AppointmentDetails {
  name: string;
  phone: string;
  address: string;
  isExtendedAreaRequest: boolean;
  service: string;
  addOns: string[];
  vehicles: VehicleInfo[];
  notes: string;
  time: string;
  formattedTime: string;
}

export default function AppointmentScheduler({
  onClose,
  onSuccess,
}: AppointmentSchedulerProps) {
  const [step, setStep] = useState<"address" | "service" | "addons" | "vehicle" | "date" | "time" | "details">("address");
  const [customerAddress, setCustomerAddress] = useState<string>("");
  const [isExtendedAreaRequest, setIsExtendedAreaRequest] = useState<boolean>(false);
  const [selectedService, setSelectedService] = useState<string>("");
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);
  
  // Multi-vehicle state
  const [vehicles, setVehicles] = useState<VehicleInfo[]>([{
    make: "",
    model: "",
    year: "",
    color: "",
    conditions: []
  }]);
  const [currentVehicleIndex, setCurrentVehicleIndex] = useState<number>(0);
  const [showAddVehicleButton, setShowAddVehicleButton] = useState<boolean>(true);
  const [otherCondition, setOtherCondition] = useState<string>("");
  
  // Access current vehicle for form display
  const currentVehicle = vehicles[currentVehicleIndex];
  
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [smsConsent, setSmsConsent] = useState<boolean>(false);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [availableDates, setAvailableDates] = useState<Date[]>([]);
  const [dailyTimeSlots, setDailyTimeSlots] = useState<Record<string, string[]>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [services, setServices] = useState<Service[]>([]);
  const [addOnServices, setAddOnServices] = useState<AddOnService[]>([]);
  const [isLoadingServices, setIsLoadingServices] = useState<boolean>(true);
  const [isLoadingAddOns, setIsLoadingAddOns] = useState<boolean>(false);
  const [showWeatherAlert, setShowWeatherAlert] = useState<boolean>(false);
  const [weatherData, setWeatherData] = useState<{
    weatherRiskLevel: 'none' | 'low' | 'moderate' | 'high' | 'very-high' | 'severe';
    precipitationChance: number;
  }>({
    weatherRiskLevel: 'none',
    precipitationChance: 0
  });
  
  // State for pricing calculations
  const [basePriceEstimate, setBasePriceEstimate] = useState<number>(0);
  const [addOnPrices, setAddOnPrices] = useState<Record<string, number>>({});
  const [conditionPrices, setConditionPrices] = useState<Record<string, number>>({
    "Excessive pet hair": 25,
    "Heavy stains": 35,
    "Smoke odor": 50,
    "Mud or dirt buildup": 20,
    "Water damage": 75
  });
  // For loyalty points calculation
  const [calculatedPoints, setCalculatedPoints] = useState<number>(0);
  const [totalEstimatedPrice, setTotalEstimatedPrice] = useState<number>(0);
  const { toast } = useToast();

  // Calculate total price based on selected services, add-ons, and vehicle conditions
  const calculateTotalPrice = () => {
    let total = basePriceEstimate;
    
    // Add add-on prices
    selectedAddOns.forEach(addon => {
      total += addOnPrices[addon] || 0;
    });
    
    // Add vehicle condition surcharges
    vehicles.forEach((vehicle, index) => {
      // Additional vehicle surcharge (75% of base price for each additional vehicle)
      if (index > 0 && vehicle.make && vehicle.model) {
        total += Math.round(basePriceEstimate * 0.75);
      }
      
      // Add condition-based surcharges
      (vehicle.conditions || []).forEach(condition => {
        total += conditionPrices[condition] || 0;
      });
    });
    
    return total;
  };

  // Calculate loyalty points to be earned (default: 1 point per dollar)
  const calculateLoyaltyPoints = () => {
    const totalPrice = calculateTotalPrice();
    return Math.floor(totalPrice);
  };

  // Update calculated values when relevant inputs change
  useEffect(() => {
    const price = calculateTotalPrice();
    setTotalEstimatedPrice(price);
    setCalculatedPoints(Math.floor(price)); // 1 point per dollar
  }, [selectedService, selectedAddOns, vehicles, basePriceEstimate, addOnPrices]);

  // Fetch services from the API when component mounts
  useEffect(() => {
    async function fetchServices() {
      setIsLoadingServices(true);
      try {
        const response = await fetch('/api/services');
        if (!response.ok) {
          throw new Error('Failed to fetch services');
        }
        
        const data = await response.json();
        if (data.success && Array.isArray(data.services)) {
          setServices(data.services);
          
          // Set up pricing information
          const priceMap: Record<string, number> = {};
          data.services.forEach((service: Service) => {
            // Extract numeric price from price range
            const price = service.priceRange.replace(/[^0-9\-–]/g, '');
            let numericPrice = 0;
            
            if (price.includes('–') || price.includes('-')) {
              // If price range, take the lower value for base price
              const [min] = price.split(/[-–]/);
              numericPrice = parseInt(min, 10);
            } else {
              numericPrice = parseInt(price, 10);
            }
            
            priceMap[service.name] = numericPrice;
          });
          
          setBasePriceEstimate(priceMap[selectedService] || 0);
        } else {
          throw new Error('Invalid service data');
        }
      } catch (error) {
        console.error('Error fetching services:', error);
        toast({
          title: 'Error',
          description: 'Could not load service options. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsLoadingServices(false);
      }
    }
    
    fetchServices();
  }, [toast, selectedService]);
  
  // Fetch and prepare add-on services when a main service is selected
  const fetchAddOnServices = async (serviceName: string) => {
    setIsLoadingAddOns(true);
    try {
      const response = await fetch('/api/addon-services');
      if (!response.ok) {
        throw new Error('Failed to fetch add-on services');
      }
      
      const data = await response.json();
      if (data.success && Array.isArray(data.addOns)) {
        // Determine which add-ons to recommend based on the selected service
        const processedAddOns: AddOnService[] = data.addOns.map((addon: any) => {
          let recommended = false;
          
          // Specific service-based recommendations
          if (serviceName.toLowerCase().includes('interior') && 
              (addon.name.toLowerCase().includes('leather') || 
               addon.name.toLowerCase().includes('upholstery') || 
               addon.name.toLowerCase().includes('fabric'))) {
            recommended = true;
          } 
          else if (serviceName.toLowerCase().includes('exterior') && 
                  (addon.name.toLowerCase().includes('headlight') || 
                   addon.name.toLowerCase().includes('windshield') || 
                   addon.name.toLowerCase().includes('glass'))) {
            recommended = true;
          }
          else if (serviceName.toLowerCase().includes('polish') && 
                  addon.name.toLowerCase().includes('ceramic coating')) {
            recommended = true;
          }
          
          return {
            ...addon,
            recommended
          };
        });
        
        // Sort to show recommended add-ons first
        processedAddOns.sort((a, b) => {
          if (a.recommended && !b.recommended) return -1;
          if (!a.recommended && b.recommended) return 1;
          return 0;
        });
        
        setAddOnServices(processedAddOns);
        
        // Extract add-on pricing information
        const priceMap: Record<string, number> = {};
        data.addOns.forEach((addon: any) => {
          let numericPrice = 0;
          
          // Special handling for headlight services with "per lens" pricing
          if (addon.name.toLowerCase().includes('headlight') && addon.priceRange.includes('per lens')) {
            // Extract the per-lens price and default to 2 lenses (×2 typical)
            const perLensMatch = addon.priceRange.match(/\$?(\d+)\s*per lens/);
            if (perLensMatch) {
              const perLensPrice = parseInt(perLensMatch[1], 10);
              numericPrice = perLensPrice * 2; // Default to both lenses
            }
          } else {
            // Regular price extraction for other services
            let price = addon.priceRange.replace(/[^0-9\-–]/g, '');
            
            if (price.includes('–') || price.includes('-')) {
              // If price range, take the lower value for base price
              const [min] = price.split(/[-–]/);
              numericPrice = parseInt(min, 10);
            } else {
              numericPrice = parseInt(price, 10);
            }
          }
          
          priceMap[addon.name] = numericPrice;
        });
        
        setAddOnPrices(priceMap);
      } else {
        throw new Error('Invalid add-on service data');
      }
    } catch (error) {
      console.error('Error fetching add-on services:', error);
      toast({
        title: 'Warning',
        description: 'Could not load add-on options. You can continue without them.',
      });
      setAddOnServices([]);
    } finally {
      setIsLoadingAddOns(false);
    }
  };

  useEffect(() => {
    // If a service is selected, fetch available time slots
    if (selectedService) {
      fetchAvailableSlots();
    }
  }, [selectedService]);

  const fetchAvailableSlots = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/available-slots?service=${encodeURIComponent(selectedService)}`);
      
      if (!response.ok) {
        throw new Error("Failed to fetch available time slots");
      }
      
      const data = await response.json();
      
      if (data.success && data.slots && Array.isArray(data.slots)) {
        // Store all available slots
        const allSlots: string[] = [];
        
        // For the next 60 days (2 months), generate slots (weekdays only)
        const availableDatesList: Date[] = [];
        const timeSlotsByDay: Record<string, string[]> = {};
        
        let currentDate = new Date();
        // Look ahead for the next 60 days for available dates
        for (let i = 1; i <= 60; i++) {
          currentDate = new Date(currentDate.getTime() + 24*60*60*1000); // Add one day
          
          // Skip weekends (0 = Sunday, 6 = Saturday)
          const day = currentDate.getDay();
          if (day === 0 || day === 6) continue;
          
          // Create a new date object for this day at midnight to use as key
          const dateKey = format(currentDate, 'yyyy-MM-dd');
          const daySlots: string[] = [];
          
          // For each business day, add appointment slots
          // Create a new date object set to 9am on this day
          const baseDate = new Date(currentDate);
          baseDate.setHours(9, 0, 0, 0);
          
          // Add slots at 9am, 9:30, 10am, 10:30, etc. until 2:30pm 
          for (let hour = 9; hour < 15; hour++) {
            // Include lunch hour (12pm) - no longer skipping
            
            // Add the full hour slot 
            const fullHourSlot = new Date(baseDate);
            fullHourSlot.setHours(hour);
            const fullHourISO = fullHourSlot.toISOString();
            daySlots.push(fullHourISO);
            allSlots.push(fullHourISO);
            
            // Add the half-hour slot (except for 2:30pm which would end at 4:30 or later)
            if (hour !== 14) {
              const halfHourSlot = new Date(baseDate);
              halfHourSlot.setHours(hour, 30);
              const halfHourISO = halfHourSlot.toISOString();
              daySlots.push(halfHourISO);
              allSlots.push(halfHourISO);
            }
          }
          
          // Store the slots for this day
          if (daySlots.length > 0) {
            timeSlotsByDay[dateKey] = daySlots;
            // Add this date to available dates list 
            availableDatesList.push(new Date(currentDate));
          }
        }
        
        // Sort dates chronologically
        availableDatesList.sort((a, b) => a.getTime() - b.getTime());
        
        // Store available dates and daily time slots
        setAvailableSlots(allSlots);
        setAvailableDates(availableDatesList);
        setDailyTimeSlots(timeSlotsByDay);
        
        if (allSlots.length === 0) {
          toast({
            title: "No Available Slots",
            description: "We don't have any slots in our standard business hours (9am-3pm, Mon-Fri). Please contact us directly for special arrangements.",
          });
        }
      } else {
        setAvailableSlots([]);
        setAvailableDates([]);
        setDailyTimeSlots({});
        toast({
          title: "Error",
          description: "No available time slots found. Please try a different service or contact us directly.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error fetching time slots:", error);
      toast({
        title: "Error",
        description: "Failed to load available time slots. Please try again later.",
        variant: "destructive",
      });
      setAvailableSlots([]);
      setAvailableDates([]);
      setDailyTimeSlots({});
    } finally {
      setIsLoading(false);
    }
  };

  const handleServiceSelect = (value: string) => {
    setSelectedService(value);
    // Fetch add-on services that are relevant to the selected service
    fetchAddOnServices(value);
    // Move to add-ons step instead of directly to date selection
    setStep("addons");
  };

  // Function to check weather for selected date
  const checkWeatherForDate = async (date: Date) => {
    try {
      const dateString = date.toISOString();
      const latitude = 36.1236407; // Tulsa coordinates
      const longitude = -95.9359214;
      
      const response = await fetch(
        `/api/appointment-weather?latitude=${latitude}&longitude=${longitude}&date=${dateString}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to check weather');
      }
      
      const data = await response.json();
      
      if (data.success) {
        // Calculate average precipitation chance from forecast data
        let totalPrecipChance = 0;
        if (data.forecastData && data.forecastData.length > 0) {
          totalPrecipChance = data.forecastData.reduce((sum: number, item: any) => sum + item.chanceOfRain, 0) / data.forecastData.length;
        }
        
        setWeatherData({
          weatherRiskLevel: data.weatherRiskLevel || 'none',
          precipitationChance: Math.round(totalPrecipChance)
        });
        
        // Show weather alert if precipitation chance is high enough (15% or more)
        if (totalPrecipChance >= 15) {
          setShowWeatherAlert(true);
        } else {
          // Proceed to time selection if weather is good
          setStep("time");
        }
      } else {
        // Proceed to time selection if weather check fails
        setStep("time");
      }
    } catch (error) {
      console.error('Error checking weather:', error);
      // Continue to time selection even if weather check fails
      setStep("time");
    }
  };

  // Handle proceeding with appointment despite weather warning
  const handleWeatherAlertProceed = () => {
    setShowWeatherAlert(false);
    setStep("time");
    
    // Add notification that we'll monitor weather
    toast({
      title: "Weather Notice",
      description: "We'll monitor the forecast and notify you ahead of your service date if weather conditions change significantly.",
    });
  };
  
  // Handle choosing a different date due to weather
  const handleWeatherAlertReschedule = (newDate?: Date) => {
    setShowWeatherAlert(false);
    if (newDate) {
      // If a date was selected from the reschedule dialog, use it
      setSelectedDate(newDate);
      setSelectedTime("");
      checkWeatherForDate(newDate);
    } else {
      // Otherwise, just stay on date selection screen
      setSelectedDate(undefined);
      setSelectedTime("");
    }
  };

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    // Reset time selection when date changes
    setSelectedTime("");
    
    // If a valid date was selected, check weather before proceeding
    if (date) {
      checkWeatherForDate(date);
    }
  };

  const handleTimeSelect = (value: string) => {
    setSelectedTime(value);
    setStep("details");
  };

  // Handler for navigating from add-ons step to vehicle information selection
  const handleAddOnsComplete = () => {
    setStep("vehicle");
  };
  
  // Handler for navigating from vehicle step to date selection
  const handleVehicleComplete = () => {
    setStep("date");
  };
  
  // Add a new vehicle to the list
  const addVehicle = () => {
    setVehicles(prev => [
      ...prev,
      {
        make: "",
        model: "",
        year: "",
        color: "",
        conditions: []
      }
    ]);
    // Move to the new vehicle immediately
    setCurrentVehicleIndex(vehicles.length);
  };
  
  // Remove vehicle from the list
  const removeVehicle = (index: number) => {
    if (vehicles.length <= 1) {
      // Don't allow removing the last vehicle
      return;
    }
    
    setVehicles(prev => {
      const newVehicles = [...prev];
      newVehicles.splice(index, 1);
      return newVehicles;
    });
    
    // Adjust current index if necessary
    if (index <= currentVehicleIndex) {
      setCurrentVehicleIndex(Math.max(0, currentVehicleIndex - 1));
    }
  };
  
  // Update current vehicle information
  const updateCurrentVehicle = (field: keyof VehicleInfo, value: any) => {
    setVehicles(prev => {
      const newVehicles = [...prev];
      if (field === 'conditions') {
        newVehicles[currentVehicleIndex] = {
          ...newVehicles[currentVehicleIndex],
          conditions: value
        };
      } else {
        newVehicles[currentVehicleIndex] = {
          ...newVehicles[currentVehicleIndex],
          [field]: value
        };
      }
      return newVehicles;
    });
  };
  
  // Handler for toggling a vehicle condition
  const toggleVehicleCondition = (condition: string) => {
    const currentConditions = currentVehicle.conditions;
    
    let newConditions;
    // If it's "None of the above", clear all other selections
    if (condition === "None of the above") {
      newConditions = currentConditions.includes(condition) ? [] : [condition];
    } else {
      // If selecting anything else, remove "None of the above" if it's present
      newConditions = currentConditions.filter(c => c !== "None of the above");
      
      if (currentConditions.includes(condition)) {
        newConditions = newConditions.filter(c => c !== condition);
      } else {
        newConditions = [...newConditions, condition];
      }
    }
    
    updateCurrentVehicle('conditions', newConditions);
  };
  
  // Helper to get available time slots for the selected date
  const getTimeSlotsForSelectedDate = (): string[] => {
    if (!selectedDate) return [];
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    return dailyTimeSlots[dateKey] || [];
  };
  
  // Handler for toggling an add-on selection
  const toggleAddOn = (addOnName: string) => {
    setSelectedAddOns(prev => {
      if (prev.includes(addOnName)) {
        return prev.filter(name => name !== addOnName);
      } else {
        return [...prev, addOnName];
      }
    });
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !phone.trim() || !selectedService || !selectedTime) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      const response = await fetch("/api/book-appointment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          phone,
          email: "", // Add customer email when available
          address: customerAddress,
          isExtendedAreaRequest,
          service: selectedService,
          addOns: selectedAddOns,
          vehicleMake,
          vehicleModel,
          vehicleYear,
          vehicleColor,
          vehicleCondition: selectedVehicleConditions,
          notes,
          time: selectedTime,
          smsConsent,
        }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to book appointment");
      }
      
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Success",
          description: "Your appointment has been scheduled!",
        });
        
        // Format the time for display
        const formattedTime = format(parseISO(selectedTime), "EEEE, MMMM d, yyyy 'at' h:mm a");
        
        // Prepare vehicle condition list
        let vehicleConditionList = [...selectedVehicleConditions];
        if (selectedVehicleConditions.includes("Other") && otherCondition.trim()) {
          // Replace "Other" with "Other: [specific condition]"
          vehicleConditionList = vehicleConditionList.filter(c => c !== "Other");
          vehicleConditionList.push(`Other: ${otherCondition.trim()}`);
        }
        
        onSuccess({
          name,
          phone,
          address: customerAddress,
          isExtendedAreaRequest,
          service: selectedService,
          addOns: selectedAddOns,
          vehicleMake,
          vehicleModel,
          vehicleYear,
          vehicleColor,
          vehicleCondition: vehicleConditionList,
          notes,
          time: selectedTime,
          formattedTime,
        });
      } else {
        throw new Error(data.message || "Failed to book appointment");
      }
    } catch (error) {
      console.error("Error booking appointment:", error);
      toast({
        title: "Error",
        description: "Failed to book your appointment. Please try again or contact us directly.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatTimeSlot = (isoString: string) => {
    try {
      return format(parseISO(isoString), "EEEE, MMMM d, yyyy 'at' h:mm a");
    } catch (error) {
      console.error("Error formatting time:", error);
      return isoString;
    }
  };

  // Handler for service area check
  const handleAddressNext = (address: string, isExtendedArea: boolean = false) => {
    setCustomerAddress(address);
    setIsExtendedAreaRequest(isExtendedArea);
    setStep("service");
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-500 text-white">
        <CardTitle className="text-xl font-bold">Schedule an Appointment</CardTitle>
      </CardHeader>
      
      {/* Weather Alert Dialog */}
      <WeatherAlertDialog
        open={showWeatherAlert}
        onOpenChange={setShowWeatherAlert}
        onProceed={handleWeatherAlertProceed}
        onReschedule={handleWeatherAlertReschedule}
        weatherRiskLevel={weatherData.weatherRiskLevel}
        precipitationChance={weatherData.precipitationChance}
        date={selectedDate ? format(selectedDate, 'MMMM d, yyyy') : ''}
        selectedService={selectedService}
      />
      

      
      <CardContent className="mt-4 w-full px-4">
        {step === "address" && (
          <ServiceAreaCheck 
            onNext={handleAddressNext}
            onBack={onClose}
          />
        )}
        
        {step === "service" && (
          <div className="space-y-4">
            <Label>Select a Service</Label>
            {isLoadingServices ? (
              <div className="py-8 text-center">Loading services...</div>
            ) : services.length > 0 ? (
              <div className="grid gap-2 max-h-[300px] overflow-y-auto">
                {services.map((service) => (
                  <div 
                    key={service.name}
                    className={`relative rounded-md border p-3 hover:bg-accent transition-colors cursor-pointer ${
                      selectedService === service.name ? "border-blue-500 bg-blue-50" : ""
                    }`}
                    onClick={() => handleServiceSelect(service.name)}
                  >
                    <div className="flex flex-col">
                      <div className="flex items-center justify-between">
                        <div className="font-medium">{service.name}</div>
                        <div className="text-blue-600 whitespace-nowrap">{service.priceRange}</div>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{service.description}</p>
                      <div className="flex items-center mt-2 text-xs text-gray-500">
                        <span>Estimated Duration: {service.duration}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-4 text-center text-gray-500">
                No services available at this time.
              </div>
            )}
            
            <div className="pt-4">
              <Button 
                variant="outline"
                className="w-full"
                onClick={() => setStep("address")}
              >
                Back to Address
              </Button>
            </div>
          </div>
        )}
        
        {step === "addons" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-2">
              <div>
                <Label className="text-lg">Would you like to add any extras?</Label>
                <p className="text-sm text-gray-500 mt-1">Enhance your {selectedService} with these recommended services</p>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setStep("service")}
              >
                Back
              </Button>
            </div>
            
            {isLoadingAddOns ? (
              <div className="py-8 text-center">Loading add-on options...</div>
            ) : addOnServices.length > 0 ? (
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {addOnServices.map((addon) => (
                  <div 
                    key={addon.name}
                    className={`relative rounded-md border p-3 hover:bg-accent transition-colors cursor-pointer ${
                      selectedAddOns.includes(addon.name) ? "border-blue-500 bg-blue-50" : ""
                    }`}
                    onClick={() => toggleAddOn(addon.name)}
                  >
                    <div className="flex items-center gap-2">
                      <Checkbox 
                        id={`addon-${addon.name}`}
                        checked={selectedAddOns.includes(addon.name)}
                        onCheckedChange={() => toggleAddOn(addon.name)}
                        className="pointer-events-none"
                      />
                      <div className="flex-1">
                        <div className="flex items-center flex-wrap gap-2">
                          <Label 
                            htmlFor={`addon-${addon.name}`} 
                            className="font-medium cursor-pointer"
                          >
                            {addon.name}
                          </Label>
                          {addon.recommended && (
                            <Badge className="bg-gradient-to-r from-blue-600 to-blue-400 text-white" variant="secondary">
                              Recommended
                            </Badge>
                          )}
                          <span className="ml-auto text-blue-600 whitespace-nowrap">
                            {addon.priceRange}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{addon.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-4 text-center text-gray-500">
                No add-on services available at this time.
              </div>
            )}
            
            <div className="pt-4">
              <Button 
                className="w-full" 
                onClick={handleAddOnsComplete}
              >
                {selectedAddOns.length > 0 ? 'Continue with Selected Add-ons' : 'Continue without Add-ons'}
              </Button>
            </div>
          </div>
        )}
        
        {step === "vehicle" && (
          <div className="space-y-4 max-h-[calc(100vh-240px)] overflow-y-auto pb-4">
            <div className="flex justify-between items-center mb-2 sticky top-0 bg-white pt-2 pb-2 z-10">
              <div>
                <Label className="text-lg">Vehicle Information</Label>
                <p className="text-sm text-gray-500 mt-1">Please provide details about your vehicle</p>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setStep("addons")}
              >
                Back
              </Button>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="vehicleMake">Make *</Label>
                <Input
                  id="vehicleMake"
                  value={vehicleMake}
                  onChange={(e) => setVehicleMake(e.target.value)}
                  placeholder="e.g., Toyota, Honda"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="vehicleModel">Model *</Label>
                <Input
                  id="vehicleModel"
                  value={vehicleModel}
                  onChange={(e) => setVehicleModel(e.target.value)}
                  placeholder="e.g., Camry, Accord"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="vehicleYear">Year *</Label>
                <Input
                  id="vehicleYear"
                  value={vehicleYear}
                  onChange={(e) => setVehicleYear(e.target.value)}
                  placeholder="e.g., 2020"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="vehicleColor">Color (Optional)</Label>
                <Input
                  id="vehicleColor"
                  value={vehicleColor}
                  onChange={(e) => setVehicleColor(e.target.value)}
                  placeholder="e.g., Blue"
                />
              </div>
            </div>
            
            <div className="mt-6">
              <Label className="text-lg">Vehicle Condition</Label>
              <p className="text-sm text-gray-500 mt-1 mb-3">Please select any conditions that apply to your vehicle</p>
              
              <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2 pb-2">
                <div 
                  className={`relative rounded-md border p-3 hover:bg-accent transition-colors cursor-pointer ${
                    selectedVehicleConditions.includes("Pet hair, sand") ? "border-blue-500 bg-blue-50" : ""
                  }`}
                  onClick={() => toggleVehicleCondition("Pet hair, sand")}
                >
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      checked={selectedVehicleConditions.includes("Pet hair, sand")}
                      onCheckedChange={() => toggleVehicleCondition("Pet hair, sand")}
                      className="pointer-events-none"
                    />
                    <Label className="cursor-pointer">Excessive pet hair, sand (additional cost for interior cleaning)</Label>
                  </div>
                </div>
              
                <div 
                  className={`relative rounded-md border p-3 hover:bg-accent transition-colors cursor-pointer ${
                    selectedVehicleConditions.includes("Major Stains / Grease / Mold etc.") ? "border-blue-500 bg-blue-50" : ""
                  }`}
                  onClick={() => toggleVehicleCondition("Major Stains / Grease / Mold etc.")}
                >
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      checked={selectedVehicleConditions.includes("Major Stains / Grease / Mold etc.")}
                      onCheckedChange={() => toggleVehicleCondition("Major Stains / Grease / Mold etc.")}
                      className="pointer-events-none"
                    />
                    <Label className="cursor-pointer">Major Stains / Grease / Mold etc.</Label>
                  </div>
                </div>
                
                <div 
                  className={`relative rounded-md border p-3 hover:bg-accent transition-colors cursor-pointer ${
                    selectedVehicleConditions.includes("Urine / Vomit / Blood etc.") ? "border-blue-500 bg-blue-50" : ""
                  }`}
                  onClick={() => toggleVehicleCondition("Urine / Vomit / Blood etc.")}
                >
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      checked={selectedVehicleConditions.includes("Urine / Vomit / Blood etc.")}
                      onCheckedChange={() => toggleVehicleCondition("Urine / Vomit / Blood etc.")}
                      className="pointer-events-none"
                    />
                    <Label className="cursor-pointer">Urine / Vomit / Blood etc.</Label>
                  </div>
                </div>
                
                <div 
                  className={`relative rounded-md border p-3 hover:bg-accent transition-colors cursor-pointer ${
                    selectedVehicleConditions.includes("None of the above") ? "border-blue-500 bg-blue-50" : ""
                  }`}
                  onClick={() => toggleVehicleCondition("None of the above")}
                >
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      checked={selectedVehicleConditions.includes("None of the above")}
                      onCheckedChange={() => toggleVehicleCondition("None of the above")}
                      className="pointer-events-none"
                    />
                    <Label className="cursor-pointer">None of the above</Label>
                  </div>
                </div>
                
                <div 
                  className={`relative rounded-md border p-3 hover:bg-accent transition-colors cursor-pointer ${
                    selectedVehicleConditions.includes("Other") ? "border-blue-500 bg-blue-50" : ""
                  }`}
                  onClick={() => toggleVehicleCondition("Other")}
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <Checkbox 
                        checked={selectedVehicleConditions.includes("Other")}
                        onCheckedChange={() => toggleVehicleCondition("Other")}
                        className="pointer-events-none"
                      />
                      <Label className="cursor-pointer">Other:</Label>
                    </div>
                    
                    {selectedVehicleConditions.includes("Other") && (
                      <Input
                        placeholder="Please specify other condition"
                        value={otherCondition}
                        onChange={(e) => setOtherCondition(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-2"
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Dynamic Price Visualization with Loyalty Points */}
            <div className="py-4">
              <DynamicPricingVisualization
                serviceName={selectedService}
                basePrice={basePriceEstimate}
                addOns={selectedAddOns}
                addOnPrices={addOnPrices}
                vehicleConditions={[selectedVehicleConditions]}
                conditionPrices={conditionPrices}
                customerPhone={phone}
              />
            </div>
            
            <div className="pt-4">
              <Button 
                className="w-full" 
                onClick={handleVehicleComplete}
                disabled={!vehicleMake || !vehicleModel || !vehicleYear}
              >
                Continue
              </Button>
            </div>
          </div>
        )}
        
        {step === "date" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <Label className="text-lg">Select a Date</Label>
                <p className="text-sm text-gray-500 mt-1">Choose a date for your {selectedService}</p>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setStep("vehicle")}
              >
                Back
              </Button>
            </div>
            
            {isLoading ? (
              <div className="py-8 text-center">Loading available dates...</div>
            ) : (
              <div className="mt-4">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={handleDateSelect}
                  disabled={(date) => {
                    // Disable past dates, weekends, and dates not in availableDates
                    return (
                      isBefore(date, new Date()) || // Disable past dates
                      isWeekend(date) || // Disable weekends
                      !availableDates.some(availableDate => // Disable dates not in availableDates
                        isSameDay(availableDate, date)
                      )
                    );
                  }}
                  className="rounded-md border p-2"
                />
              </div>
            )}
          </div>
        )}
        
        {step === "time" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <Label className="text-lg">Select a Time</Label>
                <p className="text-sm text-gray-500 mt-1">
                  {selectedDate ? `For ${format(selectedDate, 'EEEE, MMMM d, yyyy')}` : ''}
                </p>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setStep("date")}
              >
                Back
              </Button>
            </div>
            
            {isLoading ? (
              <div className="py-8 text-center">Loading available times...</div>
            ) : getTimeSlotsForSelectedDate().length > 0 ? (
              <div className="grid gap-2 max-h-[300px] overflow-y-auto">
                {getTimeSlotsForSelectedDate().map((slot) => (
                  <Button
                    key={slot}
                    variant="outline"
                    className="justify-start h-auto py-3 px-4 text-left"
                    onClick={() => handleTimeSelect(slot)}
                  >
                    {formatTimeSlot(slot)}
                  </Button>
                ))}
              </div>
            ) : (
              <div className="py-4 text-center">
                No available times found for {selectedService}.
                <Button 
                  variant="link" 
                  className="inline-block ml-1" 
                  onClick={() => setStep("date")}
                >
                  Try another date
                </Button>
              </div>
            )}
          </div>
        )}
        
        {step === "details" && (
          <form onSubmit={handleSubmit} className="space-y-4 max-h-[calc(100vh-240px)] overflow-y-auto pb-4">
            <div className="flex justify-between items-center">
              <Label>Your Details</Label>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setStep("time")}
              >
                Back
              </Button>
            </div>
            
            <div className="space-y-2">
              <div>
                <Label htmlFor="name">Your Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your full name"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(123) 456-7890"
                  required
                />
                <p className="text-xs text-gray-600 mt-2 p-2 bg-gray-50 rounded border-l-4 border-blue-400">
                  <span className="font-medium">SMS Consent:</span> By using this service, you consent to receive appointment reminders and updates via SMS.
                </p>
                <div className="flex items-center space-x-2 mt-2">
                  <input
                    type="checkbox"
                    id="smsConsent"
                    checked={smsConsent}
                    onChange={(e) => setSmsConsent(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="smsConsent" className="text-sm text-gray-700">
                    I consent to receive SMS reminders and updates
                  </label>
                </div>
              </div>
              
              <div className="pt-2">
                <p className="text-sm text-gray-500 mb-1">Selected Service</p>
                <p className="font-medium">{selectedService}</p>
              </div>
              
              <div className="pt-2">
                <Label htmlFor="notes">Notes</Label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[80px]"
                  placeholder="Gate code, special instructions, major concerns etc."
                />
                <p className="text-xs text-gray-500 mt-1">This information will be included with your appointment</p>
              </div>
              
              {selectedAddOns.length > 0 && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Selected Add-ons</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedAddOns.map(addon => (
                      <Badge key={addon} variant="secondary" className="bg-blue-100 text-blue-800">
                        {addon}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              <div>
                <p className="text-sm text-gray-500 mb-1">Selected Vehicle</p>
                <p className="font-medium">{vehicleMake} {vehicleModel} ({vehicleYear}) {vehicleColor && `- ${vehicleColor}`}</p>
              </div>
              
              {selectedVehicleConditions.length > 0 && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Vehicle Condition</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedVehicleConditions.map(condition => (
                      <Badge key={condition} variant="outline" className="bg-red-50 text-red-800 border-red-200">
                        {condition}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              <div>
                <p className="text-sm text-gray-500 mb-1">Selected Time</p>
                <p className="font-medium">{formatTimeSlot(selectedTime)}</p>
              </div>
            </div>
            
            {/* Dynamic Price Calculation and Loyalty Points Components */}
            <div className="my-6 space-y-4">
              {/* Price Calculator */}
              <div className="bg-white border rounded-lg p-4 shadow-sm">
                <h3 className="font-medium text-lg mb-2">Price Estimate</h3>
                <div className="space-y-2">
                  {selectedService && (
                    <div className="flex justify-between">
                      <span>{selectedService}</span>
                      <span>${basePriceEstimate}</span>
                    </div>
                  )}
                  
                  {selectedAddOns.map(addon => (
                    <div key={addon} className="flex justify-between text-sm">
                      <span>{addon}</span>
                      <span>${addOnPrices[addon] || 0}</span>
                    </div>
                  ))}
                  
                  {vehicles.map((vehicle, index) => {
                    if (index > 0 && vehicle.make && vehicle.model) {
                      return (
                        <div key={`additional-${index}`} className="flex justify-between text-sm">
                          <span>Additional Vehicle ({vehicle.make} {vehicle.model})</span>
                          <span>${Math.round(basePriceEstimate * 0.75)}</span>
                        </div>
                      );
                    }
                    return null;
                  })}
                  
                  {vehicles.flatMap(v => 
                    (v.conditions || []).map(condition => (
                      <div key={`${v.make || 'vehicle'}-${condition}`} className="flex justify-between text-sm">
                        <span>{condition}</span>
                        <span>${conditionPrices[condition] || 0}</span>
                      </div>
                    ))
                  )}
                  
                  <div className="border-t pt-2 mt-2 flex justify-between font-bold">
                    <span>Total Estimate</span>
                    <span>${totalEstimatedPrice}</span>
                  </div>
                  
                  <div className="text-green-600 text-sm">
                    <span>You'll earn </span>
                    <span className="font-bold">{calculatedPoints} loyalty points</span>
                    <span> with this booking!</span>
                  </div>
                </div>
              </div>
              
              {/* Loyalty Card */}
              <div className="bg-blue-50 border-blue-100 border rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-medium text-blue-800">Clean Machine Loyalty</h3>
                  <div className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                    {phone ? (calculatedPoints > 0 ? `+${calculatedPoints} points` : 'Earn Points') : 'Enter phone to check'}
                  </div>
                </div>
                
                <p className="text-sm text-blue-700">
                  {phone 
                    ? `You'll earn ${calculatedPoints} loyalty points from this booking! Each point brings you closer to free services and exclusive offers.`
                    : "Add your phone number to check your loyalty points balance and earn points with this booking."}
                </p>
                
                {totalEstimatedPrice > 0 && (
                  <div className="mt-2 text-xs text-blue-600">
                    Points are calculated at 1 point per dollar spent.
                  </div>
                )}
              </div>
              
              {/* Hidden component that still fetches points data */}
              <BookingLoyaltyDisplay
                phoneNumber={phone}
                selectedService={selectedService}
                selectedAddOns={selectedAddOns}
                vehicleConditions={vehicles.flatMap(v => v.conditions || [])}
                estimatedPrice={totalEstimatedPrice}
                pointsEarningRate={1}
              />
            </div>
            
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
              <h3 className="font-medium text-blue-800 mb-2">What to expect:</h3>
              <p className="text-sm text-blue-700">
                First I'll pull the vehicle under my pop-up canopy. I'll just need to connect to a power outlet and a water spigot (for exteriors). I'll have 100ft of extension/hose to reach your hookups. For apartments/condos, I can run the power cable through a door or window if needed. When I finish up, you'll receive a digital invoice with secure payment options.
              </p>
              <p className="text-sm text-blue-700 mt-2">
                You'll receive an immediate confirmation notification by text message when your appointment is scheduled.
              </p>
            </div>
            
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Booking..." : "Confirm Appointment"}
            </Button>
          </form>
        )}
      </CardContent>
      
      <CardFooter className="justify-between border-t pt-4">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </CardFooter>
    </Card>
  );
}