import { createFileRoute } from "@tanstack/react-router";
import { SecaoTransferencias } from "./-sec-transferencias";

export const Route = createFileRoute("/admin/stock/transfers")({
  component: SecaoTransferencias,
  head: () => ({ meta: [{ title: "Transferências — ARMAZIX" }] }),
});
