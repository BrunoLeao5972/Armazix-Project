// Cliente HTTP fino pra API Cloud do Armazix. Autenticação via Bearer
// (/api/auth/login-desktop) — não cookie, porque o Electron não é o mesmo
// "site" de armazix.com.br pra fins de SameSite. Ver o handler no backend
// (src/lib/api/auth/login-handler.ts) pra mais contexto.

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://armazix.com.br";

let authToken: string | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

export class ApiRequestError extends Error {
  status: number;
  data: unknown;
  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.data = data;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("content-type", "application/json");
  if (authToken) headers.set("Authorization", `Bearer ${authToken}`);

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  } catch {
    throw new ApiRequestError("Sem conexão com o servidor", 0, null);
  }

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok) {
    throw new ApiRequestError((data.error as string) || `Erro ${res.status}`, res.status, data);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string): Promise<T> => request<T>(path, { method: "GET" }),
  post: <T>(path: string, body?: unknown): Promise<T> =>
    request<T>(path, { method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined }),
};

/** Prova que o Worker está respondendo — não confunde "internet ligada" com "API de pé". */
export async function pingHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/health`, { method: "GET" });
    return res.ok;
  } catch {
    return false;
  }
}
