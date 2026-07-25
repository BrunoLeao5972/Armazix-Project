import { createFileRoute } from "@tanstack/react-router";
import { SecaoExtrato } from "./-sec-extrato";

export const Route = createFileRoute("/admin/stock/extract")({
  component: SecaoExtrato,
  head: () => ({ meta: [{ title: "Extrato — ARMAZIX" }] }),
});
