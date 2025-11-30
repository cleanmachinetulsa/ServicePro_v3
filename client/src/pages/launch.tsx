import { useEffect } from 'react';
import { useLocation } from 'wouter';

/**
 * Smart Launch Router - Entry point for PWA
 * 
 * Routes all devices to the messages hub for consistent experience.
 * Users can manually navigate to technician page if needed.
 * 
 * This route is set as the PWA manifest start_url to provide
 * a consistent experience when launching from home screen.
 */
export default function LaunchPage() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    console.log('[LAUNCH] Redirecting to /messages');
    setLocation('/messages');
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
