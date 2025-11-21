import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import BackNavigation from "@/components/BackNavigation";
import { Loader2, Search, CheckCircle2, Phone, Mail, MapPin, Car, Award, Calendar as CalendarIcon, Clock, Plus, ArrowLeft, Gift } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { SMSConsentCheckbox } from "@/components/SMSConsentCheckbox";

interface ReferralReward {
  type: string;
  amount: number;
  description: string;
  expiryDays?: number;
  notes?: string;
}

interface Service {
  name: string;
  priceRange: string;
  description: string;
  duration: string;
  durationHours: number;
}

interface CustomerData {
  found: boolean;
  name: string;
  phone: string;
  email: string;
  address: string;
  loyaltyPoints: number;
  lastAppointment: {
    id: number;
    service: string;
    serviceId: number;
    scheduledTime: string;
    address: string;
    addOns: string[];
    additionalRequests: string;
  } | null;
  vehicleInfo: string;
}

interface VehicleInfo {
  make: string;
  model: string;
  year: string;
  color?: string;
}

export default function QuickBookingPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Step state: 'lookup', 'confirmation', 'datetime', 'success'
  const [step, setStep] = useState<'lookup' | 'confirmation' | 'datetime' | 'success'>('lookup');

  // Lookup state
  const [contact, setContact] = useState("");
  const [isLookingUp, setIsLookingUp] = useState(false);

  // Customer data state
  const [customerData, setCustomerData] = useState<CustomerData | null>(null);

  // Confirmation state
  const [confirmedInfo, setConfirmedInfo] = useState({
    name: true,
    phone: true,
    email: true,
    address: true,
  });
  const [confirmedVehicles, setConfirmedVehicles] = useState<boolean[]>([]);
  const [vehicles, setVehicles] = useState<VehicleInfo[]>([]);
  const [bookUsual, setBookUsual] = useState(true);
  const [selectedServiceName, setSelectedServiceName] = useState("");

  // DateTime state
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState("");
  const [availableDates, setAvailableDates] = useState<Date[]>([]);
  const [dailyTimeSlots, setDailyTimeSlots] = useState<Record<string, string[]>>({});
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);

  // Booking state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [smsConsent, setSmsConsent] = useState(false);

  // Referral code state
  const [referralCode, setReferralCode] = useState("");
  const [referralValid, setReferralValid] = useState<boolean | null>(null);
  const [referralReward, setReferralReward] = useState<ReferralReward | null>(null);
  const [isValidatingReferral, setIsValidatingReferral] = useState(false);
  const referralCacheRef = useRef<Record<string, { isValid: boolean; reward?: ReferralReward; error?: string }>>({});

  // Fetch services for service selection dropdown
  const { data: servicesData } = useQuery<{ success: boolean; services: Service[] }>({
    queryKey: ['/api/services'],
  });

  const services = servicesData?.services || [];

  // Parse referral code from URL on mount and validate once
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const refCode = params.get('ref');
    if (refCode) {
      const normalized = refCode.toUpperCase();
      setReferralCode(normalized);
      validateReferralCode(normalized);
    }
  }, []);

  // Handle quote-to-booking workflow (auto-fill from approved quote)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const quoteToken = params.get('quote');
    
    if (quoteToken) {
      // Fetch booking data from quote approval
      const loadQuoteData = async () => {
        try {
          const response = await fetch(`/api/quote-approval/booking-data/${quoteToken}`);
          const data = await response.json();
          
          if (!data.success || !data.data) {
            // Token expired, used, or invalid - clear state and show error
            toast({
              title: "Booking Link Issue",
              description: data.error || "This booking link is no longer valid. Please contact us to schedule.",
              variant: "destructive",
            });
            // Reset to lookup step so user can manually enter contact info
            setStep('lookup');
            setContact('');
            setCustomerData(null);
            return;
          }
          
          const quoteData = data.data;
          
          // Auto-fill customer data
          setCustomerData({
            found: true,
            name: quoteData.customerName,
            phone: quoteData.phone,
            email: quoteData.email || '',
            address: '', // Quote doesn't have address
            loyaltyPoints: 0,
            lastAppointment: null,
            vehicleInfo: '',
          });
          
          setContact(quoteData.phone);
          
          // Set service name to damage type (specialty job)
          setSelectedServiceName(quoteData.damageType);
          setBookUsual(false); // Not booking usual service
          
          // Initialize vehicles array
          setVehicles([{ make: "", model: "", year: "" }]);
          setConfirmedVehicles([true]);
          
          // Skip to confirmation step
          setStep('confirmation');
          
          toast({
            title: "Quote Data Loaded",
            description: `Ready to schedule your ${quoteData.damageType} service`,
          });
        } catch (error) {
          console.error('Error loading quote data:', error);
          toast({
            title: "Error Loading Quote",
            description: "Could not load quote data. Please try again or contact us.",
            variant: "destructive",
          });
        }
      };
      
      loadQuoteData();
    }
  }, []);

  // Validate referral code (matches Schedule.tsx pattern)
  const validateReferralCode = async (code: string) => {
    const normalizedCode = code.trim().toUpperCase();
    
    if (!normalizedCode) {
      setReferralValid(null);
      setReferralReward(null);
      return;
    }

    // Check cache first
    if (referralCacheRef.current[normalizedCode]) {
      const cached = referralCacheRef.current[normalizedCode];
      setReferralValid(cached.isValid);
      setReferralReward(cached.reward || null);
      return;
    }

    setIsValidatingReferral(true);
    setReferralValid(null);
    setReferralReward(null);

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
      
      setReferralValid(result.isValid);
      setReferralReward(result.reward || null);
    } catch (error) {
      console.error('Referral validation error:', error);
      toast({
        title: "Network Error",
        description: "Could not validate referral code. Please try again.",
        variant: "destructive",
      });
      // Don't cache network errors - allow retry
    } finally {
      setIsValidatingReferral(false);
    }
  };

  // Handle customer lookup
  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!contact.trim()) {
      toast({
        title: "Error",
        description: "Please enter a phone number or email address",
        variant: "destructive",
      });
      return;
    }

    setIsLookingUp(true);

    try {
      const response = await fetch(`/api/quick-booking/lookup?contact=${encodeURIComponent(contact)}`);
      const data = await response.json();

      if (data.success && data.customer) {
        setCustomerData(data.customer);

        // Parse vehicle info if available
        let parsedVehicles: VehicleInfo[] = [];
        if (data.customer.vehicleInfo) {
          try {
            const vehicleData = typeof data.customer.vehicleInfo === 'string' 
              ? JSON.parse(data.customer.vehicleInfo) 
              : data.customer.vehicleInfo;
            parsedVehicles = Array.isArray(vehicleData) ? vehicleData : [vehicleData];
          } catch (e) {
            console.error("Error parsing vehicle info:", e);
          }
        }
        setVehicles(parsedVehicles.length > 0 ? parsedVehicles : [{ make: "", model: "", year: "" }]);
        setConfirmedVehicles(parsedVehicles.map(() => true));

        // Pre-select last service if available
        if (data.customer.lastAppointment?.service) {
          setSelectedServiceName(data.customer.lastAppointment.service);
          setBookUsual(true);
        }

        setStep('confirmation');
        
        toast({
          title: "Customer Found!",
          description: `Welcome back, ${data.customer.name}!`,
        });
      } else {
        // Customer not found
        toast({
          title: "Not Found",
          description: "No booking history found. Would you like to book as a new customer?",
        });
        
        // Redirect to regular schedule page after a delay
        setTimeout(() => {
          setLocation("/schedule");
        }, 2000);
      }
    } catch (error) {
      console.error("Lookup error:", error);
      toast({
        title: "Error",
        description: "Failed to lookup customer. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLookingUp(false);
    }
  };

  // Fetch available time slots
  const fetchAvailableSlots = async (serviceName: string) => {
    setIsLoadingSlots(true);
    try {
      const response = await fetch(`/api/available-slots?service=${encodeURIComponent(serviceName)}`);
      const data = await response.json();

      if (data.success && data.slots && Array.isArray(data.slots)) {
        const allSlots: string[] = data.slots;

        // Group slots by date
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

        setAvailableDates(availableDatesList);
        setDailyTimeSlots(timeSlotsByDay);
      } else {
        setAvailableDates([]);
        setDailyTimeSlots({});
        toast({
          title: "No Slots Available",
          description: "No time slots available. Please contact us directly.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error fetching time slots:", error);
      toast({
        title: "Error",
        description: "Failed to load available time slots.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingSlots(false);
    }
  };

  // Handle confirmation and move to datetime
  const handleConfirmation = () => {
    // Determine which service to book
    const serviceToBook = bookUsual && customerData?.lastAppointment?.service
      ? customerData.lastAppointment.service
      : selectedServiceName;

    if (!serviceToBook) {
      toast({
        title: "Error",
        description: "Please select a service",
        variant: "destructive",
      });
      return;
    }

    // Validate at least one vehicle is confirmed
    if (!confirmedVehicles.some(v => v)) {
      toast({
        title: "Error",
        description: "Please confirm at least one vehicle",
        variant: "destructive",
      });
      return;
    }

    // Update selected service
    setSelectedServiceName(serviceToBook);

    // Fetch available slots
    fetchAvailableSlots(serviceToBook);

    setStep('datetime');
  };

  // Handle date selection
  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    setSelectedTime("");
  };

  // Get time slots for selected date
  const getTimeSlotsForSelectedDate = (): string[] => {
    if (!selectedDate) return [];
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    return dailyTimeSlots[dateKey] || [];
  };

  // Add a new vehicle
  const addVehicle = () => {
    setVehicles(prev => [...prev, { make: "", model: "", year: "" }]);
    setConfirmedVehicles(prev => [...prev, false]);
  };

  // Update vehicle
  const updateVehicle = (index: number, field: keyof VehicleInfo, value: string) => {
    setVehicles(prev => {
      const newVehicles = [...prev];
      newVehicles[index] = { ...newVehicles[index], [field]: value };
      return newVehicles;
    });
  };

  // Toggle vehicle confirmation
  const toggleVehicleConfirmation = (index: number) => {
    setConfirmedVehicles(prev => {
      const newConfirmed = [...prev];
      newConfirmed[index] = !newConfirmed[index];
      return newConfirmed;
    });
  };

  // Handle final booking submission
  const handleSubmit = async () => {
    if (!customerData || !selectedServiceName || !selectedTime) {
      toast({
        title: "Error",
        description: "Please complete all required fields",
        variant: "destructive",
      });
      return;
    }

    // Get confirmed vehicles
    const confirmedVehiclesList = vehicles.filter((_, index) => confirmedVehicles[index]);

    if (confirmedVehiclesList.length === 0) {
      toast({
        title: "Error",
        description: "Please confirm at least one vehicle",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Find service ID
      const selectedService = services.find(s => s.name === selectedServiceName);
      const serviceId = selectedService ? services.indexOf(selectedService) + 1 : 1;

      const response = await apiRequest('POST', '/api/quick-booking/submit', {
        name: customerData.name,
        phone: customerData.phone,
        email: customerData.email,
        address: customerData.address,
        service: selectedServiceName,
        serviceId,
        addOns: customerData.lastAppointment?.addOns || [],
        vehicles: confirmedVehiclesList,
        scheduledTime: selectedTime,
        notes: "",
        smsConsent,
        referralCode: referralValid ? referralCode : undefined,
      });

      const data = await response.json();

      if (data.success) {
        setStep('success');
        toast({
          title: "Success!",
          description: "Your appointment has been booked!",
        });

        // Redirect to home after 3 seconds
        setTimeout(() => {
          setLocation("/");
        }, 3000);
      } else {
        throw new Error(data.message || "Failed to book appointment");
      }
    } catch (error) {
      console.error("Booking error:", error);
      toast({
        title: "Error",
        description: "Failed to book appointment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-blue-950/10 to-black text-white overflow-hidden relative">
      {/* Premium background elements */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div className="absolute top-[10%] left-[15%] w-96 h-96 bg-blue-500/5 rounded-full filter blur-3xl"></div>
        <div className="absolute bottom-[20%] right-[10%] w-80 h-80 bg-blue-600/5 rounded-full filter blur-3xl"></div>
      </div>

      <div className="container mx-auto py-12 px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="w-full max-w-4xl mx-auto"
        >
          {/* Glass-morphism container */}
          <div className="bg-gray-900/40 backdrop-blur-xl border border-blue-500/20 rounded-2xl shadow-2xl shadow-blue-500/10 overflow-hidden">
            {/* Header */}
            <div className="p-8 pb-4 text-center relative">
              <div className="absolute left-4 top-4">
                <BackNavigation 
                  fallbackPath="/" 
                  variant="ghost"
                  className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                />
              </div>
              <motion.h1
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="text-3xl md:text-4xl font-bold mb-3 bg-clip-text text-transparent bg-gradient-to-r from-blue-200 via-blue-400 to-blue-200"
              >
                Quick Booking
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="text-blue-100/70 text-sm md:text-base max-w-2xl mx-auto"
              >
                Fast booking for returning customers
              </motion.p>
            </div>

            {/* Content */}
            <div className="px-6 pb-6">
              <AnimatePresence mode="wait">
                {/* Step 1: Lookup */}
                {step === 'lookup' && (
                  <motion.div
                    key="lookup"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Card className="bg-gray-800/50 border-blue-500/30">
                      <CardHeader>
                        <CardTitle className="text-blue-100 flex items-center gap-2">
                          <Search className="w-5 h-5" />
                          Find Your Account
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <form onSubmit={handleLookup} className="space-y-6">
                          <div className="space-y-2">
                            <Label htmlFor="contact" className="text-blue-100">
                              Phone Number or Email
                            </Label>
                            <Input
                              id="contact"
                              data-testid="input-contact"
                              type="text"
                              placeholder="Enter phone or email"
                              value={contact}
                              onChange={(e) => setContact(e.target.value)}
                              className="bg-gray-900/50 border-blue-500/30 text-white placeholder:text-gray-500"
                              disabled={isLookingUp}
                            />
                          </div>

                          <Button
                            type="submit"
                            data-testid="button-lookup"
                            className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400"
                            disabled={isLookingUp}
                          >
                            {isLookingUp ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Looking up...
                              </>
                            ) : (
                              <>
                                <Search className="mr-2 h-4 w-4" />
                                Find My Account
                              </>
                            )}
                          </Button>

                          <div className="text-center pt-4">
                            <Button
                              type="button"
                              variant="link"
                              data-testid="link-new-customer"
                              onClick={() => setLocation("/schedule")}
                              className="text-blue-400 hover:text-blue-300"
                            >
                              New customer? Book here
                            </Button>
                          </div>
                        </form>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}

                {/* Step 2: Confirmation */}
                {step === 'confirmation' && customerData && (
                  <motion.div
                    key="confirmation"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-6"
                  >
                    {/* Loyalty Points Badge */}
                    {customerData.loyaltyPoints > 0 && (
                      <Card className="bg-gradient-to-r from-amber-900/20 to-yellow-900/20 border-amber-500/30">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Award className="w-8 h-8 text-amber-400" />
                              <div>
                                <p className="text-sm text-amber-200/70">Loyalty Points</p>
                                <p className="text-2xl font-bold text-amber-400" data-testid="text-loyalty-points">
                                  {customerData.loyaltyPoints}
                                </p>
                              </div>
                            </div>
                            <Badge variant="secondary" className="bg-amber-500/20 text-amber-300">
                              VIP Customer
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Customer Information */}
                    <Card className="bg-gray-800/50 border-blue-500/30">
                      <CardHeader>
                        <CardTitle className="text-blue-100">Confirm Your Information</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            id="confirm-name"
                            data-testid="checkbox-name"
                            checked={confirmedInfo.name}
                            onCheckedChange={(checked) =>
                              setConfirmedInfo({ ...confirmedInfo, name: checked as boolean })
                            }
                            className="border-blue-400"
                          />
                          <div className="flex-1">
                            <Label htmlFor="confirm-name" className="text-blue-100 cursor-pointer">
                              <span className="text-sm text-blue-300/70">Name</span>
                              <p className="font-medium" data-testid="text-customer-name">{customerData.name}</p>
                            </Label>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <Checkbox
                            id="confirm-phone"
                            data-testid="checkbox-phone"
                            checked={confirmedInfo.phone}
                            onCheckedChange={(checked) =>
                              setConfirmedInfo({ ...confirmedInfo, phone: checked as boolean })
                            }
                            className="border-blue-400"
                          />
                          <div className="flex-1">
                            <Label htmlFor="confirm-phone" className="text-blue-100 cursor-pointer flex items-center gap-2">
                              <Phone className="w-4 h-4 text-blue-400" />
                              <div>
                                <span className="text-sm text-blue-300/70">Phone</span>
                                <p className="font-medium" data-testid="text-customer-phone">{customerData.phone}</p>
                              </div>
                            </Label>
                          </div>
                        </div>

                        {customerData.email && (
                          <div className="flex items-center gap-3">
                            <Checkbox
                              id="confirm-email"
                              data-testid="checkbox-email"
                              checked={confirmedInfo.email}
                              onCheckedChange={(checked) =>
                                setConfirmedInfo({ ...confirmedInfo, email: checked as boolean })
                              }
                              className="border-blue-400"
                            />
                            <div className="flex-1">
                              <Label htmlFor="confirm-email" className="text-blue-100 cursor-pointer flex items-center gap-2">
                                <Mail className="w-4 h-4 text-blue-400" />
                                <div>
                                  <span className="text-sm text-blue-300/70">Email</span>
                                  <p className="font-medium" data-testid="text-customer-email">{customerData.email}</p>
                                </div>
                              </Label>
                            </div>
                          </div>
                        )}

                        {customerData.address && (
                          <div className="flex items-center gap-3">
                            <Checkbox
                              id="confirm-address"
                              data-testid="checkbox-address"
                              checked={confirmedInfo.address}
                              onCheckedChange={(checked) =>
                                setConfirmedInfo({ ...confirmedInfo, address: checked as boolean })
                              }
                              className="border-blue-400"
                            />
                            <div className="flex-1">
                              <Label htmlFor="confirm-address" className="text-blue-100 cursor-pointer flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-blue-400" />
                                <div>
                                  <span className="text-sm text-blue-300/70">Address</span>
                                  <p className="font-medium" data-testid="text-customer-address">{customerData.address}</p>
                                </div>
                              </Label>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Vehicles */}
                    <Card className="bg-gray-800/50 border-blue-500/30">
                      <CardHeader>
                        <CardTitle className="text-blue-100 flex items-center gap-2">
                          <Car className="w-5 h-5" />
                          Your Vehicles
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {vehicles.map((vehicle, index) => (
                          <div key={index} className="flex items-start gap-3 p-4 bg-gray-900/50 rounded-lg border border-blue-500/20">
                            <Checkbox
                              id={`vehicle-${index}`}
                              data-testid={`checkbox-vehicle-${index}`}
                              checked={confirmedVehicles[index] || false}
                              onCheckedChange={() => toggleVehicleConfirmation(index)}
                              className="border-blue-400 mt-1"
                            />
                            <div className="flex-1 space-y-2">
                              <Label htmlFor={`vehicle-${index}`} className="text-blue-100 cursor-pointer">
                                Vehicle {index + 1}
                              </Label>
                              <div className="grid grid-cols-3 gap-2">
                                <Input
                                  placeholder="Make"
                                  data-testid={`input-vehicle-make-${index}`}
                                  value={vehicle.make}
                                  onChange={(e) => updateVehicle(index, 'make', e.target.value)}
                                  className="bg-gray-800/50 border-blue-500/30 text-white text-sm"
                                />
                                <Input
                                  placeholder="Model"
                                  data-testid={`input-vehicle-model-${index}`}
                                  value={vehicle.model}
                                  onChange={(e) => updateVehicle(index, 'model', e.target.value)}
                                  className="bg-gray-800/50 border-blue-500/30 text-white text-sm"
                                />
                                <Input
                                  placeholder="Year"
                                  data-testid={`input-vehicle-year-${index}`}
                                  value={vehicle.year}
                                  onChange={(e) => updateVehicle(index, 'year', e.target.value)}
                                  className="bg-gray-800/50 border-blue-500/30 text-white text-sm"
                                />
                              </div>
                            </div>
                          </div>
                        ))}

                        <Button
                          type="button"
                          variant="outline"
                          data-testid="button-add-vehicle"
                          onClick={addVehicle}
                          className="w-full border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add Another Vehicle
                        </Button>
                      </CardContent>
                    </Card>

                    {/* Service Selection */}
                    <Card className="bg-gray-800/50 border-blue-500/30">
                      <CardHeader>
                        <CardTitle className="text-blue-100">Select Service</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {customerData.lastAppointment?.service && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-3 p-4 bg-blue-900/20 rounded-lg border border-blue-500/30">
                              <Checkbox
                                id="book-usual"
                                data-testid="checkbox-book-usual"
                                checked={bookUsual}
                                onCheckedChange={(checked) => setBookUsual(checked as boolean)}
                                className="border-blue-400"
                              />
                              <Label htmlFor="book-usual" className="text-blue-100 cursor-pointer flex-1">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="font-medium">Book The Usual</p>
                                    <p className="text-sm text-blue-300/70" data-testid="text-last-service">
                                      {customerData.lastAppointment.service}
                                    </p>
                                  </div>
                                  <Badge variant="secondary" className="bg-blue-500/20 text-blue-300">
                                    Last Service
                                  </Badge>
                                </div>
                              </Label>
                            </div>
                          </div>
                        )}

                        <div className="space-y-2">
                          <Label className="text-blue-100">Or Choose Different Service</Label>
                          <Select
                            value={bookUsual ? "" : selectedServiceName}
                            onValueChange={(value) => {
                              setSelectedServiceName(value);
                              setBookUsual(false);
                            }}
                            disabled={bookUsual}
                          >
                            <SelectTrigger 
                              data-testid="select-service"
                              className="bg-gray-900/50 border-blue-500/30 text-white"
                            >
                              <SelectValue placeholder="Select a service" />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-800 border-blue-500/30">
                              {services.map((service) => (
                                <SelectItem 
                                  key={service.name} 
                                  value={service.name}
                                  data-testid={`option-service-${service.name}`}
                                >
                                  {service.name} - {service.priceRange}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Actions */}
                    <div className="flex gap-4">
                      <Button
                        variant="outline"
                        data-testid="button-back-to-lookup"
                        onClick={() => setStep('lookup')}
                        className="flex-1 border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                      >
                        Back
                      </Button>
                      <Button
                        data-testid="button-continue-to-datetime"
                        onClick={handleConfirmation}
                        className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400"
                      >
                        Continue to Date & Time
                      </Button>
                    </div>
                  </motion.div>
                )}

                {/* Step 3: Date & Time */}
                {step === 'datetime' && (
                  <motion.div
                    key="datetime"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-6"
                  >
                    {isLoadingSlots ? (
                      <Card className="bg-gray-800/50 border-blue-500/30">
                        <CardContent className="p-12">
                          <div className="flex flex-col items-center justify-center gap-4">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
                            <p className="text-blue-100">Loading available time slots...</p>
                          </div>
                        </CardContent>
                      </Card>
                    ) : (
                      <>
                        {/* Date Selection */}
                        <Card className="bg-gray-800/50 border-blue-500/30">
                          <CardHeader>
                            <CardTitle className="text-blue-100 flex items-center gap-2">
                              <CalendarIcon className="w-5 h-5" />
                              Select Date
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <Calendar
                              mode="single"
                              selected={selectedDate}
                              onSelect={handleDateSelect}
                              disabled={(date) => {
                                return !availableDates.some(
                                  (availableDate) =>
                                    format(availableDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
                                );
                              }}
                              className="rounded-md border border-blue-500/30 bg-gray-900/50"
                              data-testid="calendar-date-picker"
                            />
                          </CardContent>
                        </Card>

                        {/* Time Selection */}
                        {selectedDate && (
                          <Card className="bg-gray-800/50 border-blue-500/30">
                            <CardHeader>
                              <CardTitle className="text-blue-100 flex items-center gap-2">
                                <Clock className="w-5 h-5" />
                                Select Time
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <Select value={selectedTime} onValueChange={setSelectedTime}>
                                <SelectTrigger 
                                  data-testid="select-time"
                                  className="bg-gray-900/50 border-blue-500/30 text-white"
                                >
                                  <SelectValue placeholder="Choose a time slot" />
                                </SelectTrigger>
                                <SelectContent className="bg-gray-800 border-blue-500/30">
                                  {getTimeSlotsForSelectedDate().map((slot) => (
                                    <SelectItem 
                                      key={slot} 
                                      value={slot}
                                      data-testid={`option-time-${slot}`}
                                    >
                                      {format(parseISO(slot), "h:mm a")}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </CardContent>
                          </Card>
                        )}

                        {/* Privacy Statement & SMS Consent */}
                        {selectedTime && (
                          <Card className="bg-gray-800/50 border-blue-500/30">
                            <CardContent className="p-4 space-y-3">
                              <p className="text-blue-300 text-sm">
                                We will never share your information with anyone for any reason.
                              </p>

                              <SMSConsentCheckbox
                                checked={smsConsent}
                                onCheckedChange={setSmsConsent}
                              />
                            </CardContent>
                          </Card>
                        )}

                        {/* Referral Code */}
                        {selectedTime && (
                          <Card className="bg-gray-800/50 border-blue-500/30">
                            <CardHeader>
                              <CardTitle className="text-blue-100 flex items-center gap-2 text-base">
                                <Gift className="w-5 h-5" />
                                Referral Code (Optional)
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              <div>
                                <Input
                                  data-testid="input-referral-code"
                                  type="text"
                                  placeholder="ENTER REFERRAL CODE"
                                  value={referralCode}
                                  onChange={(e) => {
                                    const code = e.target.value.toUpperCase();
                                    setReferralCode(code);
                                    // Clear stale validation state when user edits
                                    setReferralValid(null);
                                    setReferralReward(null);
                                  }}
                                  onBlur={(e) => {
                                    const code = e.target.value.trim().toUpperCase();
                                    if (code) validateReferralCode(code);
                                  }}
                                  className="bg-gray-900/50 border-blue-500/30 text-white placeholder:text-gray-500 uppercase"
                                />
                                
                                {isValidatingReferral && (
                                  <p className="text-sm text-blue-400 mt-2 flex items-center gap-2">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    Validating code...
                                  </p>
                                )}
                                
                                {!isValidatingReferral && referralValid === false && (
                                  <p className="text-sm text-red-400 mt-2">
                                    Invalid or expired referral code
                                  </p>
                                )}
                              </div>

                              {/* Reward Preview */}
                              {!isValidatingReferral && referralValid && referralReward && (
                                <motion.div
                                  initial={{ opacity: 0, y: -10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className="bg-green-900/20 border border-green-500/30 rounded-lg p-4"
                                >
                                  <div className="flex items-start gap-3">
                                    <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                                    <div className="flex-1">
                                      <p className="text-sm font-medium text-green-100">
                                        ✓ Valid code! You'll receive:
                                      </p>
                                      <p className="text-base font-semibold text-green-300 mt-1">
                                        {referralReward.description}
                                      </p>
                                      {referralReward.expiryDays && (
                                        <p className="text-xs text-green-200/70 mt-1">
                                          Expires in {referralReward.expiryDays} days
                                        </p>
                                      )}
                                      {referralReward.notes && (
                                        <p className="text-xs text-green-200/70 mt-1">
                                          {referralReward.notes}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </CardContent>
                          </Card>
                        )}

                        {/* Actions */}
                        <div className="flex gap-4">
                          <Button
                            variant="outline"
                            data-testid="button-back-to-confirmation"
                            onClick={() => setStep('confirmation')}
                            className="flex-1 border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                          >
                            Back
                          </Button>
                          <Button
                            data-testid="button-submit-booking"
                            onClick={handleSubmit}
                            disabled={!selectedTime || !smsConsent || isSubmitting}
                            className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400"
                          >
                            {isSubmitting ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Booking...
                              </>
                            ) : (
                              'Confirm Booking'
                            )}
                          </Button>
                        </div>
                      </>
                    )}
                  </motion.div>
                )}

                {/* Step 4: Success */}
                {step === 'success' && (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                  >
                    <Card className="bg-gradient-to-br from-green-900/20 to-blue-900/20 border-green-500/30">
                      <CardContent className="p-12">
                        <div className="flex flex-col items-center justify-center gap-6 text-center">
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                          >
                            <CheckCircle2 className="w-20 h-20 text-green-400" />
                          </motion.div>
                          <div>
                            <h2 className="text-3xl font-bold text-green-100 mb-2" data-testid="text-success-title">
                              Booking Confirmed!
                            </h2>
                            <p className="text-green-200/70">
                              Your appointment has been successfully scheduled.
                            </p>
                            {selectedDate && selectedTime && (
                              <p className="text-lg text-green-100 mt-4" data-testid="text-appointment-details">
                                {format(selectedDate, "EEEE, MMMM d, yyyy")} at {format(parseISO(selectedTime), "h:mm a")}
                              </p>
                            )}
                          </div>
                          <p className="text-sm text-green-300/70">
                            Redirecting to home page...
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
