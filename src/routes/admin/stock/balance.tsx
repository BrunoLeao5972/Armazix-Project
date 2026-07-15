import { createFileRoute } from "@tanstack/react-router";
import { SecaoInventario } from "@/routes/admin/stock";

export const Route = createFileRoute("/admin/stock/balance")({
  component: SecaoInventario,
  head: () => ({ meta: [{ title: "Balanço — ARMAZIX" }] }),
});
