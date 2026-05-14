import { createDb } from "@/lib/db";
import { schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";

const { storeUsers } = schema;

export interface AuthContext {
  userId?: string;
  storeId?: string;
}

export interface StoreAccessResult {
  userId: string;
  storeId: string;
}

/**
 * Validates that the authenticated user has access to the specified store.
 * This is the SINGLE SOURCE OF TRUTH for tenant authorization.
 * 
 * NEVER trust storeId from:
 * - body.storeId
 * - query.storeId  
 * - params.storeId
 * - localStorage
 * - frontend in general
 * 
 * ALWAYS use auth.storeId from JWT token.
 */
export async function requireStoreAccess(
  auth?: AuthContext
): Promise<StoreAccessResult> {
  // Validate auth exists
  if (!auth?.userId) {
    throw new Error("Unauthorized: No userId in auth context");
  }

  if (!auth?.storeId) {
    throw new Error("Unauthorized: No storeId in auth context");
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error("Database configuration error");
  }

  const db = createDb(dbUrl);

  // Verify user has explicit access to this store via storeUsers table
  const access = await db.query.storeUsers.findFirst({
    where: and(
      eq(storeUsers.userId, auth.userId),
      eq(storeUsers.storeId, auth.storeId)
    ),
  });

  if (!access) {
    throw new Error("Forbidden: User does not have access to this store");
  }

  return {
    userId: auth.userId,
    storeId: auth.storeId,
  };
}

/**
 * Validates that the authenticated user is the owner or admin of the store.
 * Use for sensitive operations like changing payment tokens.
 */
export async function requireStoreOwner(
  auth?: AuthContext
): Promise<StoreAccessResult> {
  if (!auth?.userId) {
    throw new Error("Unauthorized: No userId in auth context");
  }

  if (!auth?.storeId) {
    throw new Error("Unauthorized: No storeId in auth context");
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error("Database configuration error");
  }

  const db = createDb(dbUrl);

  // Verify user is owner or admin (not just any role)
  const access = await db.query.storeUsers.findFirst({
    where: and(
      eq(storeUsers.userId, auth.userId),
      eq(storeUsers.storeId, auth.storeId)
    ),
  });

  if (!access) {
    throw new Error("Forbidden: User does not have access to this store");
  }

  // Only owner or admin can perform sensitive operations
  if (access.role !== "owner" && access.role !== "admin") {
    throw new Error("Forbidden: Insufficient permissions for this operation");
  }

  return {
    userId: auth.userId,
    storeId: auth.storeId,
  };
}

/**
 * Helper to safely extract storeId from auth context.
 * Returns null if auth is invalid instead of throwing.
 */
export function getStoreIdFromAuth(auth?: AuthContext): string | null {
  return auth?.storeId ?? null;
}

/**
 * Helper to validate that a storeId from an untrusted source matches the auth storeId.
 * Use this when you need to validate external references.
 */
export function validateStoreIdMatch(
  trustedStoreId: string,
  untrustedStoreId?: string
): boolean {
  if (!untrustedStoreId) return true; // No untrusted ID to validate
  return trustedStoreId === untrustedStoreId;
}
