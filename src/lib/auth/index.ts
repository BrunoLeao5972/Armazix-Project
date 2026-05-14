import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { eq, and, gt, isNull } from "drizzle-orm";
import { createDb, schema } from "@/lib/db";

const { users, verificationCodes } = schema;

// ─── Password Policy ────────────────────────────────────────────
export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

export function validatePasswordPolicy(password: string): PasswordValidationResult {
  const errors: string[] = [];
  
  // Minimum length
  if (password.length < 8) {
    errors.push("Mínimo 8 caracteres");
  }
  
  // Maximum length
  if (password.length > 100) {
    errors.push("Máximo 100 caracteres");
  }
  
  // Uppercase letter
  if (!/[A-Z]/.test(password)) {
    errors.push("Deve conter letra maiúscula");
  }
  
  // Lowercase letter
  if (!/[a-z]/.test(password)) {
    errors.push("Deve conter letra minúscula");
  }
  
  // Number
  if (!/[0-9]/.test(password)) {
    errors.push("Deve conter número");
  }
  
  // Special character
  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push("Deve conter caractere especial");
  }
  
  // Common patterns to avoid
  const commonPatterns = [
    /^123/, /^password/i, /^qwerty/i, /^abc/, /^111/, /^000/,
    /(.)\1{2,}/, // Repeated characters
  ];
  
  for (const pattern of commonPatterns) {
    if (pattern.test(password)) {
      errors.push("Padrão comum muito fraco");
      break;
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

// ─── Password hashing ───────────────────────────────────────────
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ─── JWT ────────────────────────────────────────────────────────
export async function signJWT(
  payload: { userId: string; email: string; role: string },
  secret: string,
  expiresIn = "7d",
): Promise<string> {
  const key = new TextEncoder().encode(secret);
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(key);
}

export async function verifyJWT(
  token: string,
  secret: string,
): Promise<{ userId: string; email: string; role: string } | null> {
  try {
    const key = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, key);
    return payload as unknown as { userId: string; email: string; role: string };
  } catch {
    return null;
  }
}

// ─── Verification code ──────────────────────────────────────────
export function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function createVerificationCode(
  db: ReturnType<typeof createDb>,
  userId: string,
  type: "email_verification" | "password_reset",
): Promise<string> {
  const code = generateCode();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min

  await db.insert(verificationCodes).values({
    userId,
    code,
    type,
    expiresAt,
  });

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
    .where(
      and(
        eq(verificationCodes.code, code),
        eq(verificationCodes.type, type),
        isNull(verificationCodes.usedAt),
        gt(verificationCodes.expiresAt, now),
      ),
    )
    .limit(1);

  if (results.length === 0) {
    return { valid: false };
  }

  const record = results[0];

  // Mark as used
  await db
    .update(verificationCodes)
    .set({ usedAt: now })
    .where(eq(verificationCodes.id, record.id));

  return { valid: true, userId: record.userId };
}

// ─── User helpers ───────────────────────────────────────────────
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
