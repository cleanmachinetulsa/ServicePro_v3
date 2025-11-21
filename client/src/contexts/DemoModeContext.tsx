/**
 * Demo Mode Context Provider
 * Manages demo mode state and intercepts API requests to return mock data
 */

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { getMockData } from '@/demo/fixtures';

interface DemoModeContextType {
  isDemoMode: boolean;
  demoSessionExpired: boolean;
  checkDemoStatus: () => Promise<void>;
}

const DemoModeContext = createContext<DemoModeContextType | undefined>(undefined);

export function useDemoMode() {
  const context = useContext(DemoModeContext);
  if (!context) {
    throw new Error('useDemoMode must be used within DemoModeProvider');
  }
  return context;
}

interface DemoModeProviderProps {
  children: ReactNode;
}

export function DemoModeProvider({ children }: DemoModeProviderProps) {
  const { toast } = useToast();
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [demoSessionExpired, setDemoSessionExpired] = useState(false);

  // Create a custom QueryClient for demo mode with request interception
  const demoQueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5, // 5 minutes
        retry: false,
        queryFn: async ({ queryKey }) => {
          if (!isDemoMode) {
            // Not in demo mode, use normal fetch
            const url = queryKey[0] as string;
            const res = await fetch(url, { credentials: 'include' });
            
            if (!res.ok) {
              throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }
            
            return res.json();
          }

          // Demo mode: Return mock data
          const url = queryKey[0] as string;
          console.log('[DEMO MODE] Intercepting GET request:', url);

          // Parse URL to determine what mock data to return
          if (url.includes('/api/customers')) {
            if (url.match(/\/api\/customers\/\d+$/)) {
              const id = parseInt(url.split('/').pop() || '1');
              return { success: true, customer: getMockData('customer', { id }) };
            }
            return { success: true, customers: getMockData('customers') };
          }

          if (url.includes('/api/conversations') || url.includes('/api/messages')) {
            if (url.match(/\/api\/conversations\/\d+$/)) {
              const id = parseInt(url.split('/').pop() || '1');
              return { success: true, conversation: getMockData('conversation', { id }) };
            }
            return { success: true, conversations: getMockData('conversations') };
          }

          if (url.includes('/api/appointments')) {
            if (url.match(/\/api\/appointments\/\d+$/)) {
              const id = parseInt(url.split('/').pop() || '1');
              return { success: true, appointment: getMockData('appointment', { id }) };
            }
            return { success: true, appointments: getMockData('appointments') };
          }

          if (url.includes('/api/analytics')) {
            return { success: true, analytics: getMockData('analytics') };
          }

          if (url.includes('/api/services')) {
            return { success: true, services: getMockData('services') };
          }

          if (url.includes('/api/loyalty')) {
            return { success: true, transactions: getMockData('loyalty') };
          }

          if (url.includes('/api/referrals')) {
            return { success: true, referrals: getMockData('referrals') };
          }

          if (url.includes('/api/voicemails')) {
            return { success: true, voicemails: getMockData('voicemails') };
          }

          if (url.includes('/api/calls')) {
            return { success: true, calls: getMockData('callLogs') };
          }

          if (url.includes('/api/technician/schedule')) {
            return { success: true, schedules: getMockData('technicianSchedules') };
          }

          if (url.includes('/api/payments')) {
            return { success: true, payments: getMockData('payments') };
          }

          if (url.includes('/api/dashboard')) {
            return { success: true, ...getMockData('dashboard') };
          }

          if (url.includes('/api/users/me')) {
            return { 
              success: true, 
              user: { 
                id: 999, 
                username: 'demo_user', 
                role: 'manager',
                fullName: 'Demo User',
                email: 'demo@acmedetailing.com',
              } 
            };
          }

          // Default response for unhandled routes
          return { success: true, demoMode: true, data: [] };
        },
      },
      mutations: {
        retry: false,
        mutationFn: async ({ url, method, body }: any) => {
          if (!isDemoMode) {
            // Not in demo mode, perform real request
            const res = await fetch(url, {
              method,
              headers: { 'Content-Type': 'application/json' },
              body: body ? JSON.stringify(body) : undefined,
              credentials: 'include',
            });

            if (!res.ok) {
              const errorData = await res.json();
              throw new Error(errorData.message || `HTTP ${res.status}`);
            }

            return res.json();
          }

          // Demo mode: Simulate success without making real request
          console.log(`[DEMO MODE] Intercepting ${method} request:`, url);
          
          // Show toast notification
          toast({
            title: "Demo Mode",
            description: "This action was simulated. No real data was changed.",
            duration: 3000,
          });

          // Return mock success response
          return {
            success: true,
            demoMode: true,
            message: 'Operation simulated successfully',
            data: {
              id: Math.floor(Math.random() * 10000),
              created: true,
            },
          };
        },
      },
    },
  });

  const checkDemoStatus = async () => {
    try {
      // Check session to see if we're in demo mode
      const res = await fetch('/api/users/me', { credentials: 'include' });
      
      if (res.ok) {
        const data = await res.json();
        // If this is a real user session, we're not in demo mode
        setIsDemoMode(false);
      } else {
        // Check if we have a demo session
        // In a real implementation, you'd check req.session.isDemo on the backend
        // For now, we'll assume demo mode based on URL
        const isDemoRoute = window.location.pathname.startsWith('/demo');
        setIsDemoMode(isDemoRoute);
      }
    } catch (error) {
      console.error('[DEMO MODE] Error checking demo status:', error);
      setIsDemoMode(false);
    }
  };

  useEffect(() => {
    checkDemoStatus();

    // Check demo session expiry every minute
    const interval = setInterval(() => {
      if (isDemoMode) {
        // Check if session is expired
        fetch('/api/users/me', { credentials: 'include' })
          .then(res => {
            if (!res.ok) {
              setDemoSessionExpired(true);
              toast({
                title: "Demo Session Expired",
                description: "Your demo session has expired. Please start a new demo.",
                variant: "destructive",
                duration: 10000,
              });
            }
          });
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [isDemoMode]);

  return (
    <DemoModeContext.Provider value={{ isDemoMode, demoSessionExpired, checkDemoStatus }}>
      <QueryClientProvider client={demoQueryClient}>
        {children}
      </QueryClientProvider>
    </DemoModeContext.Provider>
  );
}
