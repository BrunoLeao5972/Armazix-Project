import { createFileRoute } from "@tanstack/react-router";
import { SecaoHistoricos } from "@/routes/admin/financial";

export const Route = createFileRoute("/admin/financial/history")({
  component: SecaoHistoricos,
  head: () => ({ meta: [{ title: "Históricos — ARMAZIX" }] }),
});
