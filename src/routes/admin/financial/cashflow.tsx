import { createFileRoute } from "@tanstack/react-router";
import { SecaoFluxo } from "@/routes/admin/financial";

export const Route = createFileRoute("/admin/financial/cashflow")({
  component: SecaoFluxo,
  head: () => ({ meta: [{ title: "Fluxo de Caixa — ARMAZIX" }] }),
});
