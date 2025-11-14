import React, { useState, useEffect, useRef } from "react";
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
import PowerWaterAccessVerification, { AccessInfo } from "./PowerWaterAccessVerification";
import WeatherAlertDialog from "./WeatherAlertDialog";
import BookingLoyaltyDisplay from "./BookingLoyaltyDisplay";
import BookingPriceCalculator from "./BookingPriceCalculator";
import { SMSConsentCheckbox } from "./SMSConsentCheckbox";
import { Plus, X } from "lucide-react";

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

interface MultiVehicleAppointmentSchedulerProps {
  initialName?: string;
  initialPhone?: string;
  initialService?: string;
  initialReferralCode?: string;
  onClose?: () => void;
  onSuccess?: (appointment: AppointmentDetails) => void;
}

export default function MultiVehicleAppointmentScheduler({
  onClose,
  onSuccess,
  initialName,
  initialPhone,
  initialService,
  initialReferralCode,
}: MultiVehicleAppointmentSchedulerProps = {}) {
  const [step, setStep] = useState<"address" | "accessVerification" | "service" | "addons" | "vehicle" | "date" | "time" | "details">("address");
  const [customerAddress, setCustomerAddress] = useState<string>("");
  const [isExtendedAreaRequest, setIsExtendedAreaRequest] = useState<boolean>(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);

  // Pre-filled customer information from props
  const [name, setName] = useState(initialName || "");
  const [phone, setPhone] = useState(initialPhone || "");
  const [customerEmail, setCustomerEmail] = useState(""); // Assuming email isn't pre-fillable via URL yet

  // Referral code state
  const [referralCode, setReferralCode] = useState(initialReferralCode?.toUpperCase() || "");
  const [isValidatingReferral, setIsValidatingReferral] = useState(false);
  const [referralStatus, setReferralStatus] = useState<{
    isValid: boolean;
    reward?: {
      type: string;
      amount: number;
      description: string;
      expiryDays?: number;
      notes?: string;
    };
    error?: string;
  } | null>(null);
  const referralCacheRef = useRef<Record<string, typeof referralStatus>>({});

  // Power/Water Access information
  const [accessInfo, setAccessInfo] = useState<{
    hasPowerAccess: boolean;
    hasWaterAccess: boolean;
    locationType: string;
    needsExteriorService: boolean;
    notes: string;
  }>({
    hasPowerAccess: false,
    hasWaterAccess: false,
    locationType: "house",
    needsExteriorService: true,
    notes: ""
  });

  // Multi-vehicle state
  const [vehicles, setVehicles] = useState<VehicleInfo[]>([{
    make: "",
    model: "",
    year: "",
    color: "",
    conditions: []
  }]);
  const [currentVehicleIndex, setCurrentVehicleIndex] = useState<number>(0);
  const [otherCondition, setOtherCondition] = useState<string>("");

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string>("");
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
  const { toast } = useToast();

  // Get current vehicle for easy reference
  const currentVehicle = vehicles[currentVehicleIndex];

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
  }, [toast]);

  // Pre-select service if provided via URL parameter
  useEffect(() => {
    if (initialService && services.length > 0) {
      const matchingService = services.find(
        (s) => s.name.toLowerCase() === initialService.toLowerCase()
      );
      if (matchingService) {
        setSelectedService(matchingService);
        // If name and phone are already pre-filled, we can skip directly to address
        if (initialName && initialPhone) {
          setStep("address");
        } else {
          setStep("service"); // Otherwise, let the user select the service
        }
      }
    }
  }, [initialService, services, initialName, initialPhone]);


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

  // Fetch and prepare add-on services when a main service is selected
  useEffect(() => {
    // If a service is selected, fetch available time slots
    if (selectedService) {
      fetchAddOnServices(selectedService.name);
    }
  }, [selectedService]); // Depend on selectedService

  // Fetch available slots when moving to the date step
  useEffect(() => {
    if (step === "date" && selectedService) {
      fetchAvailableSlots();
    }
  }, [step, selectedService]);

  const fetchAvailableSlots = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/available-slots?service=${encodeURIComponent(selectedService!.name)}`);

      if (!response.ok) {
        throw new Error("Failed to fetch available time slots");
      }

      const data = await response.json();

      if (data.success && data.slots && Array.isArray(data.slots)) {
        // Use the slots returned from the API (from Google Calendar)
        const allSlots: string[] = data.slots;

        // Group slots by date and create list of available dates
        const availableDatesList: Date[] = [];
        const timeSlotsByDay: Record<string, string[]> = {};
        const seenDates = new Set<string>();

        allSlots.forEach(slotISO => {
          const slotDate = parseISO(slotISO);
          const dateKey = format(slotDate, 'yyyy-MM-dd');

          // Add to the specific day's slot list
          if (!timeSlotsByDay[dateKey]) {
            timeSlotsByDay[dateKey] = [];
          }
          timeSlotsByDay[dateKey].push(slotISO);

          // Track unique dates
          if (!seenDates.has(dateKey)) {
            seenDates.add(dateKey);
            availableDatesList.push(slotDate);
          }
        });

        // Sort dates chronologically
        availableDatesList.sort((a, b) => a.getTime() - b.getTime());

        // Store available dates and daily time slots
        setAvailableSlots(allSlots);
        setAvailableDates(availableDatesList);
        setDailyTimeSlots(timeSlotsByDay);

        if (allSlots.length === 0) {
          toast({
            title: "No Available Slots",
            description: "We don't have any available slots at this time. Please contact us directly to schedule.",
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

  const handleServiceSelect = (service: Service) => {
    setSelectedService(service);
    // Fetch add-on services that are relevant to the selected service
    fetchAddOnServices(service.name);
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

  // Validate referral code
  const validateReferralCode = async (code: string) => {
    const normalizedCode = code.trim().toUpperCase();
    
    if (!normalizedCode) {
      setReferralStatus(null);
      return;
    }

    // Check cache first
    if (referralCacheRef.current[normalizedCode]) {
      setReferralStatus(referralCacheRef.current[normalizedCode]);
      return;
    }

    setIsValidatingReferral(true);
    setReferralStatus(null);

    try {
      const response = await fetch('/api/referral/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: normalizedCode }),
      });

      const data = await response.json();

      const result = {
        isValid: data.success && data.data?.valid,
        reward: data.data?.reward,
        error: !data.success ? data.message : undefined,
      };

      // Cache the result
      referralCacheRef.current[normalizedCode] = result;
      setReferralStatus(result);
    } catch (error) {
      console.error('Error validating referral code:', error);
      toast({
        title: 'Network Error',
        description: 'Could not validate referral code. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsValidatingReferral(false);
    }
  };

  // Validate initial referral code on mount
  useEffect(() => {
    if (initialReferralCode) {
      validateReferralCode(initialReferralCode);
    }
  }, [initialReferralCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !phone.trim() || !selectedService || !selectedTime) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    // Validate SMS consent
    if (!smsConsent) {
      toast({
        title: "SMS Consent Required",
        description: "You must consent to receive SMS messages to book an appointment. This is required by law.",
        variant: "destructive",
      });
      return;
    }

    // Validate vehicle information
    const invalidVehicles = vehicles.filter(vehicle =>
      !vehicle.make || !vehicle.model || !vehicle.year
    );

    if (invalidVehicles.length > 0) {
      toast({
        title: "Error",
        description: `Please provide make, model, and year for all vehicles (${invalidVehicles.length} incomplete)`,
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
          email: customerEmail, // Use the state variable for email
          address: customerAddress,
          isExtendedAreaRequest,
          service: selectedService!.name, // Use the selected service name
          addOns: selectedAddOns,
          vehicles,
          notes,
          time: selectedTime,
          smsConsent,
          referralCode: referralStatus?.isValid ? referralCode : undefined,
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

        onSuccess?.({
          name,
          phone,
          address: customerAddress,
          isExtendedAreaRequest,
          service: selectedService!.name,
          addOns: selectedAddOns,
          vehicles,
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
    setStep("accessVerification");
  };

  // Handler for access verification completion
  const handleAccessVerificationNext = (accessVerificationInfo: AccessInfo) => {
    setAccessInfo(accessVerificationInfo);

    // Update notes with any access information if provided
    if (accessVerificationInfo.notes) {
      setNotes(prevNotes => {
        const accessNotes = `Power/Water Access Notes: ${accessVerificationInfo.notes}`;
        return prevNotes ? `${prevNotes}\n\n${accessNotes}` : accessNotes;
      });
    }

    setStep("service");
  };

  // Handler for going back from access verification
  const handleAccessVerificationBack = () => {
    setStep("address");
  };

  // Placeholder functions for price calculation - replace with actual logic
  const calculateBasePrice = (serviceName: string): number => {
    const baseService = services.find(s => s.name === serviceName);
    if (!baseService) return 0;
    // Example: extract a number from priceRange, e.g., "$50 - $100" -> 75
    const priceMatch = baseService.priceRange.match(/(\d+(\.\d+)?)/g);
    if (priceMatch && priceMatch.length > 0) {
      const prices = priceMatch.map(Number);
      if (prices.length > 1) return (prices[0] + prices[1]) / 2;
      return prices[0];
    }
    return 0;
  };

  const calculateAddOnPrices = (): Record<string, number> => {
    const prices: Record<string, number> = {};
    addOnServices.forEach(addon => {
      const priceMatch = addon.priceRange.match(/(\d+(\.\d+)?)/g);
      if (priceMatch && priceMatch.length > 0) {
        const price = Number(priceMatch[0]);
        prices[addon.name] = price || 0;
      } else {
        prices[addon.name] = 0;
      }
    });
    return prices;
  };

  const calculateConditionPrices = (): Record<string, number> => {
    // This is a placeholder. You'd need to define prices for conditions.
    // For now, let's assume a flat fee for specific conditions.
    const conditionPriceMap: Record<string, number> = {
      "Excessive pet hair, sand (additional cost for interior cleaning)": 50,
      "Major Stains / Grease / Mold etc.": 75,
      "Urine / Vomit / Blood etc.": 100,
      "Other": 25, // Default for 'Other' if not specified
    };
    const prices: Record<string, number> = {};
    vehicles.forEach((vehicle, vIndex) => {
      vehicle.conditions.forEach(condition => {
        if (condition !== "None of the above") {
          prices[`Vehicle ${vIndex + 1} - ${condition}`] = conditionPriceMap[condition] || 0;
        }
      });
    });
    return prices;
  };

  const calculateTotalPrice = (): number => {
    let total = calculateBasePrice(selectedService?.name || "");
    const selectedAddOnPrices = calculateAddOnPrices();
    selectedAddOns.forEach(addonName => {
      total += selectedAddOnPrices[addonName] || 0;
    });
    const conditionPrices = calculateConditionPrices();
    Object.values(conditionPrices).forEach(price => {
      total += price;
    });
    return total;
  };

  return (
    <div className="w-full h-full flex flex-col bg-gradient-to-b from-gray-900 via-blue-950/10 to-black text-white">
      {/* Header */}
      <div className="p-6 pb-3 text-center border-b border-blue-400/10 flex-shrink-0">
        <h2 className="text-xl md:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-200 via-blue-400 to-blue-200">
          Schedule an Appointment
        </h2>
      </div>

      {/* Weather Alert Dialog */}
      <WeatherAlertDialog
        open={showWeatherAlert}
        onOpenChange={setShowWeatherAlert}
        onProceed={handleWeatherAlertProceed}
        onReschedule={handleWeatherAlertReschedule}
        weatherRiskLevel={weatherData.weatherRiskLevel}
        precipitationChance={weatherData.precipitationChance}
        date={selectedDate ? format(selectedDate, 'MMMM d, yyyy') : ''}
        selectedService={selectedService?.name || ''}
      />

      {/* Content Area - Single scroll container */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {step === "address" && (
          <ServiceAreaCheck
            onNext={handleAddressNext}
            onBack={onClose || (() => {})}
          />
        )}

        {step === "accessVerification" && (
          <PowerWaterAccessVerification
            onConfirm={handleAccessVerificationNext}
            onBack={handleAccessVerificationBack}
            locationType="house"
          />
        )}

        {step === "service" && (
          <div className="space-y-4">
            <Label className="text-blue-100">Select a Service</Label>
            {isLoadingServices ? (
              <div className="py-8 text-center text-blue-200/70">Loading services...</div>
            ) : services.length > 0 ? (
              <div className="grid gap-2 max-h-[300px] overflow-y-auto">
                {services.map((service) => (
                  <div
                    key={service.name}
                    className={`relative rounded-md border p-3 transition-all cursor-pointer ${
                      selectedService?.name === service.name
                        ? "border-blue-400 bg-blue-500/20 shadow-lg shadow-blue-500/20"
                        : "border-blue-400/20 bg-gray-700/30 hover:bg-gray-700/50 hover:border-blue-400/40"
                    }`}
                    onClick={() => handleServiceSelect(service)}
                  >
                    <div className="flex flex-col">
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-blue-100">{service.name}</div>
                        <div className="text-blue-300 whitespace-nowrap font-semibold">{service.priceRange}</div>
                      </div>
                      <p className="text-sm text-blue-200/60 mt-1">{service.description}</p>
                      <div className="flex items-center mt-2 text-xs text-blue-200/50">
                        <span>Estimated Duration: {service.duration}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-4 text-center">
                <p className="text-blue-200/70">No services available</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 border-blue-400/30 text-blue-200 hover:bg-blue-500/20"
                  onClick={onClose}
                >
                  Close
                </Button>
              </div>
            )}
          </div>
        )}

        {step === "addons" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <Label className="text-lg text-blue-100">Add-On Services</Label>
                <p className="text-sm text-blue-200/60 mt-1">
                  Optional services to enhance your {selectedService?.name}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-blue-200 hover:bg-blue-500/20"
                onClick={() => setStep("service")}
              >
                Back
              </Button>
            </div>

            {isLoadingAddOns ? (
              <div className="py-8 text-center text-blue-200/70">Loading add-on options...</div>
            ) : addOnServices.length > 0 ? (
              <div className="space-y-4 max-h-[300px] overflow-y-auto pb-4">
                {addOnServices.map((addon) => (
                  <div
                    key={addon.name}
                    className={`relative rounded-md border p-3 transition-all ${
                      selectedAddOns.includes(addon.name)
                        ? "border-blue-400 bg-blue-500/20 shadow-lg shadow-blue-500/20"
                        : addon.recommended
                          ? "border-amber-400/40 bg-amber-500/10"
                          : "border-blue-400/20 bg-gray-700/30"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center">
                          <Checkbox
                            id={`addon-${addon.name}`}
                            checked={selectedAddOns.includes(addon.name)}
                            onCheckedChange={() => toggleAddOn(addon.name)}
                            className="border-blue-400/40"
                          />
                          <label
                            htmlFor={`addon-${addon.name}`}
                            className="ml-2 font-medium cursor-pointer text-blue-100"
                          >
                            {addon.name} {addon.recommended && <Badge variant="outline" className="ml-2 text-xs bg-amber-500/20 text-amber-200 border-amber-400/40">Recommended</Badge>}
                          </label>
                        </div>
                        <p className="text-sm text-blue-200/60 mt-1 ml-6">{addon.description}</p>
                      </div>
                      <div className="text-blue-300 font-semibold whitespace-nowrap ml-2">
                        {addon.priceRange}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-4 text-center text-blue-200/60">
                No add-on services available for this service
              </div>
            )}

            <div className="flex justify-end mt-6">
              <Button
                type="button"
                onClick={handleAddOnsComplete}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Continue to Vehicle Information
              </Button>
            </div>
          </div>
        )}

        {step === "vehicle" && (
          <div className="space-y-4 max-h-[calc(100vh-240px)] overflow-y-auto pb-4">
            <div className="flex justify-between items-center mb-2 sticky top-0 bg-gray-800/90 backdrop-blur-sm pt-2 pb-2 z-10">
              <div>
                <Label className="text-lg text-blue-100">Vehicle Information</Label>
                <p className="text-sm text-blue-200/60 mt-1">Please provide details about your vehicle</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-blue-200 hover:bg-blue-500/20"
                onClick={() => setStep("addons")}
              >
                Back
              </Button>
            </div>

            {/* Vehicle Tabs for multi-vehicle selection */}
            {vehicles.length > 1 && (
              <div className="flex flex-wrap gap-2 mb-4 pb-2 border-b border-blue-400/20">
                {vehicles.map((vehicle, idx) => (
                  <div key={idx} className="relative group">
                    <Button
                      variant={currentVehicleIndex === idx ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentVehicleIndex(idx)}
                      className="pr-8" // Extra space for remove button
                    >
                      {vehicle.make && vehicle.model
                        ? `${vehicle.make} ${vehicle.model}`
                        : `Vehicle ${idx + 1}`}
                    </Button>
                    {/* Remove vehicle button */}
                    {vehicles.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-2 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeVehicle(idx);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <Label htmlFor="vehicleMake" className="text-blue-100">Make *</Label>
                <Input
                  id="vehicleMake"
                  value={currentVehicle.make}
                  onChange={(e) => updateCurrentVehicle('make', e.target.value)}
                  placeholder="e.g., Toyota, Honda"
                  required
                  className="bg-gray-700/30 border-blue-400/30 text-blue-100 placeholder:text-blue-200/40"
                />
              </div>

              <div>
                <Label htmlFor="vehicleModel" className="text-blue-100">Model *</Label>
                <Input
                  id="vehicleModel"
                  value={currentVehicle.model}
                  onChange={(e) => updateCurrentVehicle('model', e.target.value)}
                  placeholder="e.g., Camry, Accord"
                  required
                  className="bg-gray-700/30 border-blue-400/30 text-blue-100 placeholder:text-blue-200/40"
                />
              </div>

              <div>
                <Label htmlFor="vehicleYear" className="text-blue-100">Year *</Label>
                <Input
                  id="vehicleYear"
                  value={currentVehicle.year}
                  onChange={(e) => updateCurrentVehicle('year', e.target.value)}
                  placeholder="e.g., 2020"
                  required
                  className="bg-gray-700/30 border-blue-400/30 text-blue-100 placeholder:text-blue-200/40"
                />
              </div>

              <div>
                <Label htmlFor="vehicleColor" className="text-blue-100">Color (Optional)</Label>
                <Input
                  id="vehicleColor"
                  value={currentVehicle.color}
                  onChange={(e) => updateCurrentVehicle('color', e.target.value)}
                  placeholder="e.g., Blue"
                  className="bg-gray-700/30 border-blue-400/30 text-blue-100 placeholder:text-blue-200/40"
                />
              </div>

              <div className="mt-4">
                <Label className="mb-2 block text-blue-100">Vehicle Condition (select all that apply)</Label>
                <div className="grid gap-2 mt-2">
                  {/* Pet hair, sand */}
                  <div className="flex items-center">
                    <Checkbox
                      id={`condition-pet-hair-sand-${currentVehicleIndex}`}
                      checked={currentVehicle.conditions.includes("Pet hair, sand")}
                      onCheckedChange={() => toggleVehicleCondition("Pet hair, sand")}
                      className="border-blue-400/40"
                    />
                    <label
                      htmlFor={`condition-pet-hair-sand-${currentVehicleIndex}`}
                      className="ml-2 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-blue-100"
                    >
                      Excessive pet hair, sand (additional cost for interior cleaning)
                    </label>
                  </div>

                  {/* Major Stains / Grease / Mold etc. */}
                  <div className="flex items-center">
                    <Checkbox
                      id={`condition-major-stains-${currentVehicleIndex}`}
                      checked={currentVehicle.conditions.includes("Major Stains / Grease / Mold etc.")}
                      onCheckedChange={() => toggleVehicleCondition("Major Stains / Grease / Mold etc.")}
                      className="border-blue-400/40"
                    />
                    <label
                      htmlFor={`condition-major-stains-${currentVehicleIndex}`}
                      className="ml-2 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-blue-100"
                    >
                      Major Stains / Grease / Mold etc.
                    </label>
                  </div>

                  {/* Description field for Major Stains */}
                  {currentVehicle.conditions.includes("Major Stains / Grease / Mold etc.") && (
                    <div className="ml-6 mt-1">
                      <Label className="text-xs text-blue-200/60">Please describe the specific issue in detail</Label>
                      <Input
                        placeholder="Describe stains/grease/mold issue"
                        value={otherCondition}
                        onChange={(e) => setOtherCondition(e.target.value)}
                        className="mt-1 h-8 text-sm bg-gray-700/30 border-blue-400/30 text-blue-100 placeholder:text-blue-200/40"
                      />
                    </div>
                  )}

                  {/* Urine / Vomit / Blood etc. */}
                  <div className="flex items-center">
                    <Checkbox
                      id={`condition-urine-vomit-${currentVehicleIndex}`}
                      checked={currentVehicle.conditions.includes("Urine / Vomit / Blood etc.")}
                      onCheckedChange={() => toggleVehicleCondition("Urine / Vomit / Blood etc.")}
                      className="border-blue-400/40"
                    />
                    <label
                      htmlFor={`condition-urine-vomit-${currentVehicleIndex}`}
                      className="ml-2 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-blue-100"
                    >
                      Urine / Vomit / Blood etc.
                    </label>
                  </div>

                  {/* Description field for Urine/Vomit/Blood */}
                  {currentVehicle.conditions.includes("Urine / Vomit / Blood etc.") && (
                    <div className="ml-6 mt-1">
                      <Label className="text-xs text-blue-200/60">Please describe the specific issue in detail</Label>
                      <Input
                        placeholder="Describe bodily fluid issue"
                        value={otherCondition}
                        onChange={(e) => setOtherCondition(e.target.value)}
                        className="mt-1 h-8 text-sm bg-gray-700/30 border-blue-400/30 text-blue-100 placeholder:text-blue-200/40"
                      />
                    </div>
                  )}

                  {/* None of the above */}
                  <div className="flex items-center">
                    <Checkbox
                      id={`condition-none-${currentVehicleIndex}`}
                      checked={currentVehicle.conditions.includes("None of the above")}
                      onCheckedChange={() => toggleVehicleCondition("None of the above")}
                      className="border-blue-400/40"
                    />
                    <label
                      htmlFor={`condition-none-${currentVehicleIndex}`}
                      className="ml-2 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-blue-100"
                    >
                      None of the above
                    </label>
                  </div>

                  {/* Other */}
                  <div className="flex items-center">
                    <Checkbox
                      id={`condition-other-${currentVehicleIndex}`}
                      checked={currentVehicle.conditions.includes("Other")}
                      onCheckedChange={() => toggleVehicleCondition("Other")}
                      className="border-blue-400/40"
                    />
                    <label
                      htmlFor={`condition-other-${currentVehicleIndex}`}
                      className="ml-2 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-blue-100"
                    >
                      Other:
                    </label>
                  </div>

                  {/* Description field for Other */}
                  {currentVehicle.conditions.includes("Other") && (
                    <div className="ml-6 mt-1">
                      <Input
                        placeholder="Please specify"
                        value={otherCondition}
                        onChange={(e) => setOtherCondition(e.target.value)}
                        className="mt-1 h-8 text-sm bg-gray-700/30 border-blue-400/30 text-blue-100 placeholder:text-blue-200/40"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Add another vehicle button */}
            <div className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={addVehicle}
                className="w-full border-dashed border-blue-400/40 text-blue-200 hover:bg-blue-500/20 hover:border-blue-400 flex items-center justify-center"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Another Vehicle
              </Button>
            </div>

            <div className="flex justify-end mt-6">
              <Button
                type="button"
                onClick={handleVehicleComplete}
                disabled={!currentVehicle.make || !currentVehicle.model || !currentVehicle.year}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Continue to Date Selection
              </Button>
            </div>
          </div>
        )}

        {step === "date" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <Label className="text-lg text-blue-100">Select a Date</Label>
                <p className="text-sm text-blue-200/60 mt-1">
                  Choose your preferred appointment date
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-blue-200 hover:bg-blue-500/20"
                onClick={() => setStep("vehicle")}
              >
                Back
              </Button>
            </div>

            {isLoading ? (
              <div className="py-8 text-center text-blue-200/70">Loading available dates...</div>
            ) : (
              <div className="py-4 flex justify-center">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={handleDateSelect}
                  disabled={(date) => {
                    return (
                      isBefore(date, new Date()) || // Disable past dates
                      isWeekend(date) || // Disable weekends
                      !availableDates.some(availableDate => // Disable dates not in availableDates
                        isSameDay(availableDate, date)
                      )
                    );
                  }}
                  className="rounded-md border border-blue-400/30 p-2 bg-gray-700/20"
                />
              </div>
            )}
          </div>
        )}

        {step === "time" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <Label className="text-lg text-blue-100">Select a Time</Label>
                <p className="text-sm text-blue-200/60 mt-1">
                  {selectedDate ? `For ${format(selectedDate, 'EEEE, MMMM d, yyyy')}` : ''}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-blue-200 hover:bg-blue-500/20"
                onClick={() => setStep("date")}
              >
                Back
              </Button>
            </div>

            {isLoading ? (
              <div className="py-8 text-center text-blue-200/70">Loading available times...</div>
            ) : getTimeSlotsForSelectedDate().length > 0 ? (
              <div className="grid gap-2 max-h-[300px] overflow-y-auto">
                {getTimeSlotsForSelectedDate().map((slot) => (
                  <Button
                    key={slot}
                    variant="outline"
                    className="justify-start h-auto py-3 px-4 text-left border-blue-400/30 text-blue-100 hover:bg-blue-500/20 hover:border-blue-400"
                    onClick={() => handleTimeSelect(slot)}
                  >
                    {formatTimeSlot(slot)}
                  </Button>
                ))}
              </div>
            ) : (
              <div className="py-4 text-center text-blue-200/70">
                No available times found for {selectedService?.name}.
              </div>
            )}
          </div>
        )}

        {step === "details" && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <Label className="text-lg text-blue-100">Contact Information</Label>
                <p className="text-sm text-blue-200/60 mt-1">
                  Please provide your contact details
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-blue-200 hover:bg-blue-500/20"
                onClick={() => setStep("time")}
              >
                Back
              </Button>
            </div>

            <div>
              <Label htmlFor="name" className="text-blue-100">Full Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                required
                className="bg-gray-700/30 border-blue-400/30 text-blue-100 placeholder:text-blue-200/40"
              />
            </div>

            <div>
              <Label htmlFor="phone" className="text-blue-100">Phone Number *</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Your phone number"
                required
                className="bg-gray-700/30 border-blue-400/30 text-blue-100 placeholder:text-blue-200/40"
                data-testid="input-phone"
              />
            </div>

            <div>
              <Label htmlFor="referralCode" className="text-blue-100">
                Referral Code <span className="text-blue-300/60 text-sm font-normal">(Optional)</span>
              </Label>
              <Input
                id="referralCode"
                type="text"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                onBlur={() => validateReferralCode(referralCode)}
                placeholder="Enter referral code"
                className="bg-gray-700/30 border-blue-400/30 text-blue-100 placeholder:text-blue-200/40 uppercase"
                data-testid="input-referral-code"
                disabled={isValidatingReferral}
              />
              {isValidatingReferral && (
                <p className="text-sm text-blue-300/70 mt-1">Validating code...</p>
              )}
              {referralStatus?.error && (
                <p className="text-sm text-red-400 mt-1">{referralStatus.error}</p>
              )}
              {referralStatus?.isValid && referralStatus.reward && (
                <div className="mt-2 p-3 bg-green-500/10 border border-green-500/30 rounded-md">
                  <p className="text-sm text-green-400 font-medium">
                    ✓ Valid code! You'll receive: {referralStatus.reward.description}
                  </p>
                  {referralStatus.reward.notes && (
                    <p className="text-xs text-green-300/70 mt-1">{referralStatus.reward.notes}</p>
                  )}
                  {referralStatus.reward.expiryDays && (
                    <p className="text-xs text-green-300/70 mt-1">
                      Valid for {referralStatus.reward.expiryDays} days after booking
                    </p>
                  )}
                </div>
              )}
            </div>

            <SMSConsentCheckbox
              checked={smsConsent}
              onCheckedChange={setSmsConsent}
              required={true}
              id="sms-consent-booking"
            />

            <div>
              <Label htmlFor="notes" className="text-blue-100">Additional Notes</Label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Gate code, special instructions, issues or concerns?"
                className="min-h-[100px] w-full rounded-md border border-blue-400/30 bg-gray-700/30 px-3 py-2 text-sm text-blue-100 placeholder:text-blue-200/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            {/* Live Pricing Calculator */}
            <BookingPriceCalculator
              selectedService={selectedService?.name || ""}
              selectedAddOns={selectedAddOns}
              vehicles={vehicles}
              basePriceEstimate={calculateBasePrice(selectedService?.name || "")}
              addOnPrices={calculateAddOnPrices()}
              conditionPrices={calculateConditionPrices()}
            />

            {/* Loyalty Points Display */}
            <BookingLoyaltyDisplay
              phoneNumber={phone}
              selectedService={selectedService?.name || ""}
              selectedAddOns={selectedAddOns}
              vehicleConditions={vehicles.flatMap(v => v.conditions || [])}
              estimatedPrice={calculateTotalPrice()}
              pointsEarningRate={1}
            />

            <div className="pt-6 pb-2">
              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-lg shadow-blue-500/30"
                disabled={isLoading}
              >
                {isLoading ? "Booking..." : "Confirm Appointment"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}