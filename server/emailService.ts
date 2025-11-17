import sgMail from '@sendgrid/mail';
import { RewardService } from "@shared/schema";

const DEMO_MODE = process.env.DEMO_MODE === 'true';

// Initialize SendGrid with API key
if (!process.env.SENDGRID_API_KEY) {
  console.warn('SENDGRID_API_KEY not found, email notifications will not be available');
} else {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  console.log('SendGrid client initialized successfully');
}

// Your verified business email address - read from environment
const BUSINESS_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'info@cleanmachinetulsa.com';

// Business phone number - configurable via environment variable
const getBusinessPhoneNumber = () => process.env.BUSINESS_PHONE_NUMBER || '+19188565711';
const getBusinessPhoneDisplay = () => {
  const phone = getBusinessPhoneNumber();
  // Format +19188565711 as (918) 856-5711
  if (phone.startsWith('+1')) {
    const digits = phone.slice(2); // Remove +1
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
};

if (process.env.SENDGRID_FROM_EMAIL) {
  console.log(`[EMAIL] Sender configured: ${BUSINESS_EMAIL}`);
} else {
  console.warn('[EMAIL] SENDGRID_FROM_EMAIL not set, using default: info@cleanmachinetulsa.com');
}

/**
 * Check if customer has consented to SMS communications
 * This will eventually check the Google Sheets database for consent status
 */
export async function hasCustomerSmsConsent(phone: string): Promise<boolean> {
  // For now, we'll implement the basic logic
  // In a full implementation, this would query the customer database
  // to check the SMS Consent column value
  console.log(`Checking SMS consent for phone: ${phone}`);
  // Return false by default to ensure we only send emails unless explicitly consented
  return false;
}

/**
 * Send communication respecting customer's SMS consent preferences
 * If SMS consent is given, send both email and SMS
 * If no SMS consent, only send email
 */
export async function sendCustomerCommunication(
  phone: string,
  email: string,
  subject: string,
  message: string,
  hasSmsConsent: boolean = false
): Promise<{ success: boolean; method: string; error?: any }> {
  
  if (hasSmsConsent) {
    // Customer consented to SMS, can send both email and SMS
    console.log(`Customer ${phone} has SMS consent - sending both email and SMS`);
    
    // Send email if email address provided
    if (email) {
      const emailResult = await sendBusinessEmail(email, subject, message);
      if (!emailResult.success) {
        console.error('Failed to send email:', emailResult.error);
      }
    }
    
    // Here we would also send SMS using Twilio or similar service
    console.log(`SMS would be sent to ${phone}: ${message.substring(0, 100)}...`);
    
    return { success: true, method: 'email and SMS' };
  } else {
    // No SMS consent, only send email
    console.log(`Customer ${phone} has NO SMS consent - sending email only`);
    
    if (!email) {
      return { success: false, method: 'none', error: 'No email provided and SMS consent not given' };
    }
    
    const emailResult = await sendBusinessEmail(email, subject, message);
    return { 
      success: emailResult.success, 
      method: 'email only',
      error: emailResult.error 
    };
  }
}

/**
 * Send an email using SendGrid
 */
export async function sendBusinessEmail(
  to: string,
  subject: string,
  textContent: string,
  htmlContent?: string
): Promise<{ success: boolean; error?: any }> {
  if (DEMO_MODE) {
    // In demo mode, log the email but don't actually send it
    console.log(`[DEMO MODE] Email would be sent to ${to}`);
    console.log(`[DEMO MODE] Subject: ${subject}`);
    console.log(`[DEMO MODE] Content: ${textContent.substring(0, 100)}...`);
    return { success: true };
  }

  if (!process.env.SENDGRID_API_KEY) {
    return { success: false, error: 'SendGrid API key not configured' };
  }

  try {
    await sgMail.send({
      to,
      from: BUSINESS_EMAIL,
      subject,
      text: textContent,
      html: htmlContent || textContent.replace(/\n/g, '<br>'),
    });

    return { success: true };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error };
  }
}

/**
 * Send a password reset email
 */
export async function sendPasswordResetEmail(
  toEmail: string,
  resetLink: string
): Promise<{ success: boolean; error?: any }> {
  const subject = `Reset Your Clean Machine Password`;

  const textContent = `
Hello,

You requested to reset your password for Clean Machine Auto Detail.

Click the link below to reset your password (expires in 1 hour):
${resetLink}

If you didn't request this, you can safely ignore this email.

Thanks,
Clean Machine Auto Detail Team
  `.trim();

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Reset Your Password</h2>
      <p>You requested to reset your password for Clean Machine Auto Detail.</p>
      <p>Click the button below to reset your password (expires in 1 hour):</p>
      <div style="margin: 30px 0;">
        <a href="${resetLink}" style="background-color: #4CAF50; color: white; padding: 14px 28px; text-decoration: none; border-radius: 4px; display: inline-block;">Reset Password</a>
      </div>
      <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
      <p style="color: #666; font-size: 12px; word-break: break-all;">${resetLink}</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
      <p style="color: #999; font-size: 12px;">If you didn't request this, you can safely ignore this email.</p>
      <p style="color: #999; font-size: 12px;">Thanks,<br>Clean Machine Auto Detail Team</p>
    </div>
  `;

  return sendBusinessEmail(toEmail, subject, textContent, htmlContent);
}

/**
 * Send a booking confirmation email
 * NOW USES BRANDED TEMPLATE SYSTEM (matching invoice quality)
 */
export async function sendBookingConfirmationEmail(
  toEmail: string,
  customerName: string,
  serviceName: string,
  appointmentTime: string,
  address: string,
  addOns: string[] = [],
  vehicleInfo: string = ''
): Promise<{ success: boolean; error?: any }> {
  const subject = `Your Clean Machine Auto Detail Appointment Confirmation`;
  
  // Import the branded template system
  const { renderBrandedEmail, renderBrandedEmailPlainText } = await import('./emailTemplates/base');
  
  // Build appointment details table
  const appointmentDetails: Array<{ label: string; value: string }> = [
    { label: 'Service', value: serviceName }
  ];
  
  if (addOns.length > 0) {
    appointmentDetails.push({ label: 'Add-on Services', value: addOns.join(', ') });
  }
  
  if (vehicleInfo) {
    appointmentDetails.push({ label: 'Vehicle', value: vehicleInfo });
  }
  
  appointmentDetails.push(
    { label: 'Date & Time', value: appointmentTime },
    { label: 'Location', value: address }
  );
  
  // Build preparation instructions list
  const preparationItems: Array<{ label: string; value: string }> = [
    { label: '✓', value: 'Please ensure personal items are removed from the vehicle if possible.' },
    { label: '✓', value: 'We\'ll need access to a power outlet and water spigot.' },
    { label: '✓', value: 'We bring a 100ft extension cord and hose to reach your hookups.' },
    { label: '✓', value: 'For apartments/condos, we can run the power cable through a door or window if needed.' },
    { label: '✓', value: 'Please clear any other vehicles from the driveway to provide space for our canopy and equipment.' }
  ];
  
  // Create email data using branded template
  const emailData: any = {
    preheader: `Your appointment for ${serviceName} is confirmed for ${appointmentTime}`,
    subject: subject,
    hero: {
      title: `Appointment Confirmed! 🎉`,
      subtitle: `Thank you for choosing Clean Machine Auto Detail, ${customerName}`
    },
    sections: [
      {
        type: 'text',
        content: '<p style="font-size: 16px; margin-bottom: 20px;">We\'re excited to make your vehicle shine! Here are your appointment details:</p>'
      },
      {
        type: 'table',
        items: appointmentDetails
      },
      {
        type: 'spacer',
        padding: '20px'
      },
      {
        type: 'highlight',
        content: '<strong>📋 Preparation Instructions</strong><br><br>Please review these simple steps to ensure we can provide the best service:'
      },
      {
        type: 'list',
        items: preparationItems
      },
      {
        type: 'spacer',
        padding: '20px'
      },
      {
        type: 'text',
        content: `
          <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 20px 0;">
            <h3 style="color: #92400e; margin-top: 0; font-size: 18px; font-weight: bold;">Need to Change Your Appointment?</h3>
            <p style="margin: 10px 0; color: #1f2937;"><strong>To reschedule:</strong> Reply to this email with "RESCHEDULE" in the subject line.</p>
            <p style="margin: 10px 0; color: #1f2937;"><strong>To cancel:</strong> Reply to this email with "CANCEL" in the subject line.</p>
            <p style="margin: 10px 0; color: #1f2937;"><strong>For other questions:</strong> Call us at <strong style="color: #7c3aed;">${getBusinessPhoneDisplay()}</strong></p>
          </div>
        `
      }
    ],
    ctas: [
      {
        text: 'View Appointment',
        url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`,
        style: 'primary'
      },
      {
        text: 'My Services',
        url: `${process.env.VITE_DEPLOYMENT_URL || 'https://cleanmachinetulsa.replit.app'}/my-services`,
        style: 'secondary'
      },
      {
        text: 'Reschedule',
        url: `tel:${getBusinessPhoneNumber()}`,
        style: 'secondary'
      }
    ],
    notes: 'We look forward to making your vehicle shine! If you have any questions before your appointment, don\'t hesitate to reach out.'
  };
  
  // Render HTML and plain text versions
  const htmlContent = renderBrandedEmail(emailData);
  const textContent = renderBrandedEmailPlainText(emailData);
  
  return await sendBusinessEmail(toEmail, subject, textContent, htmlContent);
}

/**
 * Send a reminder email for upcoming appointment
 * NOW USES BRANDED TEMPLATE SYSTEM (matching invoice quality)
 */
export async function sendReminderEmail(
  toEmail: string,
  customerName: string,
  serviceName: string,
  appointmentTime: string,
  address: string,
  addOns: string[] = [],
  vehicleInfo: string = ''
): Promise<{ success: boolean; error?: any }> {
  const subject = `Reminder: Your Clean Machine Auto Detail Appointment Tomorrow`;
  
  // Import the branded template system
  const { renderBrandedEmail, renderBrandedEmailPlainText } = await import('./emailTemplates/base');
  
  // Build appointment details table
  const appointmentDetails: Array<{ label: string; value: string }> = [
    { label: 'Service', value: serviceName }
  ];
  
  if (addOns.length > 0) {
    appointmentDetails.push({ label: 'Add-on Services', value: addOns.join(', ') });
  }
  
  if (vehicleInfo) {
    appointmentDetails.push({ label: 'Vehicle', value: vehicleInfo });
  }
  
  appointmentDetails.push(
    { label: 'Date & Time', value: appointmentTime },
    { label: 'Location', value: address }
  );
  
  // Build preparation instructions list
  const preparationItems: Array<{ label: string; value: string }> = [
    { label: '✓', value: 'Please ensure personal items are removed from the vehicle if possible.' },
    { label: '✓', value: 'We\'ll need access to a power outlet and water spigot.' },
    { label: '✓', value: 'We bring a 100ft extension cord and hose to reach your hookups.' },
    { label: '✓', value: 'For apartments/condos, we can run the power cable through a door or window if needed.' },
    { label: '✓', value: 'Please clear any other vehicles from the driveway to provide space for our canopy and equipment.' }
  ];
  
  // Create email data using branded template
  const emailData: any = {
    preheader: `Friendly reminder: Your appointment for ${serviceName} is tomorrow at ${appointmentTime}`,
    subject: subject,
    hero: {
      title: `See You Tomorrow! ⏰`,
      subtitle: `Friendly reminder about your appointment, ${customerName}`
    },
    sections: [
      {
        type: 'text',
        content: '<p style="font-size: 16px; margin-bottom: 20px;">This is a friendly reminder about your Clean Machine Auto Detail appointment tomorrow. We\'re looking forward to making your vehicle shine!</p>'
      },
      {
        type: 'table',
        items: appointmentDetails
      },
      {
        type: 'spacer',
        padding: '20px'
      },
      {
        type: 'highlight',
        content: '<strong>📋 Preparation Instructions</strong><br><br>Please review these simple steps to ensure we can provide the best service tomorrow:'
      },
      {
        type: 'list',
        items: preparationItems
      },
      {
        type: 'spacer',
        padding: '20px'
      },
      {
        type: 'text',
        content: `
          <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 20px 0;">
            <h3 style="color: #92400e; margin-top: 0; font-size: 18px; font-weight: bold;">Need to Change Your Appointment?</h3>
            <p style="margin: 10px 0; color: #1f2937;"><strong>To reschedule:</strong> Reply to this email with "RESCHEDULE" in the subject line.</p>
            <p style="margin: 10px 0; color: #1f2937;"><strong>To cancel:</strong> Reply to this email with "CANCEL" in the subject line.</p>
            <p style="margin: 10px 0; color: #1f2937;"><strong>For other questions:</strong> Call us at <strong style="color: #7c3aed;">${getBusinessPhoneDisplay()}</strong></p>
          </div>
        `
      }
    ],
    ctas: [
      {
        text: 'View Appointment',
        url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`,
        style: 'primary'
      },
      {
        text: 'Call Us',
        url: `tel:${getBusinessPhoneNumber()}`,
        style: 'secondary'
      }
    ],
    notes: 'We look forward to seeing you tomorrow! If you have any last-minute questions, don\'t hesitate to reach out.'
  };
  
  // Render HTML and plain text versions
  const htmlContent = renderBrandedEmail(emailData);
  const textContent = renderBrandedEmailPlainText(emailData);
  
  return await sendBusinessEmail(toEmail, subject, textContent, htmlContent);
}

/**
 * Send cancellation confirmation email
 * NOW USES BRANDED TEMPLATE SYSTEM (matching invoice quality)
 */
export async function sendCancellationConfirmationEmail(
  toEmail: string,
  customerName: string,
  serviceName: string,
  appointmentTime: string,
  cancellationReason?: string
): Promise<{ success: boolean; error?: any }> {
  const subject = `Appointment Cancelled - Clean Machine Auto Detail`;
  
  // Import the branded template system
  const { renderBrandedEmail, renderBrandedEmailPlainText } = await import('./emailTemplates/base');
  
  // Build cancelled appointment details table
  const cancelledDetails: Array<{ label: string; value: string }> = [
    { label: 'Service', value: serviceName },
    { label: 'Date & Time', value: appointmentTime }
  ];
  
  if (cancellationReason) {
    cancelledDetails.push({ label: 'Reason', value: cancellationReason });
  }
  
  // Build rebooking options list
  const rebookingOptions: Array<{ label: string; value: string }> = [
    { label: '📞', value: 'Call us at (918) 856-5304' },
    { label: '💬', value: 'Reply to this email' },
    { label: '🌐', value: 'Visit our website to book online' }
  ];
  
  // Create email data using branded template
  const emailData: any = {
    preheader: `Your appointment for ${serviceName} on ${appointmentTime} has been cancelled`,
    subject: subject,
    hero: {
      title: `Appointment Cancelled`,
      subtitle: `We're sorry we won't see you this time, ${customerName}`
    },
    sections: [
      {
        type: 'text',
        content: '<p style="font-size: 16px; margin-bottom: 20px;">Your Clean Machine Auto Detail appointment has been cancelled. Here are the details:</p>'
      },
      {
        type: 'table',
        items: cancelledDetails
      },
      {
        type: 'spacer',
        padding: '20px'
      },
      {
        type: 'highlight',
        content: '<strong>📅 Ready to Rebook?</strong><br><br>We\'d love to serve you in the future! Here\'s how you can schedule a new appointment:'
      },
      {
        type: 'list',
        items: rebookingOptions
      },
      {
        type: 'spacer',
        padding: '20px'
      },
      {
        type: 'text',
        content: '<p style="font-size: 15px; color: #6b7280;">Thank you for considering Clean Machine Auto Detail. We hope to make your vehicle shine soon!</p>'
      }
    ],
    ctas: [
      {
        text: 'Book Again',
        url: `tel:${getBusinessPhoneNumber()}`,
        style: 'primary'
      },
      {
        text: 'Contact Us',
        url: `tel:${getBusinessPhoneNumber()}`,
        style: 'secondary'
      }
    ],
    notes: 'If you cancelled by mistake or need assistance, please don\'t hesitate to reach out. We\'re here to help!'
  };
  
  // Render HTML and plain text versions
  const htmlContent = renderBrandedEmail(emailData);
  const textContent = renderBrandedEmailPlainText(emailData);
  
  return await sendBusinessEmail(toEmail, subject, textContent, htmlContent);
}

/**
 * Send review request email
 * NOW USES BRANDED TEMPLATE SYSTEM (matching invoice quality)
 */
export async function sendReviewRequestEmail(
  toEmail: string,
  customerName: string,
  serviceName: string,
  loyaltyPoints?: number
): Promise<{ success: boolean; error?: any }> {
  const subject = `How Was Your Experience? - Clean Machine Auto Detail`;
  
  // Import the branded template system
  const { renderBrandedEmail, renderBrandedEmailPlainText } = await import('./emailTemplates/base');
  
  // Build loyalty points section if applicable
  const loyaltySection = loyaltyPoints && loyaltyPoints > 0 ? [
    {
      type: 'spacer',
      padding: '20px'
    },
    {
      type: 'text',
      content: `
        <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 20px 0; text-align: center;">
          <h3 style="color: #92400e; margin-top: 0; font-size: 18px; font-weight: bold;">🎉 You Earned Loyalty Points!</h3>
          <div style="font-size: 36px; font-weight: bold; color: #7c3aed; margin: 15px 0;">${loyaltyPoints} Points</div>
          <p style="margin: 10px 0; color: #1f2937;">Your total loyalty points are adding up! Keep them coming and unlock exclusive rewards and discounts.</p>
        </div>
      `
    }
  ] : [];
  
  // Create email data using branded template
  const emailData: any = {
    preheader: `Thank you for choosing Clean Machine! We'd love to hear about your experience with our ${serviceName}`,
    subject: subject,
    hero: {
      title: `Thank You! 🌟`,
      subtitle: `We hope you love your freshly detailed vehicle, ${customerName}`
    },
    sections: [
      {
        type: 'text',
        content: `<p style="font-size: 16px; margin-bottom: 20px;">Thank you for choosing Clean Machine Auto Detail for your ${serviceName}! We hope your vehicle is looking and feeling amazing.</p>`
      },
      {
        type: 'text',
        content: '<p style="font-size: 16px; margin-bottom: 20px;"><strong>Would you mind sharing your experience?</strong> Your feedback helps us improve and helps other customers find the best auto detailing service in Tulsa.</p>'
      },
      {
        type: 'spacer',
        padding: '20px'
      },
      {
        type: 'highlight',
        content: '<strong>⭐ Leave Us a Review</strong><br><br>Your honest review would mean the world to us! It only takes a minute:'
      },
      {
        type: 'text',
        content: `
          <div style="margin: 20px 0;">
            <div style="margin-bottom: 15px;">
              <a href="https://g.page/r/CQo53O2yXrN8EBM/review" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">⭐ Review on Google</a>
            </div>
            <div>
              <a href="https://www.facebook.com/cleanmachinetulsa/reviews" style="display: inline-block; background: #1877f2; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">👍 Review on Facebook</a>
            </div>
          </div>
        `
      },
      ...loyaltySection,
      {
        type: 'spacer',
        padding: '20px'
      },
      {
        type: 'text',
        content: '<p style="font-size: 15px; color: #6b7280;"><strong>Need something else?</strong> We offer a full range of detailing services including paint correction, ceramic coating, and our popular Maintenance Detail Program. <strong>Call us at (918) 856-5304</strong> to schedule your next service!</p>'
      }
    ],
    ctas: [
      {
        text: 'Leave Google Review',
        url: 'https://g.page/r/CQo53O2yXrN8EBM/review',
        style: 'primary'
      },
      {
        text: 'Book Next Service',
        url: `tel:${getBusinessPhoneNumber()}`,
        style: 'secondary'
      }
    ],
    notes: 'We truly appreciate your business and look forward to serving you again soon!'
  };
  
  // Render HTML and plain text versions
  const htmlContent = renderBrandedEmail(emailData);
  const textContent = renderBrandedEmailPlainText(emailData);
  
  return await sendBusinessEmail(toEmail, subject, textContent, htmlContent);
}

/**
 * Send post-service thank you email with payment confirmation
 * NOW USES BRANDED TEMPLATE SYSTEM (matching invoice quality)
 */
export async function sendPostServiceThankYouEmail(
  toEmail: string,
  customerName: string,
  serviceName: string,
  amount: number,
  paymentMethod: string,
  invoiceNumber?: string,
  loyaltyPoints?: number,
  nextServiceRecommendation?: string
): Promise<{ success: boolean; error?: any }> {
  const subject = `Thank You for Your Business - Clean Machine Auto Detail`;
  
  // Import the branded template system
  const { renderBrandedEmail, renderBrandedEmailPlainText } = await import('./emailTemplates/base');
  
  // Build payment details table
  const paymentDetails: Array<{ label: string; value: string }> = [
    { label: 'Service', value: serviceName },
    { label: 'Amount', value: `$${amount.toFixed(2)}` },
    { label: 'Payment Method', value: paymentMethod }
  ];
  
  if (invoiceNumber) {
    paymentDetails.push({ label: 'Invoice Number', value: invoiceNumber });
  }
  
  // Build loyalty points section if applicable
  const loyaltySection = loyaltyPoints && loyaltyPoints > 0 ? [
    {
      type: 'spacer',
      padding: '20px'
    },
    {
      type: 'text',
      content: `
        <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 20px 0; text-align: center;">
          <h3 style="color: #92400e; margin-top: 0; font-size: 18px; font-weight: bold;">🎉 You Earned Loyalty Points!</h3>
          <div style="font-size: 36px; font-weight: bold; color: #7c3aed; margin: 15px 0;">${loyaltyPoints} Points</div>
          <p style="margin: 10px 0; color: #1f2937;">Your loyalty points are adding up! Keep them coming and unlock exclusive rewards and discounts on future services.</p>
        </div>
      `
    }
  ] : [];
  
  // Build next service recommendation section if provided
  const nextServiceSection = nextServiceRecommendation ? [
    {
      type: 'spacer',
      padding: '20px'
    },
    {
      type: 'highlight',
      content: `<strong>🚗 Recommended Next Service</strong><br><br>${nextServiceRecommendation}`
    },
    {
      type: 'text',
      content: '<p style="font-size: 15px; color: #6b7280; margin-top: 10px;">Call us at <strong style="color: #7c3aed;">(918) 856-5304</strong> to schedule your next appointment and keep your vehicle looking its best!</p>'
    }
  ] : [];
  
  // Create email data using branded template
  const emailData: any = {
    preheader: `Payment received for ${serviceName} - $${amount.toFixed(2)}. Thank you for choosing Clean Machine!`,
    subject: subject,
    hero: {
      title: `Payment Received! 💳`,
      subtitle: `Thank you for your business, ${customerName}`
    },
    sections: [
      {
        type: 'text',
        content: `<p style="font-size: 16px; margin-bottom: 20px;">Thank you for choosing Clean Machine Auto Detail! We hope your vehicle is looking amazing after your ${serviceName}.</p>`
      },
      {
        type: 'text',
        content: '<p style="font-size: 16px; margin-bottom: 20px;"><strong>Payment Confirmation:</strong> We\'ve received your payment. Here are the details:</p>'
      },
      {
        type: 'table',
        items: paymentDetails
      },
      ...loyaltySection,
      {
        type: 'spacer',
        padding: '20px'
      },
      {
        type: 'highlight',
        content: '<strong>⭐ How Did We Do?</strong><br><br>Your feedback helps us improve and helps other customers find the best auto detailing service in Tulsa. Would you mind leaving us a quick review?'
      },
      {
        type: 'list',
        items: [
          { label: '⭐ Google', value: 'https://g.page/r/CQo53O2yXrN8EBM/review' },
          { label: '👍 Facebook', value: 'https://www.facebook.com/cleanmachinetulsa/reviews' }
        ]
      },
      {
        type: 'text',
        content: `
          <div style="margin: 20px 0; text-align: center;">
            <div style="margin-bottom: 15px;">
              <a href="https://g.page/r/CQo53O2yXrN8EBM/review" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">⭐ Review on Google</a>
            </div>
            <div>
              <a href="https://www.facebook.com/cleanmachinetulsa/reviews" style="display: inline-block; background: #1877f2; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">👍 Review on Facebook</a>
            </div>
          </div>
        `
      },
      ...nextServiceSection
    ],
    ctas: [
      {
        text: 'Leave a Review',
        url: 'https://g.page/r/CQo53O2yXrN8EBM/review',
        style: 'primary'
      },
      {
        text: 'Book Next Service',
        url: `tel:${getBusinessPhoneNumber()}`,
        style: 'secondary'
      }
    ],
    notes: 'We truly appreciate your business! If you have any questions about your service or payment, don\'t hesitate to reach out.'
  };
  
  // Render HTML and plain text versions
  const htmlContent = renderBrandedEmail(emailData);
  const textContent = renderBrandedEmailPlainText(emailData);
  
  return await sendBusinessEmail(toEmail, subject, textContent, htmlContent);
}

/**
 * Send a weather alert email for appointment reschedule
 */
export async function sendWeatherAlertEmail(
  toEmail: string,
  customerName: string,
  appointmentTime: string,
  weatherCondition: string,
  suggestedTimes: string[] = []
): Promise<{ success: boolean; error?: any }> {
  const subject = `Weather Alert: Your Clean Machine Appointment on ${appointmentTime}`;
  
  const suggestedTimesText = suggestedTimes.length > 0
    ? `\n\nWe'd be happy to reschedule you for one of these alternative times:\n${suggestedTimes.map((time, i) => `${i + 1}. ${time}`).join('\n')}`
    : '';

  const textContent = `
Hello ${customerName},

We're reaching out about your Clean Machine Auto Detail appointment scheduled for ${appointmentTime}.

The forecast shows ${weatherCondition}, which may impact the quality of our exterior detailing work. We want to ensure you get the best possible results for your vehicle.
${suggestedTimesText}

To reschedule or if you'd like to proceed anyway:
- Reply to this email
- Call us at (918) 856-5304
- Text us to confirm

We appreciate your understanding and look forward to making your vehicle shine!

Best regards,
Jody
Clean Machine Auto Detail
`;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #f59e0b; color: white; padding: 15px; text-align: center; border-radius: 4px 4px 0 0; }
    .content { padding: 20px; background-color: #f9fafb; }
    .alert-box { margin: 20px 0; background-color: #fef3c7; padding: 15px; border-left: 4px solid #f59e0b; border-radius: 4px; }
    .times-list { margin: 15px 0; background-color: white; padding: 15px; border-radius: 4px; }
    .footer { text-align: center; padding-top: 20px; font-size: 0.9em; color: #666; }
    h2 { color: #92400e; }
    .time-option { padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
    .time-option:last-child { border-bottom: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⚠️ Weather Alert</h1>
    </div>
    <div class="content">
      <p>Hello ${customerName},</p>
      <p>We're reaching out about your <strong>Clean Machine Auto Detail</strong> appointment scheduled for <strong>${appointmentTime}</strong>.</p>
      
      <div class="alert-box">
        <h2 style="margin-top: 0;">Weather Concern</h2>
        <p>The forecast shows <strong>${weatherCondition}</strong>, which may impact the quality of our exterior detailing work. We want to ensure you get the best possible results for your vehicle.</p>
      </div>
      
      ${suggestedTimes.length > 0 ? `
      <div class="times-list">
        <h2 style="margin-top: 0;">Alternative Times Available</h2>
        <p>We'd be happy to reschedule you for one of these times:</p>
        ${suggestedTimes.map((time, i) => `
          <div class="time-option">
            <strong>${i + 1}.</strong> ${time}
          </div>
        `).join('')}
      </div>
      ` : ''}
      
      <div style="margin: 20px 0; background-color: #e0f2fe; padding: 15px; border-radius: 4px; border-left: 4px solid #0284c7;">
        <h2 style="color: #075985; margin-top: 0;">To Reschedule or Proceed:</h2>
        <ul style="margin: 10px 0; padding-left: 20px;">
          <li>Reply to this email</li>
          <li>Call us at <strong>(918) 856-5304</strong></li>
          <li>Text us to confirm</li>
        </ul>
      </div>
      
      <p>We appreciate your understanding and look forward to making your vehicle shine!</p>
      
      <p>Best regards,<br>
      Jody<br>
      Clean Machine Auto Detail</p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} Clean Machine Auto Detail. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;

  return await sendBusinessEmail(toEmail, subject, textContent, htmlContent);
}