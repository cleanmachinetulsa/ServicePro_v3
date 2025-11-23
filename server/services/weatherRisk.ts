/**
 * Weather Risk Assessment Helpers
 * 
 * Provides standardized risk level classification and messaging for weather-related
 * appointment alerts based on rain probability.
 * 
 * Intended usage: Daily 4pm job checks rain chance for next-day appointments and
 * uses this module to determine if/what message to send to customers.
 */

export type WeatherRiskLevel =
  | "severe"
  | "very-high"
  | "high"
  | "moderate"
  | "low";

/**
 * Convert rain chance percentage to standardized risk level
 */
export function getWeatherRiskLevel(rainChancePercent: number): WeatherRiskLevel {
  if (rainChancePercent >= 80) return "severe";
  if (rainChancePercent >= 60) return "very-high";
  if (rainChancePercent >= 25) return "high";
  if (rainChancePercent >= 15) return "moderate";
  return "low";
}

/**
 * Get human-readable severity description for a risk level
 */
export function getWeatherSeverityText(level: WeatherRiskLevel): string {
  switch (level) {
    case "severe":
      return "severe weather (80-100% chance of rain)";
    case "very-high":
      return "very high chance of rain (60-80%)";
    case "high":
      return "high chance of rain (25-60%)";
    case "moderate":
      return "moderate chance of rain (15-25%)";
    case "low":
    default:
      return "low chance of rain (0-15%)";
  }
}

/**
 * Get recommended action text for customers based on risk level
 * Returns null for low risk (no action needed)
 */
export function getWeatherActionText(level: WeatherRiskLevel): string | null {
  switch (level) {
    case "severe":
      return "We strongly recommend rescheduling to ensure quality service.";
    case "very-high":
      return "We recommend rescheduling to ensure quality service.";
    case "high":
      return "Consider rescheduling for better detailing results.";
    case "moderate":
      return "We can still perform service, but exterior detailing might be affected.";
    case "low":
    default:
      return null;
  }
}
