// Regressão: relatórios (e qualquer rota que use createDbTransactional/
// createTenantDbTransactional) falhavam de forma intermitente — "às vezes
// funciona, às vezes dá erro ao buscar", carregando indefinidamente até dar
// erro. Causa raiz confirmada direto no log de produção (wrangler tail): a
// versão anterior guardava a Pool WebSocket num Map global de módulo,
// reaproveitada entre invocações do mesmo isolate de Worker — mas
// Cloudflare Workers proíbe isso: um socket aberto durante o processamento
// de uma requisição não pode ser usado por OUTRA requisição, mesmo no
// mesmo isolate. A 2ª requisição a reusar a pool travava com
// "Cannot perform I/O on behalf of a different request" e nunca resolvia —
// o runtime cancelava o request por hang. withAutoClose garante que toda
// conexão é single-use: criada, usada, fechada, dentro da mesma requisição.
import { describe, it, expect, vi } from "vitest";
import { withAutoClose } from "@/lib/db";

describe("withAutoClose", () => {
  it("repassa o resultado da transação normalmente", async () => {
    const client = { end: vi.fn().mockResolvedValue(undefined) };
    const db = { transaction: vi.fn().mockResolvedValue("ok"), $client: client };
    const wrapped = withAutoClose(db as any);

    const result = await wrapped.transaction(async () => "ok");
    expect(result).toBe("ok");
  });

  it("fecha a conexão (aguardando) depois de uma transação bem-sucedida", async () => {
    const client = { end: vi.fn().mockResolvedValue(undefined) };
    const db = { transaction: vi.fn().mockResolvedValue("ok"), $client: client };
    const wrapped = withAutoClose(db as any);

    await wrapped.transaction(async () => "ok");
    expect(client.end).toHaveBeenCalledTimes(1);
  });

  it("fecha a conexão mesmo quando a transação falha, e propaga o erro original", async () => {
    const client = { end: vi.fn().mockResolvedValue(undefined) };
    const db = { transaction: vi.fn().mockRejectedValue(new Error("erro de aplicação")), $client: client };
    const wrapped = withAutoClose(db as any);

    await expect(wrapped.transaction(async () => "x")).rejects.toThrow("erro de aplicação");
    expect(client.end).toHaveBeenCalledTimes(1);
  });

  it("uma falha ao fechar a conexão (já estava morta) não mascara o resultado da transação", async () => {
    const client = { end: vi.fn().mockRejectedValue(new Error("já fechada")) };
    const db = { transaction: vi.fn().mockResolvedValue("ok"), $client: client };
    const wrapped = withAutoClose(db as any);

    const result = await wrapped.transaction(async () => "ok");
    expect(result).toBe("ok");
  });

  it("outras propriedades do objeto original continuam acessíveis (só .transaction é interceptado)", () => {
    const client = { end: vi.fn() };
    const db = { transaction: vi.fn(), $client: client, query: { orders: "tabela" } };
    const wrapped = withAutoClose(db as any);
    expect(wrapped.query).toBe(db.query);
  });
});
