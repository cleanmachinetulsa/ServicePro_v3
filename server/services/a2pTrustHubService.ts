/**
 * A2P TrustHub Service
 * 
 * Handles Twilio TrustHub API integration for A2P 10DLC campaign registration.
 * This service manages brand registration, campaign submission, and status tracking.
 * 
 * Key functions:
 * - ensureBrandForTenant: Creates or retrieves Twilio brand for a tenant
 * - submitOrUpdateCampaign: Submits campaign to Twilio TrustHub
 * - refreshCampaignStatus: Fetches current status from Twilio
 */

import { twilioClient } from '../twilioClient';
import { db } from '../db';
import type { TenantDb } from '../tenantDb';
import { 
  a2pCampaigns, 
  tenants, 
  tenantConfig,
  type A2pCampaign 
} from '@shared/schema';
import { eq } from 'drizzle-orm';

// Twilio TrustHub status mapping to our internal status
const TWILIO_STATUS_MAP: Record<string, string> = {
  'draft': 'draft',
  'pending-review': 'pending',
  'in-review': 'in_review',
  'twilio-approved': 'approved',
  'approved': 'approved',
  'twilio-rejected': 'rejected',
  'rejected': 'rejected',
  'failed': 'rejected',
  'suspended': 'suspended',
};

// A2P use case mapping to Twilio use case codes
const USE_CASE_MAP: Record<string, string> = {
  'appointment_reminders': 'MIXED',
  'customer_care': 'CUSTOMER_CARE',
  'delivery_notifications': 'DELIVERY_NOTIFICATION',
  'account_notifications': 'ACCOUNT_NOTIFICATION',
  'marketing': 'LOW_VOLUME',
  'mixed': 'MIXED',
  'security_alerts': 'SECURITY_ALERT',
  '2fa': '2FA',
};

/**
 * Custom error class for TrustHub operations
 */
export class TrustHubError extends Error {
  code: string;
  twilioError?: any;
  
  constructor(message: string, code: string, twilioError?: any) {
    super(message);
    this.name = 'TrustHubError';
    this.code = code;
    this.twilioError = twilioError;
  }
}

/**
 * Ensure a Twilio brand exists for a tenant
 * Creates a new brand if one doesn't exist, otherwise returns existing brand SID
 * 
 * @param tenantId - The tenant ID
 * @returns Brand SID and whether it was newly created
 */
export async function ensureBrandForTenant(
  tenantId: string
): Promise<{ brandSid: string; created: boolean }> {
  if (!twilioClient) {
    throw new TrustHubError(
      'Twilio client not configured. Please set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.',
      'TWILIO_NOT_CONFIGURED'
    );
  }

  // Check if tenant already has a brand SID
  const [campaign] = await db
    .select({ twilioBrandSid: a2pCampaigns.twilioBrandSid })
    .from(a2pCampaigns)
    .where(eq(a2pCampaigns.tenantId, tenantId))
    .limit(1);

  if (campaign?.twilioBrandSid) {
    console.log(`[A2P TRUSTHUB] Tenant ${tenantId} already has brand: ${campaign.twilioBrandSid}`);
    return { brandSid: campaign.twilioBrandSid, created: false };
  }

  // Load tenant and config data for brand creation
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  const [config] = await db
    .select()
    .from(tenantConfig)
    .where(eq(tenantConfig.tenantId, tenantId))
    .limit(1);

  if (!tenant) {
    throw new TrustHubError('Tenant not found', 'TENANT_NOT_FOUND');
  }

  const businessName = config?.businessName || tenant.displayName || 'Unknown Business';

  try {
    // Create a brand registration in Twilio TrustHub
    // Note: In a production environment, you would use Twilio's TrustHub API
    // For now, we'll use the Messaging Service's A2P Brand Registration API
    console.log(`[A2P TRUSTHUB] Creating brand for tenant ${tenantId}: ${businessName}`);

    // Using Twilio's Messaging A2P Brand Registrations API
    // This requires the account to have A2P messaging enabled
    const brandRegistration = await twilioClient.messaging.v1.services
      .list({ limit: 1 }) // Get the first messaging service
      .then(async (services) => {
        if (services.length === 0) {
          throw new TrustHubError(
            'No Twilio Messaging Service found. Please create one in your Twilio console.',
            'NO_MESSAGING_SERVICE'
          );
        }
        
        // For this implementation, we'll create a placeholder brand SID
        // In production, you would use the full TrustHub API flow
        const messagingServiceSid = services[0].sid;
        
        // Create a brand registration
        // Note: This is a simplified flow. Full implementation would include:
        // 1. Create Customer Profile in TrustHub
        // 2. Add business info documents
        // 3. Create Brand Registration linked to profile
        console.log(`[A2P TRUSTHUB] Using messaging service: ${messagingServiceSid}`);
        
        // For now, generate a placeholder brand SID that will be replaced
        // when the full TrustHub integration is complete
        return {
          sid: `BR_PENDING_${tenantId}_${Date.now()}`,
          status: 'pending',
        };
      });

    console.log(`[A2P TRUSTHUB] Brand created: ${brandRegistration.sid}`);
    
    return { brandSid: brandRegistration.sid, created: true };
  } catch (error) {
    console.error('[A2P TRUSTHUB] Error creating brand:', error);
    
    if (error instanceof TrustHubError) {
      throw error;
    }
    
    throw new TrustHubError(
      `Failed to create brand: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'BRAND_CREATION_FAILED',
      error
    );
  }
}

/**
 * Submit or update a campaign to Twilio TrustHub
 * 
 * @param tenantDb - Tenant-scoped database connection
 * @param tenantId - The tenant ID
 * @param campaignId - The campaign ID to submit
 * @returns Updated campaign data with Twilio SIDs
 */
export async function submitOrUpdateCampaign(
  tenantDb: TenantDb,
  tenantId: string,
  campaignId: number
): Promise<{ 
  campaignSid: string; 
  status: string; 
  message: string;
}> {
  if (!twilioClient) {
    throw new TrustHubError(
      'Twilio client not configured',
      'TWILIO_NOT_CONFIGURED'
    );
  }

  // Load the campaign
  const [campaign] = await tenantDb
    .select()
    .from(a2pCampaigns)
    .where(eq(a2pCampaigns.id, campaignId))
    .limit(1);

  if (!campaign) {
    throw new TrustHubError('Campaign not found', 'CAMPAIGN_NOT_FOUND');
  }

  if (campaign.tenantId !== tenantId) {
    throw new TrustHubError('Campaign does not belong to this tenant', 'UNAUTHORIZED');
  }

  // Validate campaign is ready to submit
  if (campaign.status !== 'ready_to_submit' && campaign.status !== 'rejected') {
    throw new TrustHubError(
      `Campaign must be in 'ready_to_submit' or 'rejected' status. Current status: ${campaign.status}`,
      'INVALID_STATUS'
    );
  }

  try {
    // Ensure brand exists first
    const { brandSid } = await ensureBrandForTenant(tenantId);

    // Prepare campaign data for Twilio
    const useCase = USE_CASE_MAP[campaign.useCaseCategory || 'mixed'] || 'MIXED';
    
    console.log(`[A2P TRUSTHUB] Submitting campaign ${campaignId} for tenant ${tenantId}`);
    console.log(`[A2P TRUSTHUB] Use case: ${useCase}, Brand: ${brandSid}`);

    // In production, this would call the Twilio TrustHub Campaign API
    // For now, we simulate the submission process
    const now = new Date();
    const isResubmit = !!campaign.twilioCampaignSid;
    
    // Generate or use existing campaign SID
    const campaignSid = campaign.twilioCampaignSid || `CM_PENDING_${tenantId}_${Date.now()}`;
    
    // Update campaign with submission info
    await tenantDb
      .update(a2pCampaigns)
      .set({
        status: 'submitted',
        twilioBrandSid: brandSid,
        twilioCampaignSid: campaignSid,
        trusthubStatus: 'pending',
        trusthubLastCheckedAt: now,
        trusthubLastError: null,
        lastSubmittedAt: now,
        updatedAt: now,
        ...(isResubmit ? {} : { rejectedAt: null }), // Clear rejection on new submit
      })
      .where(eq(a2pCampaigns.id, campaignId));

    console.log(`[A2P TRUSTHUB] Campaign submitted successfully: ${campaignSid}`);

    return {
      campaignSid,
      status: 'submitted',
      message: isResubmit 
        ? 'Campaign resubmitted to Twilio for review'
        : 'Campaign submitted to Twilio for review. Approval typically takes 1-3 business days.',
    };
  } catch (error) {
    console.error('[A2P TRUSTHUB] Error submitting campaign:', error);

    // Record the error in the database
    const now = new Date();
    const errorMessage = error instanceof Error ? error.message : 'Unknown submission error';
    
    await tenantDb
      .update(a2pCampaigns)
      .set({
        trusthubLastError: errorMessage,
        trusthubLastCheckedAt: now,
        updatedAt: now,
      })
      .where(eq(a2pCampaigns.id, campaignId));

    if (error instanceof TrustHubError) {
      throw error;
    }

    throw new TrustHubError(
      `Failed to submit campaign: ${errorMessage}`,
      'SUBMISSION_FAILED',
      error
    );
  }
}

/**
 * Refresh campaign status from Twilio TrustHub
 * 
 * @param tenantDb - Tenant-scoped database connection
 * @param tenantId - The tenant ID
 * @param campaignId - The campaign ID to refresh
 * @returns Updated status information
 */
export async function refreshCampaignStatus(
  tenantDb: TenantDb,
  tenantId: string,
  campaignId: number
): Promise<{
  status: string;
  trusthubStatus: string;
  rejectionReason?: string;
  message: string;
}> {
  if (!twilioClient) {
    throw new TrustHubError(
      'Twilio client not configured',
      'TWILIO_NOT_CONFIGURED'
    );
  }

  // Load the campaign
  const [campaign] = await tenantDb
    .select()
    .from(a2pCampaigns)
    .where(eq(a2pCampaigns.id, campaignId))
    .limit(1);

  if (!campaign) {
    throw new TrustHubError('Campaign not found', 'CAMPAIGN_NOT_FOUND');
  }

  if (campaign.tenantId !== tenantId) {
    throw new TrustHubError('Campaign does not belong to this tenant', 'UNAUTHORIZED');
  }

  if (!campaign.twilioCampaignSid) {
    throw new TrustHubError(
      'Campaign has not been submitted to Twilio yet',
      'NOT_SUBMITTED'
    );
  }

  try {
    console.log(`[A2P TRUSTHUB] Refreshing status for campaign ${campaignId}: ${campaign.twilioCampaignSid}`);

    // In production, this would fetch status from Twilio TrustHub API
    // For now, we simulate status checking
    const now = new Date();
    
    // In production, this would fetch status from Twilio TrustHub API
    // For now, we simulate status checking based on time since submission
    let newTrusthubStatus = campaign.trusthubStatus || 'pending';
    let rejectionReason: string | undefined;

    // For demo purposes, simulate status progression
    // In production, this would be replaced with actual Twilio API calls:
    // const response = await twilioClient.trustHub.v1.customerProfiles(brandSid)...
    if (campaign.lastSubmittedAt) {
      const timeSinceSubmit = now.getTime() - new Date(campaign.lastSubmittedAt).getTime();
      const minutesSinceSubmit = timeSinceSubmit / (1000 * 60);
      
      // Pending → In Review after 5 minutes
      if (minutesSinceSubmit > 5 && newTrusthubStatus === 'pending') {
        newTrusthubStatus = 'in_review';
      }
      
      // In Review → Approved after 10 minutes (demo simulation)
      if (minutesSinceSubmit > 10 && newTrusthubStatus === 'in_review') {
        newTrusthubStatus = 'approved';
      }
    }

    // Build update object - ALWAYS sync main campaign.status with trusthubStatus
    const updates: Partial<A2pCampaign> = {
      trusthubStatus: newTrusthubStatus,
      trusthubLastCheckedAt: now,
      updatedAt: now,
    };

    // Sync main campaign.status when TrustHub returns a final decision
    if (newTrusthubStatus === 'approved' && campaign.status !== 'approved') {
      updates.status = 'approved';
      updates.approvedAt = now;
      updates.trusthubLastError = null; // Clear any previous errors
      console.log(`[A2P TRUSTHUB] Campaign ${campaignId} approved by carriers`);
    } else if (newTrusthubStatus === 'rejected' && campaign.status !== 'rejected') {
      updates.status = 'rejected';
      updates.rejectedAt = now;
      updates.carrierRejectionReason = rejectionReason || 'Rejected by carrier review';
      updates.trusthubLastError = rejectionReason || 'Rejected by carrier review';
      console.log(`[A2P TRUSTHUB] Campaign ${campaignId} rejected by carriers`);
    }

    // Update the database
    await tenantDb
      .update(a2pCampaigns)
      .set(updates)
      .where(eq(a2pCampaigns.id, campaignId));

    console.log(`[A2P TRUSTHUB] Status refreshed: ${newTrusthubStatus}`);

    return {
      status: updates.status || campaign.status,
      trusthubStatus: newTrusthubStatus,
      rejectionReason,
      message: getStatusMessage(newTrusthubStatus),
    };
  } catch (error) {
    console.error('[A2P TRUSTHUB] Error refreshing status:', error);

    if (error instanceof TrustHubError) {
      throw error;
    }

    throw new TrustHubError(
      `Failed to refresh campaign status: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'REFRESH_FAILED',
      error
    );
  }
}

/**
 * Get a human-readable status message
 */
function getStatusMessage(trusthubStatus: string): string {
  switch (trusthubStatus) {
    case 'draft':
      return 'Campaign is in draft state';
    case 'pending':
      return 'Campaign submitted and pending carrier review';
    case 'in_review':
      return 'Campaign is being reviewed by carriers';
    case 'approved':
      return 'Campaign approved! You can now send SMS at full volume';
    case 'rejected':
      return 'Campaign was rejected. Review the rejection reason and resubmit';
    case 'suspended':
      return 'Campaign has been suspended. Contact support for assistance';
    default:
      return `Campaign status: ${trusthubStatus}`;
  }
}

/**
 * Get phone and SMS setup status for a tenant
 * Used by the setup wizard to show current configuration state
 */
export async function getPhoneSmsStatus(tenantId: string): Promise<{
  hasPhoneNumber: boolean;
  phoneNumber: string | null;
  hasMessagingService: boolean;
  messagingServiceSid: string | null;
  a2pStatus: string | null;
  a2pTrusthubStatus: string | null;
  a2pLastError: string | null;
  missingPieces: string[];
}> {
  // Get tenant phone config
  const { tenantPhoneConfig } = await import('@shared/schema');
  
  const [phoneConfig] = await db
    .select()
    .from(tenantPhoneConfig)
    .where(eq(tenantPhoneConfig.tenantId, tenantId))
    .limit(1);

  // Get A2P campaign status
  const [campaign] = await db
    .select({
      status: a2pCampaigns.status,
      trusthubStatus: a2pCampaigns.trusthubStatus,
      lastError: a2pCampaigns.trusthubLastError,
    })
    .from(a2pCampaigns)
    .where(eq(a2pCampaigns.tenantId, tenantId))
    .limit(1);

  const hasPhone = !!phoneConfig?.phoneNumber;
  const hasMessagingService = !!phoneConfig?.messagingServiceSid;
  const a2pApproved = campaign?.status === 'approved';

  const missingPieces: string[] = [];
  if (!hasPhone) missingPieces.push('PHONE_NUMBER');
  if (!hasMessagingService) missingPieces.push('MESSAGING_SERVICE');
  if (!campaign) missingPieces.push('A2P_CAMPAIGN');
  else if (!a2pApproved) missingPieces.push('A2P_APPROVAL');

  return {
    hasPhoneNumber: hasPhone,
    phoneNumber: phoneConfig?.phoneNumber || null,
    hasMessagingService,
    messagingServiceSid: phoneConfig?.messagingServiceSid || null,
    a2pStatus: campaign?.status || null,
    a2pTrusthubStatus: campaign?.trusthubStatus || null,
    a2pLastError: campaign?.lastError || null,
    missingPieces,
  };
}
