import { createDb } from "@/lib/db";
import { schema } from "@/lib/db";

const { auditLogs } = schema;

export interface AuditLogEntry {
  userId?: string;
  /** Snapshot do nome do usuário no momento da ação */
  nomeUsuario?: string;
  storeId?: string;
  action: string;
  /** Módulo de origem: FINANCEIRO_RECEBER, FINANCEIRO_PAGAR, VENDAS_PDV… */
  modulo?: string;
  resourceType?: string;
  resourceId?: string;
  /** Estado do registro ANTES da alteração (null em criações) */
  dadosAnteriores?: Record<string, unknown>;
  /** Estado do registro DEPOIS da alteração (null em exclusões) */
  dadosNovos?: Record<string, unknown>;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  status?: "success" | "failure" | "denied";
  errorMessage?: string;
}

/**
 * Registra um evento de auditoria de forma assíncrona (fire-and-forget).
 * A gravação do log NUNCA bloqueia a resposta ao usuário.
 *
 * Regra de imutabilidade: a tabela audit_logs possui um trigger PostgreSQL
 * (ver migrations/audit_immutability.sql) que lança exceção em qualquer
 * tentativa de UPDATE ou DELETE — os logs são append-only por design.
 */
export function logAudit(
  entry: AuditLogEntry,
  request?: Request
): void {
  void (async () => {
    try {
      const dbUrl = process.env.DATABASE_URL;
      if (!dbUrl) {
        console.warn("Audit logging skipped: DATABASE_URL not set");
        return;
      }

      const db = createDb(dbUrl);

      let ipAddress = entry.ipAddress;
      let userAgent = entry.userAgent;

      if (request) {
        ipAddress = request.headers.get("cf-connecting-ip") ||
                    request.headers.get("x-forwarded-for")?.split(",")[0] ||
                    undefined;
        userAgent = request.headers.get("user-agent") || undefined;
      }

      await db.insert(auditLogs).values({
        userId:           entry.userId,
        nomeUsuario:      entry.nomeUsuario,
        storeId:          entry.storeId,
        action:           entry.action,
        modulo:           entry.modulo,
        resourceType:     entry.resourceType,
        resourceId:       entry.resourceId,
        dadosAnteriores:  entry.dadosAnteriores,
        dadosNovos:       entry.dadosNovos,
        details:          entry.details,
        ipAddress,
        userAgent,
        status:           entry.status || "success",
        errorMessage:     entry.errorMessage,
      });
    } catch (error) {
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

  // Tenant / IDOR security events
  /** Attacker attempted to access a resource owned by another tenant */
  IDOR_ATTEMPT: "IDOR_ATTEMPT",
  /** Cross-tenant data access was detected and blocked */
  CROSS_TENANT_BLOCKED: "CROSS_TENANT_BLOCKED",
  /** Tenant-guard anti-regression rule triggered */
  TENANT_GUARD_TRIGGERED: "TENANT_GUARD_TRIGGERED",
  /** JWT contained no storeId for a tenant-scoped operation */
  MISSING_TENANT_CONTEXT: "MISSING_TENANT_CONTEXT",
  /** Suspicious sequence of access-denied events from same IP */
  SUSPICIOUS_ACTIVITY: "SUSPICIOUS_ACTIVITY",
  
  // Webhooks
  WEBHOOK_RECEIVED: "WEBHOOK_RECEIVED",
  WEBHOOK_PROCESSED: "WEBHOOK_PROCESSED",
  WEBHOOK_FAILED: "WEBHOOK_FAILED",

  // ── Financeiro — Contas a Receber ──────────────────────────────
  RECEBER_CRIAR:     "RECEBER_CRIAR",
  RECEBER_ATUALIZAR: "RECEBER_ATUALIZAR",
  RECEBER_EXCLUIR:   "RECEBER_EXCLUIR",
  RECEBER_EFETIVAR:  "RECEBER_EFETIVAR",   // Dar baixa / receber
  RECEBER_ESTORNAR:  "RECEBER_ESTORNAR",   // Desfazer recebimento

  // ── Financeiro — Contas a Pagar ────────────────────────────────
  PAGAR_CRIAR:       "PAGAR_CRIAR",
  PAGAR_ATUALIZAR:   "PAGAR_ATUALIZAR",
  PAGAR_EXCLUIR:     "PAGAR_EXCLUIR",
  PAGAR_EFETIVAR:    "PAGAR_EFETIVAR",     // Dar baixa / pagar
  PAGAR_ESTORNAR:    "PAGAR_ESTORNAR",     // Desfazer pagamento

  // ── Financeiro — Caixa / PDV ───────────────────────────────────
  CAIXA_ABRIR:       "CAIXA_ABRIR",
  CAIXA_FECHAR:      "CAIXA_FECHAR",
  CAIXA_SANGRIA:     "CAIXA_SANGRIA",
  CAIXA_SUPRIMENTO:  "CAIXA_SUPRIMENTO",

  // ── Estoque ────────────────────────────────────────────────────
  ESTOQUE_ENTRADA:   "ESTOQUE_ENTRADA",
  ESTOQUE_SAIDA:     "ESTOQUE_SAIDA",
  ESTOQUE_AJUSTE:    "ESTOQUE_AJUSTE",

  // ── Balanço de Estoque ─────────────────────────────────────────
  BALANCO_CRIAR:     "BALANCO_CRIAR",
  BALANCO_EDITAR:    "BALANCO_EDITAR",
  BALANCO_EXCLUIR:   "BALANCO_EXCLUIR",

  // ── Configurações ──────────────────────────────────────────────
  CONFIG_ATUALIZAR:  "CONFIG_ATUALIZAR",
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
  TENANT: "tenant",
  // ── Financeiro ─────────────────────────────────────────────────
  CONTA_RECEBER: "conta_receber",
  CONTA_PAGAR:   "conta_pagar",
  LANCAMENTO:    "lancamento",
  CAIXA:         "caixa",
  // ── Estoque ────────────────────────────────────────────────────
  BALANCO:       "balanco",
} as const;

// Módulos para segmentação dos logs
export const AuditModulos = {
  FINANCEIRO_RECEBER:  "FINANCEIRO_RECEBER",
  FINANCEIRO_PAGAR:    "FINANCEIRO_PAGAR",
  FINANCEIRO_FLUXO:    "FINANCEIRO_FLUXO",
  VENDAS_PDV:          "VENDAS_PDV",
  ESTOQUE:             "ESTOQUE",
  AUTENTICACAO:        "AUTENTICACAO",
  CONFIGURACOES:       "CONFIGURACOES",
  PRODUTOS:            "PRODUTOS",
} as const;

/**
 * Log a security event (IDOR attempt, cross-tenant block, etc.)
 * Structured format ensures SIEM/alerting can detect anomalies.
 */
export function logSecurityEvent(options: {
  action: (typeof AuditActions)[keyof typeof AuditActions];
  userId?: string;
  jwtStoreId?: string;
  requestedStoreId?: string;
  handler?: string;
  request?: Request;
}): void {
  const { action, userId, jwtStoreId, requestedStoreId, handler, request } = options;

  // Structured console output for Cloudflare Workers observability / SIEM ingestion
  console.error(
    JSON.stringify({
      level: "SECURITY",
      action,
      userId: userId ?? "anonymous",
      jwtStoreId: jwtStoreId ?? null,
      requestedStoreId: requestedStoreId ?? null,
      handler: handler ?? "unknown",
      timestamp: new Date().toISOString(),
    })
  );

  logAudit(
    {
      userId,
      storeId: jwtStoreId,
      action,
      resourceType: ResourceTypes.TENANT,
      details: {
        jwtStoreId: jwtStoreId ?? null,
        requestedStoreId: requestedStoreId ?? null,
        handler: handler ?? "unknown",
      },
      status: "denied",
      errorMessage: `${action}: jwt=${jwtStoreId ?? "none"} requested=${requestedStoreId ?? "none"}`,
    },
    request
  );
}

// ─────────────────────────────────────────────────────────────────
// logFinanceiro — helper tipado para eventos do módulo financeiro
// ─────────────────────────────────────────────────────────────────

/**
 * Registra uma ação financeira com snapshot before/after para trilha de auditoria.
 *
 * Exemplo de uso — atualização de valor em Contas a Pagar:
 * ```ts
 * logFinanceiro({
 *   action:           AuditActions.PAGAR_ATUALIZAR,
 *   modulo:           AuditModulos.FINANCEIRO_PAGAR,
 *   resourceType:     ResourceTypes.CONTA_PAGAR,
 *   resourceId:       conta.id,
 *   userId:           auth.userId,
 *   nomeUsuario:      auth.userName,
 *   storeId:          auth.storeId,
 *   dadosAnteriores:  contaOriginal,   // estado antes do PUT
 *   dadosNovos:       contaAtualizada, // estado depois do PUT
 * }, request);
 * ```
 */
export function logFinanceiro(
  opts: {
    action: string;
    modulo: string;
    resourceType: string;
    resourceId?: string;
    userId?: string;
    nomeUsuario?: string;
    storeId?: string;
    dadosAnteriores?: Record<string, unknown>;
    dadosNovos?: Record<string, unknown>;
    status?: "success" | "failure" | "denied";
    errorMessage?: string;
  },
  request?: Request
): void {
  logAudit(
    {
      userId:          opts.userId,
      nomeUsuario:     opts.nomeUsuario,
      storeId:         opts.storeId,
      action:          opts.action,
      modulo:          opts.modulo,
      resourceType:    opts.resourceType,
      resourceId:      opts.resourceId,
      dadosAnteriores: opts.dadosAnteriores,
      dadosNovos:      opts.dadosNovos,
      status:          opts.status ?? "success",
      errorMessage:    opts.errorMessage,
    },
    request
  );
}

