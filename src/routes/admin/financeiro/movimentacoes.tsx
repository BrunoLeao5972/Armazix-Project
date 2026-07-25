import { createFileRoute } from "@tanstack/react-router";
import { SecaoMovimentacoes } from "./-sec-movements";

export const Route = createFileRoute("/admin/financeiro/movimentacoes")({
  component: SecaoMovimentacoes,
  head: () => ({ meta: [{ title: "Movimentações — ARMAZIX" }] }),
});
