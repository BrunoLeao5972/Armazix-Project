import { createFileRoute } from "@tanstack/react-router";
import { SecaoConfiguracoesGerais } from "./-sec-gerais";

export const Route = createFileRoute("/admin/financial/settings")({
  component: SecaoConfiguracoesGerais,
  head: () => ({ meta: [{ title: "Gerais — ARMAZIX" }] }),
});
