/**
 * SP-22: Server-side translation utility for SMS/Email/IVR templates
 * 
 * This module provides translation functions for server-side content
 * such as SMS templates, email content, and IVR prompts.
 */

import OpenAI from 'openai';

export type SupportedLanguage = 'en' | 'es';

// Static translations for common SMS/IVR phrases
const translations: Record<string, Record<SupportedLanguage, string>> = {
  // Appointment confirmations
  'appointment.confirmed': {
    en: 'Your appointment has been confirmed for {{date}} at {{time}}.',
    es: 'Su cita ha sido confirmada para el {{date}} a las {{time}}.',
  },
  'appointment.reminder': {
    en: 'Reminder: Your appointment is tomorrow at {{time}}.',
    es: 'Recordatorio: Su cita es mañana a las {{time}}.',
  },
  'appointment.cancelled': {
    en: 'Your appointment has been cancelled. Please contact us to reschedule.',
    es: 'Su cita ha sido cancelada. Por favor contáctenos para reprogramar.',
  },
  
  // Booking
  'booking.received': {
    en: 'Thank you! We received your booking request and will confirm shortly.',
    es: '¡Gracias! Recibimos su solicitud de reserva y confirmaremos en breve.',
  },
  'booking.followup': {
    en: 'Hi! Following up on your recent booking. Is there anything else we can help with?',
    es: '¡Hola! Dando seguimiento a su reserva reciente. ¿Hay algo más en lo que podamos ayudarle?',
  },
  
  // Rewards
  'rewards.earned': {
    en: 'Congratulations! You earned {{points}} reward points!',
    es: '¡Felicidades! ¡Ganaste {{points}} puntos de recompensa!',
  },
  'rewards.redeemed': {
    en: 'Your reward has been redeemed successfully!',
    es: '¡Tu recompensa ha sido canjeada exitosamente!',
  },
  
  // AI conversation
  'ai.greeting': {
    en: 'Hello! How can I help you today?',
    es: '¡Hola! ¿Cómo puedo ayudarle hoy?',
  },
  'ai.language_preference': {
    en: 'Would you prefer to continue in English or Spanish? / ¿Prefiere continuar en inglés o español?',
    es: '¿Prefiere continuar en inglés o español? / Would you prefer to continue in English or Spanish?',
  },
  'ai.understood': {
    en: 'I understand. Let me help you with that.',
    es: 'Entiendo. Permítame ayudarle con eso.',
  },
  'ai.transfer_to_human': {
    en: 'I\'m connecting you with a team member who can assist you further.',
    es: 'Le estoy conectando con un miembro del equipo que puede asistirle mejor.',
  },
  
  // IVR prompts
  'ivr.welcome': {
    en: 'Welcome to {{businessName}}. For English, press 1. Para español, presione 2.',
    es: 'Bienvenido a {{businessName}}. Para español, presione 1. For English, press 2.',
  },
  'ivr.main_menu': {
    en: 'Main menu. Press 1 for appointments, 2 for services, 0 for an operator.',
    es: 'Menú principal. Presione 1 para citas, 2 para servicios, 0 para un operador.',
  },
  'ivr.leave_message': {
    en: 'Please leave a message after the tone.',
    es: 'Por favor deje un mensaje después del tono.',
  },
  'ivr.goodbye': {
    en: 'Thank you for calling. Goodbye!',
    es: '¡Gracias por llamar. Adiós!',
  },
  
  // General
  'general.thank_you': {
    en: 'Thank you!',
    es: '¡Gracias!',
  },
  'general.please_wait': {
    en: 'Please wait...',
    es: 'Por favor espere...',
  },
  'general.error': {
    en: 'We encountered an error. Please try again.',
    es: 'Encontramos un error. Por favor intente de nuevo.',
  },
};

/**
 * Get a translated string for a given key and language
 * Supports variable interpolation with {{variable}} syntax
 */
export function t(key: string, lang: SupportedLanguage = 'en', variables?: Record<string, string>): string {
  const translation = translations[key]?.[lang] || translations[key]?.['en'] || key;
  
  if (!variables) {
    return translation;
  }
  
  // Replace {{variable}} placeholders
  return translation.replace(/\{\{(\w+)\}\}/g, (_, varName) => {
    return variables[varName] || `{{${varName}}}`;
  });
}

/**
 * Load all translations for a given language
 */
export function loadLanguage(lang: SupportedLanguage): Record<string, string> {
  const result: Record<string, string> = {};
  
  for (const [key, values] of Object.entries(translations)) {
    result[key] = values[lang] || values['en'];
  }
  
  return result;
}

/**
 * Get all available translation keys
 */
export function getTranslationKeys(): string[] {
  return Object.keys(translations);
}

/**
 * Detect the language of a text message using OpenAI
 * Returns 'en' for English, 'es' for Spanish, or 'unknown' if uncertain
 */
export async function inferLanguageFromText(text: string): Promise<SupportedLanguage | 'unknown'> {
  if (!text || text.trim().length < 3) {
    return 'unknown';
  }
  
  // Simple heuristics for common patterns
  const spanishPatterns = [
    /\b(hola|buenos|gracias|por favor|sí|cómo|qué|quiero|necesito|tengo|puedo|cuánto|dónde|cuándo|ustedes|nosotros)\b/i,
    /[áéíóúñ¿¡]/,
  ];
  
  const englishPatterns = [
    /\b(hello|hi|thank you|please|yes|how|what|want|need|have|can|when|where|they|we)\b/i,
  ];
  
  let spanishScore = 0;
  let englishScore = 0;
  
  for (const pattern of spanishPatterns) {
    if (pattern.test(text)) spanishScore++;
  }
  
  for (const pattern of englishPatterns) {
    if (pattern.test(text)) englishScore++;
  }
  
  if (spanishScore > englishScore) return 'es';
  if (englishScore > spanishScore) return 'en';
  
  // If heuristics are inconclusive and text is long enough, use AI
  if (text.length > 20) {
    try {
      const openai = new OpenAI();
      
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a language detector. Respond with ONLY "en" for English, "es" for Spanish, or "unknown" if you cannot determine the language.',
          },
          {
            role: 'user',
            content: `Detect the language of this text: "${text}"`,
          },
        ],
        max_tokens: 5,
        temperature: 0,
      });
      
      const result = response.choices[0]?.message?.content?.toLowerCase().trim();
      
      if (result === 'en' || result === 'es') {
        return result;
      }
    } catch (error) {
      console.error('[TRANSLATOR] Error detecting language with AI:', error);
    }
  }
  
  return 'unknown';
}

/**
 * Check if a language is supported
 */
export function isLanguageSupported(lang: string): lang is SupportedLanguage {
  return lang === 'en' || lang === 'es';
}

/**
 * Get the default language fallback
 */
export function getDefaultLanguage(): SupportedLanguage {
  return 'en';
}
