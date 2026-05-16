import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';

/**
 * SMS-AUDIT-T1 (S-9): Top-bar banner that surfaces when the server has
 * PLATFORM_BG_JOBS_ENABLED unset in production. Without this banner the
 * staff has no way to know that booking confirmation reminders, auto-cancel,
 * dunning, and health monitors are silently disabled.
 *
 * Polls /api/system/bg-jobs-status every 60s. No auth required (public
 * status endpoint).
 */

interface BgJobsStatus {
  bgJobsEnabled: boolean;
  environment: string;
  silentFeaturesDisabled: string[];
  timestamp: string;
}

export function BgJobsBanner() {
  const { data } = useQuery<BgJobsStatus>({
    queryKey: ['/api/system/bg-jobs-status'],
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  if (!data) return null;
  if (data.bgJobsEnabled) return null;
  // Only loud-warn in production; in development this is the normal default.
  if (data.environment !== 'production') return null;

  return (
    <div
      className="bg-red-600 text-white px-4 py-2 text-sm font-medium flex items-center gap-2"
      role="alert"
      data-testid="banner-bg-jobs-off"
    >
      <AlertTriangle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
      <span className="flex-1">
        Background jobs OFF — bookings will not auto-confirm or auto-cancel,
        and reminders/dunning are paused. Ask an admin to set{' '}
        <code className="px-1 bg-red-700 rounded">PLATFORM_BG_JOBS_ENABLED=1</code>.
      </span>
      {data.silentFeaturesDisabled.length > 0 && (
        <span className="text-xs opacity-80 hidden md:inline">
          ({data.silentFeaturesDisabled.length} features disabled)
        </span>
      )}
    </div>
  );
}
