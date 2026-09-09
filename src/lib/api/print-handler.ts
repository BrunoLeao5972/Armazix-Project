import { requireStoreAccess, type AuthContext } from "@/lib/auth/require-store-access";
import { createUnscopedDb } from "@/lib/db";
import { schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { resolveSafeTarget } from "@/lib/security/network-guard";
import {
  buildProductionTicket, buildCaixaCoupon, buildDeliveryTicket, buildFichaEntrega,
  buildConferenciaTicket,
  linesToText, linesToEscPos,
  SAMPLE_STORE, SAMPLE_ORDER,
  dbOrderToSample, dbStoreToSample,
  type DbOrderForPrint, type DbStoreForPrint, type ThermalLine,
} from "@/lib/thermal/layouts";
import { resolvePrintStrategy, resolveFontSizePlan, scaleLinesForRaw } from "@/lib/thermal/print-strategy";

type PrintLayout = "production" | "caixa" | "delivery" | "ficha";

// Decide de uma vez, a partir do cadastro da impressora, com quantas
// colunas MONTAR o ticket (build*Ticket) — a régua física normal, ou uma
// menor quando o Tamanho da Fonte é "Grande" (ver print-strategy.ts). É
// esse valor que os build*Ticket recebem, e o mesmo que volta pro front em
// `columns` pra mandar ao agente — sem isso o agente calcularia a fonte GDI
// pra caber a régua física (maior), anulando o aumento.
function resolvePrinterLayout(
  driver: string | null | undefined, fontSize: string | null | undefined,
  columns: number | null | undefined, layout?: string | null,
) {
  const strategy = resolvePrintStrategy(driver);
  const plan      = resolveFontSizePlan(strategy.mode, fontSize, columns ?? 48, layout);
  return { strategy, plan, cols: plan.layoutColumns };
}

// Serializa o ticket nos dois formatos que o front pode precisar (texto pro
// preview, ESC/POS no perfil do driver) mais as `lines` cruas pro agente
// renderizar via GDI, e o `mode`/`columns` que dizem por onde e em que
// régua mandar. Único ponto que decide o perfil de bytes — o front só
// repassa. `lines` já deve ter sido montada com `cols` (ver
// resolvePrinterLayout) — aqui só aplica o dobro de tamanho ESC/POS quando
// o plano pede (impressora RAW em "Grande").
function serializeTicket(lines: ThermalLine[], cols: number, strategy: ReturnType<typeof resolvePrintStrategy>, plan: ReturnType<typeof resolveFontSizePlan>) {
  const scaledLines = plan.doubleRaw ? scaleLinesForRaw(lines) : lines;
  const escpos       = linesToEscPos(scaledLines, cols, strategy.profile);
  return {
    escpos,
    payload: {
      preview:   linesToText(scaledLines, cols),
      escposB64: Buffer.from(escpos, "binary").toString("base64"),
      lines:     scaledLines,
      mode:      strategy.mode,
      profile:   strategy.profile,
      columns:   cols,
    },
  };
}

function typeToLayout(type: string): PrintLayout {
  switch (type) {
    case "Caixa":    return "caixa";
    case "Delivery": return "delivery";
    case "Ficha":    return "ficha";
    default:         return "production";
  }
}

const {
  printers, orders, orderItems, customers, stores,
  servicePointSessions, servicePointTabItems, servicePointAdvances, servicePoints,
} = schema;

// ─── Carrega nome/endereço/telefone reais da loja pro cabeçalho do cupom ──
async function getStoreInfo(db: Awaited<ReturnType<typeof createUnscopedDb>>, storeId: string) {
  const store = await db.query.stores.findFirst({
    where: eq(stores.id, storeId),
    columns: { name: true, phone: true, address: true },
  });
  return store ? dbStoreToSample(store as DbStoreForPrint) : SAMPLE_STORE;
}

// ─── Resolve printer by ID, scoped to store ───────────────────────
async function getPrinter(db: Awaited<ReturnType<typeof createUnscopedDb>>, printerId: string, storeId: string) {
  return db.query.printers.findFirst({
    where: and(eq(printers.id, printerId), eq(printers.storeId, storeId)),
  });
}

// ─── TCP send (network/IP printers) ──────────────────────────────
async function sendViaTcp(host: string, port: number, data: string): Promise<void> {
  const { createConnection } = await import("net");
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host, port }, () => {
      socket.write(data, "binary", (err) => {
        socket.destroy();
        if (err) reject(err); else resolve();
      });
    });
    socket.setTimeout(5000, () => { socket.destroy(); reject(new Error("Timeout de conexão")); });
    socket.on("error", (err) => reject(err));
  });
}

// ─── POST /api/printers/test-raw ─────────────────────────────────
// Testa a impressora com config provisória (sem salvar no banco).
// Body: { path, columns?, type?, driver?, layout? }
export async function printRawTestHandler(request: Request, auth?: AuthContext): Promise<Response> {
  try { await requireStoreAccess(auth); } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: auth?.userId ? 403 : 401,
      headers: { "content-type": "application/json" },
    });
  }

  const body = await request.json() as {
    path:      string;
    columns?:  number;
    type?:     string;
    driver?:   string;
    fontSize?: string;
    layout?:   PrintLayout;
  };

  if (!body.path?.trim()) {
    return new Response(JSON.stringify({ error: "Informe o Caminho / IP antes de testar." }), {
      status: 400, headers: { "content-type": "application/json" },
    });
  }

  const physicalCols = Math.min(255, Math.max(1, body.columns ?? 48));
  const layout: PrintLayout = body.layout ?? typeToLayout(body.type ?? "");
  const { strategy, plan, cols } = resolvePrinterLayout(body.driver, body.fontSize, physicalCols, layout);

  const linesMap = {
    production: () => buildProductionTicket(SAMPLE_STORE, SAMPLE_ORDER, cols),
    caixa:      () => buildCaixaCoupon(SAMPLE_STORE, SAMPLE_ORDER, cols),
    delivery:   () => buildDeliveryTicket(SAMPLE_STORE, SAMPLE_ORDER, cols),
    ficha:      () => buildFichaEntrega(SAMPLE_STORE, SAMPLE_ORDER, cols),
  };

  const lines = linesMap[layout]();
  const { escpos, payload } = serializeTicket(lines, cols, strategy, plan);

  let sent      = false;
  let sendError: string | undefined;

  const net = await resolveSafeTarget(body.path.trim());
  if (net) {
    try {
      await sendViaTcp(net.host, net.port, escpos);
      sent = true;
    } catch (err) {
      sendError = (err as Error).message;
    }
  } else if (body.path.trim().startsWith("\\\\")) {
    // UNC / Windows share — preview-only, o front faz fallback para iframe print
    sendError = "unc";
  } else {
    // Formato de rede não reconhecido OU alvo bloqueado por segurança
    // (loopback, link-local, etc.) — ver src/lib/security/network-guard.ts.
    sendError = "Caminho / IP inválido ou não permitido.";
  }

  return new Response(JSON.stringify({ ...payload, sent, error: sendError }), {
    status: 200, headers: { "content-type": "application/json" },
  });
}

// ─── POST /api/printers/print-test ───────────────────────────────
// Body: { printerId: string; layout: "production"|"caixa"|"delivery"|"ficha" }
// Returns: { preview: string; escposB64: string; sent?: boolean; error?: string }
export async function printTestHandler(request: Request, auth?: AuthContext): Promise<Response> {
  let storeId: string;
  try {
    const access = await requireStoreAccess(auth);
    storeId = access.storeId;
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: auth?.userId ? 403 : 401,
      headers: { "content-type": "application/json" },
    });
  }

  const body = await request.json() as {
    printerId: string;
    layout: "production" | "caixa" | "delivery" | "ficha";
    send?: boolean;  // actually send to printer (vs preview-only)
  };

  if (!body.printerId || !body.layout) {
    return new Response(JSON.stringify({ error: "printerId e layout são obrigatórios" }), {
      status: 400, headers: { "content-type": "application/json" },
    });
  }

  const db   = await createUnscopedDb(process.env.DATABASE_URL!, storeId);
  const printer = await getPrinter(db, body.printerId, storeId);

  if (!printer) {
    return new Response(JSON.stringify({ error: "Impressora não encontrada" }), {
      status: 404, headers: { "content-type": "application/json" },
    });
  }

  const order = SAMPLE_ORDER;
  const store = await getStoreInfo(db, storeId);
  const { strategy, plan, cols } = resolvePrinterLayout(printer.driver, printer.fontSize, printer.columns, body.layout);

  const linesMap = {
    production: () => buildProductionTicket(store, order, cols),
    caixa:      () => buildCaixaCoupon(store, order, cols),
    delivery:   () => buildDeliveryTicket(store, order, cols),
    ficha:      () => buildFichaEntrega(store, order, cols),
  };

  const lines = linesMap[body.layout]();
  const { escpos, payload } = serializeTicket(lines, cols, strategy, plan);

  let sent     = false;
  let sendError: string | undefined;

  if (body.send && printer.path) {
    const net = await resolveSafeTarget(printer.path);
    if (net) {
      try {
        await sendViaTcp(net.host, net.port, escpos);
        sent = true;
      } catch (err) {
        sendError = (err as Error).message;
      }
    } else {
      sendError = "Caminho não é um endereço de rede válido, ou o alvo não é permitido. Impressão via compartilhamento Windows requer agente local.";
    }
  }

  return new Response(JSON.stringify({ ...payload, sent, error: sendError }), {
    status: 200, headers: { "content-type": "application/json" },
  });
}

// ─── POST /api/printers/print-order ──────────────────────────────
// Body: { printerId: string; orderId: string; layout: "production"|"caixa"|"delivery"|"ficha" }
export async function printOrderHandler(request: Request, auth?: AuthContext): Promise<Response> {
  let storeId: string;
  try {
    const access = await requireStoreAccess(auth);
    storeId = access.storeId;
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: auth?.userId ? 403 : 401,
      headers: { "content-type": "application/json" },
    });
  }

  const body = await request.json() as {
    printerId: string;
    orderId: string;
    layout: "production" | "caixa" | "delivery" | "ficha";
    send?: boolean;
  };

  if (!body.printerId || !body.orderId || !body.layout) {
    return new Response(JSON.stringify({ error: "printerId, orderId e layout são obrigatórios" }), {
      status: 400, headers: { "content-type": "application/json" },
    });
  }

  const db = await createUnscopedDb(process.env.DATABASE_URL!, storeId);

  const [printer, order, storeInfo] = await Promise.all([
    getPrinter(db, body.printerId, storeId),
    db.query.orders.findFirst({
      where: and(eq(orders.id, body.orderId), eq(orders.storeId, storeId)),
      // productImage fora do items: impressão térmica nunca usa imagem, só
      // texto — e o campo guarda o PNG do produto inteiro em base64.
      with: { items: { columns: { productImage: false } }, customer: true, payments: true },
    }),
    getStoreInfo(db, storeId),
  ]);

  if (!printer) return new Response(JSON.stringify({ error: "Impressora não encontrada" }), { status: 404, headers: { "content-type": "application/json" } });
  if (!order)   return new Response(JSON.stringify({ error: "Pedido não encontrado" }),     { status: 404, headers: { "content-type": "application/json" } });

  const sampleOrder = dbOrderToSample(order as unknown as DbOrderForPrint);
  const { strategy, plan, cols } = resolvePrinterLayout(printer.driver, printer.fontSize, printer.columns, body.layout);

  const linesMap = {
    production: () => buildProductionTicket(storeInfo, sampleOrder, cols),
    caixa:      () => buildCaixaCoupon(storeInfo, sampleOrder, cols),
    delivery:   () => buildDeliveryTicket(storeInfo, sampleOrder, cols),
    ficha:      () => buildFichaEntrega(storeInfo, sampleOrder, cols),
  };

  const lines = linesMap[body.layout]();
  const { escpos, payload } = serializeTicket(lines, cols, strategy, plan);

  let sent = false;
  let sendError: string | undefined;

  if (body.send && printer.path) {
    const net = await resolveSafeTarget(printer.path);
    if (net) {
      try {
        await sendViaTcp(net.host, net.port, escpos);
        sent = true;
      } catch (err) {
        sendError = (err as Error).message;
      }
    } else {
      sendError = "Caminho não é IP/hostname válido, ou o alvo não é permitido. Use agente local para impressoras Windows.";
    }
  }

  return new Response(JSON.stringify({ ...payload, sent, error: sendError }), {
    status: 200, headers: { "content-type": "application/json" },
  });
}

// ─── POST /api/printers/print-conferencia ─────────────────────────
// "Conferência" do painel de resumo da mesa/comanda — pré-conta de uma
// sessão AINDA ABERTA (sem pedido nenhum criado ainda). Diferente de
// printOrderHandler, os itens vêm de service_point_tab_items, sempre
// carregados do banco (nunca confia em itens mandados pelo body, mesmo
// padrão de segurança do resto deste arquivo).
export async function printConferenciaHandler(request: Request, auth?: AuthContext): Promise<Response> {
  let storeId: string;
  try {
    const access = await requireStoreAccess(auth);
    storeId = access.storeId;
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: auth?.userId ? 403 : 401, headers: { "content-type": "application/json" },
    });
  }

  const body = await request.json() as { printerId: string; sessionId: string; send?: boolean };
  if (!body.printerId || !body.sessionId) {
    return new Response(JSON.stringify({ error: "printerId e sessionId são obrigatórios" }), {
      status: 400, headers: { "content-type": "application/json" },
    });
  }

  const db = await createUnscopedDb(process.env.DATABASE_URL!, storeId);

  const [printer, session] = await Promise.all([
    getPrinter(db, body.printerId, storeId),
    db.query.servicePointSessions.findFirst({
      where: and(eq(servicePointSessions.id, body.sessionId), eq(servicePointSessions.storeId, storeId)),
      with: { servicePoint: true },
    }),
  ]);

  if (!printer) return new Response(JSON.stringify({ error: "Impressora não encontrada" }), { status: 404, headers: { "content-type": "application/json" } });
  if (!session) return new Response(JSON.stringify({ error: "Atendimento não encontrado" }), { status: 404, headers: { "content-type": "application/json" } });

  const [items, advances] = await Promise.all([
    db.select().from(servicePointTabItems).where(eq(servicePointTabItems.sessionId, body.sessionId)),
    db.select().from(servicePointAdvances).where(eq(servicePointAdvances.sessionId, body.sessionId)),
  ]);

  const subtotal       = items.reduce((s, i) => s + parseFloat(i.unitPrice) * i.quantity, 0);
  const totalAdiantado = advances.reduce((s, a) => s + parseFloat(a.valor), 0);
  const agora          = new Date();

  const storeInfo = await getStoreInfo(db, storeId);
  // "conferencia" nunca foi testada em Grande — fica sempre normal (ver
  // GDI_GRANDE_SAFE_LAYOUTS em print-strategy.ts).
  const { strategy, plan, cols } = resolvePrinterLayout(printer.driver, printer.fontSize, printer.columns, "conferencia");
  const lines     = buildConferenciaTicket(storeInfo, {
    mesaLabel: session.servicePoint?.nameOrNumber ?? "Atendimento",
    date:      agora.toLocaleDateString("pt-BR"),
    time:      agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    items:     items.map(i => ({
      qty: i.quantity, name: i.productName,
      unitPrice: parseFloat(i.unitPrice), total: parseFloat(i.unitPrice) * i.quantity,
    })),
    subtotal,
    totalAdiantado,
    total: subtotal,
  }, cols);

  const { escpos, payload } = serializeTicket(lines, cols, strategy, plan);

  let sent = false;
  let sendError: string | undefined;

  if (body.send && printer.path) {
    const net = await resolveSafeTarget(printer.path);
    if (net) {
      try {
        await sendViaTcp(net.host, net.port, escpos);
        sent = true;
      } catch (err) {
        sendError = (err as Error).message;
      }
    } else {
      sendError = "Caminho não é IP/hostname válido, ou o alvo não é permitido. Use agente local para impressoras Windows.";
    }
  }

  return new Response(JSON.stringify({ ...payload, sent, error: sendError }), {
    status: 200, headers: { "content-type": "application/json" },
  });
}
