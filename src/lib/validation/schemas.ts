import { z } from "zod";

// ============================================================================
// AUTHENTICATION SCHEMAS
// ============================================================================

export const loginSchema = z.object({
  email: z.string().email("Email inválido").min(1).max(255),
  password: z.string().min(1).max(255),
});

export const registerSchema = z.object({
  name: z.string().min(2, "Nome mínimo 2 caracteres").max(100, "Nome máximo 100 caracteres"),
  email: z.string().email("Email inválido").min(1).max(255),
  password: z.string().min(1).max(255),
  storeName: z.string().min(2).max(100),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Email inválido").min(1).max(255),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10).max(500),
  newPassword: z.string().min(8, "Mínimo 8 caracteres").max(100, "Máximo 100 caracteres"),
});

export const verifyEmailSchema = z.object({
  code: z.string().length(6, "Código deve ter 6 dígitos").regex(/^\d+$/),
  email: z.string().email().min(1).max(255),
});

// ============================================================================
// USER SCHEMAS
// ============================================================================

export const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(255),
  newPassword: z.string()
    .min(8, "Mínimo 8 caracteres")
    .max(100, "Máximo 100 caracteres")
    .regex(/[A-Z]/, "Deve conter letra maiúscula")
    .regex(/[a-z]/, "Deve conter letra minúscula")
    .regex(/[0-9]/, "Deve conter número")
    .regex(/[^A-Za-z0-9]/, "Deve conter caractere especial"),
});

export const updateUserDataSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  phone: z.string().regex(/^\+?[\d\s-()]+$/).max(20).optional(),
});

export const sendEmailCodeSchema = z.object({
  newEmail: z.string().email("Email inválido").min(1).max(255),
});

export const verifyEmailChangeSchema = z.object({
  newEmail: z.string().email("Email inválido").min(1).max(255),
  code: z.string().length(6).regex(/^\d+$/),
});

// ============================================================================
// STORE SCHEMAS
// ============================================================================

export const updateStoreSchema = z.object({
  storeId: z.string().uuid(),
  name: z.string().min(2).max(100).optional(),
  ownerName: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().max(255).optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  logoUrl: z.string().url().max(500).optional(),
  address: z.object({
    street: z.string().min(1).max(200),
    number: z.string().min(1).max(20),
    neighborhood: z.string().min(1).max(100),
    city: z.string().min(1).max(100),
    state: z.string().length(2),
    zip: z.string().regex(/^\d{5}-?\d{3}$/),
    complement: z.string().max(100).optional(),
  }).optional(),
});

export const updateAddressSchema = z.object({
  storeId: z.string().uuid(),
  address: z.object({
    street: z.string().min(1).max(200),
    number: z.string().min(1).max(20),
    neighborhood: z.string().min(1).max(100),
    city: z.string().min(1).max(100),
    state: z.string().length(2),
    zip: z.string().regex(/^\d{5}-?\d{3}$/),
    complement: z.string().max(100).optional(),
  }),
});

export const updateBusinessHoursSchema = z.object({
  storeId: z.string().uuid(),
  businessHours: z.array(z.object({
    day: z.enum(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]),
    open: z.string().regex(/^\d{2}:\d{2}$/),
    close: z.string().regex(/^\d{2}:\d{2}$/),
    closed: z.boolean(),
  })).max(7),
});

export const updateStoreSlugSchema = z.object({
  storeId: z.string().uuid(),
  slug: z.string().min(3).max(30).regex(/^[a-z0-9]+$/),
});

// ============================================================================
// PRODUCT SCHEMAS
// ============================================================================

export const createProductSchema = z.object({
  storeId: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  price: z.number().positive().max(1000000),
  costPrice: z.number().nonnegative().max(1000000).optional(),
  stock: z.number().int().nonnegative().max(999999).default(0),
  minStock: z.number().int().nonnegative().max(999999).default(0),
  categoryId: z.string().uuid().optional(),
  imageUrl: z.string().url().max(500).optional(),
  isActive: z.boolean().default(true),
  sku: z.string().max(50).optional(),
  barcode: z.string().max(50).optional(),
  unit: z.enum(["unit", "kg", "g", "l", "ml", "m", "cm", "box", "pack"]).default("unit"),
  trackStock: z.boolean().default(true),
  allowNegativeStock: z.boolean().default(false),
});

export const updateProductSchema = z.object({
  id: z.string().uuid(),
  storeId: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  price: z.number().positive().max(1000000).optional(),
  costPrice: z.number().nonnegative().max(1000000).optional(),
  stock: z.number().int().nonnegative().max(999999).optional(),
  minStock: z.number().int().nonnegative().max(999999).optional(),
  categoryId: z.string().uuid().optional(),
  imageUrl: z.string().url().max(500).optional(),
  isActive: z.boolean().optional(),
  sku: z.string().max(50).optional(),
  barcode: z.string().max(50).optional(),
  unit: z.enum(["unit", "kg", "g", "l", "ml", "m", "cm", "box", "pack"]).optional(),
  trackStock: z.boolean().optional(),
  allowNegativeStock: z.boolean().optional(),
});

export const deleteProductSchema = z.object({
  id: z.string().uuid(),
  storeId: z.string().uuid(),
});

// ============================================================================
// CATEGORY SCHEMAS
// ============================================================================

export const createCategorySchema = z.object({
  storeId: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon: z.string().max(50).optional(),
  sortOrder: z.number().int().nonnegative().max(9999).default(0),
  isActive: z.boolean().default(true),
});

export const deleteCategorySchema = z.object({
  id: z.string().uuid(),
  storeId: z.string().uuid(),
});

// ============================================================================
// ORDER SCHEMAS
// ============================================================================

export const createOrderSchema = z.object({
  storeId: z.string().uuid(),
  customerId: z.string().uuid().optional(),
  customerName: z.string().min(1).max(200).optional(),
  customerPhone: z.string().max(20).optional(),
  customerEmail: z.string().email().max(255).optional(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().positive().max(9999),
    price: z.number().positive().max(1000000),
    name: z.string().min(1).max(200),
  })).min(1).max(100),
  total: z.number().positive().max(10000000),
  subtotal: z.number().positive().max(10000000),
  discount: z.number().nonnegative().max(10000000).default(0),
  couponId: z.string().uuid().optional(),
  paymentMethod: z.enum(["cash", "credit_card", "debit_card", "pix", "mp_checkout"]),
  status: z.enum(["pending", "processing", "completed", "cancelled", "refunded"]).default("pending"),
  type: z.enum(["sale", "delivery", "pickup"]).default("sale"),
  deliveryAddress: z.object({
    street: z.string().min(1).max(200),
    number: z.string().min(1).max(20),
    neighborhood: z.string().min(1).max(100),
    city: z.string().min(1).max(100),
    state: z.string().length(2),
    zip: z.string().regex(/^\d{5}-?\d{3}$/),
    complement: z.string().max(100).optional(),
  }).optional(),
  deliveryFee: z.number().nonnegative().max(100000).default(0),
  notes: z.string().max(1000).optional(),
});

export const updateOrderStatusSchema = z.object({
  orderId: z.string().uuid(),
  storeId: z.string().uuid(),
  status: z.enum(["pending", "processing", "completed", "cancelled", "refunded"]),
  notes: z.string().max(1000).optional(),
});

// ============================================================================
// CUSTOMER SCHEMAS
// ============================================================================

export const createCustomerSchema = z.object({
  storeId: z.string().uuid(),
  name: z.string().min(1).max(200),
  email: z.string().email().max(255).optional(),
  phone: z.string().max(20).optional(),
  cpf: z.string().regex(/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/).optional(),
  address: z.object({
    street: z.string().min(1).max(200),
    number: z.string().min(1).max(20),
    neighborhood: z.string().min(1).max(100),
    city: z.string().min(1).max(100),
    state: z.string().length(2),
    zip: z.string().regex(/^\d{5}-?\d{3}$/),
    complement: z.string().max(100).optional(),
  }).optional(),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().max(2000).optional(),
});

// ============================================================================
// COUPON SCHEMAS
// ============================================================================

export const createCouponSchema = z.object({
  storeId: z.string().uuid(),
  code: z.string().min(3).max(20).regex(/^[A-Z0-9]+$/i),
  type: z.enum(["percentage", "fixed_amount"]),
  value: z.number().positive().max(1000000),
  minPurchase: z.number().nonnegative().max(1000000).default(0),
  maxUses: z.number().int().nonnegative().max(999999).optional(),
  maxUsesPerCustomer: z.number().int().nonnegative().max(999).default(1),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  isActive: z.boolean().default(true),
  appliesTo: z.enum(["all", "products", "categories", "shipping"]).default("all"),
  productIds: z.array(z.string().uuid()).max(100).optional(),
  categoryIds: z.array(z.string().uuid()).max(100).optional(),
});

// ============================================================================
// PAYMENT SCHEMAS
// ============================================================================

export const saveMpTokenSchema = z.object({
  storeId: z.string().uuid(),
  accessToken: z.string().min(10).max(500),
});

export const createMpCheckoutSchema = z.object({
  orderId: z.string().uuid(),
  storeId: z.string().uuid(),
  items: z.array(z.object({
    id: z.string(),
    title: z.string().min(1).max(200),
    quantity: z.number().int().positive().max(9999),
    unit_price: z.number().positive().max(1000000),
  })).min(1).max(100),
  total: z.number().positive().max(10000000),
  payer: z.object({
    email: z.string().email().max(255),
    name: z.string().min(1).max(200).optional(),
    phone: z.string().max(20).optional(),
  }),
});

// ============================================================================
// VALIDATION HELPER
// ============================================================================

export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; errors: string[] } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { 
    success: false, 
    errors: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`) 
  };
}

export function sanitizeString(input: string): string {
  // Remove HTML tags and sanitize
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, 10000);
}
