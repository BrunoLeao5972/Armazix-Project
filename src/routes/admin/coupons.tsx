import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "@/lib/api-client";
import { Ticket, Plus, MoreHorizontal, Calendar, Percent, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/coupons")({
  component: CouponsPage,
  head: () => ({
    meta: [{ title: "Cupons — ARMAZIX" }],
  }),
});

const statusConfig: Record<string, { label: string; color: string }> = {
  active: { label: "Ativo", color: "bg-primary/15 text-primary" },
  expired: { label: "Expirado", color: "bg-destructive/15 text-destructive" },
};

interface Coupon {
  id: string;
  code: string;
  type: string;
  discount: string;
  uses: number;
  maxUses: number;
  expires: string;
  status: string;
}

function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newType, setNewType] = useState("percent");
  const [newDiscount, setNewDiscount] = useState("");
  const [newMaxUses, setNewMaxUses] = useState("");
  const [newExpires, setNewExpires] = useState("");
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    const storeId = localStorage.getItem("storeId");
    if (!storeId) {
      setLoading(false);
      setError("Loja não encontrada");
      return;
    }
    fetchCoupons(storeId);
  }, []);

  const fetchCoupons = async (storeId: string) => {
    try {
      const res = await fetch(`/api/coupons/list?storeId=${storeId}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao carregar dados");
        return;
      }
      setCoupons(data.coupons || []);
    } catch {
      setError("Erro de conexão");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCoupon = async () => {
    if (!newCode || !newDiscount) return;
    const storeId = localStorage.getItem("storeId");
    if (!storeId) return;
    setCreating(true);
    try {
      const res = await api.post("/api/coupons/create", {
        storeId,
        code: newCode,
        type: newType,
        discount: newDiscount,
        maxUses: newMaxUses ? Number(newMaxUses) : undefined,
        expiresAt: newExpires || undefined,
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const c = data.coupon;
        setCoupons(prev => [...prev, {
          id: c.id,
          code: c.code,
          type: c.type,
          discount: c.type === "percent" ? `${c.discount}%` : `R$ ${parseFloat(c.discount).toFixed(2).replace(".", ",")}`,
          uses: 0,
          maxUses: c.maxUses || 0,
          expires: c.expiresAt ? new Date(c.expiresAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "Sem prazo",
          status: "active",
        }]);
        setNewCode(""); setNewDiscount(""); setNewMaxUses(""); setNewExpires("");
        setDialogOpen(false);
      }
    } catch {} finally { setCreating(false); }
  };

  if (loading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">{error}</p>
          <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cupons</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie descontos e promoções</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="h-10 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow gap-2">
              <Plus className="w-4 h-4" />
              Novo cupom
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-2xl max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">Novo cupom</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label>Código</Label>
                <Input placeholder="PROMO10" value={newCode} onChange={e => setNewCode(e.target.value.toUpperCase())} className="h-11 rounded-xl font-mono" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <select value={newType} onChange={e => setNewType(e.target.value)} className="w-full h-11 rounded-xl border bg-background px-3 text-sm">
                    <option value="percent">Percentual (%)</option>
                    <option value="fixed">Fixo (R$)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Desconto</Label>
                  <Input placeholder={newType === "percent" ? "10" : "5.00"} value={newDiscount} onChange={e => setNewDiscount(e.target.value)} className="h-11 rounded-xl" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Usos máximos</Label>
                  <Input placeholder="100" type="number" value={newMaxUses} onChange={e => setNewMaxUses(e.target.value)} className="h-11 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label>Validade</Label>
                  <Input type="date" value={newExpires} onChange={e => setNewExpires(e.target.value)} className="h-11 rounded-xl" />
                </div>
              </div>
              <Button onClick={handleCreateCoupon} disabled={creating || !newCode || !newDiscount} className="w-full h-11 rounded-xl bg-gradient-primary text-primary-foreground font-semibold">
                {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : "Criar cupom"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {coupons.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Nenhum cupom cadastrado</div>
      ) : (
      <div className="space-y-3">
        {coupons.map((coupon) => (
          <Card key={coupon.id} className="rounded-2xl border-border/50 shadow-soft hover:shadow-ambient transition-shadow">
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
                  {coupon.maxUses > 0 && (
                    <>
                      <div className="text-right">
                        <div className="text-sm font-semibold">{coupon.uses}/{coupon.maxUses}</div>
                        <div className="text-xs text-muted-foreground">usos</div>
                      </div>
                      <div className="h-2 w-16 rounded-full bg-secondary overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${Math.min((coupon.uses / coupon.maxUses) * 100, 100)}%` }}
                        />
                      </div>
                    </>
                  )}
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
        ))}
      </div>
      )}
    </div>
  );
}
