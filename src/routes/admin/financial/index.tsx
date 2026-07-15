import { createFileRoute } from "@tanstack/react-router";
import { SecaoDashboard } from "@/routes/admin/financial";

export const Route = createFileRoute("/admin/financial/")({
  component: SecaoDashboard,
  head: () => ({ meta: [{ title: "Dashboard Financeiro — ARMAZIX" }] }),
});
