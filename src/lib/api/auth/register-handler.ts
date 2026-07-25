import { createDb } from "@/lib/db";
import { schema } from "@/lib/db";
import { hashPassword, findUserByEmail, createVerificationCode, validatePasswordPolicy, signJWT } from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/auth/email";
import { sanitizeString } from "@/lib/validation/schemas";
import { logAudit, AuditActions } from "@/lib/audit";
import { generateCsrfToken, createCsrfCookie } from "@/lib/middleware/csrf";
import { eq, sql } from "drizzle-orm";
import { generateCleanSlug } from "@/lib/slug";
import { TRIAL_DAYS } from "@/lib/plans";

const { users, stores, storeUsers } = schema;

// Mensagem única e genérica pros três casos de duplicidade — não revela qual
// campo específico colidiu (evita enumeração de contas cadastradas).
const DUPLICATE_ERROR = "Este E-mail/CPF/CNPJ já está cadastrado em nossa plataforma. Faça login ou recupere sua senha.";

export async function registerHandler(request: Request): Promise<Response> {
  const body = await request.json() as {
    name: string;
    email: string;
    phone: string;
    password: string;
    storeName: string;
    category: string;
    description?: string;
    storeColor?: string;
    docType?: string;
    docNumber?: string;
    address?: {
      street: string;
      number: string;
      neighborhood: string;
      city: string;
      state: string;
      zip: string;
      complement?: string;
    };
  };

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);

  // Validate password policy
  const passwordCheck = validatePasswordPolicy(body.password);
  if (!passwordCheck.valid) {
    return new Response(JSON.stringify({ 
      error: "Senha não atende aos requisitos de segurança",
      details: passwordCheck.errors 
    }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  // Normaliza email (minúsculas, sem espaços) — evita duplicidade por variação de caixa/espaço
  const normalizedEmail = body.email.trim().toLowerCase();

  // Documento do responsável/empresa, sempre armazenado apenas com dígitos
  const rawDocNumber = body.docNumber?.replace(/\D/g, "") || null;
  const isCnpj = body.docType === "cnpj";

  // Check if email already exists
  const existing = await findUserByEmail(db, normalizedEmail);
  if (existing) {
    return new Response(JSON.stringify({ error: DUPLICATE_ERROR }), {
      status: 409,
      headers: { "content-type": "application/json" },
    });
  }

  // Valida unicidade do CPF (sempre checado — é o documento do responsável)
  if (rawDocNumber && !isCnpj) {
    const [existingByCpf] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.cpf, rawDocNumber))
      .limit(1);

    if (existingByCpf) {
      return new Response(JSON.stringify({ error: DUPLICATE_ERROR }), {
        status: 409,
        headers: { "content-type": "application/json" },
      });
    }
  }

  // Valida unicidade do CNPJ — usa regexp_replace pra comparar contra dados
  // legados que podem ter sido salvos com pontuação, sem precisar migrá-los.
  if (rawDocNumber && isCnpj) {
    const [existingByCnpj] = await db
      .select({ id: stores.id })
      .from(stores)
      .where(sql`regexp_replace(${stores.cnpj}, '\D', '', 'g') = ${rawDocNumber}`)
      .limit(1);

    if (existingByCnpj) {
      return new Response(JSON.stringify({ error: DUPLICATE_ERROR }), {
        status: 409,
        headers: { "content-type": "application/json" },
      });
    }
  }

  // Sanitize inputs
  const sanitizedName = sanitizeString(body.name);
  const sanitizedStoreName = sanitizeString(body.storeName);

  // Hash password
  const passwordHash = await hashPassword(body.password);

  // Create user
  const [user] = await db.insert(users).values({
    name: sanitizedName,
    email: normalizedEmail,
    phone: body.phone,
    passwordHash,
    role: "merchant",
    emailVerified: false,
    cpf: !isCnpj ? rawDocNumber : null,
  }).returning();

  // Create store - clean slug without hyphens or special characters
  const slug = generateCleanSlug(sanitizedStoreName);

  if (!slug || slug.length < 3) {
    return new Response(JSON.stringify({ error: "Nome da loja gera um slug inválido (mínimo 3 caracteres alfanuméricos)" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const existingSlug = await db.select({ id: stores.id }).from(stores).where(eq(stores.slug, slug));
  if (existingSlug.length > 0) {
    return new Response(JSON.stringify({ error: "Slug já está em uso" }), {
      status: 409,
      headers: { "content-type": "application/json" },
    });
  }

  const [store] = await db.insert(stores).values({
    name: sanitizedStoreName,
    slug,
    description: body.description || null,
    primaryColor: body.storeColor || "#00C853",
    cnpj: isCnpj ? rawDocNumber : null,
    phone: body.phone,
    email: normalizedEmail,
    address: body.address || null,
    plan: "free",
    planStatus: "active",
    planExpiresAt: new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000),
  }).returning();

  // Link user to store as owner
  await db.insert(storeUsers).values({
    storeId: store.id,
    userId: user.id,
    role: "owner",
  });

  // Generate verification code
  const code = await createVerificationCode(db, user.id, "email_verification");

  // Send verification email
  try {
    await sendVerificationEmail(normalizedEmail, code, sanitizedName);
  } catch (emailError) {
    console.error("Failed to send verification email:", emailError);
  }

  // Audit log
  logAudit({
    userId: user.id,
    storeId: store.id,
    action: AuditActions.REGISTER,
    resourceType: "user",
    resourceId: user.id,
    status: "success",
  }, request);

  // Sign JWT so the user is immediately logged in
  const secret = process.env.JWT_SECRET!;
  const token = await signJWT(
    { userId: user.id, email: user.email, role: user.role, storeId: store.id },
    secret,
  );

  const csrfToken = generateCsrfToken();

  const responseHeaders = new Headers({ "content-type": "application/json" });
  responseHeaders.append("set-cookie", `armazix_token=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${7 * 24 * 60 * 60}`);
  responseHeaders.append("set-cookie", createCsrfCookie(csrfToken));

  return new Response(JSON.stringify({
    success: true,
    csrfToken,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  }), {
    status: 201,
    headers: responseHeaders,
  });
}
