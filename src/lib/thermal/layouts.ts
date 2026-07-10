// ─── Thermal Print Layout Builder ────────────────────────────────
// Generates structured line arrays for preview (React) and ESC/POS output.
// No external dependencies — pure TypeScript, runs on both server and client.

// ─── ESC/POS control codes ───────────────────────────────────────
const ESC = "\x1B";
const GS  = "\x1D";
export const ESCPOS = {
  INIT:         `${ESC}@`,
  BOLD_ON:      `${ESC}E\x01`,
  BOLD_OFF:     `${ESC}E\x00`,
  DOUBLE_ON:    `${ESC}!\x30`,
  DOUBLE_OFF:   `${ESC}!\x00`,
  ALIGN_LEFT:   `${ESC}a\x00`,
  ALIGN_CENTER: `${ESC}a\x01`,
  ALIGN_RIGHT:  `${ESC}a\x02`,
  CUT_FULL:     `${GS}V\x00`,
  FEED_3:       `${ESC}d\x03`,
};

// ─── ThermalLine — atomic unit ────────────────────────────────────
export interface ThermalLine {
  text: string;
  bold?: boolean;
  doubleH?: boolean;  // double height
  center?: boolean;
  separator?: "=" | "-" | "*" | "+";  // draw divider instead of text
}

// ─── String helpers ──────────────────────────────────────────────
export function pad(text: string, width: number, align: "left" | "right" | "center" = "left"): string {
  const s = String(text ?? "").slice(0, width);
  const diff = width - s.length;
  if (diff <= 0) return s;
  switch (align) {
    case "right":  return " ".repeat(diff) + s;
    case "center": return " ".repeat(Math.floor(diff / 2)) + s + " ".repeat(Math.ceil(diff / 2));
    default:       return s + " ".repeat(diff);
  }
}

export function center(text: string, cols: number): string { return pad(text, cols, "center"); }
export function right(text: string, cols: number): string  { return pad(text, cols, "right"); }

export function twoCol(left: string, rightText: string, cols: number): string {
  const r = String(rightText);
  return pad(left, cols - r.length) + r;
}

export function divider(char: string, cols: number): string {
  return char.repeat(cols);
}

export function fmtMoney(v: number | string): string {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return `R$ ${(isNaN(n) ? 0 : n).toFixed(2).replace(".", ",")}`;
}

function wrapText(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];
  const lines: string[] = [];
  let cur = "";
  for (const word of text.split(" ")) {
    const cand = cur ? `${cur} ${word}` : word;
    if (cand.length <= maxLen) { cur = cand; }
    else { if (cur) lines.push(cur); cur = word.slice(0, maxLen); }
  }
  if (cur) lines.push(cur);
  return lines;
}

// ─── Serialise ThermalLine[] → plain text (for preview/download) ─
export function linesToText(lines: ThermalLine[], cols: number): string {
  return lines.map(l => {
    if (l.separator) return l.separator.repeat(cols);
    return l.center ? center(l.text, cols) : l.text;
  }).join("\n");
}

// ─── Serialise ThermalLine[] → ESC/POS string ────────────────────
export function linesToEscPos(lines: ThermalLine[], cols: number): string {
  let out = ESCPOS.INIT + ESCPOS.ALIGN_LEFT;
  for (const l of lines) {
    if (l.separator) {
      out += l.separator.repeat(cols) + "\n";
      continue;
    }
    const pre  = (l.bold || l.doubleH ? ESCPOS.BOLD_ON : "") + (l.doubleH ? ESCPOS.DOUBLE_ON : "");
    const post = (l.doubleH ? ESCPOS.DOUBLE_OFF : "") + (l.bold || l.doubleH ? ESCPOS.BOLD_OFF : "");
    const align = l.center ? ESCPOS.ALIGN_CENTER : ESCPOS.ALIGN_LEFT;
    out += align + pre + l.text + post + ESCPOS.ALIGN_LEFT + "\n";
  }
  out += ESCPOS.FEED_3 + ESCPOS.CUT_FULL;
  return out;
}

// ─── Sample data for test prints ─────────────────────────────────
export interface SampleStore { name: string; address: string; phone: string; }
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
  items: SampleItem[];
  address: SampleAddress;
  notes?: string;
}

export const SAMPLE_STORE: SampleStore = {
  name:    "ARMAZIX BURGER & GRILL",
  address: "Rua das Flores, 123 - Centro",
  phone:   "(81) 99999-9999",
};

export const SAMPLE_ORDER: SampleOrder = {
  number: 42, time: "19:35", date: "09/07/2026",
  customerName: "João Silva", customerPhone: "(81) 9.9999-9999",
  type: "delivery", paymentMethod: "Cartão de Crédito", paymentStatus: "pending",
  subtotal: 52.00, deliveryFee: 4.00, discount: 5.00, total: 51.00,
  notes: "Interfone 201",
  items: [
    { qty: 2, name: "X-Burguer Duplo",  unitPrice: 20.00, total: 40.00, notes: "Sem cebola / Bem passado"  },
    { qty: 1, name: "Fritas Grandes",   unitPrice: 12.00, total: 12.00, notes: "Extra ketchup"            },
  ],
  address: {
    street: "Rua das Flores", number: "456", neighborhood: "Centro",
    complement: "Apto 201", city: "Recife/PE", reference: "Prox. ao Mercadão",
  },
};

// ─── PRODUÇÃO — Kitchen/Bar ticket ───────────────────────────────
export function buildProductionTicket(order: SampleOrder, cols: number): ThermalLine[] {
  const qtyW = 3;
  const lines: ThermalLine[] = [
    { text: "", separator: "=" },
    { text: "COZINHA / PRODUCAO", center: true },
    { text: "", separator: "=" },
    { text: `PEDIDO  #${order.number}`, bold: true, doubleH: true, center: true },
    { text: `${order.time}   ${order.date}`, center: true },
    { text: "", separator: "=" },
    { text: twoCol(`${pad("QTD", qtyW)}  ITEM`, `MESA`, cols) },
    { text: "", separator: "-" },
  ];

  for (const item of order.items) {
    const label = `${pad(String(item.qty) + "x", qtyW + 1)} ${item.name}`;
    lines.push({ text: label, bold: true });
    if (item.notes) {
      for (const note of item.notes.split("/").map(n => n.trim()).filter(Boolean)) {
        lines.push({ text: `     >> ${note}` });
      }
    }
    lines.push({ text: "" });
  }

  lines.push({ text: "", separator: "-" });
  lines.push({ text: `Tipo: ${order.type === "pickup" ? "** RETIRADA **" : "DELIVERY"}`, bold: order.type === "pickup" });
  lines.push({ text: `Cliente: ${order.customerName}` });
  if (order.notes) lines.push({ text: `Obs Pedido: ${order.notes}` });
  lines.push({ text: "", separator: "=" });

  return lines;
}

// ─── CAIXA — Non-fiscal coupon ────────────────────────────────────
export function buildCaixaCoupon(store: SampleStore, order: SampleOrder, cols: number): ThermalLine[] {
  const qtyW = 4, valW = 9;
  const nameW = cols - qtyW - valW - 2;

  const lines: ThermalLine[] = [
    { text: "", separator: "=" },
    { text: store.name, center: true, bold: true },
    { text: store.address, center: true },
    { text: store.phone, center: true },
    { text: "", separator: "=" },
    { text: "CUPOM NAO FISCAL", center: true },
    { text: `${order.date} ${order.time}`, center: true },
    { text: `PEDIDO #${order.number}`, center: true, bold: true },
    { text: "", separator: "=" },
    {
      text: `${pad("QTD", qtyW)}  ${pad("ITEM", nameW)}  ${pad("TOTAL", valW, "right")}`,
      bold: true,
    },
    { text: "", separator: "-" },
  ];

  for (const item of order.items) {
    const nameLines = wrapText(item.name, nameW);
    lines.push({
      text: `${pad(item.qty + "x", qtyW)}  ${pad(nameLines[0], nameW)}  ${pad(fmtMoney(item.total), valW, "right")}`,
    });
    for (let i = 1; i < nameLines.length; i++) {
      lines.push({ text: `${pad("", qtyW)}  ${pad(nameLines[i], nameW)}` });
    }
    if (item.notes) lines.push({ text: `${pad("", qtyW + 2)}>> ${item.notes}` });
  }

  lines.push({ text: "", separator: "-" });
  lines.push({ text: twoCol("SUBTOTAL:", fmtMoney(order.subtotal), cols) });
  if (order.discount > 0)    lines.push({ text: twoCol("DESCONTO:", `-${fmtMoney(order.discount)}`, cols) });
  if (order.deliveryFee > 0) lines.push({ text: twoCol("TAXA ENTREGA:", fmtMoney(order.deliveryFee), cols) });
  lines.push({ text: "", separator: "=" });
  lines.push({ text: twoCol(">> TOTAL:", fmtMoney(order.total), cols), bold: true });
  lines.push({ text: "", separator: "=" });
  lines.push({ text: `PAGAMENTO: ${order.paymentMethod.toUpperCase()}`, bold: true });
  if (order.paymentStatus === "paid") lines.push({ text: "STATUS: PAGO" });
  lines.push({ text: "", separator: "=" });
  lines.push({ text: "OBRIGADO PELA PREFERENCIA!", center: true });
  lines.push({ text: "Volte sempre - ARMAZIX", center: true });
  lines.push({ text: "", separator: "=" });

  return lines;
}

// ─── DELIVERY — Quick summary ─────────────────────────────────────
export function buildDeliveryTicket(order: SampleOrder, cols: number): ThermalLine[] {
  const lines: ThermalLine[] = [
    { text: "", separator: "=" },
    { text: "RESUMO - DELIVERY", center: true, bold: true },
    { text: "", separator: "=" },
    { text: twoCol(`Pedido #${order.number}`, `${order.time} ${order.date}`, cols), bold: true },
    { text: "", separator: "-" },
    { text: `Cliente: ${order.customerName}` },
    { text: `Fone: ${order.customerPhone}` },
    { text: "", separator: "-" },
    { text: "ITENS:", bold: true },
  ];

  for (const item of order.items) {
    lines.push({
      text: twoCol(` ${item.qty}x ${item.name}`, fmtMoney(item.total), cols),
    });
    if (item.notes) lines.push({ text: `    >> ${item.notes}` });
  }

  lines.push({ text: "", separator: "-" });
  lines.push({ text: twoCol("Subtotal:", fmtMoney(order.subtotal), cols) });
  if (order.discount > 0)
    lines.push({ text: twoCol("Desconto:", `-${fmtMoney(order.discount)}`, cols) });
  lines.push({ text: twoCol("Taxa de Entrega:", fmtMoney(order.deliveryFee), cols) });
  lines.push({ text: "", separator: "=" });
  lines.push({ text: twoCol("** TOTAL:", `${fmtMoney(order.total)} **`, cols), bold: true });
  lines.push({ text: `Pagamento: ${order.paymentMethod}` });
  lines.push({ text: "", separator: "=" });

  return lines;
}

// ─── FICHA DE ENTREGA — Motoboy sheet ────────────────────────────
export function buildFichaEntrega(store: SampleStore, order: SampleOrder, cols: number): ThermalLine[] {
  const innerW = cols - 2;

  const boxLine = (content: string): ThermalLine => ({
    text: `| ${pad(content, innerW - 1)}|`,
  });
  const boxBold = (content: string): ThermalLine => ({
    text: `| ${pad(content, innerW - 1)}|`, bold: true,
  });

  const addr = order.address;
  const fullAddr = `${addr.street}, ${addr.number}${addr.complement ? ` - ${addr.complement}` : ""}`;

  const lines: ThermalLine[] = [
    { text: "", separator: "=" },
    { text: "** FICHA DE ENTREGA **", center: true, bold: true },
    { text: "", separator: "=" },
    { text: twoCol(`PEDIDO: #${order.number}`, `SAIDA: ${order.time}`, cols), bold: true },
    { text: "", separator: "=" },
    { text: `CLIENTE: ${order.customerName.toUpperCase()}`, bold: true },
    { text: `TELEFONE: ${order.customerPhone}` },
    { text: "", separator: "=" },
    { text: "ENDERECO DE ENTREGA:", bold: true },
    { text: fullAddr.slice(0, cols) },
    { text: `Bairro: ${addr.neighborhood}` },
  ];

  if (addr.complement) lines.push({ text: `Compl.: ${addr.complement}` });
  if (addr.reference)  lines.push({ text: `Ref.: ${addr.reference}` });
  lines.push({ text: `Cidade: ${addr.city}` });
  lines.push({ text: "", separator: "=" });

  // ── Payment status block ──────────────────────────────────────
  if (order.paymentStatus === "paid") {
    lines.push({ text: "+".repeat(cols) });
    boxLine("");
    lines.push(boxLine(""));
    lines.push(boxBold(" [X] PEDIDO JA PAGO - NAO COBRAR"));
    lines.push(boxLine(`      Via: ${order.paymentMethod.toUpperCase()}`));
    lines.push(boxLine(""));
    lines.push({ text: "+".repeat(cols) });
  } else {
    lines.push({ text: "+".repeat(cols) });
    lines.push(boxLine(""));
    lines.push(boxBold(` [ ] A COBRAR NA ENTREGA`));
    lines.push(boxBold(`     VALOR: ${fmtMoney(order.total)}`));
    lines.push(boxLine(`     Forma: ${order.paymentMethod}`));
    lines.push(boxLine(""));
    lines.push(boxLine("     Troco para: R$ ___________"));
    lines.push(boxLine(""));
    lines.push({ text: "+".repeat(cols) });
  }

  lines.push({ text: "", separator: "=" });
  lines.push({ text: "ITENS DO PEDIDO:", bold: true });

  for (const item of order.items) {
    lines.push({ text: ` ${item.qty}x ${item.name}` });
    if (item.notes) lines.push({ text: `    >> ${item.notes}` });
  }

  lines.push({ text: "", separator: "-" });
  if (order.deliveryFee > 0) {
    lines.push({ text: twoCol("TAXA DE ENTREGA:", fmtMoney(order.deliveryFee), cols), bold: true });
    lines.push({ text: "", separator: "=" });
  }
  if (order.notes) {
    lines.push({ text: `Obs: ${order.notes}` });
    lines.push({ text: "", separator: "-" });
  }

  // ── Signature area ────────────────────────────────────────────
  lines.push({ text: "" });
  lines.push({ text: "  Recebi o pedido em perfeito estado:" });
  lines.push({ text: "" });
  lines.push({ text: "  Data: ___/___/______" });
  lines.push({ text: "" });
  lines.push({ text: "  Assinatura:" });
  lines.push({ text: "  " + "-".repeat(cols - 2) });
  lines.push({ text: "  " + "-".repeat(cols - 2) });
  lines.push({ text: "" });
  lines.push({ text: "", separator: "=" });
  lines.push({ text: store.name, center: true });
  lines.push({ text: store.phone, center: true });
  lines.push({ text: "", separator: "=" });

  return lines;
}

// ─── Real-order adapter ───────────────────────────────────────────
// Converts DB order shape → SampleOrder for layout functions
export interface DbOrderForPrint {
  number: number;
  createdAt: string | Date;
  customer: { name: string | null; phone: string | null } | null;
  items: {
    productName: string;
    quantity: number;
    unitPrice: string | number;
    total: string | number;
    notes: string | null;
  }[];
  subtotal: string | number;
  deliveryFee: string | number;
  discount: string | number;
  total: string | number;
  paymentMethod: string | null;
  paymentStatus: string | null;
  type: string;
  notes: string | null;
  addressSnapshot: {
    street?: string; number?: string; neighborhood?: string;
    complement?: string; city?: string; state?: string; reference?: string;
  } | null;
}

export function dbOrderToSample(order: DbOrderForPrint): SampleOrder {
  const dt = new Date(order.createdAt);
  const time = dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const date = dt.toLocaleDateString("pt-BR");
  const pmMap: Record<string, string> = {
    pix: "PIX", card: "Cartão de Crédito", cash: "Dinheiro", credit: "Crédito", debit: "Débito",
  };
  const addr = order.addressSnapshot;
  return {
    number: order.number, time, date,
    customerName:  order.customer?.name  ?? "Cliente",
    customerPhone: order.customer?.phone ?? "",
    type:    (order.type === "pickup" ? "pickup" : "delivery") as "delivery" | "pickup",
    paymentMethod: pmMap[order.paymentMethod ?? ""] ?? order.paymentMethod ?? "—",
    paymentStatus: (order.paymentStatus === "paid" ? "paid" : "pending") as "paid" | "pending",
    subtotal:    parseFloat(String(order.subtotal))    || 0,
    deliveryFee: parseFloat(String(order.deliveryFee)) || 0,
    discount:    parseFloat(String(order.discount))    || 0,
    total:       parseFloat(String(order.total))       || 0,
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
