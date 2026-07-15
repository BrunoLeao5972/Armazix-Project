import { createFileRoute } from "@tanstack/react-router";
import { SecaoExtrato } from "@/routes/admin/stock";

export const Route = createFileRoute("/admin/stock/extract")({
  component: SecaoExtrato,
  head: () => ({ meta: [{ title: "Extrato — ARMAZIX" }] }),
});
