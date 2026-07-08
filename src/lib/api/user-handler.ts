import { createDb } from "@/lib/db";
import { schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { requireStoreAccess, requireStoreOwner } from "@/lib/auth/require-store-access";
import { hashPassword, validatePasswordPolicy } from "@/lib/auth";
import type { AuthContext } from "@/lib/middleware/auth";

const { users, storeUsers } = schema;

// Roles que podem ser criados/atribuídos via painel
const ASSIGNABLE_ROLES = ["admin", "gerente", "vendedor", "operador"] as const;
type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// ─── GET /api/store-users/list ────────────────────────────────────────────────
export async function listStoreUsersHandler(
  _request: Request,
  auth?: AuthContext
): Promise<Response> {
  let storeAccess: { storeId: string; userId: string };
  try {
    storeAccess = await requireStoreAccess(auth);
  } catch (e) {
    return json({ error: (e as Error).message }, auth?.userId ? 403 : 401);
  }

  const db = createDb(process.env.DATABASE_URL!);

  const members = await db
    .select({
      userId:    storeUsers.userId,
      storeRole: storeUsers.role,
      joinedAt:  storeUsers.createdAt,
      name:      users.name,
      email:     users.email,
      phone:     users.phone,
      cpf:       users.cpf,
      active:    users.active,
      avatarUrl: users.avatarUrl,
    })
    .from(storeUsers)
    .innerJoin(users, eq(storeUsers.userId, users.id))
    .where(eq(storeUsers.storeId, storeAccess.storeId))
    .orderBy(users.name);

  return json({ users: members });
}

// ─── POST /api/store-users/create ────────────────────────────────────────────
export async function createStoreUserHandler(
  request: Request,
  auth?: AuthContext
): Promise<Response> {
  let storeAccess: { storeId: string; userId: string };
  try {
    storeAccess = await requireStoreOwner(auth);
  } catch (e) {
    return json({ error: (e as Error).message }, auth?.userId ? 403 : 401);
  }

  const body = await request.json() as {
    name?: string;
    email?: string;
    phone?: string;
    cpf?: string;
    password?: string;
    storeRole?: string;
    active?: boolean;
  };

  const name  = body.name?.trim();
  const email = body.email?.trim().toLowerCase();
  const storeRole = body.storeRole as AssignableRole | undefined;

  if (!name || !email || !body.password || !storeRole) {
    return json({ error: "Nome, e-mail, senha e perfil são obrigatórios" }, 400);
  }

  if (!ASSIGNABLE_ROLES.includes(storeRole)) {
    return json({ error: "Perfil inválido" }, 400);
  }

  const pwCheck = validatePasswordPolicy(body.password);
  if (!pwCheck.valid) {
    return json({ error: pwCheck.errors[0] ?? "Senha inválida" }, 400);
  }

  const rawCpf   = body.cpf?.replace(/\D/g, "") || null;
  const rawPhone = body.phone?.replace(/\D/g, "") || null;

  const db = createDb(process.env.DATABASE_URL!);

  // Verifica se e-mail já existe
  const [existingByEmail] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existingByEmail) {
    // Verifica se já é membro desta loja
    const [alreadyMember] = await db
      .select({ userId: storeUsers.userId })
      .from(storeUsers)
      .where(and(
        eq(storeUsers.storeId, storeAccess.storeId),
        eq(storeUsers.userId, existingByEmail.id),
      ))
      .limit(1);

    if (alreadyMember) {
      return json({ error: "Este e-mail já faz parte da equipe desta loja" }, 409);
    }

    // Adiciona usuário existente à loja
    await db.insert(storeUsers).values({
      storeId: storeAccess.storeId,
      userId:  existingByEmail.id,
      role:    storeRole,
    });

    return json({ success: true, userId: existingByEmail.id });
  }

  // Verifica unicidade do CPF
  if (rawCpf) {
    const [existingByCpf] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.cpf, rawCpf))
      .limit(1);

    if (existingByCpf) {
      return json({ error: "CPF já cadastrado no sistema" }, 409);
    }
  }

  const passwordHash = await hashPassword(body.password);

  const [newUser] = await db
    .insert(users)
    .values({
      name,
      email,
      passwordHash,
      phone: rawPhone,
      cpf:   rawCpf,
      role:  "merchant",
      emailVerified: true, // criado por admin = pré-verificado
      active: body.active !== false,
    })
    .returning({ id: users.id });

  if (!newUser) return json({ error: "Erro ao criar usuário" }, 500);

  await db.insert(storeUsers).values({
    storeId: storeAccess.storeId,
    userId:  newUser.id,
    role:    storeRole,
  });

  return json({ success: true, userId: newUser.id });
}

// ─── POST /api/store-users/update ────────────────────────────────────────────
export async function updateStoreUserHandler(
  request: Request,
  auth?: AuthContext
): Promise<Response> {
  let storeAccess: { storeId: string; userId: string };
  try {
    storeAccess = await requireStoreOwner(auth);
  } catch (e) {
    return json({ error: (e as Error).message }, auth?.userId ? 403 : 401);
  }

  const body = await request.json() as {
    userId?: string;
    name?: string;
    phone?: string;
    cpf?: string;
    storeRole?: string;
    active?: boolean;
  };

  if (!body.userId) {
    return json({ error: "Usuário não informado" }, 400);
  }

  // Protege o próprio usuário de fazer alterações prejudiciais em si mesmo
  if (body.userId === storeAccess.userId && body.active === false) {
    return json({ error: "Você não pode desativar a própria conta" }, 400);
  }

  const db = createDb(process.env.DATABASE_URL!);

  // Verifica se o usuário é membro desta loja
  const [member] = await db
    .select({ role: storeUsers.role })
    .from(storeUsers)
    .where(and(
      eq(storeUsers.storeId, storeAccess.storeId),
      eq(storeUsers.userId, body.userId),
    ))
    .limit(1);

  if (!member) {
    return json({ error: "Usuário não encontrado nesta equipe" }, 404);
  }

  // Somente o proprietário pode mover/editar o próprio cargo de "owner"
  if (member.role === "owner" && body.userId !== storeAccess.userId) {
    return json({ error: "Sem permissão para editar o proprietário" }, 403);
  }

  const rawCpf   = body.cpf ? body.cpf.replace(/\D/g, "") || null : undefined;
  const rawPhone = body.phone ? body.phone.replace(/\D/g, "") || null : undefined;

  // Unicidade de CPF (se alterado)
  if (rawCpf) {
    const [conflict] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.cpf, rawCpf))
      .limit(1);

    if (conflict && conflict.id !== body.userId) {
      return json({ error: "CPF já cadastrado em outra conta" }, 409);
    }
  }

  // Atualiza dados do usuário
  await db
    .update(users)
    .set({
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
      ...(rawPhone !== undefined ? { phone: rawPhone } : {}),
      ...(rawCpf !== undefined ? { cpf: rawCpf } : {}),
      ...(body.active !== undefined ? { active: body.active } : {}),
      updatedAt: new Date(),
    })
    .where(eq(users.id, body.userId));

  // Atualiza role na loja (apenas se informado e diferente de "owner")
  if (body.storeRole && ASSIGNABLE_ROLES.includes(body.storeRole as AssignableRole)) {
    if (member.role !== "owner") {
      await db
        .update(storeUsers)
        .set({ role: body.storeRole })
        .where(and(
          eq(storeUsers.storeId, storeAccess.storeId),
          eq(storeUsers.userId, body.userId),
        ));
    }
  }

  return json({ success: true });
}

// ─── POST /api/store-users/change-password ────────────────────────────────────
export async function adminChangeUserPasswordHandler(
  request: Request,
  auth?: AuthContext
): Promise<Response> {
  let storeAccess: { storeId: string; userId: string };
  try {
    storeAccess = await requireStoreOwner(auth);
  } catch (e) {
    return json({ error: (e as Error).message }, auth?.userId ? 403 : 401);
  }

  const body = await request.json() as {
    userId?: string;
    newPassword?: string;
  };

  if (!body.userId || !body.newPassword) {
    return json({ error: "Usuário e nova senha são obrigatórios" }, 400);
  }

  const pwCheck = validatePasswordPolicy(body.newPassword);
  if (!pwCheck.valid) {
    return json({ error: pwCheck.errors[0] ?? "Senha inválida" }, 400);
  }

  const db = createDb(process.env.DATABASE_URL!);

  // Verifica se é membro da loja
  const [member] = await db
    .select({ role: storeUsers.role })
    .from(storeUsers)
    .where(and(
      eq(storeUsers.storeId, storeAccess.storeId),
      eq(storeUsers.userId, body.userId),
    ))
    .limit(1);

  if (!member) {
    return json({ error: "Usuário não encontrado nesta equipe" }, 404);
  }

  // Não permite alterar a senha do proprietário (exceto o próprio)
  if (member.role === "owner" && body.userId !== storeAccess.userId) {
    return json({ error: "Sem permissão para alterar a senha do proprietário" }, 403);
  }

  const passwordHash = await hashPassword(body.newPassword);

  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, body.userId));

  return json({ success: true });
}

// ─── POST /api/store-users/toggle-status ─────────────────────────────────────
export async function toggleStoreUserStatusHandler(
  request: Request,
  auth?: AuthContext
): Promise<Response> {
  let storeAccess: { storeId: string; userId: string };
  try {
    storeAccess = await requireStoreOwner(auth);
  } catch (e) {
    return json({ error: (e as Error).message }, auth?.userId ? 403 : 401);
  }

  const body = await request.json() as { userId?: string; active?: boolean };

  if (!body.userId || body.active === undefined) {
    return json({ error: "Usuário e status são obrigatórios" }, 400);
  }

  if (body.userId === storeAccess.userId && !body.active) {
    return json({ error: "Você não pode desativar a própria conta" }, 400);
  }

  const db = createDb(process.env.DATABASE_URL!);

  const [member] = await db
    .select({ role: storeUsers.role })
    .from(storeUsers)
    .where(and(
      eq(storeUsers.storeId, storeAccess.storeId),
      eq(storeUsers.userId, body.userId),
    ))
    .limit(1);

  if (!member) {
    return json({ error: "Usuário não encontrado nesta equipe" }, 404);
  }

  if (member.role === "owner" && body.userId !== storeAccess.userId) {
    return json({ error: "Sem permissão para alterar o status do proprietário" }, 403);
  }

  await db
    .update(users)
    .set({ active: body.active, updatedAt: new Date() })
    .where(eq(users.id, body.userId));

  return json({ success: true });
}
