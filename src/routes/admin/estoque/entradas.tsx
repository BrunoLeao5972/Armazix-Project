import { createFileRoute } from "@tanstack/react-router";
import { SecaoEntrada } from "./-sec-entrada";

export const Route = createFileRoute("/admin/estoque/entradas")({
  component: SecaoEntrada,
  head: () => ({ meta: [{ title: "Entradas — ARMAZIX" }] }),
});
