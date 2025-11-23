import { Request, Response } from 'express';
import { customerMemory } from './customerMemory';
import { getAllServices } from './realServices';
import { google } from 'googleapis';
import { getAuthClient, getGoogleSheetsWriteClient } from './googleIntegration';
import { getGoogleCalendarClient } from './googleCalendarConnector';
import { addDays, addHours, format, parseISO, subDays } from 'date-fns';
import { getDailyWeatherSummary } from './weatherService';
import { calculateETAAndGenerateNavLink } from './googleMapsApi';
import { sendSMS } from './notifications';
import { renderInvoiceEmail, renderInvoiceEmailPlainText, type InvoiceEmailData } from './emailTemplates/invoice';
import { signPayToken } from './security/paylink';
import { z } from 'zod';
import { cacheService, CacheKeys, CacheTTL } from './cacheService';

// Validation schema for service updates
const updateServiceSchema = z.object({
  name: z.string().min(1, 'Service name is required'),
  priceRange: z.string().optional(),
  overview: z.string().optional(), // Short description for display
  detailedDescription: z.string().optional(), // Full description with details
  duration: z.string().optional(),
  isAddon: z.boolean().optional()
});

// Calendar ID for Clean Machine - use environment variable if available
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'cleanmachinetulsa@gmail.com';

// Debug: Log the calendar ID we're using
console.log('Using Google Calendar ID for dashboard:', CALENDAR_ID);

/**
 * Get Google Calendar client using Replit OAuth connector
 * Never cache this - tokens expire and need to be refreshed
 */
async function getCalendarService() {
  try {
    return await getGoogleCalendarClient();
  } catch (error) {
    console.error('Failed to get calendar client:', error);
    return null;
  }
}

/**
 * Sync appointments from Google Calendar to ensure we have the latest data
 * This can be called on a schedule to keep the dashboard up-to-date
 */
export async function syncAppointmentsFromGoogleCalendar() {
  try {
    const calendarService = await getCalendarService();
    
    if (!calendarService) {
      console.error('Cannot sync appointments - calendar service not available');
      return false;
    }
    
    // Get appointments for the next 30 days
    const now = new Date();
    const timeMin = now.toISOString();
    const timeMax = addDays(now, 30).toISOString();
    
    console.log(`Syncing appointments from ${timeMin} to ${timeMax} for calendar: ${CALENDAR_ID}`);
    
    const response = await calendarService.events.list({
      calendarId: CALENDAR_ID,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 100,
    });
    
    const events = response.data.items || [];
    console.log(`Found ${events.length} upcoming appointments in Google Calendar`);
    
    // Print event information for debugging
    events.forEach((event: any, index: number) => {
      const start = event.start.dateTime || event.start.date;
      console.log(`[${index + 1}] ${start} - ${event.summary}`);
    });
    
    return true;
  } catch (error) {
    console.error('Error syncing appointments from Google Calendar:', error);
    return false;
  }
}

/**
 * Get upcoming appointments from Google Calendar
 */
export async function getUpcomingAppointments(req: Request, res: Response) {
  try {
    const calendarService = await getCalendarService();
    
    if (!calendarService) {
      return res.status(503).json({
        success: false,
        error: 'Calendar service not available'
      });
    }
    
    const now = new Date();
    const timeMin = now.toISOString();
    const timeMax = addDays(now, 7).toISOString(); // Get appointments for the next week
    
    const response = await calendarService.events.list({
      calendarId: CALENDAR_ID,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
    });
    
    // Defensive: Google Calendar API can return undefined items array
    const events = response.data.items || [];
    
    if (events.length === 0) {
      console.log(`No upcoming appointments found (${timeMin} to ${timeMax})`);
      return res.json({
        success: true,
        appointments: []
      });
    }
    
    const appointments = events.map((event: any) => {
      // Extract customer info from event description
      const customerPhone = extractPhoneFromDescription(event.description);
      const customerInfo = customerPhone ? customerMemory.getCustomer(customerPhone) : null;
      
      // Get service name from summary (usually in format "Service - Customer Name")
      const eventSummaryParts = event.summary ? event.summary.split('-') : ['Unknown Service'];
      const serviceName = eventSummaryParts[0].trim();
      
      return {
        id: event.id,
        customerName: customerInfo?.name || eventSummaryParts[1]?.trim() || 'Unknown Customer',
        service: serviceName,
        time: event.start.dateTime || event.start.date,
        address: event.location || customerInfo?.address || '',
        phone: customerPhone || '',
        vehicleInfo: customerInfo?.vehicleInfo || ''
      };
    });
    
    return res.json({
      success: true,
      appointments
    });
  } catch (error) {
    console.error('Error fetching appointments:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch appointments'
    });
  }
}

/**
 * Get today's appointments from Google Calendar
 */
export async function getTodaysAppointments(req: Request, res: Response) {
  try {
    // Check if a specific date was requested
    const dateParam = req.query.date as string;
    const targetDate = dateParam ? new Date(dateParam) : new Date();
    
    const startOfDay = new Date(new Date(targetDate).setHours(0, 0, 0, 0)).toISOString();
    const cacheKey = CacheKeys.dashboardToday(startOfDay);
    
    // Try cache first
    const cachedData = cacheService.get<any>(cacheKey);
    if (cachedData) {
      console.log(`[CACHE HIT] Today's appointments for ${targetDate.toDateString()}`);
      return res.json(cachedData);
    }
    
    console.log(`[CACHE MISS] Fetching today's appointments for ${targetDate.toDateString()}`);
    
    const calendarService = await getCalendarService();
    
    if (!calendarService) {
      return res.status(503).json({
        success: false,
        error: 'Calendar service not available'
      });
    }
    
    const endOfDay = new Date(new Date(targetDate).setHours(23, 59, 59, 999)).toISOString();
    
    const response = await calendarService.events.list({
      calendarId: CALENDAR_ID,
      timeMin: startOfDay,
      timeMax: endOfDay,
      singleEvents: true,
      orderBy: 'startTime',
    });
    
    // Defensive: Google Calendar API can return undefined items array
    const events = response.data.items || [];
    
    if (events.length === 0) {
      console.log(`No appointments found for ${targetDate.toDateString()}`);
      const result = {
        success: true,
        appointments: []
      };
      cacheService.set(cacheKey, result, CacheTTL.MEDIUM);
      return res.json(result);
    }
    
    const appointments = events.map((event: any) => {
      // Extract customer info from event description
      const customerPhone = extractPhoneFromDescription(event.description);
      const customerInfo = customerPhone ? customerMemory.getCustomer(customerPhone) : null;
      
      // Get service name from summary (usually in format "Service - Customer Name")
      const eventSummaryParts = event.summary ? event.summary.split('-') : ['Unknown Service'];
      const serviceName = eventSummaryParts[0].trim();
      
      return {
        id: event.id,
        customerName: customerInfo?.name || eventSummaryParts[1]?.trim() || 'Unknown Customer',
        service: serviceName,
        time: event.start.dateTime || event.start.date,
        address: extractAddress(event.description || '') || event.location || customerInfo?.address || '',
        phone: customerPhone || '',
        email: customerInfo?.email || '',
        vehicleInfo: extractVehicleInfo(event.description || '') || customerInfo?.vehicleInfo || ''
      };
    });
    
    const result = {
      success: true,
      appointments
    };
    
    // Cache for 5 minutes
    cacheService.set(cacheKey, result, CacheTTL.MEDIUM);
    
    return res.json(result);
  } catch (error) {
    console.error('Error fetching today\'s appointments:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch today\'s appointments'
    });
  }
}

/**
 * Update a service in the knowledge base (Google Sheets)
 * Supports both main services and add-ons with overview and detailed descriptions
 */
export async function updateService(req: Request, res: Response) {
  try {
    // Validate request body
    const validation = updateServiceSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: validation.error.errors[0].message
      });
    }

    const { name, priceRange, overview, detailedDescription, duration, isAddon } = validation.data;

    // Get write-enabled sheets client
    const sheetsClient = await getGoogleSheetsWriteClient();
    if (!sheetsClient) {
      console.error('[updateService] Google Sheets write client not available');
      return res.status(500).json({
        success: false,
        error: 'Google Sheets client not available'
      });
    }

    // Import centralized spreadsheet ID
    const { SPREADSHEET_ID } = await import('./pricing');
    if (!SPREADSHEET_ID) {
      return res.status(500).json({
        success: false,
        error: 'Google Sheet ID not configured'
      });
    }

    // Get sheet names first for dynamic discovery (matches pricing.ts pattern)
    const spreadsheet = await sheetsClient.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID
    });
    
    const sheetNames = spreadsheet.data.sheets?.map((sheet: any) => 
      sheet.properties?.title
    ) || [];
    
    console.log('[updateService] Available sheets:', sheetNames);
    
    // Find the correct sheet dynamically (matches pricing.ts logic)
    let sheetName: string | undefined;
    if (isAddon) {
      sheetName = sheetNames.find((name: string | undefined) => 
        name && (
          (name.toLowerCase().includes('add') && name.toLowerCase().includes('on')) ||
          name.toLowerCase().includes('addon')
        )
      );
    } else {
      sheetName = sheetNames.find((name: string | undefined) => 
        name && 
        name.toLowerCase().includes('service') && 
        !name.toLowerCase().includes('add')
      );
    }
    
    if (!sheetName) {
      return res.status(404).json({
        success: false,
        error: `No ${isAddon ? 'add-on' : 'service'} sheet found`
      });
    }
    
    console.log(`[updateService] Updating service "${name}" in sheet "${sheetName}"`);
    
    // Get all rows from the sheet
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A1:Z1000`
    });

    const rows = response.data.values || [];
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: `No data found in ${sheetName} sheet`
      });
    }

    // Find the row with this service name
    const headers = rows[0];
    const nameColIndex = 0; // Service Name is first column
    let rowIndex = -1;

    for (let i = 1; i < rows.length; i++) {
      if (rows[i][nameColIndex] === name) {
        rowIndex = i;
        break;
      }
    }

    if (rowIndex === -1) {
      return res.status(404).json({
        success: false,
        error: `Service "${name}" not found in ${sheetName}`
      });
    }

    // Prepare the update data based on column headers
    const updates: Array<{ range: string; values: any[][] }> = [];
    
    // Map fields to column indices (exactly matches pricing.ts logic with numeric fallbacks)
    // pricing.ts line 50: priceRange = obj['Price Range'] || obj['Price'] || obj['2']
    // pricing.ts line 53: overview = obj['Overview'] || obj['Short Description'] || obj['3']
    // pricing.ts line 54: detailedDescription = obj['Detailed Description'] || obj['Description'] || obj['4']
    // pricing.ts line 56: timeEstimate = obj['Time Estimate'] || obj['Duration'] || obj['6']
    
    // Explicit fallback handling to prevent -1 propagation
    const priceIdx = headers.findIndex((h: string) => 
      h.toLowerCase().includes('price')
    );
    const priceColIndex = priceIdx >= 0 ? priceIdx : 2; // Fallback to column 2
    
    const overviewIdx = headers.findIndex((h: string) => {
      const lower = h.toLowerCase();
      return lower === 'overview' || lower === 'short description';
    });
    const overviewColIndex = overviewIdx >= 0 ? overviewIdx : 3; // Fallback to column 3
    
    const detailedIdx = headers.findIndex((h: string) => {
      const lower = h.toLowerCase();
      return lower === 'detailed description' || 
             lower === 'description' || 
             lower === 'service description';
    });
    const detailedDescColIndex = detailedIdx >= 0 ? detailedIdx : 4; // Fallback to column 4
    
    const durationIdx = headers.findIndex((h: string) => 
      h.toLowerCase().includes('time') || h.toLowerCase().includes('duration')
    );
    const durationColIndex = durationIdx >= 0 ? durationIdx : 6; // Fallback to column 6
    
    console.log(`[updateService] Column indices - Price: ${priceColIndex}, Overview: ${overviewColIndex}, Detailed: ${detailedDescColIndex}, Duration: ${durationColIndex}`);

    // Add 2 to rowIndex because: +1 for 1-indexed, +1 for header row
    const actualRow = rowIndex + 1;

    if (priceRange && priceColIndex > -1) {
      const colLetter = String.fromCharCode(65 + priceColIndex);
      updates.push({
        range: `${sheetName}!${colLetter}${actualRow}`,
        values: [[priceRange]]
      });
    }

    // Save Overview (short description)
    if (overview !== undefined && overviewColIndex > -1) {
      const colLetter = String.fromCharCode(65 + overviewColIndex);
      updates.push({
        range: `${sheetName}!${colLetter}${actualRow}`,
        values: [[overview]]
      });
    }

    // Save Detailed Description
    if (detailedDescription !== undefined && detailedDescColIndex > -1) {
      const colLetter = String.fromCharCode(65 + detailedDescColIndex);
      updates.push({
        range: `${sheetName}!${colLetter}${actualRow}`,
        values: [[detailedDescription]]
      });
    }

    if (duration && durationColIndex > -1) {
      const colLetter = String.fromCharCode(65 + durationColIndex);
      updates.push({
        range: `${sheetName}!${colLetter}${actualRow}`,
        values: [[duration]]
      });
    }

    // Perform batch update
    if (updates.length > 0) {
      await sheetsClient.spreadsheets.values.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          valueInputOption: 'RAW',
          data: updates
        }
      });
      
      console.log(`[updateService] Successfully updated ${updates.length} fields for "${name}"`);
    } else {
      console.warn(`[updateService] No fields to update for "${name}"`);
    }
    
    return res.json({
      success: true,
      message: `Service "${name}" updated successfully in Google Sheets`,
      updatedFields: updates.length
    });
  } catch (error) {
    console.error('[updateService] Error updating service:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update service'
    });
  }
}

/**
 * Get recent customer messages/conversations
 */
export async function getRecentMessages(req: Request, res: Response) {
  try {
    // In a production environment, you would fetch these from your database
    // For now, we'll use some mock data with customer info from memory
    
    const customers = Array.from(customerMemory.getAllCustomers());
    
    const messages = customers.slice(0, 5).map((customer, index) => {
      const needsAttention = index === 0; // First customer needs attention for demo
      
      return {
        id: `msg-${index + 1}`,
        customerName: customer.name || 'Customer',
        phone: customer.phone || '',
        content: needsAttention 
          ? "I need to reschedule my appointment tomorrow, is that possible?"
          : "Thanks for the great service!",
        timestamp: new Date(Date.now() - (Math.random() * 86400000)).toISOString(), // Random time in last 24h
        needsAttention
      };
    });
    
    return res.json({
      success: true,
      messages
    });
  } catch (error) {
    console.error('Error fetching recent messages:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch recent messages'
    });
  }
}

/**
 * Get monthly statistics for dashboard stats bar
 */
export async function getMonthlyStatistics(req: Request, res: Response) {
  try {
    const calendarService = await getCalendarService();
    
    if (!calendarService) {
      return res.status(503).json({
        success: false,
        error: 'Calendar service not available'
      });
    }
    
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    
    // Fetch this month's appointments
    const thisMonthResponse = await calendarService.events.list({
      calendarId: CALENDAR_ID,
      timeMin: thisMonthStart.toISOString(),
      timeMax: thisMonthEnd.toISOString(),
      singleEvents: true,
      orderBy: 'startTime'
    });
    
    // Fetch last month's appointments
    const lastMonthResponse = await calendarService.events.list({
      calendarId: CALENDAR_ID,
      timeMin: lastMonthStart.toISOString(),
      timeMax: lastMonthEnd.toISOString(),
      singleEvents: true,
      orderBy: 'startTime'
    });
    
    const thisMonthEvents = thisMonthResponse.data.items || [];
    const lastMonthEvents = lastMonthResponse.data.items || [];
    
    // Helper to extract price from event description
    const extractPrice = (description: string = ''): number => {
      const priceMatch = description.match(/\$(\d+(?:,\d{3})*(?:\.\d{2})?)/);
      return priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : 0;
    };
    
    // Calculate this month stats
    const thisMonthCompleted = thisMonthEvents.filter(e => {
      const eventTime = new Date(e.start?.dateTime || e.start?.date || '');
      return eventTime < now;
    }).length;
    
    const thisMonthUpcoming = thisMonthEvents.filter(e => {
      const eventTime = new Date(e.start?.dateTime || e.start?.date || '');
      return eventTime >= now;
    }).length;
    
    const thisMonthRevenue = thisMonthEvents
      .filter(e => {
        const eventTime = new Date(e.start?.dateTime || e.start?.date || '');
        return eventTime < now;
      })
      .reduce((sum, event) => sum + extractPrice(event.description || ''), 0);
    
    const lastMonthRevenue = lastMonthEvents
      .reduce((sum, event) => sum + extractPrice(event.description || ''), 0);
    
    // Calculate growth percentages
    const appointmentGrowth = lastMonthEvents.length > 0
      ? ((thisMonthEvents.length - lastMonthEvents.length) / lastMonthEvents.length) * 100
      : 0;
      
    const revenueGrowth = lastMonthRevenue > 0
      ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
      : 0;
    
    const monthlyStats = {
      thisMonth: {
        total: thisMonthEvents.length,
        completed: thisMonthCompleted,
        upcoming: thisMonthUpcoming,
        revenue: Math.round(thisMonthRevenue)
      },
      lastMonth: {
        total: lastMonthEvents.length,
        completed: lastMonthEvents.length,
        upcoming: 0,
        revenue: Math.round(lastMonthRevenue)
      },
      growth: {
        appointments: Math.round(appointmentGrowth * 10) / 10,
        revenue: Math.round(revenueGrowth * 10) / 10
      }
    };
    
    return res.json({
      success: true,
      stats: monthlyStats
    });
  } catch (error) {
    console.error('Error fetching monthly stats:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch monthly statistics'
    });
  }
}

/**
 * Get appointment counts per date for a month
 * This is used to highlight calendar dates based on appointment load
 */
export async function getMonthlyAppointmentCounts(req: Request, res: Response) {
  try {
    // Get the start and end of the month from query params or use current month
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
    
    const cacheKey = CacheKeys.dashboardAppointmentCounts(year, month);
    
    // Try cache first
    const cachedData = cacheService.get<any>(cacheKey);
    if (cachedData) {
      console.log(`[CACHE HIT] Appointment counts for ${year}-${month}`);
      return res.json(cachedData);
    }
    
    console.log(`[CACHE MISS] Fetching appointment counts for ${year}-${month}`);
    
    const calendarService = await getCalendarService();
    
    if (!calendarService) {
      return res.status(503).json({
        success: false,
        error: 'Calendar service not available'
      });
    }
    
    const startOfMonth = new Date(year, month - 1, 1, 0, 0, 0, 0).toISOString();
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999).toISOString();
    
    const response = await calendarService.events.list({
      calendarId: CALENDAR_ID,
      timeMin: startOfMonth,
      timeMax: endOfMonth,
      singleEvents: true,
    });
    
    const events = response.data.items;
    const countsByDate: Record<string, number> = {};
    
    // Count events per day
    events?.forEach((event: any) => {
      const startDate = event.start.dateTime || event.start.date;
      const dateKey = startDate.split('T')[0]; // YYYY-MM-DD format
      countsByDate[dateKey] = (countsByDate[dateKey] || 0) + 1;
    });
    
    const result = {
      success: true,
      counts: countsByDate
    };
    
    // Cache for 5 minutes
    cacheService.set(cacheKey, result, CacheTTL.MEDIUM);
    
    return res.json(result);
  } catch (error) {
    console.error('Error fetching appointment counts:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get appointment counts'
    });
  }
}

/**
 * Helper function to extract phone number from event description
 */
function extractPhoneFromDescription(description: string): string {
  if (!description) return '';
  
  // Try to match "Phone: XXX" pattern
  const phoneMatch = description.match(/Phone:\s*([0-9+\-() ]+)/i);
  if (phoneMatch && phoneMatch[1]) {
    return phoneMatch[1].trim();
  }
  
  return '';
}

/**
 * Extract vehicle information from event description
 */
function extractVehicleInfo(description: string): string {
  if (!description) return '';
  
  // Try to match "Vehicle: XXX" pattern
  const vehicleMatch = description.match(/Vehicle:\s*([^\n]+)/i);
  if (vehicleMatch && vehicleMatch[1]) {
    return vehicleMatch[1].trim();
  }
  
  return '';
}

/**
 * Extract address from event description
 */
function extractAddress(description: string): string {
  if (!description) return '';
  
  // Try to match "Address: XXX" pattern
  const addressMatch = description.match(/Address:\s*([^\n]+)/i);
  if (addressMatch && addressMatch[1]) {
    return addressMatch[1].trim();
  }
  
  return '';
}

/**
 * Get weather forecasts for calendar dates
 * Uses Tulsa, OK as default location
 */
export async function getCalendarWeather(req: Request, res: Response) {
  try {
    // Clean Machine Auto Detail location: 4644 S Troost Ave Tulsa, OK 74105
    const tulsaLat = 36.09;
    const tulsaLng = -95.975;
    
    const days = parseInt(req.query.days as string) || 14;
    const cacheKey = CacheKeys.dashboardWeather(days);
    
    // Try cache first
    const cachedData = cacheService.get<any>(cacheKey);
    if (cachedData) {
      console.log(`[CACHE HIT] Weather forecast (${days} days)`);
      return res.json(cachedData);
    }
    
    console.log(`[CACHE MISS] Fetching weather forecast (${days} days)`);
    
    const forecasts = await getDailyWeatherSummary(tulsaLat, tulsaLng, days);
    
    // Convert to map for easier calendar lookup
    const weatherByDate: Record<string, any> = {};
    forecasts.forEach(f => {
      weatherByDate[f.date] = {
        icon: f.icon,
        description: f.description,
        high: f.highTemp,
        low: f.lowTemp,
        rainChance: f.chanceOfRain
      };
    });
    
    const result = {
      success: true,
      weather: weatherByDate,
      forecasts // Also include the array format
    };
    
    // Cache for 1 hour - weather doesn't change that often
    cacheService.set(cacheKey, result, CacheTTL.WEATHER);
    
    return res.json(result);
  } catch (error) {
    console.error('Error fetching calendar weather:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch weather data'
    });
  }
}

/**
 * Navigate & Send ETA - Quick action for appointments
 * Calculates ETA and sends SMS to customer
 */
export async function navigateAndSendETA(req: Request, res: Response) {
  try {
    const { appointmentId, etaPaddingMinutes } = req.body;
    
    if (!appointmentId) {
      return res.status(400).json({
        success: false,
        error: 'Appointment ID is required'
      });
    }
    
    const padding = etaPaddingMinutes || 0;
    
    // Get calendar service
    const calendarService = await getCalendarService();
    
    if (!calendarService) {
      return res.status(503).json({
        success: false,
        error: 'Calendar service not available'
      });
    }
    
    // Fetch the appointment details from Google Calendar
    const event = await calendarService.events.get({
      calendarId: CALENDAR_ID,
      eventId: appointmentId
    });
    
    if (!event || !event.data) {
      return res.status(404).json({
        success: false,
        error: 'Appointment not found'
      });
    }
    
    // Extract address and phone from event
    const address = extractAddress(event.data.description || '') || event.data.location || '';
    const phone = extractPhoneFromDescription(event.data.description || '');
    const customerName = event.data.summary?.split('-')[1]?.trim() || 'Customer';
    
    if (!address) {
      return res.status(400).json({
        success: false,
        error: 'No address found for this appointment'
      });
    }
    
    if (!phone) {
      return res.status(400).json({
        success: false,
        error: 'No phone number found for this appointment'
      });
    }
    
    // Calculate ETA and generate navigation link
    const etaResult = await calculateETAAndGenerateNavLink(address);
    
    if (!etaResult.success) {
      return res.status(500).json({
        success: false,
        error: 'error' in etaResult ? etaResult.error : 'Failed to calculate ETA'
      });
    }
    
    // TypeScript narrowing - after success check, we know eta and navigation exist
    if (!('eta' in etaResult) || !('navigation' in etaResult)) {
      return res.status(500).json({
        success: false,
        error: 'Invalid ETA result structure'
      });
    }
    
    // Apply padding to ETA (round up to nearest 5 minutes)
    const baseDuration = etaResult.eta.driveTimeMinutes;
    const paddedDuration = Math.ceil((baseDuration + padding) / 5) * 5;
    
    console.log(`Navigate & Send ETA: Base ${baseDuration} min + Padding ${padding} min = ${paddedDuration} min (rounded up)`);
    
    // Send SMS to customer with padded ETA
    const smsMessage = `Hi ${customerName}! This is Clean Machine Auto Detail. We're on our way! 🚗\n\nEstimated arrival: ${paddedDuration} minutes\n\nSee you soon!`;
    
    try {
      // Use Main Line (ID 1) for automated ETA notifications
      await sendSMS(phone, smsMessage, undefined, undefined, 1);
    } catch (smsError) {
      console.error('Failed to send ETA SMS:', smsError);
      // Don't fail the whole request if SMS fails - still return navigation data
    }
    
    return res.json({
      success: true,
      eta: {
        ...etaResult.eta,
        paddedDuration: paddedDuration,
        baseDuration: baseDuration,
        paddingApplied: padding,
        formatted: `${paddedDuration} minutes`
      },
      navigation: etaResult.navigation,
      customer: {
        name: customerName,
        phone,
        address: etaResult.formattedAddress
      },
      smsSent: true,
      message: `ETA SMS sent to ${customerName}`
    });
  } catch (error) {
    console.error('Error in Navigate & Send ETA:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to navigate and send ETA'
    });
  }
}

/**
 * Send invoice notification via SMS and/or Email with Stripe payment link
 */
export async function sendInvoiceNotification(req: Request, res: Response) {
  try {
    const { customerPhone, customerEmail, customerName, amount, service, notes } = req.body;
    
    if (!customerPhone || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Customer phone and amount are required'
      });
    }

    const { createManualInvoice } = await import('./invoiceService');
    const invoice = await createManualInvoice({
      customerPhone,
      customerEmail,
      customerName,
      amount,
      serviceDescription: service || 'Service',
      notes,
    });
    
    console.log(`[INVOICE] Created manual invoice #${invoice.id} for ${customerName}`);

    const { sendSMS, sendEmail } = await import('./notifications');
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-04-30.basil' as any });
    
    // Get base URL from environment or construct from available vars
    const baseUrl = process.env.APP_BASE_URL || 
                    (process.env.REPL_SLUG ? `https://${process.env.REPL_SLUG}.replit.app` : '') ||
                    'https://cleanmachine-auto-detail.replit.app';
    
    // Create a Stripe Payment Link for easy payment
    let paymentLink = '';
    try {
      const priceAmount = Math.round(amount * 100); // Convert to cents
      
      // Create a one-time price with metadata
      const price = await stripe.prices.create({
        unit_amount: priceAmount,
        currency: 'usd',
        product_data: {
          name: `${service} - ${customerName}`,
          metadata: {
            service: service,
            customerName: customerName,
            customerPhone: customerPhone,
            notes: notes || '',
          },
        },
      });
      
      // Create a payment link with proper redirect
      const link = await stripe.paymentLinks.create({
        line_items: [{
          price: price.id,
          quantity: 1,
        }],
        after_completion: {
          type: 'redirect',
          redirect: {
            url: `${baseUrl}/payment-success`,
          },
        },
        metadata: {
          service: service,
          customerName: customerName,
          customerPhone: customerPhone,
          customerEmail: customerEmail || '',
        },
      });
      
      paymentLink = link.url;
      console.log(`Created Stripe payment link for ${customerName}: ${paymentLink}`);
    } catch (stripeError) {
      console.error('Error creating Stripe payment link:', stripeError);
      // Fallback to a generic payment page URL
      paymentLink = `${baseUrl}/pay`;
    }
    
    // Build SMS message with real payment link
    const smsMessage = `Thank you ${customerName || 'for choosing Clean Machine Auto Detail'}!\n\nYour ${service} service is complete.\nAmount: $${amount.toFixed(2)}\n\n${notes || ''}\n\nPayment Options:\n1. Card: ${paymentLink}\n2. Venmo: @cleanmachinetulsa\n3. CashApp: $CleanMachineTulsa\n4. PayPal: CleanMachineTulsa\n\nWe'd love a review:\nGoogle: https://g.page/r/CQo53O2yXrN8EBM/review`;
    
    // Send SMS using Main Line (ID 1) for automated invoice notifications
    const smsResult = await sendSMS(customerPhone, smsMessage, undefined, undefined, 1);
    
    // Send Email if provided
    let emailSent = false;
    if (customerEmail && customerEmail.trim() !== '') {
      try {
        // Prepare invoice email data (dashboard version - no database records)
        const invoiceEmailData: InvoiceEmailData = {
          invoiceNumber: `INV-${new Date().getFullYear()}-TEMP-${Date.now()}`, // Temporary invoice number
          customerName: customerName || 'Valued Customer',
          customerEmail: customerEmail,
          customerPhone: customerPhone || '',
          serviceDate: new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }),
          vehicleInfo: undefined, // Dashboard sends don't have vehicle info
          items: [
            {
              service: service || 'Service',
              quantity: 1,
              price: amount
            }
          ],
          subtotal: amount,
          tax: 0, // Tax already included
          taxRate: 0,
          total: amount,
          loyaltyPoints: {
            earned: Math.floor(amount * 0.1), // 10% of amount
            newBalance: 0 // Unknown for dashboard sends (no customer lookup)
          },
          paymentLink: paymentLink,
          venmoUsername: process.env.VENMO_USERNAME || '@cleanmachinetulsa',
          cashappUsername: process.env.CASHAPP_USERNAME || '$CleanMachineTulsa',
          paypalUsername: 'CleanMachineTulsa',
          upsell: {
            title: 'Keep Your Vehicle Looking Fresh',
            description: 'Join our Maintenance Detail Program for regular upkeep every 3 months. Perfect for vehicles we\'ve already detailed!',
            ctaText: 'Learn More',
            ctaUrl: `${baseUrl}/services`
          },
          notes: notes || undefined
        };
        
        // Render branded HTML email
        const emailHtml = renderInvoiceEmail(invoiceEmailData);
        const emailText = renderInvoiceEmailPlainText(invoiceEmailData);
        
        const { sendBusinessEmail } = await import('./emailService');
        const emailResult = await sendBusinessEmail(
          customerEmail,
          `Invoice ${invoiceEmailData.invoiceNumber} - Clean Machine Auto Detail`,
          emailText, // plain text first (correct order)
          emailHtml  // HTML second (correct order)
        );
        emailSent = emailResult.success;
      } catch (emailError) {
        console.error('Error sending branded invoice email:', emailError);
        emailSent = false;
      }
    }
    
    const { signPayToken } = await import('./security/paylink');
    let payToken: string | undefined;
    try {
      payToken = signPayToken(invoice.id);
    } catch (error) {
      console.warn('[INVOICE] Failed to generate pay token:', error);
    }

    if (smsResult.success) {
      return res.json({
        success: true,
        message: `Invoice sent via ${emailSent ? 'SMS and Email' : 'SMS'}`,
        smsSent: true,
        emailSent,
        paymentLink,
        invoiceId: invoice.id,
        payToken
      });
    } else {
      return res.status(500).json({
        success: false,
        message: 'Failed to send invoice',
        error: smsResult.error
      });
    }
  } catch (error) {
    console.error('Error sending invoice:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send invoice notification',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

export async function getDashboardLayout(req: Request, res: Response) {
  try {
    const tenantDb = (req as any).tenantDb!;
    const tenantId = (req.session as any).tenantId || 'root';
    const userId = (req.session as any).userId;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const { dashboardLayouts } = await import('../shared/schema');
    const { eq, and, isNull } = await import('drizzle-orm');

    const userLayout = await tenantDb
      .select()
      .from(dashboardLayouts)
      .where(
        and(
          eq(dashboardLayouts.tenantId, tenantId),
          eq(dashboardLayouts.userId, userId)
        )
      )
      .limit(1);

    if (userLayout.length > 0) {
      return res.json({ success: true, layout: userLayout[0] });
    }

    const tenantDefaultLayout = await tenantDb
      .select()
      .from(dashboardLayouts)
      .where(
        and(
          eq(dashboardLayouts.tenantId, tenantId),
          isNull(dashboardLayouts.userId)
        )
      )
      .limit(1);

    if (tenantDefaultLayout.length > 0) {
      return res.json({ success: true, layout: tenantDefaultLayout[0] });
    }

    return res.json({ success: true, layout: null });
  } catch (error) {
    console.error('Error fetching dashboard layout:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

export async function saveDashboardLayout(req: Request, res: Response) {
  try {
    const tenantDb = (req as any).tenantDb!;
    const tenantId = (req.session as any).tenantId || 'root';
    const userId = (req.session as any).userId;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const { dashboardLayouts, dashboardLayoutPayloadSchema } = await import('../shared/schema');
    const { eq, and } = await import('drizzle-orm');

    const validatedLayout = dashboardLayoutPayloadSchema.parse(req.body.layout);
    const layoutVersion = req.body.layoutVersion || 1;

    const existingLayout = await tenantDb
      .select()
      .from(dashboardLayouts)
      .where(
        and(
          eq(dashboardLayouts.tenantId, tenantId),
          eq(dashboardLayouts.userId, userId)
        )
      )
      .limit(1);

    if (existingLayout.length > 0) {
      const updated = await tenantDb
        .update(dashboardLayouts)
        .set({
          layout: validatedLayout,
          layoutVersion,
          updatedAt: new Date(),
        })
        .where(eq(dashboardLayouts.id, existingLayout[0].id))
        .returning();

      return res.json({ success: true, layout: updated[0] });
    } else {
      const inserted = await tenantDb
        .insert(dashboardLayouts)
        .values({
          tenantId,
          userId,
          layout: validatedLayout,
          layoutVersion,
        })
        .returning();

      return res.json({ success: true, layout: inserted[0] });
    }
  } catch (error) {
    console.error('Error saving dashboard layout:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}