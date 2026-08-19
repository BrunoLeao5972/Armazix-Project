import type { DeliveryModelConfig } from "@/components/admin/DeliveryPricingConfig";
import type { PaymentConfig } from "@/lib/store-context";

export interface StoreData {
  id: string;
  name: string;
  ownerName: string;
  slug: string;
  description: string;
  phone: string;
  email: string;
  primaryColor: string;
  logoUrl?: string;
  banners?: Array<{ imageUrl: string | null; position: number | null }>;
  backgroundColor?: string;
  textColor?: string;
  showPrice?: boolean;
  whatsappOrderEnabled?: boolean;
  whatsappPhone?: string;
  highlightLowStock?: boolean;
  allowNegativeStock?: boolean;
  layoutType?: string;
  freeShippingAbove?: string | null;
  deliveryConfig?: {
    modalidade?: string;
    consumirNoLocal?: boolean;
    entregaUber?: boolean;
    modeloCobranca?: string;
    taxaEntregaCliente?: string;
    modelConfig?: DeliveryModelConfig;
  };
  address?: {
    street: string;
    number: string;
    neighborhood: string;
    city: string;
    state: string;
    zip: string;
    complement?: string;
  };
  /** Modelo v2 de formas de pagamento aceitas (loja online) — null = nunca configurado, usa DEFAULT_PAYMENT_CONFIG. */
  paymentConfig?: PaymentConfig | null;
  mpPublicKey?: string | null;
  /** Derivado no servidor a partir de mpAccessToken (nunca exposto). */
  mpConnected?: boolean;
}
