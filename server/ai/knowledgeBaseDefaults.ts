/**
 * Knowledge Base Tab Names & Structure Constants
 * 
 * Centralized definitions for Google Sheets tab names used across the knowledge base
 * to prevent magic strings and ensure consistency.
 */

export const DEFAULT_KB_TAB_NAMES = {
  smsKnowledgeBase: "SMS Knowledge Base",
  services: "Services",
  addOns: "Add-Ons",
  faq: "FAQ",
  clientResponses: "Client Responses",
  aiBehaviorRules: "AI Behavior Rules",
  triggerPhraseMap: "Trigger Phrase Map",
  customerInformation: "Customer Information",
  serviceHistory: "Service History",
  toneTraining: "Tone Training",
} as const;

/**
 * AI Behavior Rule structure
 * Defines scenario-based instructions for AI behavior
 */
export interface AiBehaviorRule {
  triggerScenario: string;
  instruction: string;
}

/**
 * Trigger Phrase Map Entry
 * Maps customer phrases to specific AI actions
 */
export interface TriggerPhraseMapEntry {
  phrase: string;
  mappedAction: string; // e.g. "recommend_full_detail", "ask_for_photos"
}
