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
  "🛒 *NOVO PEDIDO RECEBIDO* 🎉\n\n📄 Pedido: *#{{numero}}*\n🕒 Recebido em: {{data}}\n\n👤 Cliente: {{nome}}\n\n📦 *Itens do pedido:*\n{{itens}}\n\n💰 Subtotal: R$ {{subtotal}}\n🚚 Frete: {{frete}}\n💳 Forma de pagamento: {{pagamento}}\n💵 Total: *R$ {{total}}*\n\n📍 Entrega: {{entrega}}\n\n⚠️ *Ação necessária:* Acesse o painel da Armazix para confirmar o pedido e iniciar o atendimento.\n\nBoas vendas! 🚀";

export const DEFAULT_CUSTOMER_TEMPLATES: WppConfig["customerTemplates"] = {
  received:
    "🎉 *Recebemos o seu pedido!*\n\nOlá, *{{nome}}*! Seu pedido foi recebido com sucesso e já está na nossa fila de atendimento. 💚\n\n📄 *Pedido:* #{{numero}}\n\n📦 *Resumo do pedido:*\n{{itens}}\n\n💰 *Total:* *R$ {{total}}*\n💳 *Pagamento:* {{pagamento}}\n\n⏳ *Status:* *Pedido recebido*\n\nNossa equipe irá analisar seu pedido e, em breve, ele será confirmado para preparação ou envio. Você receberá novas atualizações por aqui conforme o andamento.\n\nAgradecemos pela preferência! 🛍️",
  preparing:
    "⏰ *Seu pedido está em preparo!*\n\nOlá, *{{nome}}*! Já começamos a preparar o seu pedido. 💚\n\n📄 *Pedido:* #{{numero}}\n\n⏳ *Status:* Em preparo\n\nNossa equipe está separando os itens. Assim que o pedido estiver pronto para envio ou retirada, você receberá uma nova atualização por aqui.\n\nObrigado pela preferência! 🛍️",
  ready:
    "📦 *Seu pedido está pronto para retirada!*\n\nOlá, *{{nome}}*! Seu pedido já está disponível para retirada. 🎉\n\n📄 *Pedido:* #{{numero}}\n\n🏪 *Status:* *Pronto para retirada*\n\n📍 *Endereço para retirada:*\n{{endereco}}\n\n⏰ Retire seu pedido dentro do horário de atendimento da loja.\n\nEm caso de dúvidas, responda esta mensagem ou entre em contato conosco.\n\nAgradecemos pela preferência! 💚",
  delivering:
    "🚚 *Seu pedido saiu para entrega!*\n\nOlá, *{{nome}}*! Seu pedido já está a caminho. 🎉\n\n📄 *Pedido:* #{{numero}}\n\n🚚 *Status:* *Saiu para entrega*\n\nEm breve o entregador chegará ao endereço informado. Fique atento ao celular caso seja necessário entrar em contato durante a entrega.\n\nAgradecemos pela preferência! 💚",
  delivered:
    "✅ *Pedido entregue!*\n\nOlá, *{{nome}}*! Seu pedido foi entregue com sucesso. Esperamos que tenha gostado da sua experiência! 💚\n\n📄 *Pedido:* #{{numero}}\n\n📦 *Status:* *Entregue*\n\nAgradecemos pela confiança e por escolher nossa loja. Sempre que precisar, estaremos à disposição!\n\nAté a próxima! 🛍️",
  cancelled:
    "❌ *Pedido cancelado*\n\nOlá, *{{nome}}*.\n\nInformamos que o seu pedido foi cancelado.\n\n📄 *Pedido:* #{{numero}}\n\n📌 *Status:* *Cancelado*\n\nSe o cancelamento foi realizado por engano ou se você tiver qualquer dúvida, entre em contato com nossa equipe. Teremos prazer em ajudar.\n\nAgradecemos pela compreensão. 💚",
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

const PAYMENT_LABELS: Record<string, string> = {
  pix: "PIX",
  credit: "Cartão de crédito",
  credit_card: "Cartão de crédito",
  debit: "Cartão de débito",
  debit_card: "Cartão de débito",
  cash: "Dinheiro",
  money: "Dinheiro",
  bank_transfer: "Transferência bancária",
  boleto: "Boleto",
  voucher: "Vale/Voucher",
};

type StoreAddress = { street: string; number: string; neighborhood: string; city: string; state: string; zip: string; complement?: string };

function formatStoreAddress(addr: StoreAddress): string {
  const line1 = `${addr.street}, ${addr.number} – ${addr.neighborhood}`;
  const line2 = `${addr.city}/${addr.state} – CEP ${addr.zip}${addr.complement ? ` – *${addr.complement}*` : ""}`;
  return `${line1}\n${line2}`;
}

interface OrderNotifyParams {
  storeId: string;
  storeName: string;
  orderNumber: number;
  customerName: string;
  customerPhone?: string | null;
  total: string;
  subtotal?: string;
  deliveryFee?: string | null;
  paymentMethod?: string | null;
  entrega?: string;
  storeAddress?: StoreAddress | null;
  items: string;
  status: string;
  wppConfig: WppConfig | null | undefined;
}

/** Notifica lojista em novo pedido */
export async function notifyOwnerNewOrder(p: OrderNotifyParams): Promise<void> {
  const cfg = p.wppConfig;
  if (!cfg?.notifyOwner || !cfg.ownerPhone) return;

  const template = cfg.ownerTemplate || DEFAULT_OWNER_TEMPLATE;

  const now = new Date();
  const dataBR = now.toLocaleDateString("pt-BR") + " às " + now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const freteNum = p.deliveryFee ? parseFloat(p.deliveryFee) : 0;
  const freteLabel = freteNum > 0 ? `R$ ${freteNum.toFixed(2).replace(".", ",")}` : "Grátis";

  const pagLabel = p.paymentMethod
    ? (PAYMENT_LABELS[p.paymentMethod.toLowerCase()] ?? p.paymentMethod)
    : "Não informado";

  const text = fillTemplate(template, {
    numero:    String(p.orderNumber),
    nome:      p.customerName,
    total:     parseFloat(p.total).toFixed(2).replace(".", ","),
    subtotal:  p.subtotal ? parseFloat(p.subtotal).toFixed(2).replace(".", ",") : parseFloat(p.total).toFixed(2).replace(".", ","),
    frete:     freteLabel,
    pagamento: pagLabel,
    entrega:   p.entrega ?? "Não informado",
    data:      dataBR,
    itens:     p.items,
    loja:      p.storeName,
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

  const pagLabel = p.paymentMethod
    ? (PAYMENT_LABELS[p.paymentMethod.toLowerCase()] ?? p.paymentMethod)
    : "Não informado";

  const enderecoLabel = p.storeAddress
    ? formatStoreAddress(p.storeAddress)
    : "Consulte o contato da loja";

  const text = fillTemplate(template, {
    numero:   String(p.orderNumber),
    nome:     p.customerName,
    total:    parseFloat(p.total).toFixed(2).replace(".", ","),
    loja:     p.storeName,
    itens:    p.items,
    pagamento: pagLabel,
    endereco: enderecoLabel,
  });

  await sendWppText(p.storeId, p.customerPhone, text);
}
