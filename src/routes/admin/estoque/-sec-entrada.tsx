import { useEffect, useState } from "react";
import {
  AlertTriangle, ArrowRight, Plus, ArrowUpCircle, Pencil, ChevronDown, X,
  ArrowLeftRight, Loader2, Check, CheckCircle2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";
import SupplierCombobox from "@/components/admin/SupplierCombobox";
import ProductCombobox from "@/components/admin/ProductCombobox";
import { useSectors, SectorSelect, EmptyState, fmtDate, BAIXA_AUTOMATICA, type Movement, type DbMovement } from "./-estoque-shared";

interface EntryItem { productId: string; productName: string; qty: string; cost: string; lot: string; expiry: string; }

const PAYMENT_METHODS = ["Dinheiro", "Boleto", "Pix", "Cartão de crédito", "Cartão de débito", "Transferência", "Cheque"];

// ─── SEÇÃO: ENTRADA ───────────────────────────────────────────────

export function SecaoEntrada() {
  const [showForm, setShowForm] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [alertaBaixa, setAlertaBaixa] = useState<string | null>(null);
  const [items, setItems] = useState<EntryItem[]>([{ productId: "", productName: "", qty: "", cost: "", lot: "", expiry: "" }]);
  const [supplierRecord, setSupplierRecord] = useState<{ id: string; name: string; phone: string | null } | null>(null);
  const [sectorId, setSectorId] = useState("");
  const [nf, setNf] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [obs, setObs] = useState("");
  const [payMethod, setPayMethod] = useState("Boleto");
  const [installments, setInstallments] = useState("1");
  const [dueDate, setDueDate] = useState("");
  const [sendToFinancial, setSendToFinancial] = useState(true);
  const [saved, setSaved] = useState(false);
  const sectors = useSectors();

  const addItem = () => setItems(v => [...v, { productId: "", productName: "", qty: "", cost: "", lot: "", expiry: "" }]);
  const removeItem = (i: number) => setItems(v => v.filter((_, idx) => idx !== i));
  const setItem = (i: number, k: keyof EntryItem, v: string) =>
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [k]: v } : it));
  const setItemProduct = (i: number, p: { id: string; name: string; sku: string | null; stock: number } | null) =>
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, productId: p?.id ?? "", productName: p?.name ?? "" } : it));

  const total = items.reduce((s, it) => s + (parseFloat(it.qty || "0") * parseFloat(it.cost || "0")), 0);
  const parcelValue = installments && parseInt(installments) > 0 ? total / parseInt(installments) : total;

  const resetForm = () => {
    setItems([{ productId: "", productName: "", qty: "", cost: "", lot: "", expiry: "" }]);
    setSupplierRecord(null);
    setSectorId("");
    setNf("");
    setDate(new Date().toISOString().split("T")[0]);
    setObs("");
    setPayMethod("Boleto");
    setInstallments("1");
    setDueDate("");
    setSendToFinancial(true);
    setEditandoId(null);
  };

  const [entradaErrors, setEntradaErrors] = useState<{ supplier?: boolean; sector?: boolean; products?: boolean }>({});
  const [entradaSaving, setEntradaSaving] = useState(false);
  const [entradaApiError, setEntradaApiError] = useState<string | null>(null);

  const handleSave = async () => {
    const errs: { supplier?: boolean; sector?: boolean; products?: boolean } = {};
    if (!supplierRecord)                          errs.supplier = true;
    if (!sectorId && sectors.length > 0)          errs.sector   = true;
    if (items.some(it => !it.productId))          errs.products = true;
    if (Object.keys(errs).length > 0) { setEntradaErrors(errs); return; }
    setEntradaErrors({});
    setEntradaApiError(null);
    setEntradaSaving(true);

    try {
      const payload = {
        sectorId:     sectorId || undefined,
        supplierId:   supplierRecord!.id,
        supplierName: supplierRecord!.name,
        nf:           nf || undefined,
        date,
        obs:          obs || undefined,
        payMethod:    payMethod || undefined,
        installments: parseInt(installments) || 1,
        dueDate:      dueDate || undefined,
        items: items
          .filter(it => it.productId && parseFloat(it.qty) > 0)
          .map(it => ({
            productId:   it.productId,
            productName: it.productName,
            qty:         parseFloat(it.qty),
            cost:        it.cost ? parseFloat(it.cost) : undefined,
            lot:         it.lot  || undefined,
            expiry:      it.expiry || undefined,
          })),
      };

      const res  = await api.post("/api/stock/entry", payload);
      const data = await res.json() as { success?: boolean; error?: string };

      if (res.ok && data.success) {
        setSaved(true);
        setTimeout(() => {
          setSaved(false);
          setShowForm(false);
          resetForm();
        }, 2000);
      } else {
        setEntradaApiError(data.error ?? "Erro ao registrar entrada. Tente novamente.");
      }
    } catch {
      setEntradaApiError("Erro de conexão. Verifique sua internet.");
    } finally {
      setEntradaSaving(false);
    }
  };

  const handleEditar = (entrada: Movement) => {
    // Verifica se a forma de pagamento tem baixa automática
    const formaPagtoMock = "Dinheiro"; // Na prática viria do registro real
    const temBaixaAutomatica = BAIXA_AUTOMATICA.includes(formaPagtoMock);

    if (temBaixaAutomatica) {
      setAlertaBaixa(`Esta entrada foi paga em ${formaPagtoMock} e já foi baixada no financeiro. Para editar, primeiro desfaça a baixa no módulo Financeiro > Contas a Pagar.`);
      return;
    }

    // Carrega dados para edição
    setEditandoId(entrada.id);
    setSupplierRecord(null);
    setObs(entrada.note || "");
    setDate(entrada.date.split(" ")[0].split("/").reverse().join("-"));
    setItems([{ productId: "", productName: entrada.product, qty: String(entrada.qty), cost: "", lot: "", expiry: "" }]);
    setShowForm(true);
  };

  const handleCancelar = () => {
    setShowForm(false);
    resetForm();
  };

  // Lista de últimas entradas
  const [movements, setMovements] = useState<Movement[]>([]);
  useEffect(() => {
    let mounted = true;
    api.get("/api/stock/movements?limit=50")
      .then(r => r.json())
      .then((d: { movements?: DbMovement[] }) => {
        if (!mounted) return;
        setMovements(
          (d.movements ?? [])
            .filter(m => m.type === "ENTRADA")
            .slice(0, 6)
            .map(m => ({
              id:            m.id,
              date:          fmtDate(m.createdAt),
              product:       m.productName,
              type:          "entrada",
              qty:           m.quantity,
              balanceBefore: m.balanceBefore,
              balanceAfter:  m.balanceAfter,
              user:          m.createdByName ?? "—",
              note:          m.origem,
            }))
        );
      })
      .catch(() => { if (mounted) setMovements([]); });
    return () => { mounted = false; };
  }, []);

  const ultimasEntradas = movements;

  if (!showForm) {
    return (
      <div className="space-y-5 w-full">
        {/* Alerta de baixa automática */}
        {alertaBaixa && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 max-w-4xl">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs text-amber-800 leading-relaxed">{alertaBaixa}</p>
              <div className="flex items-center gap-3 mt-2">
                <button onClick={() => setAlertaBaixa(null)} className="text-xs font-semibold text-amber-700 hover:text-amber-900">Entendido</button>
                <a href="/admin/financeiro" className="text-xs font-semibold text-primary hover:text-primary/80 inline-flex items-center gap-1">
                  Ir para a conta <ArrowRight className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Últimas entradas</h3>
          <Button onClick={() => setShowForm(true)} className="rounded-xl gap-2 bg-gradient-primary text-primary-foreground">
            <Plus className="w-4 h-4" /> Adicionar
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {ultimasEntradas.length === 0 ? (
            <div className="md:col-span-2 xl:col-span-3">
              <EmptyState icon={ArrowUpCircle} title="Nenhuma entrada" desc="Clique em 'Adicionar' para registrar uma nova entrada." />
            </div>
          ) : (
            ultimasEntradas.map(m => (
              <Card key={m.id} className="rounded-2xl border-border/50 shadow-soft hover:shadow-ambient transition-all h-full">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
                      <ArrowUpCircle className="w-4.5 h-4.5 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">{m.product}</span>
                        <span className="text-xs bg-emerald-500/15 text-emerald-600 px-2 py-0.5 rounded-full shrink-0">Entrada</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                        <span>{m.date}</span>
                        <span>• {m.user}</span>
                        {m.note && <span className="truncate">• {m.note}</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0 flex flex-col items-end gap-1">
                      <span className="font-bold text-sm text-emerald-600">+{m.qty} un</span>
                      <button onClick={() => handleEditar(m)} className="p-1.5 rounded-lg hover:bg-secondary transition-colors" title="Editar">
                        <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 w-full max-w-6xl">
      <Card className="rounded-2xl border-border/50 shadow-soft">
        <CardHeader className="pb-3"><CardTitle className="text-base">Dados da entrada</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5"><Label className="text-xs font-semibold text-muted-foreground uppercase">Fornecedor</Label>
            <SupplierCombobox value={supplierRecord} onChange={setSupplierRecord} error={entradaErrors.supplier} /></div>
          {sectors.length > 0 && (
            <div className="space-y-1.5">
              <Label className={`text-xs font-semibold uppercase ${entradaErrors.sector ? "text-destructive" : "text-muted-foreground"}`}>Setor de destino *</Label>
              <SectorSelect sectors={sectors} value={sectorId} onChange={setSectorId} required error={entradaErrors.sector} />
            </div>
          )}
          <div className="space-y-1.5"><Label className="text-xs font-semibold text-muted-foreground uppercase">Nº da Nota Fiscal</Label>
            <Input placeholder="Ex: 00123" value={nf} onChange={e => setNf(e.target.value)} className="h-10 rounded-xl" /></div>
          <div className="space-y-1.5"><Label className="text-xs font-semibold text-muted-foreground uppercase">Data de entrada</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-10 rounded-xl" /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label className="text-xs font-semibold text-muted-foreground uppercase">Observações</Label>
            <Input placeholder="Anotações adicionais" value={obs} onChange={e => setObs(e.target.value)} className="h-10 rounded-xl" /></div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/50 shadow-soft">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Produtos</CardTitle>
          <Button size="sm" variant="outline" className="rounded-xl gap-1.5 h-8" onClick={addItem}><Plus className="w-3.5 h-3.5" />Adicionar</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.map((it, i) => (
            <div key={i} className="grid grid-cols-2 sm:grid-cols-[1fr_70px_90px_90px_110px_36px] gap-2 items-start pb-3 sm:pb-0 border-b sm:border-b-0 border-border/40 last:border-b-0">
              <div className="col-span-2 sm:col-span-1">
                <ProductCombobox
                  value={it.productId ? { id: it.productId, name: it.productName, sku: null, stock: 0 } : null}
                  onChange={p => setItemProduct(i, p)}
                  error={entradaErrors.products && !it.productId}
                />
              </div>
              <Input placeholder="Qtd" type="number" value={it.qty} onChange={e => setItem(i, "qty", e.target.value)} className="h-9 rounded-xl text-sm" />
              <Input placeholder="Custo" type="number" value={it.cost} onChange={e => setItem(i, "cost", e.target.value)} className="h-9 rounded-xl text-sm" />
              <Input placeholder="Lote" value={it.lot} onChange={e => setItem(i, "lot", e.target.value)} className="h-9 rounded-xl text-sm" />
              <Input type="date" value={it.expiry} onChange={e => setItem(i, "expiry", e.target.value)} className="h-9 rounded-xl text-sm" />
              <button onClick={() => removeItem(i)} className="col-span-2 sm:col-span-1 h-9 sm:w-9 rounded-xl flex items-center justify-center gap-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                <X className="w-3.5 h-3.5" />
                <span className="text-xs sm:hidden">Remover item</span>
              </button>
            </div>
          ))}
          <div className="flex items-center justify-between pt-3 border-t border-border/40">
            <span className="text-sm text-muted-foreground">Subtotal dos itens</span>
            <span className="font-bold text-lg">R$ {total.toFixed(2).replace(".", ",")}</span>
          </div>
        </CardContent>
      </Card>

      {/* Pagamento */}
      <Card className="rounded-2xl border-border/50 shadow-soft">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Pagamento / Contas a pagar</CardTitle>
            <span className="text-xs bg-amber-500/15 text-amber-600 px-2 py-0.5 rounded-full font-medium">Financeiro</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase">Forma de pagamento</Label>
              <div className="relative">
                <select value={payMethod} onChange={e => setPayMethod(e.target.value)} className="w-full h-10 px-3 pr-8 text-sm rounded-xl border border-input bg-background appearance-none focus:outline-none focus:ring-2 focus:ring-ring">
                  {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase">Parcelas</Label>
              <div className="relative">
                <select value={installments} onChange={e => setInstallments(e.target.value)} className="w-full h-10 px-3 pr-8 text-sm rounded-xl border border-input bg-background appearance-none focus:outline-none focus:ring-2 focus:ring-ring">
                  {["1","2","3","4","5","6","7","8","9","10","11","12"].map(n => <option key={n} value={n}>{n}x</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase">Data de vencimento</Label>
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="h-10 rounded-xl" />
            </div>
          </div>

          {/* Resumo financeiro */}
          <div className="rounded-xl bg-secondary/50 p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total da nota</span>
              <span className="font-semibold">R$ {total.toFixed(2).replace(".", ",")}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Parcelas</span>
              <span className="font-semibold">{installments}x de R$ {parcelValue.toFixed(2).replace(".", ",")}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Forma</span>
              <span className="font-semibold">{payMethod}</span>
            </div>
            {dueDate && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Vencimento 1ª parcela</span>
                <span className="font-semibold">{new Date(dueDate + "T00:00:00").toLocaleDateString("pt-BR")}</span>
              </div>
            )}
          </div>

          {/* Toggle financeiro */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div
              onClick={() => setSendToFinancial(v => !v)}
              className={`relative w-10 h-5.5 rounded-full transition-colors ${sendToFinancial ? "bg-primary" : "bg-secondary border border-border"}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full bg-white shadow transition-transform ${sendToFinancial ? "translate-x-4.5" : ""}`} />
            </div>
            <span className="text-sm">Lançar no financeiro (contas a pagar)</span>
          </label>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <div className="flex gap-3">
          <Button variant="outline" className="rounded-xl gap-2" onClick={handleCancelar}><ArrowLeftRight className="w-4 h-4 rotate-180" />Voltar</Button>
          <Button className="rounded-xl gap-2 bg-gradient-primary text-primary-foreground" onClick={handleSave} disabled={entradaSaving}>
            {entradaSaving
              ? <><Loader2 className="w-4 h-4 animate-spin" />Processando...</>
              : saved
                ? <><Check className="w-4 h-4" />{editandoId ? "Atualizado!" : "Confirmado!"}</>
                : <><CheckCircle2 className="w-4 h-4" />{editandoId ? "Salvar alterações" : "Confirmar entrada"}</>}
          </Button>
        </div>
        {entradaApiError && (
          <p className="text-sm text-destructive bg-destructive/10 rounded-xl px-4 py-2">{entradaApiError}</p>
        )}
      </div>
    </div>
  );
}
