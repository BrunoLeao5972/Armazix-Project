import { createFileRoute } from "@tanstack/react-router";
import { SecaoCaixaSessoes } from "./-sec-sessions";

export const Route = createFileRoute("/admin/financeiro/sessoes")({
  component: SecaoCaixaSessoes,
  head: () => ({ meta: [{ title: "Sessões de Caixa — ARMAZIX" }] }),
});
