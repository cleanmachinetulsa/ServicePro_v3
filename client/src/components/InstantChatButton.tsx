import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CarIcon, UserIcon } from "@/components/ui/icons";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface InstantChatButtonProps {
  customerPhone?: string;
  customerName?: string;
  mode?: 'floating' | 'inline';
  className?: string;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  autoPopup?: boolean;
  autoPopupDelay?: number; // in milliseconds
}

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

export default function InstantChatButton({
  customerPhone,
  customerName = '',
  mode = 'floating',
  className = '',
  variant = 'default',
  autoPopup = true,
  autoPopupDelay = 3000
}: InstantChatButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasAutoPopped, setHasAutoPopped] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      text: `👋 Hi there! Need help with auto detailing services? I'm here to assist you!`,
      sender: 'bot',
      timestamp: new Date(),
    }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const { toast } = useToast();

  // Auto-popup effect
  React.useEffect(() => {
    if (autoPopup && !hasAutoPopped && mode === 'floating') {
      const timer = setTimeout(() => {
        setIsOpen(true);
        setHasAutoPopped(true);
      }, autoPopupDelay);

      return () => clearTimeout(timer);
    }
  }, [autoPopup, hasAutoPopped, mode, autoPopupDelay]);

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    // Add user message
    const userMessage: Message = {
      id: Math.random().toString(36).substring(2, 9),
      text: inputText,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');

    // Simulate typing indicator
    setIsTyping(true);

    try {
      // Use the unified chat API endpoint
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: inputText,
          channel: 'web',
          customerPhone: customerPhone || `web-${Date.now()}`,
          customerName: customerName || 'Guest',
        }),
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to get response');
      }

      const responseText = data.response;

      const botMessage: Message = {
        id: Math.random().toString(36).substring(2, 9),
        text: responseText,
        sender: 'bot',
        timestamp: new Date(),
      };

      setIsTyping(false);
      setMessages(prev => [...prev, botMessage]);

      // Notify that the message was sent
      toast({
        title: "Message Sent",
        description: "Your message has been sent to the customer.",
      });
    } catch (error) {
      console.error("Error sending message:", error);
      setIsTyping(false);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Animation variants
  const messageVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
    exit: { opacity: 0, transition: { duration: 0.2 } }
  };

  const typingVariants = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 10 }
  };

  const dotVariants = {
    initial: { y: 0 },
    animate: (i: number) => ({
      y: [0, -5, 0],
      transition: {
        delay: i * 0.1,
        duration: 0.5,
        repeat: Infinity,
        repeatType: "loop" as const
      }
    })
  };

  // Render typing indicator
  const renderTypingIndicator = () => {
    return (
      <AnimatePresence>
        {isTyping && (
          <motion.div
            className="flex items-center mb-4"
            initial="initial"
            animate="animate"
            exit="exit"
            variants={typingVariants}
          >
            <div className="max-w-[80%] bg-gray-100 text-gray-800 rounded-lg p-3 rounded-tl-none flex items-center space-x-1">
              <CarIcon className="h-4 w-4 mr-2 text-blue-600" />
              <span className="text-xs opacity-70">Clean Machine is typing</span>
              <div className="flex space-x-1 ml-1">
                {[0, 1, 2].map(i => (
                  <motion.div
                    key={i}
                    className="w-1.5 h-1.5 bg-blue-500 rounded-full"
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

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setIsMinimized(true);
    }
  };

  // For floating mode, render custom chat window instead of Sheet
  if (mode === 'floating') {
    return (
      <>
        {/* Floating chat button */}
        {!isOpen && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ 
              scale: isMinimized ? [1, 1.1, 1] : 1, 
              opacity: 1 
            }}
            transition={{ 
              duration: 0.3, 
              delay: 0.5,
              scale: {
                repeat: isMinimized ? Infinity : 0,
                repeatType: "loop",
                duration: 2
              }
            }}
          >
            <Button 
              variant={variant} 
              size="lg" 
              className={cn(
                "fixed bottom-4 right-4 rounded-full shadow-2xl w-14 h-14 p-0 z-50 bg-gradient-to-br from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 border-2 border-white/30",
                isMinimized && "ring-4 ring-blue-400/50 ring-offset-2 ring-offset-white",
                className
              )}
              onClick={() => {
                setIsOpen(true);
                setIsMinimized(false);
              }}
              data-testid="chat-bubble-floating"
            >
              <MessageSquare className="h-6 w-6" />
              {messages.length > 1 && (
                <motion.span 
                  className="absolute -top-1 -right-1 bg-gradient-to-br from-red-500 to-red-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-lg border-2 border-white"
                  animate={isMinimized ? { scale: [1, 1.2, 1] } : {}}
                  transition={{ 
                    repeat: isMinimized ? Infinity : 0,
                    duration: 1.5,
                    repeatType: "loop"
                  }}
                >
                  {messages.filter(m => m.sender === 'bot').length}
                </motion.span>
              )}
            </Button>
          </motion.div>
        )}

        {/* Small chat window */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="fixed bottom-20 right-4 z-50 w-[320px] h-[420px] shadow-2xl rounded-2xl overflow-hidden backdrop-blur-sm"
            >
              <Card className="border-2 border-blue-300/40 h-full flex flex-col bg-gradient-to-br from-white via-blue-50/40 to-purple-50/30 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)]">
                <CardHeader className="bg-gradient-to-r from-blue-600 via-blue-500 to-purple-600 text-white p-3 border-b-2 border-white/20 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="bg-white/20 p-1.5 rounded-lg backdrop-blur-sm">
                        <CarIcon className="h-4 w-4" />
                      </div>
                      <CardTitle className="text-xs font-bold tracking-tight">Clean Machine Chat</CardTitle>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => {
                        setIsOpen(false);
                        setIsMinimized(true);
                      }} 
                      className="text-white hover:bg-white/20 hover:text-white h-7 w-7 rounded-lg transition-all"
                    >
                      <span className="text-lg leading-none">−</span>
                      <span className="sr-only">Minimize</span>
                    </Button>
                  </div>
                  {customerName && (
                    <p className="text-blue-100 text-xs mt-1 font-medium">
                      Chat with {customerName} {customerPhone ? `(${customerPhone})` : ''}
                    </p>
                  )}
                </CardHeader>

                <ScrollArea className="flex-grow p-3 bg-gradient-to-b from-transparent to-blue-50/30">
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
                            "max-w-[80%] rounded-2xl p-3 shadow-md",
                            message.sender === "user"
                              ? "bg-gradient-to-br from-blue-600 to-blue-500 text-white rounded-tr-sm"
                              : "bg-white text-gray-800 rounded-tl-sm border border-gray-100"
                          )}
                        >
                          <div className="flex items-center mb-1">
                            {message.sender === "user" ? (
                              <UserIcon className="h-3 w-3 mr-1 text-blue-100" />
                            ) : (
                              <div className="bg-blue-100 p-0.5 rounded mr-1">
                                <CarIcon className="h-3 w-3 text-blue-600" />
                              </div>
                            )}
                            <span className="text-[10px] font-medium opacity-70">
                              {message.sender === "user" ? "You" : "Clean Machine"} •{" "}
                              {message.timestamp.toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <p className="text-xs whitespace-pre-wrap leading-relaxed">{message.text}</p>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {renderTypingIndicator()}
                </ScrollArea>

                <CardFooter className="p-3 pt-2 border-t border-gray-200/50 bg-white/80 backdrop-blur-sm">
                  <div className="flex w-full gap-2">
                    <Input
                      placeholder="Type a message..."
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="flex-grow text-xs bg-white border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 shadow-sm"
                      style={{ color: '#000000 !important' } as React.CSSProperties}
                      data-testid="input-chat-message"
                    />
                    <Button 
                      onClick={handleSendMessage} 
                      disabled={!inputText.trim()} 
                      size="sm"
                      className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-xl shadow-lg transition-all hover:shadow-xl disabled:opacity-50"
                    >
                      Send
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
  }

  // For inline mode, use the Sheet component
  return (
    <Button 
      variant={variant} 
      className={className}
      onClick={() => setIsOpen(true)}
    >
      <MessageSquare className="h-4 w-4 mr-2" />
      Instant Chat
    </Button>
  );
}