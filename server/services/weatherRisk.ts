/**
 * Weather Risk Assessment Helpers - Phase 13 Enhanced
 * 
 * Provides standardized risk level classification and messaging for weather-related
 * appointment alerts. Supports both legacy simple risk assessment and comprehensive
 * context-aware evaluation.
 * 
 * LEGACY SYSTEM (Backward Compatible):
 * - Simple rain percentage → risk level mapping
 * - Used by existing weatherService.ts and notifications
 * 
 * PHASE 13 ENHANCED SYSTEM:
 * - Multi-factor risk assessment (rain, thunderstorms, wind, alerts, etc.)
 * - Industry-aware messaging
 * - Comprehensive context evaluation
 */

// ============================================================================
// LEGACY SYSTEM (Backward Compatible - DO NOT MODIFY)
// ============================================================================

/**
 * @deprecated Use EnhancedWeatherRiskLevel for new code
 */
export type WeatherRiskLevel =
  | "severe"
  | "very-high"
  | "high"
  | "moderate"
  | "low";

/**
 * Convert rain chance percentage to standardized risk level (Legacy)
 * @deprecated Use evaluateWeatherRisk() for comprehensive assessment
 */
export function getWeatherRiskLevel(rainChancePercent: number): WeatherRiskLevel {
  if (rainChancePercent >= 80) return "severe";
  if (rainChancePercent >= 60) return "very-high";
  if (rainChancePercent >= 25) return "high";
  if (rainChancePercent >= 15) return "moderate";
  return "low";
}

/**
 * Get human-readable severity description for a risk level (Legacy)
 * @deprecated Use getEnhancedWeatherSeverityText() for new code
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
 * Get recommended action text for customers based on risk level (Legacy)
 * Returns null for low risk (no action needed)
 * @deprecated Use getEnhancedWeatherActionText() for new code
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

// ============================================================================
// PHASE 13 ENHANCED SYSTEM
// ============================================================================

/**
 * Enhanced risk level classification (Phase 13)
 * Uses broader threshold ranges and considers multiple weather factors
 */
export type EnhancedWeatherRiskLevel = 'low' | 'medium' | 'high' | 'extreme';

/**
 * Comprehensive weather context for multi-factor risk assessment
 * All fields are optional to handle various forecast data sources
 */
export interface WeatherRiskContext {
  // Core precipitation metrics
  precipitationChance?: number;      // 0-100 (%)
  precipitationIntensityMm?: number; // mm/hr if available
  
  // Severe weather indicators
  thunderstormRisk?: boolean;
  severeAlertActive?: boolean;       // true if provider indicates a severe alert
  
  // Additional environmental factors
  windSpeedMph?: number;
  temperatureF?: number;
  
  // Optional business context
  industryType?: string | null;      // e.g. 'auto_detailing', 'lawn_care', 'house_cleaning'
}

/**
 * Complete risk assessment result with actionable recommendations
 */
export interface WeatherRiskResult {
  level: EnhancedWeatherRiskLevel;
  severityText: string;
  actionText: string;
}

/**
 * Calculate enhanced risk level from comprehensive weather context
 * 
 * Risk calculation logic:
 * - Base: precipitation chance (0-20% → low, 21-49% → medium, 50-79% → high, 80-100% → extreme)
 * - Severe alert active → always extreme
 * - Thunderstorm risk → bump to at least high
 * - High wind (>30 mph) → bump risk by one level
 * 
 * @param ctx Weather context with optional fields
 * @returns Enhanced risk level
 */
export function getEnhancedWeatherRiskLevel(ctx: WeatherRiskContext): EnhancedWeatherRiskLevel {
  const precipChance = ctx.precipitationChance ?? 0;
  
  // Severe alert always overrides to extreme
  if (ctx.severeAlertActive) {
    return 'extreme';
  }
  
  // Base risk from precipitation chance
  let baseRisk: EnhancedWeatherRiskLevel;
  if (precipChance >= 80) {
    baseRisk = 'extreme';
  } else if (precipChance >= 50) {
    baseRisk = 'high';
  } else if (precipChance >= 21) {
    baseRisk = 'medium';
  } else {
    baseRisk = 'low';
  }
  
  // Thunderstorm risk bumps to at least high
  if (ctx.thunderstormRisk && (baseRisk === 'low' || baseRisk === 'medium')) {
    baseRisk = 'high';
  }
  
  // High wind bumps risk by one level (capped at extreme)
  if (ctx.windSpeedMph && ctx.windSpeedMph > 30) {
    if (baseRisk === 'low') baseRisk = 'medium';
    else if (baseRisk === 'medium') baseRisk = 'high';
    else if (baseRisk === 'high') baseRisk = 'extreme';
  }
  
  return baseRisk;
}

/**
 * Get human-friendly severity description
 * 
 * @param result Weather risk result
 * @param ctx Optional context for industry-specific customization (future)
 * @returns Human-readable severity text
 */
export function getEnhancedWeatherSeverityText(
  result: WeatherRiskResult,
  ctx?: WeatherRiskContext
): string {
  // Generic defaults for all field service industries
  switch (result.level) {
    case 'low':
      return "Weather risk is low.";
    case 'medium':
      return "There is a moderate chance of weather affecting this appointment.";
    case 'high':
      return "There is a high chance of rain or conditions that may affect outdoor services.";
    case 'extreme':
      return "Severe weather is likely during this appointment window.";
    default:
      return "Weather conditions are uncertain.";
  }
  
  // Future: Industry-specific variations could be added here
  // Example: if (ctx?.industryType === 'auto_detailing') { ... }
}

/**
 * Get recommended customer action based on risk level
 * 
 * @param result Weather risk result  
 * @param ctx Optional context for industry-specific customization (future)
 * @returns Human-readable action recommendation
 */
export function getEnhancedWeatherActionText(
  result: WeatherRiskResult,
  ctx?: WeatherRiskContext
): string {
  // Generic defaults for all field service industries
  switch (result.level) {
    case 'low':
      return "No changes are needed based on the current forecast.";
    case 'medium':
      return "You can keep your current time, but you may want a backup option in mind.";
    case 'high':
      return "We recommend considering a reschedule or moving the appointment to a more flexible time.";
    case 'extreme':
      return "We strongly recommend rescheduling to ensure safety and the best results.";
    default:
      return "Please contact us to discuss your appointment.";
  }
  
  // Future: Industry-specific variations could be added here
  // Example: if (ctx?.industryType === 'lawn_care') { ... }
}

/**
 * Comprehensive weather risk evaluation - PRIMARY PHASE 13 ENTRY POINT
 * 
 * Evaluates all available weather context and returns a complete risk assessment
 * with actionable recommendations suitable for customer communications.
 * 
 * @param ctx Weather risk context (all fields optional)
 * @returns Complete risk assessment result
 * 
 * @example
 * const result = evaluateWeatherRisk({
 *   precipitationChance: 65,
 *   thunderstormRisk: true,
 *   windSpeedMph: 25,
 *   industryType: 'auto_detailing'
 * });
 * // result.level === 'high'
 * // result.severityText === "There is a high chance of rain..."
 * // result.actionText === "We recommend considering a reschedule..."
 */
export function evaluateWeatherRisk(ctx: WeatherRiskContext): WeatherRiskResult {
  // Calculate risk level using multi-factor assessment
  const level = getEnhancedWeatherRiskLevel(ctx);
  
  // Build preliminary result object
  const preliminaryResult: WeatherRiskResult = {
    level,
    severityText: '',
    actionText: '',
  };
  
  // Generate human-friendly text based on risk level and context
  const severityText = getEnhancedWeatherSeverityText(preliminaryResult, ctx);
  const actionText = getEnhancedWeatherActionText(preliminaryResult, ctx);
  
  // Return complete result
  return {
    level,
    severityText,
    actionText,
  };
}
