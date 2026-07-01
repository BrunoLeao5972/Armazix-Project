import { neon, Pool } from "@neondatabase/serverless";
import { drizzle as drizzleHttp } from "drizzle-orm/neon-http";
import { drizzle as drizzleWs } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

// HTTP driver — fast, no connection overhead, but NO transaction support.
export function createDb(databaseUrl: string) {
  const sql = neon(databaseUrl);
  return drizzleHttp(sql, { schema });
}

// WebSocket Pool driver — supports db.transaction(). Use for multi-step writes.
export function createDbTransactional(databaseUrl: string) {
  const pool = new Pool({ connectionString: databaseUrl });
  return drizzleWs(pool, { schema });
}

// Tenant-scoped HTTP db (for simple queries — no transaction support).
export async function createTenantDb(databaseUrl: string, _storeId: string) {
  return createDb(databaseUrl);
}

// Tenant-scoped transactional db (for writes that use db.transaction()).
export async function createTenantDbTransactional(databaseUrl: string, _storeId: string) {
  return createDbTransactional(databaseUrl);
}

export type Database = ReturnType<typeof createDb>;

export { schema };
