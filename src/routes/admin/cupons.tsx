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

export const Route = createFileRoute("/admin/cupons")({
  component: CouponsPage,
  head: () => ({
    meta: [{ title: "Cupons — ARMAZIX" }],
  }),
});

const statusConfig: Record<string, { label: string; color: string }> = {
  active: { label: "Ativo", color: "bg-primary/15 text-primary" },
  scheduled: { label: "Agendado", color: "bg-amber-500/15 text-amber-600" },
  expired: { label: "Expirado", color: "bg-destructive/15 text-destructive" },
};

interface Coupon {
  id: string;
  code: string;
  type: string;
  discount: string;
  uses: number;
  maxUses: number;
  starts: string | null;
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
  const [newValidFromDate, setNewValidFromDate] = useState("");
  const [newValidFromTime, setNewValidFromTime] = useState("");
  const [newExpiresDate, setNewExpiresDate] = useState("");
  const [newExpiresTime, setNewExpiresTime] = useState("");
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formError, setFormError] = useState("");

  // Combina data + hora num datetime local (hora vazia vira início/fim do dia).
  const combineDateTime = (date: string, time: string, endOfDay: boolean): string | undefined => {
    if (!date) return undefined;
    return `${date}T${time || (endOfDay ? "23:59" : "00:00")}:00`;
  };

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

  const fmtDateTime = (iso: string) =>
    new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const handleCreateCoupon = async () => {
    if (!newCode || !newDiscount) return;
    const storeId = localStorage.getItem("storeId");
    if (!storeId) return;
    setFormError("");

    const validFrom = combineDateTime(newValidFromDate, newValidFromTime, false);
    const expiresAt = combineDateTime(newExpiresDate, newExpiresTime, true);
    if (validFrom && expiresAt && new Date(validFrom) >= new Date(expiresAt)) {
      setFormError('A data "De" precisa ser antes da data "Até"');
      return;
    }

    setCreating(true);
    try {
      const res = await api.post("/api/coupons/create", {
        storeId,
        code: newCode,
        type: newType,
        discount: newDiscount,
        maxUses: newMaxUses ? Number(newMaxUses) : undefined,
        validFrom,
        expiresAt,
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const c = data.coupon;
        const now = new Date();
        const isScheduled = c.validFrom && new Date(c.validFrom) > now;
        setCoupons(prev => [...prev, {
          id: c.id,
          code: c.code,
          type: c.type,
          discount: c.type === "percent" ? `${c.discount}%` : `R$ ${parseFloat(c.discount).toFixed(2).replace(".", ",")}`,
          uses: 0,
          maxUses: c.maxUses || 0,
          starts: c.validFrom ? fmtDateTime(c.validFrom) : null,
          expires: c.expiresAt ? fmtDateTime(c.expiresAt) : "Sem prazo",
          status: isScheduled ? "scheduled" : "active",
        }]);
        setNewCode(""); setNewDiscount(""); setNewMaxUses("");
        setNewValidFromDate(""); setNewValidFromTime(""); setNewExpiresDate(""); setNewExpiresTime("");
        setDialogOpen(false);
      } else {
        setFormError(data.error || "Erro ao criar cupom");
      }
    } catch { setFormError("Erro de conexão"); } finally { setCreating(false); }
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
        <Dialog open={dialogOpen} onOpenChange={open => { setDialogOpen(open); if (open) setFormError(""); }}>
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
              <div className="space-y-2">
                <Label>Usos máximos</Label>
                <Input placeholder="100" type="number" value={newMaxUses} onChange={e => setNewMaxUses(e.target.value)} className="h-11 rounded-xl" />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  Validade
                  <span className="text-xs font-normal text-muted-foreground">(opcional — deixe em branco pra não restringir)</span>
                </Label>
                <div className="space-y-2">
                  <div className="space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground">De</span>
                    <div className="flex gap-2">
                      <Input type="date" value={newValidFromDate} onChange={e => setNewValidFromDate(e.target.value)} className="h-11 rounded-xl flex-1 min-w-0" />
                      <Input type="time" value={newValidFromTime} onChange={e => setNewValidFromTime(e.target.value)} className="h-11 rounded-xl w-28 shrink-0" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground">Até</span>
                    <div className="flex gap-2">
                      <Input type="date" value={newExpiresDate} onChange={e => setNewExpiresDate(e.target.value)} className="h-11 rounded-xl flex-1 min-w-0" />
                      <Input type="time" value={newExpiresTime} onChange={e => setNewExpiresTime(e.target.value)} className="h-11 rounded-xl w-28 shrink-0" />
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">Sem hora informada, considera início/fim do dia.</p>
              </div>

              {formError && (
                <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">{formError}</p>
              )}

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
                      {coupon.starts && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          De {coupon.starts}
                        </span>
                      )}
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
