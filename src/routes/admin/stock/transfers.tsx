import { createFileRoute } from "@tanstack/react-router";
import { SecaoTransferencias } from "@/routes/admin/stock";

export const Route = createFileRoute("/admin/stock/transfers")({
  component: SecaoTransferencias,
  head: () => ({ meta: [{ title: "Transferências — ARMAZIX" }] }),
});
