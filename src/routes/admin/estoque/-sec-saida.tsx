import { useEffect, useState } from "react";
import {
  AlertTriangle, ArrowRight, Plus, ArrowDownCircle, Pencil, ChevronDown, X,
  ArrowLeftRight, Loader2, Check,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";
import ProductCombobox from "@/components/admin/ProductCombobox";
import { useSectors, SectorSelect, EmptyState, fmtDate, dbTypeToKey, BAIXA_AUTOMATICA, type Movement, type DbMovement } from "./-estoque-shared";

interface ExitItem { productId: string; productName: string; qty: string; }

// ─── SEÇÃO: SAÍDA ─────────────────────────────────────────────────
const EXIT_TYPES = ["Venda", "Perda", "Uso interno", "Troca", "Avaria"];

export function SecaoSaida() {
  const [showForm, setShowForm] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [alertaBaixa, setAlertaBaixa] = useState<string | null>(null);
  const [items, setItems] = useState<ExitItem[]>([{ productId: "", productName: "", qty: "" }]);
  const [tipo, setTipo] = useState("Venda");
  const [sectorId, setSectorId] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [obs, setObs] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [saidaErrors, setSaidaErrors] = useState<{ sector?: boolean; products?: boolean }>({});
  const sectors = useSectors();

  const addItem = () => setItems(v => [...v, { productId: "", productName: "", qty: "" }]);
  const removeItem = (i: number) => setItems(v => v.filter((_, idx) => idx !== i));
  const setItem = (i: number, k: keyof ExitItem, v: string) =>
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [k]: v } : it));
  const setItemProduct = (i: number, p: { id: string; name: string; sku: string | null; stock: number } | null) =>
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, productId: p?.id ?? "", productName: p?.name ?? "" } : it));

  const resetForm = () => {
    setItems([{ productId: "", productName: "", qty: "" }]);
    setTipo("Venda");
    setSectorId("");
    setResponsavel("");
    setObs("");
    setEditandoId(null);
  };

  const EXIT_TYPE_MAP: Record<string, string> = {
    Venda: "SAIDA", Perda: "PERDA", "Uso interno": "SAIDA", Troca: "SAIDA", Avaria: "AVARIA",
  };

  const handleSave = async () => {
    const validItems = items.filter(it => it.productId && parseFloat(it.qty) > 0);
    const errs: { sector?: boolean; products?: boolean } = {};
    if (validItems.length === 0)          errs.products = true;
    if (!sectorId && sectors.length > 0)  errs.sector   = true;
    if (Object.keys(errs).length > 0) { setSaidaErrors(errs); return; }
    setSaidaErrors({});
    setApiError(null);
    setSaving(true);
    try {
      const res = await api.post("/api/stock/exit", {
        sectorId:    sectorId || undefined,
        tipo:        EXIT_TYPE_MAP[tipo] ?? "SAIDA",
        responsavel: responsavel || undefined,
        obs:         obs || undefined,
        items:       validItems.map(it => ({
          productId:   it.productId,
          productName: it.productName,
          qty:         parseFloat(it.qty),
        })),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (res.ok && data.success) {
        setSaved(true);
        setTimeout(() => { setSaved(false); setShowForm(false); resetForm(); }, 2000);
      } else {
        setApiError(data.error ?? "Erro ao registrar saída. Tente novamente.");
      }
    } catch {
      setApiError("Erro de conexão. Verifique sua internet.");
    } finally {
      setSaving(false);
    }
  };

  // Movimentações sem contrapartida financeira: imutáveis após criação.
  // Apenas saídas de venda/uso/troca (type "saida") podem ter edição.
  const isFinancialExit = (m: Movement) => m.type === "saida";

  const handleEditar = (saida: Movement) => {
    // Guard: ajustes de inventário (perda/avaria/ajuste) não têm registro financeiro
    // associado e são imutáveis para garantir a trilha de auditoria.
    if (!isFinancialExit(saida)) return;

    // Verifica se a forma de pagamento tem baixa automática (vendas em dinheiro/pix)
    const formaPagtoMock = "Dinheiro"; // Na prática viria do registro real
    const temBaixaAutomatica = BAIXA_AUTOMATICA.includes(formaPagtoMock);

    if (temBaixaAutomatica) {
      setAlertaBaixa(`Esta saída foi recebida em ${formaPagtoMock} e já foi baixada no financeiro (Contas a Receber). Para editar, primeiro desfaça a baixa no módulo Financeiro.`);
      return;
    }

    // Carrega dados para edição
    setEditandoId(saida.id);
    setObs(saida.note || "");
    setItems([{ productId: "", productName: saida.product, qty: String(saida.qty) }]);
    setShowForm(true);
  };

  const handleCancelar = () => {
    setShowForm(false);
    resetForm();
  };

  // Lista de últimas saídas
  const [saidaMovs, setSaidaMovs] = useState<Movement[]>([]);
  useEffect(() => {
    let mounted = true;
    api.get("/api/stock/movements?limit=50")
      .then(r => r.json())
      .then((d: { movements?: DbMovement[] }) => {
        if (!mounted) return;
        setSaidaMovs(
          (d.movements ?? [])
            .filter(m => ["SAIDA", "VENDA", "PERDA", "AVARIA"].includes(m.type))
            .slice(0, 6)
            .map(m => ({
              id:            m.id,
              date:          fmtDate(m.createdAt),
              product:       m.productName,
              type:          dbTypeToKey(m.type),
              qty:           m.quantity,
              balanceBefore: m.balanceBefore,
              balanceAfter:  m.balanceAfter,
              user:          m.createdByName ?? "—",
              note:          m.origem,
            }))
        );
      })
      .catch(() => { if (mounted) setSaidaMovs([]); });
    return () => { mounted = false; };
  }, []);
  const ultimasSaidas = saidaMovs;

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
          <h3 className="text-base font-semibold">Últimas saídas</h3>
          <Button onClick={() => setShowForm(true)} className="rounded-xl gap-2 bg-gradient-primary text-primary-foreground">
            <Plus className="w-4 h-4" /> Adicionar
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {ultimasSaidas.length === 0 ? (
            <div className="md:col-span-2 xl:col-span-3">
              <EmptyState icon={ArrowDownCircle} title="Nenhuma saída" desc="Clique em 'Adicionar' para registrar uma nova saída." />
            </div>
          ) : (
            ultimasSaidas.map(m => (
              <Card key={m.id} className="rounded-2xl border-border/50 shadow-soft hover:shadow-ambient transition-all h-full">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${m.type === "perda" ? "bg-destructive/15" : "bg-blue-500/15"}`}>
                      {m.type === "perda"
                        ? <AlertTriangle className="w-4.5 h-4.5 text-destructive" />
                        : <ArrowDownCircle className="w-4.5 h-4.5 text-blue-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">{m.product}</span>
                        {m.type === "perda"
                          ? <span className="text-xs bg-destructive/15 text-destructive px-2 py-0.5 rounded-full shrink-0">Perda / Avaria</span>
                          : <span className="text-xs bg-blue-500/15 text-blue-600 px-2 py-0.5 rounded-full shrink-0">Saída</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                        <span>{m.date}</span>
                        <span>• {m.user}</span>
                        {m.note && <span className="truncate">• {m.note}</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0 flex flex-col items-end gap-1">
                      <span className="font-bold text-sm text-rose-600">-{m.qty} un</span>
                      {/* Apenas saídas com vínculo financeiro (venda/uso/troca) são editáveis */}
                      {isFinancialExit(m) && (
                        <button onClick={() => handleEditar(m)} className="p-1.5 rounded-lg hover:bg-secondary transition-colors" title="Editar">
                          <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                      )}
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
        <CardHeader className="pb-3"><CardTitle className="text-base">Dados da saída</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase">Tipo de saída</Label>
            <div className="relative">
              <select value={tipo} onChange={e => setTipo(e.target.value)} className="w-full h-10 px-3 pr-8 text-sm rounded-xl border border-input bg-background appearance-none focus:outline-none focus:ring-2 focus:ring-ring">
                {EXIT_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            </div>
          </div>
          {sectors.length > 0 && (
            <div className="space-y-1.5">
              <Label className={`text-xs font-semibold uppercase ${saidaErrors.sector ? "text-destructive" : "text-muted-foreground"}`}>Setor de origem *</Label>
              <SectorSelect sectors={sectors} value={sectorId} onChange={setSectorId} required error={saidaErrors.sector} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase">Responsável</Label>
            <Input placeholder="Responsável" value={responsavel} onChange={e => setResponsavel(e.target.value)} className="h-10 rounded-xl" />
          </div>
          <div className="space-y-1.5 sm:col-span-2"><Label className="text-xs font-semibold text-muted-foreground uppercase">Observação</Label>
            <Input placeholder="Motivo, pedido relacionado..." value={obs} onChange={e => setObs(e.target.value)} className="h-10 rounded-xl" /></div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/50 shadow-soft">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Produtos</CardTitle>
          <Button size="sm" variant="outline" className="rounded-xl gap-1.5 h-8" onClick={addItem}><Plus className="w-3.5 h-3.5" />Adicionar</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.map((it, i) => (
            <div key={i} className="grid grid-cols-[1fr_36px] sm:grid-cols-[1fr_100px_36px] gap-2 items-start pb-3 sm:pb-0 border-b sm:border-b-0 border-border/40 last:border-b-0">
              <div className="col-span-2 sm:col-span-1">
                <ProductCombobox
                  value={it.productId ? { id: it.productId, name: it.productName, sku: null, stock: 0 } : null}
                  onChange={p => setItemProduct(i, p)}
                  error={saidaErrors.products && !it.productId}
                />
              </div>
              <Input placeholder="Qtd" type="number" value={it.qty} onChange={e => setItem(i, "qty", e.target.value)} className="h-9 rounded-xl text-sm" />
              <button onClick={() => removeItem(i)} className="h-9 w-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="space-y-2">
        <div className="flex gap-3">
          <Button variant="outline" className="rounded-xl gap-2" onClick={handleCancelar}><ArrowLeftRight className="w-4 h-4 rotate-180" />Voltar</Button>
          <Button className="rounded-xl gap-2 bg-gradient-primary text-primary-foreground" onClick={handleSave} disabled={saving}>
            {saving
              ? <><Loader2 className="w-4 h-4 animate-spin" />Processando...</>
              : saved
                ? <><Check className="w-4 h-4" />{editandoId ? "Atualizado!" : "Registrado!"}</>
                : <><ArrowDownCircle className="w-4 h-4" />{editandoId ? "Salvar alterações" : "Confirmar saída"}</>}
          </Button>
        </div>
        {apiError && <p className="text-sm text-destructive bg-destructive/10 rounded-xl px-4 py-2">{apiError}</p>}
      </div>
    </div>
  );
}
