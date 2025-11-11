import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { MessageSquare, Send, Phone, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

interface Message {
  id: string;
  text: string;
  sender: 'business' | 'customer';
  timestamp: Date;
  status?: 'sending' | 'sent' | 'failed';
}

interface BusinessChatInterfaceProps {
  customerPhone: string;
  customerName?: string;
  onClose?: () => void;
}

export default function BusinessChatInterface({ 
  customerPhone, 
  customerName = '',
  onClose
}: BusinessChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Load conversation history
  useEffect(() => {
    loadConversationHistory();
  }, [customerPhone]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadConversationHistory = async () => {
    try {
      const response = await fetch(`/api/chat/history?phone=${encodeURIComponent(customerPhone)}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.messages) {
          setMessages(data.messages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          })));
        }
      }
    } catch (error) {
      console.error('Error loading conversation history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim()) return;

    const messageId = Date.now().toString();
    const newMessage: Message = {
      id: messageId,
      text: inputText.trim(),
      sender: 'business',
      timestamp: new Date(),
      status: 'sending'
    };

    setMessages(prev => [...prev, newMessage]);
    setInputText('');
    setIsSending(true);

    try {
      const response = await fetch('/api/chat/send-business-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerPhone,
          message: newMessage.text,
          messageId
        }),
      });

      const data = await response.json();

      if (data.success) {
        setMessages(prev => 
          prev.map(msg => 
            msg.id === messageId 
              ? { ...msg, status: 'sent' }
              : msg
          )
        );
        
        toast({
          title: "Message Sent",
          description: `Your message was sent to ${customerName || customerPhone}`,
        });
      } else {
        throw new Error(data.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      
      setMessages(prev => 
        prev.map(msg => 
          msg.id === messageId 
            ? { ...msg, status: 'failed' }
            : msg
        )
      );
      
      toast({
        title: "Failed to Send",
        description: "Message could not be sent. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Card className="h-full flex flex-col max-w-2xl mx-auto">
      <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-500 text-white p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-6 w-6" />
            <div>
              <CardTitle className="text-lg font-bold">
                Chat with {customerName || 'Customer'}
              </CardTitle>
              <p className="text-blue-100 text-sm">{customerPhone}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-blue-700"
              onClick={() => window.open(`tel:${customerPhone}`, '_self')}
            >
              <Phone className="h-4 w-4" />
            </Button>
            {onClose && (
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-blue-700"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0">
        <ScrollArea className="flex-1 p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-gray-500">Loading conversation...</div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-center text-gray-500">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Start a conversation with {customerName || 'your customer'}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <AnimatePresence>
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${message.sender === 'business' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-3 ${
                        message.sender === 'business'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      <p className="text-sm">{message.text}</p>
                      <div className={`flex items-center justify-between mt-1 text-xs ${
                        message.sender === 'business' ? 'text-blue-100' : 'text-gray-500'
                      }`}>
                        <span>{formatTime(message.timestamp)}</span>
                        {message.sender === 'business' && message.status && (
                          <span className={`ml-2 ${
                            message.status === 'sent' ? 'text-green-200' : 
                            message.status === 'failed' ? 'text-red-200' : 
                            'text-blue-200'
                          }`}>
                            {message.status === 'sent' ? '✓' : 
                             message.status === 'failed' ? '✗' : 
                             '⋯'}
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        <Separator />

        <div className="p-4 bg-gray-50">
          <div className="flex gap-2">
            <Textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              className="resize-none min-h-[60px] max-h-[120px]"
              disabled={isSending}
            />
            <Button
              onClick={sendMessage}
              disabled={!inputText.trim() || isSending}
              className="bg-blue-600 hover:bg-blue-700 self-end"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </CardContent>
    </Card>
  );
}