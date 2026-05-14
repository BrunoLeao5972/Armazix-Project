import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql as drizzleSql } from "drizzle-orm";
import * as schema from "./schema";

export function createDb(databaseUrl: string) {
  const sql = neon(databaseUrl);
  return drizzle(sql, { schema });
}

/**
 * Creates a DB instance scoped to a specific tenant.
 * Sets the PostgreSQL session variable `app.current_store_id` so that
 * Row Level Security policies can enforce tenant isolation at the database level.
 *
 * Usage: replace `createDb(dbUrl)` with `createTenantDb(dbUrl, storeId)` in
 * any handler that performs tenant-scoped writes.
 *
 * NOTE: With the Neon HTTP adapter each query is an independent HTTP request.
 * SET LOCAL only persists within a transaction. For multi-statement tenant-scoped
 * operations use db.transaction() after calling this function.
 */
export async function createTenantDb(databaseUrl: string, storeId: string) {
  const sql = neon(databaseUrl);
  const db = drizzle(sql, { schema });

  // Set the tenant context so PostgreSQL RLS policies can use it.
  // This is a best-effort hint for RLS; primary access control is in the app layer.
  try {
    await db.execute(drizzleSql`SELECT set_config('app.current_store_id', ${storeId}, false)`);
  } catch {
    // Non-fatal: RLS context setting may fail in environments where pg_catalog
    // functions are restricted. The application layer (requireStoreAccess) is the
    // primary control. Log silently to avoid breaking the request.
    console.warn("[RLS] Could not set app.current_store_id — app-layer controls active");
  }

  return db;
}

export type Database = ReturnType<typeof createDb>;

export { schema };
