import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { eq, and, gt, isNull } from "drizzle-orm";
import { createDb, schema } from "@/lib/db";

const { users, verificationCodes } = schema;

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
