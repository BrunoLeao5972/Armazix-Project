import { requireStoreAccess, type AuthContext } from "@/lib/auth/require-store-access";
import { createTenantDb } from "@/lib/db";
import { schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import {
  buildProductionTicket, buildCaixaCoupon, buildDeliveryTicket, buildFichaEntrega,
  linesToText, linesToEscPos,
  SAMPLE_STORE, SAMPLE_ORDER,
  dbOrderToSample,
  type DbOrderForPrint,
} from "@/lib/thermal/layouts";

const { printers, orders, orderItems, customers } = schema;

// ─── Resolve printer by ID, scoped to store ───────────────────────
async function getPrinter(db: Awaited<ReturnType<typeof createTenantDb>>, printerId: string, storeId: string) {
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

// Detect if path is an IP[:port] or hostname (not a UNC/Windows share path)
function parseNetworkPath(path: string): { host: string; port: number } | null {
  const trimmed = path.trim();
  if (trimmed.startsWith("\\\\")) return null; // UNC path
  const match = trimmed.match(/^([\d.]+|[\w.-]+):?(\d+)?$/);
  if (!match) return null;
  return { host: match[1], port: parseInt(match[2] ?? "9100", 10) };
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

  const db   = await createTenantDb(process.env.DATABASE_URL!, storeId);
  const printer = await getPrinter(db, body.printerId, storeId);

  if (!printer) {
    return new Response(JSON.stringify({ error: "Impressora não encontrada" }), {
      status: 404, headers: { "content-type": "application/json" },
    });
  }

  const cols  = printer.columns ?? 48;
  const order = SAMPLE_ORDER;
  const store = SAMPLE_STORE;

  const linesMap = {
    production: () => buildProductionTicket(order, cols),
    caixa:      () => buildCaixaCoupon(store, order, cols),
    delivery:   () => buildDeliveryTicket(order, cols),
    ficha:      () => buildFichaEntrega(store, order, cols),
  };

  const lines   = linesMap[body.layout]();
  const preview = linesToText(lines, cols);
  const escpos  = linesToEscPos(lines, cols);
  const b64     = Buffer.from(escpos, "binary").toString("base64");

  let sent     = false;
  let sendError: string | undefined;

  if (body.send && printer.path) {
    const net = parseNetworkPath(printer.path);
    if (net) {
      try {
        await sendViaTcp(net.host, net.port, escpos);
        sent = true;
      } catch (err) {
        sendError = (err as Error).message;
      }
    } else {
      sendError = "Caminho não é um endereço de rede (IP). Impressão via compartilhamento Windows requer agente local.";
    }
  }

  return new Response(JSON.stringify({ preview, escposB64: b64, sent, error: sendError }), {
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

  const db = await createTenantDb(process.env.DATABASE_URL!, storeId);

  const [printer, order] = await Promise.all([
    getPrinter(db, body.printerId, storeId),
    db.query.orders.findFirst({
      where: and(eq(orders.id, body.orderId), eq(orders.storeId, storeId)),
      with: { items: true, customer: true },
    }),
  ]);

  if (!printer) return new Response(JSON.stringify({ error: "Impressora não encontrada" }), { status: 404, headers: { "content-type": "application/json" } });
  if (!order)   return new Response(JSON.stringify({ error: "Pedido não encontrado" }),     { status: 404, headers: { "content-type": "application/json" } });

  const cols        = printer.columns ?? 48;
  const sampleOrder = dbOrderToSample(order as unknown as DbOrderForPrint);
  const storeInfo   = SAMPLE_STORE; // TODO: load from db when store name/address fields are added

  const linesMap = {
    production: () => buildProductionTicket(sampleOrder, cols),
    caixa:      () => buildCaixaCoupon(storeInfo, sampleOrder, cols),
    delivery:   () => buildDeliveryTicket(sampleOrder, cols),
    ficha:      () => buildFichaEntrega(storeInfo, sampleOrder, cols),
  };

  const lines   = linesMap[body.layout]();
  const preview = linesToText(lines, cols);
  const escpos  = linesToEscPos(lines, cols);
  const b64     = Buffer.from(escpos, "binary").toString("base64");

  let sent = false;
  let sendError: string | undefined;

  if (body.send && printer.path) {
    const net = parseNetworkPath(printer.path);
    if (net) {
      try {
        await sendViaTcp(net.host, net.port, escpos);
        sent = true;
      } catch (err) {
        sendError = (err as Error).message;
      }
    } else {
      sendError = "Caminho não é IP/hostname. Use agente local para impressoras Windows.";
    }
  }

  return new Response(JSON.stringify({ preview, escposB64: b64, sent, error: sendError }), {
    status: 200, headers: { "content-type": "application/json" },
  });
}
