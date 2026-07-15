import { createFileRoute } from "@tanstack/react-router";
import { SecaoSaida } from "@/routes/admin/stock";

export const Route = createFileRoute("/admin/stock/exits")({
  component: SecaoSaida,
  head: () => ({ meta: [{ title: "Saídas — ARMAZIX" }] }),
});
