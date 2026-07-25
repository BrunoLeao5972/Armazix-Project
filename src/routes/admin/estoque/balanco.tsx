import { createFileRoute } from "@tanstack/react-router";
import { SecaoInventario } from "./-sec-inventario";

export const Route = createFileRoute("/admin/estoque/balanco")({
  component: SecaoInventario,
  head: () => ({ meta: [{ title: "Balanço — ARMAZIX" }] }),
});
