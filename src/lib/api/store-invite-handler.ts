// ─────────────────────────────────────────────────────────────────────────
// Convites de equipe.
//
// Substitui o antigo POST /api/store-users/create, que vinculava um usuário
// já existente à loja de quem chamava sem nenhum aceite. Como os handlers de
// equipe escrevem na tabela global `users` (senha, active, nome, cpf), aquele
// vínculo silencioso permitia que o dono da loja A assumisse a conta do dono
// da loja B.
//
// Aqui a posse do e-mail é a prova de identidade: o token só existe na caixa
// de entrada da pessoa convidada. Quem emite o convite nunca o vê.
// ─────────────────────────────────────────────────────────────────────────

import { createDb, createDbTransactional, schema } from "@/lib/db";
import { and, eq, isNull, gt, desc } from "drizzle-orm";
import { requireStoreOwner, type AuthContext } from "@/lib/auth/require-store-access";
import { hashPassword, verifyPassword, validatePasswordPolicy } from "@/lib/auth";
import { sendTeamInviteEmail } from "@/lib/auth/email";
import { logAudit, AuditActions, ResourceTypes } from "@/lib/audit";
import { waitUntil } from "@/lib/execution-context";

const { users, storeUsers, storeInvites, stores } = schema;

const INVITE_TTL_DAYS = 7;

export const ASSIGNABLE_ROLES = ["admin", "gerente", "vendedor", "operador"] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

const ROLE_LABELS: Record<AssignableRole, string> = {
  admin:    "Administrador",
  gerente:  "Gerente",
  vendedor: "Vendedor",
  operador: "Operador",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// ─── Token ────────────────────────────────────────────────────────────────
// 32 bytes de CSPRNG. Não usar Math.random() aqui — é justamente a falha do
// gerador de códigos de verificação (ver auditoria, C-1).

function generateInviteToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Guardamos apenas o hash: um dump do banco não permite aceitar convites pendentes. */
async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

// ─── POST /api/store-users/invite ─────────────────────────────────────────
// Emite (ou reemite) um convite. Não cria usuário nem vínculo.
export async function inviteStoreUserHandler(
  request: Request,
  auth?: AuthContext,
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
    storeRole?: string;
  };

  const name  = body.name?.trim();
  const email = body.email ? normalizeEmail(body.email) : "";
  const role  = body.storeRole as AssignableRole | undefined;

  if (!name || !email || !role) {
    return json({ error: "Nome, e-mail e perfil são obrigatórios" }, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "E-mail inválido" }, 400);
  }
  if (!ASSIGNABLE_ROLES.includes(role)) {
    return json({ error: "Perfil inválido" }, 400);
  }

  const db = createDb(process.env.DATABASE_URL!);

  const store = await db.query.stores.findFirst({
    where: eq(stores.id, storeAccess.storeId),
    columns: { id: true, name: true },
  });
  if (!store) return json({ error: "Loja não encontrada" }, 404);

  // Já faz parte da equipe? Nada a convidar.
  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existingUser) {
    const [alreadyMember] = await db
      .select({ userId: storeUsers.userId })
      .from(storeUsers)
      .where(and(
        eq(storeUsers.storeId, storeAccess.storeId),
        eq(storeUsers.userId, existingUser.id),
      ))
      .limit(1);

    if (alreadyMember) {
      return json({ error: "Este e-mail já faz parte da equipe desta loja" }, 409);
    }
  }

  // Reemissão: invalida convites pendentes anteriores para o mesmo par
  // (loja, e-mail) antes de gerar o novo, para que só um token fique válido.
  await db.update(storeInvites)
    .set({ revokedAt: new Date() })
    .where(and(
      eq(storeInvites.storeId, storeAccess.storeId),
      eq(storeInvites.email, email),
      isNull(storeInvites.acceptedAt),
      isNull(storeInvites.revokedAt),
    ));

  const token     = generateInviteToken();
  const tokenHash = await hashToken(token);
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

  const [invite] = await db.insert(storeInvites).values({
    storeId:   storeAccess.storeId,
    email,
    name,
    role,
    tokenHash,
    expiresAt,
    invitedBy: storeAccess.userId,
  }).returning({ id: storeInvites.id });

  const origin    = new URL(request.url).origin;
  const acceptUrl = `${origin}/convite?token=${encodeURIComponent(token)}`;

  // Envio em background: o convite já está gravado, e uma falha do Resend não
  // deve derrubar a resposta — o dono pode reenviar pela lista de pendentes.
  waitUntil(request, (async () => {
    try {
      await sendTeamInviteEmail(email, name, store.name, ROLE_LABELS[role], acceptUrl);
    } catch (err) {
      console.error("[invite] falha ao enviar e-mail de convite:", err);
    }
  })());

  logAudit({
    userId:       storeAccess.userId,
    storeId:      storeAccess.storeId,
    action:       AuditActions.TEAM_INVITE_SENT,
    resourceType: ResourceTypes.USER,
    resourceId:   invite?.id,
    details:      { email, role },
  }, request);

  return json({ success: true, inviteId: invite?.id });
}

// ─── GET /api/store-users/invites ─────────────────────────────────────────
export async function listStoreInvitesHandler(
  _request: Request,
  auth?: AuthContext,
): Promise<Response> {
  let storeAccess: { storeId: string; userId: string };
  try {
    storeAccess = await requireStoreOwner(auth);
  } catch (e) {
    return json({ error: (e as Error).message }, auth?.userId ? 403 : 401);
  }

  const db = createDb(process.env.DATABASE_URL!);

  // Projeção explícita: tokenHash nunca sai daqui.
  const invites = await db
    .select({
      id:        storeInvites.id,
      email:     storeInvites.email,
      name:      storeInvites.name,
      role:      storeInvites.role,
      expiresAt: storeInvites.expiresAt,
      createdAt: storeInvites.createdAt,
    })
    .from(storeInvites)
    .where(and(
      eq(storeInvites.storeId, storeAccess.storeId),
      isNull(storeInvites.acceptedAt),
      isNull(storeInvites.revokedAt),
      gt(storeInvites.expiresAt, new Date()),
    ))
    .orderBy(desc(storeInvites.createdAt));

  return json({ invites });
}

// ─── POST /api/store-users/invite-revoke ──────────────────────────────────
export async function revokeStoreInviteHandler(
  request: Request,
  auth?: AuthContext,
): Promise<Response> {
  let storeAccess: { storeId: string; userId: string };
  try {
    storeAccess = await requireStoreOwner(auth);
  } catch (e) {
    return json({ error: (e as Error).message }, auth?.userId ? 403 : 401);
  }

  const body = await request.json() as { inviteId?: string };
  if (!body.inviteId) return json({ error: "inviteId é obrigatório" }, 400);

  const db = createDb(process.env.DATABASE_URL!);

  const [revoked] = await db.update(storeInvites)
    .set({ revokedAt: new Date() })
    .where(and(
      eq(storeInvites.id, body.inviteId),
      eq(storeInvites.storeId, storeAccess.storeId),   // escopo de tenant
      isNull(storeInvites.acceptedAt),
      isNull(storeInvites.revokedAt),
    ))
    .returning({ id: storeInvites.id });

  if (!revoked) return json({ error: "Convite não encontrado" }, 404);

  logAudit({
    userId:       storeAccess.userId,
    storeId:      storeAccess.storeId,
    action:       AuditActions.TEAM_INVITE_REVOKED,
    resourceType: ResourceTypes.USER,
    resourceId:   body.inviteId,
  }, request);

  return json({ success: true });
}

// ─── Resolução do token (compartilhada entre info e accept) ───────────────

type InviteRow = typeof storeInvites.$inferSelect;

async function resolveInvite(
  db: ReturnType<typeof createDb>,
  token: string,
): Promise<InviteRow | null> {
  const tokenHash = await hashToken(token);
  const invite = await db.query.storeInvites.findFirst({
    where: eq(storeInvites.tokenHash, tokenHash),
  });

  if (!invite) return null;
  if (invite.acceptedAt || invite.revokedAt) return null;
  if (invite.expiresAt.getTime() < Date.now()) return null;

  return invite;
}

// ─── GET /api/store-users/invite-info?token=... ───────────────────────────
// Público — a tela de aceite precisa saber o nome da loja e se a pessoa já
// tem conta (para pedir "criar senha" ou "senha atual").
export async function getInviteInfoHandler(request: Request): Promise<Response> {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return json({ error: "Convite inválido" }, 400);

  const db = createDb(process.env.DATABASE_URL!);
  const invite = await resolveInvite(db, token);

  // Resposta uniforme: não distinguimos "não existe" de "expirado/revogado".
  if (!invite) return json({ error: "Convite inválido ou expirado" }, 404);

  const [store, existingUser] = await Promise.all([
    db.query.stores.findFirst({
      where: eq(stores.id, invite.storeId),
      columns: { name: true },
    }),
    db.select({ id: users.id }).from(users).where(eq(users.email, invite.email)).limit(1)
      .then(r => r[0] ?? null),
  ]);

  return json({
    invite: {
      email:     invite.email,
      name:      invite.name,
      role:      invite.role,
      roleLabel: ROLE_LABELS[invite.role as AssignableRole] ?? invite.role,
      storeName: store?.name ?? "Loja",
      expiresAt: invite.expiresAt,
      // true  → pessoa nova, define a senha agora
      // false → já tem conta no Armazix, confirma com a senha atual
      isNewUser: !existingUser,
    },
  });
}

// ─── POST /api/store-users/accept-invite ──────────────────────────────────
// Público. Cria a conta (se nova) e o vínculo, numa transação.
export async function acceptInviteHandler(request: Request): Promise<Response> {
  const body = await request.json() as {
    token?: string;
    password?: string;         // usuário novo: senha a definir
    currentPassword?: string;  // usuário existente: confirma que é ele
  };

  if (!body.token) return json({ error: "Convite inválido" }, 400);

  const db = createDb(process.env.DATABASE_URL!);
  const invite = await resolveInvite(db, body.token);
  if (!invite) return json({ error: "Convite inválido ou expirado" }, 404);

  const [existingUser] = await db
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, invite.email))
    .limit(1);

  const txDb = createDbTransactional(process.env.DATABASE_URL!);

  // ── Caso 1: pessoa já tem conta no Armazix ──────────────────────────────
  // Não deixamos redefinir a senha por aqui — isso seria um caminho paralelo
  // de recuperação de conta. Ela confirma com a senha que já usa.
  if (existingUser) {
    if (!body.currentPassword) {
      return json({ error: "Informe sua senha atual do Armazix para aceitar o convite" }, 400);
    }

    const ok = await verifyPassword(body.currentPassword, existingUser.passwordHash);
    if (!ok) {
      return json({ error: "Senha incorreta" }, 401);
    }

    const [alreadyMember] = await db
      .select({ userId: storeUsers.userId })
      .from(storeUsers)
      .where(and(
        eq(storeUsers.storeId, invite.storeId),
        eq(storeUsers.userId, existingUser.id),
      ))
      .limit(1);

    await txDb.transaction(async (tx) => {
      if (!alreadyMember) {
        await tx.insert(storeUsers).values({
          storeId: invite.storeId,
          userId:  existingUser.id,
          role:    invite.role,
        });
      }
      await tx.update(storeInvites)
        .set({ acceptedAt: new Date() })
        .where(eq(storeInvites.id, invite.id));
    });

    logAudit({
      userId:       existingUser.id,
      storeId:      invite.storeId,
      action:       AuditActions.TEAM_INVITE_ACCEPTED,
      resourceType: ResourceTypes.USER,
      resourceId:   existingUser.id,
      details:      { role: invite.role, newAccount: false },
    }, request);

    return json({ success: true, email: invite.email, newAccount: false });
  }

  // ── Caso 2: conta nova ──────────────────────────────────────────────────
  if (!body.password) {
    return json({ error: "Defina uma senha para criar seu acesso" }, 400);
  }

  const pwCheck = validatePasswordPolicy(body.password);
  if (!pwCheck.valid) {
    return json({ error: pwCheck.errors[0] ?? "Senha inválida" }, 400);
  }

  const passwordHash = await hashPassword(body.password);

  let newUserId: string | undefined;
  await txDb.transaction(async (tx) => {
    const [created] = await tx.insert(users).values({
      name:          invite.name,
      email:         invite.email,
      passwordHash,
      role:          "merchant",
      // O convite chegou nesta caixa de entrada — a posse do e-mail já está provada.
      emailVerified: true,
      active:        true,
    }).returning({ id: users.id });

    if (!created) throw new Error("Falha ao criar usuário");
    newUserId = created.id;

    await tx.insert(storeUsers).values({
      storeId: invite.storeId,
      userId:  created.id,
      role:    invite.role,
    });

    await tx.update(storeInvites)
      .set({ acceptedAt: new Date() })
      .where(eq(storeInvites.id, invite.id));
  });

  logAudit({
    userId:       newUserId,
    storeId:      invite.storeId,
    action:       AuditActions.TEAM_INVITE_ACCEPTED,
    resourceType: ResourceTypes.USER,
    resourceId:   newUserId,
    details:      { role: invite.role, newAccount: true },
  }, request);

  return json({ success: true, email: invite.email, newAccount: true });
}
