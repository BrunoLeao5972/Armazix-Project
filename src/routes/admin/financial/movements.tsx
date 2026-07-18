import { createFileRoute } from "@tanstack/react-router";
import { SecaoMovimentacoes } from "./-sec-movements";

export const Route = createFileRoute("/admin/financial/movements")({
  component: SecaoMovimentacoes,
  head: () => ({ meta: [{ title: "Movimentações — ARMAZIX" }] }),
});
