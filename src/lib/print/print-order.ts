// ─────────────────────────────────────────────────────────────────────────
// Orquestração de impressão de pedido — busca a impressora configurada da
// loja, chama POST /api/printers/print-order (agnóstico de onde o pedido
// veio, busca pelo orderId no backend) e envia via TCP (impressora de rede)
// ou pelo agente local (impressora Windows/USB), com fallback pro navegador
// se nada funcionar. Extraído de pedidos.tsx pra ser reaproveitado também
// pelo PDV (comprovante de venda / ficha de entrega da aba Delivery).
// ─────────────────────────────────────────────────────────────────────────

import { api } from "@/lib/api-client";

export interface PrinterRecord { id: string; name: string; code: string; type: string; path: string | null; columns: number | null; }

export interface PrintableOrder {
  orderId: string; number: number; customer: string;
  items: string[]; total: string; payment: string; status: string;
  rawDate: string; address: string; type: string;
}

export type PrintLayout = "production" | "caixa" | "delivery" | "ficha";

// Tipo de impressora configurável em Configurações → Impressoras (só existem
// "Produção"/"Caixa"/"Delivery" como opção — "ficha" não tem tipo próprio,
// cai no fallback de primeira impressora ativa).
const LAYOUT_PRINTER_TYPE: Partial<Record<PrintLayout, string>> = {
  production: "Produção",
  caixa:      "Caixa",
  delivery:   "Delivery",
};

const PAY_LABEL: Record<string, string> = {
  pix: "PIX", cash: "Dinheiro", card: "Crédito", debit: "Débito", mercadopago: "Mercado Pago",
};

const AGENT_URL = "http://localhost:3989";

// Returns true only for real network addresses:
//   - IPv4: 192.168.1.10  or  192.168.1.10:9100
//   - Hostname with at least one dot: printer.local  or  server.empresa.com:9100
// Windows printer names like "IMP-TERMICA" or "HP LaserJet Pro" return false.
export function isNetworkPath(path: string): boolean {
  const t = path.trim();
  if (!t || t.startsWith("\\\\")) return false;
  if (/^\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?$/.test(t)) return true;
  if (/^[\w-]+(?:\.[\w-]+)+(?::\d+)?$/.test(t)) return true;
  return false;
}

export async function sendViaAgent(printerName: string, escposB64: string): Promise<void> {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const res  = await fetch(`${AGENT_URL}/print`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ printer_name: printerName, escpos_b64: escposB64 }),
      signal: ctrl.signal,
    });
    const data = await res.json() as { success?: boolean; error?: string };
    if (!data.success) throw new Error(data.error ?? "Impressora não respondeu");
  } finally {
    clearTimeout(timer);
  }
}

function printViaIframe(html: string) {
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:0;opacity:0";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument!;
  doc.open(); doc.write(html); doc.close();
  iframe.contentWindow?.focus();
  iframe.contentWindow?.print();
  setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe); }, 2000);
}

function buildPrintHtml(text: string): string {
  const esc = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
    <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Courier New',monospace;font-size:11px;line-height:1.5;width:40ch;padding:8px;background:#fff;color:#000}pre{white-space:pre-wrap}@media print{@page{margin:4mm;size:58mm auto}body{width:100%}}</style>
    </head><body><pre>${esc}</pre></body></html>`;
}

function fmtDateTime(rawDate: string): string {
  const d = new Date(rawDate);
  if (isNaN(d.getTime())) return rawDate;
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function buildBrowserText(order: PrintableOrder, layout: "production" | "ficha" | "caixa"): string {
  const sep = "=".repeat(36);
  const lin = "-".repeat(36);
  if (layout === "production") {
    return [
      sep, `  COMANDA DE PRODUCAO  #${order.number}`, sep,
      `Cliente : ${order.customer}`,
      `Tipo    : ${order.type === "pickup" ? "Retirada no local" : "Delivery"}`,
      `Horario : ${fmtDateTime(order.rawDate)}`,
      lin, `ITENS:`, ...order.items.map(i => `  ${i}`), lin,
      `TOTAL: ${order.total}`, sep,
    ].join("\n");
  }
  if (layout === "caixa") {
    return [
      sep, `  COMPROVANTE DE VENDA  #${order.number}`, sep,
      `Cliente   : ${order.customer}`,
      lin, `ITENS:`, ...order.items.map(i => `  ${i}`), lin,
      `TOTAL     : ${order.total}`,
      `Pagamento : ${PAY_LABEL[order.payment] ?? order.payment}`,
      sep,
    ].join("\n");
  }
  return [
    sep, `  FICHA DE ENTREGA  #${order.number}`, sep,
    `Cliente   : ${order.customer}`,
    ...(order.address && order.type !== "pickup" ? [`Endereco  : ${order.address}`] : []),
    lin, `ITENS:`, ...order.items.map(i => `  ${i}`), lin,
    `TOTAL     : ${order.total}`,
    `Pagamento : ${PAY_LABEL[order.payment] ?? order.payment}`,
    sep,
  ].join("\n");
}

// `onFallback` avisa a UI sempre que a impressão automática não sai direto
// pela impressora configurada e cai para o preview do navegador — sem isso,
// uma impressora de rede offline (ou o agente local fechado) falhava
// completamente em silêncio, sem imprimir nada e sem qualquer aviso.
export async function printOrder(
  order: PrintableOrder,
  layout: PrintLayout,
  onFallback?: (reason: string) => void,
): Promise<void> {
  const fallbackLayout: "production" | "ficha" | "caixa" = layout === "delivery" ? "ficha" : layout;

  try {
    const listData = await fetch("/api/printers/list").then(r => r.json()) as { printers?: PrinterRecord[] };
    const wantedType = LAYOUT_PRINTER_TYPE[layout];
    const printer = (wantedType ? listData.printers?.find(p => p.type === wantedType) : undefined)
      ?? listData.printers?.[0];

    if (!printer) {
      onFallback?.("Nenhuma impressora cadastrada — abrindo impressão no navegador");
      printViaIframe(buildPrintHtml(buildBrowserText(order, fallbackLayout)));
      return;
    }

    const res  = await api.post("/api/printers/print-order", {
      printerId: printer.id,
      orderId:   order.orderId,
      layout,
      send:      isNetworkPath(printer.path ?? ""),
    });
    const data = await res.json() as { sent?: boolean; escposB64?: string; error?: string };

    if (data.sent) return;

    if (!isNetworkPath(printer.path ?? "") && data.escposB64) {
      await sendViaAgent(printer.path!, data.escposB64);
      return;
    }

    // Impressora de rede configurada mas o envio TCP falhou (offline/IP
    // errado) — ou nenhuma via de envio disponível. Sem este fallback o
    // pedido não imprimia nada e não avisava ninguém.
    onFallback?.(data.error || "Não foi possível enviar para a impressora — abrindo impressão no navegador");
    printViaIframe(buildPrintHtml(buildBrowserText(order, fallbackLayout)));
  } catch {
    onFallback?.("Agente de impressão não encontrado — abrindo impressão no navegador");
    printViaIframe(buildPrintHtml(buildBrowserText(order, fallbackLayout)));
  }
}

export function imprimirComandaProducao(order: PrintableOrder, onFallback?: (reason: string) => void) {
  printOrder(order, "production", onFallback).catch(() => {});
}
export function imprimirFichaEntrega(order: PrintableOrder, onFallback?: (reason: string) => void) {
  printOrder(order, "ficha", onFallback).catch(() => {});
}
export function imprimirComprovante(order: PrintableOrder, onFallback?: (reason: string) => void) {
  printOrder(order, "caixa", onFallback).catch(() => {});
}
