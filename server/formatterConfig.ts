/**
 * Response Formatter Configuration
 * 
 * This module contains the configurable settings for the message formatting system.
 * Dashboard changes will modify these settings to affect application behavior.
 */

// Settings type for SMS channel
export interface SmsSettings {
  maxLength: number;
  includeEmoji: boolean;
  includeBranding: boolean;
}

// Settings type for Web channel
export interface WebSettings {
  includeEmoji: boolean;
  includeRichContent: boolean;
  includeBranding: boolean;
}

// Settings type for Email channel
export interface EmailSettings {
  formalTone: boolean;
  includeBranding: boolean;
  includeDetailedSignature: boolean;
}

// Combined settings interface for all channels
export interface FormatterSettings {
  sms: SmsSettings;
  web: WebSettings;
  email: EmailSettings;
}

// Default configuration values
const defaultSettings: FormatterSettings = {
  sms: {
    maxLength: 320,
    includeEmoji: false,
    includeBranding: false
  },
  web: {
    includeEmoji: true,
    includeRichContent: true,
    includeBranding: true
  },
  email: {
    formalTone: true,
    includeBranding: true,
    includeDetailedSignature: true
  }
};

// Singleton instance of current settings
let currentSettings: FormatterSettings = { ...defaultSettings };

/**
 * Get the current formatter settings
 */
export function getFormatterSettings(): FormatterSettings {
  return { ...currentSettings };
}

/**
 * Update the formatter settings
 */
export function updateFormatterSettings(newSettings: Partial<FormatterSettings>) {
  currentSettings = {
    sms: { ...defaultSettings.sms, ...newSettings.sms },
    web: { ...defaultSettings.web, ...newSettings.web },
    email: { ...defaultSettings.email, ...newSettings.email }
  };
}

/**
 * Reset formatter settings to defaults
 */
export function resetFormatterSettings() {
  currentSettings = { ...defaultSettings };
}

export const SMS_OPT_OUT_MESSAGE = "\nReply 'STOP' to opt-out of sms notifications";
export const SMS_FIRST_MESSAGE_LEGAL = "\nMsg&data rates may apply. By continuing, you consent to receive SMS notifications.";

export function shouldAddLegalMessage(isFirstMessage: boolean): boolean {
  return isFirstMessage;
}