import { describe, it, expect } from "vitest";
import { motivoLabel, MOTIVOS_CANCELAMENTO, MOTIVOS_ESTORNO } from "@/lib/orders/motivos";
import { estornarVendaConcretizada } from "@/lib/orders/estorno";

describe("motivoLabel", () => {
  it("resolve a chave do motivo pro rótulo legível", () => {
    expect(motivoLabel("cliente")).toBe("Desistência do cliente");
    expect(motivoLabel("valor")).toBe("Erro no valor cobrado");
  });

  it("junta rótulo + observação com travessão", () => {
    expect(motivoLabel("valor", "cobrou frete errado")).toBe("Erro no valor cobrado — cobrou frete errado");
  });

  it("usa só a observação quando não há chave", () => {
    expect(motivoLabel(null, "cliente ligou reclamando")).toBe("cliente ligou reclamando");
  });

  it("cai num texto neutro quando não há nada", () => {
    expect(motivoLabel()).toBe("Sem motivo informado");
    expect(motivoLabel("", "  ")).toBe("Sem motivo informado");
  });

  it("mantém a chave crua se ela não estiver no catálogo", () => {
    expect(motivoLabel("chave-desconhecida")).toBe("chave-desconhecida");
  });
});

describe("catálogos de motivo", () => {
  it("têm opções e valores únicos", () => {
    for (const lista of [MOTIVOS_CANCELAMENTO, MOTIVOS_ESTORNO]) {
      expect(lista.length).toBeGreaterThan(2);
      const vals = lista.map((m) => m.value);
      expect(new Set(vals).size).toBe(vals.length);
      expect(lista.every((m) => m.label.length > 0)).toBe(true);
    }
  });
});

describe("estornarVendaConcretizada — guarda de idempotência", () => {
  // tx que explode se for tocado — prova que os estados não-finalizados
  // retornam ANTES de qualquer escrita.
  const txProibido = new Proxy({}, {
    get() { throw new Error("o motor não deveria tocar no banco pra uma venda não-finalizada"); },
  }) as never;

  const base = { id: "o1", number: 10, total: "50.00", cancelledAt: null };

  it("é no-op numa venda ainda aberta", async () => {
    const r = await estornarVendaConcretizada(txProibido, {
      storeId: "s1", order: { ...base, saleStatus: "aberta" }, now: new Date(),
    });
    expect(r).toEqual({ jaEstornada: false, valorEstornado: 0, itensDevolvidos: 0, lancamentosEstornados: 0 });
  });

  it("é no-op numa venda cancelada (nunca concretizada)", async () => {
    const r = await estornarVendaConcretizada(txProibido, {
      storeId: "s1", order: { ...base, saleStatus: "cancelada" }, now: new Date(),
    });
    expect(r.valorEstornado).toBe(0);
  });

  it("sinaliza jaEstornada quando a venda já foi estornada antes", async () => {
    const r = await estornarVendaConcretizada(txProibido, {
      storeId: "s1", order: { ...base, saleStatus: "estornada" }, now: new Date(),
    });
    expect(r.jaEstornada).toBe(true);
  });
});
