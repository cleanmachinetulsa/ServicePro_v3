import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const [, setLocation] = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const verifySession = async () => {
      try {
        // Session cookie is sent automatically with credentials: 'include'
        const response = await fetch('/api/auth/verify', {
          credentials: 'include',
        });

        if (response.ok) {
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
          setLocation('/login');
        }
      } catch (error) {
        console.error('Auth verification error:', error);
        setIsAuthenticated(false);
        setLocation('/login');
      }
    };

    verifySession();
  }, [setLocation]);

  // Show loading state while checking authentication
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return isAuthenticated ? <>{children}</> : null;
}
