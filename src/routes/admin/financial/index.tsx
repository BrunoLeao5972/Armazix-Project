import { createFileRoute } from "@tanstack/react-router";
import { SecaoDashboard } from "./-sec-dashboard";

export const Route = createFileRoute("/admin/financial/")({
  component: SecaoDashboard,
  head: () => ({ meta: [{ title: "Dashboard Financeiro — ARMAZIX" }] }),
});
