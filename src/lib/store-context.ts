// Shared types and helpers for the public storefront

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
  banners: StoreBanner[];
}

export interface ConfiguracaoVitrine {
  lojaId: string;
  logoUrl: string;
  bannerUrl: string;
  bannerMobileUrl: string;
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
  emoji: string | null;
  badge: string | null;
  stock: number | null;
  lowStockThreshold: number | null;
  active: boolean | null;
  featured: boolean | null;
  categoryId: string | null;
  rating: string | null;
  reviewCount: number | null;
}

export interface StoreCategory {
  id: string;
  name: string;
  emoji: string | null;
  color: string | null;
  imageUrl: string | null;
  position: number | null;
  active: boolean | null;
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
export function resolveStoreSlug(): string | null {
  if (typeof window === "undefined") return null;

  const MAIN_DOMAINS = ["armazix.com.br", "armazix.workers.dev", "localhost"];
  const hostname = window.location.hostname;

  for (const domain of MAIN_DOMAINS) {
    if (hostname !== domain && hostname.endsWith(`.${domain}`)) {
      const sub = hostname.slice(0, hostname.length - domain.length - 1);
      if (sub && !sub.includes(".") && sub !== "www") return sub;
    }
  }

  // Fallback: legacy localStorage
  return localStorage.getItem("storeSlug") || localStorage.getItem("storeId") || null;
}

export function formatPrice(value: string | number): string {
  const n = typeof value === "string" ? parseFloat(value) : value;
  return n.toFixed(2).replace(".", ",");
}
