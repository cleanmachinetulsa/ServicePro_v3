import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useSession } from '@/hooks/useSession';
import { useBillingStatus } from '@/hooks/useBillingStatus';
import { AccountSuspendedScreen } from '@/components/billing/AccountSuspendedScreen';

interface AuthGuardProps {
  children: React.ReactNode;
}

const EXEMPT_PATHS = ['/settings/billing', '/support', '/login', '/logout'];

export default function AuthGuard({ children }: AuthGuardProps) {
  const [location, setLocation] = useLocation();
  const { isAuthenticated, isLoading, isError } = useSession();
  const { isSuspended, isLoading: isBillingLoading } = useBillingStatus();

  // Redirect to login when not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation('/login');
    }
  }, [isLoading, isAuthenticated, setLocation]);

  // CRITICAL UX FIX: Only show full-screen spinner on first load (no cached data)
  // On subsequent loads, React Query keeps previous data mounted during revalidation
  // This prevents double-flash by avoiding unmount/remount cycle
  if (isLoading && !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="text-sm text-muted-foreground">Verifying session...</p>
        </div>
      </div>
    );
  }

  // Don't render anything while redirecting
  if (!isAuthenticated) {
    return null;
  }

  // SP-6: Show suspension screen for suspended accounts (except billing/support pages)
  const isExemptPath = EXEMPT_PATHS.some(path => location.startsWith(path));
  if (isSuspended && !isExemptPath && !isBillingLoading) {
    return <AccountSuspendedScreen />;
  }

  return <>{children}</>;
}
