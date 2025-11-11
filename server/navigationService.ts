import axios from 'axios';
import { sendOnTheWayNotification } from './notifications';

/**
 * Calculate the travel time between two points using Google Maps Distance Matrix API
 */
export async function calculateTravelTime(
  origin: string,
  destination: string
): Promise<{ 
  success: boolean; 
  durationMinutes?: number; 
  distanceText?: string;
  error?: string 
}> {
  try {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error('Google Maps API key not configured');
    }

    // Call the Google Maps Distance Matrix API
    const response = await axios.get('https://maps.googleapis.com/maps/api/distancematrix/json', {
      params: {
        origins: origin,
        destinations: destination,
        mode: 'driving',
        units: 'imperial',
        key: apiKey
      }
    });

    // Check if the API response is valid
    if (response.data.status !== 'OK') {
      console.error('Google Maps API error:', response.data.status, response.data.error_message);
      throw new Error(`Failed to calculate travel time: ${response.data.status}`);
    }

    if (!response.data.rows || response.data.rows.length === 0 || 
        !response.data.rows[0].elements || response.data.rows[0].elements.length === 0) {
      throw new Error('No route found between the specified locations');
    }

    const element = response.data.rows[0].elements[0];
    if (element.status !== 'OK') {
      throw new Error(`Route calculation error: ${element.status}`);
    }

    // Extract distance and duration
    const distanceText = element.distance.text;
    const durationSeconds = element.duration.value;
    const durationMinutes = Math.round(durationSeconds / 60);

    return {
      success: true,
      durationMinutes,
      distanceText
    };
  } catch (error: any) {
    console.error('Error calculating travel time:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to calculate travel time' 
    };
  }
}

/**
 * Calculate travel time and notify customer that you're on the way
 * @param etaPaddingMinutes - Optional buffer time to add to ETA (for traffic, fuel stops, etc.)
 */
export async function calculateAndNotifyOnTheWay(
  origin: string,
  destination: string,
  customerPhone: string,
  etaPaddingMinutes: number = 0
): Promise<{ 
  success: boolean; 
  durationMinutes?: number; 
  paddedDurationMinutes?: number;
  notificationSent?: boolean;
  error?: string 
}> {
  try {
    // First calculate the travel time
    const travelTimeResult = await calculateTravelTime(origin, destination);
    
    if (!travelTimeResult.success) {
      throw new Error(travelTimeResult.error);
    }
    
    // Then send the notification to the customer
    if (!travelTimeResult.durationMinutes) {
      throw new Error('Failed to calculate duration minutes');
    }
    
    // Apply padding to the duration (round up to nearest 5 minutes)
    const baseDuration = travelTimeResult.durationMinutes;
    const paddedDuration = Math.ceil((baseDuration + etaPaddingMinutes) / 5) * 5;
    
    console.log(`ETA Calculation: Base ${baseDuration} min + Padding ${etaPaddingMinutes} min = ${paddedDuration} min (rounded up)`);
    
    const notificationResult = await sendOnTheWayNotification(
      customerPhone,
      destination,
      paddedDuration
    );
    
    if (!notificationResult.success) {
      throw new Error('Failed to send notification to customer');
    }
    
    return {
      success: true,
      durationMinutes: baseDuration,
      paddedDurationMinutes: paddedDuration,
      notificationSent: true
    };
  } catch (error: any) {
    console.error('Error calculating and notifying:', error);
    return {
      success: false,
      error: error.message || 'Failed to calculate travel time and notify customer'
    };
  }
}