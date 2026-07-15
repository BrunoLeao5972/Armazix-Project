import { createDb, createTenantDb } from "@/lib/db";
import { schema } from "@/lib/db";
import { eq, and, isNull, count } from "drizzle-orm";
import { requireStoreAccess, type AuthContext } from "@/lib/auth/require-store-access";

const { printEnvironments, categories, printers } = schema;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function nextCode(total: number): string {
  return String(total + 1).padStart(4, "0");
}

// ─── GET /api/print-environments/list ───────────────────────────
export async function listPrintEnvironmentsHandler(request: Request, auth?: AuthContext): Promise<Response> {
  let storeId: string;
  try {
    const access = await requireStoreAccess(auth);
    storeId = access.storeId;
  } catch (error) {
    return json({ error: (error as Error).message }, auth?.userId ? 403 : 401);
  }

  const db = createDb(process.env.DATABASE_URL!);
  try {
    const rows = await db.query.printEnvironments.findMany({
      where: eq(printEnvironments.storeId, storeId),
      with: {
        category: { columns: { id: true, name: true, emoji: true } },
        printer:  { columns: { id: true, name: true, type: true } },
      },
      orderBy: printEnvironments.code,
    });
    return json({ environments: rows });
  } catch (error) {
    console.error("List print environments error:", error);
    return json({ error: "Erro ao listar ambientes" }, 500);
  }
}

// ─── GET /api/print-environments/form-data ──────────────────────
// Retorna categorias mãe + impressoras ativas para popular o formulário.
export async function getPrintEnvironmentFormDataHandler(request: Request, auth?: AuthContext): Promise<Response> {
  let storeId: string;
  try {
    const access = await requireStoreAccess(auth);
    storeId = access.storeId;
  } catch (error) {
    return json({ error: (error as Error).message }, auth?.userId ? 403 : 401);
  }

  const db = createDb(process.env.DATABASE_URL!);
  try {
    const [rootCategories, activePrinters] = await Promise.all([
      db
        .select({ id: categories.id, name: categories.name, emoji: categories.emoji })
        .from(categories)
        .where(and(
          eq(categories.storeId, storeId),
          eq(categories.active, true),
          isNull(categories.parentId),
        ))
        .orderBy(categories.position, categories.name),
      db
        .select({ id: printers.id, name: printers.name, type: printers.type })
        .from(printers)
        .where(and(eq(printers.storeId, storeId), eq(printers.active, true)))
        .orderBy(printers.name),
    ]);
    return json({ categories: rootCategories, printers: activePrinters });
  } catch (error) {
    console.error("Form data error:", error);
    return json({ error: "Erro ao carregar dados do formulário" }, 500);
  }
}

// ─── POST /api/print-environments/create ────────────────────────
export async function createPrintEnvironmentHandler(request: Request, auth?: AuthContext): Promise<Response> {
  let storeId: string;
  try {
    const access = await requireStoreAccess(auth);
    storeId = access.storeId;
  } catch (error) {
    return json({ error: (error as Error).message }, auth?.userId ? 403 : 401);
  }

  const body = await request.json() as {
    name: string;
    categoryId: string;
    printerId?: string;
  };
  if (!body.name?.trim())   return json({ error: "Nome obrigatório" }, 400);
  if (!body.categoryId)     return json({ error: "Categoria obrigatória" }, 400);

  const db = await createTenantDb(process.env.DATABASE_URL!, storeId);
  try {
    // Verifica ownership da categoria
    const cat = await db.query.categories.findFirst({
      where: and(eq(categories.id, body.categoryId), eq(categories.storeId, storeId), isNull(categories.parentId)),
      columns: { id: true },
    });
    if (!cat) return json({ error: "Categoria não encontrada ou não é categoria mãe" }, 404);

    // Verifica ownership da impressora (se fornecida)
    if (body.printerId) {
      const prt = await db.query.printers.findFirst({
        where: and(eq(printers.id, body.printerId), eq(printers.storeId, storeId)),
        columns: { id: true },
      });
      if (!prt) return json({ error: "Impressora não encontrada" }, 404);
    }

    // Gera código sequencial
    const [{ total }] = await db
      .select({ total: count() })
      .from(printEnvironments)
      .where(eq(printEnvironments.storeId, storeId));
    const code = nextCode(Number(total));

    const [env] = await db.insert(printEnvironments).values({
      storeId,
      code,
      name:       body.name.trim(),
      categoryId: body.categoryId,
      printerId:  body.printerId || null,
    }).returning();

    return json({ success: true, environment: env }, 201);
  } catch (error) {
    console.error("Create print environment error:", error);
    return json({ error: "Erro ao criar ambiente" }, 500);
  }
}

// ─── POST /api/print-environments/update ────────────────────────
export async function updatePrintEnvironmentHandler(request: Request, auth?: AuthContext): Promise<Response> {
  let storeId: string;
  try {
    const access = await requireStoreAccess(auth);
    storeId = access.storeId;
  } catch (error) {
    return json({ error: (error as Error).message }, auth?.userId ? 403 : 401);
  }

  const body = await request.json() as {
    id: string;
    name?: string;
    categoryId?: string;
    printerId?: string | null;
    active?: boolean;
  };
  if (!body.id) return json({ error: "id obrigatório" }, 400);

  const db = await createTenantDb(process.env.DATABASE_URL!, storeId);
  try {
    const existing = await db.query.printEnvironments.findFirst({
      where: and(eq(printEnvironments.id, body.id), eq(printEnvironments.storeId, storeId)),
      columns: { id: true },
    });
    if (!existing) return json({ error: "Ambiente não encontrado" }, 404);

    if (body.categoryId) {
      const cat = await db.query.categories.findFirst({
        where: and(eq(categories.id, body.categoryId), eq(categories.storeId, storeId), isNull(categories.parentId)),
        columns: { id: true },
      });
      if (!cat) return json({ error: "Categoria não encontrada ou não é categoria mãe" }, 404);
    }

    if (body.printerId) {
      const prt = await db.query.printers.findFirst({
        where: and(eq(printers.id, body.printerId), eq(printers.storeId, storeId)),
        columns: { id: true },
      });
      if (!prt) return json({ error: "Impressora não encontrada" }, 404);
    }

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (body.name       !== undefined) patch.name       = body.name.trim();
    if (body.categoryId !== undefined) patch.categoryId = body.categoryId;
    if (body.printerId  !== undefined) patch.printerId  = body.printerId;
    if (body.active     !== undefined) patch.active     = body.active;

    const [updated] = await db
      .update(printEnvironments)
      .set(patch)
      .where(and(eq(printEnvironments.id, body.id), eq(printEnvironments.storeId, storeId)))
      .returning();

    return json({ success: true, environment: updated });
  } catch (error) {
    console.error("Update print environment error:", error);
    return json({ error: "Erro ao atualizar ambiente" }, 500);
  }
}

// ─── POST /api/print-environments/delete ────────────────────────
export async function deletePrintEnvironmentHandler(request: Request, auth?: AuthContext): Promise<Response> {
  let storeId: string;
  try {
    const access = await requireStoreAccess(auth);
    storeId = access.storeId;
  } catch (error) {
    return json({ error: (error as Error).message }, auth?.userId ? 403 : 401);
  }

  const body = await request.json() as { id: string };
  if (!body.id) return json({ error: "id obrigatório" }, 400);

  const db = await createTenantDb(process.env.DATABASE_URL!, storeId);
  try {
    const existing = await db.query.printEnvironments.findFirst({
      where: and(eq(printEnvironments.id, body.id), eq(printEnvironments.storeId, storeId)),
      columns: { id: true },
    });
    if (!existing) return json({ error: "Ambiente não encontrado" }, 404);

    await db.delete(printEnvironments)
      .where(and(eq(printEnvironments.id, body.id), eq(printEnvironments.storeId, storeId)));

    return json({ success: true });
  } catch (error) {
    console.error("Delete print environment error:", error);
    return json({ error: "Erro ao excluir ambiente" }, 500);
  }
}
