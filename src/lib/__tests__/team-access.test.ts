/**
 * Regressão do C-5 — escalada cross-tenant pela gestão de equipe.
 *
 * O furo original tinha dois passos:
 *   1. POST /api/store-users/create vinculava silenciosamente um usuário já
 *      existente à loja de quem chamava, sem aceite.
 *   2. Os handlers de equipe escrevem na tabela GLOBAL `users` (senha, active,
 *      nome, cpf) autorizados apenas por "é membro da minha loja".
 *
 * Encadeando os dois, o dono da loja A trocava a senha do dono da loja B.
 *
 * O passo 1 deixou de existir (só se entra na equipe por convite aceito, ver
 * store-invite-handler.ts). Estes testes cobrem o passo 2, que é o que protege
 * os vínculos que o fluxo antigo já criou: escrita no registro global só é
 * permitida quando a loja de quem chama é o ÚNICO vínculo do alvo.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ──────────────────────────────────────────────────────

/** Fila de resultados para cada db.select()...where() na ordem em que ocorrem. */
let selectQueue: unknown[][] = [];
/** Todo db.update() executado, para assertar o que foi (ou não foi) escrito. */
let updateCalls: Array<{ table: string; values: Record<string, unknown> }> = [];

const mockStoreUsersFind = vi.fn();

function whereResult(rows: unknown[]) {
  const p = Promise.resolve(rows) as Promise<unknown[]> & {
    limit: (n: number) => Promise<unknown[]>;
  };
  p.limit = () => Promise.resolve(rows);
  return p;
}

vi.mock("@/lib/db", () => {
  const mockDb = () => ({
    query: { storeUsers: { findFirst: mockStoreUsersFind } },
    select: () => ({
      from: () => ({
        where: () => whereResult(selectQueue.shift() ?? []),
      }),
    }),
    update: (table: { __name?: string }) => ({
      set: (values: Record<string, unknown>) => ({
        where: () => {
          updateCalls.push({ table: table?.__name ?? "unknown", values });
          return Promise.resolve();
        },
      }),
    }),
  });
  return {
    createDb: mockDb,
    createUnscopedDb: () => Promise.resolve(mockDb()),
    schema: {
      users:      { __name: "users",       id: "id", cpf: "cpf", email: "email" },
      storeUsers: { __name: "store_users", userId: "userId", storeId: "storeId", role: "role" },
    },
  };
});

vi.mock("@/lib/audit", () => ({
  logAudit: vi.fn(),
  AuditActions: {
    CROSS_STORE_USER_WRITE_BLOCKED: "CROSS_STORE_USER_WRITE_BLOCKED",
    USER_UPDATE: "USER_UPDATE",
  },
  ResourceTypes: { USER: "user" },
}));

import {
  adminChangeUserPasswordHandler,
  toggleStoreUserStatusHandler,
  updateStoreUserHandler,
} from "@/lib/api/user-handler";

// ─── Cenário ────────────────────────────────────────────────────

const ATACANTE_USER  = "user-atacante-aaa";
const ATACANTE_STORE = "store-atacante-111";
const VITIMA_USER    = "user-vitima-bbb";
const OUTRA_STORE    = "store-outra-999";

function auth(userId: string, storeId: string) {
  return { userId, email: "a@b.com", role: "user", storeId };
}

function post(body: unknown) {
  return new Request("https://armazix.com.br/api/store-users/x", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** requireStoreOwner: quem chama é owner da própria loja. */
function souOwner() {
  mockStoreUsersFind.mockResolvedValue({
    userId: ATACANTE_USER, storeId: ATACANTE_STORE, role: "owner",
  });
}

/** A vítima pertence à loja do atacante E a outra — é o caso perigoso. */
function vitimaEmDuasLojas() {
  selectQueue = [[
    { storeId: ATACANTE_STORE, role: "vendedor" },
    { storeId: OUTRA_STORE,    role: "owner"    },
  ]];
}

/** Funcionário comum: só existe dentro da loja do solicitante. */
function membroExclusivo() {
  selectQueue = [[{ storeId: ATACANTE_STORE, role: "vendedor" }]];
}

beforeEach(() => {
  vi.clearAllMocks();
  selectQueue = [];
  updateCalls = [];
  process.env.DATABASE_URL = "postgres://test";
  process.env.NODE_ENV = "production";
});

// ─── Troca de senha ─────────────────────────────────────────────

describe("adminChangeUserPasswordHandler — escrita global", () => {
  it("C-5 #1 — bloqueia troca de senha de usuário que pertence a outra loja", async () => {
    souOwner();
    vitimaEmDuasLojas();

    const res = await adminChangeUserPasswordHandler(
      post({ userId: VITIMA_USER, newPassword: "Senha!Forte9" }),
      auth(ATACANTE_USER, ATACANTE_STORE),
    );

    expect(res.status).toBe(403);
    // O ponto central: nada foi escrito na tabela global de usuários.
    expect(updateCalls.filter(c => c.table === "users")).toHaveLength(0);
  });

  it("C-5 #2 — permite troca de senha de membro exclusivo da loja", async () => {
    souOwner();
    membroExclusivo();

    const res = await adminChangeUserPasswordHandler(
      post({ userId: VITIMA_USER, newPassword: "Senha!Forte9" }),
      auth(ATACANTE_USER, ATACANTE_STORE),
    );

    expect(res.status).toBe(200);
    const escritas = updateCalls.filter(c => c.table === "users");
    expect(escritas).toHaveLength(1);
    expect(escritas[0].values).toHaveProperty("passwordHash");
  });
});

// ─── Ativar/desativar ───────────────────────────────────────────

describe("toggleStoreUserStatusHandler — escrita global", () => {
  it("C-5 #3 — não desativa a conta global de quem também trabalha em outra loja", async () => {
    souOwner();
    vitimaEmDuasLojas();

    const res = await toggleStoreUserStatusHandler(
      post({ userId: VITIMA_USER, active: false }),
      auth(ATACANTE_USER, ATACANTE_STORE),
    );

    expect(res.status).toBe(403);
    expect(updateCalls.filter(c => c.table === "users")).toHaveLength(0);
  });
});

// ─── Atualização de dados ───────────────────────────────────────

describe("updateStoreUserHandler — global vs. escopo de loja", () => {
  it("C-5 #4 — bloqueia sobrescrita de nome/cpf de usuário multi-loja", async () => {
    souOwner();
    vitimaEmDuasLojas();

    const res = await updateStoreUserHandler(
      post({ userId: VITIMA_USER, name: "Nome Trocado", cpf: "12345678900" }),
      auth(ATACANTE_USER, ATACANTE_STORE),
    );

    expect(res.status).toBe(403);
    expect(updateCalls.filter(c => c.table === "users")).toHaveLength(0);
  });

  it("C-5 #5 — permite alterar só o perfil de acesso de usuário multi-loja", async () => {
    souOwner();
    vitimaEmDuasLojas();

    const res = await updateStoreUserHandler(
      post({ userId: VITIMA_USER, storeRole: "gerente" }),
      auth(ATACANTE_USER, ATACANTE_STORE),
    );

    // Papel é dado da loja, não identidade global — segue permitido.
    expect(res.status).toBe(200);
    expect(updateCalls.filter(c => c.table === "users")).toHaveLength(0);
    expect(updateCalls.filter(c => c.table === "store_users")).toHaveLength(1);
  });

  it("C-5 #6 — 404 quando o alvo não é membro da loja", async () => {
    souOwner();
    selectQueue = [[{ storeId: OUTRA_STORE, role: "owner" }]];

    const res = await updateStoreUserHandler(
      post({ userId: VITIMA_USER, name: "Qualquer" }),
      auth(ATACANTE_USER, ATACANTE_STORE),
    );

    expect(res.status).toBe(404);
    expect(updateCalls).toHaveLength(0);
  });
});
