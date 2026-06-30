// ─── WhatsApp Sender ─────────────────────────────────────────────────────────
// Utility para envio de mensagens via Evolution API.
// Usado pelos handlers de pedido (createOrder, updateOrderStatus).

export type WppConfig = {
  notifyOwner: boolean;
  ownerPhone: string;
  ownerTemplate: string;
  notifyCustomer: boolean;
  notifyStatuses: string[];
  customerTemplates: {
    received: string;
    preparing: string;
    ready: string;
    delivering: string;
    delivered: string;
    cancelled: string;
  };
};

export const DEFAULT_OWNER_TEMPLATE =
  "🛒 *Novo pedido #{{numero}}*\n\n👤 {{nome}}\n💰 Total: R$ {{total}}\n📦 {{itens}}\n\nAcesse o painel para confirmar.";

export const DEFAULT_CUSTOMER_TEMPLATES: WppConfig["customerTemplates"] = {
  received:
    "Olá, {{nome}}! 🎉 Seu pedido *#{{numero}}* foi recebido!\n\n💰 Total: R$ {{total}}\n\nEm instantes começaremos a preparar. Obrigado por escolher a *{{loja}}*!",
  preparing:
    "👨‍🍳 Seu pedido *#{{numero}}* está sendo preparado!\n\nAguarde um pouquinho, logo estará pronto. 😊",
  ready:
    "✅ Pedido *#{{numero}}* pronto para retirada!\n\nVenha buscar quando quiser. Te esperamos! 🏃",
  delivering:
    "🚀 Seu pedido *#{{numero}}* saiu para entrega!\n\nNosso entregador está a caminho. Fique de olho! 📍",
  delivered:
    "✅ Pedido *#{{numero}}* entregue! Esperamos que tenha curtido! ❤️\n\nObrigado por comprar na *{{loja}}*. Volte sempre!",
  cancelled:
    "😔 Infelizmente seu pedido *#{{numero}}* foi cancelado.\n\nQualquer dúvida, entre em contato. Pedimos desculpas pelo transtorno.",
};

export const DEFAULT_WPP_CONFIG: WppConfig = {
  notifyOwner: true,
  ownerPhone: "",
  ownerTemplate: DEFAULT_OWNER_TEMPLATE,
  notifyCustomer: true,
  notifyStatuses: ["received", "preparing", "delivering", "delivered", "cancelled"],
  customerTemplates: DEFAULT_CUSTOMER_TEMPLATES,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Normaliza número para formato E.164 sem '+': 5511999999999 */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) return digits;
  if (digits.length === 11 || digits.length === 10) return `55${digits}`;
  return digits;
}

/** Substitui {{variavel}} no template */
export function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

function instanceName(storeId: string) {
  return `armazix_${storeId.replace(/-/g, "").slice(0, 16)}`;
}

// ── Envio ─────────────────────────────────────────────────────────────────────

export async function sendWppText(
  storeId: string,
  phone: string,
  text: string
): Promise<void> {
  const EVO_URL = (process.env.EVOLUTION_API_URL ?? "").replace(/\/$/, "");
  const EVO_KEY = process.env.EVOLUTION_API_KEY ?? "";

  if (!EVO_URL || !EVO_KEY) return;

  const instance = instanceName(storeId);
  const number = normalizePhone(phone);
  if (number.length < 10) return;

  await fetch(`${EVO_URL}/message/sendText/${instance}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: EVO_KEY },
    body: JSON.stringify({ number, text }),
  }).catch((e) => console.error("[wpp] sendText error:", e));
}

// ── Disparos de pedido ────────────────────────────────────────────────────────

interface OrderNotifyParams {
  storeId: string;
  storeName: string;
  orderNumber: number;
  customerName: string;
  customerPhone?: string | null;
  total: string;
  items: string;         // "📦 Produto x2\n📦 Outro x1"
  status: string;
  wppConfig: WppConfig | null | undefined;
}

/** Notifica lojista em novo pedido */
export async function notifyOwnerNewOrder(p: OrderNotifyParams): Promise<void> {
  const cfg = p.wppConfig;
  if (!cfg?.notifyOwner || !cfg.ownerPhone) return;

  const template = cfg.ownerTemplate || DEFAULT_OWNER_TEMPLATE;
  const text = fillTemplate(template, {
    numero: String(p.orderNumber),
    nome: p.customerName,
    total: parseFloat(p.total).toFixed(2).replace(".", ","),
    itens: p.items,
    loja: p.storeName,
  });

  await sendWppText(p.storeId, cfg.ownerPhone, text);
}

/** Notifica cliente em mudança de status */
export async function notifyCustomerStatus(p: OrderNotifyParams): Promise<void> {
  const cfg = p.wppConfig;
  if (!cfg?.notifyCustomer || !p.customerPhone) return;
  if (!cfg.notifyStatuses.includes(p.status)) return;

  const key = p.status as keyof WppConfig["customerTemplates"];
  const template =
    cfg.customerTemplates?.[key] ||
    DEFAULT_CUSTOMER_TEMPLATES[key] ||
    "";
  if (!template) return;

  const text = fillTemplate(template, {
    numero: String(p.orderNumber),
    nome: p.customerName,
    total: parseFloat(p.total).toFixed(2).replace(".", ","),
    loja: p.storeName,
    itens: p.items,
  });

  await sendWppText(p.storeId, p.customerPhone, text);
}
