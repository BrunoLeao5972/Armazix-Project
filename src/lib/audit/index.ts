import { createDb } from "@/lib/db";
import { schema } from "@/lib/db";

const { auditLogs } = schema;

export interface AuditLogEntry {
  userId?: string;
  storeId?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  status?: "success" | "failure" | "denied";
  errorMessage?: string;
}

/**
 * Log an audit event for security and compliance tracking
 * This is fire-and-forget to not block the main request
 */
export function logAudit(
  entry: AuditLogEntry,
  request?: Request
): void {
  // Fire-and-forget logging - don't block the request
  // In production, consider using a queue for high-volume logging
  void (async () => {
    try {
      const dbUrl = process.env.DATABASE_URL;
      if (!dbUrl) {
        console.warn("Audit logging skipped: DATABASE_URL not set");
        return;
      }

      const db = createDb(dbUrl);

      // Extract IP and User Agent from request if provided
      let ipAddress = entry.ipAddress;
      let userAgent = entry.userAgent;

      if (request) {
        ipAddress = request.headers.get("cf-connecting-ip") ||
                    request.headers.get("x-forwarded-for")?.split(",")[0] ||
                    undefined;
        userAgent = request.headers.get("user-agent") || undefined;
      }

      await db.insert(auditLogs).values({
        userId: entry.userId,
        storeId: entry.storeId,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        details: entry.details,
        ipAddress: ipAddress,
        userAgent: userAgent,
        status: entry.status || "success",
        errorMessage: entry.errorMessage,
      });
    } catch (error) {
      // Never throw from audit logging - just log the error
      console.error("Audit logging failed:", error);
    }
  })();
}

// Predefined action types for consistency
export const AuditActions = {
  // Auth
  LOGIN: "LOGIN",
  LOGOUT: "LOGOUT",
  REGISTER: "REGISTER",
  PASSWORD_CHANGE: "PASSWORD_CHANGE",
  PASSWORD_RESET: "PASSWORD_RESET",
  EMAIL_VERIFICATION: "EMAIL_VERIFICATION",
  
  // User
  USER_UPDATE: "USER_UPDATE",
  USER_DELETE: "USER_DELETE",
  
  // Store
  STORE_CREATE: "STORE_CREATE",
  STORE_UPDATE: "STORE_UPDATE",
  STORE_DELETE: "STORE_DELETE",
  
  // Products
  PRODUCT_CREATE: "PRODUCT_CREATE",
  PRODUCT_UPDATE: "PRODUCT_UPDATE",
  PRODUCT_DELETE: "PRODUCT_DELETE",
  
  // Categories
  CATEGORY_CREATE: "CATEGORY_CREATE",
  CATEGORY_UPDATE: "CATEGORY_UPDATE",
  CATEGORY_DELETE: "CATEGORY_DELETE",
  
  // Orders
  ORDER_CREATE: "ORDER_CREATE",
  ORDER_UPDATE: "ORDER_UPDATE",
  ORDER_DELETE: "ORDER_DELETE",
  ORDER_STATUS_CHANGE: "ORDER_STATUS_CHANGE",
  
  // Customers
  CUSTOMER_CREATE: "CUSTOMER_CREATE",
  CUSTOMER_UPDATE: "CUSTOMER_UPDATE",
  CUSTOMER_DELETE: "CUSTOMER_DELETE",
  
  // Coupons
  COUPON_CREATE: "COUPON_CREATE",
  COUPON_UPDATE: "COUPON_UPDATE",
  COUPON_DELETE: "COUPON_DELETE",
  
  // Payments
  PAYMENT_INITIATED: "PAYMENT_INITIATED",
  PAYMENT_COMPLETED: "PAYMENT_COMPLETED",
  PAYMENT_FAILED: "PAYMENT_FAILED",
  PAYMENT_REFUNDED: "PAYMENT_REFUNDED",
  
  // Settings
  SETTINGS_UPDATE: "SETTINGS_UPDATE",
  BUSINESS_HOURS_UPDATE: "BUSINESS_HOURS_UPDATE",
  ADDRESS_UPDATE: "ADDRESS_UPDATE",
  
  // Security
  ACCESS_DENIED: "ACCESS_DENIED",
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
  INVALID_CSRF: "INVALID_CSRF",
  UNAUTHORIZED_ACCESS: "UNAUTHORIZED_ACCESS",
  
  // Webhooks
  WEBHOOK_RECEIVED: "WEBHOOK_RECEIVED",
  WEBHOOK_PROCESSED: "WEBHOOK_PROCESSED",
  WEBHOOK_FAILED: "WEBHOOK_FAILED",
} as const;

// Resource types for consistency
export const ResourceTypes = {
  USER: "user",
  STORE: "store",
  PRODUCT: "product",
  CATEGORY: "category",
  ORDER: "order",
  CUSTOMER: "customer",
  COUPON: "coupon",
  PAYMENT: "payment",
  SETTINGS: "settings",
  SESSION: "session",
  WEBHOOK: "webhook",
} as const;
