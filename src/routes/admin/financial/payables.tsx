import { createFileRoute } from "@tanstack/react-router";
import { SecaoPagar } from "./-sec-payables";

export const Route = createFileRoute("/admin/financial/payables")({
  component: SecaoPagar,
  head: () => ({ meta: [{ title: "Contas a Pagar — ARMAZIX" }] }),
});
