/**
 * Conversation Classifier
 * 
 * This module provides intelligent classification of customer conversations
 * to help organize and prioritize customer interactions.
 */

// Types of conversation categories
export type ConversationCategory = 'Booking' | 'Inquiry' | 'Support' | 'Feedback' | 'Other';

// Types of conversation intent
export type ConversationIntent = 'Ready to Book' | 'Considering Booking' | 'Information Gathering' | 'Problem Resolution' | 'Opinion Sharing' | 'Other';

// Interface for classification result
export interface ClassificationResult {
  category: ConversationCategory;
  intent: ConversationIntent;
  confidence: number;
  topics: string[];
  needsHumanAttention: boolean;
}

// Booking indicators with context awareness
const bookingKeywords = [
  { term: 'book', weight: 0.6 },
  { term: 'schedule', weight: 0.6 },
  { term: 'appointment', weight: 0.5 },
  { term: 'reserve', weight: 0.6 },
  { term: 'availability', weight: 0.4 },
  { term: 'available', weight: 0.4 },
  { term: 'time slot', weight: 0.7 },
  { term: 'date', weight: 0.3 },
  { term: 'calendar', weight: 0.4 },
  { term: 'next week', weight: 0.5 },
  { term: 'next month', weight: 0.5 },
];

// Booking readiness indicators
const bookingReadinessKeywords = [
  { term: 'would like to book', weight: 0.9 },
  { term: 'i want to book', weight: 0.9 },
  { term: 'book for tomorrow', weight: 0.8 },
  { term: 'book for today', weight: 0.9 },
  { term: 'schedule for', weight: 0.8 },
  { term: 'book now', weight: 0.9 },
  { term: 'asap', weight: 0.7 },
  { term: 'earliest', weight: 0.7 },
  { term: 'next available', weight: 0.8 },
];

// Booking inquiry indicators (not ready to book yet)
const bookingInquiryKeywords = [
  { term: 'how far in advance', weight: 0.7 },
  { term: 'months from now', weight: 0.7 },
  { term: 'weeks in advance', weight: 0.7 },
  { term: 'booking policy', weight: 0.6 },
  { term: 'how does booking work', weight: 0.6 },
  { term: 'reschedule', weight: 0.5 },
  { term: 'cancel', weight: 0.5 },
  { term: 'book for later', weight: 0.6 },
  { term: 'in the future', weight: 0.6 },
  { term: 'planning ahead', weight: 0.7 },
];

// Inquiry indicators
const inquiryKeywords = [
  { term: 'how much', weight: 0.7 },
  { term: 'price', weight: 0.7 },
  { term: 'cost', weight: 0.7 },
  { term: 'do you', weight: 0.5 },
  { term: 'offer', weight: 0.5 },
  { term: 'service', weight: 0.4 },
  { term: 'hours', weight: 0.5 },
  { term: 'how long', weight: 0.5 },
  { term: 'address', weight: 0.5 },
  { term: 'location', weight: 0.5 },
  { term: 'area', weight: 0.4 },
  { term: 'information', weight: 0.5 },
];

// Support indicators
const supportKeywords = [
  { term: 'problem', weight: 0.7 },
  { term: 'issue', weight: 0.7 },
  { term: 'help', weight: 0.6 },
  { term: 'question', weight: 0.5 },
  { term: 'cancel', weight: 0.7 },
  { term: 'refund', weight: 0.8 },
  { term: 'not working', weight: 0.8 },
  { term: 'wrong', weight: 0.7 },
  { term: 'mistake', weight: 0.7 },
  { term: 'error', weight: 0.8 },
  { term: 'late', weight: 0.6 },
];

// Feedback indicators
const feedbackKeywords = [
  { term: 'feedback', weight: 0.8 },
  { term: 'review', weight: 0.7 },
  { term: 'experience', weight: 0.5 },
  { term: 'satisfied', weight: 0.7 },
  { term: 'happy', weight: 0.6 },
  { term: 'unhappy', weight: 0.7 },
  { term: 'disappointed', weight: 0.8 },
  { term: 'excellent', weight: 0.7 },
  { term: 'good job', weight: 0.7 },
  { term: 'great service', weight: 0.8 },
  { term: 'poor service', weight: 0.8 },
  { term: 'thanks', weight: 0.5 },
  { term: 'thank you', weight: 0.6 },
];

// Service-specific topics
const serviceTopics = [
  'Full Detail',
  'Express Wash',
  'Interior Detail',
  'Exterior Detail',
  'Ceramic Coating',
  'Window Tinting',
  'Engine Detail',
  'Odor Removal',
  'Maintenance Detail',
  'Paint Protection',
  'Headlight Restoration',
  'Carpet Cleaning',
  'Leather Treatment',
  'Pet Hair Removal',
  'Scratch Repair',
  'Stain Removal',
  'Wax Application',
  'Clay Bar Treatment',
  'Polishing'
];

/**
 * Detect if conversation requires human attention
 */
export function needsHumanAttention(message: string): boolean {
  const urgentIndicators = [
    'urgent', 'emergency', 'immediately', 'asap',
    'refund', 'angry', 'upset', 'unhappy', 'disappointed',
    'wrong', 'mistake', 'error', 'not working', 'broken',
    'speak to a human', 'speak to manager', 'talk to a person',
    'not satisfied', 'complaint', 'problem', 'issue', 'damaged',
    'help me', 'question', 'confused'
  ];
  
  const lowercaseMessage = message.toLowerCase();
  
  // Check for urgent indicators
  for (const indicator of urgentIndicators) {
    if (lowercaseMessage.includes(indicator)) {
      return true;
    }
  }
  
  // Check for multiple question marks or exclamation marks
  if ((lowercaseMessage.match(/\?/g) || []).length >= 3 || 
      (lowercaseMessage.match(/!/g) || []).length >= 3) {
    return true;
  }
  
  // Check for ALL CAPS (angry customers)
  const words = lowercaseMessage.split(' ');
  const allCapsWords = words.filter(word => 
    word === word.toUpperCase() && word.length > 3
  );
  
  if (allCapsWords.length >= 3) {
    return true;
  }
  
  return false;
}

/**
 * Extract topics from a message
 */
export function extractTopics(message: string): string[] {
  const lowercaseMessage = message.toLowerCase();
  return serviceTopics.filter(topic => 
    lowercaseMessage.includes(topic.toLowerCase())
  );
}

/**
 * Calculate keyword score for a message
 */
function calculateKeywordScore(message: string, keywords: Array<{term: string, weight: number}>): number {
  const lowercaseMessage = message.toLowerCase();
  let score = 0;
  
  keywords.forEach(keyword => {
    if (lowercaseMessage.includes(keyword.term.toLowerCase())) {
      score += keyword.weight;
    }
  });
  
  return score;
}

/**
 * Determine if a booking inquiry is from someone ready to book
 * or just gathering information about booking policies
 */
function determineBookingIntent(message: string): ConversationIntent {
  const readinessScore = calculateKeywordScore(message, bookingReadinessKeywords);
  const inquiryScore = calculateKeywordScore(message, bookingInquiryKeywords);
  
  if (readinessScore > inquiryScore) {
    return 'Ready to Book';
  } else if (inquiryScore > 0) {
    return 'Considering Booking';
  } else {
    return 'Information Gathering';
  }
}

/**
 * Classify conversation based on message content
 */
export function classifyConversation(message: string): ClassificationResult {
  // Calculate scores for each category
  const bookingScore = calculateKeywordScore(message, bookingKeywords);
  const inquiryScore = calculateKeywordScore(message, inquiryKeywords);
  const supportScore = calculateKeywordScore(message, supportKeywords);
  const feedbackScore = calculateKeywordScore(message, feedbackKeywords);
  
  // Determine primary category
  const scores = [
    { category: 'Booking' as ConversationCategory, score: bookingScore },
    { category: 'Inquiry' as ConversationCategory, score: inquiryScore },
    { category: 'Support' as ConversationCategory, score: supportScore },
    { category: 'Feedback' as ConversationCategory, score: feedbackScore }
  ];
  
  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);
  
  // Determine primary category and confidence
  const primaryCategory = scores[0].score > 0 ? scores[0].category : 'Other';
  
  // Calculate total score for confidence calculation
  const totalScore = scores.reduce((sum, item) => sum + item.score, 0);
  const confidence = totalScore > 0 ? scores[0].score / totalScore : 0;
  
  // Determine intent based on category
  let intent: ConversationIntent;
  switch (primaryCategory) {
    case 'Booking':
      intent = determineBookingIntent(message);
      break;
    case 'Inquiry':
      intent = 'Information Gathering';
      break;
    case 'Support':
      intent = 'Problem Resolution';
      break;
    case 'Feedback':
      intent = 'Opinion Sharing';
      break;
    default:
      intent = 'Other';
  }
  
  // Extract topics from message
  const topics = extractTopics(message);
  
  // Check if message needs human attention
  const needsHumanAttention = needsHumanAttention(message);
  
  return {
    category: primaryCategory,
    intent,
    confidence,
    topics,
    needsHumanAttention
  };
}