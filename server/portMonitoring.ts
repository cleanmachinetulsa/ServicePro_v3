import cron from 'node-cron';
import { db } from './db';
import { orgSettings } from '@shared/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

let monitoringActive = false;

/**
 * Daily Port Monitoring Service
 * 
 * Tests if the ported number (+19188565711) is fully active by sending test SMS
 * Runs 3x daily at 8 AM, 2 PM, 8 PM Central Time
 * Automatically disables after successful port detection
 */

/**
 * IMPROVED: Actually tests SMS delivery by sending a test message
 * and waiting for webhook confirmation
 */
async function checkPortStatus(): Promise<boolean> {
  try {
    // Use BUSINESS_PHONE_NUMBER env var for flexibility (supports any ported number)
    const portedNumber = process.env.BUSINESS_PHONE_NUMBER || process.env.TWILIO_PHONE_NUMBER;
    
    if (!portedNumber) {
      console.log('[PORT MONITOR] Business phone number not configured in environment variables');
      return false;
    }

    // Test 1: Check Twilio API if number is active
    const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;

    if (!twilioAccountSid || !twilioAuthToken) {
      console.log('[PORT MONITOR] Twilio credentials not configured');
      return false;
    }

    const twilio = await import('twilio');
    const client = twilio.default(twilioAccountSid, twilioAuthToken);

    // Try to fetch the phone number details
    const phoneNumber = await client.incomingPhoneNumbers
      .list({ phoneNumber: portedNumber })
      .then(numbers => numbers[0]);

    if (!phoneNumber) {
      console.log('[PORT MONITOR] Number not found in Twilio account - port not complete');
      return false;
    }

    // Check if webhooks are configured
    const voiceConfigured = phoneNumber.voiceUrl && phoneNumber.voiceUrl.length > 0;
    const smsConfigured = phoneNumber.smsUrl && phoneNumber.smsUrl.length > 0;

    console.log('[PORT MONITOR] Number found in Twilio account');
    console.log(`[PORT MONITOR] Voice webhook: ${voiceConfigured ? '✅' : '❌'}`);
    console.log(`[PORT MONITOR] SMS webhook: ${smsConfigured ? '✅' : '❌'}`);

    if (!smsConfigured) {
      console.log('[PORT MONITOR] SMS webhook not configured - cannot test delivery');
      return false;
    }

    // Test 2: Actually test SMS delivery by sending a test message
    console.log('[PORT MONITOR] 📤 Sending test SMS to verify delivery...');
    
    // Generate unique test ID
    const testId = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 30000); // 30 second timeout
    
    // Store test status in database
    await db.insert(orgSettings).values({
      settingKey: 'port_monitoring_test_status',
      settingValue: {
        testId,
        awaitingConfirmation: true,
        requestedAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString(),
        confirmed: false,
      },
      description: 'Port monitoring SMS test status',
    }).onConflictDoUpdate({
      target: orgSettings.settingKey,
      set: {
        settingValue: {
          testId,
          awaitingConfirmation: true,
          requestedAt: new Date().toISOString(),
          expiresAt: expiresAt.toISOString(),
          confirmed: false,
        },
      },
    });

    // Send test SMS to business owner's phone (can't send to self - Twilio doesn't deliver those)
    const ownerPhone = process.env.BUSINESS_OWNER_PHONE;
    
    if (!ownerPhone) {
      console.log('[PORT MONITOR] ❌ Business owner phone not configured - cannot test delivery');
      return false;
    }
    
    const testMessage = `[PORT TEST ${testId}] Automated SMS delivery test from ${portedNumber} - port monitoring active.`;
    
    // Determine the status callback URL (use Replit domain or localhost)
    const replitDomain = process.env.REPLIT_DEV_DOMAIN;
    const statusCallbackUrl = replitDomain 
      ? `https://${replitDomain}/api/test/port-sms-status`
      : `http://localhost:5000/api/test/port-sms-status`;
    
    try {
      const message = await client.messages.create({
        body: testMessage,
        from: portedNumber,
        to: ownerPhone, // Send to business owner to test delivery
        statusCallback: statusCallbackUrl, // Twilio will POST delivery status here
      });
      
      console.log(`[PORT MONITOR] ✅ Test SMS sent to ${ownerPhone} (SID: ${message.sid})`);
      console.log(`[PORT MONITOR] Status callback URL: ${statusCallbackUrl}`);
      console.log(`[PORT MONITOR] Waiting for delivery confirmation...`);
    } catch (smsError) {
      console.error('[PORT MONITOR] ❌ Failed to send test SMS:', smsError);
      return false;
    }

    // Wait up to 2 minutes for confirmation (delivery can take time)
    const confirmed = await waitForTestConfirmation(testId, 120000);
    
    if (confirmed) {
      console.log('[PORT MONITOR] ✅ SMS DELIVERY CONFIRMED! Port is fully functional');
      return true;
    } else {
      console.log('[PORT MONITOR] ❌ SMS delivery not confirmed within timeout');
      return false;
    }

  } catch (error) {
    console.error('[PORT MONITOR] Error checking port status:', error);
    return false;
  }
}

/**
 * Poll database for test confirmation with timeout
 */
async function waitForTestConfirmation(testId: string, timeoutMs: number): Promise<boolean> {
  const startTime = Date.now();
  const pollInterval = 1000; // Check every 1 second
  
  while (Date.now() - startTime < timeoutMs) {
    try {
      const [status] = await db
        .select()
        .from(orgSettings)
        .where(eq(orgSettings.settingKey, 'port_monitoring_test_status'));
      
      if (status?.settingValue) {
        const testStatus = status.settingValue as any;
        
        if (testStatus.testId === testId && testStatus.confirmed === true) {
          return true;
        }
      }
    } catch (error) {
      console.error('[PORT MONITOR] Error polling for confirmation:', error);
    }
    
    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }
  
  return false;
}

async function sendPortCompleteAlert() {
  try {
    const ownerPhone = process.env.BUSINESS_OWNER_PHONE;
    const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!ownerPhone) {
      console.log('[PORT MONITOR] Owner phone not configured for alert');
      return;
    }

    const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;

    if (!twilioAccountSid || !twilioAuthToken) {
      console.log('[PORT MONITOR] Cannot send alert - Twilio not configured');
      return;
    }

    const twilio = await import('twilio');
    const client = twilio.default(twilioAccountSid, twilioAuthToken);

    const message = `🎉 PORT COMPLETE! Your Google Voice number ${twilioPhoneNumber} is now active on Twilio and ready to receive calls and texts. The daily monitoring has been automatically disabled.`;

    await client.messages.create({
      body: message,
      from: twilioPhoneNumber,
      to: ownerPhone,
    });

    console.log('[PORT MONITOR] ✅ Success alert sent to owner');
  } catch (error) {
    console.error('[PORT MONITOR] Error sending alert:', error);
  }
}

async function disablePortMonitoring() {
  try {
    // Store in database that monitoring is disabled
    await db.insert(orgSettings).values({
      settingKey: 'port_monitoring_disabled',
      settingValue: { disabled: true, disabledAt: new Date().toISOString() },
      description: 'Port monitoring automatically disabled after successful completion',
    }).onConflictDoUpdate({
      target: orgSettings.settingKey,
      set: {
        settingValue: { disabled: true, disabledAt: new Date().toISOString() },
        description: 'Port monitoring automatically disabled after successful completion',
      },
    });

    monitoringActive = false;
    console.log('[PORT MONITOR] ⏸️  Monitoring disabled permanently');
  } catch (error) {
    console.error('[PORT MONITOR] Error disabling monitoring:', error);
  }
}

async function runDailyPortCheck() {
  if (!monitoringActive) {
    console.log('[PORT MONITOR] Monitoring is disabled, skipping check');
    return;
  }

  console.log('[PORT MONITOR] 🔍 Running daily port status check...');
  
  const isComplete = await checkPortStatus();

  if (isComplete) {
    console.log('[PORT MONITOR] 🎉 PORT IS COMPLETE!');
    await sendPortCompleteAlert();
    await disablePortMonitoring();
  } else {
    console.log('[PORT MONITOR] ⏳ Port still pending, will check again tomorrow');
  }
}

export async function initializePortMonitoring() {
  // Check if monitoring was previously disabled
  try {
    const [setting] = await db
      .select()
      .from(orgSettings)
      .where(eq(orgSettings.settingKey, 'port_monitoring_disabled'));

    if (setting?.settingValue && (setting.settingValue as any).disabled === true) {
      console.log('[PORT MONITOR] Monitoring previously disabled - skipping initialization');
      return;
    }
  } catch (error) {
    // Table might not exist yet, that's ok
  }

  monitoringActive = true;

  // Schedule 3x daily checks at 8 AM, 2 PM, and 8 PM Central Time
  // Cron format: minute hour day month weekday
  // 8 AM Central = 13:00 or 14:00 UTC, 2 PM = 19:00 or 20:00 UTC, 8 PM = 01:00 or 02:00 UTC
  // Using standard time offsets (Central = UTC-6)
  
  // 8 AM Central = 14:00 UTC
  cron.schedule('0 14 * * *', async () => {
    console.log('[PORT MONITOR] Running 8 AM check...');
    await runDailyPortCheck();
  });
  
  // 2 PM Central = 20:00 UTC
  cron.schedule('0 20 * * *', async () => {
    console.log('[PORT MONITOR] Running 2 PM check...');
    await runDailyPortCheck();
  });
  
  // 8 PM Central = 02:00 UTC (next day)
  cron.schedule('0 2 * * *', async () => {
    console.log('[PORT MONITOR] Running 8 PM check...');
    await runDailyPortCheck();
  });

  console.log('[PORT MONITOR] ✅ 3x daily monitoring initialized - checks at 8 AM, 2 PM, 8 PM Central');
  console.log('[PORT MONITOR] Will automatically disable after successful port detection');

  // Run initial check on startup (don't wait for scheduled time)
  setTimeout(async () => {
    console.log('[PORT MONITOR] Running initial startup check...');
    await runDailyPortCheck();
  }, 5000); // Wait 5 seconds after server start
}

/**
 * Manual function to re-enable monitoring (if needed)
 * Can be called from admin panel if user wants to restart monitoring
 */
export async function enablePortMonitoring() {
  await db.insert(orgSettings).values({
    settingKey: 'port_monitoring_disabled',
    settingValue: { disabled: false, enabledAt: new Date().toISOString() },
    description: 'Port monitoring manually re-enabled',
  }).onConflictDoUpdate({
    target: orgSettings.settingKey,
    set: {
      settingValue: { disabled: false, enabledAt: new Date().toISOString() },
      description: 'Port monitoring manually re-enabled',
    },
  });

  monitoringActive = true;
  console.log('[PORT MONITOR] ✅ Monitoring manually re-enabled');
}
