// ─────────────────────────────────────────────────────────────────────────
// Geocodificação de endereços — Nominatim (OpenStreetMap), gratuito.
//
// Usado pelos modelos de frete por distância (dinâmica, raio, bairro no
// mapa, matriz) para converter o endereço do cliente em lat/lng e calcular
// a distância até a loja.
//
// Nominatim exige (política de uso deles):
//   - Header User-Agent identificando a aplicação (obrigatório).
//   - No máximo ~1 requisição/segundo — respeitado aqui via redisRateLimit
//     compartilhado entre todos os isolates do Worker.
//
// Só o resultado "endereço não encontrado" é cacheado a longo prazo (não
// existe = não vai passar a existir amanhã). Falha de rede/limite de taxa
// propaga como exceção — não fica preso em cache achando que o endereço é
// inválido por causa de um problema passageiro.
// ─────────────────────────────────────────────────────────────────────────

import { getCached, redisRateLimit } from "@/lib/cache/redis";

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface GeocodeAddress {
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  zip: string;
}

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "Armazix/1.0 (contato@armazix.com.br)";
const GEOCODE_CACHE_TTL = 30 * 24 * 60 * 60; // 30 dias — coordenadas não mudam

/** @throws se a requisição falhar (rede, limite de taxa, Nominatim fora do ar) */
async function nominatimSearch(query: string): Promise<GeoPoint | null> {
  // Respeita o limite de taxa do Nominatim — best-effort: se o contador
  // global estourar, espera um pouco e tenta de novo antes de desistir.
  let allowed = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    const rl = await redisRateLimit("geocode:nominatim", 1, 1);
    if (rl.allowed) { allowed = true; break; }
    await new Promise(r => setTimeout(r, 350 + attempt * 350));
  }
  if (!allowed) throw new Error("Limite de requisições ao serviço de geolocalização atingido");

  const url = `${NOMINATIM_URL}?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Nominatim respondeu ${res.status}`);

  const results = await res.json() as Array<{ lat: string; lon: string }>;
  const first = results[0];
  if (!first) return null; // endereço não encontrado — resultado definitivo, seguro pra cachear

  const lat = parseFloat(first.lat);
  const lng = parseFloat(first.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

/**
 * Geocodifica um endereço brasileiro estruturado.
 * Retorna null se o endereço não for encontrado; lança exceção se a
 * consulta em si falhar (rede, limite de taxa) — chame com try/catch.
 */
export async function geocodeAddress(addr: GeocodeAddress): Promise<GeoPoint | null> {
  if (!addr.street?.trim() || !addr.city?.trim() || !addr.state?.trim()) return null;

  const key = [addr.street, addr.number, addr.neighborhood, addr.city, addr.state, addr.zip]
    .map(s => (s || "").trim().toLowerCase())
    .join("|");
  const query = `${addr.street}, ${addr.number}, ${addr.neighborhood}, ${addr.city}, ${addr.state}, ${addr.zip}, Brasil`;

  return getCached<GeoPoint | null>(
    `geocode:${key}`,
    () => nominatimSearch(query),
    { ttl: GEOCODE_CACHE_TTL, staleTtl: GEOCODE_CACHE_TTL },
  );
}

/** Geocodifica um endereço em texto livre (ex: o endereço cadastrado da loja). */
export async function geocodeFreeText(text: string): Promise<GeoPoint | null> {
  if (!text?.trim()) return null;
  return getCached<GeoPoint | null>(
    `geocode:freetext:${text.trim().toLowerCase()}`,
    () => nominatimSearch(`${text}, Brasil`),
    { ttl: GEOCODE_CACHE_TTL, staleTtl: GEOCODE_CACHE_TTL },
  );
}
