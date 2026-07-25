import { createFileRoute } from "@tanstack/react-router";
import { SecaoEstoque } from "./-sec-estoque";

export const Route = createFileRoute("/admin/estoque/")({
  component: SecaoEstoque,
  head: () => ({ meta: [{ title: "Inventário — ARMAZIX" }] }),
});
