// Trava em memória, compartilhada entre o quadro de Pedidos (pedidos.tsx) e o
// vigia global de pedidos (-order-notifier.tsx). Os dois rodam o aceite
// automático: o quadro só enquanto está montado, o vigia em qualquer tela do
// admin. Quando a tela de Pedidos está aberta os dois correm em paralelo —
// sem esta trava, o mesmo pedido podia receber dois POST
// /api/orders/update-status quase simultâneos.
//
// Roda tudo no mesmo isolate (a mesma aba), então um Set em nível de módulo
// já basta: JS é single-thread, o check-and-set abaixo é atômico.

const emAndamento = new Set<string>();

/**
 * Tenta reservar o pedido para o aceite automático.
 * `true`  → reservou; o chamador deve prosseguir e chamar `liberar...` no fim.
 * `false` → já tem outro fluxo cuidando dele; não faça nada.
 */
export function reservarAceiteAutomatico(orderId: string): boolean {
  if (emAndamento.has(orderId)) return false;
  emAndamento.add(orderId);
  return true;
}

export function liberarAceiteAutomatico(orderId: string): void {
  emAndamento.delete(orderId);
}
