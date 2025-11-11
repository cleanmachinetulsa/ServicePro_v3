import { customerMemory } from './customerMemory';

/**
 * Determine if a customer should be offered the maintenance detail program
 * based on their service history or comments about car maintenance
 */
export function shouldOfferMaintenanceDetail(
  phoneNumber: string,
  userMessage: string = ''
): boolean {
  // Check if this is a known customer
  const customerInfo = customerMemory.getCustomer(phoneNumber);
  
  if (!customerInfo) {
    // New customer - check only their message for keywords
    return checkForMaintenanceKeywords(userMessage);
  }
  
  // Check if this is a repeat customer with service in last 3 months
  if (customerInfo.serviceHistory && customerInfo.serviceHistory.length > 0) {
    const lastServiceDate = getLastServiceDate(customerInfo.serviceHistory);
    if (lastServiceDate) {
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      
      if (lastServiceDate > threeMonthsAgo) {
        // Service within last 3 months - offer maintenance detail
        return true;
      }
    }
  }
  
  // Check message for maintenance-related keywords
  return checkForMaintenanceKeywords(userMessage);
}

/**
 * Extract the date of the customer's last service
 */
function getLastServiceDate(serviceHistory: Array<{ service: string, date: Date }>): Date | null {
  if (!serviceHistory || serviceHistory.length === 0) {
    return null;
  }
  
  // Find the most recent service date
  return serviceHistory.reduce((latest, current) => {
    const currentDate = current.date instanceof Date ? current.date : new Date(current.date);
    return latest > currentDate ? latest : currentDate;
  }, new Date(0));
}

/**
 * Check if the customer's message contains keywords related to regular maintenance
 */
function checkForMaintenanceKeywords(message: string): boolean {
  if (!message) {
    return false;
  }
  
  const lowerMessage = message.toLowerCase();
  
  // Keywords that indicate a well-maintained vehicle
  const maintenanceKeywords = [
    'regularly maintained',
    'regularly detailed',
    'regular maintenance',
    'detailed monthly',
    'detailed regularly',
    'garage kept',
    'keep it clean',
    'always clean',
    'clean regularly',
    'meticulous',
    'pristine',
    'showroom condition',
    'well maintained',
    'maintained regularly',
    'every month',
    'every few weeks',
    'touch up',
    'touch-up',
    'light cleaning',
    'keep it looking good',
    'maintain appearance'
  ];
  
  // Check if any of the maintenance keywords are in the message
  return maintenanceKeywords.some(keyword => lowerMessage.includes(keyword));
}

/**
 * Generate a maintenance detail recommendation message
 */
export function getMaintenanceDetailRecommendation(isRepeatCustomer: boolean = false): string {
  if (isRepeatCustomer) {
    return "Based on your previous service with us, you might be interested in our Maintenance Detail Program. It's perfect for keeping your vehicle in top condition with regular quick wipe-downs, window cleaning, and wash/wax services. Ideal for vehicles that are already in good condition and just need regular upkeep.";
  }
  
  return "Since you keep your vehicle well-maintained, you might be interested in our Maintenance Detail Program. This service includes a quick wipe-down, window cleaning, and wash/wax to maintain your vehicle's appearance. It's perfect for vehicles that are already in good condition and just need regular upkeep. Note that if your vehicle has stains or heavy soil, it may require a deeper cleaning service instead.";
}

/**
 * Check if a customer might need deeper cleaning instead of maintenance detail
 * based on their message
 */
export function mightNeedDeeperCleaning(message: string): boolean {
  if (!message) {
    return false;
  }
  
  const lowerMessage = message.toLowerCase();
  
  // Keywords that indicate the need for deeper cleaning
  const deeperCleaningKeywords = [
    'stain',
    'stained',
    'dirty',
    'filthy',
    'mess',
    'messy',
    'soiled',
    'soil',
    'mud',
    'muddy',
    'spill',
    'spilled',
    'deep clean',
    'hasn\'t been cleaned',
    'hasn\'t been detailed',
    'long time',
    'never detailed',
    'never been detailed',
    'neglected',
    'pet',
    'dog hair',
    'cat hair',
    'fur',
    'animal',
    'children',
    'kids',
    'food',
    'drink',
    'coffee',
    'soda'
  ];
  
  return deeperCleaningKeywords.some(keyword => lowerMessage.includes(keyword));
}