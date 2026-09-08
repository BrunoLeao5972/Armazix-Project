import { describe, it, expect } from "vitest";
import {
  linesToEscPos, linesToText, ESCPOS, type ThermalLine,
  buildCaixaCoupon, buildFichaEntrega, dbOrderToSample, dbStoreToSample,
  SAMPLE_STORE, SAMPLE_ORDER, type DbOrderForPrint,
} from "@/lib/thermal/layouts";
import {
  resolvePrintStrategy, suggestDriverFromQueue, resolveFontSizePlan, scaleLinesForRaw,
} from "@/lib/thermal/print-strategy";

const ESC = "\x1B";
const GS  = "\x1D";

const LINES: ThermalLine[] = [
  { text: "AÇAÍ DA VÓ", center: true, bold: true },
  { text: "", separator: "=" },
  { text: "2x Pão de queijo" },
  { text: "TOTAL", right: true },
];

describe("linesToEscPos — perfil standard (Epson e compatíveis)", () => {
  const out = linesToEscPos(LINES, 32, "standard");

  it("é o stream completo de hoje: fonte, tamanho, alinhamento por comando e corte função A", () => {
    expect(out.startsWith(ESCPOS.INIT + ESCPOS.ALIGN_LEFT + ESCPOS.FONT_A + ESCPOS.SIZE_NORMAL)).toBe(true);
    expect(out).toContain(ESCPOS.ALIGN_CENTER);
    expect(out).toContain(ESCPOS.ALIGN_RIGHT);
    expect(out.endsWith(ESCPOS.FEED_3 + ESCPOS.CUT_FULL)).toBe(true);
  });

  it("quebra de linha só com LF", () => {
    expect(out).not.toContain("\r\n");
  });

  it("é o padrão quando o perfil é omitido", () => {
    expect(linesToEscPos(LINES, 32)).toBe(out);
  });
});

describe("linesToEscPos — perfil compat (Daruma DR700 e afins)", () => {
  const out = linesToEscPos(LINES, 32, "compat");

  it("começa com ESC @ + ESC a 0 e nada mais", () => {
    expect(out.startsWith(`${ESC}@${ESC}a\x00`)).toBe(true);
  });

  it("não usa ESC M, GS ! nem ESC a por linha", () => {
    expect(out).not.toContain(`${ESC}M`);
    expect(out).not.toContain(`${GS}!`);
    // o único ESC a é o do cabeçalho
    expect(out.split(`${ESC}a`).length - 1).toBe(1);
  });

  it("negrito só via ESC E, fechado na mesma linha", () => {
    expect(out).toContain(`${ESC}E\x01`);
    expect(out).toContain(`${ESC}E\x00`);
  });

  it("linhas terminam em CRLF", () => {
    expect(out).toContain("2x Pao de queijo\r\n");
  });

  it("emula centralização e alinhamento à direita com espaços", () => {
    // "ACAI DA VO" (10 chars) centralizado em 32 col → 11 espaços à esquerda
    expect(out).toContain(`${ESC}E\x01${" ".repeat(11)}ACAI DA VO${ESC}E\x00\r\n`);
    expect(out).toContain(`${" ".repeat(27)}TOTAL\r\n`);
  });

  it("separador vira o caractere repetido pela largura", () => {
    expect(out).toContain("=".repeat(32) + "\r\n");
  });

  it("descarta acento e qualquer byte fora do ASCII imprimível", () => {
    const withEmoji = linesToEscPos([{ text: "Café ☕ com pão" }], 32, "compat");
    expect(withEmoji).toContain("Cafe  com pao\r\n");
    for (let i = 0; i < withEmoji.length; i++) {
      expect(withEmoji.charCodeAt(i)).toBeLessThanOrEqual(0x7E);
    }
  });

  it("termina com 3×LF e corte função B (GS V 65 16)", () => {
    expect(out.endsWith(`\n\n\n${GS}V\x41\x10`)).toBe(true);
    expect(out).not.toContain(`${GS}V\x00`);
  });

  it("separador '─' vira '-'", () => {
    expect(linesToEscPos([{ text: "", separator: "─" }], 10, "compat")).toContain("-".repeat(10));
  });
});

describe("linesToText mantém acento (preview do navegador)", () => {
  it("não toca no texto", () => {
    expect(linesToText([{ text: "Pão" }], 10)).toBe("Pão");
  });
});

describe("resolvePrintStrategy", () => {
  it("Daruma → gdi puro + compat (testado ao vivo numa DR700: RAW deixou a impressora travada, GDI imprimiu certo)", () => {
    expect(resolvePrintStrategy("Daruma")).toEqual({ mode: "gdi", profile: "compat" });
  });
  it("Epson/Elgin/Tanca/Goldentec → raw + standard", () => {
    for (const d of ["Epson", "Elgin", "Tanca", "Goldentec"]) {
      expect(resolvePrintStrategy(d)).toEqual({ mode: "raw", profile: "standard" });
    }
  });
  it("Texto → gdi", () => {
    expect(resolvePrintStrategy("Texto").mode).toBe("gdi");
  });
  it("HTML → browser", () => {
    expect(resolvePrintStrategy("HTML").mode).toBe("browser");
  });
  it("Nenhum / vazio / null → comportamento de hoje (raw standard)", () => {
    expect(resolvePrintStrategy("Nenhum")).toEqual({ mode: "raw", profile: "standard" });
    expect(resolvePrintStrategy("")).toEqual({ mode: "raw", profile: "standard" });
    expect(resolvePrintStrategy(null)).toEqual({ mode: "raw", profile: "standard" });
    expect(resolvePrintStrategy(undefined)).toEqual({ mode: "raw", profile: "standard" });
  });
  it("não diferencia maiúscula/minúscula", () => {
    expect(resolvePrintStrategy("daruma")).toEqual(resolvePrintStrategy("DARUMA"));
  });
});

describe("suggestDriverFromQueue", () => {
  it("reconhece a marca pelo nome da fila mesmo com driver genérico", () => {
    expect(suggestDriverFromQueue("DarumaDR700 (RAW)", "Generic / Text Only")).toBe("Daruma");
  });
  it("reconhece pelo driver Windows", () => {
    expect(suggestDriverFromQueue("Cozinha", "EPSON TM-T20 Receipt")).toBe("Epson");
    expect(suggestDriverFromQueue("Caixa", "Elgin i9")).toBe("Elgin");
  });
  it("devolve null quando não conhece", () => {
    expect(suggestDriverFromQueue("HP LaserJet", "HP Universal Printing PCL 6")).toBeNull();
  });
});

describe("resolveFontSizePlan", () => {
  it("Normal não muda nada, em qualquer modo", () => {
    for (const mode of ["raw", "gdi", "auto", "browser"] as const) {
      expect(resolveFontSizePlan(mode, "Normal", 48)).toEqual({ layoutColumns: 48, doubleRaw: false });
      expect(resolveFontSizePlan(mode, null, 48)).toEqual({ layoutColumns: 48, doubleRaw: false });
      expect(resolveFontSizePlan(mode, undefined, 48)).toEqual({ layoutColumns: 48, doubleRaw: false });
    }
  });

  it("Grande + gdi/auto + layout Caixa/Ficha: encolhe ~30% a régua de colunas (a largura física do papel vem de paperColumns, separada — ver print-order.ts/server.js)", () => {
    expect(resolveFontSizePlan("gdi", "Grande", 48, "caixa")).toEqual({ layoutColumns: 37, doubleRaw: false });
    expect(resolveFontSizePlan("auto", "Grande", 48, "ficha")).toEqual({ layoutColumns: 37, doubleRaw: false });
    expect(resolveFontSizePlan("gdi", "Grande", 32, "caixa")).toEqual({ layoutColumns: 25, doubleRaw: false });
  });

  it("Grande + gdi/auto + layout Produção/Delivery/sem layout: sem efeito (testado ao vivo — corrompe mesmo com a largura de papel corrigida)", () => {
    expect(resolveFontSizePlan("gdi", "Grande", 48, "production")).toEqual({ layoutColumns: 48, doubleRaw: false });
    expect(resolveFontSizePlan("gdi", "Grande", 48, "delivery")).toEqual({ layoutColumns: 48, doubleRaw: false });
    expect(resolveFontSizePlan("gdi", "Grande", 48, "conferencia")).toEqual({ layoutColumns: 48, doubleRaw: false });
    expect(resolveFontSizePlan("gdi", "Grande", 48)).toEqual({ layoutColumns: 48, doubleRaw: false });
  });

  it("Grande + raw: cai à metade e marca doubleRaw", () => {
    expect(resolveFontSizePlan("raw", "Grande", 48)).toEqual({ layoutColumns: 24, doubleRaw: true });
  });

  it("Grande + browser: sem efeito (impressão do navegador tem zoom próprio)", () => {
    expect(resolveFontSizePlan("browser", "Grande", 48)).toEqual({ layoutColumns: 48, doubleRaw: false });
  });

  it("nunca deixa a régua degenerada mesmo com poucas colunas físicas", () => {
    expect(resolveFontSizePlan("raw", "Grande", 20).layoutColumns).toBeGreaterThanOrEqual(16);
    expect(resolveFontSizePlan("gdi", "Grande", 20, "caixa").layoutColumns).toBeGreaterThanOrEqual(20);
  });

  it("não distingue maiúscula/minúscula", () => {
    expect(resolveFontSizePlan("raw", "grande", 48)).toEqual(resolveFontSizePlan("raw", "Grande", 48));
  });
});

describe("scaleLinesForRaw", () => {
  it("marca doubleBoth e limpa doubleH/doubleW em toda linha, inclusive separador", () => {
    const lines: ThermalLine[] = [
      { text: "Item", bold: true },
      { text: "TOTAL", doubleH: true },
      { text: "", separator: "=" },
    ];
    expect(scaleLinesForRaw(lines)).toEqual([
      { text: "Item", bold: true, doubleBoth: true, doubleH: false, doubleW: false },
      { text: "TOTAL", doubleBoth: true, doubleH: false, doubleW: false },
      { text: "", separator: "=", doubleBoth: true, doubleH: false, doubleW: false },
    ]);
  });
});

describe("dbStoreToSample", () => {
  it("monta o endereço a partir de street/number/complement/neighborhood", () => {
    expect(dbStoreToSample({
      name: "Armazix Loja Teste", phone: "(85) 90000-0000",
      address: { street: "Rua das Palmeiras", number: "50", complement: "Sala 2", neighborhood: "Centro" },
    })).toEqual({
      name: "Armazix Loja Teste", phone: "(85) 90000-0000",
      address: "Rua das Palmeiras, 50 - Sala 2 - Centro",
    });
  });

  it("sem endereço cadastrado, address fica string vazia (nunca 'undefined')", () => {
    const r = dbStoreToSample({ name: "Loja Sem Endereço", phone: null, address: null });
    expect(r).toEqual({ name: "Loja Sem Endereço", phone: "", address: "" });
  });
});

const BASE_DB_ORDER: DbOrderForPrint = {
  number: 1, createdAt: new Date("2026-01-01T12:00:00Z"),
  customer: { name: "Cliente Teste", phone: "(85) 90000-0000" },
  items: [{ productName: "Item", quantity: 1, unitPrice: "10.00", total: "10.00", notes: null }],
  subtotal: "10.00", deliveryFee: "0", discount: "0", total: "10.00", changeFor: null,
  paymentMethod: "misto", paymentStatus: "paid", type: "delivery", notes: null,
  addressSnapshot: null,
};

describe("dbOrderToSample — formas de pagamento separadas (misto)", () => {
  it("2+ pagamentos em order_payments viram `payments`, rotulados", () => {
    const sample = dbOrderToSample({
      ...BASE_DB_ORDER,
      payments: [
        { formaPagamento: "cash", valor: "20.00" },
        { formaPagamento: "pix", valor: "10.00" },
      ],
    });
    expect(sample.payments).toEqual([
      { method: "Dinheiro", total: 20 },
      { method: "PIX", total: 10 },
    ]);
  });

  it("0 ou 1 pagamento em order_payments não vira `payments` (fica undefined)", () => {
    expect(dbOrderToSample({ ...BASE_DB_ORDER, payments: [] }).payments).toBeUndefined();
    expect(dbOrderToSample({ ...BASE_DB_ORDER, payments: [{ formaPagamento: "cash", valor: "10.00" }] }).payments).toBeUndefined();
    expect(dbOrderToSample(BASE_DB_ORDER).payments).toBeUndefined();
  });
});

describe("buildCaixaCoupon / buildFichaEntrega — impressão de pagamento misto", () => {
  const order = { ...SAMPLE_ORDER, payments: [{ method: "Dinheiro", total: 20 }, { method: "PIX", total: 10 }] };

  it("Cupom: uma linha por forma, nunca 'FORMA DE PAGAMENTO: misto'", () => {
    const text = linesToText(buildCaixaCoupon(SAMPLE_STORE, order, 40), 40);
    expect(text).toContain("FORMAS DE PAGAMENTO:");
    expect(text).toMatch(/Dinheiro\s+R\$ 20,00/);
    expect(text).toMatch(/PIX\s+R\$ 10,00/);
    expect(text).not.toContain("misto");
    expect(text).not.toContain("FORMA DE PAGAMENTO:");
  });

  it("Ficha: idem, em caixa alta, e detecta dinheiro dentro do misto pro troco", () => {
    const withCash = { ...order, paymentStatus: "pending" as const, changeFor: 5 };
    const text = linesToText(buildFichaEntrega(SAMPLE_STORE, withCash, 40), 40);
    expect(text).toContain("Formas de pagamento:");
    expect(text).toMatch(/DINHEIRO\s+R\$ 20,00/);
    expect(text).toMatch(/PIX\s+R\$ 10,00/);
    expect(text).toContain("Troco para: R$ 5,00");
  });

  it("pagamento único continua na linha simples de sempre", () => {
    const text = linesToText(buildCaixaCoupon(SAMPLE_STORE, SAMPLE_ORDER, 40), 40);
    expect(text).toContain(`FORMA DE PAGAMENTO: ${SAMPLE_ORDER.paymentMethod}`);
  });
});
