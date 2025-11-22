/**
 * Availability Message Service
 * Generates shareable availability messages for different communication channels
 */

import { getCalendarAvailability } from './calendarAvailability';
import { formatForSMS, formatForEmail, formatForSocial, applyTemplateVariables, DayAvailability } from './channelFormatters';
import { format, parse, addDays } from 'date-fns';
import { criticalMonitor } from './criticalMonitoring';

/**
 * Hardcoded templates (no database - using MemStorage)
 * These are kept in memory since the app uses MemStorage, not PostgreSQL
 */
const HARDCODED_TEMPLATES = [
  {
    id: 1,
    name: "Professional",
    introText: "Hello{{#if contact.firstName}} {{contact.firstName}}{{/if}}! Here's our availability for the next two weeks:",
    ctaText: "Would you like me to schedule an appointment for you? Just let me know which date and time works best!",
    isDefault: true,
    channelType: null,
    isActive: true,
  },
  {
    id: 2,
    name: "Quick & Friendly",
    introText: "Hey{{#if contact.firstName}} {{contact.firstName}}{{/if}}! 👋 Here's when we're free:",
    ctaText: "Want to book? Pick a time and I'll get you scheduled! 🚗✨",
    isDefault: false,
    channelType: "sms",
    isActive: true,
  },
  {
    id: 3,
    name: "Detailed",
    introText: "Hi{{#if contact.firstName}} {{contact.firstName}}{{/if}}, thanks for your interest in Clean Machine Auto Detail! Below are our available appointment times for the next two weeks:",
    ctaText: "Please reply with your preferred date and time, and I'll be happy to get you scheduled. Looking forward to detailing your vehicle!",
    isDefault: false,
    channelType: "email",
    isActive: true,
  },
  {
    id: 4,
    name: "Casual",
    introText: "Hi{{#if contact.firstName}} {{contact.firstName}}{{/if}}! 🚗 Check out when we're available:",
    ctaText: "Let me know what works for you!",
    isDefault: false,
    channelType: null,
    isActive: true,
  },
];

import type { TenantDb } from './tenantDb';

export interface ShareAvailabilityRequest {
  tenantDb?: TenantDb;
  contactName?: string;
  contactFirstName?: string;
  channelType: 'sms' | 'email' | 'facebook' | 'instagram';
  templateId?: number; // Optional, uses default if not provided
  serviceDurationMinutes?: number; // Default to 180 (3 hours)
  daysAhead?: number; // Default to 14
}

export interface ShareAvailabilityResponse {
  messageText: string; // Formatted for the specific channel
  htmlText?: string; // For email channel
  rawAvailability: DayAvailability[]; // Structured data for UI preview
  template: {
    id: number;
    name: string;
  };
}

/**
 * Convert raw calendar availability data to DayAvailability format for formatting
 */
function convertToDayAvailability(calendarDays: any[]): DayAvailability[] {
  return calendarDays.map((day) => {
    // Parse the date string (YYYY-MM-DD) and format it nicely
    const dateObj = parse(day.date, 'yyyy-MM-dd', new Date());
    const formattedDate = format(dateObj, 'EEEE, MMM d'); // "Monday, Nov 25"

    // Extract available time slots
    const availableSlots: string[] = [];
    
    if (day.isAvailable && day.timeSlots) {
      // Group consecutive available slots into ranges
      let rangeStart: Date | null = null;
      let rangeEnd: Date | null = null;

      day.timeSlots.forEach((slot: any, index: number) => {
        if (slot.available) {
          const slotStart = new Date(slot.start);
          const slotEnd = new Date(slot.end);

          if (!rangeStart) {
            // Start a new range
            rangeStart = slotStart;
            rangeEnd = slotEnd;
          } else if (rangeEnd && slotStart.getTime() === rangeEnd.getTime()) {
            // Extend current range
            rangeEnd = slotEnd;
          } else {
            // Gap detected, save current range and start new one
            if (rangeStart && rangeEnd) {
              availableSlots.push(
                `${format(rangeStart, 'h:mm a')} - ${format(rangeEnd, 'h:mm a')}`
              );
            }
            rangeStart = slotStart;
            rangeEnd = slotEnd;
          }
        }

        // Handle last slot
        if (index === day.timeSlots.length - 1 && rangeStart && rangeEnd) {
          availableSlots.push(
            `${format(rangeStart, 'h:mm a')} - ${format(rangeEnd, 'h:mm a')}`
          );
        }
      });
    }

    return {
      date: formattedDate,
      slots: availableSlots,
      hasAvailability: availableSlots.length > 0,
    };
  });
}

/**
 * Generate share availability message with template and channel formatting
 */
export async function generateShareAvailabilityMessage(
  request: ShareAvailabilityRequest
): Promise<ShareAvailabilityResponse> {
  try {
    // Default values
    const serviceDurationMinutes = request.serviceDurationMinutes || 180; // 3 hours default
    const daysAhead = request.daysAhead || 14; // 2 weeks default

    // Calculate date range
    const startDate = format(new Date(), 'yyyy-MM-dd');
    const endDate = format(addDays(new Date(), daysAhead), 'yyyy-MM-dd');

    // Get template from hardcoded templates (no database)
    // Default to template ID 1 (Professional) if not provided
    const templateId = request.templateId ?? 1;
    let template = HARDCODED_TEMPLATES.find(t => t.id === templateId);
    
    if (!template) {
      // Fall back to channel-specific default
      template = HARDCODED_TEMPLATES.find(
        t => t.channelType === request.channelType && t.isDefault
      );
      
      if (!template) {
        // Fall back to global default (Professional template)
        template = HARDCODED_TEMPLATES.find(t => t.isDefault) || HARDCODED_TEMPLATES[0];
      }
    }

    // Fetch calendar availability
    console.log('[AVAILABILITY MESSAGE SERVICE] Fetching calendar availability:', {
      startDate,
      endDate,
      serviceDurationMinutes,
    });

    // Note: This service is called from routes with tenantDb passed as first parameter
    // The function signature should be updated to accept tenantDb
    const calendarDays = await getCalendarAvailability(request.tenantDb!, {
      startDate,
      endDate,
      serviceDurationMinutes,
    });

    // Convert to DayAvailability format
    const dayAvailability = convertToDayAvailability(calendarDays);

    // Apply template variables to intro and CTA
    const intro = applyTemplateVariables(template.introText, {
      contactName: request.contactName,
      contactFirstName: request.contactFirstName,
    });

    const cta = applyTemplateVariables(template.ctaText, {
      contactName: request.contactName,
      contactFirstName: request.contactFirstName,
    });

    // Format for specific channel
    let messageText: string;
    let htmlText: string | undefined;

    switch (request.channelType) {
      case 'sms':
        messageText = formatForSMS(dayAvailability, intro, cta);
        break;
      case 'email':
        const emailFormatted = formatForEmail(dayAvailability, intro, cta);
        messageText = emailFormatted.text;
        htmlText = emailFormatted.html;
        break;
      case 'facebook':
      case 'instagram':
        messageText = formatForSocial(dayAvailability, intro, cta);
        break;
      default:
        messageText = formatForSMS(dayAvailability, intro, cta);
    }

    console.log('[AVAILABILITY MESSAGE SERVICE] Message generated successfully:', {
      channelType: request.channelType,
      templateId: template.id,
      templateName: template.name,
      daysWithAvailability: dayAvailability.filter(d => d.hasAvailability).length,
    });

    return {
      messageText,
      htmlText,
      rawAvailability: dayAvailability,
      template: {
        id: template.id,
        name: template.name,
      },
    };
  } catch (error: any) {
    console.error('[AVAILABILITY MESSAGE SERVICE] Error generating message:', error);
    await criticalMonitor.reportFailure(
      'Availability Message Service',
      error.message || 'Failed to generate availability message'
    );
    throw error;
  }
}
