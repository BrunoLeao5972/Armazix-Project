// Validação de CPF/CNPJ pelo algoritmo oficial de dígito verificador (mod 11).
// Uso isomórfico: mesma lógica no cliente (feedback imediato no formulário) e
// no servidor (nunca confiar só na validação do client).

export function isValidCPF(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false; // 111.111.111-11 etc. passam no length mas não são CPF real

  const checkDigit = (base: string): number => {
    let total = 0;
    let factor = base.length + 1;
    for (const digit of base) {
      total += Number(digit) * factor--;
    }
    const remainder = total % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const base9 = digits.slice(0, 9);
  const digit1 = checkDigit(base9);
  const digit2 = checkDigit(base9 + digit1);

  return digits === base9 + digit1 + digit2;
}

export function isValidCNPJ(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;

  const checkDigit = (base: string): number => {
    const weights = base.length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let total = 0;
    for (let i = 0; i < base.length; i++) {
      total += Number(base[i]) * weights[i];
    }
    const remainder = total % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const base12 = digits.slice(0, 12);
  const digit1 = checkDigit(base12);
  const digit2 = checkDigit(base12 + digit1);

  return digits === base12 + digit1 + digit2;
}

export function isValidDocument(value: string, type: "cpf" | "cnpj"): boolean {
  return type === "cpf" ? isValidCPF(value) : isValidCNPJ(value);
}
