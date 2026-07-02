import { SignJWT, jwtVerify } from "jose";
import { eq, and, gt, isNull } from "drizzle-orm";
import { createDb, schema } from "@/lib/db";

const { users, verificationCodes } = schema;

// ─── CryptoKey isolate-level cache ──────────────────────────────────────────
// jose converts Uint8Array → CryptoKey internally on every call.
// Pre-importing the key once per isolate lifetime saves ~3–8 ms/req of
// crypto.subtle.importKey() overhead on every authenticated endpoint.
const _keyCache = new Map<string, CryptoKey>();

async function getHmacKey(secret: string): Promise<CryptoKey> {
  let key = _keyCache.get(secret);
  if (!key) {
    key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,          // non-extractable
      ["sign", "verify"],
    );
    _keyCache.set(secret, key);
  }
  return key;
}

// ─── Password Policy ─────────────────────────────────────────────────────────
export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

export function validatePasswordPolicy(password: string): PasswordValidationResult {
  const errors: string[] = [];
  if (password.length < 8)   errors.push("Mínimo 8 caracteres");
  if (password.length > 100) errors.push("Máximo 100 caracteres");
  if (!/[A-Z]/.test(password)) errors.push("Deve conter letra maiúscula");
  if (!/[a-z]/.test(password)) errors.push("Deve conter letra minúscula");
  if (!/[0-9]/.test(password)) errors.push("Deve conter número");
  if (!/[^A-Za-z0-9]/.test(password)) errors.push("Deve conter caractere especial");

  const commonPatterns = [
    /^123/, /^password/i, /^qwerty/i, /^abc/, /^111/, /^000/,
    /(.)\1{2,}/,
  ];
  for (const pat of commonPatterns) {
    if (pat.test(password)) { errors.push("Padrão comum muito fraco"); break; }
  }
  return { valid: errors.length === 0, errors };
}

// ─── Password hashing — Web Crypto PBKDF2 ───────────────────────────────────
// Replaces bcryptjs (pure-JS, synchronous, ~250 ms at cost 12).
// PBKDF2-SHA-256 is native in the CF Workers runtime (no polyfill, non-blocking).
//
// Hash format:  pbkdf2v1:<iterations>:<base64url-salt>:<base64url-hash>
// Legacy bcrypt hashes ($2b$/$ 2a$) are detected and verified via dynamic import
// of bcryptjs only on that path, so new deployments never load the polyfill.

const PBKDF2_ITER   = 100_000;
const PBKDF2_PREFIX = "pbkdf2v1:";

function b64u(buf: ArrayBuffer | Uint8Array): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf instanceof ArrayBuffer ? buf : buf.buffer)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromb64u(s: string): Uint8Array {
  return Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const rawKey = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(password),
    "PBKDF2", false, ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITER },
    rawKey, 256,
  );
  return `${PBKDF2_PREFIX}${PBKDF2_ITER}:${b64u(salt)}:${b64u(bits)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  // Legacy bcrypt — dynamic import avoids loading the polyfill in new flows
  if (stored.startsWith("$2b$") || stored.startsWith("$2a$")) {
    const bcrypt = (await import("bcryptjs")).default;
    return bcrypt.compare(password, stored);
  }

  if (!stored.startsWith(PBKDF2_PREFIX)) return false;

  const parts = stored.slice(PBKDF2_PREFIX.length).split(":");
  if (parts.length !== 3) return false;
  const [iterStr, saltB64u, hashB64u] = parts;
  const iterations = parseInt(iterStr, 10);
  const salt       = fromb64u(saltB64u);
  const expected   = fromb64u(hashB64u);

  const rawKey = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(password),
    "PBKDF2", false, ["deriveBits"],
  );
  const bits  = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt.buffer as ArrayBuffer, iterations },
    rawKey, 256,
  );
  const actual = new Uint8Array(bits);

  // Constant-time comparison — prevents timing-based enumeration
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

// ─── JWT ─────────────────────────────────────────────────────────────────────
export async function signJWT(
  payload: { userId: string; email: string; role: string; storeId?: string },
  secret: string,
  expiresIn = "7d",
): Promise<string> {
  const key = await getHmacKey(secret);
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(key);
}

export async function verifyJWT(
  token: string,
  secret: string,
): Promise<{ userId: string; email: string; role: string; storeId?: string } | null> {
  try {
    const key = await getHmacKey(secret);
    const { payload } = await jwtVerify(token, key);
    return payload as unknown as { userId: string; email: string; role: string; storeId?: string };
  } catch {
    return null;
  }
}

// ─── Verification code ────────────────────────────────────────────────────────
export function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function createVerificationCode(
  db: ReturnType<typeof createDb>,
  userId: string,
  type: "email_verification" | "password_reset",
): Promise<string> {
  const code = generateCode();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  await db.insert(verificationCodes).values({ userId, code, type, expiresAt });
  return code;
}

export async function validateVerificationCode(
  db: ReturnType<typeof createDb>,
  code: string,
  type: "email_verification" | "password_reset",
): Promise<{ valid: boolean; userId?: string }> {
  const now = new Date();
  const results = await db
    .select()
    .from(verificationCodes)
    .where(and(
      eq(verificationCodes.code, code),
      eq(verificationCodes.type, type),
      isNull(verificationCodes.usedAt),
      gt(verificationCodes.expiresAt, now),
    ))
    .limit(1);

  if (results.length === 0) return { valid: false };

  const record = results[0];
  await db.update(verificationCodes)
    .set({ usedAt: now })
    .where(eq(verificationCodes.id, record.id));

  return { valid: true, userId: record.userId };
}

// ─── Customer JWT (passwordless store auth) ──────────────────────────────────
// role:"customer" segregates from admin JWTs — verifyJWT rejects these.
export async function signCustomerJWT(
  payload: { customerId: string; storeId: string },
  secret: string,
  expiresIn = "30d",
): Promise<string> {
  const key = await getHmacKey(secret);
  return new SignJWT({ ...payload, role: "customer" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(key);
}

export async function verifyCustomerJWT(
  token: string,
  secret: string,
): Promise<{ customerId: string; storeId: string } | null> {
  try {
    const key = await getHmacKey(secret);
    const { payload } = await jwtVerify(token, key);
    const p = payload as Record<string, unknown>;
    if (p.role !== "customer" || typeof p.customerId !== "string" || typeof p.storeId !== "string") return null;
    return { customerId: p.customerId, storeId: p.storeId };
  } catch {
    return null;
  }
}

// ─── User helpers ─────────────────────────────────────────────────────────────
export async function findUserByEmail(
  db: ReturnType<typeof createDb>,
  email: string,
) {
  const results = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return results[0] || null;
}
