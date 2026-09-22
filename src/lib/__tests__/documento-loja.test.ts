import { describe, it, expect } from "vitest";
import { verificarDocumentoLoja } from "@/lib/store/documento-loja";

describe("verificarDocumentoLoja", () => {
  it("campo é opcional: sem documento nenhum, nada enviado → ok, sem vincular nada", () => {
    expect(verificarDocumentoLoja(null, undefined)).toEqual({ ok: true, documento: null, tipo: null, jaEstavaVinculado: false });
    expect(verificarDocumentoLoja(undefined, "")).toEqual({ ok: true, documento: null, tipo: null, jaEstavaVinculado: false });
  });

  it("primeira vez, documento inválido → bloqueia", () => {
    expect(verificarDocumentoLoja(null, "111.111.111-11")).toEqual({ ok: false, motivo: "invalido" });
  });

  it("primeira vez, documento válido → vincula (jaEstavaVinculado: false)", () => {
    expect(verificarDocumentoLoja(null, "111.444.777-35")).toEqual({
      ok: true, documento: "11144477735", tipo: "cpf", jaEstavaVinculado: false,
    });
    expect(verificarDocumentoLoja(null, "11.222.333/0001-81")).toEqual({
      ok: true, documento: "11222333000181", tipo: "cnpj", jaEstavaVinculado: false,
    });
  });

  it("já vinculado, reenviando o mesmo valor (com ou sem máscara) → ok, sem mudar nada", () => {
    expect(verificarDocumentoLoja("11144477735", "111.444.777-35")).toEqual({
      ok: true, documento: "11144477735", tipo: "cpf", jaEstavaVinculado: true,
    });
  });

  it("já vinculado, nada enviado de novo → ok, mantém o atual", () => {
    expect(verificarDocumentoLoja("11144477735", undefined)).toEqual({
      ok: true, documento: "11144477735", tipo: "cpf", jaEstavaVinculado: true,
    });
  });

  it("já vinculado, tentando enviar outro documento → bloqueia (divergente) — só o suporte corrige", () => {
    expect(verificarDocumentoLoja("11144477735", "529.982.247-25")).toEqual({ ok: false, motivo: "divergente" });
  });
});
