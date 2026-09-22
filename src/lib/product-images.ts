// ─────────────────────────────────────────────────────────────────────────
// Galeria de fotos do produto — módulo puro, usado pelo cadastro (admin), pelo
// servidor (ao salvar) e pela loja pública (ao exibir).
//
// Regras:
//   - no máximo MAX_PRODUCT_IMAGES fotos por produto;
//   - sempre exatamente 1 capa (a foto principal, mostrada nos cards);
//   - a capa vai na frente; o resto mantém a ordem em que foi cadastrado;
//   - sem duplicatas nem entradas vazias.
//
// Por que existe: o banco guarda `images` como [{ url, isPrimary }], mas a loja
// tratava o campo como string[] e descartava tudo que não era texto — só a
// capa (imageUrl) aparecia. Ler o formato aqui, num lugar só, evita isso.
// ─────────────────────────────────────────────────────────────────────────

export const MAX_PRODUCT_IMAGES = 6;

export interface ProductImageEntry {
  url: string;
  isPrimary: boolean;
}

const urlValida = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";

/** Aceita o formato atual ({ url, isPrimary }) e o antigo (URL solta). */
function lerEntrada(v: unknown): ProductImageEntry | null {
  if (urlValida(v)) return { url: v, isPrimary: false };
  if (v && typeof v === "object" && urlValida((v as { url?: unknown }).url)) {
    return { url: (v as { url: string }).url, isPrimary: (v as { isPrimary?: unknown }).isPrimary === true };
  }
  return null;
}

/**
 * Normaliza a lista de fotos de um produto.
 * `imageUrl` é a capa gravada no produto: se a lista não a tem (produto antigo,
 * só com imageUrl), ela entra na frente como capa.
 */
export function normalizarImagensProduto(
  images: unknown,
  imageUrl?: string | null,
  max: number = MAX_PRODUCT_IMAGES,
): ProductImageEntry[] {
  const vistas = new Map<string, ProductImageEntry>();
  for (const bruta of Array.isArray(images) ? images : []) {
    const e = lerEntrada(bruta);
    if (!e) continue;
    const ja = vistas.get(e.url);
    if (ja) ja.isPrimary = ja.isPrimary || e.isPrimary; // duplicata: mantém a 1ª, herda a capa
    else vistas.set(e.url, e);
  }
  const lista = [...vistas.values()];

  if (urlValida(imageUrl) && !vistas.has(imageUrl)) {
    lista.forEach(i => { i.isPrimary = false; });
    lista.unshift({ url: imageUrl, isPrimary: true });
  }
  if (lista.length === 0) return [];

  let capa = lista.findIndex(i => i.isPrimary);
  if (capa < 0) capa = urlValida(imageUrl) ? lista.findIndex(i => i.url === imageUrl) : -1;
  if (capa < 0) capa = 0;

  const ordenada = [lista[capa], ...lista.filter((_, i) => i !== capa)].slice(0, Math.max(1, max));
  return ordenada.map((img, i) => ({ url: img.url, isPrimary: i === 0 }));
}

/** URLs da galeria pública: capa primeiro, até MAX_PRODUCT_IMAGES. */
export function galeriaDoProduto(p: { imageUrl?: string | null; images?: unknown }): string[] {
  return normalizarImagensProduto(p.images, p.imageUrl).map(i => i.url);
}
