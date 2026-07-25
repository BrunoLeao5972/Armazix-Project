import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Loader2, Check, Settings2, RefreshCw, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";
import ProductCombobox from "@/components/admin/ProductCombobox";
import { useSectors, SectorSelect, EmptyState, fmtDate } from "./-estoque-shared";

interface DbAdjustment {
  id: string;
  productId: string | null;
  productName: string;
  balanceBefore: number;
  balanceAfter: number;
  qty: number;
  tipo: string;
  motivo: string | null;
  observations: string | null;
  createdByName: string | null;
  createdAt: string;
}

// ─── SEÇÃO: AJUSTES ───────────────────────────────────────────────
const ADJUST_TYPES = ["Correção", "Perda", "Avaria"] as const;
type AjusteTipo = typeof ADJUST_TYPES[number];

export function SecaoAjustes() {
  const sectors = useSectors();
  const [productRecord, setProductRecord] = useState<{ id: string; name: string; sku: string | null; stock: number } | null>(null);
  const [sectorId, setSectorId]           = useState("");
  const [sectorBalance, setSectorBalance] = useState<number | null>(null);
  const [qty, setQty]     = useState("");
  const [tipo, setTipo]   = useState<AjusteTipo>("Correção");
  const [motivo, setMotivo] = useState("");
  const [obs, setObs]     = useState("");
  const [saved, setSaved]   = useState(false);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [ajusteErrors, setAjusteErrors] = useState<{ product?: boolean; sector?: boolean; qty?: boolean }>({});
  const [adjustments, setAdjustments] = useState<DbAdjustment[]>([]);
  const [loadingAdj, setLoadingAdj]   = useState(false);

  // Busca saldo do setor quando produto + setor estão selecionados
  useEffect(() => {
    if (!productRecord?.id || !sectorId) { setSectorBalance(null); return; }
    api.get(`/api/stock/balances-by-sector?sectorId=${sectorId}&productId=${productRecord.id}`)
      .then(r => r.json())
      .then((d: { balances?: Array<{ quantity: string }> }) => {
        const bal = d.balances?.[0];
        setSectorBalance(bal ? Math.round(Number(bal.quantity)) : 0);
      })
      .catch(() => setSectorBalance(null));
  }, [productRecord?.id, sectorId]);

  // Saldo de referência para o preview: setor (se houver) ou global
  const referenceStock = sectorBalance !== null ? sectorBalance : (productRecord?.stock ?? 0);

  // Semântica muda conforme o tipo
  const isCorrecao = tipo === "Correção";
  const qtyLabel   = isCorrecao ? "Quantidade Real (Física)" : "Quantidade a Subtrair";
  const qtyPlaceholder = isCorrecao
    ? `Saldo real no setor (atual: ${referenceStock})`
    : "Ex: 3";

  // Limpa qty ao trocar de tipo para evitar confusão semântica
  const handleTipoChange = (t: AjusteTipo) => { setTipo(t); setQty(""); setAjusteErrors({}); };
  const handleProductChange = (p: typeof productRecord) => { setProductRecord(p); setSectorBalance(null); setQty(""); };

  // Bloqueia entrada de sinal negativo e notação científica
  const handleQtyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/-/g, "");
    setQty(val);
  };
  const handleQtyKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "-" || e.key === "e" || e.key === "E") e.preventDefault();
  };

  const fetchAdjustments = useCallback(() => {
    setLoadingAdj(true);
    api.get("/api/stock/adjustments?limit=100")
      .then(r => r.json())
      .then((d: { adjustments?: DbAdjustment[] }) => setAdjustments(d.adjustments ?? []))
      .catch(() => {})
      .finally(() => setLoadingAdj(false));
  }, []);

  useEffect(() => { fetchAdjustments(); }, [fetchAdjustments]);

  const handleAjuste = async () => {
    const errs: { product?: boolean; sector?: boolean; qty?: boolean } = {};
    if (!productRecord)                  errs.product = true;
    if (!sectorId && sectors.length > 0) errs.sector  = true;
    const qtyNum = parseInt(qty, 10);
    if (isCorrecao) {
      if (qty === "" || isNaN(qtyNum) || qtyNum < 0) errs.qty = true;
    } else {
      if (!qty || isNaN(qtyNum) || qtyNum <= 0) errs.qty = true;
    }
    if (Object.keys(errs).length > 0) { setAjusteErrors(errs); return; }
    setAjusteErrors({});
    setApiError(null);
    setSaving(true);

    try {
      const res  = await api.post("/api/stock/adjustment", {
        sectorId:     sectorId || undefined,
        productId:    productRecord!.id,
        productName:  productRecord!.name,
        qty:          qtyNum,
        tipo,
        motivo:       motivo || undefined,
        observations: obs    || undefined,
      });
      const data = await res.json() as { success?: boolean; error?: string };

      if (res.ok && data.success) {
        setSaved(true);
        setProductRecord(null); setSectorId(""); setSectorBalance(null);
        setQty(""); setMotivo(""); setObs(""); setTipo("Correção");
        setTimeout(() => setSaved(false), 2500);
        fetchAdjustments();
      } else {
        setApiError(data.error ?? "Erro ao registrar ajuste. Tente novamente.");
      }
    } catch {
      setApiError("Erro de conexão. Verifique sua internet.");
    } finally {
      setSaving(false);
    }
  };

  const qtyNum = parseInt(qty, 10);
  const previewDelta = !isNaN(qtyNum) && qty !== "" && productRecord
    ? isCorrecao
      ? qtyNum - referenceStock
      : -qtyNum
    : null;

  return (
    <div className="space-y-5 max-w-2xl">
      <p className="text-sm text-muted-foreground">Realize ajustes pontuais no estoque. Cada ajuste é registrado automaticamente no extrato.</p>
      <Card className="rounded-2xl border-border/50 shadow-soft">
        <CardHeader className="pb-3"><CardTitle className="text-base">Novo ajuste</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5"><Label className="text-xs font-semibold text-muted-foreground uppercase">Produto</Label>
            <ProductCombobox value={productRecord} onChange={handleProductChange} error={ajusteErrors.product} /></div>
          {sectors.length > 0 && (
            <div className="space-y-1.5">
              <Label className={`text-xs font-semibold uppercase ${ajusteErrors.sector ? "text-destructive" : "text-muted-foreground"}`}>Setor *</Label>
              <SectorSelect sectors={sectors} value={sectorId} onChange={v => { setSectorId(v); setQty(""); }} required error={ajusteErrors.sector} />
              {sectorBalance !== null && (
                <p className="text-[11px] text-muted-foreground">Saldo neste setor: <span className="font-semibold text-foreground">{sectorBalance}</span> un</p>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label className="text-xs font-semibold text-muted-foreground uppercase">Tipo de ajuste</Label>
              <div className="relative">
                <select
                  value={tipo}
                  onChange={e => handleTipoChange(e.target.value as AjusteTipo)}
                  className="w-full h-10 px-3 pr-8 text-sm rounded-xl border border-input bg-background appearance-none focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {ADJUST_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              </div>
              {/* Hint contextual abaixo do tipo */}
              <p className="text-[11px] text-muted-foreground leading-snug pt-0.5">
                {isCorrecao
                  ? "Informa o saldo físico real. O sistema calcula a diferença."
                  : "O valor digitado será subtraído do estoque atual."}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className={`text-xs font-semibold uppercase ${ajusteErrors.qty ? "text-destructive" : "text-muted-foreground"}`}>
                {qtyLabel}
              </Label>
              <div className="relative">
                {!isCorrecao && (
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-destructive pointer-events-none select-none">−</span>
                )}
                <Input
                  type="number"
                  min="0"
                  step="1"
                  placeholder={qtyPlaceholder}
                  value={qty}
                  onChange={handleQtyChange}
                  onKeyDown={handleQtyKeyDown}
                  className={`h-10 rounded-xl ${!isCorrecao ? "pl-6" : ""} ${ajusteErrors.qty ? "border-destructive" : ""}`}
                />
              </div>
              {/* Preview do resultado */}
              {previewDelta !== null && (
                <p className={`text-[11px] font-medium leading-snug pt-0.5 ${previewDelta > 0 ? "text-emerald-600" : previewDelta < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                  {isCorrecao
                    ? previewDelta > 0
                      ? `↑ Acréscimo de ${previewDelta} un (${referenceStock} → ${qtyNum})`
                      : previewDelta < 0
                        ? `↓ Redução de ${Math.abs(previewDelta)} un (${referenceStock} → ${qtyNum})`
                        : "Saldo igual ao atual, nenhuma alteração."
                    : `↓ Subtração de ${qtyNum} un (${referenceStock} → ${Math.max(0, referenceStock - qtyNum)})`
                  }
                </p>
              )}
            </div>
          </div>
          <div className="space-y-1.5"><Label className="text-xs font-semibold text-muted-foreground uppercase">Motivo</Label>
            <Input placeholder="Descreva o motivo" value={motivo} onChange={e => setMotivo(e.target.value)} className="h-10 rounded-xl" /></div>
          <div className="space-y-1.5"><Label className="text-xs font-semibold text-muted-foreground uppercase">Observação</Label>
            <Input placeholder="Detalhes adicionais" value={obs} onChange={e => setObs(e.target.value)} className="h-10 rounded-xl" /></div>
        </CardContent>
      </Card>
      <div className="space-y-2">
        <Button className="rounded-xl gap-2 bg-gradient-primary text-primary-foreground" onClick={handleAjuste} disabled={saving}>
          {saving
            ? <><Loader2 className="w-4 h-4 animate-spin" />Processando...</>
            : saved
              ? <><Check className="w-4 h-4" />Ajuste registrado!</>
              : <><Settings2 className="w-4 h-4" />Registrar ajuste</>}
        </Button>
        {apiError && (
          <p className="text-sm text-destructive bg-destructive/10 rounded-xl px-4 py-2">{apiError}</p>
        )}
      </div>

      {/* Histórico de ajustes */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Histórico de ajustes</h3>
          <button onClick={fetchAdjustments} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            <RefreshCw className="w-3 h-3" />Atualizar
          </button>
        </div>
        {loadingAdj ? (
          <div className="flex items-center gap-2 py-8 justify-center text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />Carregando...
          </div>
        ) : adjustments.length === 0 ? (
          <EmptyState icon={Settings2} title="Nenhum ajuste" desc="Os ajustes manuais registrados aparecerão aqui." />
        ) : (
          <div className="relative pl-6 space-y-0 before:absolute before:left-[9px] before:top-2 before:bottom-2 before:w-px before:bg-border/60">
            {adjustments.map(a => {
              const isPositive = a.qty > 0;
              return (
                <div key={a.id} className="relative pb-4">
                  <div className={`absolute -left-[19px] w-4 h-4 rounded-full ${isPositive ? "bg-emerald-500/15" : "bg-destructive/15"} border-2 border-background flex items-center justify-center`}>
                    <Settings2 className={`w-2 h-2 ${isPositive ? "text-emerald-600" : "text-destructive"}`} />
                  </div>
                  <div className="pl-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{a.productName}</span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-violet-500/15 text-violet-600">{a.tipo}</span>
                      <span className={`text-sm font-bold ${isPositive ? "text-emerald-600" : "text-destructive"}`}>
                        {isPositive ? "+" : ""}{a.qty} un
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{fmtDate(a.createdAt)}</span>
                      {a.createdByName && <span>Por {a.createdByName}</span>}
                      {a.motivo && <span>{a.motivo}</span>}
                      <span>Saldo: {a.balanceBefore} → {a.balanceAfter}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
