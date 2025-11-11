/**
 * Conversation State Tracker for Scheduling Flow
 * Tracks what information has been collected so customers don't repeat themselves
 */

interface SchedulingInfo {
  // Customer identification
  customerPhone?: string;
  customerName?: string;
  customerEmail?: string;
  isExistingCustomer?: boolean;
  
  // Appointment details
  address?: string;
  addressValidated?: boolean;
  isInServiceArea?: boolean;
  driveTimeMinutes?: number;
  
  service?: string;
  selectedTimeSlot?: string;
  addOns?: string[];
  
  // Vehicle info
  vehicles?: Array<{
    year?: string;
    make?: string;
    model?: string;
    color?: string;
    condition?: string[];
  }>;
  
  // Damage Assessment
  damageAssessmentRequested?: boolean;
  damageDescription?: string;
  damageType?: string;
  damagePhotosUploaded?: string[];
  damageAssessmentStatus?: 'pending' | 'reviewed' | 'approved' | 'rejected';
  
  // Conversation flow tracking
  stepsCompleted: {
    customerIdentified: boolean;
    addressValidated: boolean;
    serviceSelected: boolean;
    timeSlotSelected: boolean;
    upsellsOffered: boolean;
    finalConfirmation: boolean;
  };
  
  // Temporary data
  offeredTimeSlots?: Array<{
    time: string;
    available: boolean;
  }>;
  offeredUpsells?: Array<{
    name: string;
    price: string;
    description: string;
  }>;
  
  lastUpdated: Date;
}

class ConversationStateManager {
  private conversationStates: Map<string, SchedulingInfo> = new Map();
  
  /**
   * Get or create conversation state for a phone number
   */
  getState(phone: string): SchedulingInfo {
    if (!this.conversationStates.has(phone)) {
      this.conversationStates.set(phone, {
        customerPhone: phone,
        stepsCompleted: {
          customerIdentified: false,
          addressValidated: false,
          serviceSelected: false,
          timeSlotSelected: false,
          upsellsOffered: false,
          finalConfirmation: false,
        },
        lastUpdated: new Date(),
      });
    }
    return this.conversationStates.get(phone)!;
  }
  
  /**
   * Update conversation state with new information
   */
  updateState(phone: string, updates: Partial<SchedulingInfo>): SchedulingInfo {
    const currentState = this.getState(phone);
    const updatedState = {
      ...currentState,
      ...updates,
      stepsCompleted: {
        ...currentState.stepsCompleted,
        ...(updates.stepsCompleted || {}),
      },
      lastUpdated: new Date(),
    };
    
    this.conversationStates.set(phone, updatedState);
    return updatedState;
  }
  
  /**
   * Mark a step as completed
   */
  completeStep(phone: string, step: keyof SchedulingInfo['stepsCompleted']): void {
    const state = this.getState(phone);
    state.stepsCompleted[step] = true;
    state.lastUpdated = new Date();
    this.conversationStates.set(phone, state);
  }
  
  /**
   * Check if specific information has been collected
   */
  hasInfo(phone: string, field: keyof SchedulingInfo): boolean {
    const state = this.getState(phone);
    return state[field] !== undefined && state[field] !== null && state[field] !== '';
  }
  
  /**
   * Get missing required fields for booking
   */
  getMissingFields(phone: string): string[] {
    const state = this.getState(phone);
    const missing: string[] = [];
    
    if (!state.customerName) missing.push('name');
    if (!state.address) missing.push('address');
    if (!state.service) missing.push('service');
    if (!state.selectedTimeSlot) missing.push('time slot');
    
    return missing;
  }
  
  /**
   * Check if we have all required info to book
   */
  isReadyToBook(phone: string): boolean {
    return this.getMissingFields(phone).length === 0;
  }
  
  /**
   * Build a summary of collected information
   */
  buildSummary(phone: string): string {
    const state = this.getState(phone);
    let summary = 'Collected Information:\n';
    
    if (state.customerName) summary += `✓ Name: ${state.customerName}\n`;
    if (state.customerEmail) summary += `✓ Email: ${state.customerEmail}\n`;
    if (state.address) {
      summary += `✓ Address: ${state.address}`;
      if (state.isInServiceArea) {
        summary += ` (${state.driveTimeMinutes} min drive)`;
      }
      summary += '\n';
    }
    if (state.service) summary += `✓ Service: ${state.service}\n`;
    if (state.selectedTimeSlot) summary += `✓ Time: ${state.selectedTimeSlot}\n`;
    if (state.addOns && state.addOns.length > 0) {
      summary += `✓ Add-ons: ${state.addOns.join(', ')}\n`;
    }
    if (state.vehicles && state.vehicles.length > 0) {
      state.vehicles.forEach((v, idx) => {
        const vehicleStr = [v.year, v.make, v.model, v.color].filter(Boolean).join(' ');
        if (vehicleStr) summary += `✓ Vehicle ${idx + 1}: ${vehicleStr}\n`;
      });
    }
    
    const missing = this.getMissingFields(phone);
    if (missing.length > 0) {
      summary += `\nStill need: ${missing.join(', ')}`;
    }
    
    return summary;
  }
  
  /**
   * Clear conversation state (after booking or timeout)
   */
  clearState(phone: string): void {
    this.conversationStates.delete(phone);
  }
  
  /**
   * Get next step in the scheduling flow
   */
  getNextStep(phone: string): string {
    const state = this.getState(phone);
    
    if (!state.stepsCompleted.customerIdentified) {
      return 'identify_customer';
    }
    if (!state.stepsCompleted.addressValidated) {
      return 'validate_address';
    }
    if (!state.stepsCompleted.serviceSelected) {
      return 'select_service';
    }
    if (!state.stepsCompleted.timeSlotSelected) {
      return 'select_time';
    }
    if (!state.stepsCompleted.upsellsOffered) {
      return 'offer_upsells';
    }
    if (!state.stepsCompleted.finalConfirmation) {
      return 'confirm_booking';
    }
    
    return 'complete';
  }
}

// Export singleton instance
export const conversationState = new ConversationStateManager();
