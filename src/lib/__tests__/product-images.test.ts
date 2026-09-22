import { describe, it, expect } from "vitest";
import { MAX_PRODUCT_IMAGES, galeriaDoProduto, normalizarImagensProduto } from "@/lib/product-images";

const img = (url: string, isPrimary = false) => ({ url, isPrimary });

describe("normalizarImagensProduto", () => {
  it("limite é 6 fotos por produto", () => {
    expect(MAX_PRODUCT_IMAGES).toBe(6);
  });

  it("corta em 6 mantendo a capa mesmo se ela era a última", () => {
    const fotos = Array.from({ length: 9 }, (_, i) => img(`f${i + 1}`, i === 8));
    const r = normalizarImagensProduto(fotos);
    expect(r).toHaveLength(6);
    expect(r[0]).toEqual({ url: "f9", isPrimary: true });
    expect(r.slice(1).map(i => i.url)).toEqual(["f1", "f2", "f3", "f4", "f5"]);
  });

  it("sempre devolve exatamente uma capa, na frente", () => {
    const r = normalizarImagensProduto([img("a"), img("b", true), img("c", true)]);
    expect(r.map(i => [i.url, i.isPrimary])).toEqual([["b", true], ["a", false], ["c", false]]);
  });

  it("sem nenhuma capa marcada, a primeira vira capa", () => {
    expect(normalizarImagensProduto([img("a"), img("b")])[0]).toEqual({ url: "a", isPrimary: true });
  });

  it("remove duplicatas e entradas vazias/inválidas", () => {
    const r = normalizarImagensProduto([img("a"), img("a"), img(" "), null, 42, { url: 7 }, img("b")]);
    expect(r.map(i => i.url)).toEqual(["a", "b"]);
  });

  it("duplicata marcada como capa transfere a capa pra 1ª ocorrência", () => {
    const r = normalizarImagensProduto([img("a"), img("b"), img("b", true)]);
    expect(r[0].url).toBe("b");
    expect(r.filter(i => i.isPrimary)).toHaveLength(1);
  });

  it("aceita o formato antigo (URL solta)", () => {
    const r = normalizarImagensProduto(["a", "b"]);
    expect(r.map(i => i.url)).toEqual(["a", "b"]);
    expect(r[0].isPrimary).toBe(true);
  });

  it("produto antigo: só imageUrl, sem galeria", () => {
    expect(normalizarImagensProduto([], "capa")).toEqual([{ url: "capa", isPrimary: true }]);
    expect(normalizarImagensProduto(null, "capa")).toEqual([{ url: "capa", isPrimary: true }]);
  });

  it("imageUrl que já está na galeria não duplica e define a capa quando nada estava marcado", () => {
    const r = normalizarImagensProduto(["a", "b", "c"], "b");
    expect(r.map(i => i.url)).toEqual(["b", "a", "c"]);
  });

  it("imageUrl fora da galeria entra na frente como capa", () => {
    const r = normalizarImagensProduto([img("a", true), img("b")], "capa");
    expect(r.map(i => [i.url, i.isPrimary])).toEqual([["capa", true], ["a", false], ["b", false]]);
  });

  it("entrada inválida vira lista vazia", () => {
    expect(normalizarImagensProduto(undefined)).toEqual([]);
    expect(normalizarImagensProduto("texto")).toEqual([]);
    expect(normalizarImagensProduto([], "")).toEqual([]);
  });
});

describe("galeriaDoProduto", () => {
  it("devolve as URLs com a capa primeiro (o bug: só a capa aparecia na loja)", () => {
    const g = galeriaDoProduto({ imageUrl: "b", images: [img("a"), img("b", true), img("c")] });
    expect(g).toEqual(["b", "a", "c"]);
  });

  it("produto com mais de 6 fotos antigas mostra só 6 na loja", () => {
    const g = galeriaDoProduto({ imageUrl: "f1", images: Array.from({ length: 10 }, (_, i) => img(`f${i + 1}`, i === 0)) });
    expect(g).toHaveLength(6);
  });
});
