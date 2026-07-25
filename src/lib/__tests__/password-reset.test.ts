/**
 * Regressão do C-1 — reset de senha aceitava qualquer código da plataforma.
 *
 * validateVerificationCode() buscava por (code, type) sem escopo de usuário, e
 * resetPasswordHandler recebia só { code, newPassword }. Acertar um código de
 * 6 dígitos ativo dava a conta de quem quer que fosse o dono dele — o atacante
 * nem precisava escolher a vítima.
 *
 * Agora o código é validado apenas contra o usuário resolvido a partir do
 * e-mail informado, com teto de tentativas por usuário.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ──────────────────────────────────────────────────────

interface CodeRow {
  id: string;
  userId: string;
  code: string;
  type: string;
  attempts: number;
  usedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
}

/** Linhas que o select de verification_codes deve devolver. */
let codeRows: CodeRow[] = [];
/** Usuário devolvido por findUserByEmail — null simula e-mail inexistente. */
let userRow: { id: string; email: string; passwordHash: string } | null = null;

let codeUpdates: Array<Record<string, unknown>> = [];
let userUpdates: Array<Record<string, unknown>> = [];

function thenable(rows: unknown[]) {
  const p = Promise.resolve(rows) as Promise<unknown[]> & {
    limit: (n: number) => Promise<unknown[]>;
    orderBy: (...a: unknown[]) => Promise<unknown[]> & { limit: (n: number) => Promise<unknown[]> };
  };
  p.limit = () => Promise.resolve(rows);
  p.orderBy = () => {
    const q = Promise.resolve(rows) as Promise<unknown[]> & { limit: (n: number) => Promise<unknown[]> };
    q.limit = () => Promise.resolve(rows);
    return q;
  };
  return p;
}

vi.mock("@/lib/db", () => {
  const mockDb = () => ({
    select: () => ({
      from: (table: { __name?: string }) => ({
        where: () => thenable(table?.__name === "users" ? (userRow ? [userRow] : []) : codeRows),
      }),
    }),
    insert: () => ({ values: () => Promise.resolve() }),
    update: (table: { __name?: string }) => ({
      set: (values: Record<string, unknown>) => ({
        where: () => {
          (table?.__name === "users" ? userUpdates : codeUpdates).push(values);
          return Promise.resolve();
        },
      }),
    }),
  });
  return {
    createDb: mockDb,
    createTenantDb: () => Promise.resolve(mockDb()),
    schema: {
      users: { __name: "users", id: "id", email: "email" },
      verificationCodes: {
        __name: "verification_codes",
        id: "id", userId: "userId", code: "code", type: "type",
        usedAt: "usedAt", expiresAt: "expiresAt", createdAt: "createdAt",
      },
    },
  };
});

vi.mock("@/lib/audit", () => ({
  logAudit: vi.fn(),
  AuditActions: { PASSWORD_RESET: "PASSWORD_RESET" },
}));

import { resetPasswordHandler } from "@/lib/api/auth/reset-password-handler";
import { generateCode } from "@/lib/auth";

// ─── Cenário ────────────────────────────────────────────────────

const VITIMA_ID    = "user-vitima-aaa";
const VITIMA_EMAIL = "vitima@loja.com";
const SENHA_NOVA   = "Senha!Forte9";

function codigoAtivo(over: Partial<CodeRow> = {}): CodeRow {
  return {
    id: "vc-1",
    userId: VITIMA_ID,
    code: "123456",
    type: "password_reset",
    attempts: 0,
    usedAt: null,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    createdAt: new Date(),
    ...over,
  };
}

function post(body: unknown) {
  return new Request("https://armazix.com.br/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  codeRows = [];
  userRow = null;
  codeUpdates = [];
  userUpdates = [];
  process.env.DATABASE_URL = "postgres://test";
});

// ─── Escopo de usuário ──────────────────────────────────────────

describe("resetPasswordHandler — escopo do código", () => {
  it("C-1 #1 — rejeita quando o e-mail não é informado", async () => {
    codeRows = [codigoAtivo()];
    userRow  = { id: VITIMA_ID, email: VITIMA_EMAIL, passwordHash: "x" };

    const res = await resetPasswordHandler(post({ code: "123456", newPassword: SENHA_NOVA }));

    expect(res.status).toBe(400);
    expect(userUpdates).toHaveLength(0);
  });

  it("C-1 #2 — código correto do usuário certo redefine a senha", async () => {
    codeRows = [codigoAtivo()];
    userRow  = { id: VITIMA_ID, email: VITIMA_EMAIL, passwordHash: "x" };

    const res = await resetPasswordHandler(
      post({ email: VITIMA_EMAIL, code: "123456", newPassword: SENHA_NOVA }),
    );

    expect(res.status).toBe(200);
    expect(userUpdates).toHaveLength(1);
    expect(userUpdates[0]).toHaveProperty("passwordHash");
  });

  it("C-1 #3 — código de OUTRO usuário não serve (não há código para este)", async () => {
    // O select é filtrado por userId, então para a conta informada não há
    // nenhum código ativo — ainda que exista um válido em outra conta.
    codeRows = [];
    userRow  = { id: "user-outro-zzz", email: "outro@loja.com", passwordHash: "x" };

    const res = await resetPasswordHandler(
      post({ email: "outro@loja.com", code: "123456", newPassword: SENHA_NOVA }),
    );

    expect(res.status).toBe(400);
    expect(userUpdates).toHaveLength(0);
  });

  it("C-1 #4 — e-mail inexistente responde igual a código errado", async () => {
    userRow = null;

    const res = await resetPasswordHandler(
      post({ email: "naoexiste@loja.com", code: "123456", newPassword: SENHA_NOVA }),
    );
    const body = await res.json() as { error: string };

    expect(res.status).toBe(400);
    expect(body.error).toBe("Código inválido ou expirado");
    expect(userUpdates).toHaveLength(0);
  });
});

// ─── Tentativas ─────────────────────────────────────────────────

describe("resetPasswordHandler — teto de tentativas", () => {
  it("C-1 #5 — código errado incrementa tentativas e não troca a senha", async () => {
    codeRows = [codigoAtivo({ attempts: 2 })];
    userRow  = { id: VITIMA_ID, email: VITIMA_EMAIL, passwordHash: "x" };

    const res = await resetPasswordHandler(
      post({ email: VITIMA_EMAIL, code: "999999", newPassword: SENHA_NOVA }),
    );

    expect(res.status).toBe(400);
    expect(userUpdates).toHaveLength(0);
    expect(codeUpdates).toContainEqual({ attempts: 3 });
  });

  it("C-1 #6 — após o teto o código é queimado, mesmo com o dígito certo", async () => {
    codeRows = [codigoAtivo({ attempts: 5 })];
    userRow  = { id: VITIMA_ID, email: VITIMA_EMAIL, passwordHash: "x" };

    const res = await resetPasswordHandler(
      post({ email: VITIMA_EMAIL, code: "123456", newPassword: SENHA_NOVA }),
    );

    expect(res.status).toBe(400);
    expect(userUpdates).toHaveLength(0);
    // Marcado como usado para forçar um novo envio.
    expect(codeUpdates.some(u => "usedAt" in u)).toBe(true);
  });
});

// ─── Política de senha ──────────────────────────────────────────

describe("resetPasswordHandler — política de senha", () => {
  it("C-1 #7 — recusa senha que não atende a política, mesmo com código certo", async () => {
    codeRows = [codigoAtivo()];
    userRow  = { id: VITIMA_ID, email: VITIMA_EMAIL, passwordHash: "x" };

    const res = await resetPasswordHandler(
      post({ email: VITIMA_EMAIL, code: "123456", newPassword: "12345678" }),
    );

    expect(res.status).toBe(400);
    expect(userUpdates).toHaveLength(0);
  });
});

// ─── Gerador ────────────────────────────────────────────────────

describe("generateCode", () => {
  it("C-1 #8 — gera sempre 6 dígitos dentro da faixa", () => {
    for (let i = 0; i < 500; i++) {
      const code = generateCode();
      expect(code).toMatch(/^\d{6}$/);
      const n = Number(code);
      expect(n).toBeGreaterThanOrEqual(100000);
      expect(n).toBeLessThanOrEqual(999999);
    }
  });
});
