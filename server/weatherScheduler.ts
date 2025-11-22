
import { format } from 'date-fns';
import { checkAppointmentWeather } from './weatherService';
import { sendWeatherAlertNotification } from './notifications';
import { google } from 'googleapis';
import { getAuthClient } from './googleIntegration';
import { addDays } from 'date-fns';
import { db } from './db';
import { wrapTenantDb } from './tenantDb';
import { services } from '@shared/schema';

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'cleanmachinetulsa@gmail.com';

// Cache of known service names for validating calendar events
let knownServiceNames: string[] = [];

interface Appointment {
  id: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  service: string;
  date: string;
  location: string;
}

/**
 * Load known service names from database for validation
 */
async function loadKnownServices(): Promise<void> {
  const tenantDb = wrapTenantDb(db, 'root');
  
  try {
    const serviceList = await tenantDb.select().from(services);
    knownServiceNames = serviceList.map(s => s.name);
    console.log(`[WEATHER] Loaded ${knownServiceNames.length} known services for validation`);
  } catch (error) {
    console.error('[WEATHER] Failed to load services, using empty list:', error);
    knownServiceNames = [];
  }
}

/**
 * Fetch upcoming appointments from Google Calendar
 */
async function getUpcomingAppointments(): Promise<Appointment[]> {
  try {
    // Load known services if not already loaded
    if (knownServiceNames.length === 0) {
      await loadKnownServices();
    }

    const auth = getAuthClient();
    if (!auth) {
      console.error('Could not get auth client for calendar');
      return [];
    }

    const calendar = google.calendar({ version: 'v3', auth });
    
    // Get appointments for the next 4 days
    const now = new Date();
    const timeMin = now.toISOString();
    const timeMax = addDays(now, 4).toISOString();

    console.log(`Fetching appointments from ${timeMin} to ${timeMax}`);

    const response = await calendar.events.list({
      calendarId: CALENDAR_ID,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 100,
    });

    const events = response.data.items || [];
    console.log(`Found ${events.length} upcoming appointments`);

    // Parse appointments from calendar events with ROBUST validation
    const appointments: Appointment[] = events
      .map((event: any) => {
        const description = event.description || '';
        const summary = event.summary || '';
        
        // STRICT FILTER 1: Must have "Phone:" in description (all appointments have this)
        if (!description.includes('Phone:')) {
          return null;
        }
        
        // STRICT FILTER 2: Must have "-" separator in summary
        if (!summary.includes('-')) {
          return null;
        }
        
        // STRICT FILTER 3: Summary must start with a known service name
        // This prevents false positives from personal events that happen to have a phone number
        const matchedService = knownServiceNames.find(serviceName => 
          summary.startsWith(serviceName + ' -')
        );
        
        if (!matchedService) {
          console.log(`[WEATHER] Skipping non-appointment event: "${summary}" (no matching service)`);
          return null;
        }
        
        // Extract phone number from description
        const phoneMatch = description.match(/Phone:\s*(\d{10}|\(\d{3}\)\s*\d{3}-\d{4})/);
        const phone = phoneMatch ? phoneMatch[1].replace(/\D/g, '') : '';
        
        // STRICT FILTER 4: Valid 10-digit phone number required
        if (!phone || phone.length !== 10) {
          return null;
        }
        
        // Extract customer name - everything after "Service - "
        const customerNameMatch = summary.match(new RegExp(`^${matchedService.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*-\\s*(.+)$`));
        const customerName = customerNameMatch ? customerNameMatch[1].trim() : '';
        
        // STRICT FILTER 5: Customer name must exist
        if (!customerName) {
          return null;
        }
        
        // Extract email if present
        const emailMatch = description.match(/Email:\s*([^\n]+)/);
        const email = emailMatch ? emailMatch[1].trim() : '';
        
        // Extract location
        const locationMatch = description.match(/Address:\s*([^\n]+)/);
        const location = event.location || (locationMatch ? locationMatch[1].trim() : 'Tulsa, OK');

        console.log(`[WEATHER] Valid appointment found: ${matchedService} - ${customerName} on ${event.start.dateTime || event.start.date}`);

        return {
          id: event.id,
          customerName,
          customerPhone: phone,
          customerEmail: email,
          service: matchedService,
          date: event.start.dateTime || event.start.date,
          location,
        };
      })
      .filter((apt): apt is Appointment => apt !== null); // Remove invalid entries

    return appointments;
  } catch (error) {
    console.error('Error fetching appointments from Google Calendar:', error);
    return [];
  }
}

/**
 * Check weather for an appointment and send alerts if needed
 */
async function processAppointmentWeather(appointment: Appointment) {
  try {
    const appointmentDate = new Date(appointment.date);
    const latitude = 36.1236407; // Tulsa, OK coordinates
    const longitude = -95.9359214;
    
    const weatherData = await checkAppointmentWeather(latitude, longitude, appointment.date);

    if (!weatherData || weatherData.weatherRiskLevel === 'none' || weatherData.weatherRiskLevel === 'low') {
      console.log(`✓ ${appointment.customerName} (${format(appointmentDate, 'MMM d')}) - Weather looks good`);
      return { needsAlert: false };
    }

    // Determine if we should send an alert based on risk level
    const shouldAlert = ['moderate', 'high', 'very-high', 'severe'].includes(weatherData.weatherRiskLevel);

    if (shouldAlert) {
      console.log(`⚠️  ${appointment.customerName} (${format(appointmentDate, 'MMM d')}) - ${weatherData.weatherRiskLevel.toUpperCase()} risk detected`);
      
      // Calculate average precipitation and temperature from forecast data
      const avgPrecip = weatherData.forecastData.length > 0
        ? weatherData.forecastData.reduce((sum, f) => sum + f.chanceOfRain, 0) / weatherData.forecastData.length
        : 0;
      
      const avgTemp = weatherData.forecastData.length > 0
        ? weatherData.forecastData.reduce((sum, f) => sum + f.temperature, 0) / weatherData.forecastData.length
        : 70;
      
      // Send weather alert notification
      const notificationResult = await sendWeatherAlertNotification({
        customerName: appointment.customerName,
        customerPhone: appointment.customerPhone,
        customerEmail: appointment.customerEmail,
        appointmentDate: appointment.date,
        service: appointment.service,
        weatherRisk: weatherData.weatherRiskLevel,
        precipitationProbability: Math.round(avgPrecip),
        temperature: Math.round(avgTemp),
      });

      return {
        needsAlert: true,
        riskLevel: weatherData.weatherRiskLevel,
        notificationSent: notificationResult.success,
      };
    }

    return { needsAlert: false };
  } catch (error) {
    console.error(`Error processing weather for ${appointment.customerName}:`, error);
    return { needsAlert: false, error: true };
  }
}

/**
 * Main function to run daily weather checks
 */
async function runDailyWeatherCheck() {
  console.log('\n=== Starting Daily Weather Alert Check ===');
  console.log(`Time: ${format(new Date(), 'PPpp')}\n`);

  try {
    // Fetch upcoming appointments
    const appointments = await getUpcomingAppointments();

    if (appointments.length === 0) {
      console.log('No upcoming appointments found in the next 4 days.');
      return;
    }

    console.log(`Found ${appointments.length} appointments to check:\n`);

    // Process each appointment
    let alertsSent = 0;
    let appointmentsChecked = 0;

    for (const appointment of appointments) {
      const result = await processAppointmentWeather(appointment);
      appointmentsChecked++;

      if (result.needsAlert && result.notificationSent) {
        alertsSent++;
      }

      // Add a small delay between checks to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\n=== Weather Check Complete ===');
    console.log(`Appointments checked: ${appointmentsChecked}`);
    console.log(`Weather alerts sent: ${alertsSent}`);
    console.log(`Completed at: ${format(new Date(), 'PPpp')}\n`);

  } catch (error) {
    console.error('Error running daily weather check:', error);
    process.exit(1);
  }
}

// Run the weather check
runDailyWeatherCheck()
  .then(() => {
    console.log('Weather check completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Weather check failed:', error);
    process.exit(1);
  });
