// ─── Thermal Print Layout Builder ────────────────────────────────────────────
// Generates structured ThermalLine arrays for preview (React) and ESC/POS output.
// No external dependencies — pure TypeScript, isomorphic (server + browser).

// ─── Low-level ESC/POS byte constants ────────────────────────────────────────
const ESC = "\x1B";
const GS  = "\x1D";

export const ESCPOS = {
  // Initialise printer (clears buffers, resets settings)
  INIT:             `${ESC}@`,

  // ── Alignment ──────────────────────────────────────────────────────────────
  ALIGN_LEFT:       `${ESC}a\x00`,
  ALIGN_CENTER:     `${ESC}a\x01`,
  ALIGN_RIGHT:      `${ESC}a\x02`,

  // ── Emphasis ───────────────────────────────────────────────────────────────
  BOLD_ON:          `${ESC}E\x01`,   // ESC E 1
  BOLD_OFF:         `${ESC}E\x00`,   // ESC E 0

  // ── Font selection (ESC M n) ───────────────────────────────────────────────
  // Font A: standard pitch, ~12×24 dots — default on most thermal heads
  FONT_A:           `${ESC}M\x00`,   // ESC M 0
  // Font B: condensed pitch, ~9×17 dots — fits more chars per line
  FONT_B:           `${ESC}M\x01`,   // ESC M 1

  // ── Character size (GS ! n) ───────────────────────────────────────────────
  // n is a bitmask: bits 2–0 = width multiplier, bits 6–4 = height multiplier
  // (0 = 1×, 1 = 2×, …)  Most 58/80 mm heads honour at least 1× and 2×.
  SIZE_NORMAL:      `${GS}!\x00`,    // GS ! 0  — 1× width, 1× height
  DOUBLE_HEIGHT:    `${GS}!\x10`,    // GS ! 16 — 1× width, 2× height
  DOUBLE_WIDTH:     `${GS}!\x01`,    // GS ! 1  — 2× width, 1× height
  DOUBLE_BOTH:      `${GS}!\x11`,    // GS ! 17 — 2× width, 2× height

  // ── Paper feed and cut ────────────────────────────────────────────────────
  FEED_3:           `${ESC}d\x03`,   // feed 3 lines before cut
  CUT_FULL:         `${GS}V\x00`,    // full paper cut

  // ── Backwards-compat aliases (kept so existing call-sites don't break) ────
  DOUBLE_ON:        `${GS}!\x11`,    // was ESC ! 0x30 — same visual effect
  DOUBLE_OFF:       `${GS}!\x00`,
} as const;

// ─── ThermalLine — atomic unit of output ─────────────────────────────────────
export interface ThermalLine {
  text: string;
  // Style flags — compose freely; serialiser emits minimal byte sequence
  bold?:       boolean;   // ESC E 1 / ESC E 0
  condensed?:  boolean;   // Font B (9×17) — ideal for item lists / add-ons
  doubleH?:    boolean;   // 2× height only
  doubleW?:    boolean;   // 2× width only
  doubleBoth?: boolean;   // 2× height + 2× width (order titles, totals)
  // Alignment
  center?:     boolean;
  right?:      boolean;
  // Divider shorthand — renders `char.repeat(cols)` ignoring `text`
  separator?:  "=" | "-" | "*" | "+" | "─";
}

// ─── String helpers ───────────────────────────────────────────────────────────

/**
 * Pad/truncate `text` to exactly `columns` chars, aligned left / right / center.
 * Long strings are hard-truncated so they never overflow the column grid.
 */
export function formatLine(
  text: string,
  alignment: "left" | "right" | "center" = "left",
  columns: number,
): string {
  const s    = String(text ?? "").slice(0, columns);
  const diff = columns - s.length;
  if (diff <= 0) return s;
  switch (alignment) {
    case "right":  return " ".repeat(diff) + s;
    case "center": return " ".repeat(Math.floor(diff / 2)) + s + " ".repeat(Math.ceil(diff / 2));
    default:       return s + " ".repeat(diff);
  }
}

// Legacy short aliases used by layout builders
export const pad    = formatLine;
export const center = (t: string, c: number) => formatLine(t, "center", c);
export const right  = (t: string, c: number) => formatLine(t, "right",  c);

/** Two-column row: left text padded, right text flush-right. */
export function twoCol(leftText: string, rightText: string, cols: number): string {
  const r = String(rightText);
  return formatLine(leftText, "left", cols - r.length) + r;
}

export function divider(char: string, cols: number): string {
  return char.repeat(cols);
}

export function fmtMoney(v: number | string): string {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return `R$ ${(isNaN(n) ? 0 : n).toFixed(2).replace(".", ",")}`;
}

/** Word-wrap `text` to `maxLen`-char lines, preserving words. */
function wrapText(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];
  const lines: string[] = [];
  let cur = "";
  for (const word of text.split(" ")) {
    const cand = cur ? `${cur} ${word}` : word;
    if (cand.length <= maxLen) { cur = cand; }
    else {
      if (cur) lines.push(cur);
      // force-break a single word longer than maxLen
      cur = word.slice(0, maxLen);
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

// ─── Serialise ThermalLine[] → plain text (preview / download) ───────────────
export function linesToText(lines: ThermalLine[], cols: number): string {
  return lines.map(l => {
    if (l.separator) return l.separator.repeat(cols);
    if (l.center)    return center(l.text, cols);
    if (l.right)     return right(l.text, cols);
    return l.text;
  }).join("\n");
}

// Remove diacritics so accented chars (ã é ê ç ó etc.) print as plain ASCII
// on printers that use Code Page 850/437. Applied only to the ESC/POS output;
// the text preview in the browser keeps the original accents.
function toEscposAscii(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// ─── Serialise ThermalLine[] → ESC/POS binary string ─────────────────────────
// The string uses single-byte chars so Buffer.from(str, "binary") yields raw bytes.
export function linesToEscPos(lines: ThermalLine[], _cols: number): string {
  let out = ESCPOS.INIT + ESCPOS.ALIGN_LEFT + ESCPOS.FONT_A + ESCPOS.SIZE_NORMAL;

  for (const l of lines) {
    // ── Divider line ──────────────────────────────────────────────────────────
    if (l.separator) {
      // Map Unicode box-drawing separators to ASCII safe equivalents
      const safeChar = l.separator === "─" ? "-" : l.separator;
      out += safeChar.repeat(_cols) + "\n";
      continue;
    }

    // ── Font ──────────────────────────────────────────────────────────────────
    out += l.condensed ? ESCPOS.FONT_B : ESCPOS.FONT_A;

    // ── Emphasis ──────────────────────────────────────────────────────────────
    if (l.bold || l.doubleBoth) out += ESCPOS.BOLD_ON;

    // ── Size ──────────────────────────────────────────────────────────────────
    if      (l.doubleBoth) out += ESCPOS.DOUBLE_BOTH;
    else if (l.doubleH)    out += ESCPOS.DOUBLE_HEIGHT;
    else if (l.doubleW)    out += ESCPOS.DOUBLE_WIDTH;

    // ── Alignment ─────────────────────────────────────────────────────────────
    if      (l.center) out += ESCPOS.ALIGN_CENTER;
    else if (l.right)  out += ESCPOS.ALIGN_RIGHT;
    else               out += ESCPOS.ALIGN_LEFT;

    // ── Text (strip diacritics for printer compatibility) ─────────────────────
    out += toEscposAscii(l.text);

    // ── Reset (reverse order) ─────────────────────────────────────────────────
    if (l.doubleBoth || l.doubleH || l.doubleW) out += ESCPOS.SIZE_NORMAL;
    if (l.bold || l.doubleBoth)                 out += ESCPOS.BOLD_OFF;
    if (l.condensed) out += ESCPOS.FONT_A;
    out += ESCPOS.ALIGN_LEFT;
    out += "\n";
  }

  out += ESCPOS.FEED_3 + ESCPOS.CUT_FULL;
  return out;
}

// ─── Sample data for test / preview prints ───────────────────────────────────
export interface SampleStore { name: string; address: string; phone: string; url?: string; }
export interface SampleItem  { qty: number; name: string; unitPrice: number; total: number; notes?: string; }
export interface SampleAddress {
  street: string; number: string; neighborhood: string;
  complement?: string; city: string; reference?: string;
}
export interface SampleOrder {
  number: number; time: string; date: string;
  customerName: string; customerPhone: string;
  type: "delivery" | "pickup";
  paymentMethod: string; paymentStatus: "paid" | "pending";
  subtotal: number; deliveryFee: number; discount: number; total: number;
  changeFor?: number;
  items: SampleItem[];
  address: SampleAddress;
  notes?: string;
}

export const SAMPLE_STORE: SampleStore = {
  name:    "ARMAZIX TESTE DE IMPRESSAO",
  address: "Rua das Flores, 123 - Centro",
  phone:   "(85) 9 9999-9999",
  url:     "ARMAZIX.COM.BR",
};

export const SAMPLE_ORDER: SampleOrder = {
  number: 6742, time: "19:35", date: "11/07/2026",
  customerName: "Cliente Teste", customerPhone: "(85) 9 9999-9999",
  type: "delivery", paymentMethod: "Dinheiro", paymentStatus: "pending",
  subtotal: 52.00, deliveryFee: 4.00, discount: 5.00, total: 51.00,
  notes: "Interfone 201",
  items: [
    { qty: 2, name: "X-Burguer Duplo",  unitPrice: 20.00, total: 40.00, notes: "Sem cebola / Bem passado"  },
    { qty: 1, name: "Fritas Grandes",   unitPrice: 12.00, total: 12.00, notes: "Extra ketchup"            },
  ],
  address: {
    street: "Rua das Flores", number: "456", neighborhood: "Centro",
    complement: "Apto 201", city: "Recife/PE", reference: "Prox. ao Mercadao",
  },
};

// ─── PRODUÇÃO — Kitchen / Bar ticket ─────────────────────────��───────────────
export function buildProductionTicket(store: SampleStore, order: SampleOrder, cols: number): ThermalLine[] {
  const tipoLabel = order.type === "pickup" ? "RETIRADA" : "DELIVERY";

  const lines: ThermalLine[] = [
    // ── Header ──────────��──────────────────────��──────────────────────────��──
    { text: "COZINHA / PRODUCAO", center: true, bold: true },
    { text: "" },
    { text: "", separator: "=" },

    // ── Identificação do pedido ──────────────��───────────────────────���────────
    { text: "" },
    { text: twoCol(`PEDIDO #${order.number}`, `${order.date}  -${order.time}`, cols), bold: true },
    { text: `TIPO: ${tipoLabel}` },
    { text: `CLIENTE: ${order.customerName}` },
    { text: "" },
    { text: "", separator: "=" },
  ];

  // ── Itens ─────────────────────────────────────���───────────────────────────
  for (let i = 0; i < order.items.length; i++) {
    const item = order.items[i];
    lines.push({ text: "" });
    lines.push({ text: `${item.qty}x ${item.name.toUpperCase()}`, bold: true });
    lines.push({ text: "" });
    if (item.notes) {
      for (const note of item.notes.split("/").map(n => n.trim()).filter(Boolean)) {
        lines.push({ text: ` -${note}` });
      }
    }
    lines.push({ text: "" });
    if (i < order.items.length - 1) {
      lines.push({ text: "", separator: "-" });
    }
  }

  // ── Rodapé ─────────────────────��──────────────────────────────────────────
  lines.push({ text: "", separator: "=" });
  lines.push({ text: store.url ?? store.name, center: true });
  lines.push({ text: "", separator: "=" });

  return lines;
}

// ─── CAIXA — Non-fiscal coupon ────────────────────────────────────────────────
export function buildCaixaCoupon(store: SampleStore, order: SampleOrder, cols: number): ThermalLine[] {
  const qtyW = 5; // "2x   " — largura da coluna QTD

  const lines: ThermalLine[] = [
    // ── Cabeçalho da loja ─────────────────────────────────────────────────────
    { text: store.name,    center: true, bold: true },
    { text: store.address, center: true },
    { text: store.phone,   center: true },
    { text: "" },

    // ── Identificação do cupom ────────────────────────────────────────────────
    { text: "", separator: "-" },
    { text: "CUPOM NAO FISCAL", center: true, bold: true },
    { text: "", separator: "-" },
    { text: "" },
    { text: twoCol(`PEDIDO #${order.number}`, `${order.date} ${order.time}`, cols), bold: true },
    { text: "" },

    // ── Cabeçalho da tabela de itens ──────────────────────────────────────────
    {
      text: `${formatLine("QTD", "left", qtyW)}${twoCol("DESCRICAO", "TOTAL", cols - qtyW)}`,
      bold: true,
    },
    { text: "", separator: "-" },
  ];

  for (const item of order.items) {
    lines.push({
      text: `${formatLine(item.qty + "x", "left", qtyW)}${twoCol(item.name, fmtMoney(item.total), cols - qtyW)}`,
      bold: true,
    });
    if (item.notes) {
      for (const note of item.notes.split("/").map(n => n.trim()).filter(Boolean)) {
        lines.push({ text: `    -${note}` });
      }
    }
    lines.push({ text: "" });
  }

  lines.push({ text: "", separator: "-" });
  lines.push({ text: "" });

  // ── Totais ────────────────────────────────────────────────────────────────
  lines.push({ text: twoCol("Subtotal",         fmtMoney(order.subtotal),      cols) });
  if (order.discount > 0)
    lines.push({ text: twoCol("Desconto",        `-${fmtMoney(order.discount)}`, cols) });
  if (order.deliveryFee > 0)
    lines.push({ text: twoCol("Taxa de entrega", fmtMoney(order.deliveryFee),   cols) });

  lines.push({ text: "" });
  lines.push({ text: "", separator: "=" });
  lines.push({ text: "" });
  lines.push({ text: twoCol("TOTAL", fmtMoney(order.total), cols), bold: true });
  lines.push({ text: "" });
  lines.push({ text: `FORMA DE PAGAMENTO: ${order.paymentMethod}` });
  lines.push({ text: "" });
  lines.push({ text: "", separator: "=" });

  // ── Rodapé ────────────────────────────────────────────────────────────────
  lines.push({ text: "" });
  lines.push({ text: "Obrigado pela preferencia!", center: true });
  lines.push({ text: "" });
  lines.push({ text: "Volte sempre!", center: true });
  lines.push({ text: "", separator: "-" });
  lines.push({ text: store.url ?? store.name, center: true });

  return lines;
}

// ─── DELIVERY — Resumo do pedido para o cliente ───────────────────────────────
export function buildDeliveryTicket(store: SampleStore, order: SampleOrder, cols: number): ThermalLine[] {
  const lines: ThermalLine[] = [
    // ── Header ───────────────────────────────────────────────────────────────
    { text: "RESUMO DO PEDIDO", center: true, bold: true },
    { text: "" },
    { text: "", separator: "=" },

    // ── Identificação do pedido ───────────────────────────────────────────────
    { text: "" },
    { text: twoCol(`PEDIDO #${order.number}`, `${order.time}  -${order.date}`, cols), bold: true },
    { text: "" },
    { text: `CLIENTE: ${order.customerName}` },
    { text: `TELEFONE: ${order.customerPhone}` },
    { text: "" },
    { text: "", separator: "=" },

    // ── Itens ─────────────────────────────────────────────────────────────────
    { text: "ITENS DO PEDIDO", bold: true },
    { text: "" },
  ];

  for (const item of order.items) {
    lines.push({ text: twoCol(`${item.qty}x ${item.name}`, fmtMoney(item.total), cols), bold: true });
    if (item.notes) {
      for (const note of item.notes.split("/").map(n => n.trim()).filter(Boolean)) {
        lines.push({ text: `    -${note}` });
      }
    }
    lines.push({ text: "" });
  }

  lines.push({ text: "", separator: "-" });

  // ── Totais ────────────────────────────────────────────────────────────────
  lines.push({ text: "" });
  lines.push({ text: twoCol("Subtotal",         fmtMoney(order.subtotal),      cols) });
  if (order.discount > 0)
    lines.push({ text: twoCol("Desconto",        `-${fmtMoney(order.discount)}`, cols) });
  if (order.deliveryFee > 0)
    lines.push({ text: twoCol("Taxa de entrega", fmtMoney(order.deliveryFee),   cols) });

  lines.push({ text: "" });
  lines.push({ text: "", separator: "=" });
  lines.push({ text: "" });
  lines.push({ text: twoCol("TOTAL", fmtMoney(order.total), cols), bold: true });
  lines.push({ text: "" });
  lines.push({ text: `FORMA DE PAGAMENTO: ${order.paymentMethod}` });
  lines.push({ text: "" });
  lines.push({ text: "", separator: "=" });

  // ── Rodapé ────────────────────────────────────────────────────────────────
  lines.push({ text: store.url ?? store.name, center: true });

  return lines;
}

// ─── FICHA DE ENTREGA — Motoboy sheet ────────────────────────────────────────
export function buildFichaEntrega(store: SampleStore, order: SampleOrder, cols: number): ThermalLine[] {
  const addr   = order.address;
  const isCash = /dinheiro|cash/i.test(order.paymentMethod);

  const lines: ThermalLine[] = [
    // ── Header ───────────────────────────────────────────────────────────────
    { text: "** FICHA DE ENTREGA **", center: true, bold: true },
    { text: "", separator: "=" },

    // ── Identificação do pedido ───────────────────────────────────────────────
    { text: "" },
    { text: twoCol(`PEDIDO #${order.number}`, `${order.date} ${order.time}`, cols), bold: true },
    { text: `CLIENTE: ${order.customerName.toUpperCase()}` },
    { text: "", separator: "=" },

    // ── Contato e endereço ────────────────────────────────────────────────────
    { text: `TELEFONE: ${order.customerPhone}` },
    { text: `ENDERECO DE ENTREGA: ${addr.street}, ${addr.number}`, bold: true },
    { text: `${addr.neighborhood} - ${addr.city}` },
  ];

  if (addr.complement) lines.push({ text: `COMPLEMENTO: ${addr.complement}` });
  if (addr.reference)  lines.push({ text: `REFERENCIA: ${addr.reference}` });
  lines.push({ text: "", separator: "=" });

  // ── Pagamento ─────────────────────────────────────────────────────────────
  lines.push({ text: "PAGAMENTO", bold: true });

  if (order.paymentStatus === "paid") {
    lines.push({ text: "** PEDIDO JA PAGO **", center: true, bold: true });
    lines.push({ text: "" });
    lines.push({ text: `Valor: ${fmtMoney(order.total)}`, bold: true });
    lines.push({ text: `Forma de pagamento: ${order.paymentMethod.toUpperCase()}` });
  } else {
    lines.push({ text: "** Cobrar na entrega **", center: true, bold: true });
    lines.push({ text: "" });
    lines.push({ text: `Valor: ${fmtMoney(order.total)}`, bold: true });
    lines.push({ text: `Forma de pagamento: ${order.paymentMethod.toUpperCase()}` });
    if (isCash) {
      lines.push({ text: "" });
      const trocoLine = order.changeFor && order.changeFor > 0
        ? `Troco para: ${fmtMoney(order.changeFor)}`
        : "Troco para: R$______________";
      lines.push({ text: trocoLine });
    }
  }

  lines.push({ text: "" });
  lines.push({ text: "", separator: "=" });

  // ── Itens do pedido ───────────────────────────────────────────────────────
  lines.push({ text: "" });
  lines.push({ text: "ITENS DO PEDIDO", bold: true });
  lines.push({ text: "" });

  for (const item of order.items) {
    lines.push({ text: `${item.qty}x ${item.name}`, bold: true });
    if (item.notes) {
      for (const note of item.notes.split("/").map(n => n.trim()).filter(Boolean)) {
        lines.push({ text: `    -${note}` });
      }
    }
    lines.push({ text: "" });
  }

  lines.push({ text: "", separator: "=" });

  // ── Taxa de entrega ───────────────────────────────────────────────────────
  if (order.deliveryFee > 0) {
    lines.push({ text: "" });
    lines.push({ text: twoCol("TAXA DE ENTREGA:", fmtMoney(order.deliveryFee), cols), bold: true });
    lines.push({ text: "", separator: "=" });
  }

  // ── Observação ────────────────────────────────────────────────────────────
  if (order.notes) {
    lines.push({ text: "" });
    lines.push({ text: `OBSERVACAO: ${order.notes}` });
    lines.push({ text: "" });
    lines.push({ text: "", separator: "=" });
  }

  // ── Rodapé ────────────────────────────────────────────────────────────────
  lines.push({ text: "" });
  lines.push({ text: store.url ?? store.name, center: true });

  return lines;
}

// ─── Real-order DB adapter ────────────────────────────────────────────────────
export interface DbOrderForPrint {
  number: number;
  createdAt: string | Date;
  customer: { name: string | null; phone: string | null } | null;
  items: {
    productName: string;
    quantity: number;
    unitPrice: string | number;
    total:     string | number;
    notes:     string | null;
  }[];
  subtotal:      string | number;
  deliveryFee:   string | number;
  discount:      string | number;
  total:         string | number;
  changeFor:     string | number | null;
  paymentMethod: string | null;
  paymentStatus: string | null;
  type:          string;
  notes:         string | null;
  addressSnapshot: {
    street?: string; number?: string; neighborhood?: string;
    complement?: string; city?: string; state?: string; reference?: string;
  } | null;
}

export function dbOrderToSample(order: DbOrderForPrint): SampleOrder {
  const dt   = new Date(order.createdAt);
  const time = dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const date = dt.toLocaleDateString("pt-BR");
  const pmMap: Record<string, string> = {
    pix:    "PIX",
    card:   "Cartão de Crédito",
    cash:   "Dinheiro",
    credit: "Crédito",
    debit:  "Débito",
    mp:     "Mercado Pago",
  };
  const addr = order.addressSnapshot;
  return {
    number:        order.number,
    time,
    date,
    customerName:  order.customer?.name  ?? "Cliente",
    customerPhone: order.customer?.phone ?? "",
    type:    (order.type === "pickup" ? "pickup" : "delivery") as "delivery" | "pickup",
    paymentMethod: pmMap[order.paymentMethod ?? ""] ?? order.paymentMethod ?? "—",
    paymentStatus: (order.paymentStatus === "paid" ? "paid" : "pending") as "paid" | "pending",
    subtotal:    parseFloat(String(order.subtotal))    || 0,
    deliveryFee: parseFloat(String(order.deliveryFee)) || 0,
    discount:    parseFloat(String(order.discount))    || 0,
    total:       parseFloat(String(order.total))       || 0,
    changeFor:   order.changeFor != null ? parseFloat(String(order.changeFor)) || undefined : undefined,
    notes:       order.notes ?? undefined,
    items: order.items.map(i => ({
      qty:       i.quantity,
      name:      i.productName,
      unitPrice: parseFloat(String(i.unitPrice)) || 0,
      total:     parseFloat(String(i.total))     || 0,
      notes:     i.notes ?? undefined,
    })),
    address: {
      street:       addr?.street       ?? "",
      number:       addr?.number       ?? "",
      neighborhood: addr?.neighborhood ?? "",
      complement:   addr?.complement,
      city:         addr?.city ? `${addr.city}${addr.state ? `/${addr.state}` : ""}` : "",
      reference:    addr?.reference,
    },
  };
}
