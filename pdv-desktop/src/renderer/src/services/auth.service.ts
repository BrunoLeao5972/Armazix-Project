// Login online-primeiro-depois-offline, exatamente como pedido:
//  1. Primeiro acesso (precisa estar online): valida na API Cloud, guarda um
//     verificador de senha local (nunca a senha, nunca o hash do servidor) e
//     os dados da loja.
//  2. Acessos seguintes: se a API não responder, cai pro cache local sem
//     bloquear o operador.
import { getDatabase } from "../db/database";
import { api, setAuthToken, ApiRequestError } from "./api";
import { hashPasswordForOfflineLogin, verifyPasswordOffline } from "../lib/crypto";

export interface AuthSession {
  userId: string;
  name: string;
  email: string;
  role: string;
  storeId: string;
  storeName: string;
  storeSlug: string;
  /** null quando a sessão foi resolvida offline — sem token não dá pra sincronizar ainda. */
  token: string | null;
}

interface LoginDesktopResponse {
  success: true;
  token: string;
  user: { id: string; name: string; email: string; role: string };
  store: { id: string; name: string; slug: string } | null;
}

const TOKEN_STORAGE_KEY = "armazix_pdv_token";

export async function login(email: string, password: string): Promise<AuthSession> {
  try {
    const res = await api.post<LoginDesktopResponse>("/api/auth/login-desktop", { email, password });
    return await onOnlineLoginSuccess(res, password);
  } catch (err) {
    // status 0 = a requisição nem saiu (sem rede/servidor fora do ar) — é o
    // único caso em que faz sentido tentar o cache local. Qualquer outra
    // resposta (senha errada, conta desativada, etc.) é do servidor de
    // verdade e deve aparecer pro operador como está, não mascarada.
    if (err instanceof ApiRequestError && err.status === 0) {
      return await loginOffline(email, password);
    }
    throw err;
  }
}

async function onOnlineLoginSuccess(res: LoginDesktopResponse, password: string): Promise<AuthSession> {
  const db = await getDatabase();
  const localHash = await hashPasswordForOfflineLogin(password);
  const email = res.user.email.toLowerCase();

  await db.users_cache.upsert({
    id: res.user.id,
    email,
    name: res.user.name,
    role: res.user.role,
    storeId: res.store?.id ?? "",
    storeName: res.store?.name ?? "",
    storeSlug: res.store?.slug ?? "",
    passwordHash: localHash.hash,
    passwordSalt: localHash.salt,
    passwordIterations: localHash.iterations,
    lastOnlineLoginAt: new Date().toISOString(),
  });

  setAuthToken(res.token);
  localStorage.setItem(TOKEN_STORAGE_KEY, res.token);

  return {
    userId: res.user.id,
    name: res.user.name,
    email,
    role: res.user.role,
    storeId: res.store?.id ?? "",
    storeName: res.store?.name ?? "",
    storeSlug: res.store?.slug ?? "",
    token: res.token,
  };
}

async function loginOffline(email: string, password: string): Promise<AuthSession> {
  const db = await getDatabase();
  const normalizedEmail = email.toLowerCase();
  const cached = await db.users_cache.findOne({ selector: { email: normalizedEmail } }).exec();

  if (!cached) {
    throw new Error(
      "Sem conexão e nenhum login anterior encontrado neste computador. Conecte-se à internet para o primeiro acesso.",
    );
  }

  const valid = await verifyPasswordOffline(password, {
    hash: cached.passwordHash,
    salt: cached.passwordSalt,
    iterations: cached.passwordIterations,
  });
  if (!valid) {
    throw new Error("Senha incorreta");
  }

  // Sem token: dá pra abrir o caixa e vender, mas a fila de sincronização
  // só drena de verdade depois de um login online (ver sync.service.ts).
  setAuthToken(null);
  localStorage.removeItem(TOKEN_STORAGE_KEY);

  return {
    userId: cached.id,
    name: cached.name,
    email: cached.email,
    role: cached.role,
    storeId: cached.storeId,
    storeName: cached.storeName,
    storeSlug: cached.storeSlug,
    token: null,
  };
}

/** Recoloca o token Bearer em memória depois de um reload da página (dev). */
export function restoreToken(): string | null {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (token) setAuthToken(token);
  return token;
}

export function logout(): void {
  setAuthToken(null);
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}
