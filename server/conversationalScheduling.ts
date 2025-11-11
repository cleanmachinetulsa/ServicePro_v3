/**
 * Conversational Scheduling Orchestrator
 * Manages the entire scheduling flow through natural conversation
 */

import { generateAIResponse, extractVehicleInfo } from './openai';
import { conversationState } from './conversationState';
import { customerMemory } from './customerMemory';
import {
  checkCustomerDatabase,
  validateAddress,
  getAvailableSlots,
  getUpsellOffers,
  createAppointment,
  buildInvoiceSummary
} from './schedulingTools';

interface SchedulingOrchestrationResult {
  response: string;
  schedulingComplete: boolean;
  appointmentBooked?: boolean;
  needsUserInput: string[]; // What info we still need
}

/**
 * Main orchestration function for conversational scheduling
 * This coordinates the entire scheduling flow through natural conversation
 */
export async function handleConversationalScheduling(
  userMessage: string,
  phoneNumber: string,
  platform: "sms" | "web" = "web",
  behaviorSettings?: any
): Promise<SchedulingOrchestrationResult> {
  
  const state = conversationState.getState(phoneNumber);
  const nextStep = conversationState.getNextStep(phoneNumber);
  
  // Extract information from the message
  customerMemory.extractPersonalInfo(userMessage, phoneNumber);
  customerMemory.extractVehicleInfo(userMessage, phoneNumber);
  
  // Update conversation state with extracted info
  const memoryCustomer = customerMemory.getCustomer(phoneNumber);
  if (memoryCustomer) {
    conversationState.updateState(phoneNumber, {
      customerName: memoryCustomer.name || state.customerName,
      customerEmail: memoryCustomer.email || state.customerEmail,
      address: memoryCustomer.address || state.address,
    });
  }
  
  // Check for confirmation keywords
  const confirmationPattern = /\b(confirm|yes|correct|book it|go ahead|that'?s? right|sounds good|looks good)\b/i;
  const isConfirming = confirmationPattern.test(userMessage);
  
  // Check if customer wants to schedule
  const schedulingKeywords = /\b(book|schedule|appointment|reserve|availability|available|when can|book me|set up)\b/i;
  const isSchedulingIntent = schedulingKeywords.test(userMessage);
  
  // STEP 1: Identify Customer
  if (!state.stepsCompleted.customerIdentified && isSchedulingIntent) {
    const customerData = await checkCustomerDatabase(phoneNumber);
    
    if (customerData.found) {
      conversationState.completeStep(phoneNumber, 'customerIdentified');
      
      let greeting = `Hi ${customerData.name}! Welcome back! `;
      if (customerData.lastVisit) {
        greeting += `I see we last serviced your vehicle on ${customerData.lastVisit}. `;
      }
      if (customerData.vehicles && customerData.vehicles.length > 0) {
        greeting += `I have your ${customerData.vehicles[0]} on file. `;
      }
      greeting += `I'd be happy to help you schedule another detail. `;
      
      // Move to next step
      if (!state.address) {
        greeting += `What's your address for the service?`;
      } else {
        greeting += `What service are you interested in today?`;
      }
      
      return {
        response: greeting,
        schedulingComplete: false,
        needsUserInput: state.address ? ['service'] : ['address'],
      };
    } else {
      conversationState.completeStep(phoneNumber, 'customerIdentified');
      
      const greeting = `Hi there! I'd be happy to help you schedule a detail. To get started, could you please provide your name and address?`;
      
      return {
        response: greeting,
        schedulingComplete: false,
        needsUserInput: ['name', 'address'],
      };
    }
  }
  
  // STEP 2: Validate Address
  if (state.stepsCompleted.customerIdentified && !state.stepsCompleted.addressValidated) {
    // Check if message contains an address
    const addressPattern = /\d+\s+[\w\s]+(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|way|court|ct|boulevard|blvd|place|pl)/i;
    const hasAddress = addressPattern.test(userMessage) || state.address;
    
    if (hasAddress) {
      const addressToValidate = state.address || userMessage;
      const validationResult = await validateAddress(phoneNumber, addressToValidate);
      
      let response = validationResult.message;
      
      if (validationResult.inServiceArea) {
        response += ` Now, what type of service are you looking for?`;
        return {
          response,
          schedulingComplete: false,
          needsUserInput: ['service'],
        };
      } else if (!validationResult.valid) {
        return {
          response,
          schedulingComplete: false,
          needsUserInput: ['address'],
        };
      } else {
        // Outside service area but can continue with extended fee
        response += ` If you'd like to proceed, what service are you interested in?`;
        return {
          response,
          schedulingComplete: false,
          needsUserInput: ['service'],
        };
      }
    } else {
      return {
        response: `I need your service address to check availability. What's the address where you'd like the detail performed?`,
        schedulingComplete: false,
        needsUserInput: ['address'],
      };
    }
  }
  
  // STEP 3: Select Service
  if (state.stepsCompleted.addressValidated && !state.stepsCompleted.serviceSelected) {
    // Check if message mentions a service
    const serviceKeywords = {
      'Full Detail': /full\s*detail|complete\s*detail|everything/i,
      'Interior Detail': /interior|inside|seats|carpet/i,
      'Exterior Detail': /exterior|outside|wash|wax/i,
      'Express Wash': /express|quick|wash|basic/i,
      'Ceramic Coating': /ceramic|coating|protection/i,
      'Paint Correction': /paint\s*correction|polish|scratch/i,
    };
    
    let detectedService = null;
    for (const [serviceName, pattern] of Object.entries(serviceKeywords)) {
      if (pattern.test(userMessage)) {
        detectedService = serviceName;
        break;
      }
    }
    
    if (detectedService) {
      conversationState.updateState(phoneNumber, { service: detectedService });
      conversationState.completeStep(phoneNumber, 'serviceSelected');
      
      // Get available time slots
      const slots = await getAvailableSlots(phoneNumber, detectedService);
      
      if (slots.length > 0) {
        let response = `Perfect! For ${detectedService}, here are some available times:\n\n`;
        slots.forEach((slot, idx) => {
          response += `${idx + 1}. ${slot.formattedTime}\n`;
        });
        response += `\nWhich time works best for you?`;
        
        return {
          response,
          schedulingComplete: false,
          needsUserInput: ['time_slot'],
        };
      } else {
        // Store empty slots to signal fallback mode
        conversationState.updateState(phoneNumber, { offeredTimeSlots: [] });
        
        return {
          response: `I'm having trouble accessing our calendar right now. What day and time were you hoping for? I'll check availability and confirm with you.`,
          schedulingComplete: false,
          needsUserInput: ['time_slot'],
        };
      }
    } else {
      // Generate AI response about services
      const serviceListResponse = await generateAIResponse(
        "What services do you offer and what are the prices?",
        phoneNumber,
        platform,
        behaviorSettings
      );
      
      return {
        response: serviceListResponse + `\n\nWhich service interests you?`,
        schedulingComplete: false,
        needsUserInput: ['service'],
      };
    }
  }
  
  // STEP 4: Select Time Slot
  if (state.stepsCompleted.serviceSelected && !state.stepsCompleted.timeSlotSelected) {
    // Check for natural language date/time patterns
    const naturalTimePattern = /(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|next week|this week)/i;
    const timePattern = /(\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.))|(\d{1,2}\s*(?:am|pm|a\.m\.|p\.m\.))/i;
    
    // Handle fallback case: no slots were offered (calendar API failed)
    if (!state.offeredTimeSlots || state.offeredTimeSlots.length === 0) {
      if (naturalTimePattern.test(userMessage) || timePattern.test(userMessage)) {
        // Customer provided a natural language time
        // Store the user's requested time as a string for manual confirmation
        conversationState.updateState(phoneNumber, { 
          selectedTimeSlot: userMessage, // Store the natural language request, NOT a placeholder
        });
        conversationState.completeStep(phoneNumber, 'timeSlotSelected');
        
        // Offer upsells before going to confirmation
        const upsells = await getUpsellOffers(phoneNumber, state.service!);
        
        if (upsells.length > 0) {
          let response = `Got it! I've noted your preferred time as: ${userMessage}.\n\n`;
          response += `Would you like to add any of these services?\n\n`;
          upsells.forEach((upsell, idx) => {
            response += `${idx + 1}. ${upsell.name} - ${upsell.price}\n   ${upsell.description}\n\n`;
          });
          response += `Reply with the number(s) to add, or "no thanks" to continue.`;
          
          return {
            response,
            schedulingComplete: false,
            needsUserInput: ['upsells'],
          };
        } else {
          // Skip to manual confirmation (don't auto-book)
          conversationState.completeStep(phoneNumber, 'upsellsOffered');
          
          let response = `Perfect! I've noted your preferred time as: ${userMessage}.\n\n`;
          response += `⚠️ Note: I'll need to manually confirm this time slot with our calendar. `;
          response += `Our team will verify availability and send you a confirmation within a few hours.\n\n`;
          response += `Here are your booking details:\n\n`;
          response += `Service: ${state.service}\n`;
          response += `Requested Time: ${userMessage}\n`;
          response += `Address: ${state.address}\n\n`;
          response += `Reply "CONFIRM" to submit this request.`;
          
          return {
            response,
            schedulingComplete: false,
            needsUserInput: ['confirmation'],
          };
        }
      } else {
        return {
          response: `Please let me know what day and time work best for you (for example: "Tuesday at 2pm" or "Friday morning").`,
          schedulingComplete: false,
          needsUserInput: ['time_slot'],
        };
      }
    }
    
    // Handle numeric/ordinal slot selection
    const slotSelectionPattern = /\b(1|2|3|4|5|first|second|third|fourth|fifth|option\s*[1-5])\b/i;
    const match = userMessage.match(slotSelectionPattern);
    
    if (match && state.offeredTimeSlots && state.offeredTimeSlots.length > 0) {
      let slotIndex = 0;
      const matchText = match[1].toLowerCase();
      
      if (matchText === 'first' || matchText === '1') slotIndex = 0;
      else if (matchText === 'second' || matchText === '2') slotIndex = 1;
      else if (matchText === 'third' || matchText === '3') slotIndex = 2;
      else if (matchText === 'fourth' || matchText === '4') slotIndex = 3;
      else if (matchText === 'fifth' || matchText === '5') slotIndex = 4;
      else slotIndex = parseInt(match[1]) - 1;
      
      if (slotIndex >= 0 && slotIndex < state.offeredTimeSlots.length) {
        const selectedSlot = state.offeredTimeSlots[slotIndex];
        conversationState.updateState(phoneNumber, { selectedTimeSlot: selectedSlot.time });
        conversationState.completeStep(phoneNumber, 'timeSlotSelected');
        
        // Format the selected time
        const selectedTime = new Date(selectedSlot.time);
        const timeOptions: Intl.DateTimeFormatOptions = {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          timeZone: 'America/Chicago',
        };
        const formattedSelectedTime = selectedTime.toLocaleString('en-US', timeOptions);
        
        // Offer upsells
        const upsells = await getUpsellOffers(phoneNumber, state.service!);
        
        if (upsells.length > 0) {
          let response = `Great! I have you scheduled for ${state.service} on ${formattedSelectedTime}.\n\n`;
          response += `Would you like to add any of these services?`;
          response += `\n\n`;
          upsells.forEach((upsell, idx) => {
            response += `${idx + 1}. ${upsell.name} - ${upsell.price}\n   ${upsell.description}\n\n`;
          });
          response += `Reply with the number(s) to add, or "no thanks" to continue.`;
          
          return {
            response,
            schedulingComplete: false,
            needsUserInput: ['upsells'],
          };
        } else {
          // Skip to confirmation
          conversationState.completeStep(phoneNumber, 'upsellsOffered');
          const summary = buildInvoiceSummary(phoneNumber);
          
          return {
            response: summary,
            schedulingComplete: false,
            needsUserInput: ['confirmation'],
          };
        }
      }
    }
    
    return {
      response: `Please select one of the available time slots by number (1, 2, 3, etc.)`,
      schedulingComplete: false,
      needsUserInput: ['time_slot'],
    };
  }
  
  // STEP 5: Handle Upsells
  if (state.stepsCompleted.timeSlotSelected && !state.stepsCompleted.upsellsOffered) {
    const declinePattern = /\b(no|nope|no thanks|skip|none|pass)\b/i;
    
    if (declinePattern.test(userMessage)) {
      conversationState.completeStep(phoneNumber, 'upsellsOffered');
      const summary = buildInvoiceSummary(phoneNumber);
      
      return {
        response: summary,
        schedulingComplete: false,
        needsUserInput: ['confirmation'],
      };
    } else {
      // Check for upsell selection
      const numbers = userMessage.match(/\b([1-4])\b/g);
      if (numbers && state.offeredUpsells) {
        const selectedUpsells = numbers
          .map(n => parseInt(n) - 1)
          .filter(idx => idx >= 0 && idx < (state.offeredUpsells?.length || 0))
          .map(idx => state.offeredUpsells![idx].name)
          .filter((name): name is string => name !== null && name !== undefined);
        
        if (selectedUpsells.length > 0) {
          conversationState.updateState(phoneNumber, { addOns: selectedUpsells });
        }
        
        conversationState.completeStep(phoneNumber, 'upsellsOffered');
        const summary = buildInvoiceSummary(phoneNumber);
        
        return {
          response: summary,
          schedulingComplete: false,
          needsUserInput: ['confirmation'],
        };
      }
    }
  }
  
  // STEP 6: Final Confirmation
  if (state.stepsCompleted.upsellsOffered && !state.stepsCompleted.finalConfirmation) {
    if (isConfirming) {
      // Check if we have a valid ISO timestamp or natural language time
      const isValidISOTime = state.selectedTimeSlot && /^\d{4}-\d{2}-\d{2}T/.test(state.selectedTimeSlot);
      
      // Only auto-book if we have a valid ISO timestamp from calendar slots
      if (isValidISOTime) {
        const bookingResult = await createAppointment(phoneNumber);
        
        if (bookingResult.success) {
          conversationState.clearState(phoneNumber);
          
          let response = `✅ Perfect! Your appointment has been confirmed!\n\n`;
          response += `You'll receive a confirmation ${state.customerEmail ? 'email' : 'text'} shortly with all the details.`;
          response += `\n\nWe'll also send you a reminder the day before your appointment.`;
          response += `\n\nIs there anything else I can help you with?`;
          
          return {
            response,
            schedulingComplete: true,
            appointmentBooked: true,
            needsUserInput: [],
          };
        } else {
          return {
            response: `I'm sorry, there was an issue creating your appointment: ${bookingResult.message}. Please try again or contact us directly.`,
            schedulingComplete: false,
            needsUserInput: ['retry'],
          };
        }
      } else {
        // Natural language time - manual confirmation needed
        conversationState.clearState(phoneNumber);
        
        let response = `✅ Thank you! Your appointment request has been submitted.\n\n`;
        response += `📋 Request Details:\n`;
        response += `Service: ${state.service}\n`;
        response += `Requested Time: ${state.selectedTimeSlot}\n`;
        response += `Address: ${state.address}\n`;
        if (state.addOns && state.addOns.length > 0) {
          response += `Add-ons: ${state.addOns.join(', ')}\n`;
        }
        response += `\n`;
        response += `Our team will review your requested time and confirm availability within a few hours. `;
        response += `You'll receive a ${state.customerEmail ? 'confirmation email' : 'text message'} once we verify the slot.\n\n`;
        response += `Is there anything else I can help you with?`;
        
        return {
          response,
          schedulingComplete: true,
          appointmentBooked: false, // Not auto-booked, needs manual confirmation
          needsUserInput: [],
        };
      }
    } else {
      // Check if customer wants to make changes
      const changePattern = /\b(change|modify|different|wrong|update|edit)\b/i;
      if (changePattern.test(userMessage)) {
        conversationState.clearState(phoneNumber);
        return {
          response: `No problem! Let's start fresh. What would you like to schedule?`,
          schedulingComplete: false,
          needsUserInput: ['service'],
        };
      }
      
      return {
        response: `Please review the appointment details above and reply "CONFIRM" to book, or let me know what you'd like to change.`,
        schedulingComplete: false,
        needsUserInput: ['confirmation'],
      };
    }
  }
  
  // Check if customer wants to start a new booking
  const newBookingPattern = /\b(new appointment|another appointment|schedule|book)\b/i;
  if (newBookingPattern.test(userMessage) && nextStep === 'complete') {
    conversationState.clearState(phoneNumber);
    const greeting = `Sure! I'd be happy to help you schedule ${state.isExistingCustomer ? 'another' : 'an'} appointment. What service are you interested in?`;
    return {
      response: greeting,
      schedulingComplete: false,
      needsUserInput: ['service'],
    };
  }
  
  // Default: Generate AI response for general questions
  const aiResponse = await generateAIResponse(userMessage, phoneNumber, platform, behaviorSettings);
  
  return {
    response: aiResponse || "I'm having trouble processing your request. Please try again.",
    schedulingComplete: false,
    needsUserInput: conversationState.getMissingFields(phoneNumber),
  };
}
