import axios from 'axios';
import { getWeatherRiskLevel, type WeatherRiskLevel } from './services/weatherRisk';
import {
  evaluateWeatherRisk,
  type WeatherRiskContext,
  type WeatherRiskResult,
  type EnhancedWeatherRiskLevel,
} from './services/weatherRisk';

// Types for OpenWeatherMap API responses
export interface WeatherForecast {
  date: string;
  description: string;
  chanceOfRain: number;
  temperature: number;
  isRainy: boolean;
  severity: 'none' | 'low' | 'moderate' | 'high' | 'severe';
}

export interface WeatherCheckResult {
  needsReschedule: boolean;
  forecastData: WeatherForecast[];
  recommendation: string;
  urgency: 'none' | 'low' | 'medium' | 'high';
  weatherRiskLevel: WeatherRiskLevel | 'none';
}

/**
 * Phase 13 - Enhanced Weather Risk Assessment
 * 
 * Adapter function to convert Open-Meteo forecast data into comprehensive
 * weather risk context for multi-factor risk evaluation.
 */
export interface ProviderForecast {
  chanceOfRain?: number;           // 0-100
  precipitationMmPerHour?: number;
  windSpeedMph?: number;
  temperatureF?: number;
  weatherCode?: number;            // WMO weather code
  hasThunderstorm?: boolean;
  hasSevereAlert?: boolean;
}

/**
 * Get enhanced weather risk assessment from forecast data (Phase 13)
 * 
 * Maps provider forecast data to comprehensive weather risk context and
 * returns actionable risk assessment with severity and action recommendations.
 * 
 * @param forecast Provider forecast data (all fields optional)
 * @param options Optional industry context for future customization
 * @returns Complete weather risk assessment
 * 
 * @example
 * const forecast = { chanceOfRain: 65, windSpeedMph: 35, hasThunderstorm: true };
 * const risk = getWeatherRiskFromForecast(forecast, { industryType: 'auto_detailing' });
 * // risk.level === 'extreme' (high rain + thunderstorm + high wind)
 * // risk.severityText === "Severe weather is likely..."
 * // risk.actionText === "We strongly recommend rescheduling..."
 */
export function getWeatherRiskFromForecast(
  forecast: ProviderForecast,
  options?: { industryType?: string | null }
): WeatherRiskResult {
  // Detect thunderstorms from WMO weather codes (95-99)
  const isThunderstorm = forecast.weatherCode ? 
    (forecast.weatherCode >= 95 && forecast.weatherCode <= 99) : 
    (forecast.hasThunderstorm ?? false);
  
  // Build comprehensive weather context
  const ctx: WeatherRiskContext = {
    precipitationChance: forecast.chanceOfRain,
    precipitationIntensityMm: forecast.precipitationMmPerHour,
    windSpeedMph: forecast.windSpeedMph,
    temperatureF: forecast.temperatureF,
    thunderstormRisk: isThunderstorm,
    severeAlertActive: forecast.hasSevereAlert ?? false,
    industryType: options?.industryType ?? null,
  };
  
  // Use Phase 13 comprehensive risk evaluation
  return evaluateWeatherRisk(ctx);
}

/**
 * Get hourly weather forecast for a location
 * @param latitude Location latitude
 * @param longitude Location longitude
 * @param days Number of days to forecast (max 4)
 */
/**
 * Simplified alias for getHourlyForecast with a consistent name used in routes
 */
export async function getWeatherForecast(
  latitude: number,
  longitude: number,
  days: number = 3
): Promise<WeatherForecast[]> {
  return getHourlyForecast(latitude, longitude, days);
}

/**
 * Get daily weather summary for calendar display
 * Returns one forecast per day with weather icon
 */
export async function getDailyWeatherSummary(
  latitude: number,
  longitude: number,
  days: number = 7
): Promise<Array<{
  date: string;
  icon: string;
  description: string;
  highTemp: number;
  lowTemp: number;
  chanceOfRain: number;
}>> {
  try {
    const response = await axios.get('https://api.open-meteo.com/v1/forecast', {
      params: {
        latitude,
        longitude,
        daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code',
        timezone: 'America/Chicago',
        forecast_days: Math.min(days, 16) // Open-Meteo supports up to 16 days for daily
      }
    });

    const data = response.data.daily;
    const forecasts = [];

    for (let i = 0; i < data.time.length; i++) {
      const weatherCode = data.weather_code[i];
      const icon = getWeatherIcon(weatherCode);
      const description = getWeatherDescription(weatherCode);

      forecasts.push({
        date: data.time[i], // YYYY-MM-DD format
        icon,
        description,
        highTemp: Math.round(data.temperature_2m_max[i]),
        lowTemp: Math.round(data.temperature_2m_min[i]),
        chanceOfRain: data.precipitation_probability_max[i] || 0
      });
    }

    return forecasts;
  } catch (error) {
    console.error('Error fetching daily weather summary:', error);
    return [];
  }
}

/**
 * Map WMO weather codes to icons
 * Reference: https://open-meteo.com/en/docs
 */
function getWeatherIcon(code: number): string {
  if (code === 0) return '☀️'; // Clear sky
  if (code === 1) return '🌤️'; // Mainly clear
  if (code === 2) return '⛅'; // Partly cloudy
  if (code === 3) return '☁️'; // Overcast
  if (code >= 45 && code <= 48) return '🌫️'; // Fog
  if (code >= 51 && code <= 57) return '🌦️'; // Drizzle
  if (code >= 61 && code <= 67) return '🌧️'; // Rain
  if (code >= 71 && code <= 77) return '🌨️'; // Snow
  if (code >= 80 && code <= 82) return '🌧️'; // Rain showers
  if (code >= 85 && code <= 86) return '🌨️'; // Snow showers
  if (code >= 95 && code <= 99) return '⛈️'; // Thunderstorm
  return '☀️'; // Default to sunny
}

/**
 * Get human-readable weather description from WMO code
 */
function getWeatherDescription(code: number): string {
  if (code === 0) return 'Clear';
  if (code === 1) return 'Mostly Clear';
  if (code === 2) return 'Partly Cloudy';
  if (code === 3) return 'Cloudy';
  if (code >= 45 && code <= 48) return 'Foggy';
  if (code >= 51 && code <= 57) return 'Drizzle';
  if (code >= 61 && code <= 65) return 'Rain';
  if (code === 66 || code === 67) return 'Freezing Rain';
  if (code >= 71 && code <= 75) return 'Snow';
  if (code === 77) return 'Snow Grains';
  if (code >= 80 && code <= 82) return 'Rain Showers';
  if (code >= 85 && code <= 86) return 'Snow Showers';
  if (code === 95) return 'Thunderstorm';
  if (code === 96 || code === 99) return 'Thunderstorm with Hail';
  return 'Clear';
}

/**
 * Get hourly weather forecast for a location using Open-Meteo API (free, no key required)
 */
export async function getHourlyForecast(
  latitude: number, 
  longitude: number, 
  days: number = 3
): Promise<WeatherForecast[]> {
  try {
    // Use Open-Meteo free weather API with exact parameters
    const response = await axios.get('https://api.open-meteo.com/v1/forecast', {
      params: {
        latitude: latitude,
        longitude: longitude,
        hourly: 'temperature_2m,precipitation_probability,precipitation,wind_speed_10m,weather_code',
        current: 'temperature_2m,precipitation',
        timezone: 'America/Chicago',
        timeformat: 'unixtime',
        wind_speed_unit: 'mph',
        temperature_unit: 'fahrenheit',
        precipitation_unit: 'mm',  // Changed to mm for consistency with weatherRisk
        forecast_days: Math.min(days, 7) // Open-Meteo supports up to 7 days
      }
    });

    if (response.status !== 200) {
      throw new Error(`Open-Meteo API error: ${response.statusText}`);
    }

    const data = response.data;
    const forecasts: WeatherForecast[] = [];
    
    // Process hourly data
    const hourlyData = data.hourly;
    const times = hourlyData.time;
    const temperatures = hourlyData.temperature_2m;
    const precipProbabilities = hourlyData.precipitation_probability || [];
    
    for (let i = 0; i < times.length; i++) {
      const date = new Date(times[i] * 1000); // Convert unix timestamp to milliseconds
      const hour = date.getHours();
      
      // Only include business hours (9am to 5pm) when detailing work would be performed
      if (hour >= 9 && hour <= 17) {
        const precipProb = precipProbabilities[i] || 0;
        
        // Determine if it's rainy based on precipitation probability
        const isRainy = precipProb >= 30;
        
        // Get weather description based on precipitation probability
        let description = 'Clear';
        if (precipProb >= 70) {
          description = 'Heavy rain likely';
        } else if (precipProb >= 50) {
          description = 'Rain likely';
        } else if (precipProb >= 30) {
          description = 'Possible rain';
        } else if (precipProb >= 15) {
          description = 'Slight chance of rain';
        } else if (precipProb > 0) {
          description = 'Mostly clear';
        }
        
        // Determine severity based on precipitation probability
        let severity: 'none' | 'low' | 'moderate' | 'high' | 'severe' = 'none';
        
        if (precipProb > 70) {
          severity = 'severe';
        } else if (precipProb > 50) {
          severity = 'high';
        } else if (precipProb > 30) {
          severity = 'moderate';
        } else if (precipProb > 15) {
          severity = 'low';
        }
        
        forecasts.push({
          date: date.toISOString(),
          description,
          chanceOfRain: Math.round(precipProb),
          temperature: Math.round(temperatures[i]),
          isRainy,
          severity
        });
      }
    }
    
    return forecasts;
  } catch (error: any) {
    console.error('Error fetching weather forecast:', error);
    throw new Error(`Failed to fetch weather forecast: ${error.message}`);
  }
}

/**
 * Check if the weather for a specific appointment date and location requires rescheduling
 * @param latitude Location latitude
 * @param longitude Location longitude
 * @param appointmentDate Date of the appointment
 */
export async function checkAppointmentWeather(
  latitude: number,
  longitude: number,
  appointmentDate: string
): Promise<WeatherCheckResult> {
  try {
    const appointmentDateTime = new Date(appointmentDate);
    const now = new Date();
    const daysDiff = Math.ceil((appointmentDateTime.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    // If appointment is too far in the future (>4 days), we can't check weather yet
    if (daysDiff > 4) {
      return {
        needsReschedule: false,
        forecastData: [],
        recommendation: "Appointment is more than 4 days away. Weather forecast not available yet.",
        urgency: 'none',
        weatherRiskLevel: 'none'
      };
    }
    
    // Get the hourly forecast
    const forecasts = await getHourlyForecast(latitude, longitude, Math.max(daysDiff, 1));
    
    // Filter forecasts for the appointment date
    const appointmentDateString = appointmentDateTime.toISOString().split('T')[0];
    const appointmentForecasts = forecasts.filter(f => 
      f.date.split('T')[0] === appointmentDateString
    );
    
    // If no forecasts found for the appointment date
    if (appointmentForecasts.length === 0) {
      return {
        needsReschedule: false,
        forecastData: forecasts,
        recommendation: "No weather data available for the appointment date.",
        urgency: 'none',
        weatherRiskLevel: 'none'
      };
    }
    
    // Calculate average rain probability
    const avgRainProbability = appointmentForecasts.reduce((sum, f) => sum + f.chanceOfRain, 0) / appointmentForecasts.length;
    
    // Check if any hour during the appointment time has severe or high weather conditions
    const hasSevereWeather = appointmentForecasts.some(f => 
      f.severity === 'severe' || f.severity === 'high'
    );
    
    // Check if majority of appointment hours have at least moderate weather conditions
    const hasModerateWeather = appointmentForecasts.filter(f => 
      f.severity === 'moderate' || f.severity === 'high' || f.severity === 'severe'
    ).length > (appointmentForecasts.length / 2);
    
    // Use centralized weather risk assessment
    const { getWeatherSeverityText, getWeatherActionText } = await import('./services/weatherRisk');
    const weatherRiskLevel = getWeatherRiskLevel(avgRainProbability);
    
    let needsReschedule = false;
    let recommendation = "";
    let urgency: 'none' | 'low' | 'medium' | 'high' = 'none';
    
    // Build recommendation using centralized helpers
    const severityText = getWeatherSeverityText(weatherRiskLevel);
    const actionText = getWeatherActionText(weatherRiskLevel);
    
    // Apply urgency and reschedule logic based on risk level
    if (weatherRiskLevel === 'severe') {
      needsReschedule = true;
      urgency = 'high';
      recommendation = `Severe weather conditions (${severityText}) are forecasted for this appointment. ${actionText}`;
    } else if (weatherRiskLevel === 'very-high') {
      needsReschedule = true;
      urgency = 'high';
      recommendation = `Very high chance of rain during this appointment time. ${actionText}`;
    } else if (weatherRiskLevel === 'high') {
      needsReschedule = true;
      urgency = 'medium';
      recommendation = `High chance of rain expected during this appointment. ${actionText}`;
    } else if (weatherRiskLevel === 'moderate') {
      needsReschedule = false;
      urgency = 'low';
      recommendation = actionText || "Moderate chance of rain during this appointment.";
    } else {
      recommendation = "Weather looks good for this appointment (less than 15% chance of rain).";
      urgency = 'none';
    }
    
    return {
      needsReschedule,
      forecastData: appointmentForecasts,
      recommendation,
      urgency,
      weatherRiskLevel
    };
  } catch (error: any) {
    console.error('Error checking appointment weather:', error);
    throw new Error(`Failed to check appointment weather: ${error.message}`);
  }
}

/**
 * Check weather forecasts for all upcoming appointments
 * @param appointments List of appointments to check
 * @returns Weather check results for each appointment
 */
export async function checkWeatherForAppointments(
  appointments: Array<{
    id: string;
    date: string;
    location?: string;
    latitude?: number;
    longitude?: number;
  }>
): Promise<Record<string, WeatherCheckResult>> {
  const results: Record<string, WeatherCheckResult> = {};
  
  for (const appointment of appointments) {
    try {
      // Use provided coordinates or geocode the location if needed
      const lat = appointment.latitude || 36.1236407; // Default to Tulsa coordinates
      const lon = appointment.longitude || -95.9359214;
      
      const weatherCheck = await checkAppointmentWeather(
        lat,
        lon,
        appointment.date
      );
      
      results[appointment.id] = weatherCheck;
    } catch (error: any) {
      console.error(`Error checking weather for appointment ${appointment.id}:`, error);
      results[appointment.id] = {
        needsReschedule: false,
        forecastData: [],
        recommendation: `Error checking weather: ${error.message}`,
        urgency: 'none',
        weatherRiskLevel: 'none'
      };
    }
  }
  
  return results;
}

/**
 * Check weather for all upcoming appointments and return appointments that need rescheduling
 * This is used for proactive weather notifications
 */
export async function checkAndAlertForUpcomingAppointments(): Promise<{
  totalAppointments: number;
  appointmentsChecked: number;
  appointmentsNeedingReschedule: number;
  detailedResults: Array<{
    id: string;
    customerName: string;
    date: string;
    needsReschedule: boolean;
    recommendation: string;
    urgency: 'none' | 'low' | 'medium' | 'high';
    weatherRiskLevel: 'none' | 'low' | 'moderate' | 'high' | 'very-high' | 'severe';
  }>;
}> {
  try {
    // Get upcoming appointments from the calendar API
    // This would typically come from your dashboard/calendar API
    // For now, we'll use test data for development until we connect to the real calendar
    const testAppointments = [
      {
        id: 'appt-1',
        customerName: 'John Smith',
        date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // tomorrow
        location: 'Tulsa, OK',
        latitude: 36.1236407,
        longitude: -95.9359214
      },
      {
        id: 'appt-2',
        customerName: 'Jane Doe',
        date: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), // day after tomorrow
        location: 'Tulsa, OK',
        latitude: 36.1236407,
        longitude: -95.9359214
      }
    ];
    
    // Get weather forecasts for these appointments
    const weatherResults = await checkWeatherForAppointments(testAppointments);
    
    // Process the results
    const detailedResults = testAppointments.map(appointment => {
      const weatherResult = weatherResults[appointment.id];
      return {
        id: appointment.id,
        customerName: appointment.customerName,
        date: appointment.date,
        needsReschedule: weatherResult?.needsReschedule || false,
        recommendation: weatherResult?.recommendation || 'No weather data available',
        urgency: weatherResult?.urgency || 'none',
        weatherRiskLevel: weatherResult?.weatherRiskLevel || 'none'
      };
    });
    
    // Count appointments needing rescheduling
    const appointmentsNeedingReschedule = detailedResults.filter(
      result => result.needsReschedule
    ).length;
    
    return {
      totalAppointments: testAppointments.length,
      appointmentsChecked: detailedResults.length,
      appointmentsNeedingReschedule,
      detailedResults
    };
  } catch (error: any) {
    console.error('Error checking upcoming appointments weather:', error);
    return {
      totalAppointments: 0,
      appointmentsChecked: 0,
      appointmentsNeedingReschedule: 0,
      detailedResults: []
    };
  }
}

/**
 * Phase 13 - Internal helper to fetch enriched hourly forecast data
 * 
 * Requests additional weather fields from Open-Meteo for comprehensive risk assessment.
 * Returns precipitation intensity, wind speed, and weather codes needed for Phase 13.
 */
async function getEnrichedHourlyForecast(
  latitude: number,
  longitude: number,
  days: number = 3
): Promise<Array<{
  date: string;
  precipitationChance: number;
  precipitationIntensityMm: number;
  windSpeedMph: number;
  temperatureF: number;
  weatherCode: number;
}>> {
  const response = await axios.get('https://api.open-meteo.com/v1/forecast', {
    params: {
      latitude,
      longitude,
      hourly: 'temperature_2m,precipitation_probability,precipitation,wind_speed_10m,weather_code',
      timezone: 'America/Chicago',
      timeformat: 'unixtime',
      wind_speed_unit: 'mph',
      temperature_unit: 'fahrenheit',
      precipitation_unit: 'mm',
      forecast_days: Math.min(days, 7)
    }
  });

  if (response.status !== 200) {
    throw new Error(`Open-Meteo API error: ${response.statusText}`);
  }

  const data = response.data.hourly;
  const forecasts = [];

  for (let i = 0; i < data.time.length; i++) {
    const date = new Date(data.time[i] * 1000);
    const hour = date.getHours();

    // Only include business hours (9am to 5pm)
    if (hour >= 9 && hour <= 17) {
      forecasts.push({
        date: date.toISOString(),
        precipitationChance: data.precipitation_probability?.[i] || 0,
        precipitationIntensityMm: data.precipitation?.[i] || 0,
        windSpeedMph: data.wind_speed_10m?.[i] || 0,
        temperatureF: data.temperature_2m?.[i] || 0,
        weatherCode: data.weather_code?.[i] || 0,
      });
    }
  }

  return forecasts;
}

/**
 * Phase 13 - Get Enhanced Weather Risk for Appointment
 * 
 * Lightweight helper for reminder/notification logic to get comprehensive weather
 * risk assessment for a specific appointment using Phase 13 enhanced evaluation.
 * 
 * Safe to use in reminder pipelines - returns null if data is missing rather than throwing.
 * 
 * @param options.tenantId - Tenant ID for appointment
 * @param options.appointmentId - Appointment ID (can be string or number)
 * @param options.latitude - Optional override latitude (otherwise uses default)
 * @param options.longitude - Optional override longitude (otherwise uses default)
 * @param options.appointmentDate - Optional override date (otherwise fetches from appointment)
 * @param options.industryType - Optional industry context for customized messaging
 * @returns Enhanced weather risk result or null if data unavailable
 * 
 * @example
 * const risk = await getAppointmentWeatherRisk({
 *   tenantId: 'root',
 *   appointmentId: '123',
 *   industryType: 'auto_detailing'
 * });
 * 
 * if (risk && (risk.level === 'high' || risk.level === 'extreme')) {
 *   // Add risk info to reminder template
 *   const message = `${baseMessage}\n\nWeather Alert: ${risk.severityText} ${risk.actionText}`;
 * }
 */
export async function getAppointmentWeatherRisk(options: {
  tenantId: string;
  appointmentId: string | number;
  latitude?: number;
  longitude?: number;
  appointmentDate?: string;
  industryType?: string | null;
}): Promise<WeatherRiskResult | null> {
  try {
    // Use provided coords or default to Tulsa (can be extended to load from appointment/tenant)
    const lat = options.latitude ?? 36.1236407;
    const lon = options.longitude ?? -95.9359214;
    
    // Use provided date or would load from appointment DB (simplified for Phase 13)
    const appointmentDate = options.appointmentDate ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    
    // Get enriched forecast with full weather context (precipitation intensity, wind, etc.)
    const forecasts = await getEnrichedHourlyForecast(lat, lon, 3);
    
    if (!forecasts || forecasts.length === 0) {
      return null;
    }
    
    // Find forecast closest to appointment time
    const appointmentDateString = new Date(appointmentDate).toISOString().split('T')[0];
    const relevantForecasts = forecasts.filter(f => 
      f.date.split('T')[0] === appointmentDateString
    );
    
    if (relevantForecasts.length === 0) {
      return null;
    }
    
    // Calculate average conditions during appointment window
    const avgRain = relevantForecasts.reduce((sum, f) => sum + f.precipitationChance, 0) / relevantForecasts.length;
    const avgIntensity = relevantForecasts.reduce((sum, f) => sum + f.precipitationIntensityMm, 0) / relevantForecasts.length;
    const avgWind = relevantForecasts.reduce((sum, f) => sum + f.windSpeedMph, 0) / relevantForecasts.length;
    const avgTemp = relevantForecasts.reduce((sum, f) => sum + f.temperatureF, 0) / relevantForecasts.length;
    
    // Check for thunderstorms in forecast window (WMO codes 95-99)
    const hasThunderstorm = relevantForecasts.some(f => f.weatherCode >= 95 && f.weatherCode <= 99);
    
    // Map to ProviderForecast for Phase 13 assessment
    const providerForecast: ProviderForecast = {
      chanceOfRain: avgRain,
      precipitationMmPerHour: avgIntensity,
      windSpeedMph: avgWind,
      temperatureF: avgTemp,
      hasThunderstorm,
      hasSevereAlert: false,  // Could be extended with weather alert API integration
    };
    
    // Use Phase 13 comprehensive risk assessment
    return getWeatherRiskFromForecast(providerForecast, {
      industryType: options.industryType ?? null
    });
    
  } catch (error: any) {
    console.error(`[Phase 13] Error getting weather risk for appointment ${options.appointmentId}:`, error);
    // Safe failure - return null rather than crashing reminder pipeline
    return null;
  }
}