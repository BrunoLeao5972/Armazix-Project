// API client utilities with CSRF protection
// Use this instead of raw fetch for protected API calls

export function getCsrfToken(): string | null {
  return localStorage.getItem("csrf_token");
}

interface FetchOptions extends RequestInit {
  skipCsrf?: boolean; // Skip CSRF for public routes
}

export async function apiFetch(url: string, options: FetchOptions = {}): Promise<Response> {
  const { skipCsrf = false, headers = {}, ...rest } = options;
  
  // Prepare headers
  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...headers as Record<string, string>,
  };
  
  // Add CSRF token for non-GET requests on protected routes
  if (!skipCsrf && options.method && options.method !== "GET") {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      requestHeaders["x-csrf-token"] = csrfToken;
    }
  }
  
  return fetch(url, {
    ...rest,
    credentials: "include", // Always include cookies
    headers: requestHeaders,
  });
}

// Convenience methods
export const api = {
  get: (url: string, options?: FetchOptions) => 
    apiFetch(url, { ...options, method: "GET" }),
  
  post: (url: string, body: unknown, options?: FetchOptions) => 
    apiFetch(url, { ...options, method: "POST", body: JSON.stringify(body) }),
  
  put: (url: string, body: unknown, options?: FetchOptions) => 
    apiFetch(url, { ...options, method: "PUT", body: JSON.stringify(body) }),
  
  delete: (url: string, options?: FetchOptions) => 
    apiFetch(url, { ...options, method: "DELETE" }),
};
