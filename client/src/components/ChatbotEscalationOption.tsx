import React from 'react';
import { Button } from '@/components/ui/button';
import { MessageSquare, User } from 'lucide-react';

interface ChatbotEscalationOptionProps {
  onEscalate: () => void;
  messageCount: number;
}

/**
 * Component that displays a human escalation option in the chatbot
 * This appears when:
 * 1. Multiple understanding failures (2-3 consecutive misunderstandings)
 * 2. Customer explicitly asks to speak to a human
 * 3. Customer uses phrases indicating urgency or frustration
 * 4. Customer asks for custom quotes or services not in standard pricing
 */
export default function ChatbotEscalationOption({
  onEscalate,
  messageCount
}: ChatbotEscalationOptionProps) {
  
  // Only show after a few messages to avoid appearing too quickly
  if (messageCount < 2) return null;
  
  return (
    <div className="w-full p-4 bg-blue-50 rounded-lg border border-blue-200 my-4">
      <h3 className="font-medium text-blue-800 flex items-center">
        <User className="mr-2 h-4 w-4" />
        Speak with Jody directly
      </h3>
      <p className="text-sm text-blue-700 mt-1 mb-3">
        Would you prefer to connect with a human? Jody can help you with custom quotes, 
        special requests, or any other questions you have.
      </p>
      <div className="flex gap-2">
        <Button 
          size="sm" 
          onClick={onEscalate}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <MessageSquare className="mr-2 h-4 w-4" />
          Connect with Jody
        </Button>
      </div>
    </div>
  );
}