import { useQuery, useQueryClient } from '@tanstack/react-query';

export function useSession() {
  const queryClient = useQueryClient();
  
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/auth/verify'],
    queryFn: async () => {
      const response = await fetch('/api/auth/verify', {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Not authenticated');
      }
      return response.json();
    },
    staleTime: 0, // Always revalidate for security
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 min
    refetchOnMount: 'always', // Force revalidation on every mount
    retry: false, // Don't retry on auth failures
  });

  const status = isLoading ? 'loading' : error ? 'unauthenticated' : 'authenticated';
  const user = data?.success ? { userId: data.userId } : null;
  
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/auth/verify'] });
  };

  return {
    status,
    user,
    invalidate,
    isAuthenticated: data?.success === true,
    isLoading,
    isError: !!error,
  };
}
