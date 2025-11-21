import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useRoute } from 'wouter';
import { AppShell } from '@/components/AppShell';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Phone, 
  MessageSquare, 
  ArrowRight, 
  Clock, 
  User,
  AlertCircle,
  MessageCircle,
  Home,
  CornerDownRight,
  BarChart2 as BarChart,
  Filter,
  Tag,
  ArrowLeft
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

interface Conversation {
  id: string;
  customerName?: string;
  customerPhone: string;
  messages: Message[];
  startTime: Date;
  active: boolean;
  needsAttention: boolean;
  category?: 'Booking' | 'Inquiry' | 'Support' | 'Feedback' | 'Other';
  intent?: 'Ready to Book' | 'Considering Booking' | 'Information Gathering' | 'Problem Resolution' | 'Opinion Sharing' | 'Other';
  topics?: string[];
}

export default function LiveConversationsPage() {
  const [location, setLocation] = useLocation();
  const [match, params] = useRoute('/live-conversations/:conversationId');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showSmartSuggestions, setShowSmartSuggestions] = useState<boolean>(false);
  const [messageInput, setMessageInput] = useState<string>('');
  const { toast } = useToast();
  const activeRefreshInterval = useRef<number | null>(null);
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Animation frames for typing indicator
  const typingFrames = [".", "..", "..."];
  const [typingFrame, setTypingFrame] = useState(0);
  
  // Simulate typing animation
  useEffect(() => {
    if (isTyping) {
      const interval = setInterval(() => {
        setTypingFrame((prev) => (prev + 1) % typingFrames.length);
      }, 400);
      return () => clearInterval(interval);
    }
  }, [isTyping, typingFrames]);
  
  // Add smart categorization to the existing conversations
  useEffect(() => {
    // Add categories and topics to the mock conversations with improved booking categorization
    if (conversations.length > 0) {
      const updatedConversations = conversations.map(conv => {
        // Get the last few messages to determine context
        const recentMessages = conv.messages.slice(-3);
        const messageText = recentMessages.map(msg => msg.text).join(' ');
        
        // Example of improved booking categorization logic with intent detection
        const hasBookingKeywords = /book|schedule|appointment|available|availability|time slot|date|calendar/i.test(messageText);
        const hasReadyToBookPhrases = /would like to book|i want to book|book for (today|tomorrow)|next available|book now|asap/i.test(messageText);
        const hasBookingInquiries = /how far in advance|months from now|weeks in advance|booking policy|how does booking work|reschedule|cancel/i.test(messageText);
        
        // Updated categorization logic
        if (conv.id === '1') {
          return {
            ...conv, 
            category: 'Booking' as 'Booking',
            intent: 'Ready to Book', // This customer wants to book now
            topics: ['Ceramic Coating', 'Pricing', 'Scheduling']
          };
        } else if (conv.id === '2') {
          return {
            ...conv, 
            category: 'Support' as 'Support',
            intent: 'Considering Booking', // This customer is asking about rescheduling but not ready to commit
            topics: ['Rescheduling', 'Appointment']
          };
        }
        return conv;
      });
      
      setConversations(updatedConversations);
    }
  }, []);

  // Initialize typing animation
  useEffect(() => {
    const typingInterval = setInterval(() => {
      if (isTyping) {
        // Simulate typing ending after a random period
        if (Math.random() > 0.8) {
          setIsTyping(false);
        }
      } else {
        // Randomly show typing indicator
        if (Math.random() > 0.9 && selectedConversation?.active) {
          setIsTyping(true);
          
          // Auto-hide typing after a few seconds
          setTimeout(() => {
            setIsTyping(false);
          }, 2000 + Math.random() * 3000);
        }
      }
    }, 1500);
    
    return () => clearInterval(typingInterval);
  }, [isTyping, selectedConversation]);
  
  // Fetch all active conversations
  useEffect(() => {
    const fetchConversations = async () => {
      try {
        setIsLoading(true);
        
        // This would be a real API call in production
        const mockConversations: Conversation[] = [
          {
            id: '1',
            customerName: 'Sarah Johnson',
            customerPhone: '9185551234',
            messages: [
              {
                id: '1-1',
                text: 'Hi! I\'m interested in getting my SUV detailed. Do you do ceramic coatings?',
                sender: 'user',
                timestamp: new Date(Date.now() - 1000 * 60 * 15) // 15 minutes ago
              },
              {
                id: '1-2',
                text: 'Hi Sarah! Yes, we offer ceramic coating services. Our ceramic coating package starts at $450 and includes a thorough wash, clay bar treatment, and the ceramic application. Would you like more information about this service?',
                sender: 'bot',
                timestamp: new Date(Date.now() - 1000 * 60 * 14) // 14 minutes ago
              },
              {
                id: '1-3',
                text: 'That sounds good. How long does the coating last?',
                sender: 'user',
                timestamp: new Date(Date.now() - 1000 * 60 * 13) // 13 minutes ago
              },
              {
                id: '1-4',
                text: 'Our ceramic coating typically lasts 2-3 years with proper maintenance. It provides excellent protection against UV rays, bird droppings, tree sap, and light scratches. Would you like to schedule an appointment?',
                sender: 'bot',
                timestamp: new Date(Date.now() - 1000 * 60 * 12) // 12 minutes ago
              },
              {
                id: '1-5',
                text: 'Yes, I\'d like to schedule for next week. Do you have any openings on Tuesday or Wednesday?',
                sender: 'user',
                timestamp: new Date(Date.now() - 1000 * 60 * 5) // 5 minutes ago
              },
              {
                id: '1-6',
                text: 'Let me check our availability. We have an opening on Tuesday at 10:00 AM and Wednesday at 2:00 PM. Which would work better for you?',
                sender: 'bot',
                timestamp: new Date(Date.now() - 1000 * 60 * 4) // 4 minutes ago
              },
              {
                id: '1-7',
                text: 'Tuesday at 10 AM works for me. My vehicle is a 2021 Tesla Model Y, blue.',
                sender: 'user',
                timestamp: new Date(Date.now() - 1000 * 60 * 3) // 3 minutes ago
              }
            ],
            startTime: new Date(Date.now() - 1000 * 60 * 15), // 15 minutes ago
            active: true,
            needsAttention: false
          },
          {
            id: '2',
            customerName: 'Michael Roberts',
            customerPhone: '9185552345',
            messages: [
              {
                id: '2-1',
                text: 'Hi, I had an appointment scheduled for tomorrow but need to reschedule. Is that possible?',
                sender: 'user',
                timestamp: new Date(Date.now() - 1000 * 60 * 5) // 5 minutes ago
              },
              {
                id: '2-2',
                text: 'Hello Michael! I\'d be happy to help you reschedule your appointment. May I know what time your current appointment is scheduled for?',
                sender: 'bot',
                timestamp: new Date(Date.now() - 1000 * 60 * 4) // 4 minutes ago
              },
              {
                id: '2-3',
                text: 'It was for 2pm tomorrow. I need to move it to next week if possible.',
                sender: 'user',
                timestamp: new Date(Date.now() - 1000 * 60 * 3) // 3 minutes ago
              },
              {
                id: '2-4',
                text: 'I see. Let me check our availability for next week. What days would work best for you?',
                sender: 'bot',
                timestamp: new Date(Date.now() - 1000 * 60 * 2) // 2 minutes ago
              },
              {
                id: '2-5',
                text: 'Monday or Tuesday afternoon would be ideal.',
                sender: 'user',
                timestamp: new Date(Date.now() - 1000 * 60 * 1) // 1 minute ago
              }
            ],
            startTime: new Date(Date.now() - 1000 * 60 * 5), // 5 minutes ago
            active: true,
            needsAttention: true
          }
        ];
        
        setConversations(mockConversations);
        setIsLoading(false);
        
        // In production, connect to your backend API
        // const response = await fetch('/api/live-conversations');
        // const data = await response.json();
        // if (data.success) {
        //   setConversations(data.conversations);
        // }
      } catch (error) {
        console.error('Error fetching conversations:', error);
        setIsLoading(false);
      }
    };
    
    fetchConversations();
    
    // Set up periodic refresh (every 10 seconds)
    const intervalId = window.setInterval(() => {
      fetchConversations();
    }, 10000);
    
    activeRefreshInterval.current = intervalId;
    
    return () => {
      if (activeRefreshInterval.current !== null) {
        clearInterval(activeRefreshInterval.current);
      }
    };
  }, []);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [selectedConversation]);
  
  // Drive selectedConversation from URL params
  useEffect(() => {
    if (params?.conversationId && conversations.length > 0) {
      const conversation = conversations.find(c => c.id === params.conversationId);
      if (conversation) {
        setSelectedConversation(conversation);
        setShowSmartSuggestions(conversation.active);
        
        // Mark as no longer needing attention
        if (conversation.needsAttention) {
          const updatedConversations = conversations.map(c => 
            c.id === conversation.id ? { ...c, needsAttention: false } : c
          );
          setConversations(updatedConversations);
        }
      }
    } else {
      // Clear selection when no conversationId in URL
      setSelectedConversation(null);
    }
  }, [params?.conversationId, conversations]);

  // Handle conversation selection - navigate to URL
  const handleSelectConversation = (conversation: Conversation) => {
    setLocation(`/live-conversations/${conversation.id}`);
  };
  
  // Handle back navigation - return to list
  const handleBackToList = () => {
    setLocation('/live-conversations');
  };
  
  // Handle message send
  const handleSendMessage = () => {
    if (!messageInput.trim() || !selectedConversation) return;
    
    // Create a new message
    const newMessage: Message = {
      id: `${selectedConversation.id}-${selectedConversation.messages.length + 1}`,
      text: messageInput,
      sender: 'user', // When sent from dashboard, it's marked as user but will show as "agent" in UI
      timestamp: new Date()
    };
    
    // Update the conversation
    const updatedConversation = {
      ...selectedConversation,
      messages: [...selectedConversation.messages, newMessage]
    };
    
    // Update the conversations list
    const updatedConversations = conversations.map(c => 
      c.id === selectedConversation.id ? updatedConversation : c
    );
    
    // Update state
    setSelectedConversation(updatedConversation);
    setConversations(updatedConversations);
    setMessageInput('');
    
    // In a real implementation, you would send this to your backend
    // fetch('/api/send-message', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({
    //     conversationId: selectedConversation.id,
    //     message: messageInput,
    //     sender: 'agent'
    //   })
    // });
    
    toast({
      title: "Message Sent",
      description: "Your message has been sent to the customer."
    });
  };
  
  // Handle "Take Over" from AI
  const handleTakeOver = () => {
    if (!selectedConversation) return;
    
    toast({
      title: "Conversation Taken Over",
      description: "You are now directly communicating with the customer. The Clean Machine Assistant has been paused.",
    });
    
    // In a real implementation, you would notify your backend
    // fetch('/api/take-over-conversation', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({
    //     conversationId: selectedConversation.id
    //   })
    // });
  };
  
  // Smart reply suggestions
  const getSmartReplySuggestions = () => {
    // In a real implementation, these would be generated by your AI based on conversation context
    if (!selectedConversation) return [];
    
    const lastMessage = selectedConversation.messages[selectedConversation.messages.length - 1];
    
    // Generate different suggestions based on conversation content
    if (selectedConversation.id === '1') {
      return [
        "I've booked your Tuesday appointment for the ceramic coating. Is there anything else you need to know?",
        "Great! I've scheduled your Model Y for Tuesday at 10am. Can you provide your address for the appointment?",
        "Perfect, I've added the ceramic coating appointment. Do you have any other questions about the process?"
      ];
    } else if (selectedConversation.id === '2') {
      return [
        "I can reschedule you for Monday at 2pm. Does that work for you?",
        "I have an opening on Tuesday at 3:30pm. Would that be convenient?",
        "Let me take care of rescheduling that for you. Can I get your full name to verify your appointment?"
      ];
    }
    
    // Default suggestions
    return [
      "I'd be happy to help with that. Can you provide more information?",
      "Thank you for your message. Let me check on that for you.",
      "I understand your request. Is there anything else you need assistance with?"
    ];
  };
  
  // Apply smart reply
  const applySuggestion = (suggestion: string) => {
    setMessageInput(suggestion);
  };
  
  // Format time for display
  const formatMessageTime = (date: Date) => {
    return format(date, 'h:mm a');
  };
  
  // Format conversation start time
  const formatConversationTime = (date: Date) => {
    return format(date, 'MMM d, h:mm a');
  };
  
  // Determine the best action for a conversation
  const getRecommendedAction = (conversation: Conversation) => {
    // This would be more sophisticated in a real implementation based on content analysis
    if (conversation.needsAttention) {
      return "Needs human response";
    }
    
    // If the last message is from the user and hasn't been responded to for over 2 minutes
    const lastMessage = conversation.messages[conversation.messages.length - 1];
    if (lastMessage.sender === 'user' && 
        (new Date().getTime() - new Date(lastMessage.timestamp).getTime()) > 1000 * 60 * 2) {
      return "Response delayed";
    }
    
    // Default
    return "Monitoring";
  };

  const pageActions = (
    <>
      <Button variant="outline" onClick={() => setLocation('/conversation-insights')}>
        <BarChart className="mr-2 h-4 w-4" />
        Insights
      </Button>
    </>
  );

  return (
    <AppShell title="Live Conversations" pageActions={pageActions}>
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Conversations List - hide on mobile when conversation selected */}
        <div className={`md:col-span-1 border rounded-lg overflow-hidden ${selectedConversation ? 'hidden' : ''} md:block`}>
          <div className="bg-blue-50 p-4 border-b">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-medium text-blue-800">Active Conversations ({conversations.length})</h2>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  // Refresh conversations
                  if (activeRefreshInterval.current !== null) {
                    clearInterval(activeRefreshInterval.current);
                  }
                  setIsLoading(true);
                  // Simulate API call
                  setTimeout(() => {
                    setIsLoading(false);
                  }, 500);
                }}
                disabled={isLoading}
              >
                {isLoading ? "Refreshing..." : "Refresh"}
              </Button>
            </div>
            
            <div className="flex gap-2">
              <Select 
                value={categoryFilter} 
                onValueChange={setCategoryFilter}
              >
                <SelectTrigger className="w-full text-sm h-8">
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="Booking">Booking</SelectItem>
                  <SelectItem value="Inquiry">Inquiry</SelectItem>
                  <SelectItem value="Support">Support</SelectItem>
                  <SelectItem value="Feedback">Feedback</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
              
              <Select 
                value={statusFilter} 
                onValueChange={setStatusFilter}
              >
                <SelectTrigger className="w-full text-sm h-8">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="attention">Needs Attention</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="overflow-y-auto h-[calc(100vh-15rem)]">
            {conversations.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <MessageCircle className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <p>No active conversations</p>
              </div>
            ) : (
              <div className="divide-y">
                {/* Filter conversations based on selected filters */}
                {conversations.filter(conversation => {
                  // Apply category filter
                  if (categoryFilter !== 'all' && conversation.category !== categoryFilter) {
                    return false;
                  }
                  
                  // Apply status filter
                  if (statusFilter === 'active' && !conversation.active) {
                    return false;
                  } else if (statusFilter === 'attention' && !conversation.needsAttention) {
                    return false;
                  } else if (statusFilter === 'resolved' && conversation.active) {
                    return false;
                  }
                  
                  return true;
                }).map((conversation) => (
                  <div 
                    key={conversation.id}
                    className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                      selectedConversation?.id === conversation.id ? 'bg-blue-50' : ''
                    } ${conversation.needsAttention ? 'border-l-4 border-l-red-500' : ''}`}
                    onClick={() => handleSelectConversation(conversation)}
                  >
                    <div className="flex justify-between mb-1">
                      <h3 className="font-medium">
                        {conversation.customerName || "Customer"}
                      </h3>
                      <Badge 
                        variant={conversation.needsAttention ? "destructive" : "outline"}
                      >
                        {getRecommendedAction(conversation)}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-600 mb-1 truncate">
                      {conversation.messages[conversation.messages.length - 1].text}
                    </div>
                    
                    {/* Category, Intent and Topics */}
                    {conversation.category && (
                      <div className="flex flex-wrap gap-1 mb-1">
                        <Badge variant="outline" className={`text-xs ${conversation.category === 'Booking' ? 'bg-blue-100 text-blue-800' : 
                                                               conversation.category === 'Support' ? 'bg-amber-100 text-amber-800' :
                                                               conversation.category === 'Inquiry' ? 'bg-green-100 text-green-800' :
                                                               conversation.category === 'Feedback' ? 'bg-purple-100 text-purple-800' : 
                                                               'bg-gray-100'}`}>
                          {conversation.category}
                        </Badge>
                        
                        {/* Show booking intent if it exists */}
                        {conversation.intent && (
                          <Badge variant="outline" className={`text-xs ${
                            conversation.intent === 'Ready to Book' ? 'bg-green-100 text-green-800' : 
                            conversation.intent === 'Considering Booking' ? 'bg-amber-100 text-amber-800' : 
                            'bg-blue-50'
                          }`}>
                            {conversation.intent}
                          </Badge>
                        )}
                        
                        {conversation.topics?.slice(0, 2).map((topic, i) => (
                          <Badge key={i} variant="outline" className="text-xs bg-blue-50">
                            {topic}
                          </Badge>
                        ))}
                        {conversation.topics && conversation.topics.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{conversation.topics.length - 2}
                          </Badge>
                        )}
                      </div>
                    )}
                    
                    <div className="flex justify-between items-center text-xs text-gray-500">
                      <div className="flex items-center">
                        <Phone className="h-3 w-3 mr-1" />
                        {conversation.customerPhone}
                      </div>
                      <div className="flex items-center">
                        <Clock className="h-3 w-3 mr-1" />
                        {formatConversationTime(conversation.startTime)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        {/* Conversation Detail - hide on mobile when no conversation selected */}
        <div className={`md:col-span-2 border rounded-lg overflow-hidden h-[calc(100vh-12rem)] conversation-detail ${selectedConversation ? 'flex flex-col' : 'hidden'} md:flex md:flex-col`}>
          {selectedConversation ? (
            <>
              {/* Conversation Header */}
              <div className="bg-blue-50 p-4 border-b flex justify-between items-center conversation-header">
                <div className="flex items-center">
                  {/* Mobile back button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleBackToList}
                    className="md:hidden mr-2 p-2"
                    data-testid="button-back-to-list"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                  
                  <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                    <User className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="font-medium">{selectedConversation.customerName || "Customer"}</h2>
                    <div className="text-sm text-gray-600">{selectedConversation.customerPhone}</div>
                  </div>
                </div>
                <div>
                  <Button 
                    variant="outline"
                    size="sm"
                    className="text-red-600 border-red-200 hover:bg-red-50"
                    onClick={handleTakeOver}
                  >
                    <AlertCircle className="mr-2 h-4 w-4" />
                    Take Over Conversation
                  </Button>
                </div>
              </div>
              
              {/* Messages - using our new message-area class */}
              <div className="flex-grow overflow-y-auto bg-gray-50 p-4 message-area">
                <div className="space-y-4">
                  {selectedConversation.messages.map((message) => (
                    <div 
                      key={message.id}
                      className={`flex ${message.sender === 'user' ? 'justify-start' : 'justify-end'}`}
                    >
                      <div 
                        className={`rounded-lg p-3 max-w-[80%] ${
                          message.sender === 'user' 
                            ? 'bg-white border shadow-sm' 
                            : 'bg-blue-600 text-white'
                        }`}
                      >
                        <div className="text-sm mb-1 flex justify-between gap-4 items-center">
                          <span className="font-medium">
                            {message.sender === 'user' 
                              ? (selectedConversation.customerName || 'Customer') 
                              : 'Clean Machine Assistant'}
                          </span>
                          <span className="text-xs opacity-75">
                            {formatMessageTime(new Date(message.timestamp))}
                          </span>
                        </div>
                        <div>{message.text}</div>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Typing Indicator */}
                {isTyping && selectedConversation?.active && (
                  <div className="flex mb-4 justify-start">
                    <div className="bg-gray-100 text-gray-800 p-3 rounded-lg rounded-bl-none max-w-[80%]">
                      <div className="flex items-center space-x-1">
                        <div className="h-2 w-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="h-2 w-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="h-2 w-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                      <div className="text-xs mt-1 text-gray-500">
                        Typing{typingFrames[typingFrame]}
                      </div>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>
              
              {/* Combined input and suggestions area with the input-suggestion-area class */}
              <div className="input-suggestion-area">
                {/* Smart Reply Suggestions */}
                {showSmartSuggestions && (
                  <div className="p-2 bg-gray-100 border-t">
                    <p className="text-xs text-gray-500 mb-2">Smart Reply Suggestions:</p>
                    <div className="flex gap-2 flex-wrap">
                      {getSmartReplySuggestions().map((suggestion, index) => (
                        <button
                          key={index}
                          className="text-xs bg-white px-3 py-1 rounded-full border hover:bg-blue-50 transition-colors mb-1"
                          onClick={() => applySuggestion(suggestion)}
                        >
                          {suggestion.length > 40 ? suggestion.substring(0, 40) + "..." : suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Message Input */}
                <div className="p-3 border-t bg-white">
                  <div className="flex gap-2">
                    <textarea
                      className="flex-grow rounded-md border p-2 text-sm"
                      placeholder="Type your response here..."
                      rows={2}
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                    ></textarea>
                    <Button 
                      className="self-end"
                      onClick={handleSendMessage}
                      disabled={!messageInput.trim()}
                    >
                      <CornerDownRight className="h-4 w-4 mr-2" />
                      Send
                    </Button>
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    Press Enter to send. Use Shift+Enter for new line.
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-grow flex flex-col items-center justify-center bg-gray-50 p-8 text-center">
              <MessageCircle className="h-12 w-12 text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-700 mb-2">No Conversation Selected</h3>
              <p className="text-gray-500 max-w-md">
                Select a conversation from the list to view the details and interact with the customer.
              </p>
            </div>
          )}
        </div>
        </div>
      </div>
    </AppShell>
  );
}