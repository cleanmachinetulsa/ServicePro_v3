import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { AlertCircle, LogOut, UserCircle } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';

interface AuthContext {
  success: boolean;
  user: {
    id: number;
    username: string;
    role: string;
  };
  impersonation: {
    isActive: boolean;
    tenantId: string | null;
    tenantName: string | null;
    startedAt: string | null;
  };
}

export function ImpersonationBanner() {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const { data: authContext } = useQuery<AuthContext>({
    queryKey: ['/api/auth/context'],
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
  });

  const exitImpersonationMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/admin/impersonate/stop');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/context'] });
      toast({
        title: 'Impersonation Ended',
        description: 'You are now viewing the app as yourself',
      });
      navigate('/admin/tenants');
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to exit impersonation',
        variant: 'destructive',
      });
    },
  });

  const handleExitImpersonation = () => {
    exitImpersonationMutation.mutate();
  };

  if (!authContext?.impersonation?.isActive) {
    return null;
  }

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-amber-500 to-orange-500 dark:from-amber-600 dark:to-orange-600 text-white shadow-lg border-b-4 border-amber-700 dark:border-amber-800"
      data-testid="impersonation-banner"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-lg">
              <AlertCircle className="w-5 h-5" />
              <span className="font-semibold text-sm uppercase tracking-wide">
                Impersonation Active
              </span>
            </div>
            
            <div className="hidden sm:flex items-center gap-2">
              <UserCircle className="w-4 h-4" />
              <span className="text-sm font-medium">
                Viewing as: <strong>{authContext.impersonation.tenantName}</strong>
              </span>
              <span className="text-xs opacity-80">
                ({authContext.impersonation.tenantId})
              </span>
            </div>
          </div>

          <Button
            onClick={handleExitImpersonation}
            disabled={exitImpersonationMutation.isPending}
            variant="secondary"
            size="sm"
            className="bg-white hover:bg-gray-100 text-orange-600 font-semibold shadow-md"
            data-testid="button-exit-impersonation"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Exit Impersonation
          </Button>
        </div>

        <div className="sm:hidden pb-2">
          <div className="flex items-center gap-2 text-sm">
            <UserCircle className="w-4 h-4" />
            <span className="font-medium">
              Viewing as: <strong>{authContext.impersonation.tenantName}</strong>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
