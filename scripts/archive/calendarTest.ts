import { google } from 'googleapis';
import { getAuthClient } from './googleIntegration';

/**
 * Test the Google Calendar API connection
 */
export async function testCalendarAPI() {
  try {
    const auth = getAuthClient();
    if (!auth) {
      console.error('Calendar test failed: No authentication client available');
      return { success: false, error: 'Failed to initialize Google authentication' };
    }
    
    // Make a simple call to validate the credentials work
    await auth.authorize();
    
    // Use calendar service to list a single event to verify access
    const calendar = google.calendar({ version: 'v3', auth });
    const calendarId = 'cleanmachinetulsa@gmail.com';
    
    // Get today's date
    const now = new Date();
    const timeMin = now.toISOString();
    const timeMax = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(); // Tomorrow
    
    // Make a test request for a single event
    const response = await calendar.events.list({
      calendarId: calendarId,
      timeMin: timeMin,
      timeMax: timeMax,
      maxResults: 1,
      singleEvents: true,
    });
    
    return { 
      success: true, 
      message: 'Calendar API authentication successful',
      hasEvents: response.data.items && response.data.items.length > 0,
      data: response.data
    };
  } catch (error) {
    console.error('Calendar test failed:', error);
    return { 
      success: false, 
      error: 'Calendar API test failed', 
      details: error.message 
    };
  }
}