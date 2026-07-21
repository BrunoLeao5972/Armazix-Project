import { lazy, Suspense, useState, useMemo, useEffect, type ElementType } from "react";
import { CreditCard, ReceiptText, Landmark, Building2, Ban, CheckCircle, Plus, Search, X, AlertTriangle, Pencil, Trash2, Lock, ChevronDown, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PaymentMethodConfig } from "@/lib/store-context";
import type { PaymentPlanOption } from "@/components/admin/PaymentMethodEditor";
import { api } from "@/lib/api-client";

const LazyPaymentMethodEditor = lazy(() =>
  import("@/components/admin/PaymentMethodEditor").then(m => ({ default: m.PaymentMethodEditor }))
);

// ─── Gerais ──────────────────────────────────────────────────────────────────

type FinTabId = "formas-pagamento" | "planos-pagamento" | "contas-movimento" | "bancos";

const FIN_GERAIS_TABS: { id: FinTabId; label: string; icon: ElementType }[] = [
  { id: "formas-pagamento", label: "Formas de Pagamento", icon: CreditCard  },
  { id: "planos-pagamento", label: "Planos de Pagamento", icon: ReceiptText  },
  { id: "contas-movimento", label: "Contas de Movimento", icon: Landmark    },
  { id: "bancos",           label: "Bancos",              icon: Building2   },
];

// ── Formas de Pagamento — wrapper controlado ─────────────────────────────────

const DEFAULT_PMC: PaymentMethodConfig[] = [
  { key: "cash",        label: "Dinheiro",          enabled: true,  maxInstallments: 1,  payAtDelivery: true,  especie: "dinheiro"                          },
  { key: "pix",         label: "PIX",               enabled: true,  maxInstallments: 1,  payAtDelivery: true,  especie: "pix"                               },
  { key: "card",        label: "Cartão de Crédito", enabled: true,  maxInstallments: 12, payAtDelivery: true,  especie: "cartao",   operacao: "credito"      },
  { key: "debit",       label: "Cartão de Débito",  enabled: true,  maxInstallments: 1,  payAtDelivery: true,  especie: "cartao",   operacao: "debito"       },
  { key: "mercadopago", label: "Mercado Pago",       enabled: false, maxInstallments: 1,                       especie: "mercadopago"                       },
  { key: "appmax",      label: "Pagamento via App Max", enabled: false, maxInstallments: 12,                  especie: "appmax"                            },
];

function PainelFormasPagamento() {
  const [methods, setMethods]     = useState<PaymentMethodConfig[]>(DEFAULT_PMC);
  const [plans, setPlans]         = useState<PaymentPlanOption[]>([]);
  const [deliveryEnabled, setDeliveryEnabled] = useState(true);
  const [saving, setSaving]       = useState(false);
  const [success, setSuccess]     = useState(false);

  const [appmaxConnected, setAppmaxConnected]     = useState(false);
  const [appmaxConnectedAt, setAppmaxConnectedAt] = useState<string | null>(null);
  const [appmaxConnecting, setAppmaxConnecting]   = useState(false);

  const refreshAppmaxStatus = () => {
    api.get("/api/payments/appmax-status").then(r => r.json())
      .then((data: { connected?: boolean; connectedAt?: string | null }) => {
        setAppmaxConnected(!!data.connected);
        setAppmaxConnectedAt(data.connectedAt ?? null);
      }).catch(() => {});
  };

  useEffect(() => {
    const storeId = localStorage.getItem("storeId");
    if (!storeId) return;

    api.get("/api/payment-methods/list").then(r => r.json())
      .then((data: { methods?: PaymentMethodConfig[] }) => {
        if (data.methods?.length) setMethods(data.methods);
      }).catch(() => {});

    api.get("/api/payment-plans/list").then(r => r.json())
      .then((data: { plans?: Array<{ id: string; nome: string; tipo: "avista" | "dia" | "mes" }> }) => {
        if (data.plans) setPlans(data.plans.map(p => ({ id: p.id, nome: p.nome, tipo: p.tipo })));
      }).catch(() => {});

    fetch(`/api/store/get?id=${storeId}`)
      .then(r => r.json())
      .then((data: { store?: { deliveryPaymentEnabled?: boolean } }) => {
        if (data.store?.deliveryPaymentEnabled !== undefined)
          setDeliveryEnabled(data.store.deliveryPaymentEnabled !== false);
      })
      .catch(() => {});

    refreshAppmaxStatus();

    // Appmax redireciona o navegador de volta para cá após o lojista aprovar
    // (ou recusar) a instalação — ver appmaxConnectCallbackHandler.
    const params = new URLSearchParams(window.location.search);
    const appmaxResult = params.get("appmax");
    if (appmaxResult) {
      params.delete("appmax");
      params.delete("appmax_reason");
      const cleanUrl = window.location.pathname + (params.toString() ? `?${params}` : "");
      window.history.replaceState({}, "", cleanUrl);
      if (appmaxResult === "connected") refreshAppmaxStatus();
    }
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSuccess(false);
    try {
      const [methodsRes] = await Promise.all([
        api.post("/api/payment-methods/save", { methods }),
        api.post("/api/store/update", { deliveryPaymentEnabled: deliveryEnabled }),
      ]);
      if (methodsRes.ok) {
        const data = await methodsRes.json() as { methods?: PaymentMethodConfig[] };
        if (data.methods) setMethods(data.methods);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch {} finally { setSaving(false); }
  };

  const handleAppmaxConnect = async () => {
    setAppmaxConnecting(true);
    try {
      const res = await api.post("/api/payments/appmax-connect", {});
      if (res.ok) {
        const data = await res.json() as { redirectUrl?: string };
        if (data.redirectUrl) window.location.href = data.redirectUrl;
      }
    } finally {
      setAppmaxConnecting(false);
    }
  };

  const handleAppmaxDisconnect = async () => {
    const res = await api.post("/api/payments/appmax-disconnect", {});
    if (res.ok) { setAppmaxConnected(false); setAppmaxConnectedAt(null); }
  };

  return (
    <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>}>
      <LazyPaymentMethodEditor
        methods={methods}
        plans={plans}
        deliveryPaymentEnabled={deliveryEnabled}
        saving={saving}
        success={success}
        onMethodsChange={setMethods}
        onDeliveryPaymentChange={setDeliveryEnabled}
        onSave={handleSave}
        appmaxConnected={appmaxConnected}
        appmaxConnectedAt={appmaxConnectedAt}
        appmaxConnecting={appmaxConnecting}
        onAppmaxConnect={handleAppmaxConnect}
        onAppmaxDisconnect={handleAppmaxDisconnect}
      />
    </Suspense>
  );
}

// ── Planos de Pagamento ───────────────────────────────────────────────────────

type TipoPlano = "avista" | "dia" | "mes";

const TIPO_PLANO_LABEL: Record<TipoPlano, string> = {
  avista: "À vista",
  dia:    "Dia",
  mes:    "Mês",
};

interface PlanoPagamento {
  id: string;
  codigo: number;
  nome: string;
  ativo: boolean;
  parcelas: number;
  tipo: TipoPlano;
  quantidade: number;
}

type ModoFormPlano = "novo" | "editar" | "ver";

interface FormPlano {
  nome: string;
  parcelas: string;
  tipo: TipoPlano;
  quantidade: string;
}

const FORM_PLANO_VAZIO: FormPlano = { nome: "", parcelas: "1", tipo: "avista", quantidade: "0" };

function PainelPlanosPagamento() {
  const [planos, setPlanos]         = useState<PlanoPagamento[]>([]);
  const [loading, setLoading]       = useState(true);
  const [busca, setBusca]           = useState("");
  const [modo, setModo]             = useState<ModoFormPlano | null>(null);
  const [selecionado, setSelecionado] = useState<PlanoPagamento | null>(null);
  const [form, setForm]             = useState<FormPlano>(FORM_PLANO_VAZIO);
  const [salvando, setSalvando]     = useState(false);

  useEffect(() => {
    api.get("/api/payment-plans/list").then(r => r.json())
      .then((data: { plans?: PlanoPagamento[] }) => {
        if (data.plans) setPlanos(data.plans);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const proximoCodigo = useMemo(
    () => (planos.length > 0 ? Math.max(...planos.map(p => p.codigo)) + 1 : 1),
    [planos],
  );

  const planosFiltrados = useMemo(
    () => planos.filter(p => p.nome.toLowerCase().includes(busca.toLowerCase())),
    [planos, busca],
  );

  const abrirNovo = () => {
    setSelecionado(null);
    setForm(FORM_PLANO_VAZIO);
    setModo("novo");
  };

  const abrirEditar = (p: PlanoPagamento) => {
    setSelecionado(p);
    setForm({ nome: p.nome, parcelas: String(p.parcelas), tipo: p.tipo, quantidade: String(p.quantidade) });
    setModo("editar");
  };

  const cancelar = () => { setModo(null); setSelecionado(null); };

  const toggleAtivo = async (id: string) => {
    const alvo = planos.find(p => p.id === id);
    if (!alvo) return;
    const res = await api.post("/api/payment-plans/update", { planId: id, ativo: !alvo.ativo });
    if (!res.ok) return;
    const { plan } = await res.json() as { plan: PlanoPagamento };
    setPlanos(prev => prev.map(p => p.id === id ? plan : p));
    if (selecionado?.id === id) setSelecionado(plan);
  };

  const salvar = async () => {
    if (!form.nome.trim() || salvando) return;
    const parcelas   = Math.max(1, parseInt(form.parcelas)  || 1);
    const quantidade = form.tipo === "avista" ? 0 : Math.max(0, parseInt(form.quantidade) || 0);

    setSalvando(true);
    try {
      if (modo === "novo") {
        const res = await api.post("/api/payment-plans/create", {
          nome: form.nome.trim(), tipo: form.tipo, parcelas, quantidade,
        });
        if (!res.ok) return;
        const { plan } = await res.json() as { plan: PlanoPagamento };
        setPlanos(prev => [...prev, plan]);
      } else if (modo === "editar" && selecionado) {
        const res = await api.post("/api/payment-plans/update", {
          planId: selecionado.id, nome: form.nome.trim(), tipo: form.tipo, parcelas, quantidade,
        });
        if (!res.ok) return;
        const { plan } = await res.json() as { plan: PlanoPagamento };
        setPlanos(prev => prev.map(p => p.id === plan.id ? plan : p));
      }
      cancelar();
    } finally {
      setSalvando(false);
    }
  };

  // onChange handlers — strictly integers only
  const onChangeParcelas = (val: string) => {
    const clean = val.replace(/[^0-9]/g, "");
    setForm(p => ({ ...p, parcelas: clean }));
  };
  const onBlurParcelas = () => {
    if (!form.parcelas || parseInt(form.parcelas) < 1)
      setForm(p => ({ ...p, parcelas: "1" }));
  };
  const onChangeQuantidade = (val: string) => {
    const clean = val.replace(/[^0-9]/g, "");
    setForm(p => ({ ...p, quantidade: clean }));
  };
  const onChangeTipo = (tipo: TipoPlano) =>
    setForm(p => ({ ...p, tipo, quantidade: tipo === "avista" ? "0" : p.quantidade }));

  const codigoDisplay = (modo === "novo" ? proximoCodigo : selecionado?.codigo ?? 0);

  return (
    <Card className="rounded-2xl border-border/50 overflow-hidden">
      <div className="flex min-h-[520px]" style={{ flexDirection: "row" }}>

        {/* ── Painel esquerdo: listagem ───────────────────────────── */}
        <div className="w-72 shrink-0 flex flex-col border-r border-border/50">

          {/* Botão adicionar */}
          <div className="px-4 py-3 border-b border-border/40">
            <Button size="sm" onClick={abrirNovo} className="w-full gap-1.5 h-8 text-xs">
              <Plus className="w-3.5 h-3.5" />Adicionar Plano
            </Button>
          </div>

          {/* Busca */}
          <div className="px-3 py-2.5 border-b border-border/40">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar plano de pagamento"
                value={busca}
                onChange={e => setBusca(e.target.value)}
                className="w-full pl-8 pr-3 h-8 text-xs rounded-lg border border-border/60 bg-secondary/40 focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
              />
            </div>
          </div>

          {/* Cabeçalho da tabela */}
          <div className="grid grid-cols-[1fr_2.5rem] items-center px-3 py-2 border-b border-border/40">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Nome</span>
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-right pr-1">Ações</span>
          </div>

          {/* Linhas */}
          <div className="flex-1 overflow-y-auto divide-y divide-border/30">
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            ) : planosFiltrados.length === 0 ? (
              <div className="py-10 text-center text-xs text-muted-foreground">
                Nenhum plano encontrado
              </div>
            ) : (
              planosFiltrados.map(p => (
                <div
                  key={p.id}
                  className={[
                    "grid grid-cols-[1fr_2.5rem] items-center px-3 py-2.5 transition-colors",
                    selecionado?.id === p.id ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-secondary/40 border-l-2 border-l-transparent",
                    !p.ativo ? "opacity-50" : "",
                  ].join(" ")}
                >
                  {/* Nome + código */}
                  <div className="min-w-0 cursor-pointer" onClick={() => abrirEditar(p)}>
                    <p className="text-xs font-medium truncate leading-tight">{p.nome}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">
                      {String(p.codigo).padStart(2, "0")}
                    </p>
                  </div>

                  {/* Ações */}
                  <div className="flex items-center justify-end gap-0.5">
                    <button
                      onClick={() => abrirEditar(p)}
                      title="Editar"
                      className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Rodapé com contador */}
          <div className="px-4 py-2.5 border-t border-border/40 text-[11px] text-muted-foreground">
            {planosFiltrados.length} {planosFiltrados.length === 1 ? "registro" : "registros"}
          </div>
        </div>

        {/* ── Painel direito: formulário ──────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0">
          {modo === null ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center h-full py-16 text-center px-8">
              <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center mb-3">
                <ReceiptText className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium mb-1">Nenhum plano selecionado</p>
              <p className="text-xs text-muted-foreground max-w-xs">
                Selecione um plano na lista ou clique em "Adicionar Plano" para criar um novo.
              </p>
            </div>
          ) : (
            <>
              {/* Cabeçalho do formulário */}
              <div className="px-6 py-4 border-b border-border/40 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold">
                    {modo === "novo" ? "Novo Plano" : "Editar Plano"}
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                    Código {String(codigoDisplay).padStart(2, "0")}
                  </p>
                </div>
                <button
                  onClick={cancelar}
                  className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground shrink-0"
                  title="Fechar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Corpo do formulário */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-7">

                {/* Seção 1 — Informações Gerais */}
                <div className="space-y-3">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Informações Gerais
                  </p>
                  <div className="grid grid-cols-[6rem_1fr] gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Código</label>
                      <Input
                        disabled
                        value={String(codigoDisplay).padStart(2, "0")}
                        className="h-9 text-sm font-mono bg-secondary/50 text-muted-foreground"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Nome</label>
                      <Input
                        placeholder="Ex: À Vista, 30/60/90..."
                        value={form.nome}
                        onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
                        className="h-9 text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Seção 2 — Detalhamento */}
                <div className="space-y-3">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Detalhamento
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    {/* Parcelas */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Parcelas</label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={form.parcelas}
                        onChange={e => onChangeParcelas(e.target.value)}
                        onBlur={onBlurParcelas}
                        className="h-9 text-sm"
                        placeholder="1"
                      />
                    </div>

                    {/* Tipo */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Tipo</label>
                      <Select
                        value={form.tipo}
                        onValueChange={v => onChangeTipo(v as TipoPlano)}
                      >
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="avista">À vista</SelectItem>
                          <SelectItem value="dia">Dia</SelectItem>
                          <SelectItem value="mes">Mês</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Quantidade dias/meses */}
                    <div className="space-y-1.5">
                      <label className={`text-xs font-medium ${form.tipo === "avista" ? "text-muted-foreground/40" : "text-muted-foreground"}`}>
                        Qtd. {TIPO_PLANO_LABEL[form.tipo] === "À vista" ? "dias/meses" : `${TIPO_PLANO_LABEL[form.tipo].toLowerCase()}s`}
                      </label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        min={0}
                        disabled={form.tipo === "avista"}
                        value={form.tipo === "avista" ? "0" : form.quantidade}
                        onChange={e => onChangeQuantidade(e.target.value)}
                        className="h-9 text-sm"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  {/* Hint when avista */}
                  {form.tipo === "avista" && (
                    <p className="text-[11px] text-muted-foreground/60 flex items-center gap-1.5">
                      <AlertTriangle className="w-3 h-3 shrink-0" />
                      Quantidade bloqueada para pagamentos à vista.
                    </p>
                  )}
                </div>
              </div>

              {/* Rodapé do formulário */}
              <div className="px-6 py-4 border-t border-border/40 flex items-center justify-between gap-2">
                {/* Inativar/Reativar — só aparece para planos já existentes */}
                {selecionado && modo !== "novo" ? (
                  <button
                    onClick={() => toggleAtivo(selecionado.id)}
                    title={selecionado.ativo ? "Inativar plano" : "Reativar plano"}
                    className={`flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-lg border transition-colors ${
                      selecionado.ativo
                        ? "border-amber-500/30 text-amber-600 hover:bg-amber-500/10"
                        : "border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
                    }`}
                  >
                    {selecionado.ativo ? (
                      <><Ban className="w-3 h-3" /> Inativar</>
                    ) : (
                      <><CheckCircle className="w-3 h-3" /> Reativar</>
                    )}
                  </button>
                ) : <span />}

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={cancelar} className="h-8 text-xs">
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={salvar} disabled={!form.nome.trim() || salvando} className="h-8 text-xs gap-1.5">
                    {salvando && <Loader2 className="w-3 h-3 animate-spin" />}
                    {modo === "novo" ? "Criar Plano" : "Salvar Alterações"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>

      </div>
    </Card>
  );
}

// ── Contas de Movimento ───────────────────────────────────────────────────────

type TipoConta = "caixa" | "corrente" | "poupanca" | "outros";

interface ContaMovimento {
  id: string;
  nome: string;
  tipo: TipoConta;
  temMovimentacao: boolean;
}

const TIPO_CONTA_LABEL: Record<TipoConta, string> = {
  caixa:    "Caixa",
  corrente: "Conta Corrente",
  poupanca: "Poupança",
  outros:   "Outros",
};

function PainelContasMovimento() {
  const [contas, setContas]       = useState<ContaMovimento[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm]           = useState<{ nome: string; tipo: TipoConta }>({ nome: "", tipo: "caixa" });

  const abrirModal = () => {
    setForm({ nome: "", tipo: "caixa" });
    setModalOpen(true);
  };

  const salvar = () => {
    if (!form.nome.trim()) return;
    setContas(prev => [
      ...prev,
      { id: crypto.randomUUID(), nome: form.nome, tipo: form.tipo, temMovimentacao: false },
    ]);
    setModalOpen(false);
  };

  return (
    <>
      <Card className="rounded-2xl border-border/50">
        <CardHeader className="px-5 py-3.5 border-b border-border/40 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold">Contas de Movimento</CardTitle>
          <Button size="sm" onClick={abrirModal} className="gap-1.5 h-8 text-xs">
            <Plus className="w-3.5 h-3.5" />Adicionar Conta
          </Button>
        </CardHeader>

        <div className="overflow-x-auto">
          {contas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center mb-3">
                <Landmark className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium mb-1">Nenhuma conta cadastrada</p>
              <p className="text-xs text-muted-foreground max-w-xs">
                Adicione contas de movimento para vincular ao fluxo de caixa, contas a pagar e a receber.
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 text-xs text-muted-foreground font-semibold">
                  <th className="px-5 py-2.5 text-left">Nome da Conta</th>
                  <th className="px-5 py-2.5 text-left">Tipo</th>
                  <th className="px-5 py-2.5 text-center">Status</th>
                  <th className="px-5 py-2.5 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {contas.map(c => (
                  <tr key={c.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-5 py-3 font-medium">{c.nome}</td>
                    <td className="px-5 py-3 text-muted-foreground">{TIPO_CONTA_LABEL[c.tipo]}</td>
                    <td className="px-5 py-3 text-center">
                      <Badge className="rounded-full text-[11px] min-w-[5rem] justify-center bg-emerald-500/15 text-emerald-600 border-0">
                        Ativa
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {c.temMovimentacao ? (
                        <span
                          title="Esta conta possui movimentações e não pode ser excluída"
                          className="inline-flex p-1.5 rounded-lg text-muted-foreground/40 cursor-not-allowed"
                        >
                          <Lock className="w-3.5 h-3.5" />
                        </span>
                      ) : (
                        <button
                          onClick={() => setContas(p => p.filter(x => x.id !== c.id))}
                          className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          title="Excluir conta"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Nova Conta de Movimento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nome da Conta</p>
              <Input
                placeholder="Ex: Caixa Principal, Conta Corrente BB..."
                value={form.nome}
                onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tipo</p>
              <Select value={form.tipo} onValueChange={v => setForm(p => ({ ...p, tipo: v as TipoConta }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="caixa">Caixa</SelectItem>
                  <SelectItem value="corrente">Conta Corrente</SelectItem>
                  <SelectItem value="poupanca">Poupança</SelectItem>
                  <SelectItem value="outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={!form.nome.trim()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Bancos ────────────────────────────────────────────────────────────────────

interface Banco { id: string; sigla: string; nome: string; conta: string; digito: string }

function PainelBancos() {
  const [bancos, setBancos]       = useState<Banco[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ sigla: "", nome: "", conta: "", digito: "" });

  const abrirModal = () => {
    setForm({ sigla: "", nome: "", conta: "", digito: "" });
    setModalOpen(true);
  };

  const salvar = () => {
    if (!form.nome.trim()) return;
    setBancos(prev => [...prev, { id: crypto.randomUUID(), ...form }]);
    setModalOpen(false);
  };

  return (
    <>
      <Card className="rounded-2xl border-border/50">
        <CardHeader className="px-5 py-3.5 border-b border-border/40 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold">Bancos</CardTitle>
          <Button size="sm" onClick={abrirModal} className="gap-1.5 h-8 text-xs">
            <Plus className="w-3.5 h-3.5" />Adicionar Banco
          </Button>
        </CardHeader>

        <div className="overflow-x-auto">
          {bancos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center mb-3">
                <Building2 className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium mb-1">Nenhum banco cadastrado</p>
              <p className="text-xs text-muted-foreground max-w-xs">
                Cadastre as contas bancárias da empresa para uso nos lançamentos financeiros.
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 text-xs text-muted-foreground font-semibold">
                  <th className="px-5 py-2.5 text-left">Sigla</th>
                  <th className="px-5 py-2.5 text-left">Banco</th>
                  <th className="px-5 py-2.5 text-left">C/C</th>
                  <th className="px-5 py-2.5 text-left">Dígito</th>
                  <th className="px-5 py-2.5 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {bancos.map(b => (
                  <tr key={b.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-5 py-3">
                      <span className="font-mono text-xs font-bold bg-secondary px-2 py-0.5 rounded-md">
                        {b.sigla || "—"}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-medium">{b.nome}</td>
                    <td className="px-5 py-3 font-mono text-muted-foreground tabular-nums">{b.conta || "—"}</td>
                    <td className="px-5 py-3 font-mono text-muted-foreground">{b.digito || "—"}</td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => setBancos(p => p.filter(x => x.id !== b.id))}
                        className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Novo Banco</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="grid grid-cols-[5.5rem_1fr] gap-3">
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sigla</p>
                <Input
                  placeholder="BB"
                  value={form.sigla}
                  maxLength={5}
                  onChange={e => setForm(p => ({ ...p, sigla: e.target.value.toUpperCase() }))}
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nome do Banco</p>
                <Input
                  placeholder="Ex: Banco do Brasil"
                  value={form.nome}
                  onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-[1fr_5.5rem] gap-3">
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">C/C</p>
                <Input
                  placeholder="00000-0"
                  value={form.conta}
                  onChange={e => setForm(p => ({ ...p, conta: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dígito</p>
                <Input
                  placeholder="0"
                  maxLength={2}
                  value={form.digito}
                  onChange={e => setForm(p => ({ ...p, digito: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={!form.nome.trim()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Orquestrador ──────────────────────────────────────────────────────────────

export function SecaoConfiguracoesGerais() {
  const [activeTab, setActiveTab] = useState<FinTabId>("formas-pagamento");

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight">Gerais</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Formas de pagamento, planos, contas e bancos
        </p>
      </div>

      {/* Mobile: pill strip */}
      <div className="md:hidden flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {FIN_GERAIS_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={[
              "flex items-center gap-1.5 px-3 py-2 rounded-full text-xs whitespace-nowrap transition-colors",
              activeTab === tab.id
                ? "bg-primary/10 text-primary font-semibold"
                : "text-muted-foreground hover:bg-secondary font-medium",
            ].join(" ")}
          >
            <tab.icon className="w-3.5 h-3.5 shrink-0" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Desktop: sub-sidebar + content */}
      <div className="flex gap-6 items-start">
        <aside className="hidden md:flex flex-col w-52 shrink-0 gap-0.5 sticky top-4">
          {FIN_GERAIS_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={[
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-left w-full transition-colors",
                activeTab === tab.id
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground font-medium",
              ].join(" ")}
            >
              <tab.icon className="w-4 h-4 shrink-0" />
              <span className="leading-snug">{tab.label}</span>
            </button>
          ))}
        </aside>

        <div className="flex-1 min-w-0">
          {activeTab === "formas-pagamento" && <PainelFormasPagamento />}
          {activeTab === "planos-pagamento"  && <PainelPlanosPagamento />}
          {activeTab === "contas-movimento"  && <PainelContasMovimento />}
          {activeTab === "bancos"            && <PainelBancos />}
        </div>
      </div>
    </div>
  );
}
