import { createFileRoute } from "@tanstack/react-router";
import { SecaoVendas } from "./-sec-vendas";

export const Route = createFileRoute("/admin/financeiro/vendas")({
  component: SecaoVendas,
  head: () => ({ meta: [{ title: "Vendas — ARMAZIX" }] }),
});
