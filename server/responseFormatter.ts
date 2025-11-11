/**
 * Response Formatter Module
 * 
 * This module provides specialized response formatting based on communication channel
 * (SMS, Web App, or Email) to enhance the user experience across different platforms.
 * 
 * Each channel has different capabilities and constraints:
 * - SMS: Limited length, text-only, concise communication
 * - Web App: Full HTML/rich text support, interactive elements, no length limits
 * - Email: HTML support, more formal tone, moderate length, good for detailed information
 */

import { customerMemory } from './customerMemory';
import { getFormatterSettings } from './formatterConfig';

// Define communication channels
export type CommunicationChannel = 'sms' | 'web' | 'email';

// Options for response formatting
interface ResponseOptions {
  includeEmoji?: boolean;
  maxLength?: number;
  includeGreeting?: boolean;
  includeCustomerName?: boolean;
  includeBranding?: boolean;
  formalTone?: boolean;
  includeRichContent?: boolean;
  includeImages?: boolean;
  includeDetailedSignature?: boolean;
  isFirstMessage?: boolean;
}

class ResponseFormatter {
  /**
   * Format a response specifically for SMS clients
   * - Shorter and more concise
   * - Natural language only (no numbered menus)
   * - Simple and clear instructions
   * - Strict character limits
   */
  formatSmsResponse(
    baseResponse: string, 
    phone: string, 
    options: ResponseOptions = {}
  ): string {
    // Get global settings for SMS
    const settings = getFormatterSettings();

    // Default options for SMS with configuration overrides
    const opts = {
      includeEmoji: settings.sms.includeEmoji,
      maxLength: settings.sms.maxLength, // Standard SMS is 160 chars, but carriers often support concatenated messages
      includeGreeting: true,
      includeCustomerName: true,
      includeBranding: settings.sms.includeBranding,
      formalTone: false,
      includeRichContent: false,
      includeImages: false,
      isFirstMessage: false,
      ...options
    };

    // Get customer info if available
    const customer = customerMemory.getCustomer(phone);
    let response = baseResponse;

    // Simplify the response for SMS - remove any overly detailed explanations
    response = this.simplifyForSms(response);

    // Add greeting with customer name if available and requested
    if (opts.includeGreeting && customer?.name && opts.includeCustomerName) {
      // Check if response already starts with a greeting containing the name
      if (!response.toLowerCase().includes(customer.name.toLowerCase())) {
        response = `Hi ${customer.name}, ${response}`;
      }
    }

    // Add emoji if requested (sparingly)
    if (opts.includeEmoji) {
      // Only add emoji if response doesn't already have one
      const hasEmoji = /[^\u0000-\u007F]/.test(response); // Simple check for non-ASCII (likely emoji)
      if (!hasEmoji) {
        // Choose a contextual emoji based on the content
        if (response.toLowerCase().includes('thank')) response = `👍 ${response}`;
        else if (response.toLowerCase().includes('appointment')) response = `📅 ${response}`;
        else if (response.toLowerCase().includes('price') || response.toLowerCase().includes('cost')) response = `💲 ${response}`;
        else if (response.toLowerCase().includes('photo')) response = `📸 ${response}`;
        else if (response.toLowerCase().includes('clean') || response.toLowerCase().includes('detail')) response = `✨ ${response}`;
      }
    }

    // Add brief branding if requested
    if (opts.includeBranding) {
      response = `${response}\n- Clean Machine`;
    }

    // Add appropriate messages
    const { SMS_OPT_OUT_MESSAGE, SMS_FIRST_MESSAGE_LEGAL, shouldAddLegalMessage } = require('./formatterConfig');

    if (shouldAddLegalMessage(opts.isFirstMessage)) {
      response = `${response}${SMS_FIRST_MESSAGE_LEGAL}`;
    }
    response = `${response}${SMS_OPT_OUT_MESSAGE}`;

    // Calculate max length accounting for messages
    const additionalLength = (opts.isFirstMessage ? SMS_FIRST_MESSAGE_LEGAL.length : 0) + SMS_OPT_OUT_MESSAGE.length;
    const maxLengthForContent = opts.maxLength - additionalLength;

    // Ensure the response isn't too long for SMS
    if (response.length > maxLengthForContent) {
      response = response.substring(0, maxLengthForContent - 3) + '...';
    }

    return response;
  }

  /**
   * Format a response for web clients with richer content
   * - More detailed responses
   * - Can include formatting like line breaks and bullet points
   * - May include links and rich content references
   * - Can include interactive elements and sophisticated UI
   */
  formatWebResponse(
    baseResponse: string, 
    phone: string, 
    options: ResponseOptions = {}
  ): string {
    // Get global settings for web
    const settings = getFormatterSettings();

    // Default options for web app with configuration overrides
    const opts = {
      includeEmoji: settings.web.includeEmoji,
      includeGreeting: true,
      includeCustomerName: true,
      includeBranding: settings.web.includeBranding,
      formalTone: false,
      includeRichContent: settings.web.includeRichContent,
      includeImages: true,
      ...options
    };

    // Get customer info if available
    const customer = customerMemory.getCustomer(phone);
    let response = baseResponse;

    // Enhance with more details for web display
    response = this.enhanceForWeb(response);

    // Add greeting with customer name if available and requested
    if (opts.includeGreeting && customer?.name && opts.includeCustomerName) {
      // Check if response already starts with a greeting containing the name
      if (!response.toLowerCase().includes(customer.name.toLowerCase())) {
        response = `Hi ${customer.name}, ${response}`;
      }
    }

    // Format lists for better web display
    response = this.formatListsForWeb(response);

    // Enhance web responses with better formatting
    response = this.enhanceWebFormatting(response);

    // Add emoji if requested
    if (opts.includeEmoji) {
      // Only add emoji if response doesn't already have one
      const hasEmoji = /[^\u0000-\u007F]/.test(response); // Simple check for non-ASCII (likely emoji)
      if (!hasEmoji) {
        // Choose a contextual emoji based on the content
        if (response.toLowerCase().includes('thank')) response = `👍 ${response}`;
        else if (response.toLowerCase().includes('appointment')) response = `📅 ${response}`;
        else if (response.toLowerCase().includes('price') || response.toLowerCase().includes('cost')) response = `💲 ${response}`;
        else if (response.toLowerCase().includes('photo')) response = `📸 ${response}`;
        else if (response.toLowerCase().includes('clean') || response.toLowerCase().includes('detail')) response = `✨ ${response}`;
      }
    }

    // Add rich branding if requested
    if (opts.includeBranding) {
      response = `${response}\n\n*Clean Machine Auto Detail*\nExpertise in Premium Vehicle Care`;
    }

    return response;
  }

  /**
   * Format a response for email with formal tone and detailed content
   * - Formal and professional tone
   * - Comprehensive information
   * - Well-structured with proper formatting
   * - HTML support with branding elements
   */
  formatEmailResponse(
    baseResponse: string, 
    phone: string, 
    options: ResponseOptions = {}
  ): string {
    // Get global settings for email
    const settings = getFormatterSettings();

    // Default options for email with configuration overrides
    const opts = {
      includeEmoji: false,
      includeGreeting: true,
      includeCustomerName: true,
      includeBranding: settings.email.includeBranding,
      formalTone: settings.email.formalTone,
      includeRichContent: true,
      includeImages: true,
      includeDetailedSignature: settings.email.includeDetailedSignature,
      ...options
    };

    // Get customer info if available
    const customer = customerMemory.getCustomer(phone);
    let response = baseResponse;

    // Add formal greeting with customer name if available and requested
    if (opts.includeGreeting && customer?.name && opts.includeCustomerName) {
      // Check if response already starts with a greeting containing the name
      if (!response.toLowerCase().includes(customer.name.toLowerCase())) {
        response = `Dear ${customer.name},\n\n${response}`;
      }
    } else if (opts.includeGreeting) {
      response = `Dear Valued Customer,\n\n${response}`;
    }

    // Make tone more formal for email if requested
    if (opts.formalTone) {
      response = this.formalizeEmailTone(response);
    }

    // Format for detailed email presentation
    response = this.formatForEmail(response);

    // Add branding with conditional detailed signature
    if (opts.includeBranding) {
      if (opts.includeDetailedSignature) {
        // Full signature with contact details
        response = `${response}\n\nBest regards,\nThe Clean Machine Auto Detail Team\n\nClean Machine Auto Detail\nPremium Automotive Detailing Services\nPhone: 918-856-5304\nEmail: cleanmachinetulsa@gmail.com`;
      } else {
        // Simple signature
        response = `${response}\n\nBest regards,\nClean Machine Auto Detail`;
      }
    }

    return response;
  }

  /**
   * Simplify a response for SMS format
   * - Removes lengthy descriptions
   * - Keeps essential information only
   * - Makes instructions clear and concise
   */
  private simplifyForSms(text: string): string {
    let simplified = text;

    // Remove detailed paragraphs (keeping first sentence of paragraphs)
    simplified = simplified.replace(/([.!?])[^.!?]+?(?=\n|$)/g, '$1');

    // Remove excessive adverbs and adjectives
    const wordyPhrases = [
      /\b(very|extremely|incredibly|absolutely)\s+/g,
      /\b(premium|luxurious|high-end|top-tier|exceptional)\s+/g,
      /\b(we are pleased to|we're delighted to|we're happy to)\b/g
    ];

    wordyPhrases.forEach(phrase => {
      simplified = simplified.replace(phrase, '');
    });

    // Convert some statements to simpler form
    simplified = simplified.replace(/We would be happy to/g, "We can");
    simplified = simplified.replace(/Would you like us to/g, "Should we");
    simplified = simplified.replace(/I would recommend/g, "I recommend");

    // Shorten lists to essential items
    if (simplified.includes('- ')) {
      const listItems = simplified.split(/\n- /);
      if (listItems.length > 3) {
        // Keep only first 2 items and add a summary
        simplified = listItems[0] + '\n- ' + listItems[1] + '\n- ' + listItems[2] + '\n+ more options';
      }
    }

    return simplified;
  }

  /**
   * Enhance a response for web display with additional details
   */
  private enhanceForWeb(text: string): string {
    let enhanced = text;

    // Add more detailed explanations
    if (enhanced.includes('service')) {
      if (!enhanced.includes('Our services include')) {
        enhanced += '\n\nOur services are designed to keep your vehicle looking its best with premium products and professional techniques.';
      }
    }

    // Add call-to-actions
    if (enhanced.includes('appointment') && !enhanced.includes('schedule')) {
      enhanced += '\n\nYou can easily schedule your appointment using our online booking system or we can assist you right here.';
    }

    // Suggest additional options if discussing services
    if (enhanced.includes('Detail') && !enhanced.includes('add-on')) {
      enhanced += '\n\nWe also offer add-on services like leather protection, pet hair removal, and headlight restoration to customize your detailing experience.';
    }

    return enhanced;
  }

  /**
   * Format text specifically for email presentation
   */
  private formatForEmail(text: string): string {
    let emailText = text;

    // Add proper paragraph spacing
    emailText = emailText.replace(/([.!?])\s+([A-Z])/g, '$1\n\n$2');

    // Format lists properly for email
    if (emailText.includes('- ')) {
      emailText = emailText.replace(/([^\n])(- )/g, '$1\n\n- ');
      emailText = emailText.replace(/(\n- .*?)(\n[^-])/g, '$1\n\n$2');
    }

    // Add formal closings if not present
    if (!emailText.toLowerCase().includes('thank you') && 
        !emailText.toLowerCase().includes('regards') && 
        !emailText.toLowerCase().includes('sincerely')) {
      emailText += '\n\nThank you for choosing Clean Machine Auto Detail.';
    }

    return emailText;
  }

  /**
   * Make text tone more formal for email communications
   */
  private formalizeEmailTone(text: string): string {
    let formal = text;

    // Replace casual phrases with more formal alternatives
    const casualPhrases: [RegExp, string][] = [
      [/\bHey\b/g, 'Hello'],
      [/\bYeah\b/g, 'Yes'],
      [/\bNope\b/g, 'No'],
      [/\bGot it\b/g, 'Understood'],
      [/\bAwesome\b/g, 'Excellent'],
      [/\bWanna\b/g, 'Would you like to'],
      [/\bGonna\b/g, 'Going to'],
      [/\bCan't\b/g, 'Cannot'],
      [/\bDon't\b/g, 'Do not'],
      [/\bI'll\b/g, 'I will'],
      [/\bWe'll\b/g, 'We will'],
      [/\bThat's\b/g, 'That is'],
      [/\bLet me know\b/g, 'Please inform me'],
      [/\bThanks\b/g, 'Thank you'],
      [/\bHi\b/g, 'Hello']
    ];

    casualPhrases.forEach(([casual, formalReplacement]) => {
      formal = formal.replace(casual, formalReplacement);
    });

    return formal;
  }

  /**
   * Format list items for better display on web
   */
  private formatListsForWeb(text: string): string {
    // Look for patterns like "1. Item" or "- Item" and ensure they're on new lines
    let formattedText = text;

    // Replace dash lists if not already on their own lines
    formattedText = formattedText.replace(/([^\n])(- )/g, '$1\n- ');

    // Replace numbered lists if not already on their own lines
    formattedText = formattedText.replace(/([^\n])(\d+\. )/g, '$1\n$2');

    // Add spacing after list sections
    formattedText = formattedText.replace(/(\n- .*?)(\n[^-])/g, '$1\n$2');

    return formattedText;
  }

  /**
   * Enhance web formatting with additional styling
   */
  private enhanceWebFormatting(text: string): string {
    let formattedText = text;

    // Add extra line breaks between paragraphs for better readability
    formattedText = formattedText.replace(/([.!?])\s+([A-Z])/g, '$1\n\n$2');

    // Format service names in responses to stand out
    const serviceNames = [
      'Full Detail', 'Interior Detail', 'Exterior Detail', 
      'Paint Enhancement', 'Paint Correction', 'Ceramic Coating',
      'Maintenance Detail', 'Motorcycle Detail', 'Premium Wash',
      'Shampoo Seats', 'Leather Protection', 'Pet Hair Removal'
    ];

    // Highlight service names when they appear in text
    serviceNames.forEach(service => {
      const regex = new RegExp(`(${service})`, 'g');
      formattedText = formattedText.replace(regex, '*$1*');
    });

    // Add hyperlinks for appropriate terms
    if (formattedText.includes('online booking') || formattedText.includes('schedule your appointment')) {
      formattedText = formattedText.replace(/online booking|schedule your appointment/g, '[online booking system](#booking)');
    }

    if (formattedText.includes('service list') || formattedText.includes('our services')) {
      formattedText = formattedText.replace(/service list|our services/g, '[our services](#services)');
    }

    return formattedText;
  }

  /**
   * Format an appointment booking response based on communication channel
   */
  formatAppointmentResponse(
    baseResponse: string,
    channel: CommunicationChannel,
    phone: string
  ): string {
    switch (channel) {
      case 'web':
        // For web clients, we'll add a rich interactive prompt
        return this.formatWebResponse(
          `${baseResponse}\n\nYou can use our online scheduling tool to select a time that works for you. Our online system shows real-time availability and lets you choose the perfect time slot.`, 
          phone,
          { includeRichContent: true }
        );

      case 'email':
        // For email, provide formal booking instructions with details
        return this.formatEmailResponse(
          `${baseResponse}\n\nTo schedule your appointment, you can:\n\n- Reply to this email with your preferred date and time\n- Use our online scheduling system at our website\n- Call us directly at 918-856-5304\n\nPlease note that appointments are subject to availability, and we recommend booking at least 3-5 days in advance for optimal scheduling.`, 
          phone,
          { formalTone: true }
        );

      case 'sms':
      default:
        // For SMS clients, provide a conversational approach
        return this.formatSmsResponse(
          `${baseResponse} What day would work best for your appointment?`, 
          phone,
          { maxLength: 160 }
        );
    }
  }

  /**
   * Format a photo upload response based on communication channel
   */
  formatPhotoResponse(
    baseResponse: string,
    channel: CommunicationChannel,
    phone: string,
    photoUrl?: string
  ): string {
    switch (channel) {
      case 'web':
        // For web clients, include rich visual confirmation
        const photoReference = photoUrl ? 
          `\n\nI've received your photo and saved it to your customer profile. This helps us prepare for your service.` : 
          '';

        return this.formatWebResponse(
          `${baseResponse}${photoReference}\n\nClear photos of your vehicle help us provide more accurate service recommendations.`, 
          phone,
          { includeImages: true, includeRichContent: true }
        );

      case 'email':
        // For email, provide formal confirmation with details
        return this.formatEmailResponse(
          `${baseResponse}\n\nThank you for sharing photos of your vehicle with us. These images have been saved to your customer profile and will help our detailing technicians prepare for your appointment.\n\nIf you wish to send additional photos, you may reply to this email with attachments.`, 
          phone,
          { formalTone: true, includeBranding: true }
        );

      case 'sms':
      default:
        // For SMS clients, keep it simple
        return this.formatSmsResponse(
          `${baseResponse} Thanks for the photo! It helps us prepare for your service.`, 
          phone,
          { includeEmoji: true, maxLength: 160 }
        );
    }
  }

  /**
   * Format a service information response based on communication channel
   */
  formatServiceInfoResponse(
    baseResponse: string,
    channel: CommunicationChannel,
    phone: string,
    serviceName?: string
  ): string {
    // Store this as a service the customer is interested in if available
    if (serviceName) {
      const customer = customerMemory.getCustomer(phone);
      if (customer) {
        customerMemory.updateServiceContext(phone, serviceName);
      }
    }

    switch (channel) {
      case 'web':
        // For web clients, provide rich detailed service information
        let webResponse = baseResponse;

        // Add more comprehensive details for web
        if (serviceName) {
          webResponse += `\n\nOur ${serviceName} service is designed to deliver exceptional results using premium products and professional techniques. We pay careful attention to every detail to ensure your vehicle looks its absolute best.`;
        }

        return this.formatWebResponse(webResponse, phone, { 
          includeRichContent: true, 
          includeImages: true,
          includeBranding: true
        });

      case 'email':
        // For email, provide formal, detailed service information
        let emailResponse = baseResponse;

        if (serviceName) {
          emailResponse += `\n\nThe ${serviceName} service includes professional-grade treatments and meticulous attention to detail. Our certified technicians use premium products to ensure the highest quality results for your vehicle.`;
          emailResponse += `\n\nPlease let us know if you have any specific requirements or questions regarding this service.`;
        }

        return this.formatEmailResponse(emailResponse, phone, {
          formalTone: true,
          includeBranding: true
        });

      case 'sms':
      default:
        // For SMS clients, provide concise service description
        return this.formatSmsResponse(baseResponse, phone, {
          maxLength: 160
        });
    }
  }

  /**
   * Format a response based on communication channel
   * Main entry point for channel-specific formatting
   */
  formatResponse(
    baseResponse: string,
    channel: CommunicationChannel,
    phone: string,
    options: ResponseOptions = {}
  ): string {
    switch (channel) {
      case 'web':
        return this.formatWebResponse(baseResponse, phone, options);
      case 'email':
        return this.formatEmailResponse(baseResponse, phone, options);
      case 'sms':
      default:
        return this.formatSmsResponse(baseResponse, phone, options);
    }
  }
}



// Create a singleton instance
export const responseFormatter = new ResponseFormatter();