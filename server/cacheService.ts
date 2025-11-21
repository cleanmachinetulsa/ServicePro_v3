/**
 * Simple in-memory cache service with TTL support
 * This significantly improves dashboard load times by caching Google Calendar/Sheets API calls
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class CacheService {
  private cache: Map<string, CacheEntry<any>> = new Map();

  /**
   * Get cached data if available and not expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }

  /**
   * Set cache entry with TTL in seconds
   */
  set<T>(key: string, data: T, ttlSeconds: number): void {
    const expiresAt = Date.now() + (ttlSeconds * 1000);
    this.cache.set(key, { data, expiresAt });
  }

  /**
   * Invalidate cache entries by key pattern
   */
  invalidate(keyPattern: string): void {
    const keysToDelete: string[] = [];
    
    for (const key of this.cache.keys()) {
      if (key.includes(keyPattern)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Export singleton instance
export const cacheService = new CacheService();

// Cache key builders for consistency
export const CacheKeys = {
  dashboardToday: (date: string) => `dashboard:today:${date}`,
  dashboardAppointmentCounts: (year: number, month: number) => `dashboard:counts:${year}-${month}`,
  dashboardWeather: (days: number) => `dashboard:weather:${days}`,
  dashboardMessages: () => `dashboard:messages`,
  calendarEvents: (timeMin: string, timeMax: string) => `calendar:events:${timeMin}:${timeMax}`,
};

/**
 * Helper function to invalidate all appointment-related caches
 * IMPORTANT: Call this after ANY operation that modifies appointments:
 * - Creating new appointments (handleBook)
 * - Canceling appointments
 * - Rescheduling appointments  
 * - Updating appointment details
 * - Any Google Calendar modifications
 * 
 * This ensures the dashboard always shows fresh data after mutations.
 */
export function invalidateAppointmentCaches() {
  console.log('[CACHE] Invalidating all appointment-related caches');
  cacheService.invalidate('dashboard:today');
  cacheService.invalidate('dashboard:counts');
  cacheService.invalidate('calendar:events');
}

// Default TTL values (in seconds)
export const CacheTTL = {
  SHORT: 60,        // 1 minute - for frequently changing data
  MEDIUM: 300,      // 5 minutes - for moderately changing data
  LONG: 900,        // 15 minutes - for rarely changing data
  WEATHER: 3600,    // 1 hour - weather doesn't change that often
};

console.log('[CACHE] Cache service initialized');
