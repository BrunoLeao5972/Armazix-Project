import { registerHandler } from "./api/auth/register-handler";
import { verifyEmailHandler } from "./api/auth/verify-email-handler";
import { loginHandler } from "./api/auth/login-handler";
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
} from "./api/stock-handler";

type ApiHandler = (request: Request) => Promise<Response>;

const postRoutes: Record<string, ApiHandler> = {
  "/api/auth/register": registerHandler,
  "/api/auth/verify-email": verifyEmailHandler,
  "/api/auth/login": loginHandler,
  "/api/auth/forgot-password": forgotPasswordHandler,
  "/api/auth/reset-password": resetPasswordHandler,
  "/api/auth/resend-verification": resendVerificationHandler,
  "/api/store/update": updateStoreHandler,
  "/api/store/update-address": updateAddressHandler,
  "/api/store/update-business-hours": updateBusinessHoursHandler,
  "/api/store/update-slug": updateStoreSlugHandler,
  "/api/user/send-email-code": sendEmailVerificationCodeHandler,
  "/api/user/verify-email-change": verifyEmailChangeHandler,
  "/api/user/update-password": updateUserPasswordHandler,
  "/api/user/update-data": updateUserDataHandler,
};

const getRoutes: Record<string, ApiHandler> = {
  "/api/store/get": getStoreHandler,
  "/api/store/user": getUserStoreHandler,
  "/api/dashboard/stats": getDashboardStatsHandler,
  "/api/stock/stats": getStockStatsHandler,
  "/api/reports/stats": getReportsStatsHandler,
  "/api/validate-cep": validateCepHandler,
  "/api/store/business-hours": getBusinessHoursHandler,
  "/api/user/get": getUserDataHandler,
  "/api/store/check-slug": checkStoreSlugHandler,
};

export async function handleApiRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);

  let handler: ApiHandler | undefined;

  if (request.method === "POST") {
    handler = postRoutes[url.pathname];
  } else if (request.method === "GET") {
    handler = getRoutes[url.pathname];
  }

  if (!handler) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    return await handler(request);
  } catch (error) {
    console.error("API error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
