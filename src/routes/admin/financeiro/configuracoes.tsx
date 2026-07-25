import { createFileRoute } from "@tanstack/react-router";
import { SecaoConfiguracoesGerais } from "./-sec-gerais";

export const Route = createFileRoute("/admin/financeiro/configuracoes")({
  component: SecaoConfiguracoesGerais,
  head: () => ({ meta: [{ title: "Gerais — ARMAZIX" }] }),
});
