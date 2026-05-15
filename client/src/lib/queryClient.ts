import { QueryClient, QueryFunction } from "@tanstack/react-query";

// Paths that should never trigger an auth redirect, even on 401.
// (login, public marketing pages, public booking, public APIs, etc.)
const PUBLIC_PATH_PREFIXES = [
  "/login",
  "/logout",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/auth",
  "/book",
  "/booking",
  "/quote",
  "/pricing",
  "/about",
  "/contact",
  "/services",
  "/gallery",
  "/reviews",
  "/referral",
  "/rewards",
  "/loyalty",
  "/portal",
  "/support",
  "/legal",
  "/terms",
  "/privacy",
  "/", // root marketing site
];

function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PATH_PREFIXES.some(
    (p) => p !== "/" && (pathname === p || pathname.startsWith(p + "/")),
  );
}

let redirecting = false;
function redirectToLoginOnce() {
  if (redirecting) return;
  if (typeof window === "undefined") return;
  const { pathname, search, hash } = window.location;
  // Don't bounce users who are already on a public page or login.
  if (isPublicPath(pathname)) return;
  redirecting = true;
  const next = encodeURIComponent(pathname + search + hash);
  window.location.assign(`/login?next=${next}`);
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    if (res.status === 401) {
      redirectToLoginOnce();
    }
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
    const url = queryKey[0] as string;
    const res = await fetch(url, {
      credentials: "include",
    });

    if (res.status === 401) {
      // The session-verify endpoint must NOT trigger a redirect — it's the
      // very check AuthGuard uses to decide whether to redirect itself.
      // Same for any caller that explicitly opts into "returnNull" handling.
      if (
        unauthorizedBehavior !== "returnNull" &&
        url !== "/api/auth/verify"
      ) {
        redirectToLoginOnce();
      }
      if (unauthorizedBehavior === "returnNull") {
        return null;
      }
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
