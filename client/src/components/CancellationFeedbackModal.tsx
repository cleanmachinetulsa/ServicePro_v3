import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

interface CancellationFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmCancellation: (feedback: CancellationFeedback) => void;
  appointmentDetails: {
    service: string;
    date: string;
    time: string;
    customerName: string;
  };
}

export interface CancellationFeedback {
  reason: string;
  category: 'scheduling' | 'pricing' | 'service_concerns' | 'personal' | 'found_alternative' | 'other';
  additionalComments: string;
  wouldReschedule: boolean;
  timestamp: string;
  suggestedResponse?: string;
}

const cancellationReasons = [
  {
    category: 'scheduling' as const,
    label: 'Scheduling Issues',
    reasons: [
      'The appointment time no longer works for me',
      'I need to reschedule for a different date',
      'Unexpected schedule conflict came up',
      'Weather concerns for the appointment day'
    ]
  },
  {
    category: 'pricing' as const,
    label: 'Pricing Concerns',
    reasons: [
      'Service cost is higher than expected',
      'Found a more affordable alternative',
      'Budget constraints at this time',
      'Unclear about what\'s included in the service'
    ]
  },
  {
    category: 'service_concerns' as const,
    label: 'Service Concerns',
    reasons: [
      'Not sure if this service meets my needs',
      'Want to research more before committing',
      'Concerned about the process or methods used',
      'Vehicle condition changed since booking'
    ]
  },
  {
    category: 'personal' as const,
    label: 'Personal Reasons',
    reasons: [
      'Family emergency or personal situation',
      'Vehicle is no longer available',
      'Travel plans changed',
      'Health-related concerns'
    ]
  },
  {
    category: 'found_alternative' as const,
    label: 'Found Alternative',
    reasons: [
      'Decided to do it myself',
      'Found another service provider',
      'Friend/family offered to help',
      'Dealership will handle it instead'
    ]
  }
];

export default function CancellationFeedbackModal({
  isOpen,
  onClose,
  onConfirmCancellation,
  appointmentDetails
}: CancellationFeedbackModalProps) {
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<CancellationFeedback['category']>('other');
  const [additionalComments, setAdditionalComments] = useState<string>('');
  const [wouldReschedule, setWouldReschedule] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [suggestedResponse, setSuggestedResponse] = useState<string>('');
  const { toast } = useToast();

  // Generate personalized cancellation response based on reason and customer name
  const generateCancellationResponse = (firstName: string, reason: string = ""): string => {
    const base = `Totally understand, ${firstName}—thanks for the update! I really appreciate you letting us know.`;

    let followup = "";
    
    if (reason.toLowerCase().includes("someone") && reason.toLowerCase().includes("today")) {
      followup = "Glad you were able to get it taken care of today!";
    } else if (["reschedule", "another time", "not ready", "wait", "later"].some(word => 
      reason.toLowerCase().includes(word))) {
      followup = "No worries at all—just let us know when you're ready and we'll be here!";
    } else if (reason.toLowerCase().includes("found another") || reason.toLowerCase().includes("found a more")) {
      followup = "Thanks again for sharing that with us!";
    } else if (reason.toLowerCase().includes("budget") || reason.toLowerCase().includes("cost") || reason.toLowerCase().includes("afford")) {
      followup = "I completely understand—we appreciate you being upfront about that!";
    } else if (reason.toLowerCase().includes("emergency") || reason.toLowerCase().includes("personal") || reason.toLowerCase().includes("family")) {
      followup = "Hope everything works out well for you and your family.";
    } else if (reason.trim() === "") {
      followup = "Thanks again for reaching out—we always appreciate clear communication.";
    } else {
      followup = "Thanks again for sharing that with us!";
    }

    const closing = "Either way, I look forward to another chance to help you out soon.";

    return `${base}\n\n${followup}\n\n${closing}`;
  };

  const handleSubmit = async () => {
    if (!selectedReason.trim()) {
      toast({
        title: 'Please select a reason',
        description: 'We\'d appreciate knowing why you\'re cancelling to help us improve.',
        variant: 'destructive'
      });
      return;
    }

    setIsSubmitting(true);

    // Extract first name from customer name
    const firstName = appointmentDetails.customerName.split(' ')[0];
    
    // Generate personalized response
    const responseText = generateCancellationResponse(firstName, selectedReason + ' ' + additionalComments);

    const feedback: CancellationFeedback = {
      reason: selectedReason,
      category: selectedCategory,
      additionalComments: additionalComments.trim(),
      wouldReschedule,
      timestamp: new Date().toISOString(),
      suggestedResponse: responseText
    };

    try {
      // Submit feedback to backend
      await fetch('/api/cancellation-feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          appointmentDetails,
          feedback
        })
      });

      onConfirmCancellation(feedback);
      
      toast({
        title: 'Thank you for your feedback',
        description: 'Your appointment has been cancelled. We appreciate you taking the time to help us improve.',
      });
    } catch (error) {
      console.error('Error submitting cancellation feedback:', error);
      // Still proceed with cancellation even if feedback submission fails
      onConfirmCancellation(feedback);
      
      toast({
        title: 'Appointment cancelled',
        description: 'Your appointment has been cancelled successfully.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReasonSelect = (reason: string, category: CancellationFeedback['category']) => {
    setSelectedReason(reason);
    setSelectedCategory(category);
    
    // Generate suggested response immediately when reason is selected
    const firstName = appointmentDetails.customerName.split(' ')[0];
    const responseText = generateCancellationResponse(firstName, reason);
    setSuggestedResponse(responseText);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-center">
            We're sorry to see you cancel
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Appointment Details */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4">
              <h4 className="font-medium text-blue-900 mb-2">Cancelling Appointment:</h4>
              <div className="text-sm text-blue-800">
                <p><strong>Service:</strong> {appointmentDetails.service}</p>
                <p><strong>Date:</strong> {appointmentDetails.date}</p>
                <p><strong>Time:</strong> {appointmentDetails.time}</p>
                <p><strong>Customer:</strong> {appointmentDetails.customerName}</p>
              </div>
            </CardContent>
          </Card>

          {/* Feedback Request */}
          <div className="text-center space-y-2">
            <p className="text-gray-700">
              To help us provide the best possible experience for our customers, 
              could you share what led to this cancellation?
            </p>
            <p className="text-sm text-gray-500">
              Your feedback is valuable and helps us improve our services.
            </p>
          </div>

          {/* Reason Selection */}
          <div className="space-y-4">
            <Label className="text-base font-medium">What's the main reason for cancelling?</Label>
            
            {cancellationReasons.map((group) => (
              <div key={group.category} className="space-y-2">
                <h4 className="font-medium text-gray-900 text-sm">{group.label}</h4>
                <RadioGroup
                  value={selectedReason}
                  onValueChange={(value) => handleReasonSelect(value, group.category)}
                  className="space-y-2"
                >
                  {group.reasons.map((reason) => (
                    <div key={reason} className="flex items-center space-x-2">
                      <RadioGroupItem value={reason} id={reason} />
                      <Label htmlFor={reason} className="text-sm cursor-pointer">
                        {reason}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            ))}

            {/* Other option */}
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900 text-sm">Other</h4>
              <RadioGroup
                value={selectedReason}
                onValueChange={(value) => handleReasonSelect(value, 'other')}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="other_reason" id="other_reason" />
                  <Label htmlFor="other_reason" className="text-sm cursor-pointer">
                    Other reason (please specify below)
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </div>

          {/* Would Reschedule */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Would you be interested in rescheduling?</Label>
            <RadioGroup
              value={wouldReschedule ? 'yes' : 'no'}
              onValueChange={(value) => setWouldReschedule(value === 'yes')}
              className="flex space-x-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id="reschedule_yes" />
                <Label htmlFor="reschedule_yes" className="cursor-pointer">Yes, I'd like to reschedule</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id="reschedule_no" />
                <Label htmlFor="reschedule_no" className="cursor-pointer">No, not at this time</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Additional Comments */}
          <div className="space-y-2">
            <Label htmlFor="comments" className="text-base font-medium">
              Additional comments (optional)
            </Label>
            <Textarea
              id="comments"
              placeholder="Is there anything else you'd like us to know? Any suggestions for improvement?"
              value={additionalComments}
              onChange={(e) => setAdditionalComments(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Suggested Response Preview */}
          {suggestedResponse && (
            <Card className="bg-green-50 border-green-200">
              <CardContent className="p-4">
                <h4 className="font-medium text-green-900 mb-2 flex items-center">
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                  </svg>
                  Suggested Response for Customer Service Team
                </h4>
                <div className="bg-white rounded-md p-3 border border-green-100">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{suggestedResponse}</p>
                </div>
                <p className="text-xs text-green-700 mt-2">
                  ✓ This personalized response will be saved with the cancellation feedback for your team to use when following up with {appointmentDetails.customerName}.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={isSubmitting}
            >
              Keep Appointment
            </Button>
            <Button
              onClick={handleSubmit}
              variant="destructive"
              className="flex-1"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Cancelling...' : 'Confirm Cancellation'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}