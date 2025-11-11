import { db } from './db';
import { appointments } from '@shared/schema';
import { eq, and, lte, sql, isNull } from 'drizzle-orm';

// Check for auto-approval every 15 minutes
const CHECK_INTERVAL_MS = 15 * 60 * 1000;

// Auto-approve after 2 hours (configurable later via business settings)
const AUTO_APPROVE_DELAY_HOURS = 2;

let monitoringInterval: NodeJS.Timeout | null = null;

export function startDamageAssessmentMonitoring() {
  if (monitoringInterval) {
    console.log('[DAMAGE ASSESSMENT MONITOR] Already running');
    return;
  }

  console.log(`[DAMAGE ASSESSMENT MONITOR] Starting - will check every ${CHECK_INTERVAL_MS / 1000 / 60} minutes`);
  
  // Run first check immediately
  checkPendingAssessments();
  
  // Then run on interval
  monitoringInterval = setInterval(checkPendingAssessments, CHECK_INTERVAL_MS);
}

export function stopDamageAssessmentMonitoring() {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
    console.log('[DAMAGE ASSESSMENT MONITOR] Stopped');
  }
}

async function checkPendingAssessments() {
  try {
    console.log('[DAMAGE ASSESSMENT MONITOR] Checking for auto-approval candidates...');
    
    // Calculate cutoff time (2 hours ago)
    const cutoffTime = new Date(Date.now() - (AUTO_APPROVE_DELAY_HOURS * 60 * 60 * 1000));
    
    // Find appointments with:
    // - damageAssessmentStatus = 'pending'
    // - assessmentRequestedAt is more than 2 hours ago
    // - assessmentReviewedAt is null (not reviewed yet)
    const pendingAppointments = await db.select()
      .from(appointments)
      .where(
        and(
          eq(appointments.damageAssessmentStatus, 'pending'),
          lte(appointments.assessmentRequestedAt, cutoffTime),
          isNull(appointments.assessmentReviewedAt)
        )
      );
    
    if (pendingAppointments.length > 0) {
      console.log(`[DAMAGE ASSESSMENT MONITOR] Found ${pendingAppointments.length} appointments to auto-approve`);
      
      for (const appointment of pendingAppointments) {
        try {
          // Auto-approve the appointment
          await db.update(appointments)
            .set({
              damageAssessmentStatus: 'approved',
              assessmentReviewedAt: new Date(),
              autoApprovedAt: new Date(),
            })
            .where(eq(appointments.id, appointment.id));
          
          console.log(`[DAMAGE ASSESSMENT MONITOR] Auto-approved appointment ${appointment.id} (pending for ${AUTO_APPROVE_DELAY_HOURS} hours)`);
          
          // Optional: Send notification to business owner that auto-approval occurred
          // This can be implemented later with sendSMS or email
          
        } catch (error) {
          console.error(`[DAMAGE ASSESSMENT MONITOR] Error auto-approving appointment ${appointment.id}:`, error);
        }
      }
    } else {
      console.log('[DAMAGE ASSESSMENT MONITOR] No appointments require auto-approval');
    }
    
  } catch (error) {
    console.error('[DAMAGE ASSESSMENT MONITOR] Error during check:', error);
  }
}
