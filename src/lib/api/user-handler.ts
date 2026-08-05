import { createDb } from "@/lib/db";
import { schema } from "@/lib/db";
import { eq, and, sql } from "drizzle-orm";
import { requireStoreAccess, requireStoreOwner } from "@/lib/auth/require-store-access";
import { hashPassword, validatePasswordPolicy } from "@/lib/auth";
import { logAudit, AuditActions, ResourceTypes } from "@/lib/audit";
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

// ─── Guard: escrita no registro global de um usuário ──────────────────────
//
// `users` é global; `store_users` é por loja. Os handlers abaixo alteram senha,
// active, nome e cpf — todos em `users`. Ser membro da minha loja não pode dar
// autoridade sobre a identidade global de alguém que também trabalha em outra.
//
// Por isso a escrita global só é liberada quando a loja do solicitante é o
// ÚNICO vínculo do alvo. Usuário multi-loja vira somente-leitura: dá para
// mudar o papel dele aqui dentro, não quem ele é lá fora.
//
// O fluxo de convite (store-invite-handler.ts) impede novos vínculos sem
// aceite; este guard cobre os vínculos que o fluxo antigo já criou.
interface MemberCheck {
  /** Papel do alvo NESTA loja — null quando ele não é membro dela. */
  role: string | null;
  /** true quando esta loja é o único vínculo do alvo em toda a plataforma. */
  exclusive: boolean;
}

async function checkMember(
  db: ReturnType<typeof createDb>,
  storeId: string,
  targetUserId: string,
): Promise<MemberCheck> {
  const vinculos = await db
    .select({ storeId: storeUsers.storeId, role: storeUsers.role })
    .from(storeUsers)
    .where(eq(storeUsers.userId, targetUserId));

  const naLoja = vinculos.find(v => v.storeId === storeId);
  return {
    role: naLoja?.role ?? null,
    exclusive: !!naLoja && vinculos.length === 1,
  };
}

/** Resposta padrão quando o alvo trabalha em mais de uma loja. */
function blockGlobalWrite(
  storeId: string,
  targetUserId: string,
  actorUserId: string,
  request: Request,
): Response {
  logAudit({
    userId:       actorUserId,
    storeId,
    action:       AuditActions.CROSS_STORE_USER_WRITE_BLOCKED,
    resourceType: ResourceTypes.USER,
    resourceId:   targetUserId,
    status:       "denied",
  }, request);

  return json({
    error: "Este usuário também faz parte de outra loja. Você pode alterar o perfil de acesso dele nesta loja, mas não os dados da conta nem a senha.",
  }, 403);
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

  const member = await checkMember(db, storeAccess.storeId, body.userId);
  if (!member.role) {
    return json({ error: "Usuário não encontrado nesta equipe" }, 404);
  }

  // Somente o proprietário pode mover/editar o próprio cargo de "owner"
  if (member.role === "owner" && body.userId !== storeAccess.userId) {
    return json({ error: "Sem permissão para editar o proprietário" }, 403);
  }

  const rawCpf   = body.cpf ? body.cpf.replace(/\D/g, "") || null : undefined;
  const rawPhone = body.phone ? body.phone.replace(/\D/g, "") || null : undefined;

  const mexeEmDadosGlobais =
    body.name !== undefined || rawPhone !== undefined ||
    rawCpf !== undefined || body.active !== undefined;

  // Alterar apenas o perfil de acesso é escrita de loja, não de identidade —
  // continua liberado mesmo para quem trabalha em mais de uma loja.
  if (mexeEmDadosGlobais && !member.exclusive) {
    return blockGlobalWrite(storeAccess.storeId, body.userId, storeAccess.userId, request);
  }

  if (mexeEmDadosGlobais) {
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
  }

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

  const member = await checkMember(db, storeAccess.storeId, body.userId);
  if (!member.role) {
    return json({ error: "Usuário não encontrado nesta equipe" }, 404);
  }
  if (!member.exclusive) {
    return blockGlobalWrite(storeAccess.storeId, body.userId, storeAccess.userId, request);
  }

  // Não permite alterar a senha do proprietário (exceto o próprio)
  if (member.role === "owner" && body.userId !== storeAccess.userId) {
    return json({ error: "Sem permissão para alterar a senha do proprietário" }, 403);
  }

  const passwordHash = await hashPassword(body.newPassword);

  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date(), sessionVersion: sql`${users.sessionVersion} + 1` })
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

  const member = await checkMember(db, storeAccess.storeId, body.userId);
  if (!member.role) {
    return json({ error: "Usuário não encontrado nesta equipe" }, 404);
  }
  if (!member.exclusive) {
    return blockGlobalWrite(storeAccess.storeId, body.userId, storeAccess.userId, request);
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
