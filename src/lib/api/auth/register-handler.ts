import { createDb } from "@/lib/db";
import { schema } from "@/lib/db";
import { hashPassword, findUserByEmail, createVerificationCode, validatePasswordPolicy } from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/auth/email";
import { sanitizeString } from "@/lib/validation/schemas";
import { logAudit, AuditActions } from "@/lib/audit";

const { users, stores, storeUsers } = schema;

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

  // Check if email already exists
  const existing = await findUserByEmail(db, body.email);
  if (existing) {
    return new Response(JSON.stringify({ error: "Este email já está cadastrado" }), {
      status: 409,
      headers: { "content-type": "application/json" },
    });
  }

  // Sanitize inputs
  const sanitizedName = sanitizeString(body.name);
  const sanitizedStoreName = sanitizeString(body.storeName);

  // Hash password
  const passwordHash = await hashPassword(body.password);

  // Create user
  const [user] = await db.insert(users).values({
    name: sanitizedName,
    email: body.email,
    phone: body.phone,
    passwordHash,
    role: "merchant",
    emailVerified: false,
  }).returning();

  // Create store - slug without hyphens
  const slug = sanitizedStoreName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 30);

  const [store] = await db.insert(stores).values({
    name: sanitizedStoreName,
    slug,
    description: body.description || null,
    primaryColor: body.storeColor || "#00C853",
    cnpj: body.docType === "cnpj" ? body.docNumber : null,
    phone: body.phone,
    email: body.email,
    address: body.address || null,
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
    await sendVerificationEmail(body.email, code, sanitizedName);
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

  return new Response(JSON.stringify({
    success: true,
    message: "Usuário cadastrado com sucesso. Verifique seu email.",
    userId: user.id,
  }), {
    status: 201,
    headers: { "content-type": "application/json" },
  });
}
