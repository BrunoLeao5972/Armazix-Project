import { describe, it, expect } from "vitest";
import { motivoLabel } from "@/lib/orders/motivos";

describe("motivoLabel", () => {
  it("sem observação devolve só o rótulo do motivo", () => {
    expect(motivoLabel("outro", null)).toBe("Outro motivo");
  });

  it("não duplica quando a observação guardada é o próprio rótulo", () => {
    expect(motivoLabel("outro", "Outro motivo")).toBe("Outro motivo");
  });

  it("junta motivo e observação do operador", () => {
    expect(motivoLabel("outro", "troco errado")).toBe("Outro motivo — troco errado");
  });

  it("sem nada informado", () => {
    expect(motivoLabel(null, null)).toBe("Sem motivo informado");
  });
});
