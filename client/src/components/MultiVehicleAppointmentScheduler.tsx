import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
import { AddressMapConfirmation } from "./AddressMapConfirmation";
import { 
  Plus, 
  X, 
  MapPin, 
  Zap, 
  Car, 
  Calendar as CalendarIcon, 
  Clock, 
  CheckCircle2,
  Sparkles,
  Award,
  History,
  RefreshCw,
  Check,
  Loader2
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useDebounce } from "@/hooks/use-debounce";

// Premium Design Tokens
const GLASS_CARD = "bg-gray-900/40 backdrop-blur-xl border border-blue-500/20 shadow-2xl shadow-blue-500/10";
const GRADIENT_TEXT = "bg-clip-text text-transparent bg-gradient-to-r from-blue-200 via-blue-400 to-blue-200";
const GRADIENT_BUTTON = "bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400";
const STEP_INDICATOR_ACTIVE = "bg-blue-500 text-white shadow-lg shadow-blue-500/50";
const STEP_INDICATOR_COMPLETE = "bg-green-500 text-white shadow-lg shadow-green-500/50";
const STEP_INDICATOR_PENDING = "bg-gray-700/50 text-gray-400 border border-gray-600/30";

// Motion variants for step transitions
const stepVariants = {
  enter: { opacity: 0, x: 20 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 }
};

const stepTransition = {
  duration: 0.3,
  ease: "easeInOut"
};

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
  appointmentId?: number;
  calendarEventId?: string;
}

interface MultiVehicleAppointmentSchedulerProps {
  initialName?: string;
  initialPhone?: string;
  initialService?: string;
  initialReferralCode?: string;
  // Loyalty Redemption Journey v2 - reward context from Rewards Portal
  initialRewardId?: number;
  initialRewardName?: string;
  initialRewardPoints?: number;
  // Bookings Inbox manual booking flow
  initialAddress?: string;
  initialVehicle?: string;
  initialDatetime?: string;
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
  initialRewardId,
  initialRewardName,
  initialRewardPoints,
  initialAddress,
  initialVehicle,
  initialDatetime,
}: MultiVehicleAppointmentSchedulerProps = {}) {
  const [step, setStep] = useState<"address" | "mapConfirmation" | "accessVerification" | "service" | "addons" | "vehicle" | "date" | "time" | "details">("address");
  const [customerAddress, setCustomerAddress] = useState<string>(initialAddress || "");
  const [isExtendedAreaRequest, setIsExtendedAreaRequest] = useState<boolean>(false);
  const [addressLatitude, setAddressLatitude] = useState<number | undefined>();
  const [addressLongitude, setAddressLongitude] = useState<number | undefined>();
  const [addressNeedsReview, setAddressNeedsReview] = useState<boolean>(false);
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
  
  // Loyalty Redemption Journey v2 - pending reward to apply at checkout
  const [pendingReward, setPendingReward] = useState<{
    id: number;
    name: string;
    points: number;
  } | null>(initialRewardId && initialRewardName && initialRewardPoints ? {
    id: initialRewardId,
    name: initialRewardName,
    points: initialRewardPoints,
  } : null);
  const [rewardValidationStatus, setRewardValidationStatus] = useState<{
    validated: boolean;
    canRedeem: boolean;
    reason?: string;
    isValidating?: boolean;
  } | null>(null);

  // Returning Customer Detection state
  const [returningCustomerData, setReturningCustomerData] = useState<{
    isReturning: boolean;
    customer: any;
    recentAppointment: any;
    pastAppointments: any[];
  } | null>(null);
  const [showBookAgain, setShowBookAgain] = useState(false);
  const [isCheckingPhone, setIsCheckingPhone] = useState(false);

  // Recurring service setup state
  const [setupRecurring, setSetupRecurring] = useState(false);
  const [recurringInterval, setRecurringInterval] = useState<'3months' | '6months' | '12months'>('3months');

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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [usedFallback, setUsedFallback] = useState<boolean>(false);
  const [preferredTimeWindow, setPreferredTimeWindow] = useState<string>("");
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

  // Pre-fill vehicle info from URL parameter (e.g., "2020 Honda Accord Black")
  useEffect(() => {
    if (initialVehicle && initialVehicle.trim()) {
      // Parse vehicle string - expects format like "2020 Honda Accord Black" or "Honda Accord"
      const parts = initialVehicle.trim().split(/\s+/);
      let year = "";
      let make = "";
      let model = "";
      let color = "";
      
      // Check if first part is a year (4 digits starting with 19 or 20)
      if (parts.length > 0 && /^(19|20)\d{2}$/.test(parts[0])) {
        year = parts[0];
        parts.shift();
      }
      
      // Check if last part is a color (common colors)
      const commonColors = ['black', 'white', 'silver', 'gray', 'grey', 'red', 'blue', 'green', 'brown', 'gold', 'beige', 'tan', 'orange', 'yellow', 'purple', 'maroon'];
      if (parts.length > 0 && commonColors.includes(parts[parts.length - 1].toLowerCase())) {
        color = parts.pop() || "";
      }
      
      // Remaining: first is make, rest is model
      if (parts.length > 0) {
        make = parts[0];
        model = parts.slice(1).join(' ');
      }
      
      setVehicles([{
        make,
        model,
        year,
        color,
        conditions: []
      }]);
    }
  }, [initialVehicle]);

  // Pre-fill date/time from URL parameter (expects ISO format)
  useEffect(() => {
    if (initialDatetime && initialDatetime.trim()) {
      try {
        // Try parsing as ISO date string
        const parsedDate = parseISO(initialDatetime);
        if (!isNaN(parsedDate.getTime())) {
          setSelectedDate(parsedDate);
          // selectedTime expects the full ISO string for slot matching and display formatting
          setSelectedTime(initialDatetime);
        }
      } catch (e) {
        console.warn('Could not parse initialDatetime:', initialDatetime);
      }
    }
  }, [initialDatetime]);

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
    setLoadError(null);
    setUsedFallback(false);
    
    try {
      const response = await fetch(`/api/available-slots?service=${encodeURIComponent(selectedService!.name)}`);
      const data = await response.json();

      if (data.success && data.slots && Array.isArray(data.slots)) {
        const allSlots: string[] = data.slots;

        const availableDatesList: Date[] = [];
        const timeSlotsByDay: Record<string, string[]> = {};
        const seenDates = new Set<string>();

        allSlots.forEach(slotISO => {
          const slotDate = parseISO(slotISO);
          const dateKey = format(slotDate, 'yyyy-MM-dd');

          if (!timeSlotsByDay[dateKey]) {
            timeSlotsByDay[dateKey] = [];
          }
          timeSlotsByDay[dateKey].push(slotISO);

          if (!seenDates.has(dateKey)) {
            seenDates.add(dateKey);
            availableDatesList.push(slotDate);
          }
        });

        availableDatesList.sort((a, b) => a.getTime() - b.getTime());

        setAvailableSlots(allSlots);
        setAvailableDates(availableDatesList);
        setDailyTimeSlots(timeSlotsByDay);
        
        if (data.fallback || data.usedSource === 'internal_fallback') {
          setUsedFallback(true);
        }

        if (allSlots.length === 0) {
          setLoadError("We couldn't find live time slots. You can still pick a date below and we'll confirm the closest available time by text.");
        }
      } else if (!response.ok) {
        throw new Error("Failed to fetch slots");
      } else {
        setAvailableSlots([]);
        setAvailableDates([]);
        setDailyTimeSlots({});
        setLoadError("We couldn't find live time slots. You can still pick a date below and we'll confirm the closest available time by text.");
      }
    } catch (error) {
      console.error("Error fetching time slots:", error);
      setLoadError("We had trouble loading available times. You can try again, or pick a date and we'll follow up to confirm.");
      setAvailableSlots([]);
      setAvailableDates([]);
      setDailyTimeSlots({});
    } finally {
      setIsLoading(false);
    }
  };

  // Loyalty Redemption Journey v2 - Validate reward when cart changes
  // This effect triggers real-time validation to show guardrail messaging
  useEffect(() => {
    const validateReward = async () => {
      if (!pendingReward) {
        return;
      }

      // Set validating state while we check
      setRewardValidationStatus(prev => prev ? { ...prev, isValidating: true } : { validated: false, canRedeem: false, isValidating: true });

      // Helper: Parse price from priceRange string (e.g., "$50" or "$225-300")
      const parsePrice = (priceRange: string): number => {
        const priceMatch = priceRange.match(/\$?([\d,]+)/);
        if (priceMatch) {
          return parseInt(priceMatch[1].replace(/,/g, ''), 10);
        }
        return 0;
      };

      // Calculate service price
      let servicePrice = 0;
      if (selectedService?.priceRange) {
        servicePrice = parsePrice(selectedService.priceRange);
      }

      // Build line items with accurate individual prices for guardrail check
      const lineItems: Array<{ id: string; name: string; price: number; isAddOn: boolean }> = [];

      // Add core service with its own price
      if (selectedService) {
        lineItems.push({
          id: selectedService.name.toLowerCase().replace(/\s+/g, '-'),
          name: selectedService.name,
          price: servicePrice,
          isAddOn: false,
        });
      }

      // Add add-ons with their individual prices (important for min-total calculation)
      selectedAddOns.forEach(addonName => {
        const addon = addOnServices.find(a => a.name === addonName);
        const addonPrice = addon?.priceRange ? parsePrice(addon.priceRange) : 0;
        lineItems.push({
          id: addonName.toLowerCase().replace(/\s+/g, '-'),
          name: addonName,
          price: addonPrice,
          isAddOn: true,
        });
      });

      // Calculate cart total as sum of all line item prices
      const cartTotal = lineItems.reduce((sum, item) => sum + item.price, 0);

      // If we have customer ID from phone lookup, validate with backend
      if (returningCustomerData?.customer?.id) {
        try {
          const response = await fetch('/api/loyalty/validate-redemption', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              customerId: returningCustomerData.customer.id,
              rewardId: pendingReward.id,
              cartTotal,
              selectedServices: lineItems,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              setRewardValidationStatus({
                validated: true,
                canRedeem: data.data.canRedeem,
                reason: data.data.reason,
                isValidating: false,
              });
              return;
            }
          }
        } catch (error) {
          console.error('[REWARD VALIDATION] Error:', error);
        }
      }
      
      // Fallback: Client-side validation when customer not yet identified
      // This ensures immediate feedback before phone lookup completes
      const hasCoreService = lineItems.some(item => !item.isAddOn);
      
      // If phone lookup is in progress, show pending state
      if (isCheckingPhone) {
        setRewardValidationStatus({
          validated: false,
          canRedeem: false,
          reason: "Verifying your account...",
          isValidating: true,
        });
        return;
      }
      
      // Client-side guardrail check (mirrors backend logic)
      // Default min total is $50 based on typical business settings
      const MIN_CART_TOTAL = 50;
      
      setRewardValidationStatus({
        validated: true,
        canRedeem: hasCoreService && cartTotal >= MIN_CART_TOTAL,
        reason: !selectedService
          ? "Select a service to see if your reward applies."
          : !hasCoreService 
            ? "Select a core service (not just add-ons) to apply your reward." 
            : cartTotal < MIN_CART_TOTAL 
              ? `Minimum order value of $${MIN_CART_TOTAL} required. Current: $${cartTotal}.`
              : undefined,
        isValidating: false,
      });
    };

    validateReward();
  }, [pendingReward, selectedService, selectedAddOns, addOnServices, returningCustomerData, isCheckingPhone]);

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

  // Check if customer is returning based on phone number
  const checkReturningCustomer = async (phoneValue: string) => {
    // Only check if phone is 10 digits (US format)
    const digitsOnly = phoneValue.replace(/\D/g, '');
    if (digitsOnly.length !== 10) {
      setReturningCustomerData(null);
      return;
    }
    
    setIsCheckingPhone(true);
    
    try {
      const response = await fetch(`/api/customers/check-phone/${phoneValue}`);
      
      // Check for HTTP errors BEFORE parsing JSON
      if (!response.ok) {
        if (response.status === 401) {
          console.error('Customer check endpoint requires authentication - check publicPaths configuration');
          toast({
            title: "System Error",
            description: "Unable to verify customer status. Please continue with booking.",
            variant: "destructive",
          });
        }
        setReturningCustomerData(null);
        setIsCheckingPhone(false);
        return;
      }
      
      const data = await response.json();
      
      if (data.success && data.isReturning) {
        setReturningCustomerData(data);
        
        // Auto-prefill name if recent appointment exists
        if (data.customer && data.customer.name && !name) {
          setName(data.customer.name);
        }
        
        // Auto-prefill address if available
        if (data.customer && data.customer.address && !customerAddress) {
          setCustomerAddress(data.customer.address);
        }
        
        // Prefill vehicle from most recent appointment
        if (data.recentAppointment && vehicles.length === 1 && !vehicles[0].make && !vehicles[0].model) {
          setVehicles([{
            year: data.recentAppointment.vehicleYear || '',
            make: data.recentAppointment.vehicleMake || '',
            model: data.recentAppointment.vehicleModel || '',
            color: data.recentAppointment.vehicleColor || '',
            conditions: []
          }]);
        }
        
        toast({
          title: "Welcome back!",
          description: `Hi ${data.customer.name}! We've prefilled your information.`,
        });
      } else {
        setReturningCustomerData(null);
      }
    } catch (error) {
      console.error('Failed to check customer:', error);
      // Don't show error to user - just silently disable smart prefill
      setReturningCustomerData(null);
    } finally {
      setIsCheckingPhone(false);
    }
  };

  // Debounced version to avoid too many API calls
  const debouncedPhone = useDebounce(phone, 500);
  
  useEffect(() => {
    if (debouncedPhone) {
      checkReturningCustomer(debouncedPhone);
    }
  }, [debouncedPhone]);

  // Prefill from past appointment (Book Again feature)
  const prefillFromPastAppointment = (appointment: any) => {
    // Set service
    const matchingService = services.find((s: any) => s.id === appointment.serviceId || s.name === appointment.service?.name);
    if (matchingService) {
      setSelectedService(matchingService);
      setStep("addons");
    }
    
    // Set vehicle
    setVehicles([{
      year: appointment.vehicleYear || '',
      make: appointment.vehicleMake || '',
      model: appointment.vehicleModel || '',
      color: appointment.vehicleColor || '',
      conditions: []
    }]);
    
    // Set address if available
    if (appointment.address && !customerAddress) {
      setCustomerAddress(appointment.address);
    }
    
    toast({
      title: "Booking prefilled!",
      description: `Ready to schedule your ${appointment.service?.name || 'service'}`,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const hasTimeSelection = selectedTime || (selectedDate && availableDates.length === 0);
    
    if (!name.trim() || !phone.trim() || !selectedService || !hasTimeSelection) {
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
          email: customerEmail,
          address: customerAddress,
          isExtendedAreaRequest,
          latitude: addressLatitude,
          longitude: addressLongitude,
          addressNeedsReview,
          service: selectedService!.name,
          addOns: selectedAddOns,
          vehicles,
          notes: preferredTimeWindow 
            ? `${notes}${notes ? '\n' : ''}[Preferred time: ${preferredTimeWindow}]` 
            : notes,
          time: selectedTime || (selectedDate ? format(selectedDate, "yyyy-MM-dd'T'09:00:00") : ''),
          smsConsent,
          referralCode: referralStatus?.isValid ? referralCode : undefined,
          needsTimeConfirmation: !selectedTime && selectedDate ? true : false,
          preferredTimeWindow: preferredTimeWindow || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to book appointment");
      }

      const data = await response.json();

      if (data.success) {
        // Create recurring service if enabled
        if (setupRecurring && recurringInterval && data.customerId) {
          try {
            // Calculate next service date based on selected interval
            const scheduledDate = new Date(selectedTime);
            let monthsToAdd = 3;
            if (recurringInterval === '6months') monthsToAdd = 6;
            if (recurringInterval === '12months') monthsToAdd = 12;
            
            const nextServiceDate = new Date(scheduledDate);
            nextServiceDate.setMonth(nextServiceDate.getMonth() + monthsToAdd);
            
            // Create recurring service record
            await fetch('/api/recurring-services', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                customerId: data.customerId,
                serviceId: selectedService?.id,
                serviceName: selectedService?.name,
                frequency: recurringInterval,
                nextServiceDate: nextServiceDate.toISOString(),
                active: true,
              }),
            });
            
            toast({
              title: "Recurring Service Set Up",
              description: `We'll remind you in ${recurringInterval === '3months' ? '3 months' : recurringInterval === '6months' ? '6 months' : '1 year'} for your next service!`,
            });
          } catch (error) {
            console.error('Failed to set up recurring service:', error);
            // Don't fail the entire booking if recurring service setup fails
          }
        }

        toast({
          title: "Success",
          description: "Your appointment has been scheduled!",
        });

        // Format the time for display (defensive guard for parseISO)
        let formattedTime = selectedTime;
        try {
          if (selectedTime) {
            formattedTime = format(parseISO(selectedTime), "EEEE, MMMM d, yyyy 'at' h:mm a");
          }
        } catch (error) {
          console.error("Error formatting time:", error);
        }

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
          appointmentId: data.appointmentId,
          calendarEventId: data.eventLink,
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
  const handleAddressNext = (address: string, isExtendedArea: boolean = false, lat?: number, lng?: number) => {
    setCustomerAddress(address);
    setIsExtendedAreaRequest(isExtendedArea);
    setAddressLatitude(lat);
    setAddressLongitude(lng);
    
    // If we have coordinates, show map confirmation; otherwise skip to access verification
    if (lat && lng) {
      setStep("mapConfirmation");
    } else {
      setStep("accessVerification");
    }
  };
  
  // Handler for map confirmation
  const handleMapConfirmation = (lat: number, lng: number, needsReview: boolean) => {
    setAddressLatitude(lat);
    setAddressLongitude(lng);
    setAddressNeedsReview(needsReview);
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

  // Step configuration
  const steps = [
    { id: "address", label: "Address", icon: MapPin },
    { id: "accessVerification", label: "Access", icon: Zap },
    { id: "service", label: "Service", icon: Sparkles },
    { id: "addons", label: "Add-ons", icon: Award },
    { id: "vehicle", label: "Vehicle", icon: Car },
    { id: "date", label: "Date", icon: CalendarIcon },
    { id: "time", label: "Time", icon: Clock },
    { id: "details", label: "Confirm", icon: CheckCircle2 }
  ];

  const currentStepIndex = steps.findIndex(s => s.id === step);
  
  const getStepStatus = (index: number) => {
    if (index < currentStepIndex) return "complete";
    if (index === currentStepIndex) return "active";
    return "pending";
  };

  return (
    <div className="w-full h-full flex flex-col bg-gradient-to-b from-gray-900 via-blue-950/10 to-black text-white relative overflow-hidden">
      {/* Premium background blur orbs */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <motion.div 
          className="absolute top-[10%] left-[15%] w-96 h-96 bg-blue-500/5 rounded-full filter blur-3xl"
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3]
          }}
          transition={{ 
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div 
          className="absolute bottom-[20%] right-[10%] w-80 h-80 bg-blue-600/5 rounded-full filter blur-3xl"
          animate={{ 
            scale: [1, 1.3, 1],
            opacity: [0.3, 0.5, 0.3]
          }}
          transition={{ 
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1
          }}
        />
      </div>

      {/* Header */}
      <motion.div 
        className="p-6 pb-3 text-center border-b border-blue-400/10 flex-shrink-0 relative z-10"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h2 className={`text-xl md:text-2xl font-bold ${GRADIENT_TEXT}`}>
          Schedule an Appointment
        </h2>
      </motion.div>

      {/* Premium Step Indicator */}
      <div className="px-6 py-4 border-b border-blue-400/10 relative z-10">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          {steps.map((stepInfo, index) => {
            const status = getStepStatus(index);
            const StepIcon = stepInfo.icon;
            
            return (
              <div key={stepInfo.id} className="flex items-center flex-1">
                <motion.div
                  className="flex flex-col items-center"
                  initial={false}
                  animate={{ scale: status === "active" ? 1.1 : 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <motion.div
                    className={`
                      w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold mb-1
                      transition-all duration-300
                      ${status === "active" ? STEP_INDICATOR_ACTIVE : ""}
                      ${status === "complete" ? STEP_INDICATOR_COMPLETE : ""}
                      ${status === "pending" ? STEP_INDICATOR_PENDING : ""}
                    `}
                    whileHover={{ scale: 1.05 }}
                  >
                    {status === "complete" ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <StepIcon className="w-5 h-5" />
                    )}
                  </motion.div>
                  <span className={`text-xs hidden md:block ${status === "active" ? "text-blue-300 font-medium" : "text-gray-500"}`}>
                    {stepInfo.label}
                  </span>
                </motion.div>
                
                {/* Connector line */}
                {index < steps.length - 1 && (
                  <div className="flex-1 h-0.5 mx-2 bg-gray-700/30 relative">
                    <motion.div
                      className="h-full bg-blue-500"
                      initial={{ width: "0%" }}
                      animate={{ width: index < currentStepIndex ? "100%" : "0%" }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
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

      {/* Content Area with AnimatePresence for smooth transitions */}
      <div className="flex-1 overflow-y-auto px-6 pb-6 relative z-10">
        <AnimatePresence mode="wait">
        {step === "address" && (
          <motion.div
            key="address"
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={stepTransition}
          >
            <ServiceAreaCheck
              onNext={handleAddressNext}
              onBack={onClose || (() => {})}
              initialAddress={initialAddress}
            />
          </motion.div>
        )}

        {step === "mapConfirmation" && addressLatitude && addressLongitude && (
          <motion.div
            key="mapConfirmation"
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={stepTransition}
          >
            <AddressMapConfirmation
              address={customerAddress}
              latitude={addressLatitude}
              longitude={addressLongitude}
              onConfirm={handleMapConfirmation}
              onCancel={() => setStep("address")}
            />
          </motion.div>
        )}

        {step === "accessVerification" && (
          <motion.div
            key="accessVerification"
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={stepTransition}
          >
            <PowerWaterAccessVerification
              onConfirm={handleAccessVerificationNext}
              onBack={handleAccessVerificationBack}
              locationType="house"
            />
          </motion.div>
        )}

        {step === "service" && (
          <motion.div
            key="service"
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={stepTransition}
            className="space-y-4"
          >
            {/* Loyalty Redemption Journey v2 - Inline reward status during service selection */}
            {pendingReward && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-xl p-3 border ${
                  rewardValidationStatus?.isValidating
                    ? "bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border-blue-500/40"
                    : rewardValidationStatus?.canRedeem 
                      ? "bg-gradient-to-r from-green-600/20 to-emerald-600/20 border-green-500/40" 
                      : "bg-gradient-to-r from-purple-600/20 to-pink-600/20 border-purple-500/40"
                }`}
                data-testid="reward-status-service-step"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      rewardValidationStatus?.isValidating
                        ? "bg-gradient-to-br from-blue-500 to-indigo-500"
                        : rewardValidationStatus?.canRedeem 
                          ? "bg-gradient-to-br from-green-500 to-emerald-500" 
                          : "bg-gradient-to-br from-purple-500 to-pink-500"
                    }`}>
                      {rewardValidationStatus?.isValidating ? (
                        <Loader2 className="w-4 h-4 text-white animate-spin" />
                      ) : rewardValidationStatus?.canRedeem ? (
                        <CheckCircle2 className="w-4 h-4 text-white" />
                      ) : (
                        <Award className="w-4 h-4 text-white" />
                      )}
                    </div>
                    <div>
                      <p className={`text-sm font-medium ${
                        rewardValidationStatus?.isValidating
                          ? "text-blue-100"
                          : rewardValidationStatus?.canRedeem 
                            ? "text-green-100" 
                            : "text-purple-100"
                      }`}>
                        {rewardValidationStatus?.isValidating 
                          ? "Checking Eligibility..." 
                          : rewardValidationStatus?.canRedeem 
                            ? "Ready to Apply" 
                            : "Reward Pending"}
                      </p>
                      <p className="text-xs text-gray-300">{pendingReward.name}</p>
                    </div>
                  </div>
                  <Badge className={
                    rewardValidationStatus?.isValidating
                      ? "bg-blue-500/20 text-blue-200 border-blue-500/30 text-xs"
                      : rewardValidationStatus?.canRedeem 
                        ? "bg-green-500/20 text-green-200 border-green-500/30 text-xs" 
                        : "bg-purple-500/20 text-purple-200 border-purple-500/30 text-xs"
                  }>
                    {pendingReward.points.toLocaleString()} pts
                  </Badge>
                </div>
                {rewardValidationStatus && !rewardValidationStatus.isValidating && !rewardValidationStatus.canRedeem && rewardValidationStatus.reason && (
                  <p className="text-xs text-amber-300 mt-2 pl-10">{rewardValidationStatus.reason}</p>
                )}
              </motion.div>
            )}
            
            <div className={`${GLASS_CARD} rounded-xl p-6`}>
              <h3 className={`text-lg font-semibold mb-4 ${GRADIENT_TEXT}`}>
                <Sparkles className="w-5 h-5 inline mr-2" />
                Select Your Service
              </h3>
              {isLoadingServices ? (
                <div className="py-8 text-center">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full mx-auto"
                  />
                  <p className="text-blue-200/70 mt-4">Loading services...</p>
                </div>
              ) : services.length > 0 ? (
                <div className="grid gap-3 max-h-[400px] overflow-y-auto pr-2">
                  {services.map((service, index) => (
                    <motion.div
                      key={service.name}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      className={`
                        relative rounded-lg border p-4 cursor-pointer transition-all duration-200
                        ${selectedService?.name === service.name
                          ? "border-blue-400 bg-gradient-to-br from-blue-500/20 to-blue-600/10 shadow-lg shadow-blue-500/20"
                          : "border-blue-400/20 bg-gray-800/40 hover:bg-gray-800/60 hover:border-blue-400/40 hover:shadow-lg"
                        }
                      `}
                      onClick={() => handleServiceSelect(service)}
                    >
                      {selectedService?.name === service.name && (
                        <motion.div
                          layoutId="selected-service"
                          className="absolute inset-0 border-2 border-blue-400 rounded-lg"
                          initial={false}
                          transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        />
                      )}
                      <div className="flex flex-col">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-semibold text-blue-100 flex items-center">
                            <Sparkles className="w-4 h-4 mr-2 text-blue-400" />
                            {service.name}
                          </div>
                          <div className="text-blue-300 whitespace-nowrap font-bold bg-blue-500/10 px-3 py-1 rounded-full">
                            {service.priceRange}
                          </div>
                        </div>
                        <p className="text-sm text-blue-200/70 mb-2">{service.description}</p>
                        <div className="flex items-center text-xs text-blue-300/60">
                          <Clock className="w-3 h-3 mr-1" />
                          <span>{service.duration}</span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <p className="text-blue-200/70 mb-4">No services available</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-blue-400/30 text-blue-200 hover:bg-blue-500/20"
                    onClick={onClose}
                  >
                    Close
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {step === "addons" && (
          <motion.div
            key="addons"
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={stepTransition}
            className="space-y-4"
          >
            {/* Loyalty Redemption Journey v2 - Inline reward status during add-on selection */}
            {pendingReward && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-xl p-3 border ${
                  rewardValidationStatus?.isValidating
                    ? "bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border-blue-500/40"
                    : rewardValidationStatus?.canRedeem 
                      ? "bg-gradient-to-r from-green-600/20 to-emerald-600/20 border-green-500/40" 
                      : "bg-gradient-to-r from-purple-600/20 to-pink-600/20 border-purple-500/40"
                }`}
                data-testid="reward-status-addons-step"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      rewardValidationStatus?.isValidating
                        ? "bg-gradient-to-br from-blue-500 to-indigo-500"
                        : rewardValidationStatus?.canRedeem 
                          ? "bg-gradient-to-br from-green-500 to-emerald-500" 
                          : "bg-gradient-to-br from-purple-500 to-pink-500"
                    }`}>
                      {rewardValidationStatus?.isValidating ? (
                        <Loader2 className="w-4 h-4 text-white animate-spin" />
                      ) : rewardValidationStatus?.canRedeem ? (
                        <CheckCircle2 className="w-4 h-4 text-white" />
                      ) : (
                        <Award className="w-4 h-4 text-white" />
                      )}
                    </div>
                    <div>
                      <p className={`text-sm font-medium ${
                        rewardValidationStatus?.isValidating
                          ? "text-blue-100"
                          : rewardValidationStatus?.canRedeem 
                            ? "text-green-100" 
                            : "text-purple-100"
                      }`}>
                        {rewardValidationStatus?.isValidating 
                          ? "Checking Eligibility..." 
                          : rewardValidationStatus?.canRedeem 
                            ? "Ready to Apply" 
                            : "Reward Pending"}
                      </p>
                      <p className="text-xs text-gray-300">{pendingReward.name}</p>
                    </div>
                  </div>
                  <Badge className={
                    rewardValidationStatus?.isValidating
                      ? "bg-blue-500/20 text-blue-200 border-blue-500/30 text-xs"
                      : rewardValidationStatus?.canRedeem 
                        ? "bg-green-500/20 text-green-200 border-green-500/30 text-xs" 
                        : "bg-purple-500/20 text-purple-200 border-purple-500/30 text-xs"
                  }>
                    {pendingReward.points.toLocaleString()} pts
                  </Badge>
                </div>
                {rewardValidationStatus && !rewardValidationStatus.isValidating && !rewardValidationStatus.canRedeem && rewardValidationStatus.reason && (
                  <p className="text-xs text-amber-300 mt-2 pl-10">{rewardValidationStatus.reason}</p>
                )}
              </motion.div>
            )}
            
            <div className={`${GLASS_CARD} rounded-xl p-6`}>
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className={`text-lg font-semibold ${GRADIENT_TEXT}`}>
                    <Award className="w-5 h-5 inline mr-2" />
                    Enhance Your Service
                  </h3>
                  <p className="text-sm text-blue-200/60 mt-1">
                    Add optional upgrades to {selectedService?.name}
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
                <div className="py-8 text-center">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full mx-auto"
                  />
                  <p className="text-blue-200/70 mt-4">Loading add-on options...</p>
                </div>
              ) : addOnServices.length > 0 ? (
                <div className="grid gap-3 max-h-[400px] overflow-y-auto pr-2">
                  {addOnServices.map((addon, index) => (
                    <motion.div
                      key={addon.name}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      whileHover={{ scale: 1.01 }}
                      className={`
                        relative rounded-lg border p-4 cursor-pointer transition-all duration-200
                        ${selectedAddOns.includes(addon.name)
                          ? "border-blue-400 bg-gradient-to-br from-blue-500/20 to-blue-600/10 shadow-lg shadow-blue-500/20"
                          : addon.recommended
                            ? "border-amber-400/40 bg-gradient-to-br from-amber-500/10 to-amber-600/5"
                            : "border-blue-400/20 bg-gray-800/40 hover:bg-gray-800/60"
                        }
                      `}
                      onClick={() => toggleAddOn(addon.name)}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1 flex items-start">
                          <Checkbox
                            id={`addon-${addon.name}`}
                            checked={selectedAddOns.includes(addon.name)}
                            onCheckedChange={() => toggleAddOn(addon.name)}
                            className="mt-1 border-blue-400/40"
                          />
                          <div className="ml-3 flex-1">
                            <label
                              htmlFor={`addon-${addon.name}`}
                              className="font-semibold cursor-pointer text-blue-100 flex items-center"
                            >
                              {addon.name}
                              {addon.recommended && (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  transition={{ delay: 0.2 }}
                                >
                                  <Badge className="ml-2 text-xs bg-amber-500/30 text-amber-200 border-amber-400/50">
                                    ⭐ Recommended
                                  </Badge>
                                </motion.div>
                              )}
                            </label>
                            <p className="text-sm text-blue-200/70 mt-1">{addon.description}</p>
                          </div>
                        </div>
                        <div className="text-blue-300 font-bold whitespace-nowrap ml-3 bg-blue-500/10 px-3 py-1 rounded-full">
                          {addon.priceRange}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <p className="text-blue-200/60">No add-on services available for this service</p>
                </div>
              )}

              <div className="flex justify-between items-center mt-6 pt-4 border-t border-blue-400/10">
                <p className="text-sm text-blue-300/70">
                  {selectedAddOns.length} add-on{selectedAddOns.length !== 1 ? 's' : ''} selected
                </p>
                <Button
                  type="button"
                  onClick={handleAddOnsComplete}
                  className={`${GRADIENT_BUTTON} shadow-lg shadow-blue-500/30 transition-all hover:scale-105`}
                >
                  Continue to Vehicle Information
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {step === "vehicle" && (
          <motion.div
            key="vehicle"
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={stepTransition}
            className="space-y-4"
          >
            <div className={`${GLASS_CARD} rounded-xl p-6 max-h-[calc(100vh-300px)] overflow-y-auto`}>
              <div className="flex justify-between items-center mb-4 sticky top-0 bg-gray-900/90 backdrop-blur-sm pt-2 pb-2 z-10">
                <div>
                  <h3 className={`text-lg font-semibold ${GRADIENT_TEXT}`}>
                    <Car className="w-5 h-5 inline mr-2" />
                    Vehicle Information
                  </h3>
                  <p className="text-sm text-blue-200/60 mt-1">Tell us about your vehicle{vehicles.length > 1 ? 's' : ''}</p>
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
              <div className="mt-6 pt-4 border-t border-blue-400/10">
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

              <div className="flex justify-end mt-6 pt-4 border-t border-blue-400/10">
                <Button
                  type="button"
                  onClick={handleVehicleComplete}
                  disabled={!currentVehicle.make || !currentVehicle.model || !currentVehicle.year}
                  className={`${GRADIENT_BUTTON} shadow-lg shadow-blue-500/30 transition-all hover:scale-105`}
                >
                  Continue to Date Selection
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {step === "date" && (
          <motion.div
            key="date"
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={stepTransition}
            className="space-y-4"
          >
            <div className={`${GLASS_CARD} rounded-xl p-6`}>
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className={`text-lg font-semibold ${GRADIENT_TEXT}`}>
                    <CalendarIcon className="w-5 h-5 inline mr-2" />
                    Select Your Date
                  </h3>
                  <p className="text-sm text-blue-200/60 mt-1">
                    Choose your preferred appointment date
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-blue-200 hover:bg-blue-500/20"
                  onClick={() => setStep("vehicle")}
                  data-testid="button-back-to-vehicle"
                >
                  Back
                </Button>
              </div>

              {loadError && (
                <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-950/40 px-3 py-2 text-xs text-amber-100">
                  {loadError}
                  <button
                    type="button"
                    onClick={fetchAvailableSlots}
                    className="ml-2 text-amber-200 underline hover:text-amber-100"
                    data-testid="button-retry-availability"
                  >
                    Try again
                  </button>
                </div>
              )}

              {usedFallback && !loadError && (
                <div className="mb-4 rounded-lg border border-blue-500/40 bg-blue-950/40 px-3 py-2 text-xs text-blue-100">
                  Showing estimated availability. We&apos;ll confirm your exact time by text.
                </div>
              )}

              {isLoading ? (
                <div className="py-8 text-center">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full mx-auto"
                  />
                  <p className="text-blue-200/70 mt-4">Loading available dates...</p>
                </div>
              ) : availableDates.length === 0 ? (
                <div className="py-4 space-y-4">
                  <div className="rounded-xl border border-slate-700/60 bg-slate-900/70 px-3 py-4 text-sm text-slate-200">
                    We don&apos;t see any live time slots for the next two weeks.
                    <br />
                    Please pick a date that works best for you and we&apos;ll confirm the
                    closest available time by text.
                  </div>
                  <div className="flex justify-center">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={handleDateSelect}
                      disabled={(date) => {
                        return (
                          isBefore(date, new Date()) ||
                          date.getDay() === 0
                        );
                      }}
                      className="rounded-md border border-blue-400/30 p-2 bg-gray-800/40"
                      data-testid="calendar-fallback"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-blue-100 text-sm">Preferred time window (optional)</Label>
                    <Select value={preferredTimeWindow} onValueChange={setPreferredTimeWindow}>
                      <SelectTrigger className="w-full border-blue-400/30 bg-gray-800/40 text-blue-100">
                        <SelectValue placeholder="Select a time window..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="morning">Morning (9am - 12pm)</SelectItem>
                        <SelectItem value="afternoon">Afternoon (12pm - 4pm)</SelectItem>
                        <SelectItem value="anytime">Anytime works</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedDate && (
                    <div className="flex justify-end">
                      <Button
                        onClick={() => setStep("details")}
                        className={`${GRADIENT_BUTTON} shadow-lg shadow-blue-500/30 transition-all hover:scale-105`}
                        data-testid="button-skip-to-details"
                      >
                        Continue with {format(selectedDate, 'MMM d')} {preferredTimeWindow ? `(${preferredTimeWindow})` : ''}
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-4 flex justify-center">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={handleDateSelect}
                    disabled={(date) => {
                      return (
                        isBefore(date, new Date()) ||
                        isWeekend(date) ||
                        !availableDates.some(availableDate =>
                          isSameDay(availableDate, date)
                        )
                      );
                    }}
                    className="rounded-md border border-blue-400/30 p-2 bg-gray-800/40"
                    data-testid="calendar-available"
                  />
                </div>
              )}
            </div>
          </motion.div>
        )}

        {step === "time" && (
          <motion.div
            key="time"
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={stepTransition}
            className="space-y-4"
          >
            <div className={`${GLASS_CARD} rounded-xl p-6`}>
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className={`text-lg font-semibold ${GRADIENT_TEXT}`}>
                    <Clock className="w-5 h-5 inline mr-2" />
                    Select Your Time
                  </h3>
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
                <div className="py-8 text-center">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full mx-auto"
                  />
                  <p className="text-blue-200/70 mt-4">Loading available times...</p>
                </div>
              ) : getTimeSlotsForSelectedDate().length > 0 ? (
                <div className="grid gap-3 max-h-[400px] overflow-y-auto pr-2">
                  {getTimeSlotsForSelectedDate().map((slot, index) => (
                    <motion.div
                      key={slot}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      whileHover={{ scale: 1.01, x: 4 }}
                      whileTap={{ scale: 0.99 }}
                    >
                      <Button
                        variant="outline"
                        className="w-full justify-start h-auto py-3 px-4 text-left border-blue-400/30 text-blue-100 hover:bg-blue-500/20 hover:border-blue-400"
                        onClick={() => handleTimeSelect(slot)}
                      >
                        <Clock className="w-4 h-4 mr-3 text-blue-400" />
                        {formatTimeSlot(slot)}
                      </Button>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <p className="text-blue-200/70">No available times found for {selectedService?.name}.</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {step === "details" && (
          <motion.div
            key="details"
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={stepTransition}
            className="space-y-4"
          >
            <form onSubmit={handleSubmit} className={`${GLASS_CARD} rounded-xl p-6 space-y-4`}>
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className={`text-lg font-semibold ${GRADIENT_TEXT}`}>
                    <CheckCircle2 className="w-5 h-5 inline mr-2" />
                    Confirm & Book
                  </h3>
                  <p className="text-sm text-blue-200/60 mt-1">
                    Final details to complete your booking
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
              <div className="relative">
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
                {isCheckingPhone && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-blue-400" />
                )}
                {returningCustomerData?.isReturning && !isCheckingPhone && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                  >
                    <Badge className="bg-green-500/20 text-green-300 border-green-500/30 text-xs">
                      <Check className="w-3 h-3 mr-1" />
                      Returning
                    </Badge>
                  </motion.div>
                )}
              </div>
            </div>

            {/* Book Again Panel */}
            {returningCustomerData?.isReturning && returningCustomerData.pastAppointments?.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-4"
              >
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-blue-100 font-semibold flex items-center gap-2 text-sm">
                      <History className="w-4 h-4" />
                      Book Again
                    </h3>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowBookAgain(!showBookAgain)}
                      className="text-blue-300 hover:text-blue-200 h-auto py-1 text-xs"
                      data-testid="button-toggle-book-again"
                    >
                      {showBookAgain ? 'Hide' : 'Show'} ({returningCustomerData.pastAppointments.length})
                    </Button>
                  </div>
                  
                  {showBookAgain && (
                    <div className="space-y-2">
                      {returningCustomerData.pastAppointments.map((appt: any) => (
                        <motion.button
                          key={appt.id}
                          type="button"
                          onClick={() => prefillFromPastAppointment(appt)}
                          className="w-full text-left bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg p-3 transition-all group"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          data-testid={`button-book-again-${appt.id}`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-blue-100 font-medium text-sm">{appt.service?.name || 'Service'}</p>
                              <p className="text-xs text-gray-400">
                                {appt.vehicleYear} {appt.vehicleMake} {appt.vehicleModel}
                              </p>
                              <p className="text-xs text-gray-500">
                                {format(new Date(appt.scheduledTime), 'MMM d, yyyy')}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className="bg-blue-500/20 text-blue-300 text-xs">
                                {appt.service?.priceRange || 'Contact'}
                              </Badge>
                              <RefreshCw className="w-4 h-4 text-blue-400 group-hover:rotate-180 transition-transform duration-300" />
                            </div>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

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
            
            {/* Loyalty Redemption Journey v2 - Pending Reward Display */}
            {pendingReward && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-xl p-4 border ${
                  rewardValidationStatus?.isValidating
                    ? "bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border-blue-500/40"
                    : rewardValidationStatus?.canRedeem 
                      ? "bg-gradient-to-r from-green-600/20 to-emerald-600/20 border-green-500/40" 
                      : "bg-gradient-to-r from-purple-600/20 to-pink-600/20 border-purple-500/40"
                }`}
                data-testid="pending-reward-display"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                      rewardValidationStatus?.isValidating
                        ? "bg-gradient-to-br from-blue-500 to-indigo-500"
                        : rewardValidationStatus?.canRedeem 
                          ? "bg-gradient-to-br from-green-500 to-emerald-500" 
                          : "bg-gradient-to-br from-purple-500 to-pink-500"
                    }`}>
                      {rewardValidationStatus?.isValidating ? (
                        <Loader2 className="w-5 h-5 text-white animate-spin" />
                      ) : rewardValidationStatus?.canRedeem ? (
                        <CheckCircle2 className="w-5 h-5 text-white" />
                      ) : (
                        <Award className="w-5 h-5 text-white" />
                      )}
                    </div>
                    <div>
                      <p className={`font-semibold flex items-center gap-2 ${
                        rewardValidationStatus?.isValidating
                          ? "text-blue-100"
                          : rewardValidationStatus?.canRedeem 
                            ? "text-green-100" 
                            : "text-purple-100"
                      }`}>
                        {rewardValidationStatus?.isValidating ? (
                          <>
                            <Loader2 className="w-4 h-4 text-blue-300 animate-spin" />
                            Checking Eligibility...
                          </>
                        ) : rewardValidationStatus?.canRedeem ? (
                          <>
                            <Check className="w-4 h-4 text-green-300" />
                            Ready to Apply
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 text-purple-300" />
                            Reward Pending
                          </>
                        )}
                      </p>
                      <p className={`text-sm ${
                        rewardValidationStatus?.isValidating
                          ? "text-blue-200/80"
                          : rewardValidationStatus?.canRedeem 
                            ? "text-green-200/80" 
                            : "text-purple-200/80"
                      }`}>
                        {pendingReward.name}
                      </p>
                    </div>
                  </div>
                  <Badge className={
                    rewardValidationStatus?.isValidating
                      ? "bg-blue-500/20 text-blue-200 border-blue-500/30"
                      : rewardValidationStatus?.canRedeem 
                        ? "bg-green-500/20 text-green-200 border-green-500/30" 
                        : "bg-purple-500/20 text-purple-200 border-purple-500/30"
                  }>
                    {pendingReward.points.toLocaleString()} pts
                  </Badge>
                </div>
                
                {rewardValidationStatus?.isValidating ? (
                  <p className="mt-3 text-xs text-blue-300/70 pl-13">
                    Verifying your reward eligibility...
                  </p>
                ) : rewardValidationStatus?.canRedeem ? (
                  <p className="mt-3 text-xs text-green-300/70 pl-13">
                    Your reward will be applied when you complete this booking. Points will be deducted automatically.
                  </p>
                ) : (
                  <p className="mt-3 text-xs text-purple-300/70 pl-13">
                    Your points will be deducted when you complete this booking. Make sure to book a qualifying service!
                  </p>
                )}
                
                {rewardValidationStatus && !rewardValidationStatus.isValidating && !rewardValidationStatus.canRedeem && rewardValidationStatus.reason && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg"
                  >
                    <p className="text-sm text-amber-200 flex items-start gap-2">
                      <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{rewardValidationStatus.reason}</span>
                    </p>
                    <p className="text-xs text-amber-300/60 mt-1 pl-6">
                      Your points are still saved - just adjust your selection to qualify.
                    </p>
                  </motion.div>
                )}
              </motion.div>
            )}

            <div className="space-y-3">
              <p className="text-blue-300 text-sm">
                We will never share your information with anyone for any reason.
              </p>

              <SMSConsentCheckbox
                checked={smsConsent}
                onCheckedChange={setSmsConsent}
                required={true}
                id="sms-consent-booking"
              />
            </div>

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

            {/* Recurring Service Setup */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
              <h3 className="text-blue-100 font-semibold mb-3 flex items-center gap-2 text-sm">
                <CalendarIcon className="w-4 h-4" />
                Set Up Recurring Service
              </h3>
              
              <div className="flex items-center justify-between space-y-0 mb-3">
                <div>
                  <Label className="text-blue-100 text-sm">Enable Automatic Reminders</Label>
                  <p className="text-xs text-gray-400 mt-1">
                    Get reminded when it's time for your next detail
                  </p>
                </div>
                <Switch
                  checked={setupRecurring}
                  onCheckedChange={setSetupRecurring}
                  data-testid="switch-recurring"
                />
              </div>
              
              {setupRecurring && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  transition={{ duration: 0.3 }}
                  className="mt-3"
                >
                  <Label className="text-blue-100 text-sm mb-2 block">Reminder Frequency</Label>
                  <Select value={recurringInterval} onValueChange={(value: any) => setRecurringInterval(value)}>
                    <SelectTrigger className="bg-gray-700/30 border-blue-400/30 text-blue-100" data-testid="select-recurring-interval">
                      <SelectValue placeholder="Choose frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3months">Every 3 months</SelectItem>
                      <SelectItem value="6months">Every 6 months</SelectItem>
                      <SelectItem value="12months">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-400 mt-2">
                    We'll send you a reminder when it's time to book your next service
                  </p>
                </motion.div>
              )}
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

              <div className="pt-6 pb-2 border-t border-blue-400/10">
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    type="submit"
                    className={`w-full ${GRADIENT_BUTTON} text-white font-semibold shadow-lg shadow-blue-500/30 transition-all`}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          className="w-4 h-4 border-2 border-white border-t-transparent rounded-full inline-block mr-2"
                        />
                        Booking...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 inline mr-2" />
                        Confirm Appointment
                      </>
                    )}
                  </Button>
                </motion.div>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}