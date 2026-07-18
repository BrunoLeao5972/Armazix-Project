import { createFileRoute } from "@tanstack/react-router";
import { SecaoFluxo } from "./-sec-cashflow";

export const Route = createFileRoute("/admin/financial/cashflow")({
  component: SecaoFluxo,
  head: () => ({ meta: [{ title: "Fluxo de Caixa — ARMAZIX" }] }),
});
