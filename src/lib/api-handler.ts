import { registerHandler } from "./api/auth/register-handler";
import { verifyEmailHandler } from "./api/auth/verify-email-handler";
import { loginHandler } from "./api/auth/login-handler";
import { logoutHandler } from "./api/auth/logout-handler";
import { forgotPasswordHandler } from "./api/auth/forgot-password-handler";
import { resetPasswordHandler } from "./api/auth/reset-password-handler";
import { resendVerificationHandler } from "./api/auth/resend-verification-handler";
import { getStoreHandler, updateStoreHandler, getDashboardStatsHandler, getUserStoreHandler } from "./api/store-handler";
import {
  getStockStatsHandler,
  getReportsStatsHandler,
  validateCepHandler,
  updateAddressHandler,
  getBusinessHoursHandler,
  updateBusinessHoursHandler,
  sendEmailVerificationCodeHandler,
  verifyEmailChangeHandler,
  updateUserPasswordHandler,
  getUserDataHandler,
  updateUserDataHandler,
  checkStoreSlugHandler,
  updateStoreSlugHandler,
  getFinancialStatsHandler,
  getDeliveryOrdersHandler,
  getCouponsHandler,
  getDashboardChartDataHandler,
} from "./api/stock-handler";
import {
  createProductHandler,
  listProductsHandler,
  updateProductHandler,
  deleteProductHandler,
  createCategoryHandler,
  listCategoriesHandler,
  deleteCategoryHandler,
  createOrderHandler,
  listOrdersHandler,
  updateOrderStatusHandler,
  createCouponHandler,
  listCustomersHandler,
  createCustomerHandler,
} from "./api/crud-handler";
import { createMpCheckoutHandler, mpWebhookHandler, saveMpTokenHandler } from "./api/payment-handler";
import { createSubscriptionHandler, getSubscriptionStatusHandler, subscriptionWebhookHandler } from "./api/subscription-handler";
import { requireAuth, requireStoreAccess, getStoreIdFromRequest, AuthContext } from "./middleware/auth";
import { rateLimit, createRateLimitResponse } from "./middleware/rate-limit";
import { withSecurityHeaders } from "./middleware/security-headers";
import { validateCsrfToken, createCsrfErrorResponse } from "./middleware/csrf";

type ApiHandler = (request: Request, auth?: AuthContext) => Promise<Response>;

// Rotas públicas (não requerem autenticação)
const publicPostRoutes: Record<string, ApiHandler> = {
  "/api/auth/register": registerHandler,
  "/api/auth/verify-email": verifyEmailHandler,
  "/api/auth/login": loginHandler,
  "/api/auth/forgot-password": forgotPasswordHandler,
  "/api/auth/reset-password": resetPasswordHandler,
  "/api/auth/resend-verification": resendVerificationHandler,
  "/api/orders/create": createOrderHandler, // Público para checkout da loja
  "/api/payments/mp-webhook": mpWebhookHandler, // Webhook do MercadoPago
  "/api/subscriptions/mp-webhook": subscriptionWebhookHandler, // Webhook de assinaturas
};

const publicGetRoutes: Record<string, ApiHandler> = {
  "/api/store/get": getStoreHandler,
  "/api/store/check-slug": checkStoreSlugHandler,
  "/api/validate-cep": validateCepHandler,
  "/api/products/list": listProductsHandler, // Público para vitrine
  "/api/categories/list": listCategoriesHandler, // Público para vitrine
};

// Rotas protegidas (requerem autenticação)
const protectedPostRoutes: Record<string, ApiHandler> = {
  "/api/auth/logout": logoutHandler,
  "/api/store/update": updateStoreHandler,
  "/api/store/update-address": updateAddressHandler,
  "/api/store/update-business-hours": updateBusinessHoursHandler,
  "/api/store/update-slug": updateStoreSlugHandler,
  "/api/user/send-email-code": sendEmailVerificationCodeHandler,
  "/api/user/verify-email-change": verifyEmailChangeHandler,
  "/api/user/update-password": updateUserPasswordHandler,
  "/api/user/update-data": updateUserDataHandler,
  "/api/products/create": createProductHandler,
  "/api/products/update": updateProductHandler,
  "/api/products/delete": deleteProductHandler,
  "/api/categories/create": createCategoryHandler,
  "/api/categories/delete": deleteCategoryHandler,
  "/api/orders/update-status": updateOrderStatusHandler,
  "/api/coupons/create": createCouponHandler,
  "/api/customers/create": createCustomerHandler,
  "/api/payments/mp-checkout": createMpCheckoutHandler,
  "/api/payments/mp-token": saveMpTokenHandler,
  "/api/subscriptions/create": createSubscriptionHandler,
};

const protectedGetRoutes: Record<string, ApiHandler> = {
  "/api/store/user": getUserStoreHandler,
  "/api/dashboard/stats": (req, auth) => getDashboardStatsHandler(req, auth),
  "/api/stock/stats": getStockStatsHandler,
  "/api/reports/stats": getReportsStatsHandler,
  "/api/store/business-hours": getBusinessHoursHandler,
  "/api/user/get": getUserDataHandler,
  "/api/financial/stats": getFinancialStatsHandler,
  "/api/delivery/orders": getDeliveryOrdersHandler,
  "/api/coupons/list": getCouponsHandler,
  "/api/dashboard/charts": getDashboardChartDataHandler,
  "/api/orders/list": listOrdersHandler,
  "/api/customers/list": listCustomersHandler,
  "/api/subscriptions/status": getSubscriptionStatusHandler,
};

// Mapeamento de rotas para configurações de rate limit
const rateLimitConfigs: Record<string, string> = {
  "/api/auth/login": "auth",
  "/api/auth/register": "auth",
  "/api/auth/verify-email": "verify-email",
  "/api/auth/forgot-password": "forgot-password",
  "/api/auth/reset-password": "reset-password",
  "/api/payments/mp-webhook": "webhook",
  "/api/subscriptions/mp-webhook": "webhook",
};

async function getRequestBodyStoreId(request: Request): Promise<string | null> {
  try {
    const body = await request.clone().json();
    return body?.storeId || null;
  } catch {
    return null;
  }
}

export async function handleApiRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;

  let handler: ApiHandler | undefined;
  let isProtected = false;

  // Verificar rate limiting
  const rateLimitType = rateLimitConfigs[pathname] || "api";
  const rateLimitResult = await rateLimit(request, rateLimitType);
  
  if (!rateLimitResult.allowed) {
    return withSecurityHeaders(createRateLimitResponse(rateLimitResult.retryAfter || 60));
  }

  // Encontrar handler
  if (request.method === "POST") {
    handler = publicPostRoutes[pathname];
    if (!handler) {
      handler = protectedPostRoutes[pathname];
      isProtected = !!handler;
    }
  } else if (request.method === "GET") {
    handler = publicGetRoutes[pathname];
    if (!handler) {
      handler = protectedGetRoutes[pathname];
      isProtected = !!handler;
    }
  }

  if (!handler) {
    return withSecurityHeaders(
      new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      })
    );
  }

  try {
    let response: Response;

    if (isProtected) {
      // Verificar CSRF token (exceto para webhooks e checkout público)
      if (!validateCsrfToken(request)) {
        return withSecurityHeaders(createCsrfErrorResponse());
      }

      // Verificar autenticação
      const auth = await requireAuth(request);
      if (auth instanceof Response) {
        return withSecurityHeaders(auth);
      }

      // Verificar acesso ao tenant (storeId)
      const requestedStoreId = getStoreIdFromRequest(request) || await getRequestBodyStoreId(request);
      
      if (requestedStoreId) {
        const authWithStore = await requireStoreAccess(request, auth, requestedStoreId);
        if (authWithStore instanceof Response) {
          return withSecurityHeaders(authWithStore);
        }
        response = await handler(request, authWithStore);
      } else {
        response = await handler(request, auth);
      }
    } else {
      // Rota pública
      response = await handler(request);
    }

    return withSecurityHeaders(response);
  } catch (error) {
    console.error("API error:", error);
    return withSecurityHeaders(
      new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      })
    );
  }
}
