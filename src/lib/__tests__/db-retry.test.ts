// Regressão: relatórios (e qualquer rota que use createDbTransactional/
// createTenantDbTransactional) falhavam de forma intermitente — "às vezes
// funciona, às vezes dá erro ao buscar" — porque a pool WebSocket é reusada
// entre requests dentro do mesmo isolate de Worker, e o servidor Neon fecha
// conexões ociosas por conta própria depois de um tempo; a primeira query
// numa conexão morta falhava com "Connection terminated unexpectedly" sem
// nenhuma segunda tentativa automática. withTransactionRetry cobre isso.
import { describe, it, expect, vi } from "vitest";
import { isConnectionError, withTransactionRetry } from "@/lib/db";

describe("isConnectionError", () => {
  it("reconhece as mensagens típicas de conexão morta do driver Neon/pg", () => {
    expect(isConnectionError(new Error("Connection terminated unexpectedly"))).toBe(true);
    expect(isConnectionError(new Error("connection closed"))).toBe(true);
    expect(isConnectionError(new Error("ECONNRESET"))).toBe(true);
  });
  it("não confunde erro de aplicação (permissão, SQL) com erro de conexão", () => {
    expect(isConnectionError(new Error("Sem permissão para acessar este relatório"))).toBe(false);
    expect(isConnectionError(new Error("column \"foo\" does not exist"))).toBe(false);
  });
});

describe("withTransactionRetry", () => {
  it("repassa o resultado direto quando a transação funciona de primeira", async () => {
    const db = { transaction: vi.fn().mockResolvedValue("ok") };
    const wrapped = withTransactionRetry(db, () => db);
    const result = await wrapped.transaction(async () => "ok");
    expect(result).toBe("ok");
    expect(db.transaction).toHaveBeenCalledTimes(1);
  });

  it("tenta de novo com uma conexão nova quando a 1ª falha por conexão morta, e funciona", async () => {
    const dead = { transaction: vi.fn().mockRejectedValue(new Error("Connection terminated unexpectedly")) };
    const fresh = { transaction: vi.fn().mockResolvedValue("recuperado") };
    const recreate = vi.fn().mockReturnValue(fresh);

    const wrapped = withTransactionRetry(dead, recreate);
    const result = await wrapped.transaction(async () => "recuperado");

    expect(result).toBe("recuperado");
    expect(dead.transaction).toHaveBeenCalledTimes(1);
    expect(recreate).toHaveBeenCalledTimes(1);
    expect(fresh.transaction).toHaveBeenCalledTimes(1);
  });

  it("propaga direto um erro que não é de conexão (não tenta de novo)", async () => {
    const db = { transaction: vi.fn().mockRejectedValue(new Error("Sem permissão para acessar este relatório")) };
    const recreate = vi.fn();
    const wrapped = withTransactionRetry(db, recreate);

    await expect(wrapped.transaction(async () => "x")).rejects.toThrow("Sem permissão");
    expect(recreate).not.toHaveBeenCalled();
  });

  it("outras propriedades do objeto original continuam acessíveis (só .transaction é interceptado)", () => {
    const db = { transaction: vi.fn(), query: { orders: "tabela" } };
    const wrapped = withTransactionRetry(db, () => db);
    expect(wrapped.query).toBe(db.query);
  });
});
