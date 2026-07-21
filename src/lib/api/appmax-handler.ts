// ─────────────────────────────────────────────────────────────────────────
// Appmax — gateway alternativo (cartão, boleto, Pix, split, tokenização).
// Espelha a arquitetura do Mercado Pago (payment-handler.ts):
//   - Credenciais por loja, sempre criptografadas (lib/crypto.ts).
//   - Checkout público cria o pedido no Armazix + a cobrança no gateway.
//   - Webhook único e global (URL fixa por app, não por loja), validado por
//     chave compartilhada, respondido em <200ms e processado via waitUntil
//     (não há fila no projeto — mesmo padrão usado pelo webhook do MP).
//
// Diferença estrutural relevante: a Appmax usa um fluxo de instalação de
// app (estilo OAuth2 app-store), não um token colado manualmente como o MP.
// Ver README.md deste diretório para o fluxo completo e o que precisa ser
// validado contra o sandbox antes de produção.
// ─────────────────────────────────────────────────────────────────────────

import { createDb } from "@/lib/db";
import { schema } from "@/lib/db";
import { eq, inArray, sql } from "drizzle-orm";
import { encrypt, decrypt } from "@/lib/crypto";
import { validateWebhookApiKey, validateWebhookQueryKey } from "@/lib/webhook-validator";
import { requireStoreOwner, requireStoreAccess, type AuthContext } from "@/lib/auth/require-store-access";
import { waitUntil } from "@/lib/execution-context";

const { stores, orders, orderItems, products, orderTimeline, auditLogs } = schema;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// ─── Ambiente (sandbox vs produção) ───────────────────────────────
// https://appmax.readme.io/reference/diferencas-entre-os-ambientes-da-appmax-sandbox-e-producao
function appmaxEnv() {
  const isSandbox = process.env.APPMAX_ENV !== "production";
  return {
    isSandbox,
    authBase:  isSandbox ? "https://auth.sandboxappmax.com.br" : "https://auth.appmax.com.br",
    apiBase:   isSandbox ? "https://api.sandboxappmax.com.br"  : "https://api.appmax.com.br",
    adminBase: isSandbox ? "https://breakingcode.sandboxappmax.com.br" : "https://admin.appmax.com.br",
  };
}

// ─── Token da PLATAFORMA (o "app" Armazix na Appmax) ──────────────
// Um único par client_id/client_secret para toda a instalação do Armazix,
// configurado via `wrangler secret put`. Cacheado em memória do isolate —
// é reemitido a frio a cada cold start, o que é aceitável (token de 1h).
let platformTokenCache: { token: string; expiresAt: number } | null = null;

async function getPlatformToken(): Promise<string> {
  if (platformTokenCache && platformTokenCache.expiresAt > Date.now() + 30_000) {
    return platformTokenCache.token;
  }

  const clientId = process.env.APPMAX_CLIENT_ID;
  const clientSecret = process.env.APPMAX_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("APPMAX_CLIENT_ID/APPMAX_CLIENT_SECRET não configurados (credenciais do app Armazix)");
  }

  const { authBase } = appmaxEnv();
  // A Appmax espera o corpo como application/x-www-form-urlencoded (confirmado
  // no exemplo de curl da FAQ oficial) — JSON aqui dá "Missing form parameter".
  const res = await fetch(`${authBase}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret }).toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Falha ao autenticar app Armazix na Appmax (${res.status}): ${err}`);
  }

  const data = await res.json() as { access_token: string; expires_in: number };
  platformTokenCache = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

// ─── Token do MERCHANT (loja) ──────────────────────────────────────
// Troca client_id/client_secret da loja por um bearer token, com cache em
// stores.appmaxAccessToken (criptografado) + appmaxTokenExpiresAt.
type Db = ReturnType<typeof createDb>;
type StoreRow = typeof stores.$inferSelect;

async function getMerchantToken(db: Db, store: StoreRow, encryptionKey: string): Promise<string | null> {
  if (
    store.appmaxAccessToken &&
    store.appmaxTokenExpiresAt &&
    store.appmaxTokenExpiresAt.getTime() > Date.now() + 60_000
  ) {
    const cached = await decrypt(store.appmaxAccessToken, encryptionKey);
    if (cached) return cached;
  }

  if (!store.appmaxClientId || !store.appmaxClientSecret) return null;

  const clientId = await decrypt(store.appmaxClientId, encryptionKey);
  const clientSecret = await decrypt(store.appmaxClientSecret, encryptionKey);
  if (!clientId || !clientSecret) return null;

  const { authBase } = appmaxEnv();
  const res = await fetch(`${authBase}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret }).toString(),
  });
  if (!res.ok) {
    console.error("Appmax merchant token error:", await res.text());
    return null;
  }

  const data = await res.json() as { access_token: string; expires_in: number };

  await db.update(stores).set({
    appmaxAccessToken: await encrypt(data.access_token, encryptionKey),
    appmaxTokenExpiresAt: new Date(Date.now() + data.expires_in * 1000),
  }).where(eq(stores.id, store.id));

  return data.access_token;
}

// ─── POST /api/payments/appmax-connect ────────────────────────────
// Inicia a instalação do app Armazix na conta Appmax do lojista. Retorna a
// URL de redirecionamento para ele aprovar no painel dele (Appstore flow).
// https://appmax.readme.io/reference/instalacao-do-aplicativo
export async function startAppmaxConnectHandler(request: Request, auth?: AuthContext): Promise<Response> {
  let storeId: string;
  try {
    const access = await requireStoreOwner(auth);
    storeId = access.storeId;
  } catch (error) {
    return json({ error: (error as Error).message || "Unauthorized" }, auth?.userId ? 403 : 401);
  }

  const appId = process.env.APPMAX_APP_ID;
  if (!appId) {
    return json({ error: "Integração Appmax não configurada nesta instalação do Armazix" }, 500);
  }

  const { apiBase, adminBase } = appmaxEnv();
  const origin = new URL(request.url).origin;

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);

  try {
    // external_id é gerado por NÓS (não pela Appmax) e precisa existir ANTES
    // da chamada de autorização — é o que a URL de validação/health-check
    // devolve para a Appmax confirmar a instalação. Idempotente: reaproveita
    // se a loja já tiver um (ex: tentando reconectar).
    const externalId = await ensureAppmaxExternalId(db, storeId);

    const platformToken = await getPlatformToken();

    // Endpoint confirmado via FAQ oficial (appmax.readme.io/reference/faq,
    // pergunta 1 e 4): POST {api}/app/authorize com app_id, client_key,
    // url_callback. "client_key" não é definido em nenhum outro lugar da
    // doc pública — assumimos que é o client_id da PLATAFORMA (Armazix),
    // repetido no corpo. Validar contra o sandbox (ver README).
    const authorizeRes = await fetch(`${apiBase}/app/authorize`, {
      method: "POST",
      headers: { Authorization: `Bearer ${platformToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        app_id: appId,
        client_key: process.env.APPMAX_CLIENT_ID,
        external_key: storeId,          // nosso storeId — usado por NÓS pra correlacionar
        external_id: externalId,        // nosso id de instalação — usado pela Appmax na validação
        url_callback: `${origin}/api/payments/appmax-callback`,
      }),
    });

    if (!authorizeRes.ok) {
      const errText = await authorizeRes.text();
      console.error("Appmax authorize error:", errText);
      // Rota só de owner/admin — seguro devolver o erro bruto da Appmax pra debug.
      return json({ error: `Erro ao iniciar conexão com a Appmax (${authorizeRes.status}): ${errText}` }, 502);
    }

    const { hash } = await authorizeRes.json() as { hash: string };
    return json({ redirectUrl: `${adminBase}/appstore/integration/${hash}` });
  } catch (error) {
    console.error("Appmax connect error:", error);
    return json({ error: (error as Error).message || "Erro ao conectar com a Appmax" }, 500);
  }
}

// ─── GET /api/payments/appmax-diagnose ─────────────────────────────
// TEMPORÁRIO — rota de diagnóstico pra descobrir o formato correto do
// POST /app/authorize sem precisar de um deploy por tentativa. Testa várias
// variações do payload numa única chamada, a partir da rede da Cloudflare
// (a única que conseguiu alcançar a Appmax de forma confiável até agora).
// REMOVER depois de confirmar o formato certo.
export async function appmaxDiagnoseHandler(request: Request, auth?: AuthContext): Promise<Response> {
  try {
    await requireStoreOwner(auth);
  } catch (error) {
    return json({ error: (error as Error).message }, auth?.userId ? 403 : 401);
  }

  const appId = process.env.APPMAX_APP_ID;
  const clientId = process.env.APPMAX_CLIENT_ID;
  if (!appId || !clientId) {
    return json({ error: "APPMAX_APP_ID/APPMAX_CLIENT_ID ausentes" }, 500);
  }

  const { apiBase } = appmaxEnv();
  const origin = new URL(request.url).origin;
  const callback = `${origin}/api/payments/appmax-callback`;

  let platformToken: string;
  try {
    platformToken = await getPlatformToken();
  } catch (error) {
    return json({ step: "platform_token", error: (error as Error).message });
  }

  const variants: Array<{ label: string; init: RequestInit }> = [
    {
      label: "JSON completo (payload atual do connect)",
      init: {
        method: "POST",
        headers: { Authorization: `Bearer ${platformToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          app_id: appId, client_key: clientId, external_key: "diag-test",
          external_id: "11111111-1111-1111-1111-111111111111", url_callback: callback,
        }),
      },
    },
    {
      label: "JSON só o essencial (app_id + url_callback)",
      init: {
        method: "POST",
        headers: { Authorization: `Bearer ${platformToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ app_id: appId, url_callback: callback }),
      },
    },
    {
      label: "JSON com client_id em vez de client_key",
      init: {
        method: "POST",
        headers: { Authorization: `Bearer ${platformToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ app_id: appId, client_id: clientId, url_callback: callback }),
      },
    },
    {
      label: "form-urlencoded (app_id + url_callback)",
      init: {
        method: "POST",
        headers: { Authorization: `Bearer ${platformToken}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ app_id: appId, url_callback: callback }).toString(),
      },
    },
    {
      label: "form-urlencoded com client_key",
      init: {
        method: "POST",
        headers: { Authorization: `Bearer ${platformToken}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ app_id: appId, client_key: clientId, url_callback: callback }).toString(),
      },
    },
    {
      label: "sem Authorization Bearer (só app_id + url_callback, JSON)",
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ app_id: appId, url_callback: callback }),
      },
    },
  ];

  const results: Array<{ label: string; status?: number; body?: string; error?: string }> = [];
  for (const v of variants) {
    try {
      const res = await fetch(`${apiBase}/app/authorize`, v.init);
      const text = await res.text();
      results.push({ label: v.label, status: res.status, body: text });
    } catch (error) {
      results.push({ label: v.label, error: (error as Error).message });
    }
  }

  return json({ platformTokenOk: true, results });
}

/** Garante um external_id (UUID) estável por loja, gerando na primeira chamada. */
async function ensureAppmaxExternalId(db: Db, storeId: string): Promise<string> {
  const existing = await db.query.stores.findFirst({
    where: eq(stores.id, storeId),
    columns: { appmaxExternalId: true },
  });
  if (existing?.appmaxExternalId) return existing.appmaxExternalId;

  const externalId = crypto.randomUUID();
  await db.update(stores).set({ appmaxExternalId: externalId }).where(eq(stores.id, storeId));
  return externalId;
}

// ─── GET /api/payments/appmax-callback ────────────────────────────
// A Appmax redireciona o navegador do lojista para cá depois que ele
// aprova a instalação no painel dele. Trocamos o hash pelas credenciais
// definitivas do merchant (client_id/client_secret) e salvamos criptografado.
export async function appmaxConnectCallbackHandler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  // Nome exato do parâmetro não confirmado — aceitamos as variações mais
  // comuns em fluxos OAuth (hash/code) e o external_key que enviamos na ida.
  const hash = url.searchParams.get("hash") || url.searchParams.get("code");
  const storeIdFromQuery = url.searchParams.get("external_key") || url.searchParams.get("state");

  const redirectToAdmin = (status: "connected" | "error", reason?: string) => {
    const dest = new URL("/admin/financial/settings", url.origin);
    dest.searchParams.set("appmax", status);
    if (reason) dest.searchParams.set("appmax_reason", reason);
    return Response.redirect(dest.toString(), 302);
  };

  if (!hash) return redirectToAdmin("error", "missing_hash");

  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    console.error("ENCRYPTION_KEY not set");
    return redirectToAdmin("error", "server_misconfigured");
  }

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);

  try {
    const platformToken = await getPlatformToken();
    const { apiBase } = appmaxEnv();

    // Endpoint confirmado via FAQ oficial (appmax.readme.io/reference/faq,
    // pergunta 1 e 4): POST {api}/app/client/generate com o hash.
    const credRes = await fetch(`${apiBase}/app/client/generate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${platformToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ hash }),
    });

    if (!credRes.ok) {
      console.error("Appmax credentials exchange error:", await credRes.text());
      return redirectToAdmin("error", "exchange_failed");
    }

    const cred = await credRes.json() as { client_id: string; client_secret: string; external_key?: string };
    const storeId = storeIdFromQuery || cred.external_key;
    if (!storeId) {
      console.error("Appmax callback: could not resolve storeId (external_key ausente)");
      return redirectToAdmin("error", "missing_store");
    }

    await db.update(stores).set({
      appmaxClientId: await encrypt(cred.client_id, encryptionKey),
      appmaxClientSecret: await encrypt(cred.client_secret, encryptionKey),
      appmaxAccessToken: null,
      appmaxTokenExpiresAt: null,
      appmaxConnectedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(stores.id, storeId));

    return redirectToAdmin("connected");
  } catch (error) {
    console.error("Appmax callback error:", error);
    return redirectToAdmin("error", "unexpected");
  }
}

// ─── GET /api/payments/appmax-status ──────────────────────────────
export async function getAppmaxStatusHandler(request: Request, auth?: AuthContext): Promise<Response> {
  let storeId: string;
  try {
    const access = await requireStoreAccess(auth);
    storeId = access.storeId;
  } catch (error) {
    return json({ error: (error as Error).message }, auth?.userId ? 403 : 401);
  }

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);

  const store = await db.query.stores.findFirst({
    where: eq(stores.id, storeId),
    columns: { appmaxClientId: true, appmaxConnectedAt: true },
  });

  return json({ connected: !!store?.appmaxClientId, connectedAt: store?.appmaxConnectedAt ?? null });
}

// ─── GET /api/payments/appmax-health ──────────────────────────────
// "URL de validação" exigida na tela de Configuração de URLs do app, no
// painel da Appmax — chamada por eles para confirmar que a instalação foi
// concluída com sucesso. Deve devolver um external_id (UUID) dinâmico por
// instalação — nunca um valor fixo.
//
// A doc pública não especifica COMO a Appmax identifica qual instalação
// está sendo validada nessa chamada (não há exemplo de request). Aceitamos
// as variações mais prováveis — o external_key que nós mesmos enviamos no
// início do fluxo de autorização (nosso storeId), via query string ou
// header. Validar contra o sandbox e ajustar aqui se vier diferente.
export async function appmaxHealthHandler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const externalKey =
    url.searchParams.get("external_key") ||
    url.searchParams.get("store_id") ||
    url.searchParams.get("storeId") ||
    request.headers.get("x-external-key") ||
    request.headers.get("x-store-id");

  // Log de depuração — útil pra confirmar contra o sandbox real qual
  // identificador a Appmax de fato envia nessa chamada (não documentado).
  console.log("[Appmax health] query=", url.search, "resolved external_key=", externalKey);

  // Sem identificador de instalação — ping genérico, só confirma que o
  // serviço está no ar (não tem como devolver um external_id específico).
  if (!externalKey) {
    return json({ status: "ok" });
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return json({ status: "ok" });

  try {
    const db = createDb(dbUrl);
    const store = await db.query.stores.findFirst({
      where: eq(stores.id, externalKey),
      columns: { appmaxExternalId: true },
    });

    if (!store) {
      return json({ status: "not_found", external_key: externalKey }, 404);
    }

    const externalId = store.appmaxExternalId ?? await ensureAppmaxExternalId(db, externalKey);
    return json({ status: "ok", external_id: externalId });
  } catch (error) {
    console.error("Appmax health check error:", error);
    return json({ status: "error" }, 400);
  }
}

// ─── POST /api/payments/appmax-disconnect ─────────────────────────
export async function disconnectAppmaxHandler(request: Request, auth?: AuthContext): Promise<Response> {
  let storeId: string;
  try {
    const access = await requireStoreOwner(auth);
    storeId = access.storeId;
  } catch (error) {
    return json({ error: (error as Error).message || "Unauthorized" }, auth?.userId ? 403 : 401);
  }

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);

  await db.update(stores).set({
    appmaxClientId: null,
    appmaxClientSecret: null,
    appmaxAccessToken: null,
    appmaxTokenExpiresAt: null,
    appmaxConnectedAt: null,
    updatedAt: new Date(),
  }).where(eq(stores.id, storeId));

  return json({ success: true });
}

// ─── POST /api/payments/appmax-checkout ───────────────────────────
// Cria o pedido no Armazix + o pedido e a cobrança correspondentes na
// Appmax (Pix, boleto ou cartão tokenizado). Espelha createMpCheckoutHandler.
export async function createAppmaxCheckoutHandler(request: Request): Promise<Response> {
  const body = await request.json() as {
    storeId: string;
    type: string;
    method: "pix" | "boleto" | "card";
    cardToken?: string;      // gerado no client via Appmax.js — ver README
    installments?: number;
    document: string;        // CPF/CNPJ do pagador (obrigatório na Appmax)
    items: {
      productId: string; productName: string; productEmoji?: string;
      quantity: number; unitPrice: string; total: string;
    }[];
    subtotal: string;
    deliveryFee?: string;
    total: string;
    addressSnapshot?: {
      street: string; number: string; neighborhood: string;
      city: string; state: string; zip: string; complement?: string;
    };
    estimatedDelivery?: string;
    customerEmail?: string;
    customerName?: string;
    customerPhone?: string;
  };

  if (!body.storeId || !body.items?.length || !body.total || !body.method || !body.document) {
    return json({ error: "storeId, items, total, method e document são obrigatórios" }, 400);
  }
  if (body.method === "card" && !body.cardToken) {
    return json({ error: "cardToken é obrigatório para pagamento com cartão" }, 400);
  }

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);

  const store = await db.query.stores.findFirst({ where: eq(stores.id, body.storeId) });
  if (!store) return json({ error: "Loja não encontrada" }, 404);
  if (!store.appmaxClientId) {
    return json({ error: "Pagamento via App Max não configurado para esta loja." }, 400);
  }

  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    console.error("ENCRYPTION_KEY not set");
    return json({ error: "Configuração de segurança incompleta" }, 500);
  }

  const merchantToken = await getMerchantToken(db, store, encryptionKey);
  if (!merchantToken) {
    return json({ error: "Falha ao autenticar com a Appmax. Reconecte a integração em Configurações." }, 502);
  }

  // Preços verificados a partir do banco — evita preço obsoleto/manipulado (igual ao MP).
  const productIds = body.items.map(i => i.productId).filter(Boolean) as string[];
  const dbProducts = productIds.length > 0
    ? await db.select({ id: products.id, price: products.price, name: products.name })
        .from(products).where(inArray(products.id, productIds))
    : [];
  const priceMap = new Map(dbProducts.map(p => [p.id, p.price]));

  for (const item of body.items) {
    if (item.productId && !priceMap.has(item.productId)) {
      return json({ error: `Produto não encontrado: ${item.productId}` }, 400);
    }
  }

  const verifiedItems = body.items.map(item => {
    if (!item.productId) return item;
    const dbPrice = priceMap.get(item.productId)!;
    return { ...item, unitPrice: dbPrice, total: (parseFloat(dbPrice) * item.quantity).toFixed(2) };
  });

  const deliveryFee = parseFloat(body.deliveryFee || "0");
  const subtotal = verifiedItems.reduce((sum, i) => sum + parseFloat(i.total), 0);
  const total = (subtotal + deliveryFee).toFixed(2);

  const [maxOrder] = await db
    .select({ max: sql<number>`COALESCE(MAX(${orders.number}), 0)` })
    .from(orders).where(eq(orders.storeId, body.storeId));
  const nextNumber = (Number(maxOrder?.max) || 0) + 1;

  const [order] = await db.insert(orders).values({
    storeId: body.storeId,
    number: nextNumber,
    status: "received",
    type: body.type || "delivery",
    paymentMethod: "appmax",
    paymentStatus: "pending",
    subtotal: subtotal.toFixed(2),
    deliveryFee: deliveryFee.toFixed(2),
    discount: "0",
    total,
    addressSnapshot: body.addressSnapshot || null,
    estimatedDelivery: body.estimatedDelivery ? new Date(body.estimatedDelivery) : null,
  }).returning();

  await db.insert(orderItems).values(verifiedItems.map(item => ({
    orderId: order.id,
    productId: item.productId || null,
    productName: item.productName,
    productEmoji: item.productEmoji || null,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    additionsTotal: "0",
    total: item.total,
  })));

  await db.insert(orderTimeline).values({
    orderId: order.id,
    status: "received",
    note: "Pedido criado — aguardando pagamento via Appmax",
  });

  for (const item of body.items) {
    if (item.productId) {
      await db.update(products)
        .set({ stock: sql`${products.stock} - ${item.quantity}`, updatedAt: new Date() })
        .where(eq(products.id, item.productId));
    }
  }

  const { apiBase } = appmaxEnv();
  const centsOf = (v: string) => Math.round(parseFloat(v) * 100);
  const authHeaders = { Authorization: `Bearer ${merchantToken}`, "Content-Type": "application/json" };

  // 1) Cria o pedido na Appmax — https://appmax.readme.io/reference/criar-um-um-pedido-na-appmax
  const appmaxOrderRes = await fetch(`${apiBase}/v1/orders`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      customer: {
        name: body.customerName, email: body.customerEmail,
        phone: body.customerPhone, document_number: body.document.replace(/\D/g, ""),
      },
      products_value: centsOf(subtotal.toFixed(2)),
      shipping_value: centsOf(deliveryFee.toFixed(2)),
      discount_value: 0,
      products: verifiedItems.map(item => ({
        sku: item.productId || "item", name: item.productName,
        quantity: item.quantity, unit_value: centsOf(item.unitPrice),
      })),
    }),
  });

  if (!appmaxOrderRes.ok) {
    console.error("Appmax order create error:", await appmaxOrderRes.text());
    return json({ error: "Erro ao criar pedido na Appmax", orderId: order.id }, 502);
  }

  const appmaxOrderBody = await appmaxOrderRes.json() as { data: { order: { id: number | string; status: string } } };
  const appmaxOrderId = String(appmaxOrderBody.data.order.id);

  await db.update(orders).set({ appmaxOrderId }).where(eq(orders.id, order.id));

  // 2) Dispara a cobrança conforme o método escolhido.
  const documentDigits = body.document.replace(/\D/g, "");
  let paymentPath: string;
  let paymentData: Record<string, unknown>;

  if (body.method === "pix") {
    paymentPath = "/v1/payments/pix";
    paymentData = { pix: { document_number: documentDigits } };
  } else if (body.method === "boleto") {
    paymentPath = "/v1/payments/boleto";
    paymentData = { boleto: { document_number: documentDigits } };
  } else {
    // Cartão — endpoint não confirmado na doc pública consultada; validar
    // contra o sandbox (ver README). Segue o mesmo padrão de pix/boleto.
    paymentPath = "/v1/payments/credit-card";
    paymentData = { credit_card: { token: body.cardToken, installments: body.installments ?? 1, document_number: documentDigits } };
  }

  const paymentRes = await fetch(`${apiBase}${paymentPath}`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ order_id: appmaxOrderBody.data.order.id, payment_data: paymentData }),
  });

  const paymentResult = await paymentRes.json().catch(() => ({}));

  if (!paymentRes.ok) {
    console.error("Appmax payment create error:", paymentResult);
    return json({ error: "Erro ao processar pagamento na Appmax", orderId: order.id, appmaxOrderId }, 502);
  }

  return json({
    orderId: order.id,
    orderNumber: order.number,
    appmaxOrderId,
    payment: paymentResult,
  });
}

// ─── Eventos de webhook suportados ─────────────────────────────────
// https://appmax.readme.io/reference/webhooks
interface AppmaxWebhookPayload {
  event: string;
  event_type?: string;
  data?: {
    order?: { id?: number | string; status?: string; [key: string]: unknown };
    id?: number | string;
    [key: string]: unknown;
  };
}

interface AppmaxEventOutcome {
  paymentStatus: "pending" | "paid" | "failed" | "refunded";
  orderStatus: "received" | "confirmed" | "cancelled";
  note: string;
}

export const APPMAX_EVENT_MAP: Record<string, AppmaxEventOutcome> = {
  order_approved:                { paymentStatus: "paid",     orderStatus: "confirmed", note: "Pedido aprovado via Appmax" },
  order_paid:                    { paymentStatus: "paid",     orderStatus: "confirmed", note: "Pedido pago via Appmax" },
  order_authorized:              { paymentStatus: "pending",  orderStatus: "received",  note: "Pedido autorizado (análise antifraude) via Appmax" },
  order_integrated:              { paymentStatus: "paid",     orderStatus: "confirmed", note: "Pedido integrado via Appmax" },
  order_refund:                  { paymentStatus: "refunded", orderStatus: "cancelled", note: "Pedido estornado via Appmax" },
  order_chargeback_in_treatment: { paymentStatus: "pending",  orderStatus: "received",  note: "Chargeback em tratamento via Appmax" },
  order_pix_created:             { paymentStatus: "pending",  orderStatus: "received",  note: "Pix gerado via Appmax" },
  order_paid_by_pix:             { paymentStatus: "paid",     orderStatus: "confirmed", note: "Pix pago via Appmax" },
  order_pix_expired:             { paymentStatus: "failed",   orderStatus: "cancelled", note: "Pix expirado via Appmax" },
  order_billet_created:          { paymentStatus: "pending",  orderStatus: "received",  note: "Boleto gerado via Appmax" },
  order_billet_overdue:          { paymentStatus: "failed",   orderStatus: "cancelled", note: "Boleto vencido via Appmax" },
  order_authorized_with_delay:   { paymentStatus: "pending",  orderStatus: "received",  note: "Pedido autorizado com atraso via Appmax" },
  payment_not_authorized:        { paymentStatus: "failed",   orderStatus: "cancelled", note: "Pagamento não autorizado via Appmax" },
  payment_authorized_with_delay: { paymentStatus: "pending",  orderStatus: "received",  note: "Pagamento autorizado com atraso via Appmax" },
};

/** Extrai o id do pedido Appmax do payload, tolerando os dois formatos observados na doc. */
export function extractAppmaxOrderId(payload: AppmaxWebhookPayload): string | null {
  const raw = payload?.data?.order?.id ?? payload?.data?.id;
  return raw !== undefined && raw !== null ? String(raw) : null;
}

/** Processa um evento já validado: atualiza o pedido, timeline e audita. Exportado para teste direto. */
export async function processAppmaxWebhookEvent(payload: AppmaxWebhookPayload): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) { console.error("[Appmax webhook] DATABASE_URL not set"); return; }
  const db = createDb(dbUrl);

  const event = payload?.event ?? "unknown";
  const appmaxOrderId = extractAppmaxOrderId(payload);
  const mapping = APPMAX_EVENT_MAP[event];

  const order = appmaxOrderId
    ? await db.query.orders.findFirst({ where: eq(orders.appmaxOrderId, appmaxOrderId) })
    : undefined;

  if (!order) {
    console.error(`[Appmax webhook] Pedido não encontrado — appmaxOrderId=${appmaxOrderId} event=${event}`);
    await db.insert(auditLogs).values({
      modulo: "PAGAMENTO_APPMAX",
      action: `WEBHOOK_${event.toUpperCase()}`,
      resourceType: "appmax_order",
      resourceId: appmaxOrderId,
      details: { payload },
      status: "error",
      errorMessage: "Pedido não encontrado localmente",
    });
    return;
  }

  if (!mapping) {
    console.error(`[Appmax webhook] Evento não mapeado: ${event}`);
    await db.insert(auditLogs).values({
      storeId: order.storeId,
      modulo: "PAGAMENTO_APPMAX",
      action: `WEBHOOK_${event.toUpperCase()}`,
      resourceType: "order",
      resourceId: order.id,
      details: { payload },
      status: "error",
      errorMessage: "Evento não mapeado",
    });
    return;
  }

  await db.update(orders).set({
    paymentStatus: mapping.paymentStatus,
    status: mapping.orderStatus,
    updatedAt: new Date(),
  }).where(eq(orders.id, order.id));

  await db.insert(orderTimeline).values({
    orderId: order.id,
    status: mapping.orderStatus,
    note: mapping.note,
  });

  await db.insert(auditLogs).values({
    storeId: order.storeId,
    modulo: "PAGAMENTO_APPMAX",
    action: `WEBHOOK_${event.toUpperCase()}`,
    resourceType: "order",
    resourceId: order.id,
    details: { payload },
    status: "success",
  });
}

function validateAppmaxWebhook(request: Request, secret: string): boolean {
  // A Appmax não documenta assinatura HMAC. A URL de webhook é única para
  // todo o app (configurada uma vez no painel de desenvolvedor), então o
  // segredo é embutido na própria URL registrada (?key=...). Também aceita
  // o header x-api-key, caso o painel da Appmax permita configurar headers.
  return validateWebhookQueryKey(request, secret).valid || validateWebhookApiKey(request, secret).valid;
}

// ─── POST /api/payments/appmax-webhook ────────────────────────────
// URL única para toda a plataforma — registrada uma vez no app da Appmax.
// Responde 200 imediatamente e processa em background (waitUntil).
export async function appmaxWebhookHandler(request: Request): Promise<Response> {
  const webhookSecret = process.env.WEBHOOK_API_KEY;
  if (!webhookSecret) {
    console.error("WEBHOOK_API_KEY not configured - Appmax webhook validation disabled");
    return new Response("Webhook security not configured", { status: 500 });
  }

  if (!validateAppmaxWebhook(request, webhookSecret)) {
    console.error("Appmax webhook validation failed");
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: AppmaxWebhookPayload;
  try {
    payload = await request.json() as AppmaxWebhookPayload;
  } catch {
    // Corpo inválido — nada a processar, mas não queremos que a Appmax
    // fique retentando por causa de um 4xx/5xx.
    return new Response("ok", { status: 200 });
  }

  waitUntil(request, processAppmaxWebhookEvent(payload));

  return new Response("ok", { status: 200 });
}
