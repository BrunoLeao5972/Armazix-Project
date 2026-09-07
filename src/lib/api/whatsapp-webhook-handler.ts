// ─────────────────────────────────────────────────────────────────────────
// Recebe eventos da Evolution API (POST /webhook/set/{instance} configurado
// em connectWhatsAppHandler, src/lib/api/whatsapp-handler.ts) e responde
// automaticamente ao CLIENTE quando ele manda a primeira mensagem pro
// WhatsApp da loja — recurso novo, não existia nenhuma recepção de
// mensagem antes disso (a integração era só de saída).
//
// Rota PÚBLICA (sem requireAuth — a Evolution API não tem sessão de loja
// nenhuma) — autenticada por um segredo compartilhado próprio
// (WHATSAPP_WEBHOOK_SECRET) embutido na própria URL do webhook como query
// param, mais o storeId (também na query) cruzado contra o `instance` do
// payload por segurança extra.
//
// Payload real confirmado com mensagem de teste de verdade (evento
// MESSAGES_UPSERT) — os campos ficam aninhados em data.key, não soltos em
// data.* como a documentação da Evolution API sugere:
//   { instance, event, data: { key: { remoteJid, fromMe, id, remoteJidAlt?, addressingMode? }, pushName, message: { conversation } } }
//
// IMPORTANTE — endereçamento "lid": o WhatsApp vem migrando contatos pro
// modo de endereçamento por "lid" (Linked ID, um identificador opaco de
// privacidade), e nesse caso `key.remoteJid` vem como "<lid>@lid" — um ID
// que NÃO é um número de telefone e não dá pra usar em sendText. A
// Evolution API manda o número de telefone de verdade em
// `key.remoteJidAlt` (com `key.addressingMode === "lid"`) — sem tratar
// isso, toda resposta automática falha silenciosamente pra esses contatos
// (foi exatamente o que aconteceu no teste real: o "oi" chegou, mas a
// resposta nunca saiu, porque tentou mandar pro "número" 3483839246444,
// que é o lid, não o telefone).
// ─────────────────────────────────────────────────────────────────────────

import { createDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { redisRateLimit } from "@/lib/cache/redis";
import { instanceName, fillTemplate, sendWppText, migrateWppConfig, DEFAULT_WPP_CONFIG, type WppConfig } from "@/lib/whatsapp-sender";

const { stores } = schema;

interface EvolutionMessagePayload {
  instance?: string;
  event?: string;
  data?: {
    key?: { remoteJid?: string; remoteJidAlt?: string; fromMe?: boolean; id?: string };
    remoteJid?: string;
    fromMe?: boolean;
    pushName?: string;
    message?: {
      conversation?: string;
      extendedTextMessage?: { text?: string };
    };
  };
}

/** Resolve o JID pro número de telefone de verdade — troca por remoteJidAlt
 *  quando o principal vem no endereçamento opaco "@lid" (ver nota acima). */
function resolverRemoteJid(data: EvolutionMessagePayload["data"]): string | undefined {
  const principal = data?.key?.remoteJid ?? data?.remoteJid;
  if (principal?.endsWith("@lid") && data?.key?.remoteJidAlt) return data.key.remoteJidAlt;
  return principal;
}

function extrairTexto(data: EvolutionMessagePayload["data"]): string | null {
  const msg = data?.message;
  return msg?.conversation || msg?.extendedTextMessage?.text || null;
}

export async function whatsappWebhookHandler(request: Request): Promise<Response> {
  // Sempre 200 rápido — um webhook de terceiro nunca deve ver 500 e ficar
  // re-tentando às cegas; qualquer problema fica só no log do servidor.
  const ok = () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });

  const url = new URL(request.url);
  const secret = url.searchParams.get("secret");
  const expected = process.env.WHATSAPP_WEBHOOK_SECRET;
  if (!expected || secret !== expected) {
    return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { "content-type": "application/json" } });
  }

  const storeId = url.searchParams.get("storeId");
  if (!storeId) return ok();

  try {
    const payload = await request.json() as EvolutionMessagePayload;
    // O nome do evento chega como "messages.upsert" (minúsculo, com ponto)
    // nesse servidor — a documentação oficial da Evolution API descreve
    // "MESSAGES_UPSERT" (maiúsculo, com underscore), que nunca bate de
    // verdade. Confirmado com mensagem real de produção (o "oi" de teste
    // batia certinho no evento, mas essa comparação descartava tudo antes
    // de qualquer outra checagem) — normalizo pra não depender da grafia exata.
    const eventoNormalizado = (payload.event ?? "").toLowerCase().replace(/[._-]/g, "");
    if (eventoNormalizado !== "messagesupsert") return ok();

    // Cross-check: o instance do payload precisa bater com o storeId da
    // própria URL — defesa extra caso alguém tente reusar a URL de uma
    // loja pra "injetar" evento em outra.
    if (payload.instance && payload.instance !== instanceName(storeId)) return ok();

    const data = payload.data;
    const fromMe = data?.fromMe ?? data?.key?.fromMe ?? false;
    if (fromMe) return ok(); // nunca responder mensagem que o próprio número da loja mandou

    const remoteJid = resolverRemoteJid(data);
    if (!remoteJid || remoteJid.endsWith("@g.us")) return ok(); // ignora grupo
    // Se ainda sobrou um "@lid" sem remoteJidAlt disponível, não tem como
    // resolver o telefone real — melhor não responder do que mandar pro
    // ID errado (o próprio sendWppText falharia silenciosamente).
    if (remoteJid.endsWith("@lid")) return ok();

    const texto = extrairTexto(data);
    if (!texto) return ok(); // v1 só reage a mensagem de texto (sem sticker/mídia sem legenda)

    const db = createDb(process.env.DATABASE_URL!);
    const [store] = await db.select({ name: stores.name, slug: stores.slug, wppConfig: stores.wppConfig })
      .from(stores).where(eq(stores.id, storeId)).limit(1);
    if (!store) return ok();

    const cfg = migrateWppConfig((store.wppConfig as WppConfig | null) ?? DEFAULT_WPP_CONFIG);
    if (!cfg.autoReply?.enabled) return ok();

    const phone = remoteJid.replace("@s.whatsapp.net", "");
    const cooldownSeconds = Math.max(1, (cfg.autoReply.cooldownMinutes || 60) * 60);
    const { allowed } = await redisRateLimit(`wpp:autoreply:${storeId}:${phone}`, 1, cooldownSeconds);
    if (!allowed) return ok(); // já respondeu esse número dentro da janela

    const texto2 = fillTemplate(cfg.autoReply.message || "", {
      loja: store.name,
      nome: data?.pushName || "",
      link: `https://${store.slug}.armazix.com.br`,
    });
    await sendWppText(storeId, phone, texto2);

    return ok();
  } catch (error) {
    console.error("[whatsapp-webhook] erro ao processar evento:", error);
    return ok();
  }
}
