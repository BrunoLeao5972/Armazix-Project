import { createFileRoute } from "@tanstack/react-router";
import { SecaoEntrada } from "./-sec-entrada";

export const Route = createFileRoute("/admin/stock/entries")({
  component: SecaoEntrada,
  head: () => ({ meta: [{ title: "Entradas — ARMAZIX" }] }),
});
