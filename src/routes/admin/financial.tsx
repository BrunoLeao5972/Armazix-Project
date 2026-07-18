import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/financial")({
  component: FinancialPage,
  head: () => ({ meta: [{ title: "Financeiro — ARMAZIX" }] }),
});

function FinancialPage() {
  return <Outlet />;
}
