import { useState } from "react";
import { ArrowLeftRight, ArrowRight, Plus, X, Loader2, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";
import ProductCombobox from "@/components/admin/ProductCombobox";
import { useSectors, SectorSelect, EmptyState } from "./-stock-shared";

// ─── SEÇÃO: TRANSFERÊNCIAS ────────────────────────────────────────
interface TransferProductItem { productId: string; productName: string; qty: string }

export function SecaoTransferencias() {
  const sectors = useSectors();
  const [sourceSectorId,      setSourceSectorId]      = useState("");
  const [destinationSectorId, setDestinationSectorId] = useState("");
  const [obs,    setObs]    = useState("");
  const [items,  setItems]  = useState<TransferProductItem[]>([{ productId: "", productName: "", qty: "" }]);
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [errors, setErrors]    = useState<{ source?: boolean; destination?: boolean; products?: boolean }>({});

  const addItem    = () => setItems(v => [...v, { productId: "", productName: "", qty: "" }]);
  const removeItem = (i: number) => setItems(v => v.filter((_, idx) => idx !== i));
  const setItemProduct = (i: number, p: { id: string; name: string; sku: string | null; stock: number } | null) =>
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, productId: p?.id ?? "", productName: p?.name ?? "" } : it));
  const setItemQty = (i: number, v: string) =>
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, qty: v } : it));

  const resetForm = () => {
    setSourceSectorId(""); setDestinationSectorId(""); setObs("");
    setItems([{ productId: "", productName: "", qty: "" }]);
    setErrors({});
  };

  const handleTransfer = async () => {
    const validItems = items.filter(it => it.productId && parseFloat(it.qty) > 0);
    const errs: typeof errors = {};
    if (!sourceSectorId)                             errs.source      = true;
    if (!destinationSectorId)                        errs.destination = true;
    if (validItems.length === 0)                     errs.products    = true;
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    if (sourceSectorId === destinationSectorId) {
      setApiError("Setor de origem e destino devem ser diferentes");
      return;
    }
    setErrors({});
    setApiError(null);
    setSaving(true);

    try {
      const res  = await api.post("/api/stock/transfer", {
        sourceSectorId,
        destinationSectorId,
        obs: obs || undefined,
        items: validItems.map(it => ({
          productId:   it.productId,
          productName: it.productName,
          qty:         parseFloat(it.qty),
        })),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (res.ok && data.success) {
        setSaved(true);
        setTimeout(() => { setSaved(false); resetForm(); }, 2200);
      } else {
        setApiError(data.error ?? "Erro ao registrar transferência.");
      }
    } catch {
      setApiError("Erro de conexão.");
    } finally {
      setSaving(false);
    }
  };

  if (sectors.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
        <EmptyState
          icon={ArrowLeftRight}
          title="Nenhum setor cadastrado"
          desc="Cadastre ao menos dois setores em Configurações → Setores para habilitar transferências."
        />
      </div>
    );
  }

  return (
    <div className="space-y-5 w-full max-w-3xl">
      <p className="text-sm text-muted-foreground">Mova itens de um setor para outro. A quantidade sai do setor de origem e entra no setor de destino.</p>

      {/* Setores */}
      <Card className="rounded-2xl border-border/50 shadow-soft">
        <CardHeader className="pb-3"><CardTitle className="text-base">Setores</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-3 items-center">
          <div className="space-y-1.5">
            <Label className={`text-xs font-semibold uppercase ${errors.source ? "text-destructive" : "text-muted-foreground"}`}>Setor de origem *</Label>
            <SectorSelect sectors={sectors} value={sourceSectorId} onChange={setSourceSectorId} required error={errors.source} placeholder="Selecione origem..." />
          </div>
          <div className="hidden sm:flex items-center justify-center mt-5">
            <div className="w-8 h-8 rounded-full bg-amber-500/15 flex items-center justify-center">
              <ArrowRight className="w-4 h-4 text-amber-600" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className={`text-xs font-semibold uppercase ${errors.destination ? "text-destructive" : "text-muted-foreground"}`}>Setor de destino *</Label>
            <SectorSelect sectors={sectors} value={destinationSectorId} onChange={setDestinationSectorId} required error={errors.destination} placeholder="Selecione destino..." />
          </div>
        </CardContent>
      </Card>

      {/* Produtos */}
      <Card className="rounded-2xl border-border/50 shadow-soft">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Produtos a transferir</CardTitle>
          <Button size="sm" variant="outline" className="rounded-xl gap-1.5 h-8" onClick={addItem}><Plus className="w-3.5 h-3.5" />Adicionar</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.map((it, i) => (
            <div key={i} className="grid grid-cols-[1fr_36px] sm:grid-cols-[1fr_100px_36px] gap-2 items-start pb-3 sm:pb-0 border-b sm:border-b-0 border-border/40 last:border-b-0">
              <div className="col-span-2 sm:col-span-1">
                <ProductCombobox
                  value={it.productId ? { id: it.productId, name: it.productName, sku: null, stock: 0 } : null}
                  onChange={p => setItemProduct(i, p)}
                  error={errors.products && !it.productId}
                />
              </div>
              <Input placeholder="Qtd" type="number" min="0.001" step="any" value={it.qty} onChange={e => setItemQty(i, e.target.value)} className="h-9 rounded-xl text-sm" />
              <button onClick={() => removeItem(i)} className="h-9 w-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <div className="pt-2">
            <div className="space-y-1.5"><Label className="text-xs font-semibold text-muted-foreground uppercase">Observação</Label>
              <Input placeholder="Motivo da transferência..." value={obs} onChange={e => setObs(e.target.value)} className="h-10 rounded-xl" /></div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <Button className="rounded-xl gap-2 bg-gradient-primary text-primary-foreground" onClick={handleTransfer} disabled={saving}>
          {saving
            ? <><Loader2 className="w-4 h-4 animate-spin" />Processando...</>
            : saved
              ? <><Check className="w-4 h-4" />Transferido!</>
              : <><ArrowLeftRight className="w-4 h-4" />Confirmar transferência</>}
        </Button>
        {apiError && <p className="text-sm text-destructive bg-destructive/10 rounded-xl px-4 py-2">{apiError}</p>}
      </div>
    </div>
  );
}
