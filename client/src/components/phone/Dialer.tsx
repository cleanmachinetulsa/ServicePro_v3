import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Phone, Delete, MessageCircle, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { useLocation } from 'wouter';
import { toE164, formatAsYouType, isValid } from '@/lib/phone';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function Dialer() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const { toast} = useToast();
  const [, setLocation] = useLocation();

  const callMutation = useMutation({
    mutationFn: async (number: string) => {
      return await apiRequest('POST', '/api/calls/initiate', { to: number });
    },
    onSuccess: () => {
      toast({ 
        title: 'Calling...', 
        description: `Connecting to ${phoneNumber}`,
        duration: 2000
      });
      setPhoneNumber('');
    },
    onError: (error: any) => {
      const errorMessage = error.message || 'Unable to initiate call';
      const isTwilioError = errorMessage.includes('Twilio');
      
      toast({ 
        title: isTwilioError ? 'Phone service not configured' : 'Call failed', 
        description: isTwilioError 
          ? 'Twilio Voice service is not yet configured. Contact support to enable calling.' 
          : errorMessage,
        variant: 'destructive',
        duration: 8000, // 8 seconds for error toasts
        action: !isTwilioError ? (
          <ToastAction altText="Try again" onClick={() => handleCall()}>
            Retry
          </ToastAction>
        ) : undefined,
      });
    },
  });

  const handleKeyPress = (digit: string) => {
    if (phoneNumber.length >= 15) return; // Max 15 chars
    const newNumber = phoneNumber.replace(/\D/g, '') + digit;
    setPhoneNumber(formatAsYouType(newNumber));
  };

  const handleDelete = () => {
    const digits = phoneNumber.replace(/\D/g, '');
    if (digits.length === 0) return;
    const newDigits = digits.slice(0, -1);
    setPhoneNumber(formatAsYouType(newDigits));
  };

  const handleCall = () => {
    if (!isValid(phoneNumber)) {
      toast({ 
        title: 'Invalid number', 
        description: 'Please enter a valid phone number',
        variant: 'destructive',
        duration: 8000, // 8 seconds for validation errors
      });
      return;
    }
    
    const e164Number = toE164(phoneNumber);
    if (!e164Number) {
      toast({ 
        title: 'Invalid number', 
        description: 'Unable to process phone number',
        variant: 'destructive',
        duration: 8000, // 8 seconds for validation errors
      });
      return;
    }
    
    // Show confirmation dialog before calling
    setShowConfirmDialog(true);
  };

  const handleConfirmCall = () => {
    const e164Number = toE164(phoneNumber);
    if (e164Number) {
      callMutation.mutate(e164Number);
    }
    setShowConfirmDialog(false);
  };

  const handleMessage = () => {
    if (!isValid(phoneNumber)) {
      toast({ 
        title: 'Invalid number', 
        description: 'Please enter a valid phone number',
        variant: 'destructive',
        duration: 8000, // 8 seconds for validation errors
      });
      return;
    }
    
    const e164Number = toE164(phoneNumber);
    if (!e164Number) {
      toast({ 
        title: 'Invalid number', 
        description: 'Unable to process phone number',
        variant: 'destructive',
        duration: 8000, // 8 seconds for validation errors
      });
      return;
    }
    
    setLocation(`/messages?new=${encodeURIComponent(e164Number)}`);
  };

  const dialPadButtons = [
    { digit: '1', letters: '' },
    { digit: '2', letters: 'ABC' },
    { digit: '3', letters: 'DEF' },
    { digit: '4', letters: 'GHI' },
    { digit: '5', letters: 'JKL' },
    { digit: '6', letters: 'MNO' },
    { digit: '7', letters: 'PQRS' },
    { digit: '8', letters: 'TUV' },
    { digit: '9', letters: 'WXYZ' },
    { digit: '*', letters: '' },
    { digit: '0', letters: '+' },
    { digit: '#', letters: '' },
  ];

  return (
    <div className="max-w-md mx-auto px-6 py-8 flex flex-col h-full">
      {/* Display */}
      <div className="mb-8">
        <div className="text-center">
          <input
            type="tel"
            value={phoneNumber}
            readOnly
            placeholder="Enter number"
            className="text-4xl font-light text-center w-full bg-transparent border-none outline-none dark:text-white tracking-wider"
            data-testid="input-phone-display"
          />
        </div>
      </div>

      {/* Dial Pad */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {dialPadButtons.map((btn) => (
          <button
            key={btn.digit}
            onClick={() => handleKeyPress(btn.digit)}
            className="aspect-square rounded-full bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shadow-sm border dark:border-gray-700 flex flex-col items-center justify-center"
            data-testid={`button-dial-${btn.digit}`}
          >
            <span className="text-3xl font-light dark:text-white">{btn.digit}</span>
            {btn.letters && (
              <span className="text-xs text-muted-foreground uppercase mt-1">
                {btn.letters}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-center gap-6 mt-auto">
        {/* Message Button */}
        <Button
          variant="outline"
          size="lg"
          onClick={handleMessage}
          disabled={phoneNumber.replace(/\D/g, '').length < 10}
          className="rounded-full h-16 w-16 p-0"
          data-testid="button-message"
        >
          <MessageCircle className="h-6 w-6" />
        </Button>

        {/* Call Button */}
        <Button
          onClick={handleCall}
          disabled={callMutation.isPending || phoneNumber.replace(/\D/g, '').length < 10}
          className="rounded-full h-20 w-20 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800 p-0 shadow-lg"
          data-testid="button-call"
        >
          <Phone className="h-8 w-8" />
        </Button>

        {/* Delete Button */}
        <Button
          variant="ghost"
          size="lg"
          onClick={handleDelete}
          disabled={phoneNumber.length === 0}
          className="rounded-full h-16 w-16 p-0"
          data-testid="button-delete"
        >
          <Delete className="h-6 w-6" />
        </Button>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Confirm Call
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              Are you sure you want to call <span className="font-semibold text-foreground">{phoneNumber}</span>?
              <br />
              <br />
              <span className="text-sm text-muted-foreground">You will receive a call first, then be connected to the customer.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-call">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmCall}
              className="bg-green-600 hover:bg-green-700"
              data-testid="button-confirm-call"
            >
              Call Now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
