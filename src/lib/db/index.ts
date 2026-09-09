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

// ── WebSocket connection — SEMPRE nova, NUNCA compartilhada entre requests ──
// Causa raiz real do "erro ao buscar relatório" intermitente (confirmada
// direto no log de produção via `wrangler tail`, não suposição): a versão
// anterior guardava a Pool num Map global de módulo, reaproveitada entre
// invocações do MESMO isolate — mas Cloudflare Workers proíbe isso: um
// objeto de I/O (socket TCP/WebSocket) aberto durante o processamento de
// uma requisição não pode ser usado por OUTRA requisição, mesmo dentro do
// mesmo isolate. A 2ª requisição a reusar a pool travava com
// "Cannot perform I/O on behalf of a different request", nunca resolvia, e
// o runtime cancelava o request por hang ("Workers runtime canceled this
// request because it detected that your Worker's code had hung") — isso é
// o "carrega, carrega e dá erro" relatado, não um problema de timeout de
// conexão (a tentativa de retry só recriava OUTRA pool que sofreria do
// mesmo problema na requisição seguinte).
//
// Correção: cada chamada de createDbTransactional/createTenantDbTransactional
// abre uma conexão NOVA (max: 1 — só essa requisição usa) e a fecha
// automaticamente assim que a transação termina (sucesso ou erro) — nunca
// sobrevive além do request que a criou. É exatamente o padrão que a Neon
// recomenda pra ambientes serverless "connectionless" como Workers.
function makePool(connectionString: string): Pool {
  const pool = new Pool({
    connectionString,
    max: 1,
    // Neon "scale to zero": o compute hiberna depois de alguns minutos sem
    // uso e a primeira conexão depois disso precisa esperar ele acordar —
    // 15s dá margem real pra isso completar em vez de falhar cedo demais.
    connectionTimeoutMillis: 15_000,
  });
  // Sem isso, um erro de conexão inesperado (rede caiu no meio do uso) vira
  // um evento 'error' sem listener no pool — que pode virar unhandled error
  // dentro do isolate. Loga e deixa a conexão morrer (nunca é reusada de
  // qualquer forma, é single-use).
  pool.on("error", (err: Error) => {
    console.warn(`[db] conexão WebSocket teve erro: ${err.message}`);
  });
  return pool;
}

// Envolve o objeto drizzle (WebSocket) devolvendo a MESMA interface — só
// .transaction() muda: fecha a conexão automaticamente ao final (sucesso ou
// erro), já que ela é single-use e nunca deve sobreviver além do request que
// a abriu. Transparente pra todo handler que já usa esse padrão — nenhum
// dos ~30+ que chamam createDbTransactional/createTenantDbTransactional
// precisou mudar uma linha.
// Exportada só pra teste unitário (ver src/lib/__tests__/db-retry.test.ts).
export function withAutoClose<T extends { transaction(cb: never): Promise<unknown>; $client: Pool }>(db: T): T {
  return new Proxy(db, {
    get(target, prop, receiver) {
      if (prop !== "transaction") return Reflect.get(target, prop, receiver);
      return async (callback: never) => {
        try {
          return await target.transaction(callback);
        } finally {
          // Aguardado (não fire-and-forget): fechar sem esperar deixaria o
          // .end() rodando depois que o handler já retornou a resposta —
          // fora do I/O context da requisição que abriu a conexão, o
          // mesmo problema que essa função inteira existe pra evitar.
          try { await target.$client.end(); } catch { /* já pode estar fechada — ignora */ }
        }
      };
    },
  }) as T;
}

// WebSocket driver — suporta db.transaction(). Use para writes multi-step.
// Conexão nova a cada chamada (ver comentário de makePool acima).
export function createDbTransactional(databaseUrl: string) {
  return withAutoClose(drizzleWs(makePool(databaseUrl), { schema }));
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

// Conexão WebSocket com Row Level Security REAL: usa a role `armazix_tenant`
// (sem BYPASSRLS — ver drizzle/0001 e 0030) via DATABASE_URL_TENANT, nunca a
// role admin do DATABASE_URL. Conexão nova a cada chamada (ver makePool).
//
// OBRIGATÓRIO: a primeira instrução dentro de QUALQUER db.transaction() usando
// esta conexão deve ser `SELECT set_config('app.current_store_id', $1, true)`
// com o storeId do request — SET LOCAL/set_config(..., true) vale só até o fim
// da transação atual. Consultas fora de uma transaction() explícita NÃO
// recebem contexto nenhum — não dependa de RLS fora de um db.transaction().
export async function createTenantDbTransactional(_databaseUrl: string, storeId: string) {
  const tenantUrl = process.env.DATABASE_URL_TENANT;
  if (!tenantUrl) {
    throw new Error("DATABASE_URL_TENANT não configurado — RLS não pode ser aplicado");
  }
  if (!storeId) {
    throw new Error("createTenantDbTransactional requer um storeId");
  }
  return withAutoClose(drizzleWs(makePool(tenantUrl), { schema }));
}

/** Primeira instrução dentro de db.transaction() ao usar createTenantDbTransactional. */
export const setTenantContext = (storeId: string) =>
  rawSql`SELECT set_config('app.current_store_id', ${storeId}, true)`;

export type Database = ReturnType<typeof createDb>;

export { schema };
