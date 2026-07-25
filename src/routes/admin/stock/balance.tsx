import { createFileRoute } from "@tanstack/react-router";
import { SecaoInventario } from "./-sec-inventario";

export const Route = createFileRoute("/admin/stock/balance")({
  component: SecaoInventario,
  head: () => ({ meta: [{ title: "Balanço — ARMAZIX" }] }),
});
