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

import type { EscposProfile, ThermalLine } from "./layouts";

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

// ─── Tamanho da fonte ("Normal" / "Grande") ────────────────────────────────
// Pensado pra clientes com dificuldade de leitura. Duas formas BEM
// diferentes de conseguir letra maior, dependendo de quem desenha o texto:
//
//   GDI (mode "gdi"/"auto", ex.: Daruma) — quem desenha é o driver do
//   Windows, então a fonte pode ser qualquer tamanho contínuo. O agente já
//   calcula o tamanho de fonte que faz exatamente `columns` caracteres
//   caberem na largura física do papel (src/routes/.../armazix-print-agent
//   server.js, printViaGdi) — encolher a régua de colunas usada pra montar
//   o ticket (twoCol/formatLine/divider) ~30% faz o agente escolher uma
//   fonte ~30% maior sozinho, sem nenhuma mudança no agente.
//
//   RAW (mode "raw", ex.: Epson/Elgin/Tanca/Goldentec) — quem desenha é o
//   HARDWARE da impressora, com fonte fixa; o único jeito de aumentar é o
//   comando ESC/POS `GS !` de tamanho duplo (já existe como `doubleBoth`
//   no ThermalLine, usado hoje só no TOTAL). Não dá 30% contínuo — é o
//   dobro. A régua de colunas cai à metade pra compensar (metade dos
//   caracteres, cada um 2× mais largo ≈ mesma largura física de antes).
export type PrinterFontSize = "normal" | "grande";

export interface FontSizePlan {
  // Colunas a usar pra MONTAR o ticket (build*Ticket/twoCol/divider) — troca
  // a régua física (printer.columns) por uma menor quando a fonte é maior,
  // pra o conteúdo continuar cabendo no papel.
  layoutColumns: number;
  // true = aplicar tamanho duplo (GS !) em toda linha antes de gerar o
  // ESC/POS perfil "standard" — único jeito de aumentar fonte em impressora
  // RAW. Sem efeito em GDI (o agente já desenha maior via layoutColumns).
  doubleRaw: boolean;
}

export function resolveFontSizePlan(
  mode: PrintMode,
  fontSize: PrinterFontSize | string | null | undefined,
  physicalColumns: number,
): FontSizePlan {
  const cols = Math.max(1, physicalColumns);
  if ((fontSize ?? "").trim().toLowerCase() !== "grande") return { layoutColumns: cols, doubleRaw: false };

  // GDI/auto (Daruma): testado ao vivo — fonte "Grande" (a régua de colunas
  // encolhida, forçando o agente a calcular um ponto maior) trava a
  // impressora e sai lixo, de forma reprodutível; "Normal" no MESMO
  // hardware sempre saiu limpo. É a MESMA fila/driver problemático de todo
  // o resto do arquivo (server.js, Daruma DR700 Spooler) — o aumento de
  // fonte contínuo do GDI não é seguro nesse driver especificamente.
  // Desabilitado até haver uma forma confirmada de fazer isso sem travar.
  if (mode === "gdi" || mode === "auto") {
    return { layoutColumns: cols, doubleRaw: false };
  }
  if (mode === "raw") {
    return { layoutColumns: Math.max(16, Math.round(cols / 2)), doubleRaw: true };
  }
  // "browser" (driver HTML) — a impressão do navegador tem o próprio zoom;
  // sem efeito por aqui.
  return { layoutColumns: cols, doubleRaw: false };
}

// Aplica tamanho duplo (GS !) em toda linha do ticket — separador incluso,
// pra continuar atravessando a largura toda do papel mesmo com a régua de
// colunas reduzida pela metade (ver resolveFontSizePlan). Só faz sentido
// junto do perfil ESC/POS "standard" (o "compat" da Daruma nem usa GS !).
export function scaleLinesForRaw(lines: ThermalLine[]): ThermalLine[] {
  return lines.map(l => ({ ...l, doubleBoth: true, doubleH: false, doubleW: false }));
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
