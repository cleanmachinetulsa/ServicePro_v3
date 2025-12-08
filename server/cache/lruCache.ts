/**
 * SP-23: LRU Cache Layer for tenant config data
 * Provides TTL-based caching with LRU eviction for frequently accessed data
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  lastAccessed: number;
}

class LRUCache<T = unknown> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private readonly maxSize: number;
  private readonly defaultTTL: number;

  constructor(options: { maxSize?: number; defaultTTL?: number } = {}) {
    this.maxSize = options.maxSize || 1000;
    this.defaultTTL = options.defaultTTL || 60000; // 60 seconds default
  }

  /**
   * Get a value from cache
   */
  get<V = T>(key: string): V | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Update last accessed time (LRU)
    entry.lastAccessed = Date.now();
    
    // Move to end of map (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value as unknown as V;
  }

  /**
   * Set a value in cache with optional TTL
   */
  set<V = T>(key: string, value: V, ttl?: number): void {
    const now = Date.now();
    const expiresAt = now + (ttl || this.defaultTTL);

    // Check if we need to evict
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, {
      value: value as unknown as T,
      expiresAt,
      lastAccessed: now,
    });
  }

  /**
   * Delete a specific key
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all entries matching a prefix
   */
  clearPrefix(prefix: string): number {
    let cleared = 0;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        cleared++;
      }
    }
    return cleared;
  }

  /**
   * Clear all entries for a specific tenant
   */
  clearTenant(tenantId: string): number {
    return this.clearPrefix(`tenant:${tenantId}:`);
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache stats
   */
  stats(): { size: number; maxSize: number; keys: string[] } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * Check if a key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Evict the least recently used entry
   */
  private evictLRU(): void {
    // The first entry in the map is the oldest (least recently used)
    const firstKey = this.cache.keys().next().value;
    if (firstKey) {
      this.cache.delete(firstKey);
    }
  }

  /**
   * Clean up expired entries (run periodically)
   */
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    return cleaned;
  }
}

// Cache instances for different data types
const CACHE_TTL = {
  tenantConfig: 30000,      // 30 seconds for tenant config
  aiConfig: 60000,          // 60 seconds for AI config
  ivrConfig: 120000,        // 2 minutes for IVR config
  usageSummary: 30000,      // 30 seconds for usage
  publicSiteConfig: 60000,  // 60 seconds for public site
  bootstrap: 30000,         // 30 seconds for bootstrap data
};

// Single global cache instance
const globalCache = new LRUCache({ maxSize: 5000, defaultTTL: 60000 });

// Helper functions for common cache patterns
export function getTenantConfig<T>(tenantId: string): T | null {
  return globalCache.get<T>(`tenant:${tenantId}:config`);
}

export function setTenantConfig<T>(tenantId: string, config: T): void {
  globalCache.set(`tenant:${tenantId}:config`, config, CACHE_TTL.tenantConfig);
}

export function getAiConfig<T>(tenantId: string): T | null {
  return globalCache.get<T>(`tenant:${tenantId}:aiConfig`);
}

export function setAiConfig<T>(tenantId: string, config: T): void {
  globalCache.set(`tenant:${tenantId}:aiConfig`, config, CACHE_TTL.aiConfig);
}

export function getIvrConfig<T>(tenantId: string): T | null {
  return globalCache.get<T>(`tenant:${tenantId}:ivrConfig`);
}

export function setIvrConfig<T>(tenantId: string, config: T): void {
  globalCache.set(`tenant:${tenantId}:ivrConfig`, config, CACHE_TTL.ivrConfig);
}

export function getUsageSummary<T>(tenantId: string): T | null {
  return globalCache.get<T>(`tenant:${tenantId}:usageSummary`);
}

export function setUsageSummary<T>(tenantId: string, summary: T): void {
  globalCache.set(`tenant:${tenantId}:usageSummary`, summary, CACHE_TTL.usageSummary);
}

export function getPublicSiteConfig<T>(tenantId: string): T | null {
  return globalCache.get<T>(`tenant:${tenantId}:publicSite`);
}

export function setPublicSiteConfig<T>(tenantId: string, config: T): void {
  globalCache.set(`tenant:${tenantId}:publicSite`, config, CACHE_TTL.publicSiteConfig);
}

export function getBootstrapData<T>(tenantId: string): T | null {
  return globalCache.get<T>(`tenant:${tenantId}:bootstrap`);
}

export function setBootstrapData<T>(tenantId: string, data: T): void {
  globalCache.set(`tenant:${tenantId}:bootstrap`, data, CACHE_TTL.bootstrap);
}

// Invalidation helpers
export function invalidateTenantCache(tenantId: string): number {
  console.log(`[LRU CACHE] Invalidating all cache for tenant: ${tenantId}`);
  return globalCache.clearTenant(tenantId);
}

export function invalidateAllCache(): void {
  console.log('[LRU CACHE] Clearing entire cache');
  globalCache.clear();
}

// Start periodic cleanup (every 5 minutes)
setInterval(() => {
  const cleaned = globalCache.cleanup();
  if (cleaned > 0) {
    console.log(`[LRU CACHE] Cleanup: removed ${cleaned} expired entries`);
  }
}, 300000);

// Export for direct access if needed
export { globalCache, LRUCache, CACHE_TTL };
