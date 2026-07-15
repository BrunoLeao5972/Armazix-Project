import { createFileRoute } from "@tanstack/react-router";
import { SecaoReceber } from "@/routes/admin/financial";

export const Route = createFileRoute("/admin/financial/receivables")({
  component: SecaoReceber,
  head: () => ({ meta: [{ title: "Contas a Receber — ARMAZIX" }] }),
});
