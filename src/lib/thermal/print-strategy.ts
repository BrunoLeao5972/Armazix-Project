// ─────────────────────────────────────────────────────────────────────────
// Estratégia de impressão por driver.
//
// O campo "Driver" do cadastro de impressora (Nenhum/Texto/HTML/Epson/
// Daruma/Elgin/Tanca/Goldentec) era só um rótulo — passa a decidir DUAS
// coisas: (1) o `mode` que o Armazix Print Agent usa pra falar com a fila
// do Windows e (2) o perfil de bytes ESC/POS gerado por linesToEscPos.
//
// Isomórfico (sem imports de browser/servidor) de propósito: é usado tanto
// pelo handler no Worker (print-handler.ts) quanto pelo front (print-order.ts,
// modais de impressora), pra que os dois cheguem sempre à mesma decisão.
// ─────────────────────────────────────────────────────────────────────────

import type { EscposProfile } from "./layouts";

// raw     → bytes ESC/POS direto no spooler (winspool, DataType RAW)
// gdi     → agente renderiza o ticket via driver Windows (PrintDocument)
// auto    → agente escolhe: fila "Generic / Text Only" → raw; outra → gdi,
//           e cai pro outro se o primeiro falhar
// browser → nem passa pelo agente: abre a impressão do navegador (iframe)
export type PrintMode = "raw" | "gdi" | "auto" | "browser";

export interface PrintStrategy {
  mode:    PrintMode;
  profile: EscposProfile;
}

const DEFAULT_STRATEGY: PrintStrategy = { mode: "raw", profile: "standard" };

export function resolvePrintStrategy(driver: string | null | undefined): PrintStrategy {
  switch ((driver ?? "").trim().toLowerCase()) {
    // Daruma: testado ao vivo numa DR700 serial (COM7). GDI puro imprimiu
    // certo de primeira, duas vezes. RAW/compat na fila "Generic / Text
    // Only" (a fila supostamente passthrough) devolveu "OK — 292 bytes" do
    // winspool e NÃO SAIU PAPEL — e pior: o job GDI seguinte também saiu em
    // branco, sinal de que o ESC/POS malformado deixou a impressora num
    // estado travado (esperando dado que não veio) até serem religada.
    // Por isso "gdi" puro, sem fallback pra "raw" — não é só "não imprime",
    // é risco de sujar o próximo trabalho.
    case "daruma":    return { mode: "gdi", profile: "compat" };
    case "texto":     return { mode: "gdi",  profile: "compat" };
    case "html":      return { mode: "browser", profile: "standard" };
    case "epson":
    case "elgin":
    case "tanca":
    case "goldentec": return { mode: "raw", profile: "standard" };
    default:          return DEFAULT_STRATEGY;
  }
}

// Sugere o valor do campo Driver a partir do nome da fila + driver Windows
// reportados pelo agente (ex.: "DarumaDR700 (RAW)" / "Generic / Text Only"
// → "Daruma"). Devolve null quando não reconhece a marca — o usuário mantém
// o que já escolheu.
export function suggestDriverFromQueue(queueName: string, windowsDriver?: string | null): string | null {
  const hay = `${queueName} ${windowsDriver ?? ""}`.toLowerCase();
  if (/daruma/.test(hay))    return "Daruma";
  if (/epson|tm-t/.test(hay)) return "Epson";
  if (/elgin/.test(hay))     return "Elgin";
  if (/tanca/.test(hay))     return "Tanca";
  if (/goldentec/.test(hay)) return "Goldentec";
  return null;
}
