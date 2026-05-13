import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = "ARMAZIX <naoresponda@armazix.com.br>";

// ─── Email verification ─────────────────────────────────────────
export async function sendVerificationEmail(
  email: string,
  code: string,
  name: string,
) {
  return resend.emails.send({
    from: FROM,
    to: email,
    subject: "Verifique seu email — ARMAZIX",
    html: verificationTemplate(code, name),
  });
}

// ─── Password reset ─────────────────────────────────────────────
export async function sendPasswordResetEmail(
  email: string,
  code: string,
  name: string,
) {
  return resend.emails.send({
    from: FROM,
    to: email,
    subject: "Recuperar senha — ARMAZIX",
    html: passwordResetTemplate(code, name),
  });
}

// ─── Templates ──────────────────────────────────────────────────
function verificationTemplate(code: string, name: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#F6F7FB;font-family:Inter,system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:40px auto;background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
    <tr>
      <td style="padding:40px 32px;text-align:center;">
        <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
          <tr>
            <td style="width:56px;height:56px;background:linear-gradient(135deg,#00C853,#00B248);border-radius:16px;text-align:center;vertical-align:middle;font-size:28px;line-height:56px;">✉️</td>
          </tr>
        </table>
        <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#121212;">Verifique seu email</h1>
        <p style="margin:0 0 24px;font-size:15px;color:#6B7280;">Olá, <strong>${name}</strong>! Use o código abaixo para confirmar seu email:</p>
        <div style="background:#F6F7FB;border-radius:16px;padding:20px;margin:0 0 24px;">
          <span style="font-size:36px;font-weight:800;letter-spacing:8px;color:#00C853;">${code}</span>
        </div>
        <p style="margin:0 0 8px;font-size:13px;color:#6B7280;">Este código expira em <strong>15 minutos</strong>.</p>
        <p style="margin:0;font-size:13px;color:#9CA3AF;">Se você não criou uma conta no ARMAZIX, ignore este email.</p>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 32px;background:#F6F7FB;text-align:center;">
        <p style="margin:0;font-size:12px;color:#9CA3AF;">© 2026 ARMAZIX. armazix.com.br</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function passwordResetTemplate(code: string, name: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#F6F7FB;font-family:Inter,system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:40px auto;background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
    <tr>
      <td style="padding:40px 32px;text-align:center;">
        <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
          <tr>
            <td style="width:56px;height:56px;background:linear-gradient(135deg,#00C853,#00B248);border-radius:16px;text-align:center;vertical-align:middle;font-size:28px;line-height:56px;">🔐</td>
          </tr>
        </table>
        <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#121212;">Recuperar senha</h1>
        <p style="margin:0 0 24px;font-size:15px;color:#6B7280;">Olá, <strong>${name}</strong>! Use o código abaixo para redefinir sua senha:</p>
        <div style="background:#F6F7FB;border-radius:16px;padding:20px;margin:0 0 24px;">
          <span style="font-size:36px;font-weight:800;letter-spacing:8px;color:#00C853;">${code}</span>
        </div>
        <p style="margin:0 0 8px;font-size:13px;color:#6B7280;">Este código expira em <strong>15 minutos</strong>.</p>
        <p style="margin:0;font-size:13px;color:#9CA3AF;">Se você não solicitou a recuperação, ignore este email.</p>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 32px;background:#F6F7FB;text-align:center;">
        <p style="margin:0;font-size:12px;color:#9CA3AF;">© 2026 ARMAZIX. armazix.com.br</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
