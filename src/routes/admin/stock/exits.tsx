import { createFileRoute } from "@tanstack/react-router";
import { SecaoSaida } from "./-sec-saida";

export const Route = createFileRoute("/admin/stock/exits")({
  component: SecaoSaida,
  head: () => ({ meta: [{ title: "Saídas — ARMAZIX" }] }),
});
