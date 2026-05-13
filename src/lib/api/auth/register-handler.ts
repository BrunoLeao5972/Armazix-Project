import { createDb } from "@/lib/db";
import { schema } from "@/lib/db";
import { hashPassword, findUserByEmail, createVerificationCode } from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/auth/email";

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

  // Check if email already exists
  const existing = await findUserByEmail(db, body.email);
  if (existing) {
    return new Response(JSON.stringify({ error: "Este email já está cadastrado" }), {
      status: 409,
      headers: { "content-type": "application/json" },
    });
  }

  // Hash password
  const passwordHash = await hashPassword(body.password);

  // Create user
  const [user] = await db.insert(users).values({
    name: body.name,
    email: body.email,
    phone: body.phone,
    passwordHash,
    role: "merchant",
    emailVerified: false,
  }).returning();

  // Create store - slug without hyphens
  const slug = body.storeName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 30);

  const [store] = await db.insert(stores).values({
    name: body.storeName,
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
    await sendVerificationEmail(body.email, code, body.name);
  } catch (emailError) {
    console.error("Failed to send verification email:", emailError);
  }

  return new Response(JSON.stringify({
    success: true,
    userId: user.id,
    email: user.email,
    message: "Conta criada! Verifique seu email para ativar.",
  }), {
    status: 201,
    headers: { "content-type": "application/json" },
  });
}
