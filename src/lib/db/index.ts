import { neon, Pool } from "@neondatabase/serverless";
import { drizzle as drizzleHttp } from "drizzle-orm/neon-http";
import { drizzle as drizzleWs } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

// HTTP driver — connectionless, zero-overhead. Ideal para CF Workers onde
// cada request é isolado. Não suporta db.transaction().
export function createDb(databaseUrl: string) {
  const sql = neon(databaseUrl);
  return drizzleHttp(sql, { schema });
}

// ── WebSocket Pool — singleton por isolate ───────────────────────────────
// Neon Pool usa WebSockets (TCP-like) que suportam db.transaction().
// Singleton garante que o mesmo pool é reutilizado entre chamadas no mesmo
// isolate do Worker, evitando overhead de handshake TLS por requisição.
// max: 5 — conservador para Workers de curta duração (evita open-connection storms).
// idleTimeoutMillis: evita conexões zumbis quando o Worker fica idle.
// connectionTimeoutMillis: falha rápido em vez de pendurar a requisição.
let _pool: Pool | null = null;
let _poolConnectionString: string | null = null;

function getPool(connectionString: string): Pool {
  if (!_pool || _poolConnectionString !== connectionString) {
    _pool = new Pool({
      connectionString,
      max:                    5,
      idleTimeoutMillis:      20_000,
      connectionTimeoutMillis: 5_000,
    });
    _poolConnectionString = connectionString;
  }
  return _pool;
}

// WebSocket Pool driver — suporta db.transaction(). Use para writes multi-step.
export function createDbTransactional(databaseUrl: string) {
  return drizzleWs(getPool(databaseUrl), { schema });
}

// Tenant-scoped HTTP db (para queries simples — sem suporte a transaction).
export async function createTenantDb(databaseUrl: string, _storeId: string) {
  return createDb(databaseUrl);
}

// Tenant-scoped transactional db (para writes que usam db.transaction()).
export async function createTenantDbTransactional(databaseUrl: string, _storeId: string) {
  return createDbTransactional(databaseUrl);
}

export type Database = ReturnType<typeof createDb>;

export { schema };
