// Mesma convenção do backend Armazix: preço trafega e é armazenado como
// string decimal ("12.90"), nunca float — evita erro de arredondamento em
// dinheiro. Só vira number no último passo, pra exibir.
export function formatPrice(value: string | number): string {
  const n = typeof value === "string" ? parseFloat(value) : value;
  return (Number.isFinite(n) ? n : 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function money(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}
