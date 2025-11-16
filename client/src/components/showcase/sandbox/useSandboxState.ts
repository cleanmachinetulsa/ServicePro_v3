import { useState, useCallback } from 'react';
import { Message, TimelineEvent, SandboxMode, ConversationState, INITIAL_MESSAGES, INITIAL_EVENTS } from './sandboxConfig';

export function useSandboxState(mode: SandboxMode) {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES[mode]);
  const [events, setEvents] = useState<TimelineEvent[]>(INITIAL_EVENTS[mode]);
  const [state, setState] = useState<ConversationState>('greeting');
  const [customerData, setCustomerData] = useState<{
    name?: string;
    address?: string;
    service?: string;
  }>({});

  const addMessage = useCallback((text: string, sender: 'customer' | 'agent') => {
    const newMessage: Message = {
      id: Date.now().toString(),
      text,
      sender,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, newMessage]);
    return newMessage;
  }, []);

  const addEvent = useCallback((type: TimelineEvent['type'], message: string, details?: string) => {
    const newEvent: TimelineEvent = {
      id: Date.now().toString(),
      type,
      message,
      timestamp: new Date(),
      details
    };
    setEvents(prev => [...prev, newEvent]);
  }, []);

  const processMessage = useCallback((userText: string) => {
    // Add customer message
    addMessage(userText, 'customer');

    // Simple keyword-based responses
    const lowerText = userText.toLowerCase();
    let agentResponse = '';
    
    // Mode-specific logic
    if (mode === 'new-lead') {
      if (state === 'greeting' && !customerData.service) {
        setCustomerData(prev => ({ ...prev, service: userText }));
        setState('collecting_name');
        agentResponse = 'Perfect! What name should I put this under?';
        addEvent('tag', 'Service type captured', `Service: ${userText}`);
      } else if (state === 'collecting_name' && !customerData.name) {
        setCustomerData(prev => ({ ...prev, name: userText }));
        setState('collecting_address');
        agentResponse = `Great to meet you, ${userText}! What's the address where we'll be detailing?`;
        addEvent('tag', 'Customer name recorded', `Name: ${userText}`);
      } else if (state === 'collecting_address' && !customerData.address) {
        setCustomerData(prev => ({ ...prev, address: userText }));
        setState('offering_slots');
        agentResponse = 'Checking availability for your area... I have Tuesday at 2-4pm, Wednesday at 10am-12pm, or Thursday at 3-5pm. Which works best?';
        addEvent('rule', 'Service area check passed', 'Location: Within service radius');
        addEvent('schedule', 'Available slots calculated', 'Optimized based on route and weather');
      } else if (state === 'offering_slots') {
        setState('confirming');
        const selectedSlot = lowerText.includes('tuesday') ? 'Tuesday 2-4pm' : 
                           lowerText.includes('wednesday') ? 'Wednesday 10am-12pm' : 
                           lowerText.includes('thursday') ? 'Thursday 3-5pm' : 'Tuesday 2-4pm';
        agentResponse = `Perfect! You're all set for ${selectedSlot}. I'll send a confirmation text 24 hours before with weather updates. See you then! 🚗✨`;
        addEvent('schedule', `Appointment confirmed: ${selectedSlot}`, 'Status: booked');
        addEvent('schedule', 'Reminder scheduled', 'Will send 24h before with weather check');
        addEvent('tag', 'Customer status updated', 'Status: Active customer');
        addEvent('email', 'Welcome email queued', 'Will send: booking confirmation + what to expect');
        setState('completed');
      }
    } else if (mode === 'rain-reschedule') {
      if (lowerText.includes('reschedule') || lowerText.includes('move') || lowerText.includes('change')) {
        agentResponse = 'No problem! I have Friday at 1-3pm, Saturday at 9-11am, or next Monday at 2-4pm. What works better?';
        addEvent('schedule', 'Original appointment moved', 'Previous: Tomorrow 10am-12pm');
        addEvent('rule', 'Waived reschedule fee', 'Reason: Weather policy');
      } else if (lowerText.includes('indoor') || lowerText.includes('garage')) {
        agentResponse = 'Perfect! We\'ll plan for an indoor detail. Make sure there\'s enough light and we\'re good to go. See you tomorrow!';
        addEvent('tag', 'Location updated', 'Type: Indoor/covered');
        setState('completed');
      } else if (lowerText.includes('keep') || lowerText.includes('brave')) {
        agentResponse = 'Got it! We\'ll monitor the forecast and reach out if it gets worse. Otherwise, see you tomorrow rain or shine! 💪';
        addEvent('tag', 'Customer confirmed', 'Decision: Proceed despite weather');
        setState('completed');
      } else if (lowerText.includes('friday') || lowerText.includes('saturday') || lowerText.includes('monday')) {
        const day = lowerText.includes('friday') ? 'Friday 1-3pm' :
                    lowerText.includes('saturday') ? 'Saturday 9-11am' : 'Monday 2-4pm';
        agentResponse = `Awesome! You're rescheduled for ${day}. I'll send a reminder the day before. Thanks for being flexible!`;
        addEvent('schedule', `New appointment: ${day}`, 'Priority rebooking applied');
        addEvent('sms', 'Confirmation sent', `Rescheduled to ${day}`);
        setState('completed');
      }
    } else if (mode === 'follow-up') {
      if (lowerText.includes('yes') || lowerText.includes('sure') || lowerText.includes('happy')) {
        agentResponse = 'You\'re awesome! Here\'s the link: [Google Review]. Also, did you know we offer a maintenance membership? Get 20% off all year for just $49/month.';
        addEvent('email', 'Review link sent', 'Platform: Google Reviews');
        addEvent('tag', 'Review requested', 'Status: Link sent');
        addEvent('rule', 'Upsell opportunity triggered', 'Offer: Maintenance membership');
      } else if (lowerText.includes('discount') || lowerText.includes('deal')) {
        agentResponse = 'Absolutely! As a thank you, here\'s 15% off your next detail. Book within 30 days and it\'s yours!';
        addEvent('tag', 'Discount code generated', 'Code: THANKS15, expires in 30 days');
      } else if (lowerText.includes('maintenance') || lowerText.includes('membership')) {
        agentResponse = 'Our maintenance plan is perfect for keeping your car looking fresh! $49/month gets you quarterly details (normally $120 each), priority booking, and 20% off all add-ons. Want to sign up?';
        addEvent('rule', 'Maintenance plan pitched', 'Potential revenue: $588/year');
      }
    } else if (mode === 'upsell') {
      if (lowerText.includes('ceramic') || lowerText.includes('coating') || lowerText.includes('tell me') || lowerText.includes('more')) {
        agentResponse = 'Ceramic coating creates a protective layer that lasts 3-5 years. Your car stays cleaner longer, water beads off like magic, and it\'s way easier to wash. Normally $599, but if you add it today: $499. Want to do it?';
        addEvent('rule', 'Upsell details provided', 'Product: Ceramic coating, discount applied');
      } else if (lowerText.includes('yes') || lowerText.includes('do it') || lowerText.includes('add')) {
        agentResponse = 'Amazing choice! I\'ll add ceramic coating to your next visit. You just saved $100! I\'ll send over the updated invoice with the total. Thanks for trusting us with your car! 🚗✨';
        addEvent('schedule', 'Ceramic coating added', 'Service date: Next appointment');
        addEvent('email', 'Updated invoice sent', 'New total: $499 (saved $100)');
        addEvent('tag', 'Upsell successful', 'Revenue added: +$499');
        setState('completed');
      } else if (lowerText.includes('membership') || lowerText.includes('how much')) {
        agentResponse = 'Great question! Our membership is $49/month and includes quarterly full details (save $180/year), priority booking, and 20% off everything else. Want to join?';
        addEvent('rule', 'Alternative upsell offered', 'Product: Membership plan');
      } else if (lowerText.includes('not') || lowerText.includes('no thanks')) {
        agentResponse = 'No worries at all! The offer stands if you change your mind. Thanks again for choosing us! 😊';
        addEvent('tag', 'Upsell declined', 'Status: Not interested');
        setState('completed');
      }
    } else {
      // Free play mode - basic keyword responses
      if (lowerText.includes('detail') || lowerText.includes('clean')) {
        agentResponse = 'Great! We offer full interior/exterior details, just exterior, just interior, and ceramic coating. What sounds good?';
        addEvent('tag', 'Service inquiry', 'Type: General detail');
      } else if (lowerText.includes('price') || lowerText.includes('cost') || lowerText.includes('much')) {
        agentResponse = 'Pricing depends on your vehicle size and service. Sedans start at $120 for a full detail, SUVs at $150. Want a specific quote?';
        addEvent('tag', 'Pricing inquiry', 'Provided: Base pricing');
      } else if (lowerText.includes('tomorrow') || lowerText.includes('available') || lowerText.includes('book')) {
        agentResponse = 'Let me check availability... I have slots tomorrow at 10am, 1pm, and 4pm. Which time works for you?';
        addEvent('schedule', 'Availability checked', 'Date: Tomorrow');
      } else if (lowerText.includes('where') || lowerText.includes('location')) {
        agentResponse = 'We\'re mobile - we come to you! We service the Greater Boston area (within 25 miles of downtown). Where are you located?';
        addEvent('rule', 'Service area inquiry', 'Radius: 25 miles');
      } else {
        agentResponse = 'I\'m here to help! You can ask about our services, pricing, availability, or book an appointment. What would you like to know?';
      }
    }

    // Add agent response with delay for realism
    setTimeout(() => {
      addMessage(agentResponse, 'agent');
      addEvent('sms', 'Response sent', agentResponse.substring(0, 50) + '...');
    }, 500);
  }, [mode, state, customerData, addMessage, addEvent]);

  const reset = useCallback(() => {
    setMessages(INITIAL_MESSAGES[mode]);
    setEvents(INITIAL_EVENTS[mode]);
    setState('greeting');
    setCustomerData({});
  }, [mode]);

  return {
    messages,
    events,
    state,
    customerData,
    processMessage,
    reset
  };
}
