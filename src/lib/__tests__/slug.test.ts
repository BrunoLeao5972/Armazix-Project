import { describe, expect, it } from "vitest";
import { generateCleanSlug, isCleanSlug } from "@/lib/slug";

describe("generateCleanSlug", () => {
  it("removes accents, spaces, hyphens and symbols", () => {
    expect(generateCleanSlug("Bruno Info Mais")).toBe("brunoinfomais");
    expect(generateCleanSlug("Mercado São João & Cia")).toBe("mercadosaojoaocia");
    expect(generateCleanSlug("Fulano-Super Loja")).toBe("fulanosuperloja");
  });

  it("keeps only alphanumeric clean slugs", () => {
    expect(isCleanSlug("brunoinfomais")).toBe(true);
    expect(isCleanSlug("bruno-info-mais")).toBe(false);
    expect(isCleanSlug("bruno info mais")).toBe(false);
  });
});