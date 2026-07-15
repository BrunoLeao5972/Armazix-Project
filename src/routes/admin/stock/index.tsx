import { createFileRoute } from "@tanstack/react-router";
import { SecaoEstoque } from "@/routes/admin/stock";

export const Route = createFileRoute("/admin/stock/")({
  component: SecaoEstoque,
  head: () => ({ meta: [{ title: "Inventário — ARMAZIX" }] }),
});
