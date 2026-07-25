import { createFileRoute } from "@tanstack/react-router";
import { SecaoHistorico } from "./-sec-historico";

export const Route = createFileRoute("/admin/stock/history")({
  component: SecaoHistorico,
  head: () => ({ meta: [{ title: "Histórico — ARMAZIX" }] }),
});
