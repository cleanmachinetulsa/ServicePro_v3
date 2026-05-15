/**
 * Phase 12: Professional Conversation Management API Helpers
 * 
 * Frontend wrappers for the Phase 12 backend endpoints:
 * - Smart Schedule from Thread
 * - Smart Handback to AI
 * - Handback Analysis
 */

import { apiRequest } from '@/lib/queryClient';

export interface ParsedBookingInfo {
  // Core booking details
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  
  // Service details
  serviceType?: string;
  serviceCategory?: string;
  
  // Scheduling
  preferredDate?: string;
  preferredTime?: string;
  dateFlexibility?: 'exact' | 'flexible' | 'asap';
  
  // Location
  address?: string;
  city?: string;
  isWithinServiceArea?: boolean;
  
  // Job-specific details
  vehicleInfo?: string;
  propertySize?: string;
  jobDescription?: string;
  
  // Add-ons and extras
  addOns?: string[];
  specialRequests?: string[];
  
  // Pricing context
  priceDiscussed?: string;
  budget?: string;
  
  // Extraction metadata
  confidence: 'high' | 'medium' | 'low';
  missingInfo: string[];
  extractionNotes: string;
  readyToBook: boolean;
}

export interface HandbackContext {
  wasIssueResolved?: boolean;
  issueDescription?: string;
  actionsTaken?: string[];
  outstandingItems?: string[];
  customerSentiment?: 'satisfied' | 'neutral' | 'frustrated';
  nextSteps?: string[];
  recommendedAIBehavior?: string;
}

export interface SmartHandbackResult {
  shouldHandback: boolean;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
  contextSummary?: HandbackContext;
  suggestedCustomerMessage?: string;
}

export interface SmartHandbackResponse {
  success: boolean;
  data?: {
    analysis: SmartHandbackResult;
    contextSummary?: HandbackContext;
  };
  message?: string;
  error?: string;
}

/**
 * Smart Schedule from Thread
 * 
 * Analyzes the entire conversation to extract booking details using AI.
 * Returns structured data that can be used to pre-fill a booking form.
 */
export async function fetchSmartSchedule(conversationId: number): Promise<ParsedBookingInfo> {
  const response = await apiRequest('POST', `/api/conversations/${conversationId}/smart-schedule`);
  const result = await response.json();
  return result.data;
}

/**
 * Smart Handback to AI
 * 
 * Intelligently returns a conversation to AI control with context preservation.
 */
export async function handbackConversationToAI(
  conversationId: number,
  options?: {
    force?: boolean;
    notifyCustomer?: boolean;
    customMessage?: string;
  }
): Promise<SmartHandbackResponse> {
  const response = await apiRequest('POST', `/api/conversations/${conversationId}/smart-handback`, options || {});
  const result = await response.json();
  return result;
}

/**
 * Analyze Handback Readiness
 * 
 * Gets AI analysis of whether a conversation is ready to be handed back to AI.
 * Does NOT perform the handback - just provides recommendations.
 */
export async function fetchHandbackAnalysis(conversationId: number): Promise<SmartHandbackResult> {
  const response = await apiRequest('GET', `/api/conversations/${conversationId}/handback-analysis`);
  const result = await response.json();
  // Backend returns { success, data, message } where data is SmartHandbackResult
  return result.data;
}
