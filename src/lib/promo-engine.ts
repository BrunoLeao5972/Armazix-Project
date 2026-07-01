// Motor de validação de promoções por recorrência
// Funciona identicamente em Cloudflare Workers e no browser

export type PromoConfig = {
  enabled: boolean;
  promoPrice: string;       // "15.90"
  daysOfWeek: number[];     // 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sáb
  timeStart: string | null; // "HH:MM" ou null = sem restrição de horário
  timeEnd: string | null;   // "HH:MM" ou null = sem restrição de horário
  dateStart: string | null; // "YYYY-MM-DD" ou null = sem início definido
  dateEnd: string | null;   // "YYYY-MM-DD" ou null = sem fim definido
  applyToPdv: boolean;
  applyToStore: boolean;
};

export const DEFAULT_PROMO_CONFIG: PromoConfig = {
  enabled: false,
  promoPrice: "",
  daysOfWeek: [],
  timeStart: null,
  timeEnd: null,
  dateStart: null,
  dateEnd: null,
  applyToPdv: true,
  applyToStore: true,
};

/**
 * Valida se a promoção está ativa no instante dado para o canal solicitado.
 * Todas as condições configuradas devem ser verdadeiras (AND).
 */
export function isPromoActive(
  config: PromoConfig | null | undefined,
  channel: "pdv" | "store",
  now: Date = new Date()
): boolean {
  if (!config?.enabled) return false;
  if (!config.promoPrice || parseFloat(config.promoPrice) <= 0) return false;

  // Canal
  if (channel === "pdv"   && !config.applyToPdv)   return false;
  if (channel === "store" && !config.applyToStore)  return false;

  // Período de vigência (datas)
  if (config.dateStart) {
    if (now < new Date(config.dateStart + "T00:00:00")) return false;
  }
  if (config.dateEnd) {
    if (now > new Date(config.dateEnd + "T23:59:59")) return false;
  }

  // Dia da semana (vazio = todos os dias)
  if (config.daysOfWeek.length > 0 && !config.daysOfWeek.includes(now.getDay())) return false;

  // Horário (ambos precisam estar configurados para restringir)
  if (config.timeStart && config.timeEnd) {
    const toMins = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    };
    const nowMins  = now.getHours() * 60 + now.getMinutes();
    const startMin = toMins(config.timeStart);
    const endMin   = toMins(config.timeEnd);
    if (nowMins < startMin || nowMins > endMin) return false;
  }

  return true;
}

/**
 * Retorna o preço efetivo considerando a promoção ativa para o canal.
 */
export function getEffectivePrice(
  price: string,
  config: PromoConfig | null | undefined,
  channel: "pdv" | "store"
): { effectivePrice: number; originalPrice: number | null; promoActive: boolean } {
  const base = parseFloat(price) || 0;
  if (isPromoActive(config, channel)) {
    const promo = parseFloat(config!.promoPrice) || base;
    return { effectivePrice: promo, originalPrice: base, promoActive: true };
  }
  return { effectivePrice: base, originalPrice: null, promoActive: false };
}
