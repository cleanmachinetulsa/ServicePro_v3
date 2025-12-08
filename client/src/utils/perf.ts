/**
 * SP-23: Performance Monitoring Utility
 * Reports Web Vitals and custom performance metrics
 */

interface WebVitalMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
}

interface PerformanceEntry {
  metric: string;
  value: number;
  rating: string;
  timestamp: number;
  userAgent: string;
  url: string;
}

// Thresholds based on Google's Core Web Vitals
const THRESHOLDS = {
  LCP: { good: 2500, poor: 4000 }, // Largest Contentful Paint
  FID: { good: 100, poor: 300 },   // First Input Delay
  CLS: { good: 0.1, poor: 0.25 },  // Cumulative Layout Shift
  FCP: { good: 1800, poor: 3000 }, // First Contentful Paint
  TTFB: { good: 800, poor: 1800 }, // Time to First Byte
  INP: { good: 200, poor: 500 },   // Interaction to Next Paint
};

function getRating(metric: string, value: number): 'good' | 'needs-improvement' | 'poor' {
  const threshold = THRESHOLDS[metric as keyof typeof THRESHOLDS];
  if (!threshold) return 'good';
  
  if (value <= threshold.good) return 'good';
  if (value > threshold.poor) return 'poor';
  return 'needs-improvement';
}

// Buffer for batching performance reports
let perfBuffer: PerformanceEntry[] = [];
let flushTimeout: NodeJS.Timeout | null = null;

async function flushPerfLogs() {
  if (perfBuffer.length === 0) return;
  
  const entries = [...perfBuffer];
  perfBuffer = [];
  
  try {
    await fetch('/api/perf/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries }),
      credentials: 'include',
    });
  } catch (error) {
    // Silently fail - perf logging shouldn't break the app
    console.debug('[PERF] Failed to send performance logs:', error);
  }
}

function scheduleFlush() {
  if (flushTimeout) return;
  
  // Flush after 5 seconds or when buffer is full
  flushTimeout = setTimeout(() => {
    flushTimeout = null;
    flushPerfLogs();
  }, 5000);
}

function logMetric(metric: WebVitalMetric) {
  const entry: PerformanceEntry = {
    metric: metric.name,
    value: metric.value,
    rating: metric.rating,
    timestamp: Date.now(),
    userAgent: navigator.userAgent,
    url: window.location.pathname,
  };
  
  perfBuffer.push(entry);
  
  // Log to console in development
  if (import.meta.env.DEV) {
    const color = metric.rating === 'good' ? 'green' : metric.rating === 'poor' ? 'red' : 'orange';
    console.log(
      `%c[PERF] ${metric.name}: ${metric.value.toFixed(2)} (${metric.rating})`,
      `color: ${color}; font-weight: bold;`
    );
  }
  
  // Schedule flush if buffer has items
  if (perfBuffer.length >= 10) {
    flushPerfLogs();
  } else {
    scheduleFlush();
  }
}

/**
 * Report Core Web Vitals using the web-vitals library pattern
 * Note: This uses the PerformanceObserver API directly to avoid adding dependencies
 */
export function reportWebVitals(onPerfEntry?: (metric: WebVitalMetric) => void) {
  if (typeof window === 'undefined') return;

  const callback = onPerfEntry || logMetric;

  // First Contentful Paint (FCP)
  try {
    const fcpObserver = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        if (entry.name === 'first-contentful-paint') {
          const value = entry.startTime;
          callback({
            name: 'FCP',
            value,
            rating: getRating('FCP', value),
            delta: value,
            id: `fcp-${Date.now()}`,
          });
        }
      }
    });
    fcpObserver.observe({ type: 'paint', buffered: true });
  } catch (e) {
    // Observer not supported
  }

  // Largest Contentful Paint (LCP)
  try {
    const lcpObserver = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      const lastEntry = entries[entries.length - 1];
      if (lastEntry) {
        const value = lastEntry.startTime;
        callback({
          name: 'LCP',
          value,
          rating: getRating('LCP', value),
          delta: value,
          id: `lcp-${Date.now()}`,
        });
      }
    });
    lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
  } catch (e) {
    // Observer not supported
  }

  // Time to First Byte (TTFB)
  try {
    const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    if (navEntries.length > 0) {
      const nav = navEntries[0];
      const value = nav.responseStart - nav.requestStart;
      callback({
        name: 'TTFB',
        value,
        rating: getRating('TTFB', value),
        delta: value,
        id: `ttfb-${Date.now()}`,
      });
    }
  } catch (e) {
    // Navigation timing not available
  }

  // Cumulative Layout Shift (CLS)
  try {
    let clsValue = 0;
    const clsObserver = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        if (!(entry as any).hadRecentInput) {
          clsValue += (entry as any).value;
        }
      }
      callback({
        name: 'CLS',
        value: clsValue,
        rating: getRating('CLS', clsValue),
        delta: clsValue,
        id: `cls-${Date.now()}`,
      });
    });
    clsObserver.observe({ type: 'layout-shift', buffered: true });
  } catch (e) {
    // Observer not supported
  }

  // First Input Delay (FID) / Interaction to Next Paint (INP)
  try {
    const fidObserver = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        const value = (entry as any).processingStart - entry.startTime;
        callback({
          name: 'FID',
          value,
          rating: getRating('FID', value),
          delta: value,
          id: `fid-${Date.now()}`,
        });
      }
    });
    fidObserver.observe({ type: 'first-input', buffered: true });
  } catch (e) {
    // Observer not supported
  }
}

/**
 * Custom performance timing for specific operations
 */
export function startTiming(label: string): () => void {
  const start = performance.now();
  
  return () => {
    const duration = performance.now() - start;
    logMetric({
      name: `CUSTOM_${label}`,
      value: duration,
      rating: duration < 100 ? 'good' : duration < 500 ? 'needs-improvement' : 'poor',
      delta: duration,
      id: `${label}-${Date.now()}`,
    });
  };
}

/**
 * Mark a performance milestone
 */
export function markMilestone(name: string) {
  try {
    performance.mark(name);
    if (import.meta.env.DEV) {
      console.log(`[PERF] Milestone: ${name}`);
    }
  } catch (e) {
    // Performance API not available
  }
}

/**
 * Measure time between two milestones
 */
export function measureBetween(name: string, startMark: string, endMark: string) {
  try {
    performance.measure(name, startMark, endMark);
    const measures = performance.getEntriesByName(name, 'measure');
    if (measures.length > 0) {
      const duration = measures[0].duration;
      logMetric({
        name: `MEASURE_${name}`,
        value: duration,
        rating: duration < 100 ? 'good' : duration < 500 ? 'needs-improvement' : 'poor',
        delta: duration,
        id: `measure-${name}-${Date.now()}`,
      });
    }
  } catch (e) {
    // Performance API not available
  }
}

// Flush on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', flushPerfLogs);
  window.addEventListener('pagehide', flushPerfLogs);
}
