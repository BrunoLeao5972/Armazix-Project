// API client utilities with CSRF protection
// Use this instead of raw fetch for protected API calls

export function getCsrfToken(): string | null {
  // Read directly from the non-HttpOnly csrf_token cookie (double-submit pattern)
  if (typeof document !== "undefined") {
    const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
    if (match) return decodeURIComponent(match[1]);
  }
  return localStorage.getItem("csrf_token");
}

async function refreshCsrfToken(): Promise<string | null> {
  try {
    const res = await fetch("/api/auth/refresh-csrf", { credentials: "include" });
    if (res.ok) {
      const data = await res.json();
      if (data.csrfToken) {
        localStorage.setItem("csrf_token", data.csrfToken);
        return data.csrfToken;
      }
    }
  } catch { /* ignore */ }
  return null;
}

interface FetchOptions extends RequestInit {
  skipCsrf?: boolean; // Skip CSRF for public routes
  _csrfRetried?: boolean; // Internal: prevent infinite retry loop
}

export async function apiFetch(url: string, options: FetchOptions = {}): Promise<Response> {
  const { skipCsrf = false, _csrfRetried = false, headers = {}, ...rest } = options;

  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...headers as Record<string, string>,
  };

  // Add CSRF token for non-GET requests; auto-refresh if cookie is missing
  if (!skipCsrf && options.method && options.method !== "GET") {
    let csrfToken = getCsrfToken();
    if (!csrfToken) {
      csrfToken = await refreshCsrfToken();
    }
    if (csrfToken) {
      requestHeaders["x-csrf-token"] = csrfToken;
    }
  }

  const response = await fetch(url, {
    ...rest,
    credentials: "include",
    headers: requestHeaders,
  });

  // Auto-retry once on CSRF error: refresh token and re-send (handles sessions
  // where the csrf_token cookie was never set due to a previous bug)
  if (response.status === 403 && !skipCsrf && !_csrfRetried && options.method !== "GET") {
    const body = await response.clone().json().catch(() => ({})) as { error?: string };
    if (body.error?.includes("CSRF")) {
      const newToken = await refreshCsrfToken();
      if (newToken) {
        return apiFetch(url, { ...options, _csrfRetried: true });
      }
    }
  }

  return response;
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
