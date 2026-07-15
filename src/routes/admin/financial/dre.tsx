import { createFileRoute } from "@tanstack/react-router";
import { SecaoDre } from "@/routes/admin/financial";

export const Route = createFileRoute("/admin/financial/dre")({
  component: SecaoDre,
  head: () => ({ meta: [{ title: "DRE — ARMAZIX" }] }),
});
