import { createDb } from "@/lib/db";
import { schema } from "@/lib/db";
import { and, eq } from "drizzle-orm";
import { closeCaixaSessao } from "@/lib/api/pdv-handler";

const { stores, caixaSessoes } = schema;

// Nenhuma loja do Armazix tem fuso próprio cadastrado (ver stores no
// schema.ts) — todas são brasileiras, então tratamos "horário configurado"
// como horário de Brasília fixo (UTC-3, sem horário de verão desde 2019).
// Arredondado pra baixo em slots de 15min, o mesmo grão do Cron Trigger
// (wrangler.jsonc), pra sempre existir um "match" exato no dia.
function brtSlotNow(): string {
  const brt = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const h = brt.getUTCHours();
  const m = Math.floor(brt.getUTCMinutes() / 15) * 15;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Encerra automaticamente o caixa de qualquer loja cujo horário configurado
// (stores.caixaAutoCloseTime) bateu com o slot atual. A regra de fechamento
// em si é a MESMA usada pelo botão "Fechamento" manual — closeCaixaSessao()
// em pdv-handler.ts —, só o "quem dispara" muda; nada aqui reimplementa o
// UPDATE. Sem saldoFinal contado (não há operador físico conferindo a
// gaveta num fechamento automático) e sem validar mesas/comandas pendentes,
// pelo mesmo motivo que o fechamento manual hoje também não valida.
export async function runCaixaAutoClose(): Promise<{ slot: string; closed: number }> {
  const db = createDb(process.env.DATABASE_URL!);
  const slot = brtSlotNow();

  const due = await db
    .select({ id: caixaSessoes.id, storeId: caixaSessoes.storeId })
    .from(caixaSessoes)
    .innerJoin(stores, eq(stores.id, caixaSessoes.storeId))
    .where(and(
      eq(caixaSessoes.status, "aberta"),
      eq(stores.caixaAutoCloseEnabled, true),
      eq(stores.caixaAutoCloseTime, slot),
    ));

  let closed = 0;
  for (const row of due) {
    const result = await closeCaixaSessao(db, {
      sessaoId: row.id, storeId: row.storeId,
      encerradoPor: "Sistema (encerramento automático)",
    });
    if (result.ok) closed++;
  }

  return { slot, closed };
}
