import { logAudit, AuditActions } from "@/lib/audit";

export async function logoutHandler(request: Request, auth?: { userId?: string }): Promise<Response> {
  // Log the logout event
  if (auth?.userId) {
    logAudit({
      userId: auth.userId,
      action: AuditActions.LOGOUT,
      resourceType: "session",
      status: "success",
    }, request);
  }

  const responseHeaders = new Headers({ "content-type": "application/json" });
  responseHeaders.append("set-cookie", "armazix_token=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0");
  responseHeaders.append("set-cookie", "csrf_token=; Path=/; Secure; SameSite=Strict; Max-Age=0");

  return new Response(JSON.stringify({
    success: true,
    message: "Logout realizado com sucesso",
  }), {
    status: 200,
    headers: responseHeaders,
  });
}
