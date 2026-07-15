import { createFileRoute } from "@tanstack/react-router";
import { SecaoCaixaSessoes } from "@/routes/admin/financial";

export const Route = createFileRoute("/admin/financial/sessions")({
  component: SecaoCaixaSessoes,
  head: () => ({ meta: [{ title: "Sessões de Caixa — ARMAZIX" }] }),
});
