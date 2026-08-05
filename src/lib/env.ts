// Ponto único de leitura de variáveis de ambiente sensíveis. Nunca cair para
// um valor default aqui — é preferível um 500 visível a um bypass silencioso.

export function requireJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET não configurado neste ambiente");
  }
  return secret;
}
