import { describe, it, expect } from "vitest";
import {
  apenasDigitos, tipoDocumento, validarCPF, validarCNPJ, validarCpfCnpj, formatarCpfCnpj, maskCpfCnpjDigitado,
  mascararCpfCnpj,
} from "@/lib/customer/cpf-cnpj";

// Gera dígitos verificadores a partir da mesma fórmula (documentada, Receita
// Federal), reimplementada aqui de forma independente do módulo testado —
// serve pra fabricar CPFs/CNPJs válidos com bases arbitrárias e confirmar
// que validarCPF/validarCNPJ aceitam qualquer um deles, não só os fixos.
function gerarCPF(base9: string): string {
  const n = base9.split("").map(Number);
  let soma = 0;
  for (let i = 0; i < 9; i++) soma += n[i] * (10 - i);
  let dv1 = (soma * 10) % 11; if (dv1 === 10) dv1 = 0;
  soma = 0;
  for (let i = 0; i < 9; i++) soma += n[i] * (11 - i);
  soma += dv1 * 2;
  let dv2 = (soma * 10) % 11; if (dv2 === 10) dv2 = 0;
  return base9 + dv1 + dv2;
}
function gerarCNPJ(base12: string): string {
  const n = base12.split("").map(Number);
  const p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const p2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let soma = 0;
  for (let i = 0; i < 12; i++) soma += n[i] * p1[i];
  let r = soma % 11; const dv1 = r < 2 ? 0 : 11 - r;
  soma = 0;
  for (let i = 0; i < 12; i++) soma += n[i] * p2[i];
  soma += dv1 * p2[12];
  r = soma % 11; const dv2 = r < 2 ? 0 : 11 - r;
  return base12 + dv1 + dv2;
}

describe("apenasDigitos", () => {
  it("remove tudo que não é dígito e trata null/undefined", () => {
    expect(apenasDigitos("123.456.789-09")).toBe("12345678909");
    expect(apenasDigitos(null)).toBe("");
    expect(apenasDigitos(undefined)).toBe("");
  });
});

describe("tipoDocumento", () => {
  it("11 dígitos é cpf, 14 é cnpj, o resto não é nenhum dos dois", () => {
    expect(tipoDocumento("123.456.789-09")).toBe("cpf");
    expect(tipoDocumento("11.222.333/0001-81")).toBe("cnpj");
    expect(tipoDocumento("123")).toBeNull();
    expect(tipoDocumento("")).toBeNull();
  });
});

describe("validarCPF", () => {
  it("aceita CPFs válidos conhecidos (com e sem máscara)", () => {
    expect(validarCPF("111.444.777-35")).toBe(true);
    expect(validarCPF("52998224725")).toBe(true);
    expect(validarCPF("123.456.789-09")).toBe(true);
  });

  it("aceita qualquer base gerada com o dígito verificador correto", () => {
    for (const base of ["123456789", "987654321", "555000111", "011223344"]) {
      expect(validarCPF(gerarCPF(base))).toBe(true);
    }
  });

  it("rejeita dígito verificador errado (mutação de 1 dígito no CPF válido)", () => {
    const valido = gerarCPF("123456789");
    const ultimoErrado = valido.slice(0, -1) + String((Number(valido.at(-1)) + 1) % 10);
    expect(validarCPF(ultimoErrado)).toBe(false);
  });

  it("rejeita sequência de dígitos repetidos (passa na máscara, nunca é um CPF real)", () => {
    for (const seq of ["00000000000", "11111111111", "99999999999"]) {
      expect(validarCPF(seq)).toBe(false);
    }
  });

  it("rejeita tamanho errado ou vazio", () => {
    expect(validarCPF("123456789")).toBe(false);
    expect(validarCPF("")).toBe(false);
    expect(validarCPF(null)).toBe(false);
    expect(validarCPF(undefined)).toBe(false);
  });
});

describe("validarCNPJ", () => {
  it("aceita CNPJs válidos conhecidos (com e sem máscara)", () => {
    expect(validarCNPJ("11.222.333/0001-81")).toBe(true);
    expect(validarCNPJ("11444777000161")).toBe(true);
  });

  it("aceita qualquer base gerada com os dígitos verificadores corretos", () => {
    for (const base of ["123456780001", "111222330001", "000111000001"]) {
      expect(validarCNPJ(gerarCNPJ(base))).toBe(true);
    }
  });

  it("rejeita dígito verificador errado (mutação de 1 dígito no CNPJ válido)", () => {
    const valido = gerarCNPJ("123456780001");
    const ultimoErrado = valido.slice(0, -1) + String((Number(valido.at(-1)) + 1) % 10);
    expect(validarCNPJ(ultimoErrado)).toBe(false);
  });

  it("rejeita sequência de dígitos repetidos", () => {
    expect(validarCNPJ("00000000000000")).toBe(false);
    expect(validarCNPJ("11111111111111")).toBe(false);
  });

  it("rejeita tamanho errado ou vazio", () => {
    expect(validarCNPJ("123")).toBe(false);
    expect(validarCNPJ("")).toBe(false);
    expect(validarCNPJ(null)).toBe(false);
  });
});

describe("validarCpfCnpj", () => {
  it("valida CPF (11) ou CNPJ (14) automaticamente pelo tamanho", () => {
    expect(validarCpfCnpj("111.444.777-35")).toBe(true);
    expect(validarCpfCnpj("11.222.333/0001-81")).toBe(true);
  });

  it("rejeita tamanho que não é nem CPF nem CNPJ", () => {
    expect(validarCpfCnpj("123456")).toBe(false);
    expect(validarCpfCnpj("")).toBe(false);
    expect(validarCpfCnpj(null)).toBe(false);
  });
});

describe("formatarCpfCnpj", () => {
  it("aplica a máscara certa por tamanho", () => {
    expect(formatarCpfCnpj("11144477735")).toBe("111.444.777-35");
    expect(formatarCpfCnpj("11222333000181")).toBe("11.222.333/0001-81");
  });

  it("tamanho desconhecido devolve o valor original", () => {
    expect(formatarCpfCnpj("123")).toBe("123");
    expect(formatarCpfCnpj(null)).toBe("");
  });
});

describe("maskCpfCnpjDigitado", () => {
  it("aplica a máscara de CPF enquanto tem até 11 dígitos", () => {
    expect(maskCpfCnpjDigitado("123456789")).toBe("123.456.789");
    expect(maskCpfCnpjDigitado("11144477735")).toBe("111.444.777-35");
  });

  it("a partir de 12 dígitos vira máscara de CNPJ", () => {
    expect(maskCpfCnpjDigitado("112223330001")).toBe("11.222.333/0001");
    expect(maskCpfCnpjDigitado("11222333000181")).toBe("11.222.333/0001-81");
  });

  it("nunca passa de 14 dígitos", () => {
    expect(maskCpfCnpjDigitado("112223330001819999")).toBe("11.222.333/0001-81");
  });
});

describe("mascararCpfCnpj", () => {
  it("CPF: mostra só os 3 primeiros e os 2 últimos dígitos, esconde o miolo", () => {
    expect(mascararCpfCnpj("11144477735")).toBe("111.***.***-35");
    expect(mascararCpfCnpj("123.456.789-09")).toBe("123.***.***-09");
  });

  it("CNPJ: mostra só os 2 primeiros e os 2 últimos dígitos, esconde o miolo", () => {
    expect(mascararCpfCnpj("11222333000181")).toBe("11.***.***/****-81");
    expect(mascararCpfCnpj("50.415.858/0001-95")).toBe("50.***.***/****-95");
  });

  it("nunca revela dígito nenhum do miolo, nem em documentos com dígitos repetidos", () => {
    const mascarado = mascararCpfCnpj("11144477735");
    expect(mascarado).not.toContain("444");
    expect(mascarado).not.toContain("777");
  });

  it("tamanho desconhecido ou vazio devolve string vazia (nunca o valor cru)", () => {
    expect(mascararCpfCnpj("123")).toBe("");
    expect(mascararCpfCnpj(null)).toBe("");
    expect(mascararCpfCnpj(undefined)).toBe("");
  });
});
