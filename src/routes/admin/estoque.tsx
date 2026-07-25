import { createFileRoute, Outlet } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/estoque")({
  component: StockPage,
  head: () => ({
    meta: [{ title: "Estoque — ARMAZIX" }],
  }),
});

function StockPage() {
  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Estoque</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Central de controle de estoque e movimentações</p>
        </div>
        <Button variant="outline" size="sm" className="rounded-xl h-9 gap-1.5" onClick={() => window.location.reload()}>
          <RefreshCw className="w-3.5 h-3.5" />Atualizar
        </Button>
      </div>
      <Outlet />
    </div>
  );
}
