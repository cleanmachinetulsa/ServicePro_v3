import { useEffect } from 'react';
import { useLocation } from 'wouter';

/**
 * Smart Launch Router - Device-aware entry point for PWA
 * 
 * Detects device type and routes to optimal destination:
 * - Mobile phones → /messages (primary communication hub)
 * - iPad/tablets → /technician (technician workflow interface)
 * - Fallback → /messages (default for unknown devices)
 * 
 * This route is set as the PWA manifest start_url to provide
 * device-appropriate experiences when launching from home screen.
 */
export default function LaunchPage() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Device detection using User Agent
    const userAgent = navigator.userAgent.toLowerCase();
    
    // iPad detection (includes iPad Pro, iPad Air, iPad Mini)
    const isIPad = /ipad/.test(userAgent) || 
                   (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    
    // Android tablet detection (screen width + user agent)
    const isAndroidTablet = /android/.test(userAgent) && 
                            !/mobile/.test(userAgent) &&
                            window.innerWidth >= 768;
    
    // General tablet detection (fallback for other tablets)
    const isTablet = isIPad || isAndroidTablet || window.innerWidth >= 768;
    
    console.log('[LAUNCH] Device detection:', {
      userAgent: navigator.userAgent,
      isIPad,
      isAndroidTablet,
      isTablet,
      screenWidth: window.innerWidth,
      platform: navigator.platform,
      maxTouchPoints: navigator.maxTouchPoints
    });

    // Route based on device type
    if (isIPad || isTablet) {
      console.log('[LAUNCH] iPad/Tablet detected → redirecting to /technician');
      setLocation('/technician');
    } else {
      console.log('[LAUNCH] Mobile phone detected → redirecting to /messages');
      setLocation('/messages');
    }
  }, [setLocation]);

  // Show minimal loading state during redirect
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="text-sm text-muted-foreground animate-pulse">Loading your workspace...</p>
      </div>
    </div>
  );
}
