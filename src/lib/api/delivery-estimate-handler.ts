// ─────────────────────────────────────────────────────────────────────────
// Estimativa pública de frete — preview no checkout, antes do cliente
// confirmar o pedido. Usa o mesmo estimateDelivery() que priceOrder() chama
// na hora de fechar o pedido de verdade, então o valor mostrado aqui nunca
// diverge do que será cobrado — só não cria pedido nem baixa estoque.
// ─────────────────────────────────────────────────────────────────────────

import { createDb } from "@/lib/db";
import { estimateDelivery } from "@/lib/pricing/order-pricing";

export async function estimateDeliveryHandler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const storeId = url.searchParams.get("storeId");
  const subtotalRaw = parseFloat(url.searchParams.get("subtotal") || "0");
  const street = url.searchParams.get("street");
  const city = url.searchParams.get("city");
  const state = url.searchParams.get("state");

  if (!storeId) {
    return new Response(JSON.stringify({ error: "storeId é obrigatório" }), {
      status: 400, headers: { "content-type": "application/json" },
    });
  }

  const db = createDb(process.env.DATABASE_URL!);

  const result = await estimateDelivery(db, {
    storeId,
    type: "delivery",
    subtotal: Number.isFinite(subtotalRaw) ? subtotalRaw : 0,
    addressSnapshot: street && city && state
      ? {
          street,
          number:       url.searchParams.get("number") ?? "",
          neighborhood: url.searchParams.get("neighborhood") ?? "",
          city,
          state,
          zip:          url.searchParams.get("zip") ?? "",
        }
      : null,
  });

  if ("error" in result) {
    return new Response(JSON.stringify({ error: result.error }), {
      status: result.status, headers: { "content-type": "application/json" },
    });
  }

  return new Response(JSON.stringify(result), {
    status: 200, headers: { "content-type": "application/json" },
  });
}
