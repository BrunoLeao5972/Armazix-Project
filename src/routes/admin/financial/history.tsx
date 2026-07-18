import { createFileRoute } from "@tanstack/react-router";
import { SecaoHistoricos } from "./-sec-history";

export const Route = createFileRoute("/admin/financial/history")({
  component: SecaoHistoricos,
  head: () => ({ meta: [{ title: "Históricos — ARMAZIX" }] }),
});
