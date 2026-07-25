import { createFileRoute } from "@tanstack/react-router";
import { SecaoDre } from "./-sec-dre";

export const Route = createFileRoute("/admin/financeiro/dre")({
  component: SecaoDre,
  head: () => ({ meta: [{ title: "DRE — ARMAZIX" }] }),
});
