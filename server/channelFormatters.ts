/**
 * Channel-specific formatters for availability messages
 * Each formatter adapts the availability data to the specific channel's best practices
 */

export interface DayAvailability {
  date: string; // "Monday, Nov 25"
  slots: string[]; // ["9:00 AM - 12:00 PM", "1:00 PM - 3:00 PM"]
  hasAvailability: boolean;
}

/**
 * Format availability for SMS - concise, no emojis, respects character limits
 * Target: Under 1600 characters (SMS concatenation limit)
 */
export function formatForSMS(
  availability: DayAvailability[],
  intro: string,
  cta: string
): string {
  const parts: string[] = [intro, ''];

  // Condense format: "Mon 11/25: 9AM-12PM, 1PM-3PM"
  const availableDays = availability.filter((day) => day.hasAvailability);

  if (availableDays.length === 0) {
    parts.push("Unfortunately, we're fully booked for the next two weeks.");
    parts.push('');
    parts.push("I'd be happy to add you to our waitlist or schedule further out. Just let me know!");
    return parts.join('\n');
  }

  availableDays.forEach((day) => {
    // Parse date to get short format: "Mon 11/25"
    const dateParts = day.date.split(',');
    const dayOfWeek = dateParts[0].trim().substring(0, 3); // "Mon"
    const monthDay = dateParts[1]?.trim() || ''; // "Nov 25"
    
    // Simplify time slots: "9:00 AM - 12:00 PM" -> "9AM-12PM"
    const simplifiedSlots = day.slots.map((slot) => {
      return slot
        .replace(/:00/g, '') // Remove :00
        .replace(/ /g, '') // Remove spaces
        .replace(/\./g, ''); // Remove periods
    });
    
    parts.push(`${dayOfWeek} ${monthDay}: ${simplifiedSlots.join(', ')}`);
  });

  parts.push('');
  parts.push(cta);

  return parts.join('\n');
}

/**
 * Format availability for email - includes both HTML and plain text versions
 * HTML version has nice table formatting and styling
 */
export function formatForEmail(
  availability: DayAvailability[],
  intro: string,
  cta: string
): { text: string; html: string } {
  const availableDays = availability.filter((day) => day.hasAvailability);

  // Plain text version
  const textParts: string[] = [intro, ''];
  
  if (availableDays.length === 0) {
    textParts.push("Unfortunately, we're fully booked for the next two weeks.");
    textParts.push('');
    textParts.push("We'd be happy to add you to our waitlist or schedule further out.");
    textParts.push('');
    textParts.push(cta);
    
    const htmlParts: string[] = [
      '<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">',
      `<p>${intro}</p>`,
      '<p style="color: #666; font-style: italic;">Unfortunately, we\'re fully booked for the next two weeks.</p>',
      '<p>We\'d be happy to add you to our waitlist or schedule further out.</p>',
      `<p>${cta}</p>`,
      '</div>',
    ];
    
    return {
      text: textParts.join('\n'),
      html: htmlParts.join(''),
    };
  }

  availableDays.forEach((day) => {
    textParts.push(`${day.date}:`);
    day.slots.forEach((slot) => {
      textParts.push(`  • ${slot}`);
    });
    textParts.push('');
  });

  textParts.push(cta);

  // HTML version with styled table
  const htmlParts: string[] = [
    '<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">',
    `<p style="font-size: 16px;">${intro}</p>`,
    '<table style="width: 100%; max-width: 600px; border-collapse: collapse; margin: 20px 0;">',
    '<thead>',
    '<tr style="background-color: #f8f9fa;">',
    '<th style="padding: 12px; text-align: left; border-bottom: 2px solid #dee2e6; font-weight: 600;">Date</th>',
    '<th style="padding: 12px; text-align: left; border-bottom: 2px solid #dee2e6; font-weight: 600;">Available Times</th>',
    '</tr>',
    '</thead>',
    '<tbody>',
  ];

  availableDays.forEach((day, index) => {
    const bgColor = index % 2 === 0 ? '#ffffff' : '#f8f9fa';
    htmlParts.push(`<tr style="background-color: ${bgColor};">`);
    htmlParts.push(`<td style="padding: 12px; border-bottom: 1px solid #dee2e6; font-weight: 500;">${day.date}</td>`);
    htmlParts.push(`<td style="padding: 12px; border-bottom: 1px solid #dee2e6;">${day.slots.join('<br>')}</td>`);
    htmlParts.push('</tr>');
  });

  htmlParts.push(
    '</tbody>',
    '</table>',
    `<p style="font-size: 16px; margin-top: 20px;">${cta}</p>`,
    '</div>'
  );

  return {
    text: textParts.join('\n'),
    html: htmlParts.join(''),
  };
}

/**
 * Format availability for social media (Facebook/Instagram)
 * Uses emojis and friendly formatting for better engagement
 */
export function formatForSocial(
  availability: DayAvailability[],
  intro: string,
  cta: string
): string {
  const parts: string[] = [intro, ''];

  const availableDays = availability.filter((day) => day.hasAvailability);

  if (availableDays.length === 0) {
    parts.push("😔 Unfortunately, we're fully booked for the next two weeks!");
    parts.push('');
    parts.push("💡 We'd love to add you to our waitlist or schedule further out. Just let us know! 🚗✨");
    return parts.join('\n');
  }

  availableDays.forEach((day) => {
    parts.push(`✨ ${day.date}`);
    day.slots.forEach((slot) => {
      parts.push(`   • ${slot}`);
    });
    parts.push('');
  });

  parts.push(cta);

  return parts.join('\n');
}

/**
 * Apply template variables to text
 * Supports simple variable replacement like {{contact.firstName}}, {{contact.name}}
 */
export function applyTemplateVariables(
  text: string,
  variables: {
    contactName?: string;
    contactFirstName?: string;
  }
): string {
  let result = text;

  // Replace {{contact.firstName}} or {{contact.name}}
  if (variables.contactFirstName) {
    result = result.replace(/\{\{contact\.firstName\}\}/g, variables.contactFirstName);
  }

  if (variables.contactName) {
    result = result.replace(/\{\{contact\.name\}\}/g, variables.contactName);
  }

  // Handle conditional blocks like {{#if contact.firstName}} ... {{/if}}
  // Simple implementation - if firstName exists, include the content
  if (variables.contactFirstName) {
    result = result.replace(/\{\{#if contact\.firstName\}\}(.*?)\{\{\/if\}\}/g, '$1');
  } else {
    result = result.replace(/\{\{#if contact\.firstName\}\}(.*?)\{\{\/if\}\}/g, '');
  }

  // Handle conditional blocks for contact.name
  if (variables.contactName) {
    result = result.replace(/\{\{#if contact\.name\}\}(.*?)\{\{\/if\}\}/g, '$1');
  } else {
    result = result.replace(/\{\{#if contact\.name\}\}(.*?)\{\{\/if\}\}/g, '');
  }

  return result;
}
