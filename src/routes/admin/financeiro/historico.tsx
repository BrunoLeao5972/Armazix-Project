import { createFileRoute } from "@tanstack/react-router";
import { SecaoHistoricos } from "./-sec-history";

export const Route = createFileRoute("/admin/financeiro/historico")({
  component: SecaoHistoricos,
  head: () => ({ meta: [{ title: "Históricos — ARMAZIX" }] }),
});
