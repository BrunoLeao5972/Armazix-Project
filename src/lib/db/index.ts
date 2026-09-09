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
//
// Achado real (relatórios intermitentes — "às vezes funciona, às vezes dá
// erro"): um isolate de Worker pode ficar vivo minutos entre requests (o
// runtime reaproveita isolates ativos), e o servidor Neon fecha o WebSocket
// de uma conexão ociosa por conta própria depois de um tempo — o cliente
// só descobre isso na PRÓXIMA query, que falha com "Connection terminated
// unexpectedly" mesmo a conexão nunca tendo excedido `idleTimeoutMillis`
// do lado de cá (a corrida é exatamente essa: servidor fecha antes do
// cliente perceber). Sem handler de 'error' no pool, esse evento também
// arriscava virar um unhandled error dentro do isolate. registerPool()
// contorna isso descartando o pool inteiro assim que uma conexão dele
// morre — a próxima chamada recria do zero — e withTransactionRetry()
// abaixo (aplicado dentro de createDbTransactional/createTenantDbTransactional,
// transparente pra todo handler que já usa esse padrão) tenta a operação
// de novo uma vez depois de descartar, então o pedido do usuário não
// precisa de um segundo clique manual pra "sorte" de pegar uma conexão viva.
const _pools = new Map<string, Pool>();

function registerPool(connectionString: string, pool: Pool): void {
  pool.on("error", (err: Error) => {
    console.warn(`[db] pool WebSocket teve erro de conexão, descartando pra recriar na próxima chamada: ${err.message}`);
    if (_pools.get(connectionString) === pool) _pools.delete(connectionString);
  });
}

function getPool(connectionString: string): Pool {
  let pool = _pools.get(connectionString);
  if (!pool) {
    pool = new Pool({
      connectionString,
      max:                    5,
      idleTimeoutMillis:      20_000,
      connectionTimeoutMillis: 5_000,
    });
    registerPool(connectionString, pool);
    _pools.set(connectionString, pool);
  }
  return pool;
}

// Reconhece a classe de erro que indica "a conexão morreu debaixo de nós"
// (servidor fechou o socket, rede caiu no meio) — não erros de aplicação
// (permissão negada, coluna inválida etc.), que devem propagar direto.
// Exportada só pra teste unitário (ver src/lib/__tests__/db-retry.test.ts).
export function isConnectionError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /connection.*(terminated|closed|reset|ended)|econnreset|socket.*(closed|hang up)|timeout.*connect|Connection terminated/i.test(msg);
}

function discardAllPools(): void {
  for (const [key, pool] of _pools) {
    _pools.delete(key);
    pool.end().catch(() => { /* pool já pode estar morta — ignora */ });
  }
}

// Envolve o objeto drizzle (WebSocket) devolvendo a MESMA interface — só
// .transaction() muda: se a chamada falhar por conexão morta (ver comentário
// acima de _pools), descarta as pools conhecidas e tenta de novo UMA vez com
// uma pool nova, tudo transparente pro handler que chamou createDbTransactional/
// createTenantDbTransactional — ele só vê `db.transaction(cb)` funcionar (ou
// falhar por um motivo que não seja conexão, igual sempre foi). Nenhum dos
// ~30+ handlers que já usam esse padrão precisou mudar uma linha.
// Exportada só pra teste unitário (ver src/lib/__tests__/db-retry.test.ts).
export function withTransactionRetry<T extends { transaction(cb: never): Promise<unknown> }>(db: T, recreate: () => T): T {
  return new Proxy(db, {
    get(target, prop, receiver) {
      if (prop !== "transaction") return Reflect.get(target, prop, receiver);
      return async (callback: never) => {
        try {
          return await target.transaction(callback);
        } catch (err) {
          if (!isConnectionError(err)) throw err;
          console.warn("[db] transação falhou por conexão morta, recriando pool e tentando de novo:", err instanceof Error ? err.message : err);
          discardAllPools();
          return recreate().transaction(callback);
        }
      };
    },
  }) as T;
}

// WebSocket Pool driver — suporta db.transaction(). Use para writes multi-step.
export function createDbTransactional(databaseUrl: string) {
  const make = () => drizzleWs(getPool(databaseUrl), { schema });
  return withTransactionRetry(make(), make);
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
  const make = () => drizzleWs(getPool(tenantUrl), { schema });
  return withTransactionRetry(make(), make);
}

/** Primeira instrução dentro de db.transaction() ao usar createTenantDbTransactional. */
export const setTenantContext = (storeId: string) =>
  rawSql`SELECT set_config('app.current_store_id', ${storeId}, true)`;

export type Database = ReturnType<typeof createDb>;

export { schema };
