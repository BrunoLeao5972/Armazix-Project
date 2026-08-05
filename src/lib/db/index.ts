import { neon, Pool } from "@neondatabase/serverless";
import { drizzle as drizzleHttp } from "drizzle-orm/neon-http";
import { drizzle as drizzleWs } from "drizzle-orm/neon-serverless";
import { sql as rawSql } from "drizzle-orm";
import * as schema from "./schema";

// HTTP driver — connectionless, zero-overhead. Ideal para CF Workers onde
// cada request é isolado. Não suporta db.transaction().
export function createDb(databaseUrl: string) {
  const sql = neon(databaseUrl);
  return drizzleHttp(sql, { schema });
}

// ── WebSocket Pool — singleton por connection string, por isolate ───────────
// Neon Pool usa WebSockets (TCP-like) que suportam db.transaction() e session
// state real (SET LOCAL). Mapa (não uma variável única) porque o app usa DUAS
// connection strings distintas na mesma isolate: DATABASE_URL (role admin,
// BYPASSRLS) e DATABASE_URL_TENANT (role restrita, sujeita a RLS) — uma
// variável única alternaria entre as duas a cada chamada, descartando o pool
// anterior sem fechar as conexões.
// max: 5 por pool — conservador para Workers de curta duração (evita open-connection storms).
const _pools = new Map<string, Pool>();

function getPool(connectionString: string): Pool {
  let pool = _pools.get(connectionString);
  if (!pool) {
    pool = new Pool({
      connectionString,
      max:                    5,
      idleTimeoutMillis:      20_000,
      connectionTimeoutMillis: 5_000,
    });
    _pools.set(connectionString, pool);
  }
  return pool;
}

// WebSocket Pool driver — suporta db.transaction(). Use para writes multi-step.
export function createDbTransactional(databaseUrl: string) {
  return drizzleWs(getPool(databaseUrl), { schema });
}

// Conexão HTTP simples, SEM isolamento de tenant no nível do banco — a única
// proteção é a cláusula `eq(tabela.storeId, storeId)` que cada handler escreve
// manualmente. NÃO existe "modo tenant" pra esse driver: o driver neon-http
// não mantém sessão entre chamadas (cada query é uma requisição HTTP própria,
// sem suporte a transaction — ver drizzle-orm/neon-http/session.ts), então
// SET LOCAL não teria como persistir entre duas queries separadas.
// Ver auditoria de segurança (módulo Autorização) — drizzle/0030_rls_activate.sql.
export async function createUnscopedDb(databaseUrl: string, _storeId?: string) {
  return createDb(databaseUrl);
}

// Conexão WebSocket Pool com Row Level Security REAL: usa a role
// `armazix_tenant` (sem BYPASSRLS — ver drizzle/0001 e 0030) via
// DATABASE_URL_TENANT, nunca a role admin do DATABASE_URL.
//
// OBRIGATÓRIO: a primeira instrução dentro de QUALQUER db.transaction() usando
// esta conexão deve ser `SELECT set_config('app.current_store_id', $1, true)`
// com o storeId do request — SET LOCAL/set_config(..., true) vale só até o fim
// da transação atual, então nunca vaza contexto de uma loja pra próxima
// requisição que reusar a mesma conexão do pool. Consultas fora de uma
// transaction() explícita NÃO recebem contexto nenhum (cada uma pega uma
// conexão arbitrária do pool) — não dependa de RLS fora de um db.transaction().
export async function createTenantDbTransactional(_databaseUrl: string, storeId: string) {
  const tenantUrl = process.env.DATABASE_URL_TENANT;
  if (!tenantUrl) {
    throw new Error("DATABASE_URL_TENANT não configurado — RLS não pode ser aplicado");
  }
  if (!storeId) {
    throw new Error("createTenantDbTransactional requer um storeId");
  }
  return drizzleWs(getPool(tenantUrl), { schema });
}

/** Primeira instrução dentro de db.transaction() ao usar createTenantDbTransactional. */
export const setTenantContext = (storeId: string) =>
  rawSql`SELECT set_config('app.current_store_id', ${storeId}, true)`;

export type Database = ReturnType<typeof createDb>;

export { schema };
