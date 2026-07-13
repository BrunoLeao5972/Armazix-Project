import { requireStoreAccess, AuthContext } from "@/lib/auth/require-store-access";
import { createDb } from "@/lib/db";
import { schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { DEFAULT_WPP_CONFIG, migrateWppConfig, type WppConfig } from "@/lib/whatsapp-sender";

const { stores } = schema;

// ──────────────────────────────────────────────────────────────────────────────
// Evolution API — backend WhatsApp (https://github.com/EvolutionAPI/evolution-api)
// Configure as variáveis de ambiente:
//   EVOLUTION_API_URL  → ex: https://seu-evo.seudominio.com.br
//   EVOLUTION_API_KEY  → chave global definida no .env do Evolution API
// ──────────────────────────────────────────────────────────────────────────────

const EVO_URL = (process.env.EVOLUTION_API_URL ?? "").replace(/\/$/, "");
const EVO_KEY = process.env.EVOLUTION_API_KEY ?? "";

function evoHeaders() {
  return { "Content-Type": "application/json", apikey: EVO_KEY };
}

// Nome da instância derivado do storeId (20 chars alphanumeric)
function instanceName(storeId: string) {
  return `armazix_${storeId.replace(/-/g, "").slice(0, 16)}`;
}

function notConfigured() {
  return new Response(
    JSON.stringify({
      error:
        "Integração não configurada. Defina EVOLUTION_API_URL e EVOLUTION_API_KEY no servidor.",
      configured: false,
    }),
    { status: 503, headers: { "content-type": "application/json" } }
  );
}

function jsonRes(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// ─── GET /api/whatsapp/status ────────────────────────────────────────────────
export async function getWhatsAppStatusHandler(
  _request: Request,
  auth?: AuthContext
): Promise<Response> {
  let storeId: string;
  try {
    ({ storeId } = await requireStoreAccess(auth));
  } catch (e) {
    return jsonRes({ error: (e as Error).message }, auth?.userId ? 403 : 401);
  }

  if (!EVO_URL || !EVO_KEY) {
    return jsonRes({ connected: false, configured: false });
  }

  const instance = instanceName(storeId);

  try {
    // 1. Verificar estado da conexão
    const stateRes = await fetch(`${EVO_URL}/instance/connectionState/${instance}`, {
      headers: evoHeaders(),
    });

    if (!stateRes.ok) {
      // Instância não existe ainda
      return jsonRes({ connected: false, configured: true });
    }

    const stateData = (await stateRes.json()) as {
      instance?: { state?: string };
    };
    const state = stateData?.instance?.state;

    if (state === "open") {
      // 2a. Conectado — buscar dados do perfil
      const fetchRes = await fetch(`${EVO_URL}/instance/fetchInstances`, {
        headers: evoHeaders(),
      });
      let phone: string | undefined;
      let profileName: string | undefined;
      if (fetchRes.ok) {
        const list = (await fetchRes.json()) as Array<{
          instance?: { instanceName?: string; profileName?: string; ownerJid?: string };
        }>;
        const found = list.find((i) => i.instance?.instanceName === instance);
        phone = found?.instance?.ownerJid?.replace("@s.whatsapp.net", "");
        profileName = found?.instance?.profileName ?? undefined;
      }
      return jsonRes({ connected: true, phone, profileName, configured: true });
    }

    // 2b. Aguardando leitura — devolver QR atualizado
    const qrRes = await fetch(`${EVO_URL}/instance/connect/${instance}`, {
      headers: evoHeaders(),
    });
    if (qrRes.ok) {
      const qrData = (await qrRes.json()) as { base64?: string; code?: string };
      return jsonRes({
        connected: false,
        configured: true,
        qrCode: qrData.base64 ?? qrData.code,
      });
    }

    return jsonRes({ connected: false, configured: true });
  } catch (e) {
    console.error("[whatsapp] status error:", e);
    return jsonRes({ connected: false, configured: true, error: (e as Error).message });
  }
}

// ─── POST /api/whatsapp/connect ──────────────────────────────────────────────
export async function connectWhatsAppHandler(
  _request: Request,
  auth?: AuthContext
): Promise<Response> {
  let storeId: string;
  try {
    ({ storeId } = await requireStoreAccess(auth));
  } catch (e) {
    return jsonRes({ error: (e as Error).message }, auth?.userId ? 403 : 401);
  }

  if (!EVO_URL || !EVO_KEY) return notConfigured();

  const instance = instanceName(storeId);

  try {
    // Checar se instância já existe
    const stateRes = await fetch(`${EVO_URL}/instance/connectionState/${instance}`, {
      headers: evoHeaders(),
    });

    if (stateRes.ok) {
      const stateData = (await stateRes.json()) as {
        instance?: { state?: string };
      };
      // Já conectado
      if (stateData?.instance?.state === "open") {
        return jsonRes({ connected: true, configured: true });
      }
      // Instância existe mas não está conectada → retornar QR
      const qrRes = await fetch(`${EVO_URL}/instance/connect/${instance}`, {
        headers: evoHeaders(),
      });
      if (qrRes.ok) {
        const qrData = (await qrRes.json()) as { base64?: string; code?: string };
        return jsonRes({ connected: false, qrCode: qrData.base64 ?? qrData.code, configured: true });
      }
    }

    // Criar nova instância
    const createRes = await fetch(`${EVO_URL}/instance/create`, {
      method: "POST",
      headers: evoHeaders(),
      body: JSON.stringify({
        instanceName: instance,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS",
      }),
    });

    if (!createRes.ok) {
      const err = (await createRes.json().catch(() => ({}))) as { message?: string };
      throw new Error(err.message ?? "Falha ao criar instância");
    }

    const createData = (await createRes.json()) as {
      qrcode?: { base64?: string; code?: string };
    };

    return jsonRes({
      connected: false,
      configured: true,
      qrCode: createData.qrcode?.base64 ?? createData.qrcode?.code,
    });
  } catch (e) {
    console.error("[whatsapp] connect error:", e);
    return jsonRes({ error: (e as Error).message, configured: true }, 500);
  }
}

// ─── GET /api/whatsapp/config ────────────────────────────────────────────────
export async function getWppConfigHandler(
  _request: Request,
  auth?: AuthContext
): Promise<Response> {
  let storeId: string;
  try {
    ({ storeId } = await requireStoreAccess(auth));
  } catch (e) {
    return jsonRes({ error: (e as Error).message }, auth?.userId ? 403 : 401);
  }

  const db = createDb(process.env.DATABASE_URL!);
  const [store] = await db.select({ wppConfig: stores.wppConfig }).from(stores).where(eq(stores.id, storeId)).limit(1);
  const raw = store?.wppConfig ?? DEFAULT_WPP_CONFIG;
  return jsonRes({ config: migrateWppConfig(raw) });
}

// ─── POST /api/whatsapp/config ───────────────────────────────────────────────
export async function saveWppConfigHandler(
  request: Request,
  auth?: AuthContext
): Promise<Response> {
  let storeId: string;
  try {
    ({ storeId } = await requireStoreAccess(auth));
  } catch (e) {
    return jsonRes({ error: (e as Error).message }, auth?.userId ? 403 : 401);
  }

  const body = await request.json() as { config: WppConfig };
  if (!body.config) return jsonRes({ error: "config obrigatório" }, 400);

  const db = createDb(process.env.DATABASE_URL!);
  await db.update(stores).set({ wppConfig: body.config, updatedAt: new Date() }).where(eq(stores.id, storeId));
  return jsonRes({ success: true });
}

// ─── POST /api/whatsapp/disconnect ───────────────────────────────────────────
export async function disconnectWhatsAppHandler(
  _request: Request,
  auth?: AuthContext
): Promise<Response> {
  let storeId: string;
  try {
    ({ storeId } = await requireStoreAccess(auth));
  } catch (e) {
    return jsonRes({ error: (e as Error).message }, auth?.userId ? 403 : 401);
  }

  if (!EVO_URL || !EVO_KEY) return jsonRes({ success: true });

  const instance = instanceName(storeId);

  try {
    // Logout do WhatsApp e exclusão da instância
    await fetch(`${EVO_URL}/instance/logout/${instance}`, {
      method: "DELETE",
      headers: evoHeaders(),
    }).catch(() => {});
    await fetch(`${EVO_URL}/instance/delete/${instance}`, {
      method: "DELETE",
      headers: evoHeaders(),
    }).catch(() => {});

    return jsonRes({ success: true });
  } catch (e) {
    console.error("[whatsapp] disconnect error:", e);
    return jsonRes({ error: (e as Error).message }, 500);
  }
}
