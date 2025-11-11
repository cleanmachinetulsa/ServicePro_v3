import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import {
  ArrowLeft,
  Send,
  Sparkles,
  Bot,
  User,
  Calendar,
  Car,
  Phone,
  Clock,
  MapPin,
  DollarSign,
  Shield,
  Loader2,
  Paperclip,
  X,
  MessageSquare
} from "lucide-react";
import MultiVehicleAppointmentScheduler from "@/components/MultiVehicleAppointmentScheduler";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Message {
  id: string;
  text: string;
  sender: "user" | "bot";
  timestamp: Date;
  isTyping?: boolean;
  actionButton?: {
    text: string;
    action: () => void;
  };
}

const suggestionChips = [
  { text: "📋 Services & Pricing", icon: DollarSign },
  { text: "📅 Book Appointment", icon: Calendar },
  { text: "🕐 Business Hours", icon: Clock },
  { text: "📍 Service Area", icon: MapPin },
  { text: "🚗 Vehicle Types", icon: Car },
];

export default function ChatPage() {
  // Load messages from localStorage for persistence across views
  const [messages, setMessages] = useState<Message[]>(() => {
    const savedMessages = localStorage.getItem('chatMessages');
    if (savedMessages) {
      try {
        return JSON.parse(savedMessages, (key, value) => {
          if (key === 'timestamp' && value) {
            return new Date(value);
          }
          return value;
        });
      } catch (e) {
        console.error('Failed to parse saved messages:', e);
      }
    }
    
    return [
      {
        id: "welcome",
        text: "Hey, I'm the Clean Machine Assistant! Want to check our services, book an appointment, or ask a question? I can handle it all right here.",
        sender: "bot",
        timestamp: new Date(),
      }
    ];
  });
  
  // Save messages to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('chatMessages', JSON.stringify(messages));
    } catch (e) {
      console.error('Failed to save messages to localStorage:', e);
    }
  }, [messages]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showSchedulerDialog, setShowSchedulerDialog] = useState(false);
  const [customerInfo, setCustomerInfo] = useState({
    name: "",
    phone: "",
    email: "",
    vehicle: "",
  });

  const messageEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSendMessage = async (messageText?: string) => {
    const textToSend = messageText || inputText;
    if (!textToSend.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: textToSend,
      sender: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText("");
    setIsTyping(true);

    // Check if user wants to book
    if (textToSend.toLowerCase().includes("book") || 
        textToSend.toLowerCase().includes("appointment") ||
        textToSend.toLowerCase().includes("schedule")) {
      setTimeout(() => {
        const botMessage: Message = {
          id: Date.now().toString() + "-bot",
          text: "I'd be happy to help you book an appointment! Let me open our scheduling system for you.",
          sender: "bot",
          timestamp: new Date(),
          actionButton: {
            text: "Open Scheduler",
            action: () => setShowSchedulerDialog(true),
          },
        };
        setMessages((prev) => [...prev, botMessage]);
        setIsTyping(false);
        setShowSchedulerDialog(true);
      }, 1000);
      return;
    }

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: textToSend,
          channel: "web",
          customerPhone: customerInfo.phone || undefined,
          customerName: customerInfo.name || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      const data = await response.json();

      const botMessage: Message = {
        id: Date.now().toString() + "-bot",
        text: data.response || "I'm here to help! Feel free to ask about our services, pricing, or book an appointment.",
        sender: "bot",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage: Message = {
        id: Date.now().toString() + "-error",
        text: "I apologize, but I'm having trouble connecting right now. Please try again or call us directly at (918) 856-5304.",
        sender: "bot",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    const cleanText = suggestion.replace(/^[^\s]+ /, ""); // Remove emoji
    handleSendMessage(cleanText);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-blue-950/10 to-black text-white">
      {/* Premium background effects */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div className="absolute top-[30%] left-[15%] w-96 h-96 bg-blue-500/10 rounded-full filter blur-3xl animate-pulse"></div>
        <div className="absolute bottom-[20%] right-[10%] w-80 h-80 bg-blue-600/10 rounded-full filter blur-3xl animate-pulse"></div>
      </div>

      {/* Header */}
      <header className="relative z-20 border-b border-blue-800/30 bg-gray-900/50 backdrop-blur-sm sticky top-0">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                asChild
                className="text-blue-400 hover:text-blue-300 hover:bg-blue-950/50"
                data-testid="button-back-home"
              >
                <Link href="/">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Home
                </Link>
              </Button>
              <div className="hidden sm:block">
                <h1 className="text-xl font-semibold bg-clip-text text-transparent bg-gradient-to-r from-blue-200 to-blue-400">
                  Clean Machine Assistant
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-sm text-blue-300">Online</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Chat Container */}
      <main className="relative z-10 max-w-4xl mx-auto px-4 py-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-gradient-to-b from-gray-900/80 to-blue-950/30 backdrop-blur-md rounded-2xl shadow-2xl border border-blue-800/30 overflow-hidden"
          style={{ height: "calc(100vh - 180px)" }}
        >
          {/* Messages Area */}
          <ScrollArea className="h-full p-6 pb-32">
            <AnimatePresence initial={false}>
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className={`mb-4 flex ${
                    message.sender === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`flex items-start gap-3 max-w-[80%] ${
                      message.sender === "user" ? "flex-row-reverse" : ""
                    }`}
                  >
                    {/* Avatar */}
                    <div
                      className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                        message.sender === "user"
                          ? "bg-blue-600"
                          : "bg-gradient-to-br from-blue-500 to-blue-700"
                      }`}
                    >
                      {message.sender === "user" ? (
                        <User className="h-4 w-4 text-white" />
                      ) : (
                        <Bot className="h-4 w-4 text-white" />
                      )}
                    </div>

                    {/* Message Bubble */}
                    <div className="flex flex-col gap-1">
                      <div
                        className={`px-4 py-3 rounded-2xl ${
                          message.sender === "user"
                            ? "bg-blue-600 text-white rounded-tr-sm"
                            : "bg-gray-800/70 backdrop-blur-sm border border-gray-700/50 text-blue-100 rounded-tl-sm"
                        }`}
                      >
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                          {message.text}
                        </p>
                      </div>
                      
                      {/* Action Button */}
                      {message.actionButton && (
                        <Button
                          size="sm"
                          onClick={message.actionButton.action}
                          className="mt-2 bg-blue-600 hover:bg-blue-700"
                          data-testid="button-action-scheduler"
                        >
                          <Calendar className="h-3 w-3 mr-1" />
                          {message.actionButton.text}
                        </Button>
                      )}

                      {/* Timestamp */}
                      <span className="text-xs text-blue-400/60 px-1">
                        {formatTime(message.timestamp)}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Typing Indicator */}
            <AnimatePresence>
              {isTyping && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex items-center gap-3 mb-4"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                  <div className="bg-gray-800/70 backdrop-blur-sm border border-gray-700/50 px-4 py-3 rounded-2xl rounded-tl-sm">
                    <div className="flex gap-1">
                      <motion.div
                        animate={{ y: [0, -5, 0] }}
                        transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
                        className="w-2 h-2 bg-blue-400 rounded-full"
                      />
                      <motion.div
                        animate={{ y: [0, -5, 0] }}
                        transition={{ duration: 0.6, repeat: Infinity, delay: 0.1 }}
                        className="w-2 h-2 bg-blue-400 rounded-full"
                      />
                      <motion.div
                        animate={{ y: [0, -5, 0] }}
                        transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
                        className="w-2 h-2 bg-blue-400 rounded-full"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div ref={messageEndRef} />
          </ScrollArea>

          {/* Input Area */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-gray-900 to-transparent p-4">
            {/* Suggestion Chips */}
            <div className="mb-3 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {suggestionChips.map((chip, index) => (
                <motion.button
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  onClick={() => handleSuggestionClick(chip.text)}
                  className="flex-shrink-0 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-full text-xs text-blue-300 transition-all duration-200 hover:scale-105"
                  data-testid={`suggestion-chip-${index}`}
                >
                  <chip.icon className="h-3 w-3 inline mr-1" />
                  {chip.text.replace(/^[^\s]+ /, "")}
                </motion.button>
              ))}
            </div>

            {/* Input Field */}
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Input
                  ref={inputRef}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                  placeholder="Type your message..."
                  className="w-full bg-gray-800/70 backdrop-blur-sm border-blue-500/30 text-white placeholder-blue-300/50 pr-12"
                  disabled={isTyping}
                  data-testid="input-chat-message"
                />
                <Sparkles className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-400/50" />
              </div>

              <Button
                onClick={() => handleSendMessage()}
                disabled={!inputText.trim() || isTyping}
                className="bg-blue-600 hover:bg-blue-700 transition-all duration-200"
                data-testid="button-send-message"
              >
                {isTyping ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>
        </motion.div>
      </main>

      {/* Scheduler Dialog */}
      <Dialog open={showSchedulerDialog} onOpenChange={setShowSchedulerDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-gray-900 border-blue-800/30">
          <DialogHeader>
            <DialogTitle className="text-blue-100">Book Your Appointment</DialogTitle>
          </DialogHeader>
          <MultiVehicleAppointmentScheduler 
            onClose={() => setShowSchedulerDialog(false)}
            onSuccess={() => {
              setShowSchedulerDialog(false);
              toast({
                title: "Appointment Booked!",
                description: "Your appointment has been successfully scheduled. We'll send you a confirmation shortly.",
              });
              const confirmMessage: Message = {
                id: Date.now().toString() + "-confirm",
                text: "✅ Great! Your appointment has been successfully booked. You'll receive a confirmation via text/email shortly. Looking forward to making your vehicle shine!",
                sender: "bot",
                timestamp: new Date(),
              };
              setMessages((prev) => [...prev, confirmMessage]);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}