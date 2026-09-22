// ─────────────────────────────────────────────────────────────────────────
// Validação de CPF/CNPJ — módulo puro, sem DB, sem React.
//
// Valida de verdade (dígitos verificadores, algoritmo da Receita Federal),
// não só o formato/máscara. Uma sequência com 11 ou 14 dígitos iguais
// (ex.: "000.000.000-00", "111.111.111-11") passa em qualquer máscara mas
// nunca é um documento real — por isso é rejeitada aqui.
// ─────────────────────────────────────────────────────────────────────────

export type TipoDocumento = "cpf" | "cnpj";

export const apenasDigitos = (v: string | null | undefined): string => (v ?? "").replace(/\D/g, "");

/** 11 dígitos → cpf, 14 → cnpj, qualquer outro tamanho → null (não dá pra saber qual validar). */
export function tipoDocumento(v: string | null | undefined): TipoDocumento | null {
  const d = apenasDigitos(v);
  if (d.length === 11) return "cpf";
  if (d.length === 14) return "cnpj";
  return null;
}

const TODOS_IGUAIS = (d: string) => new RegExp(`^(\\d)\\1{${d.length - 1}}$`).test(d);

export function validarCPF(v: string | null | undefined): boolean {
  const d = apenasDigitos(v);
  if (d.length !== 11 || TODOS_IGUAIS(d)) return false;
  const n = d.split("").map(Number);

  let soma = 0;
  for (let i = 0; i < 9; i++) soma += n[i] * (10 - i);
  let dv1 = (soma * 10) % 11;
  if (dv1 === 10) dv1 = 0;
  if (dv1 !== n[9]) return false;

  soma = 0;
  for (let i = 0; i < 10; i++) soma += n[i] * (11 - i);
  let dv2 = (soma * 10) % 11;
  if (dv2 === 10) dv2 = 0;
  return dv2 === n[10];
}

const PESOS_CNPJ_1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const PESOS_CNPJ_2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

export function validarCNPJ(v: string | null | undefined): boolean {
  const d = apenasDigitos(v);
  if (d.length !== 14 || TODOS_IGUAIS(d)) return false;
  const n = d.split("").map(Number);

  const dv = (pesos: number[], len: number) => {
    let soma = 0;
    for (let i = 0; i < len; i++) soma += n[i] * pesos[i];
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  if (dv(PESOS_CNPJ_1, 12) !== n[12]) return false;
  return dv(PESOS_CNPJ_2, 13) === n[13];
}

/** Valida como CPF (11 dígitos) ou CNPJ (14 dígitos); qualquer outro tamanho é inválido. */
export function validarCpfCnpj(v: string | null | undefined): boolean {
  const tipo = tipoDocumento(v);
  if (tipo === "cpf") return validarCPF(v);
  if (tipo === "cnpj") return validarCNPJ(v);
  return false;
}

/** Formata para exibição: "000.000.000-00" ou "00.000.000/0000-00". Sem máscara se o tamanho não bate com nenhum dos dois. */
export function formatarCpfCnpj(v: string | null | undefined): string {
  const d = apenasDigitos(v);
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return v ?? "";
}

/** Máscara progressiva pra campo de digitação: CPF até 11 dígitos, CNPJ de 12 a 14. */
export function maskCpfCnpjDigitado(v: string): string {
  const d = apenasDigitos(v).slice(0, 14);
  if (d.length <= 11) {
    return d.replace(/(\d{3})(\d{3})(\d{0,3})(\d{0,2})/, (_m, a, b, c, e) => [a, b, c].filter(Boolean).join(".") + (e ? `-${e}` : ""));
  }
  return d.replace(/(\d{2})(\d{3})(\d{3})(\d{0,4})(\d{0,2})/, (_m, a, b, c, e, f) => `${a}.${b}.${c}` + (e ? `/${e}` : "") + (f ? `-${f}` : ""));
}

// Máscara de exibição protegida: mostra só as pontas, esconde o miolo.
// CPF (sensível — nunca mostrado por inteiro): 123.***.***-12
// CNPJ (registro público — pode ter botão de "visualizar" em cima disto): 50.***.***/****-95
export function mascararCpfCnpj(v: string | null | undefined): string {
  const d = apenasDigitos(v);
  if (d.length === 11) return `${d.slice(0, 3)}.***.***-${d.slice(-2)}`;
  if (d.length === 14) return `${d.slice(0, 2)}.***.***/****-${d.slice(-2)}`;
  return "";
}
