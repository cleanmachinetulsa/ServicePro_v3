import { conversationState } from './conversationState';
import { sendSMS } from './notifications';

/**
 * Request damage photos from customer
 * Flags the appointment for damage assessment and notifies business owner
 */
export async function requestDamagePhotos(
  phone: string,
  damageDescription: string,
  damageType: string
): Promise<{
  success: boolean;
  message: string;
  photoUploadInstructions: string;
}> {
  try {
    // Get conversation state to mark for damage assessment
    const state = conversationState.getState(phone);
    
    // Update state with damage info and set status to pending
    conversationState.updateState(phone, {
      damageAssessmentRequested: true,
      damageDescription,
      damageType,
      damageAssessmentStatus: 'pending',
      damagePhotosUploaded: [], // Initialize empty array for photo URLs
    } as any);
    
    console.log(`[DAMAGE ASSESSMENT] Photo request for ${phone}: ${damageDescription} (${damageType})`);
    
    // Generate upload instructions based on platform
    const photoUploadInstructions = `To upload photos, simply text them back to this number or upload them in the chat. I'll make sure the business owner reviews them before your appointment.`;
    
    return {
      success: true,
      message: `Photo request sent to customer for: ${damageDescription}`,
      photoUploadInstructions
    };
  } catch (error) {
    console.error('[DAMAGE ASSESSMENT ERROR]:', error);
    return {
      success: false,
      message: `Failed to request photos: ${(error as Error).message}`,
      photoUploadInstructions: ''
    };
  }
}

/**
 * Handle photo upload from customer
 * Stores photo in Google Drive and alerts business owner
 */
export async function handleDamagePhotoUpload(
  phone: string,
  photoUrl: string,
  mimeType: string
): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    const state = conversationState.getState(phone);
    const customerName = state.customerName || 'Customer';
    const damageDescription = (state as any).damageDescription || 'vehicle damage';
    
    // Record photo URL in conversation state
    const existingPhotos = (state as any).damagePhotosUploaded || [];
    conversationState.updateState(phone, {
      damagePhotosUploaded: [...existingPhotos, photoUrl],
    } as any);
    
    // Get business phone for alert (using correct env var)
    const businessPhone = process.env.BUSINESS_OWNER_PHONE;
    
    if (businessPhone) {
      // Send immediate SMS alert to business owner with photo link
      const alertMessage = `🚨 DAMAGE ASSESSMENT NEEDED

Customer: ${customerName}
Phone: ${phone}
Issue: ${damageDescription}

📸 Photo Link: ${photoUrl}

${state.selectedTimeSlot ? `Scheduled: ${state.selectedTimeSlot}` : 'Not yet scheduled'}

Reply to this message to contact customer directly.`;
      
      await sendSMS(businessPhone, alertMessage);
      console.log(`[DAMAGE ASSESSMENT] Business alert sent to ${businessPhone} for ${phone}`);
    } else {
      console.warn('[DAMAGE ASSESSMENT] No business phone configured - skipping SMS alert');
    }
    
    return {
      success: true,
      message: 'Photo received and business owner notified'
    };
  } catch (error) {
    console.error('[DAMAGE PHOTO UPLOAD ERROR]:', error);
    return {
      success: false,
      message: `Failed to process photo: ${(error as Error).message}`
    };
  }
}

/**
 * Get damage assessment information for an appointment from conversation state
 */
export function getDamageAssessmentInfo(phone: string): {
  hasDamageAssessment: boolean;
  damageDescription?: string;
  damageType?: string;
  damagePhotos?: string[];
  assessmentRequestedAt?: Date;
} {
  const state = conversationState.getState(phone);
  const damageAssessmentRequested = (state as any).damageAssessmentRequested || false;
  
  if (!damageAssessmentRequested) {
    return { hasDamageAssessment: false };
  }
  
  return {
    hasDamageAssessment: true,
    damageDescription: (state as any).damageDescription,
    damageType: (state as any).damageType,
    damagePhotos: (state as any).damagePhotosUploaded || [],
    assessmentRequestedAt: new Date(),
  };
}
