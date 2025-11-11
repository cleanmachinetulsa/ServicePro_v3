/**
 * Customer Memory System
 * 
 * This module provides functionality to store and retrieve customer information
 * during conversations, including vehicle information and other preferences.
 */

// Customer memory store - maps phone numbers to customer info
interface CustomerInfo {
  vehicleInfo?: string;
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  lastInteraction: Date;
  serviceHistory?: Array<{
    service: string;
    date: Date;
    notes?: string;
  }>;
  servicePreferences?: {
    preferredService?: string;
    preferredDay?: string;
    preferredTime?: string;
    additionalRequests?: string[];
  };
  conversationContext?: {
    recentTopics: string[];
    lastServiceDiscussed?: string;
  };
}

class CustomerMemorySystem {
  private customerStore: Map<string, CustomerInfo> = new Map();
  
  /**
   * Get all customers from the memory store
   * Used for dashboard display
   */
  getAllCustomers(): CustomerInfo[] {
    return Array.from(this.customerStore.values());
  }
  
  /**
   * Get customer information for a given phone number
   */
  getCustomer(phone: string): CustomerInfo | undefined {
    return this.customerStore.get(phone);
  }
  
  /**
   * Create or update customer information
   */
  updateCustomer(phone: string, info: Partial<CustomerInfo>): CustomerInfo {
    const existingInfo = this.customerStore.get(phone) || {
      lastInteraction: new Date()
    };
    
    const updatedInfo = {
      ...existingInfo,
      ...info,
      lastInteraction: new Date()
    };
    
    this.customerStore.set(phone, updatedInfo);
    return updatedInfo;
  }
  
  /**
   * Extract and store vehicle information from message content
   */
  extractVehicleInfo(message: string, phone: string): string | undefined {
    // Simple pattern matching for vehicle information
    // Look for common patterns like "my car is a [car]", "I have a [car]", "my [car]"
    // This is a basic implementation - could be enhanced with ML/NLP
    const carPatterns = [
      /my car is (?:a |an )?([\w\s\-\.,]+)/i,
      /i have (?:a |an )?([\w\s\-\.,]+car|[\w\s\-\.,]+truck|[\w\s\-\.,]+suv|[\w\s\-\.,]+vehicle|[\w\s\-\.,]+ sedan|[\w\s\-\.,]+ coupe)/i,
      /my ([\w\s\-\.,]+car|[\w\s\-\.,]+truck|[\w\s\-\.,]+suv|[\w\s\-\.,]+vehicle|[\w\s\-\.,]+ sedan|[\w\s\-\.,]+ coupe)/i,
      /drive (?:a |an )?([\w\s\-\.,]+)/i,
      /(\d{4}[\s\-]?[\w\s\-\.,]+)/i  // Year-based pattern like "2010 Nissan Versa"
    ];
    
    // Try each pattern
    for (const pattern of carPatterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        const vehicleInfo = match[1].trim();
        // Store this information
        this.updateCustomer(phone, { vehicleInfo });
        return vehicleInfo;
      }
    }
    
    return undefined;
  }
  
  /**
   * Extract and store personal information from message content
   */
  extractPersonalInfo(message: string, phone: string): void {
    // Extract name
    const namePatterns = [
      /my name is ([\w\s\-\.]+)/i,
      /i am ([\w\s\-\.]+)/i,
      /this is ([\w\s\-\.]+)/i
    ];
    
    for (const pattern of namePatterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        const name = match[1].trim();
        this.updateCustomer(phone, { name });
        break;
      }
    }
    
    // Extract email
    const emailPattern = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/i;
    const emailMatch = message.match(emailPattern);
    if (emailMatch && emailMatch[1]) {
      const email = emailMatch[1].trim();
      this.updateCustomer(phone, { email });
    }
    
    // Extract address
    const addressPatterns = [
      /(?:my|the) address is ([\w\s\-\.,#]+)/i,
      /i live (?:at|on) ([\w\s\-\.,#]+)/i,
      /located (?:at|on) ([\w\s\-\.,#]+)/i
    ];
    
    for (const pattern of addressPatterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        const address = match[1].trim();
        this.updateCustomer(phone, { address });
        break;
      }
    }
    
    // Extract service preferences
    const servicePreferencePatterns = [
      /prefer(?:red)? (?:the )?([\w\s]+) service/i,
      /(?:usually|normally) get (?:the )?([\w\s]+)/i,
      /interested in (?:the )?([\w\s]+) service/i,
      /looking for (?:a |an )?([\w\s]+) service/i
    ];
    
    for (const pattern of servicePreferencePatterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        const preferredService = match[1].trim();
        const customer = this.getCustomer(phone) || { lastInteraction: new Date() };
        
        this.updateCustomer(phone, { 
          servicePreferences: {
            ...customer.servicePreferences,
            preferredService
          }
        });
        break;
      }
    }
  }
  
  /**
   * Build context about customer to enhance AI responses
   */
  buildCustomerContext(phone: string): string {
    const customer = this.getCustomer(phone);
    if (!customer) return '';
    
    let context = 'Customer Information:\n';
    
    if (customer.name) {
      context += `- Name: ${customer.name}\n`;
    }
    
    if (customer.vehicleInfo) {
      context += `- Vehicle: ${customer.vehicleInfo}\n`;
    }
    
    if (customer.email) {
      context += `- Email: ${customer.email}\n`;
    }
    
    if (customer.address) {
      context += `- Address: ${customer.address}\n`;
    }
    
    if (customer.servicePreferences?.preferredService) {
      context += `- Preferred service: ${customer.servicePreferences.preferredService}\n`;
    }
    
    if (customer.servicePreferences?.preferredDay) {
      context += `- Preferred appointment day: ${customer.servicePreferences.preferredDay}\n`;
    }
    
    if (customer.servicePreferences?.preferredTime) {
      context += `- Preferred appointment time: ${customer.servicePreferences.preferredTime}\n`;
    }
    
    if (customer.serviceHistory && customer.serviceHistory.length > 0) {
      context += '- Service history:\n';
      customer.serviceHistory.forEach(service => {
        context += `  * ${service.service} on ${service.date.toLocaleDateString()}\n`;
      });
    }
    
    if (customer.conversationContext?.lastServiceDiscussed) {
      context += `- Recently discussed service: ${customer.conversationContext.lastServiceDiscussed}\n`;
    }
    
    return context;
  }
  
  /**
   * Update the customer context based on the service being discussed
   */
  updateServiceContext(phone: string, serviceName: string): void {
    const customer = this.getCustomer(phone);
    if (!customer) return;
    
    const conversationContext = customer.conversationContext || { recentTopics: [] };
    
    this.updateCustomer(phone, {
      conversationContext: {
        ...conversationContext,
        lastServiceDiscussed: serviceName,
        recentTopics: [...(conversationContext.recentTopics || []), 'service']
      }
    });
  }
}

// Create a singleton instance
export const customerMemory = new CustomerMemorySystem();