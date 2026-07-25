import { createFileRoute } from "@tanstack/react-router";
import { SecaoFluxo } from "./-sec-cashflow";

export const Route = createFileRoute("/admin/financeiro/fluxo-caixa")({
  component: SecaoFluxo,
  head: () => ({ meta: [{ title: "Fluxo de Caixa — ARMAZIX" }] }),
});
