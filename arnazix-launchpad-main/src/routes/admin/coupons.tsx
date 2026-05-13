import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Ticket, Plus, MoreHorizontal, Calendar, Percent } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/admin/coupons")({
  component: CouponsPage,
  head: () => ({
    meta: [{ title: "Cupons — ARMAZIX" }],
  }),
});

const COUPONS = [
  { id: 1, code: "PROMO10", discount: "10%", type: "percent", uses: 45, maxUses: 100, expires: "30/Mai/2025", status: "active" },
  { id: 2, code: "FRETE0", discount: "Frete grátis", type: "shipping", uses: 28, maxUses: 50, expires: "15/Mai/2025", status: "active" },
  { id: 3, code: "NATAL20", discount: "20%", type: "percent", uses: 120, maxUses: 200, expires: "25/Dez/2025", status: "active" },
  { id: 4, code: "CLIENTE5", discount: "R$ 5,00", type: "fixed", uses: 10, maxUses: 50, expires: "01/Jun/2025", status: "active" },
  { id: 5, code: "ABERTURA", discount: "15%", type: "percent", uses: 80, maxUses: 80, expires: "01/Mai/2025", status: "expired" },
];

const statusConfig: Record<string, { label: string; color: string }> = {
  active: { label: "Ativo", color: "bg-primary/15 text-primary" },
  expired: { label: "Expirado", color: "bg-destructive/15 text-destructive" },
};

function CouponsPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" as const }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cupons</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie descontos e promoções</p>
        </div>
        <Button className="h-10 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow gap-2">
          <Plus className="w-4 h-4" />
          Novo cupom
        </Button>
      </div>

      <div className="space-y-3">
        {COUPONS.map((coupon, i) => (
          <motion.div
            key={coupon.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.3 }}
          >
            <Card className="rounded-2xl border-border/50 shadow-soft hover:shadow-ambient transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="grid place-items-center w-10 h-10 rounded-xl bg-primary/15">
                      <Ticket className="w-5 h-5 text-primary" />
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold font-mono">{coupon.code}</span>
                        <Badge variant="secondary" className={`rounded-full text-[11px] ${statusConfig[coupon.status]?.color}`}>
                          {statusConfig[coupon.status]?.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <Percent className="w-3 h-3" />
                          {coupon.discount}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Até {coupon.expires}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-sm font-semibold">{coupon.uses}/{coupon.maxUses}</div>
                      <div className="text-xs text-muted-foreground">usos</div>
                    </div>
                    <div className="h-2 w-16 rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${(coupon.uses / coupon.maxUses) * 100}%` }}
                      />
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-xl">
                        <DropdownMenuItem className="rounded-lg">Editar</DropdownMenuItem>
                        <DropdownMenuItem className="rounded-lg text-destructive">Desativar</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
