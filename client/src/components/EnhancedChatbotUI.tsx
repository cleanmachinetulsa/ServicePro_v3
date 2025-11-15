import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { CarIcon, PaperclipIcon, PaperPlaneIcon, UserIcon, XIcon } from "@/components/ui/icons";
import { Download, HelpCircle } from "lucide-react";
import { useLocation } from "wouter";
import logoUrl from '@assets/generated_images/Clean_Machine_hexagonal_shield_logo_46864b38.png';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import MultiVehicleAppointmentScheduler from "./MultiVehicleAppointmentScheduler";

interface Message {
  id: string;
  text: string;
  sender: "user" | "bot";
  timestamp: Date;
  mediaUrl?: string;
  mediaType?: string;
  isUploading?: boolean;
  actionButton?: {
    text: string;
    action: () => void;
  };
}

const suggestionChips: string[] = [];

// Animation variants for messages
const messageVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  exit: { opacity: 0, transition: { duration: 0.2 } }
};

// Animation variants for typing indicator
const typingVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 10 }
};

// Dot animation variants for typing indicator
const dotVariants = {
  initial: { y: 0 },
  animate: (i: number) => ({
    y: [0, -5, 0],
    transition: {
      duration: 0.6,
      repeat: Infinity,
      delay: i * 0.1
    }
  })
};

export default function EnhancedChatbotUI() {
  // Get location to parse URL parameters
  const [location] = useLocation();

  // Initialize messages from localStorage if available
  const [messages, setMessages] = useState<Message[]>(() => {
    // Clear cached messages to ensure the new welcome message is shown
    localStorage.removeItem('chatMessages');

    // Try to load messages from localStorage
    const savedMessages = localStorage.getItem('chatMessages');

    if (savedMessages) {
      try {
        // Parse saved messages and convert string timestamps back to Date objects
        const parsedMessages = JSON.parse(savedMessages, (key, value) => {
          // Convert timestamp strings back to Date objects
          if (key === 'timestamp' && value) {
            return new Date(value);
          }
          return value;
        });

        return parsedMessages;
      } catch (e) {
        console.error('Failed to parse saved messages:', e);
      }
    }

    // Default welcome message if no saved messages
    return [{
      id: "welcome",
      text: "Hey, I'm the Clean Machine Assistant! Want to check our services, book an appointment, or ask a question? I can handle it all right here.",
      sender: "bot",
      timestamp: new Date(),
    }];
  });

  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [mediaUrl, setMediaUrl] = useState("");
  const [showMediaDialog, setShowMediaDialog] = useState(false);
  const [showSchedulerDialog, setShowSchedulerDialog] = useState(false);
  const [selectedService, setSelectedService] = useState<string>("");
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [hasNewMessage, setHasNewMessage] = useState(false); // For auto-scroll
  const [smsConsentShown, setSmsConsentShown] = useState(false); // Track if SMS consent shown
  const [isMinimized, setIsMinimized] = useState(false); // Track if chat is minimized

  // Parse URL parameters to check if we should auto-open the scheduler
  useEffect(() => {
    const url = new URL(window.location.href);
    const service = url.searchParams.get('service');
    const action = url.searchParams.get('action');

    if (service && action === 'schedule') {
      // Set the selected service and open the scheduler dialog
      setSelectedService(service);

      // Add a slight delay to ensure component is fully mounted
      setTimeout(() => {
        // Add a specific message for the selected service
        const serviceMessage: Message = {
          id: Math.random().toString(36).substring(2, 9),
          text: `I'd like to book a ${service} service.`,
          sender: "user",
          timestamp: new Date(),
        };

        setMessages(prev => [...prev, serviceMessage]);

        // Show response and then open scheduler
        setIsTyping(true);
        setTimeout(() => {
          setIsTyping(false);
          const responseMessage: Message = {
            id: Math.random().toString(36).substring(2, 9),
            text: `Great choice! I'd be happy to help you schedule a ${service}. Let's get your appointment set up right away.`,
            sender: "bot",
            timestamp: new Date(),
          };

          setMessages(prev => [...prev, responseMessage]);
          setHasNewMessage(true);

          // Open scheduler after a short delay
          setTimeout(() => {
            setShowSchedulerDialog(true);
          }, 1000);
        }, 1500);
      }, 300);
    }
  }, []);

  const [isUploading, setIsUploading] = useState(false);
  const [customerName, setCustomerName] = useState(() => localStorage.getItem('customerName') || "");
  const [customerPhone, setCustomerPhone] = useState(() => localStorage.getItem('customerPhone') || "");
  const [customerEmail, setCustomerEmail] = useState(() => localStorage.getItem('customerEmail') || "");
  const [vehicleInfo, setVehicleInfo] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadMethod, setUploadMethod] = useState<'url' | 'file'>('file');

  const messageEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Save messages to localStorage when they change
  useEffect(() => {
    try {
      localStorage.setItem('chatMessages', JSON.stringify(messages));
    } catch (e) {
      console.error('Failed to save messages to localStorage:', e);
    }
  }, [messages]);

  // Save customer info to localStorage
  useEffect(() => {
    if (customerName) localStorage.setItem('customerName', customerName);
    if (customerPhone) localStorage.setItem('customerPhone', customerPhone);
    if (customerEmail) localStorage.setItem('customerEmail', customerEmail);
  }, [customerName, customerPhone, customerEmail]);

  // Auto-scroll when messages change or typing status changes
  useEffect(() => {
    if (hasNewMessage || isTyping) {
      messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
      setHasNewMessage(false);
    }
  }, [messages, isTyping, hasNewMessage]);

  // Focus on input field when component mounts
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Handle demo mode toggle
  useEffect(() => {
    if (isDemoMode) {
      toast({
        title: "Demo Mode Enabled",
        description: "The chat is now in demo mode. No actual service requests will be made.",
      });
    }
  }, [isDemoMode, toast]);

  // Handle minimize
  const handleMinimize = () => {
    setIsMinimized(true);
  };

  // Clear chat history
  const clearChatHistory = () => {
    const welcomeMessage: Message = {
      id: "welcome",
      text: "👋 Hi there! I'm your Clean Machine Auto Detail assistant. How can I help you today?",
      sender: "bot",
      timestamp: new Date(),
    };

    setMessages([welcomeMessage]);
    toast({
      title: "Chat Cleared",
      description: "Your conversation history has been cleared",
    });
  };

  // File upload handling
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleMediaUpload = async () => {
    // Validate required fields
    const errors = [];

    if (uploadMethod === 'url' && !mediaUrl.trim()) {
      errors.push("Please enter a valid media URL");
    }

    if (uploadMethod === 'file' && !selectedFile) {
      errors.push("Please select a file to upload");
    }

    if (!customerName.trim()) {
      errors.push("Please enter your name");
    }

    if (!customerPhone.trim() && !customerEmail.trim()) {
      errors.push("Please provide either a phone number or email address");
    }

    if (!vehicleInfo.trim()) {
      errors.push("Please enter your vehicle information");
    }

    if (errors.length > 0) {
      toast({
        title: "Missing Required Information",
        description: errors[0], // Show first error
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    // Create a temporary message to show upload status
    const tempMessage: Message = {
      id: Math.random().toString(36).substring(2, 9),
      text: `Uploading ${uploadMethod === 'url' ? 'media from URL' : selectedFile?.name || 'file'}...`,
      sender: "user",
      timestamp: new Date(),
      isUploading: true,
    };

    setMessages(prev => [...prev, tempMessage]);
    setHasNewMessage(true);

    try {
      let response;

      if (uploadMethod === 'file' && selectedFile) {
        const formData = new FormData();
        formData.append('photo', selectedFile);
        formData.append('customerName', customerName);
        formData.append('customerPhone', customerPhone);
        formData.append('customerEmail', customerEmail);
        formData.append('vehicleInfo', vehicleInfo);

        console.log('Uploading file with data:', {
          name: customerName,
          phone: customerPhone ? 'provided' : 'not provided',
          email: customerEmail ? 'provided' : 'not provided',
          vehicle: vehicleInfo,
          file: selectedFile.name,
          fileSize: selectedFile.size,
        });

        response = await fetch('/api/upload-photo', {
          method: 'POST',
          body: formData,
        });
      } else {
        // URL upload
        const requestBody = {
          photoUrl: mediaUrl,
          customerName,
          phoneNumber: customerPhone,
          customerEmail,
          vehicleInfo,
        };

        console.log('Uploading URL with data:', requestBody);

        response = await fetch('/api/process-photo', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });
      }

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }

      const data = await response.json();
      console.log('Upload response:', data);

      // Replace temp message with success message
      setMessages(prev =>
        prev.map(msg =>
          msg.id === tempMessage.id ? {
            ...msg,
            text: uploadMethod === 'file' ?
                  `I've uploaded an image of my vehicle${vehicleInfo ? ` (${vehicleInfo})` : ''}.` :
                  `I've shared an image URL of my vehicle${vehicleInfo ? ` (${vehicleInfo})` : ''}.`,
            isUploading: false,
            mediaUrl: data.fileLink || data.url,
            mediaType: selectedFile?.type || 'image/jpeg'
          } : msg
        )
      );
      setHasNewMessage(true);

      // Clear form after successful upload
      setShowMediaDialog(false);
      setMediaUrl('');
      setSelectedFile(null);
      setVehicleInfo('');
      setCustomerEmail('');
      // Don't clear customer name and phone after successful upload
      // so they don't have to re-enter it for multiple photos

      // Now automatically send a message about the photo
      const photoMsg = "I've just sent you a photo of my vehicle.";
      handleSendCustomMessage(photoMsg);

    } catch (err) {
      console.error("Error uploading media:", err);
      const error = err as Error;

      // Replace temp message with error message
      setMessages(prev =>
        prev.map(msg =>
          msg.id === tempMessage.id ? {
            ...msg,
            text: `Failed to upload ${uploadMethod === 'url' ? 'media URL' : 'file'}: ${error.message || 'Unknown error'}`,
            isUploading: false,
          } : msg
        )
      );
      setHasNewMessage(true);

      toast({
        title: "Upload Failed",
        description: `Couldn't upload your ${uploadMethod === 'url' ? 'media URL' : 'file'}. Please try again.`,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSendCustomMessage = async (messageText: string) => {
    // Check for appointment booking intent
    const bookingKeywords = ["book", "schedule", "appointment", "reserve", "booking"];
    const isBookingRequest = bookingKeywords.some(keyword =>
      messageText.toLowerCase().includes(keyword)
    );

    // Check for service verification request
    const serviceKeywords = [
      "full detail", "interior detail", "maintenance detail", "ceramic coating",
      "polish", "enhancement", "premium wash", "motorcycle detail", "shampoo"
    ];

    const requestsVerification = serviceKeywords.some(keyword =>
      messageText.toLowerCase().includes(keyword)
    );



    if (isBookingRequest) {
      // Add user message to chat
      const userMessage: Message = {
        id: Math.random().toString(36).substring(2, 9),
        text: messageText,
        sender: "user",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setHasNewMessage(true);

      // Add a personalized and professional response
      const botMessage: Message = {
        id: Math.random().toString(36).substring(2, 9),
        text: "We'd be delighted to get you scheduled for a service! Our team at Clean Machine takes pride in providing exceptional detailing services that will leave your vehicle looking its best. Let me help you find a convenient time that works for your schedule.",
        sender: "bot",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, botMessage]);
      setHasNewMessage(true);
      setIsTyping(true);

      // Show typing indicator and then provide a button for the scheduler
      setTimeout(() => {
        setIsTyping(false);

        // Add second message with instructions and a button prompt
        const followupMessage: Message = {
          id: Math.random().toString(36).substring(2, 9),
          text: "Please select from our available services and time slots when you're ready. Our business hours are 9am to 5pm, with appointments starting between 9am and 3pm to ensure we have enough time to complete your service.\n\n[Click here to open our scheduling tool]",
          sender: "bot",
          timestamp: new Date(),
          actionButton: {
            text: "Open Scheduling Tool",
            action: () => setShowSchedulerDialog(true)
          }
        };

        setMessages((prev) => [...prev, followupMessage]);
        setHasNewMessage(true);
      }, 3000);

      return;
    }

    // Handle regular messages (non-booking)
    const userMessage: Message = {
      id: Math.random().toString(36).substring(2, 9),
      text: messageText,
      sender: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setHasNewMessage(true);
    setIsTyping(true);

    try {
      const response = await fetch("/sms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Client-Type": "web", // Add header to identify this as a web client request
        },
        body: JSON.stringify({
          Body: messageText,
          From: customerPhone || "+15551234567", // Use customer phone or placeholder
        }),
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }

      // Parse JSON response
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to get response');
      }

      const responseText = data.message;

      // Add bot response to chat
      const botMessage: Message = {
        id: Math.random().toString(36).substring(2, 9),
        text: responseText,
        sender: "bot",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, botMessage]);
      setHasNewMessage(true);
    } catch (err) {
      console.error("Error sending message:", err);
      const error = err as Error;

      // Add error message to chat
      const errorMessage: Message = {
        id: Math.random().toString(36).substring(2, 9),
        text: "Sorry, I couldn't process your message at this time. Please try again later.",
        sender: "bot",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);
      setHasNewMessage(true);

      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsTyping(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inputText.trim()) return;

    // Store the text and clear the input field
    const messageText = inputText.trim();
    setInputText("");

    // Call the reusable function to send the message
    handleSendCustomMessage(messageText);
  };

  const handleSuggestionClick = (suggestion: string) => {
    // Special handling for booking appointments
    if (suggestion === "Book an appointment") {
      setShowSchedulerDialog(true);
      return;
    }

    setInputText(suggestion);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Handle appointment booking success
  const handleAppointmentSuccess = (appointmentDetails: any) => {
    setShowSchedulerDialog(false);

    // Add the user appointment request to chat
    const userMessage: Message = {
      id: Math.random().toString(36).substring(2, 9),
      text: "I'd like to book an appointment",
      sender: "user",
      timestamp: new Date(),
    };

    // Add the confirmation message from the bot
    const botMessage: Message = {
      id: Math.random().toString(36).substring(2, 9),
      text: `Your appointment for ${appointmentDetails.service} has been confirmed for ${appointmentDetails.formattedTime}. We look forward to seeing you!`,
      sender: "bot",
      timestamp: new Date(),
    };

    // Add service recommendations based on the selected service
    const recommendationMessage: Message = {
      id: Math.random().toString(36).substring(2, 9),
      text: getServiceRecommendations(appointmentDetails.service),
      sender: "bot",
      timestamp: new Date(Date.now() + 1000), // Slightly later timestamp
      actionButton: {
        text: "Add to my appointment",
        action: () => {
          // This would open a dialog to add additional services
          toast({
            title: "Feature Coming Soon",
            description: "The ability to add services to an existing appointment will be available soon.",
          });
        }
      }
    };

    setMessages((prev) => [...prev, userMessage, botMessage, recommendationMessage]);
    setHasNewMessage(true);
  };

  // Get service recommendations based on the booked service and vehicle type
  const getServiceRecommendations = (serviceName: string): string => {
    // Extract vehicle type from context if available
    const vehicleType = extractVehicleType();

    // Base recommendations by service
    const baseRecommendations = {
      "Full Detail": "Would you like to add our Leather Protector treatment? It helps maintain the condition of your interior after a Full Detail and extends the life of your leather surfaces.",
      "Interior Detail": "Consider adding our Excessive Pet Hair Removal service if you have pets with heavy shedding, or our Odor Elimination treatment to keep your interior fresh longer.",
      "Exterior Detail": "Our Rain Repellent treatment would be a perfect addition to your Exterior Detail. It improves visibility during rain and helps water bead off your windshield.",
      "Express Wash": "Would you like to upgrade to our Premium Wash? It includes additional wax protection that helps your vehicle stay cleaner longer.",
      "Ceramic Coating": "Our Headlight Restoration service would complement your Ceramic Coating perfectly, giving your vehicle a completely refreshed look.",
      "Maintenance Detail Program": "Adding our Wheel Protection service would be a great addition to your Maintenance program, keeping your wheels looking fresh between details."
    };

    // Vehicle-specific recommendations
    const vehicleRecommendations: Record<string, Record<string, string>> = {
      "SUV": {
        "Full Detail": "For your SUV, we recommend adding our third-row deep cleaning ($25 extra). SUVs with extra rows need special attention to ensure complete detailing.",
        "Interior Detail": "For SUVs, we recommend adding our Carpet Shampoo with Extra Coverage ($40) - perfect for the larger floor space in your vehicle."
      },
      "Truck": {
        "Full Detail": "For your truck, we recommend adding our Bed Liner Treatment ($30) to restore and protect your truck bed alongside your Full Detail.",
        "Exterior Detail": "For trucks, our Undercarriage Treatment ($45) provides excellent protection against off-road elements and road salt."
      },
      "Luxury": {
        "Full Detail": "For your luxury vehicle, we recommend our Premium Leather Conditioning package ($55) which uses special products designed specifically for high-end leather.",
        "Ceramic Coating": "For luxury vehicles, we suggest our Advanced Paint Correction ($150) before applying the ceramic coating for absolutely flawless results."
      }
    };

    // Package discount recommendations
    const packageDiscounts = {
      "Full Detail": "📦 PACKAGE DEAL: Add both Leather Protector AND Odor Elimination for just $65 (save $10)!",
      "Interior Detail": "📦 PACKAGE DEAL: Add both Excessive Pet Hair Removal AND Odor Elimination for just $55 (save $10)!",
      "Exterior Detail": "📦 PACKAGE DEAL: Add both Rain Repellent AND Headlight Restoration for just $70 (save $15)!",
      "Ceramic Coating": "📦 PACKAGE DEAL: Add both Headlight Restoration AND Wheel Protection for just $95 (save $20)!"
    };

    // Choose the most relevant recommendation
    let recommendation = "";

    // If we have a vehicle-specific recommendation, use it
    if (vehicleType && vehicleRecommendations[vehicleType] && vehicleRecommendations[vehicleType][serviceName]) {
      recommendation = vehicleRecommendations[vehicleType][serviceName];
    } else {
      // Otherwise use the base recommendation
      recommendation = baseRecommendations[serviceName as keyof typeof baseRecommendations] ||
        "Would you like to enhance your service with add-ons like Leather Protector ($35), Excessive Pet Hair Removal ($25), or Odor Elimination ($40)?";
    }

    // Add package discount if available
    if (packageDiscounts[serviceName as keyof typeof packageDiscounts]) {
      recommendation += "\n\n" + packageDiscounts[serviceName as keyof typeof packageDiscounts];
    }

    return recommendation;
  };

  // Extract vehicle type from messages (SUV, Truck, Luxury, etc.)
  const extractVehicleType = (): string | null => {
    // Look through messages for vehicle information
    for (const message of messages) {
      const text = message.text.toLowerCase();

      if (text.includes('suv') || text.includes('crossover') || text.includes('explorer') ||
          text.includes('tahoe') || text.includes('suburban') || text.includes('highlander')) {
        return "SUV";
      }

      if (text.includes('truck') || text.includes('pickup') || text.includes('silverado') ||
          text.includes('f-150') || text.includes('ram') || text.includes('tundra')) {
        return "Truck";
      }

      if (text.includes('bmw') || text.includes('mercedes') || text.includes('audi') ||
          text.includes('lexus') || text.includes('tesla') || text.includes('porsche') ||
          text.includes('jaguar') || text.includes('luxury')) {
        return "Luxury";
      }
    }

    return null;
  };

  // Render typing indicator with animation
  const renderTypingIndicator = () => {
    return (
      <AnimatePresence>
        {isTyping && (
          <motion.div
            className="flex items-center mb-3"
            initial="initial"
            animate="animate"
            exit="exit"
            variants={typingVariants}
          >
            <div className="max-w-[85%] bg-white text-gray-800 rounded-2xl rounded-tl-md px-3 py-2 flex items-center gap-2 shadow-sm border border-gray-200">
              <img src={logoUrl} alt="Clean Machine" className="h-3 w-3 rounded-full" />
              <span className="text-[10px] opacity-60 font-medium">Clean Machine is typing</span>
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <motion.div
                    key={i}
                    className="w-1 h-1 bg-blue-500 rounded-full"
                    variants={dotVariants}
                    custom={i}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  };

  // If minimized, show floating button to reopen
  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        {/* Pulsing ring animation */}
        <motion.div
          className="absolute inset-0 rounded-full bg-blue-400 dark:bg-blue-300"
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.4, 0, 0.4],
          }}
          transition={{
            duration: 2.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        
        {/* Main button */}
        <motion.button
          initial={{ scale: 0, opacity: 0, rotate: -180 }}
          animate={{ 
            scale: 1, 
            opacity: 1,
            rotate: 0,
          }}
          exit={{ scale: 0, opacity: 0, rotate: 180 }}
          transition={{ 
            type: "spring", 
            stiffness: 300, 
            damping: 25,
            rotate: { duration: 0.6 }
          }}
          whileHover={{ 
            scale: 1.15,
            rotate: 5,
            boxShadow: "0 0 25px rgba(59, 130, 246, 0.6)",
          }}
          whileTap={{ 
            scale: 0.95,
            boxShadow: "0 0 35px rgba(59, 130, 246, 0.8)",
          }}
          onClick={() => setIsMinimized(false)}
          className="relative h-14 w-14 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-400 dark:to-blue-500 shadow-xl hover:shadow-2xl transition-shadow duration-300 flex items-center justify-center text-white overflow-hidden group"
          data-testid="button-open-chat"
          aria-label="Open chat"
        >
          {/* Shine effect */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
          
          {/* Logo */}
          <img 
            src={logoUrl} 
            alt="Clean Machine" 
            className="h-8 w-8 rounded-full relative z-10 border-2 border-white/30" 
          />
        </motion.button>
      </div>
    );
  }

  return (
    <>
      <div className="w-full max-w-[280px] mx-auto h-[300px] flex flex-col shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] rounded-2xl border-2 border-blue-300/40 bg-gradient-to-br from-white via-blue-50/40 to-purple-50/30 overflow-hidden"
        style={{ backgroundColor: isDemoMode ? "#f0f7ff" : undefined }}>
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 via-blue-500 to-blue-600 text-white p-3 relative overflow-hidden flex-shrink-0">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMSkiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-20"></div>
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-2">
              <img
                src={logoUrl}
                alt="Clean Machine"
                className="h-7 w-7 rounded-full border-2 border-white/30 shadow-md"
              />
              <h1 className="text-base font-semibold tracking-tight">Clean Machine</h1>
            </div>
            <div className="flex items-center gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleMinimize}
                      className="h-7 w-7 text-white/80 hover:bg-white/20 hover:text-white rounded-lg transition-all"
                    >
                      <span className="text-lg leading-none font-bold">−</span>
                      <span className="sr-only">Minimize</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Minimize chat</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>

        {/* Appointment Scheduler Dialog */}
        <Dialog open={showSchedulerDialog} onOpenChange={setShowSchedulerDialog}>
          <DialogContent className="w-[95vw] max-w-2xl h-[90vh] p-0 flex flex-col" aria-describedby="appointment-scheduler-description">
            <DialogTitle className="sr-only">Appointment Scheduler</DialogTitle>
            <p id="appointment-scheduler-description" className="sr-only">
              Schedule your appointment with Clean Machine Auto Detail
            </p>
            <MultiVehicleAppointmentScheduler
              onClose={() => setShowSchedulerDialog(false)}
              onSuccess={handleAppointmentSuccess}
            />
          </DialogContent>
        </Dialog>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-3 bg-gradient-to-b from-gray-50/50 to-white">
          <AnimatePresence initial={false}>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                className={cn(
                  "mb-3 flex",
                  message.sender === "user" ? "justify-end" : "justify-start"
                )}
                variants={messageVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                layout
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 shadow-sm text-sm",
                    message.sender === "user"
                      ? "bg-blue-600 text-white rounded-tr-md"
                      : "bg-white text-gray-800 rounded-tl-md border border-gray-200"
                  )}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    {message.sender === "user" ? (
                      <UserIcon className="h-3 w-3 text-blue-200" />
                    ) : (
                      <CarIcon className="h-3 w-3 text-blue-600" />
                    )}
                    <span className="text-[10px] opacity-60 font-medium">
                      {message.sender === "user" ? "You" : "Clean Machine"} • {message.timestamp.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div className="whitespace-pre-wrap leading-relaxed">
                    {message.isUploading ? (
                      <div className="space-y-2">
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-3 w-3/4" />
                      </div>
                    ) : (
                      <>
                        <p>{message.text}</p>
                        {message.mediaUrl && (
                          <div className="mt-2">
                            <a
                              href={message.mediaUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:text-blue-300 underline text-xs"
                            >
                              View uploaded image
                            </a>
                          </div>
                        )}
                        {message.actionButton && (
                          <Button
                            variant="secondary"
                            size="sm"
                            className="mt-2 h-7 text-xs"
                            onClick={message.actionButton.action}
                          >
                            {message.actionButton.text}
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {renderTypingIndicator()}
          <div ref={messageEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-3 border-t border-gray-200 flex-shrink-0 bg-white">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              ref={inputRef}
              type="text"
              placeholder="Type a message..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="flex-grow border-gray-300 focus-visible:ring-blue-500 text-sm h-9 rounded-full px-4 placeholder:text-gray-500 bg-white text-black shadow-sm"
            />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => setShowMediaDialog(true)}
                    className="h-9 w-9 rounded-full hover:bg-gray-100"
                    disabled={isTyping}
                  >
                    <PaperclipIcon className="h-4 w-4 text-gray-600" />
                    <span className="sr-only">Upload Photo</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Upload photo</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button
              type="submit"
              size="icon"
              disabled={isTyping || !inputText.trim()}
              className="h-9 w-9 rounded-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              <PaperPlaneIcon className="h-4 w-4" />
              <span className="sr-only">Send</span>
            </Button>
          </form>
        </div>
      </div>

      {/* Media Upload Dialog */}
      <Dialog open={showMediaDialog} onOpenChange={setShowMediaDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Share a photo of your vehicle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex flex-col space-y-2">
              <label htmlFor="name" className="text-sm font-medium">
                Your Name <span className="text-red-500">*</span>
              </label>
              <Input
                id="name"
                placeholder="John Doe"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="border-blue-200 focus-visible:ring-blue-400"
              />
            </div>
            <div className="flex flex-col space-y-2">
              <label htmlFor="phone" className="text-sm font-medium">
                Phone Number
              </label>
              <Input
                id="phone"
                placeholder="(918) 555-1234"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="border-blue-200 focus-visible:ring-blue-400"
              />
              <p className="text-xs text-gray-500">
                Phone number or email is required
              </p>
            </div>
            <div className="flex flex-col space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email Address
              </label>
              <Input
                id="email"
                type="email"
                placeholder="john.doe@example.com"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="border-blue-200 focus-visible:ring-blue-400"
              />
            </div>
            <div className="flex flex-col space-y-2">
              <label htmlFor="vehicle" className="text-sm font-medium">
                Vehicle Information <span className="text-red-500">*</span>
              </label>
              <Input
                id="vehicle"
                placeholder="2020 Toyota Camry, Blue"
                value={vehicleInfo}
                onChange={(e) => setVehicleInfo(e.target.value)}
              />
              <p className="text-xs text-gray-500">
                Include year, make, model, and color
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-4">
                <label className="text-sm font-medium">Upload Method:</label>
                <div className="flex space-x-4">
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      checked={uploadMethod === 'file'}
                      onChange={() => setUploadMethod('file')}
                      className="text-blue-600"
                    />
                    <span>Upload File</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      checked={uploadMethod === 'url'}
                      onChange={() => setUploadMethod('url')}
                      className="text-blue-600"
                    />
                    <span>URL</span>
                  </label>
                </div>
              </div>

              {uploadMethod === 'file' ? (
                <div className="mt-4">
                  <label className="block text-sm font-medium">
                    Select Photo <span className="text-red-500">*</span>
                  </label>
                  <div className="mt-1 flex items-center">
                    <label className="cursor-pointer bg-white border border-gray-300 rounded-md py-2 px-3 text-sm leading-4 hover:bg-gray-50">
                      <span>{selectedFile ? selectedFile.name.substring(0, 20) + "..." : "Choose a file..."}</span>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="sr-only"
                      />
                    </label>
                  </div>
                </div>
              ) : (
                <div className="mt-4">
                  <label htmlFor="media-url" className="block text-sm font-medium">
                    Media URL <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="media-url"
                    ref={mediaInputRef}
                    type="url"
                    placeholder="https://example.com/your-image.jpg"
                    value={mediaUrl}
                    onChange={(e) => setMediaUrl(e.target.value)}
                    className="mt-1"
                  />
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-between mt-4">
            <DialogClose asChild>
              <Button variant="outline" className="transition-all duration-300 hover:bg-red-50 hover:text-red-600 hover:border-red-200 hover:shadow-sm hover:scale-105">Cancel</Button>
            </DialogClose>
            <Button
              onClick={handleMediaUpload}
              disabled={isUploading}
              className="transition-all duration-300 hover:bg-blue-700 hover:shadow-md hover:shadow-blue-600/30 hover:scale-105"
            >
              {isUploading ? "Uploading..." : "Upload"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>




    </>
  );
}