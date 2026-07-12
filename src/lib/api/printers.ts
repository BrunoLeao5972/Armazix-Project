import { createTenantDb } from "@/lib/db";
import { schema } from "@/lib/db";
import { eq, desc, and } from "drizzle-orm";
import { requireStoreAccess, type AuthContext } from "@/lib/auth/require-store-access";
const { printers } = schema;

// ─── List ────────────────────────────────────────────────────────
export async function listPrintersHandler(request: Request, auth?: AuthContext): Promise<Response> {
  let storeId: string;
  try {
    const access = await requireStoreAccess(auth);
    storeId = access.storeId;
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: auth?.userId ? 403 : 401,
      headers: { "content-type": "application/json" },
    });
  }

  const db = await createTenantDb(process.env.DATABASE_URL!, storeId);
  try {
    const rows = await db
      .select()
      .from(printers)
      .where(and(eq(printers.storeId, storeId), eq(printers.active, true)))
      .orderBy(desc(printers.createdAt));
    return new Response(JSON.stringify({ printers: rows }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error("List printers error:", error);
    return new Response(JSON.stringify({ error: "Erro ao listar impressoras" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

// ─── Create ──────────────────────────────────────────────────────
export async function createPrinterHandler(request: Request, auth?: AuthContext): Promise<Response> {
  let storeId: string;
  try {
    const access = await requireStoreAccess(auth);
    storeId = access.storeId;
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: auth?.userId ? 403 : 401,
      headers: { "content-type": "application/json" },
    });
  }

  const body = await request.json() as {
    name: string;
    type: string;
    driver?: string;
    path?: string;
    columns?: number;
  };

  if (!body.name?.trim()) {
    return new Response(JSON.stringify({ error: "Nome é obrigatório" }), {
      status: 400, headers: { "content-type": "application/json" },
    });
  }
  if (!body.type?.trim()) {
    return new Response(JSON.stringify({ error: "Tipo é obrigatório" }), {
      status: 400, headers: { "content-type": "application/json" },
    });
  }

  const db = await createTenantDb(process.env.DATABASE_URL!, storeId);

  try {
    // Generate sequential code IMP001, IMP002...
    const existing = await db
      .select({ code: printers.code })
      .from(printers)
      .where(eq(printers.storeId, storeId));
    const maxNum = existing.reduce((max, r) => {
      const n = parseInt(r.code.replace(/\D/g, ""), 10);
      return isNaN(n) ? max : Math.max(max, n);
    }, 0);
    const code = `IMP${String(maxNum + 1).padStart(3, "0")}`;

    const [printer] = await db.insert(printers).values({
      storeId,
      code,
      name:    body.name.trim(),
      type:    body.type,
      driver:  body.driver ?? "Nenhum",
      path:    body.path?.trim() || null,
      columns: body.columns ?? 48,
    }).returning();

    return new Response(JSON.stringify({ success: true, printer }), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error("Create printer error:", error);
    return new Response(JSON.stringify({ error: "Erro ao cadastrar impressora" }), {
      status: 500, headers: { "content-type": "application/json" },
    });
  }
}

// ─── Update ──────────────────────────────────────────────────────
export async function updatePrinterHandler(request: Request, auth?: AuthContext): Promise<Response> {
  let storeId: string;
  try {
    const access = await requireStoreAccess(auth);
    storeId = access.storeId;
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: auth?.userId ? 403 : 401,
      headers: { "content-type": "application/json" },
    });
  }

  const body = await request.json() as {
    printerId: string;
    name?: string;
    type?: string;
    driver?: string;
    path?: string;
    columns?: number;
  };

  if (!body.printerId) {
    return new Response(JSON.stringify({ error: "printerId obrigatório" }), {
      status: 400, headers: { "content-type": "application/json" },
    });
  }

  const db = await createTenantDb(process.env.DATABASE_URL!, storeId);

  try {
    const existing = await db.query.printers.findFirst({
      where: and(eq(printers.id, body.printerId), eq(printers.storeId, storeId)),
    });
    if (!existing) {
      return new Response(JSON.stringify({ error: "Impressora não encontrada" }), {
        status: 404, headers: { "content-type": "application/json" },
      });
    }

    const [printer] = await db.update(printers)
      .set({
        name:      body.name    !== undefined ? body.name.trim()   : existing.name,
        type:      body.type    !== undefined ? body.type          : existing.type,
        driver:    body.driver  !== undefined ? body.driver        : existing.driver,
        path:      body.path    !== undefined ? (body.path.trim() || null) : existing.path,
        columns:   body.columns !== undefined ? body.columns       : existing.columns,
        updatedAt: new Date(),
      })
      .where(and(eq(printers.id, body.printerId), eq(printers.storeId, storeId)))
      .returning();

    return new Response(JSON.stringify({ success: true, printer }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error("Update printer error:", error);
    return new Response(JSON.stringify({ error: "Erro ao atualizar impressora" }), {
      status: 500, headers: { "content-type": "application/json" },
    });
  }
}

// ─── Delete (soft) ───────────────────────────────────────────────
export async function deletePrinterHandler(request: Request, auth?: AuthContext): Promise<Response> {
  let storeId: string;
  try {
    const access = await requireStoreAccess(auth);
    storeId = access.storeId;
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: auth?.userId ? 403 : 401,
      headers: { "content-type": "application/json" },
    });
  }

  const body = await request.json() as { printerId: string };
  if (!body.printerId) {
    return new Response(JSON.stringify({ error: "printerId obrigatório" }), {
      status: 400, headers: { "content-type": "application/json" },
    });
  }

  const db = await createTenantDb(process.env.DATABASE_URL!, storeId);
  try {
    await db.update(printers)
      .set({ active: false, updatedAt: new Date() })
      .where(and(eq(printers.id, body.printerId), eq(printers.storeId, storeId)));
    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error("Delete printer error:", error);
    return new Response(JSON.stringify({ error: "Erro ao excluir impressora" }), {
      status: 500, headers: { "content-type": "application/json" },
    });
  }
}

// ─── Detect system printers (Windows) ───────────────────────────
export async function detectPrintersHandler(_request: Request, auth?: AuthContext): Promise<Response> {
  try {
    await requireStoreAccess(auth);
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: auth?.userId ? 403 : 401,
      headers: { "content-type": "application/json" },
    });
  }

  // If server is not Windows, PowerShell is unavailable — report OS so frontend can show guidance
  if (process.platform !== "win32") {
    return new Response(JSON.stringify({ printers: [], serverOs: process.platform }), {
      status: 200, headers: { "content-type": "application/json" },
    });
  }

  try {
    // Dynamic import so this handler doesn't break in non-Node environments
    const { exec } = await import("child_process");
    const { promisify } = await import("util");
    const execAsync = promisify(exec);

    let names: string[] = [];
    try {
      const { stdout } = await execAsync(
        `powershell -NoProfile -Command "Get-Printer | Select-Object -ExpandProperty Name | ConvertTo-Json -Compress"`,
        { timeout: 5000 }
      );
      const raw = stdout.trim();
      if (raw.startsWith("[")) {
        names = JSON.parse(raw) as string[];
      } else if (raw.startsWith('"')) {
        names = [JSON.parse(raw) as string];
      }
    } catch {
      // Fallback: wmic (older Windows without PowerShell)
      try {
        const { stdout: wmicOut } = await execAsync(
          `wmic printer get name /format:list`,
          { timeout: 5000 }
        );
        names = wmicOut.split(/\r?\n/)
          .map(l => l.replace(/^Name=/, "").trim())
          .filter(Boolean);
      } catch { /* no printers found */ }
    }

    return new Response(JSON.stringify({ printers: names, serverOs: "win32" }), {
      status: 200, headers: { "content-type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ printers: [], serverOs: "win32" }), {
      status: 200, headers: { "content-type": "application/json" },
    });
  }
}
