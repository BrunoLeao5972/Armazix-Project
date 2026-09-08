// ─────────────────────────────────────────────────────────────────────────
// Orquestração de impressão de pedido — busca a impressora configurada da
// loja, chama POST /api/printers/print-order (agnóstico de onde o pedido
// veio, busca pelo orderId no backend) e envia via TCP (impressora de rede)
// ou pelo agente local (impressora Windows/USB), com fallback pro navegador
// se nada funcionar. Extraído de pedidos.tsx pra ser reaproveitado também
// pelo PDV (comprovante de venda / ficha de entrega da aba Delivery).
// ─────────────────────────────────────────────────────────────────────────

import { api } from "@/lib/api-client";
import type { ThermalLine } from "@/lib/thermal/layouts";
import { resolvePrintStrategy, type PrintMode } from "@/lib/thermal/print-strategy";

export {
  resolvePrintStrategy, suggestDriverFromQueue, resolveFontSizePlan, scaleLinesForRaw,
  type PrintMode, type PrintStrategy, type PrinterFontSize, type FontSizePlan,
} from "@/lib/thermal/print-strategy";

export interface PrinterRecord {
  id: string; name: string; code: string; type: string;
  driver?: string | null;
  fontSize?: string | null;
  path: string | null; columns: number | null;
  active?: boolean;
}

// Resposta comum de /api/printers/print-order, print-test e print-conferencia.
export interface PrintApiResponse {
  preview?:   string;
  escposB64?: string;
  lines?:     ThermalLine[];
  mode?:      PrintMode;
  // Colunas com que `lines`/`escposB64` foram montados — pode ser menor que
  // printer.columns quando o Tamanho da Fonte é "Grande" (ver
  // print-strategy.ts). Sempre priorizar este valor sobre printer.columns
  // ao mandar pro agente: é a régua que o conteúdo realmente usa.
  columns?:   number;
  sent?:      boolean;
  error?:     string;
}

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

export const AGENT_URL = "http://localhost:3989";

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

// Converts a binary ESC/POS string to base64 (browser-safe, no Buffer needed).
export function escposToBase64(binary: string): string {
  return btoa(Array.from(binary, c => String.fromCharCode(c.charCodeAt(0) & 0xff)).join(""));
}

// O que vai junto do ESC/POS pro agente: `mode` decide se ele manda os bytes
// crus (raw), renderiza `lines` pelo driver Windows (gdi) ou escolhe sozinho
// pela fila (auto). Agente 1.0.x ignora os campos extras e imprime raw —
// compatível pra trás.
export interface AgentPrintOptions {
  mode?:    Exclude<PrintMode, "browser">;
  lines?:   ThermalLine[];
  // Régua com que `lines` foi montado (pode ser menor que a física em
  // fonte "Grande") — o agente ajusta a fonte pra caber isso na largura...
  columns?: number;
  // ...que é decidida por ESTA: as colunas físicas do cadastro (32 = 58mm,
  // 48 = 80mm). Sem isso o agente deduzia o papel pela régua do layout e
  // imprimia "Grande" num papel de 57mm dentro do rolo de 80mm.
  paperColumns?: number;
}

export interface AgentPrintResult {
  mode?:     string;   // modo efetivamente usado pelo agente
  fallback?: boolean;  // true quando "auto" precisou cair pro segundo modo
  bytes?:    number;
  message?:  string;
}

export async function sendViaAgent(printerName: string, escposB64: string, opts: AgentPrintOptions = {}): Promise<AgentPrintResult> {
  const ctrl  = new AbortController();
  // GDI compila C#/renderiza pelo driver — mais lento que o RAW; "auto" pode
  // tentar os dois em sequência.
  const timer = setTimeout(() => ctrl.abort(), 45_000);
  try {
    const res  = await fetch(`${AGENT_URL}/print`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        printer_name: printerName,
        escpos_b64:   escposB64 || undefined,
        mode:          opts.mode ?? "raw",
        lines:         opts.lines,
        columns:       opts.columns,
        paper_columns: opts.paperColumns ?? opts.columns,
      }),
      signal: ctrl.signal,
    });
    const data = await res.json() as { success?: boolean; error?: string } & AgentPrintResult;
    if (!data.success) throw new Error(data.error ?? "Impressora não respondeu");
    return data;
  } finally {
    clearTimeout(timer);
  }
}

// Fluxo completo do lado do navegador pra uma impressora já cadastrada, a
// partir da resposta de um dos endpoints /api/printers/print-*:
//   - driver HTML → impressão do navegador com o preview
//   - caminho de rede → o servidor já tentou TCP (`sent`)
//   - nome de fila Windows → agente local, com o modo do driver
// Lança Error com mensagem pronta pra UI.
export async function dispatchPrint(printer: PrinterRecord, data: PrintApiResponse): Promise<void> {
  const mode = data.mode ?? resolvePrintStrategy(printer.driver).mode;
  // `data.columns` é a régua com que o servidor MONTOU lines/escposB64 —
  // pode ser menor que printer.columns em impressora "Grande" (ver
  // print-strategy.ts). Sem isso, o agente calcularia a fonte GDI pra
  // caber a régua física (maior), anulando o aumento de letra.
  const cols = data.columns ?? printer.columns ?? 48;

  if (mode === "browser") {
    printTextInBrowser(data.preview ?? "", cols);
    return;
  }
  if (data.sent) return;
  if (isNetworkPath(printer.path ?? "")) {
    throw new Error(data.error ?? "Não foi possível enviar para a impressora de rede");
  }
  if (!printer.path) throw new Error("Impressora sem caminho configurado");
  if (!data.escposB64 && !data.lines?.length) throw new Error(data.error ?? "Nada para imprimir");

  await sendViaAgent(printer.path, data.escposB64 ?? "", {
    mode, lines: data.lines, columns: cols, paperColumns: printer.columns ?? 48,
  });
}

// Mensagem amigável pros erros mais comuns de envio ao agente.
export function describeAgentError(err: unknown): string {
  const msg = err instanceof Error ? err.message : "Erro de conexão";
  const offline = msg.includes("fetch") || msg.includes("Failed") || msg.includes("abort");
  return offline
    ? "Agente não encontrado. Verifique se o Armazix Print Agent está ativo na bandeja."
    : msg;
}

// Abre o diálogo de impressão do navegador com o texto monoespaçado do
// cupom (mesmo preview que a UI mostra) — usado pelo driver "HTML" e como
// fallback quando o agente/impressora não respondem.
export function printTextInBrowser(text: string, cols?: number) {
  printViaIframe(buildPrintHtml(text, cols));
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

// Sem `cols` mantém o layout antigo do fallback (40ch / 58mm, pre-wrap).
// Com `cols` respeita a largura real da impressora (≤34 col = 58mm, senão
// 80mm) e não quebra linha — o texto já vem formatado na régua certa.
function buildPrintHtml(text: string, cols?: number): string {
  const esc = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const width = cols ? `${cols}ch` : "40ch";
  const paper = cols ? (cols <= 34 ? "58mm" : "80mm") : "58mm";
  const wrap  = cols ? "pre" : "pre-wrap";
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
    <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Courier New',monospace;font-size:11px;line-height:1.5;width:${width};padding:8px;background:#fff;color:#000}pre{white-space:${wrap}}@media print{@page{margin:4mm;size:${paper} auto}body{width:100%}}</style>
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
    const data = await res.json() as PrintApiResponse;

    try {
      await dispatchPrint(printer, data);
    } catch (err) {
      // Impressora de rede offline/IP errado, agente fechado, fila
      // inexistente… Sem este fallback o pedido não imprimia nada e não
      // avisava ninguém.
      onFallback?.(`${describeAgentError(err)} — abrindo impressão no navegador`);
      printViaIframe(buildPrintHtml(buildBrowserText(order, fallbackLayout)));
    }
  } catch {
    onFallback?.("Não foi possível gerar a impressão — abrindo impressão no navegador");
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
