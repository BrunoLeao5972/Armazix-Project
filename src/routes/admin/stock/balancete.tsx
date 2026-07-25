import { createFileRoute } from "@tanstack/react-router";
import { SecaoBalanco } from "./-sec-balanco";

export const Route = createFileRoute("/admin/stock/balancete")({
  component: SecaoBalanco,
  head: () => ({ meta: [{ title: "Balancete — ARMAZIX" }] }),
});
