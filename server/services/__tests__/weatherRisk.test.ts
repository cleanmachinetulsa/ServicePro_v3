/**
 * Phase 13 - Weather Risk Assessment Tests
 * 
 * Comprehensive test suite for enhanced weather risk evaluation logic.
 * Tests multi-factor risk assessment and human-readable text generation.
 */

import {describe, it, expect} from 'vitest';
import {
  evaluateWeatherRisk,
  getEnhancedWeatherRiskLevel,
  getEnhancedWeatherSeverityText,
  getEnhancedWeatherActionText,
  type WeatherRiskContext,
  type EnhancedWeatherRiskLevel,
} from '../weatherRisk';

describe('Phase 13: Enhanced Weather Risk Assessment', () => {
  
  describe('getEnhancedWeatherRiskLevel - Base Precipitation Thresholds', () => {
    
    it('should return "low" for 0-20% precipitation chance', () => {
      const ctx: WeatherRiskContext = { precipitationChance: 10 };
      const level = getEnhancedWeatherRiskLevel(ctx);
      expect(level).toBe('low');
    });
    
    it('should return "low" at upper threshold (20%)', () => {
      const ctx: WeatherRiskContext = { precipitationChance: 20 };
      const level = getEnhancedWeatherRiskLevel(ctx);
      expect(level).toBe('low');
    });
    
    it('should return "medium" for 21-49% precipitation chance', () => {
      const ctx: WeatherRiskContext = { precipitationChance: 40 };
      const level = getEnhancedWeatherRiskLevel(ctx);
      expect(level).toBe('medium');
    });
    
    it('should return "medium" at lower threshold (21%)', () => {
      const ctx: WeatherRiskContext = { precipitationChance: 21 };
      const level = getEnhancedWeatherRiskLevel(ctx);
      expect(level).toBe('medium');
    });
    
    it('should return "high" for 50-79% precipitation chance', () => {
      const ctx: WeatherRiskContext = { precipitationChance: 70 };
      const level = getEnhancedWeatherRiskLevel(ctx);
      expect(level).toBe('high');
    });
    
    it('should return "high" at lower threshold (50%)', () => {
      const ctx: WeatherRiskContext = { precipitationChance: 50 };
      const level = getEnhancedWeatherRiskLevel(ctx);
      expect(level).toBe('high');
    });
    
    it('should return "extreme" for 80-100% precipitation chance', () => {
      const ctx: WeatherRiskContext = { precipitationChance: 85 };
      const level = getEnhancedWeatherRiskLevel(ctx);
      expect(level).toBe('extreme');
    });
    
    it('should return "extreme" at exact threshold (80%)', () => {
      const ctx: WeatherRiskContext = { precipitationChance: 80 };
      const level = getEnhancedWeatherRiskLevel(ctx);
      expect(level).toBe('extreme');
    });
    
    it('should handle 100% precipitation chance', () => {
      const ctx: WeatherRiskContext = { precipitationChance: 100 };
      const level = getEnhancedWeatherRiskLevel(ctx);
      expect(level).toBe('extreme');
    });
    
    it('should handle 0% precipitation chance', () => {
      const ctx: WeatherRiskContext = { precipitationChance: 0 };
      const level = getEnhancedWeatherRiskLevel(ctx);
      expect(level).toBe('low');
    });
  });
  
  describe('getEnhancedWeatherRiskLevel - Severe Alert Override', () => {
    
    it('should return "extreme" when severe alert is active regardless of rain', () => {
      const ctx: WeatherRiskContext = {
        precipitationChance: 10,  // Would normally be "low"
        severeAlertActive: true
      };
      const level = getEnhancedWeatherRiskLevel(ctx);
      expect(level).toBe('extreme');
    });
    
    it('should override medium precipitation with severe alert', () => {
      const ctx: WeatherRiskContext = {
        precipitationChance: 40,  // Would be "medium"
        severeAlertActive: true
      };
      const level = getEnhancedWeatherRiskLevel(ctx);
      expect(level).toBe('extreme');
    });
    
    it('should override high precipitation with severe alert (stays extreme)', () => {
      const ctx: WeatherRiskContext = {
        precipitationChance: 70,  // Would be "high"
        severeAlertActive: true
      };
      const level = getEnhancedWeatherRiskLevel(ctx);
      expect(level).toBe('extreme');
    });
  });
  
  describe('getEnhancedWeatherRiskLevel - Thunderstorm Risk Bump', () => {
    
    it('should bump low risk to high when thunderstorm risk exists (minimum high)', () => {
      const ctx: WeatherRiskContext = {
        precipitationChance: 15,  // Would be "low"
        thunderstormRisk: true
      };
      const level = getEnhancedWeatherRiskLevel(ctx);
      expect(level).toBe('high');  // low + 2 levels → high (minimum enforced)
    });
    
    it('should bump medium risk to extreme when thunderstorm risk exists', () => {
      const ctx: WeatherRiskContext = {
        precipitationChance: 25,  // Would be "medium"
        thunderstormRisk: true
      };
      const level = getEnhancedWeatherRiskLevel(ctx);
      expect(level).toBe('extreme');  // medium + 2 levels → extreme
    });
    
    it('should bump high risk to extreme when thunderstorm risk exists', () => {
      const ctx: WeatherRiskContext = {
        precipitationChance: 60,  // "high"
        thunderstormRisk: true
      };
      const level = getEnhancedWeatherRiskLevel(ctx);
      expect(level).toBe('extreme');  // high + 2 levels → extreme (capped)
    });
    
    it('should not change extreme risk when thunderstorm risk exists (already at cap)', () => {
      const ctx: WeatherRiskContext = {
        precipitationChance: 85,  // Already "extreme"
        thunderstormRisk: true
      };
      const level = getEnhancedWeatherRiskLevel(ctx);
      expect(level).toBe('extreme');  // Already capped at extreme
    });
  });
  
  describe('getEnhancedWeatherRiskLevel - High Wind Bump', () => {
    
    it('should bump low to medium when wind > 30 mph', () => {
      const ctx: WeatherRiskContext = {
        precipitationChance: 15,  // "low"
        windSpeedMph: 40
      };
      const level = getEnhancedWeatherRiskLevel(ctx);
      expect(level).toBe('medium');
    });
    
    it('should bump medium to high when wind > 30 mph', () => {
      const ctx: WeatherRiskContext = {
        precipitationChance: 35,  // "medium"
        windSpeedMph: 35
      };
      const level = getEnhancedWeatherRiskLevel(ctx);
      expect(level).toBe('high');
    });
    
    it('should bump high to extreme when wind > 30 mph', () => {
      const ctx: WeatherRiskContext = {
        precipitationChance: 60,  // "high"
        windSpeedMph: 45
      };
      const level = getEnhancedWeatherRiskLevel(ctx);
      expect(level).toBe('extreme');
    });
    
    it('should not bump extreme (capped at extreme)', () => {
      const ctx: WeatherRiskContext = {
        precipitationChance: 85,  // "extreme"
        windSpeedMph: 50
      };
      const level = getEnhancedWeatherRiskLevel(ctx);
      expect(level).toBe('extreme');
    });
    
    it('should not bump risk when wind is exactly 30 mph (not >30)', () => {
      const ctx: WeatherRiskContext = {
        precipitationChance: 15,  // "low"
        windSpeedMph: 30
      };
      const level = getEnhancedWeatherRiskLevel(ctx);
      expect(level).toBe('low');
    });
  });
  
  describe('getEnhancedWeatherRiskLevel - Precipitation Intensity Bump', () => {
    
    it('should bump low to medium when moderate-to-heavy rain intensity (>2.5mm/hr)', () => {
      const ctx: WeatherRiskContext = {
        precipitationChance: 15,  // "low"
        precipitationIntensityMm: 3
      };
      const level = getEnhancedWeatherRiskLevel(ctx);
      expect(level).toBe('medium');  // low + 1 → medium
    });
    
    it('should bump medium to high when heavy rain intensity', () => {
      const ctx: WeatherRiskContext = {
        precipitationChance: 30,  // "medium"
        precipitationIntensityMm: 5
      };
      const level = getEnhancedWeatherRiskLevel(ctx);
      expect(level).toBe('high');  // medium + 1 → high
    });
    
    it('should not bump when light intensity (≤2.5mm/hr)', () => {
      const ctx: WeatherRiskContext = {
        precipitationChance: 30,  // "medium"
        precipitationIntensityMm: 2
      };
      const level = getEnhancedWeatherRiskLevel(ctx);
      expect(level).toBe('medium');  // No bump for light rain
    });
    
    it('should not bump when intensity is exactly 2.5mm/hr (threshold)', () => {
      const ctx: WeatherRiskContext = {
        precipitationChance: 30,  // "medium"
        precipitationIntensityMm: 2.5
      };
      const level = getEnhancedWeatherRiskLevel(ctx);
      expect(level).toBe('medium');  // Threshold not exceeded
    });
    
    it('should bump when intensity is just above threshold (2.6mm/hr)', () => {
      const ctx: WeatherRiskContext = {
        precipitationChance: 15,  // "low"
        precipitationIntensityMm: 2.6
      };
      const level = getEnhancedWeatherRiskLevel(ctx);
      expect(level).toBe('medium');  // low + 1 → medium (threshold exceeded)
    });
  });
  
  describe('getEnhancedWeatherRiskLevel - Combined Factors', () => {
    
    it('should handle thunderstorm + high wind + moderate rain → extreme', () => {
      const ctx: WeatherRiskContext = {
        precipitationChance: 60,  // "high" base
        thunderstormRisk: true,   // bumps by 2 → extreme (capped)
        windSpeedMph: 40          // would bump but already extreme
      };
      const level = getEnhancedWeatherRiskLevel(ctx);
      expect(level).toBe('extreme');
    });
    
    it('should handle severe alert overriding all other factors', () => {
      const ctx: WeatherRiskContext = {
        precipitationChance: 5,   // "low" base
        severeAlertActive: true,  // → "extreme"
        thunderstormRisk: true,   // (ignored, already extreme)
        windSpeedMph: 10          // (ignored, already extreme)
      };
      const level = getEnhancedWeatherRiskLevel(ctx);
      expect(level).toBe('extreme');
    });
    
    it('should handle thunderstorm bumping low + wind bumping to extreme', () => {
      const ctx: WeatherRiskContext = {
        precipitationChance: 10,  // "low"
        thunderstormRisk: true,   // bumps by 2 to "high" (minimum enforced)
        windSpeedMph: 35          // bumps "high" → "extreme"
      };
      const level = getEnhancedWeatherRiskLevel(ctx);
      expect(level).toBe('extreme');
    });
    
    it('should handle all factors together: intensity + thunderstorm + wind', () => {
      const ctx: WeatherRiskContext = {
        precipitationChance: 25,     // "medium"
        precipitationIntensityMm: 8, // +1 → "high"
        thunderstormRisk: true,      // +2 → "extreme" (capped)
        windSpeedMph: 40             // would bump but already capped
      };
      const level = getEnhancedWeatherRiskLevel(ctx);
      expect(level).toBe('extreme');
    });
  });
  
  describe('getEnhancedWeatherSeverityText', () => {
    
    it('should return appropriate text for low risk', () => {
      const result = { level: 'low' as EnhancedWeatherRiskLevel, severityText: '', actionText: '' };
      const text = getEnhancedWeatherSeverityText(result);
      expect(text).toBe('Weather risk is low.');
    });
    
    it('should return appropriate text for medium risk', () => {
      const result = { level: 'medium' as EnhancedWeatherRiskLevel, severityText: '', actionText: '' };
      const text = getEnhancedWeatherSeverityText(result);
      expect(text).toBe('There is a moderate chance of weather affecting this appointment.');
    });
    
    it('should return appropriate text for high risk', () => {
      const result = { level: 'high' as EnhancedWeatherRiskLevel, severityText: '', actionText: '' };
      const text = getEnhancedWeatherSeverityText(result);
      expect(text).toBe('There is a high chance of rain or conditions that may affect outdoor services.');
    });
    
    it('should return appropriate text for extreme risk', () => {
      const result = { level: 'extreme' as EnhancedWeatherRiskLevel, severityText: '', actionText: '' };
      const text = getEnhancedWeatherSeverityText(result);
      expect(text).toBe('Severe weather is likely during this appointment window.');
    });
  });
  
  describe('getEnhancedWeatherActionText', () => {
    
    it('should return appropriate action for low risk', () => {
      const result = { level: 'low' as EnhancedWeatherRiskLevel, severityText: '', actionText: '' };
      const text = getEnhancedWeatherActionText(result);
      expect(text).toBe('No changes are needed based on the current forecast.');
    });
    
    it('should return appropriate action for medium risk', () => {
      const result = { level: 'medium' as EnhancedWeatherRiskLevel, severityText: '', actionText: '' };
      const text = getEnhancedWeatherActionText(result);
      expect(text).toBe('You can keep your current time, but you may want a backup option in mind.');
    });
    
    it('should return appropriate action for high risk', () => {
      const result = { level: 'high' as EnhancedWeatherRiskLevel, severityText: '', actionText: '' };
      const text = getEnhancedWeatherActionText(result);
      expect(text).toBe('We recommend considering a reschedule or moving the appointment to a more flexible time.');
    });
    
    it('should return appropriate action for extreme risk', () => {
      const result = { level: 'extreme' as EnhancedWeatherRiskLevel, severityText: '', actionText: '' };
      const text = getEnhancedWeatherActionText(result);
      expect(text).toBe('We strongly recommend rescheduling to ensure safety and the best results.');
    });
  });
  
  describe('evaluateWeatherRisk - Integration Tests', () => {
    
    it('should return complete risk result for low risk scenario', () => {
      const ctx: WeatherRiskContext = { precipitationChance: 10 };
      const result = evaluateWeatherRisk(ctx);
      
      expect(result.level).toBe('low');
      expect(result.severityText).toBe('Weather risk is low.');
      expect(result.actionText).toBe('No changes are needed based on the current forecast.');
    });
    
    it('should return complete risk result for medium risk scenario', () => {
      const ctx: WeatherRiskContext = { precipitationChance: 40 };
      const result = evaluateWeatherRisk(ctx);
      
      expect(result.level).toBe('medium');
      expect(result.severityText).toBe('There is a moderate chance of weather affecting this appointment.');
      expect(result.actionText).toBe('You can keep your current time, but you may want a backup option in mind.');
    });
    
    it('should return complete risk result for high risk scenario', () => {
      const ctx: WeatherRiskContext = { precipitationChance: 70 };
      const result = evaluateWeatherRisk(ctx);
      
      expect(result.level).toBe('high');
      expect(result.severityText).toBe('There is a high chance of rain or conditions that may affect outdoor services.');
      expect(result.actionText).toBe('We recommend considering a reschedule or moving the appointment to a more flexible time.');
    });
    
    it('should return complete risk result for extreme risk scenario', () => {
      const ctx: WeatherRiskContext = { precipitationChance: 85 };
      const result = evaluateWeatherRisk(ctx);
      
      expect(result.level).toBe('extreme');
      expect(result.severityText).toBe('Severe weather is likely during this appointment window.');
      expect(result.actionText).toBe('We strongly recommend rescheduling to ensure safety and the best results.');
    });
    
    it('should handle complex multi-factor scenario', () => {
      const ctx: WeatherRiskContext = {
        precipitationChance: 55,
        thunderstormRisk: true,
        windSpeedMph: 35,
        temperatureF: 65,
        industryType: 'auto_detailing'
      };
      const result = evaluateWeatherRisk(ctx);
      
      // 55% rain → "high", thunderstorm bumps +2 → "extreme" (capped), wind would bump but already capped
      expect(result.level).toBe('extreme');
      expect(result.severityText).toBeDefined();
      expect(result.actionText).toBeDefined();
    });
    
    it('should provide severe alert-specific messaging when severeAlertActive is true', () => {
      const ctx: WeatherRiskContext = {
        precipitationChance: 30,  // Would normally be "medium"
        severeAlertActive: true   // Forces "extreme" with special messaging
      };
      const result = evaluateWeatherRisk(ctx);
      
      // Severe alert always results in extreme level
      expect(result.level).toBe('extreme');
      // Special severe alert messaging
      expect(result.severityText).toBe('A severe weather alert is in effect for this area.');
      expect(result.actionText).toBe('Please reschedule immediately for safety. Dangerous weather conditions are expected.');
    });
    
    it('should handle empty context gracefully', () => {
      const ctx: WeatherRiskContext = {};
      const result = evaluateWeatherRisk(ctx);
      
      // No data defaults to 0% precipitation → "low"
      expect(result.level).toBe('low');
      expect(result.severityText).toBe('Weather risk is low.');
    });
    
    it('should handle industry type context (future extensibility)', () => {
      const ctx: WeatherRiskContext = {
        precipitationChance: 30,
        industryType: 'lawn_care'
      };
      const result = evaluateWeatherRisk(ctx);
      
      expect(result.level).toBe('medium');
      expect(result.industryType).toBeUndefined(); // Not stored in result, just used for evaluation
    });
  });
  
  describe('Edge Cases and Boundary Conditions', () => {
    
    it('should handle negative precipitation chance (treat as 0)', () => {
      const ctx: WeatherRiskContext = { precipitationChance: -10 };
      const result = evaluateWeatherRisk(ctx);
      
      // Negative treated as very low
      expect(result.level).toBe('low');
    });
    
    it('should handle precipitation > 100% (treat as 100)', () => {
      const ctx: WeatherRiskContext = { precipitationChance: 150 };
      const result = evaluateWeatherRisk(ctx);
      
      // Over 100 still results in extreme
      expect(result.level).toBe('extreme');
    });
    
    it('should handle very low wind speed (< 30 mph)', () => {
      const ctx: WeatherRiskContext = {
        precipitationChance: 10,
        windSpeedMph: 5
      };
      const result = evaluateWeatherRisk(ctx);
      
      expect(result.level).toBe('low');
    });
    
    it('should handle missing optional fields', () => {
      const ctx: WeatherRiskContext = {
        precipitationChance: 50
        // All other fields undefined
      };
      const result = evaluateWeatherRisk(ctx);
      
      expect(result.level).toBe('high');
      expect(result).toHaveProperty('severityText');
      expect(result).toHaveProperty('actionText');
    });
  });
});
