import { createFileRoute } from "@tanstack/react-router";
import { SecaoAjustes } from "./-sec-ajustes";

export const Route = createFileRoute("/admin/estoque/ajustes")({
  component: SecaoAjustes,
  head: () => ({ meta: [{ title: "Ajustes — ARMAZIX" }] }),
});
