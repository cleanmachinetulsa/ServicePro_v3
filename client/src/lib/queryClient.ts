import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  options?: RequestInit,
): Promise<Response> {
  // Create fetch options with credentials to send cookies
  const fetchOptions: RequestInit = {
    method,
    credentials: "include", // This sends HttpOnly cookies automatically
    ...options,
  };

  // Handle content type and body format
  if (data) {
    // Get content type from options headers or default to 'application/json'
    const contentType = options?.headers && 
      typeof options.headers === 'object' && 
      'Content-Type' in options.headers 
        ? String(options.headers['Content-Type']) 
        : 'application/json';
    
    // Set headers properly
    fetchOptions.headers = {
      ...(fetchOptions.headers as Record<string, string> || {}),
      'Content-Type': contentType
    };
    
    // Format the body based on content type
    if (contentType === 'application/x-www-form-urlencoded') {
      fetchOptions.body = new URLSearchParams(data as Record<string, string>).toString();
    } else {
      fetchOptions.body = JSON.stringify(data);
    }
  }
  
  const res = await fetch(url, fetchOptions);
  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Cookies are sent automatically with credentials: 'include'
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
