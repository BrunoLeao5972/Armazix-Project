import { createFileRoute } from "@tanstack/react-router";
import { SecaoBalanco } from "@/routes/admin/stock";

export const Route = createFileRoute("/admin/stock/balancete")({
  component: SecaoBalanco,
  head: () => ({ meta: [{ title: "Balancete — ARMAZIX" }] }),
});
