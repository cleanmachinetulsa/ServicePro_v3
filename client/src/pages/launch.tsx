import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { detectIsPhone } from '@/hooks/use-mobile';

/**
 * Smart Launch Router - Entry point for PWA
 * 
 * Routes devices based on device type:
 * - Phones → /messages (mobile-first messaging experience)
 * - Tablets/Desktops → /dashboard (full dashboard view)
 * 
 * This route is set as the PWA manifest start_url to provide
 * a consistent experience when launching from home screen.
 */
export default function LaunchPage() {
  const [, setLocation] = useLocation();
  const [isDetecting, setIsDetecting] = useState(true);

  useEffect(() => {
    // Use requestAnimationFrame to ensure DOM is ready for accurate detection
    requestAnimationFrame(() => {
      const isPhone = detectIsPhone();
      const destination = isPhone ? '/messages' : '/dashboard';
      
      console.log(`[LAUNCH] Device detection: isPhone=${isPhone}, width=${window.innerWidth}`);
      console.log(`[LAUNCH] Redirecting to ${destination}`);
      
      setIsDetecting(false);
      setLocation(destination);
    });
  }, [setLocation]);

  // Show minimal loading state during redirect
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="text-sm text-muted-foreground animate-pulse">
          {isDetecting ? 'Detecting device...' : 'Loading your workspace...'}
        </p>
      </div>
    </div>
  );
}
