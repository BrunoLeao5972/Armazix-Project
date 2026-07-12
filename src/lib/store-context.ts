// Shared types and helpers for the public storefront
import type { PromoConfig } from "@/lib/promo-engine";

export interface DeliveryRule {
  bairro: string;   // nome do bairro (case-insensitive match)
  taxa:   number;   // valor da taxa em R$
}

export type EspeciePagamento =
  | "dinheiro"
  | "cartao"
  | "boleto"
  | "pix"
  | "mercadopago"
  | "outros";

export type OperacaoCartao = "credito" | "debito" | "carteira_digital";
export type TipoChavePix  = "cpf" | "cnpj" | "email" | "celular" | "aleatoria";

export interface TaxaParcela {
  parcela: number;  // 2, 3 … 18
  taxa:    number;  // percentual (ex: 2.99 = 2.99%)
}

export interface PaymentMethodConfig {
  key:             string;   // "cash" | "pix" | "card" | "debit" | "mercadopago" | "custom_*"
  label:           string;   // descrição completa
  sigla?:          string;   // abreviação exibida no PDV/checkout
  enabled:         boolean;
  especie?:        EspeciePagamento;
  operacao?:       OperacaoCartao | null;
  maxInstallments: number;   // 1 = à vista only
  payAtDelivery?:  boolean;  // if false → customer must pay online
  // ── Parcelamento (cartão crédito) ──────────────────────────────
  parcelamentoAtivo?:    boolean;
  taxasPorParcela?:      TaxaParcela[];
  repassarTaxaCliente?:  boolean;
  // ── PIX ────────────────────────────────────────────────────────
  pixKeyType?:    TipoChavePix;
  pixKey?:        string;
  pixQrCodeUrl?:  string;
  // ── Mercado Pago ───────────────────────────────────────────────
  config?: {
    mercadoPago?: {
      publicKey:   string;
      accessToken: string;
    };
  };
}

export const DEFAULT_PAYMENT_METHODS: PaymentMethodConfig[] = [
  { key: "cash",        label: "Dinheiro",          enabled: true,  maxInstallments: 1,  payAtDelivery: true  },
  { key: "pix",         label: "PIX",               enabled: true,  maxInstallments: 1,  payAtDelivery: true  },
  { key: "card",        label: "Cartão de Crédito", enabled: true,  maxInstallments: 12, payAtDelivery: true  },
  { key: "debit",       label: "Cartão de Débito",  enabled: true,  maxInstallments: 1,  payAtDelivery: true  },
  { key: "mercadopago", label: "Mercado Pago",       enabled: false, maxInstallments: 1                       },
];

// ─── Novo modelo estruturado de pagamento (v2) ────────────────────────────────

/** Configuração do grupo Pagamento Online (Mercado Pago Checkout Pro). */
export interface OnlinePaymentConfig {
  enabled: boolean;
  /** Quais métodos o MP deve apresentar na tela de checkout deles. */
  methods: {
    pix:        boolean;
    creditCard: boolean;
    debitCard:  boolean;
  };
}

/** Configuração do grupo Pagamento na Entrega. */
export interface DeliveryPaymentConfig {
  enabled: boolean;
  cash: {
    enabled:       boolean;
    /** Quando true, o checkout exibe o campo "Precisa de troco? Troco para R$ __" */
    changeEnabled: boolean;
  };
  creditCard: {
    enabled:             boolean;
    /** Maquininha do entregador aceita parcelamento? */
    installmentsEnabled: boolean;
    /** Máximo de parcelas aceitas (2–12). Ignorado quando installmentsEnabled=false. */
    maxInstallments:     number;
  };
  debitCard: {
    enabled: boolean;
  };
  pix: {
    enabled:      boolean;
    pixKeyType:   TipoChavePix;
    pixKey:       string;
    pixQrCodeUrl?: string;
  };
}

/** Raiz salva em stores.payment_config (jsonb). Credenciais MP ficam em colunas separadas. */
export interface PaymentConfig {
  online:   OnlinePaymentConfig;
  delivery: DeliveryPaymentConfig;
}

export const DEFAULT_PAYMENT_CONFIG: PaymentConfig = {
  online: {
    enabled: false,
    methods: { pix: true, creditCard: true, debitCard: true },
  },
  delivery: {
    enabled: true,
    cash:       { enabled: true, changeEnabled: true },
    creditCard: { enabled: true, installmentsEnabled: false, maxInstallments: 1 },
    debitCard:  { enabled: true },
    pix:        { enabled: true, pixKeyType: "cpf", pixKey: "" },
  },
};

export interface StoreBanner {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  gradientFrom: string | null;
  gradientTo: string | null;
  emoji: string | null;
  linkUrl: string | null;
  position: number | null;
}

export interface StorePublicData {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  bannerMobileUrl: string | null;
  primaryColor: string | null;
  backgroundColor: string | null;
  textColor: string | null;
  accentColor: string | null;
  font: string | null;
  phone: string | null;
  email: string | null;
  deliveryEnabled: boolean | null;
  pickupEnabled: boolean | null;
  deliveryFee: string | null;
  minDeliveryOrder: string | null;
  deliveryEstimate: string | null;
  businessHours: Array<{ day: string; open: string; close: string; closed: boolean }> | null;
  showPrice: boolean | null;
  whatsappOrderEnabled: boolean | null;
  whatsappPhone: string | null;
  highlightLowStock: boolean | null;
  rating: string | null;
  active: boolean | null;
  mpPublicKey: string | null;
  /** @deprecated Use paymentConfig instead */
  paymentMethodsConfig: PaymentMethodConfig[] | null;
  /** @deprecated Use paymentConfig.delivery.enabled instead */
  deliveryPaymentEnabled: boolean | null;
  /** Modelo v2 estruturado — substitui paymentMethodsConfig + deliveryPaymentEnabled */
  paymentConfig: PaymentConfig | null;
  banners: StoreBanner[];
  bannerIntervalMs: number | null;
  // endereço físico da loja (campo jsonb já existente no DB)
  address: {
    street: string; number: string; neighborhood: string;
    city: string; state: string; zip: string; complement?: string;
  } | null;
  // regras de frete por bairro + limiar para frete grátis
  deliveryRules: DeliveryRule[] | null;
  freeShippingAbove: string | null;
}

export interface ConfiguracaoVitrine {
  lojaId: string;
  logoUrl: string;
  bannerUrl: string;
  bannerMobileUrl?: string;
  corPrimaria: string;
  corFundo: string;
  corTextos: string;
  exibirPreco: boolean;
  pedidoWhatsapp: boolean;
  telefoneWhatsapp?: string;
  destacarEstoqueBaixo: boolean;
}

export interface StoreProduct {
  id: string;
  name: string;
  description: string | null;
  price: string;
  compareAtPrice: string | null;
  costPrice: string | null;
  imageUrl: string | null;
  images: string[] | null;
  emoji: string | null;
  badge: string | null;
  stock: number | null;
  lowStockThreshold: number | null;
  active: boolean | null;
  featured: boolean | null;
  categoryId: string | null;
  rating: string | null;
  reviewCount: number | null;
  allowObservation: boolean | null;
  promoConfig: PromoConfig | null;
}

export interface StoreCategory {
  id: string;
  name: string;
  emoji: string | null;
  icon: string | null;
  color: string | null;
  imageUrl: string | null;
  parentId: string | null;
  position: number | null;
  active: boolean | null;
  analytic: boolean | null;
}

export interface CartItem {
  id: string;
  name: string;
  price: number;
  image: string | null;
  emoji: string | null;
  qty: number;
  obs?: string;
  additions?: { name: string; price: number }[];
}

// Resolve store slug from multiple sources:
// 1. x-store-slug header (server-side, from subdomain rewrite)
// 2. window.location.hostname (client-side subdomain detection)
// 3. localStorage fallback (legacy)
const MAIN_DOMAINS = ["armazix.com.br", "armazix.workers.dev", "localhost"];

export function resolveHostnameStoreSlug(hostname: string): string | null {
  const lowerHostname = hostname.toLowerCase();

  for (const domain of MAIN_DOMAINS) {
    if (lowerHostname === domain) return null;
    if (lowerHostname.endsWith(`.${domain}`)) {
      const sub = lowerHostname.slice(0, lowerHostname.length - domain.length - 1);
      if (sub && !sub.includes(".") && sub !== "www" && /^[a-z0-9]+$/.test(sub)) {
        return sub;
      }
    }
  }

  return null;
}

export function resolveStoreSlug(): string | null {
  if (typeof window === "undefined") return null;

  const hostname = window.location.hostname;

  const hostnameSlug = resolveHostnameStoreSlug(hostname);
  if (hostnameSlug) {
    return hostnameSlug;
  }

  // Fallback: legacy localStorage
  return localStorage.getItem("storeSlug") || localStorage.getItem("storeId") || null;
}

export function formatPrice(value: string | number): string {
  const n = typeof value === "string" ? parseFloat(value) : value;
  return n.toFixed(2).replace(".", ",");
}
