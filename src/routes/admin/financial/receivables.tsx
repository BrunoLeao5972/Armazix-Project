import { createFileRoute } from "@tanstack/react-router";
import { SecaoReceber } from "./-sec-receivables";

export const Route = createFileRoute("/admin/financial/receivables")({
  component: SecaoReceber,
  head: () => ({ meta: [{ title: "Contas a Receber — ARMAZIX" }] }),
});
