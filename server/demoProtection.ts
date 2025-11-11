import { Request, Response, NextFunction } from 'express';

// Set to true if you want to enable demo mode restrictions
const DEMO_MODE = process.env.DEMO_MODE === 'true';

/**
 * Check if the request is coming from a demo session
 * and apply appropriate restrictions
 */
export function demoProtectionMiddleware(req: Request, res: Response, next: NextFunction) {
  // Add a header to indicate demo mode
  res.setHeader('X-Demo-Mode', DEMO_MODE ? 'true' : 'false');
  
  // Apply restrictions if in demo mode
  if (DEMO_MODE) {
    // Add rate limiting for demo mode
    const requestsPerMinute = 60;
    const now = Date.now();
    const requestTimestamps = demoRequestTracker.getRequestsForIP(req.ip || 'unknown-ip');
    
    // Remove timestamps older than 1 minute
    const oneMinuteAgo = now - 60 * 1000;
    const recentRequests = requestTimestamps.filter(timestamp => timestamp > oneMinuteAgo);
    
    // Update the request tracker
    demoRequestTracker.setRequestsForIP(req.ip || 'unknown-ip', [...recentRequests, now]);
    
    // Check if too many requests
    if (recentRequests.length >= requestsPerMinute) {
      return res.status(429).json({
        success: false,
        message: 'Too many requests in demo mode. Please try again later or contact us for a full version.'
      });
    }
    
    // Block certain paths in demo mode
    const blockedPaths = [
      '/api/admin',
      '/api/customer/all',
      '/api/system',
      '/api/settings',
      '/api/export'
    ];
    
    if (blockedPaths.some(path => req.path.startsWith(path))) {
      return res.status(403).json({
        success: false,
        message: 'This API endpoint is restricted in demo mode.'
      });
    }
    
    // Add timestamp to track demo session
    res.setHeader('X-Demo-Access-Time', new Date().toISOString());
    
    // Watermark the response with demo tag
    const originalJson = res.json;
    res.json = function(body) {
      if (body && typeof body === 'object') {
        body.demoMode = true;
        body.demoWatermark = 'Clean Machine Auto Detail Demo - Contact for full version';
      }
      return originalJson.call(this, body);
    };
  }
  
  next();
}

/**
 * Simple rate limiting tracker for demo mode
 */
class DemoRequestTracker {
  private requestsByIP: Map<string, number[]> = new Map();
  
  getRequestsForIP(ip: string): number[] {
    return this.requestsByIP.get(ip) || [];
  }
  
  setRequestsForIP(ip: string, timestamps: number[]): void {
    this.requestsByIP.set(ip, timestamps);
  }
  
  clearOldRequests(): void {
    const oneMinuteAgo = Date.now() - 60 * 1000;
    
    this.requestsByIP.forEach((timestamps, ip) => {
      const recentRequests = timestamps.filter(timestamp => timestamp > oneMinuteAgo);
      this.requestsByIP.set(ip, recentRequests);
    });
  }
}

// Initialize the request tracker
const demoRequestTracker = new DemoRequestTracker();

// Clean up old requests every minute
setInterval(() => {
  demoRequestTracker.clearOldRequests();
}, 60 * 1000);

/**
 * Generate a session-specific access token for demo mode
 * This makes it harder to extract and reuse API calls
 */
export function generateDemoAccessToken(): string {
  const timestamp = Date.now();
  const randomPart = Math.random().toString(36).substring(2, 15);
  return `demo_${timestamp}_${randomPart}`;
}

/**
 * Verify if a demo access token is valid
 */
export function verifyDemoAccessToken(token: string): boolean {
  if (!token.startsWith('demo_')) {
    return false;
  }
  
  const parts = token.split('_');
  if (parts.length !== 3) {
    return false;
  }
  
  const timestamp = parseInt(parts[1], 10);
  const now = Date.now();
  const tokenAge = now - timestamp;
  
  // Token is valid for 1 hour
  const maxTokenAge = 60 * 60 * 1000;
  
  return tokenAge < maxTokenAge;
}

/**
 * JavaScript code protection for demo mode
 * This creates an obfuscated and minified version of frontend code
 * which is harder (but not impossible) to reverse engineer
 */
export function applyCodeProtection(code: string): string {
  // In a real implementation, you would use a proper JavaScript obfuscator
  // Here, we're just simulating the concept
  
  // Add license verification calls
  const protectedCode = `
  /* 
   * Clean Machine Auto Detail Demo - Protected Code
   * Copyright ${new Date().getFullYear()}
   * Unauthorized use, copying, or distribution is prohibited
   */
  
  (function() {
    // License verification
    let demoAccess = true;
    const verifyLicense = () => {
      const demoToken = sessionStorage.getItem('demoAccessToken') || '';
      if (!demoToken.startsWith('demo_')) {
        demoAccess = false;
        console.error('Unauthorized access attempt');
        window.location.href = '/demo-expired';
      }
      
      const tokenParts = demoToken.split('_');
      if (tokenParts.length !== 3) {
        demoAccess = false;
        window.location.href = '/demo-invalid';
        return false;
      }
      
      const timestamp = parseInt(tokenParts[1], 10);
      const now = Date.now();
      if (now - timestamp > 3600000) { // 1 hour
        demoAccess = false;
        window.location.href = '/demo-expired';
        return false;
      }
      
      return true;
    };
    
    // Check license every minute
    setInterval(verifyLicense, 60000);
    
    // Original code (would be minified and obfuscated)
    ${code}
    
    // Add watermarks to UI
    const addWatermarks = () => {
      if (demoAccess) {
        const watermark = document.createElement('div');
        watermark.style.position = 'fixed';
        watermark.style.bottom = '10px';
        watermark.style.right = '10px';
        watermark.style.opacity = '0.7';
        watermark.style.zIndex = '9999';
        watermark.style.padding = '5px 10px';
        watermark.style.borderRadius = '3px';
        watermark.style.backgroundColor = 'rgba(0,0,0,0.1)';
        watermark.style.color = '#555';
        watermark.style.fontSize = '12px';
        watermark.style.pointerEvents = 'none';
        watermark.textContent = 'Clean Machine Auto Detail Demo';
        document.body.appendChild(watermark);
      }
    };
    
    // Call once and whenever DOM changes
    addWatermarks();
    new MutationObserver(addWatermarks).observe(document.body, { childList: true, subtree: true });
    
  })();
  `;
  
  return protectedCode;
}