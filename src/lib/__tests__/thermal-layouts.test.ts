import { describe, it, expect } from "vitest";
import {
  linesToEscPos, linesToText, ESCPOS, type ThermalLine,
  buildCaixaCoupon, buildFichaEntrega, buildDeliveryTicket, buildProductionTicket,
  dbOrderToSample, dbStoreToSample,
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

describe("Rodapé — marca fixa do sistema em todos os papéis", () => {
  // Loja com nome bem diferente de "ARMAZIX.COM.BR" — a ÚLTIMA linha (o
  // rodapé) nunca pode mostrar o nome da loja, só a marca do sistema.
  const store = { name: "Padaria da Esquina Ltda", address: "Av. Central, 1", phone: "123" };

  it("Produção, Cupom, Delivery e Ficha terminam com ARMAZIX.COM.BR", () => {
    for (const lines of [
      buildProductionTicket(store, SAMPLE_ORDER, 40),
      buildCaixaCoupon(store, SAMPLE_ORDER, 40),
      buildDeliveryTicket(store, SAMPLE_ORDER, 40),
      buildFichaEntrega(store, SAMPLE_ORDER, 40),
    ]) {
      const lastNonEmpty = [...lines].reverse().find(l => l.text.trim() !== "");
      expect(lastNonEmpty?.text).toBe("ARMAZIX.COM.BR");
    }
  });

  // Produção/Delivery/Ficha nunca mostram dado nenhum da loja (nem no
  // cabeçalho) — só o Cupom/Conferência mostram nome+endereço no topo, e
  // isso continua legítimo (não é o rodapé).
  it("Produção, Delivery e Ficha não mostram o nome da loja em lugar nenhum", () => {
    for (const text of [
      linesToText(buildProductionTicket(store, SAMPLE_ORDER, 40), 40),
      linesToText(buildDeliveryTicket(store, SAMPLE_ORDER, 40), 40),
      linesToText(buildFichaEntrega(store, SAMPLE_ORDER, 40), 40),
    ]) {
      expect(text).not.toContain("Padaria da Esquina");
    }
  });
});

describe("buildCaixaCoupon — cabeçalho da loja", () => {
  it("chama-se COMPROVANTE DE COMPRA (não mais 'Cupom Não Fiscal')", () => {
    const text = linesToText(buildCaixaCoupon(SAMPLE_STORE, SAMPLE_ORDER, 40), 40);
    expect(text).toContain("COMPROVANTE DE COMPRA");
    expect(text).not.toContain("CUPOM NAO FISCAL");
  });

  it("não repete o telefone da loja no cabeçalho", () => {
    const text = linesToText(buildCaixaCoupon(SAMPLE_STORE, SAMPLE_ORDER, 40), 40);
    expect(text).not.toContain(SAMPLE_STORE.phone);
  });

  it("endereço da loja quebra em várias linhas quando não cabe na largura", () => {
    const address = "Avenida Presidente Getulio Vargas Filho, 12345 - Bairro Muito Distante do Centro";
    const store = { ...SAMPLE_STORE, address };
    const lines = buildCaixaCoupon(store, SAMPLE_ORDER, 40);
    for (const l of lines) expect(l.text.length).toBeLessThanOrEqual(40);
    // nenhuma linha isolada carrega o endereço inteiro (teve que quebrar)
    expect(lines.some(l => l.text === address)).toBe(false);
    // primeira e última palavra do endereço aparecem em alguma linha
    expect(lines.some(l => l.text.includes("Avenida"))).toBe(true);
    expect(lines.some(l => l.text.includes("Centro"))).toBe(true);
  });
});

describe("buildFichaEntrega — novo modelo (Taxa de entrega + Valor total no bloco PAGAMENTO)", () => {
  it("Taxa de entrega e Valor total aparecem antes de 'Formas de pagamento', separados por traço", () => {
    const order = {
      ...SAMPLE_ORDER, paymentStatus: "pending" as const, deliveryFee: 5,
      total: 30, payments: [{ method: "Dinheiro", total: 10 }, { method: "PIX", total: 20 }],
    };
    const text = linesToText(buildFichaEntrega(SAMPLE_STORE, order, 40), 40);
    const iTaxa   = text.indexOf("Taxa de entrega:");
    const iValor  = text.indexOf("Valor total:");
    const iTraco  = text.indexOf("-".repeat(40));
    const iFormas = text.indexOf("Formas de pagamento:");
    expect(iTaxa).toBeGreaterThan(-1);
    expect(iTaxa).toBeLessThan(iValor);
    expect(iValor).toBeLessThan(iTraco);
    expect(iTraco).toBeLessThan(iFormas);
    expect(text).toMatch(/Valor total:\s+R\$ 30,00/);
    expect(text).not.toContain("TAXA DE ENTREGA:"); // bloco antigo pós-itens não existe mais
  });

  it("sem taxa de entrega, pula a linha 'Taxa de entrega' mas mantém Valor total", () => {
    const order = { ...SAMPLE_ORDER, deliveryFee: 0 };
    const text = linesToText(buildFichaEntrega(SAMPLE_STORE, order, 40), 40);
    expect(text).not.toContain("Taxa de entrega:");
    expect(text).toContain("Valor total:");
  });

  it("endereço de entrega quebra linha quando não cabe (rua comprida)", () => {
    const order = {
      ...SAMPLE_ORDER,
      address: { ...SAMPLE_ORDER.address, street: "Rua Comendador Joaquim Ferreira de Albuquerque Neto", number: "999" },
    };
    const lines = buildFichaEntrega(SAMPLE_STORE, order, 40);
    for (const l of lines) expect(l.text.length).toBeLessThanOrEqual(40);
    const fullLine = `ENDERECO DE ENTREGA: ${order.address.street}, ${order.address.number}`;
    expect(lines.some(l => l.text === fullLine)).toBe(false); // teve que quebrar
    expect(lines.some(l => l.text.startsWith("ENDERECO DE ENTREGA:"))).toBe(true);
    expect(lines.some(l => l.text.includes("Neto,"))).toBe(true);
    expect(lines.some(l => l.text.trim() === "999")).toBe(true);
  });
});
