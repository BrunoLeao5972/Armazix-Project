import { createFileRoute } from "@tanstack/react-router";
import { SecaoAjustes } from "@/routes/admin/stock";

export const Route = createFileRoute("/admin/stock/adjustments")({
  component: SecaoAjustes,
  head: () => ({ meta: [{ title: "Ajustes — ARMAZIX" }] }),
});
