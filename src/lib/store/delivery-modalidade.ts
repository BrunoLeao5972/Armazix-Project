// ─────────────────────────────────────────────────────────────────────────
// Modalidade de entrega (Configurações → Entrega → "Modalidade": Todas /
// Apenas Delivery / Apenas Retirada) → flags que o resto do sistema lê de
// verdade.
//
// A aba salva a escolha em `deliveryConfig.modalidade`, mas quem decide o
// que a loja pública e o checkout mostram ao cliente (botões Delivery/
// Retirada, texto "Retirada no local disponível", cálculo de frete) são as
// colunas `stores.deliveryEnabled` / `stores.pickupEnabled` (ver
// src/routes/store/checkout.tsx, src/routes/store.tsx). Sem esta ponte, o
// lojista trocava a modalidade e via a confirmação de salvo, mas a loja
// continuava oferecendo Delivery + Retirada do jeito que já estava — os
// dois campos nunca eram tocados.
// ─────────────────────────────────────────────────────────────────────────

export interface DeliveryPickupFlags {
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
}

const MODALIDADES: Record<string, DeliveryPickupFlags> = {
  todas:    { deliveryEnabled: true,  pickupEnabled: true  },
  delivery: { deliveryEnabled: true,  pickupEnabled: false },
  retirada: { deliveryEnabled: false, pickupEnabled: true  },
};

/**
 * `modalidade` desconhecida ou ausente (payload parcial, ou loja antiga sem
 * essa config) devolve null — o update não mexe nos flags já salvos.
 */
export function deriveDeliveryPickupFlags(modalidade: unknown): DeliveryPickupFlags | null {
  return typeof modalidade === "string" ? (MODALIDADES[modalidade] ?? null) : null;
}
