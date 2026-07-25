import { useEffect, useState } from "react";
import {
  Plus, Loader2, Pencil, Download, ChevronDown, FileText, Trash2, X,
  AlertCircle, RefreshCw, Search, CheckCircle2, Eye, XCircle, Check,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";

// ─── SEÇÃO: BALANÇO ───────────────────────────────────────────────
interface BalancoItemJson {
  productId: string;
  productName: string;
  sku: string | null;
  systemStock: number;
  counted: number | null;
  diff: number | null;
  costPrice: number | null;
  unit: string;
}

interface BalancoRecord {
  id: string;
  codigo: string;
  prodScope: string;
  preco: string;
  dataContagem: string;
  dataEncerramento: string | null;
  status: "aberto" | "em_aberto" | "encerrado";
  items: BalancoItemJson[];
  createdByName: string | null;
  createdAt: string;
}

interface BalanceProduct {
  id: string;
  name: string;
  sku: string | null;
  stock: number;
  costPrice: number | null;
  unit: string;
}

function gerarCodigo() {
  const n = Math.floor(100000000 + Math.random() * 900000000);
  return `${String(n).slice(0,3)}.${String(n).slice(3,6)}.${String(n).slice(6,9)}`;
}

export function SecaoInventario() {
  // ── Produtos reais da API ──
  const [realProducts, setRealProducts] = useState<BalanceProduct[]>([]);
  const [loadingProds, setLoadingProds] = useState(false);

  useEffect(() => {
    const storeId = localStorage.getItem("storeId");
    if (!storeId) return;
    setLoadingProds(true);
    fetch(`/api/products/list-admin?storeId=${storeId}`)
      .then(r => r.json())
      .then((d: { products?: Array<{ id: string; name: string; sku?: string | null; stock?: number | null; costPrice?: string | null; unit?: string | null; active?: boolean }> }) => {
        const active = (d.products ?? []).filter(p => p.active !== false);
        setRealProducts(active.map(p => ({
          id:        p.id,
          name:      p.name,
          sku:       p.sku   ?? null,
          stock:     p.stock ?? 0,
          costPrice: p.costPrice ? parseFloat(p.costPrice) : null,
          unit:      p.unit  ?? "un",
        })));
      })
      .catch(() => {})
      .finally(() => setLoadingProds(false));
  }, []);

  // ── Balanços persistidos ──
  const [balancos, setBalancos] = useState<BalancoRecord[]>([]);
  const [loadingBalancos, setLoadingBalancos] = useState(false);

  const fetchBalancos = () => {
    setLoadingBalancos(true);
    api.get("/api/balances/list")
      .then(r => r.json())
      .then((d: { balances?: BalancoRecord[] }) => setBalancos(d.balances ?? []))
      .catch(() => {})
      .finally(() => setLoadingBalancos(false));
  };

  useEffect(fetchBalancos, []);

  // ── form state ──
  const [view, setView] = useState<"lista" | "novo">("lista");
  const [prodScope, setProdScope] = useState<"todos" | "alguns">("todos");
  const [preco, setPreco] = useState("Preço de custo");
  const [dataContagem, setDataContagem] = useState(new Date().toISOString().split("T")[0]);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [addSearch, setAddSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // ── etapas: edição, conferência, encerramento e reabertura ──
  const [editingBalance, setEditingBalance] = useState<BalancoRecord | null>(null);
  const [conferido, setConferido] = useState(false);
  const [encerrando, setEncerrando] = useState(false);
  const [encerrarError, setEncerrarError] = useState<string | null>(null);
  const [reabrindo, setReabrindo] = useState(false);
  const [reabrirError, setReabrirError] = useState<string | null>(null);

  const setCount = (id: string, v: string) => setCounts(prev => ({ ...prev, [id]: v }));

  const visibleProducts = prodScope === "todos"
    ? realProducts
    : realProducts.filter(p => selectedIds.includes(p.id));

  const filteredAdd = realProducts.filter(p =>
    !selectedIds.includes(p.id) &&
    (p.name.toLowerCase().includes(addSearch.toLowerCase()) ||
     (p.sku ?? "").toLowerCase().includes(addSearch.toLowerCase()))
  );

  const divergencias = visibleProducts.filter(p => {
    if (prodScope === "todos") {
      const c = parseInt(counts[p.id] || "");
      return isNaN(c) || c !== p.stock;
    }
    const c = parseInt(counts[p.id] || "");
    return !isNaN(c) && c !== p.stock;
  });

  const resetForm = () => {
    setProdScope("todos"); setPreco("Preço de custo");
    setDataContagem(new Date().toISOString().split("T")[0]);
    setCounts({}); setSelectedIds([]);
    setSaveError(null); setSavedOk(false);
    setEditingBalance(null); setConferido(false);
    setEncerrarError(null); setReabrirError(null);
  };

  // Carrega um balanço salvo no formulário para continuar a contagem
  const handleEditar = (b: BalancoRecord) => {
    setEditingBalance(b);
    setProdScope(b.prodScope as "todos" | "alguns");
    setDataContagem(
      b.dataContagem
        ? new Date(b.dataContagem).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
    );
    const savedCounts: Record<string, string> = {};
    const savedIds: string[] = [];
    for (const item of b.items ?? []) {
      if (item.counted !== null) savedCounts[item.productId] = String(item.counted);
      savedIds.push(item.productId);
    }
    setCounts(savedCounts);
    setSelectedIds(b.prodScope === "alguns" ? savedIds : []);
    setConferido(false);
    setSaveError(null);
    setEncerrarError(null);
    setSavedOk(false);
    setView("novo");
  };

  // Constrói o array de itens a partir do estado atual do formulário
  const buildItems = () =>
    visibleProducts.map(p => {
      const rawCounted = counts[p.id];
      const efectivo = prodScope === "todos" ? (rawCounted ?? "0") : (rawCounted ?? "");
      const counted = efectivo !== "" ? parseInt(efectivo) : null;
      const diff = counted !== null ? counted - p.stock : null;
      return {
        productId: p.id, productName: p.name, sku: p.sku,
        systemStock: p.stock, counted, diff,
        costPrice: p.costPrice, unit: p.unit,
      };
    });

  // Salva progresso sem alterar estoque (status sempre em_aberto)
  const handleSalvar = async () => {
    setSaveError(null);
    setSaving(true);
    try {
      const items = buildItems();
      let res: Response;
      if (editingBalance) {
        res = await api.post("/api/balances/update", {
          balanceId:    editingBalance.id,
          dataContagem: dataContagem + "T00:00:00.000Z",
          items,
        });
      } else {
        res = await api.post("/api/balances/create", {
          codigo:       gerarCodigo(),
          prodScope, preco,
          dataContagem: dataContagem + "T00:00:00.000Z",
          items,
        });
      }
      const data = await res.json() as { success?: boolean; balance?: BalancoRecord; error?: string };
      if (res.ok && data.balance) {
        if (editingBalance) {
          setBalancos(prev => prev.map(b => b.id === data.balance!.id ? data.balance! : b));
        } else {
          setBalancos(prev => [data.balance!, ...prev]);
        }
        setEditingBalance(data.balance!);
        setConferido(false); // requer nova conferência após salvar novos dados
        setSavedOk(true);
        setTimeout(() => setSavedOk(false), 2500);
      } else {
        setSaveError(data.error ?? "Erro ao salvar balanço. Tente novamente.");
      }
    } catch {
      setSaveError("Erro de conexão. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  // Encerra o balanço: salva estado atual + consolida estoque (ACID)
  const handleEncerrarDefinitivo = async () => {
    if (!conferido || encerrando) return;
    setEncerrarError(null);
    setEncerrando(true);
    try {
      const items = buildItems();

      // 1. Garantir que o estado mais recente está salvo no DB
      let balanceId: string;
      if (editingBalance) {
        const upRes = await api.post("/api/balances/update", {
          balanceId: editingBalance.id,
          dataContagem: dataContagem + "T00:00:00.000Z",
          items,
        });
        const upData = await upRes.json() as { success?: boolean; error?: string };
        if (!upRes.ok) { setEncerrarError(upData.error ?? "Erro ao salvar antes de encerrar"); return; }
        balanceId = editingBalance.id;
      } else {
        const crRes = await api.post("/api/balances/create", {
          codigo: gerarCodigo(),
          prodScope, preco,
          dataContagem: dataContagem + "T00:00:00.000Z",
          items,
        });
        const crData = await crRes.json() as { success?: boolean; balance?: BalancoRecord; error?: string };
        if (!crRes.ok || !crData.balance) { setEncerrarError(crData.error ?? "Erro ao criar balanço"); return; }
        balanceId = crData.balance.id;
        setBalancos(prev => [crData.balance!, ...prev]);
      }

      // 2. Encerrar via rota dedicada (consolida estoque em transação ACID)
      const res  = await api.post("/api/balances/encerrar", { balanceId });
      const data = await res.json() as {
        success?: boolean; balance?: BalancoRecord; correcoesGeradas?: number; error?: string;
      };
      if (res.ok && data.balance) {
        setBalancos(prev => prev.map(b => b.id === balanceId ? data.balance! : b));
        resetForm();
        setView("lista");
      } else {
        setEncerrarError(data.error ?? "Erro ao encerrar balanço");
      }
    } catch {
      setEncerrarError("Erro de conexão.");
    } finally {
      setEncerrando(false);
    }
  };

  // Reabre um balanço encerrado: reverte estoque e volta a em_aberto
  const handleReabrir = async () => {
    if (!editingBalance || reabrindo) return;
    const qtdDiverg = (editingBalance.items ?? []).filter(i => i.diff !== null && i.diff !== 0).length;
    const msg = qtdDiverg > 0
      ? `Reabrir vai reverter ${qtdDiverg} correção(ões) de estoque feita(s) no encerramento.\n\nOs produtos voltarão ao saldo anterior ao balanço.\n\nDeseja continuar?`
      : "Reabrir o balanço e voltar ao status Em aberto?";
    if (!confirm(msg)) return;
    setReabrirError(null);
    setReabrindo(true);
    try {
      const res  = await api.post("/api/balances/reabrir", { balanceId: editingBalance.id });
      const data = await res.json() as { success?: boolean; balance?: BalancoRecord; reversoesGeradas?: number; error?: string };
      if (res.ok && data.balance) {
        setBalancos(prev => prev.map(b => b.id === data.balance!.id ? data.balance! : b));
        setEditingBalance(data.balance!);
        setConferido(false);
        setSavedOk(false);
      } else {
        setReabrirError(data.error ?? "Erro ao reabrir balanço");
      }
    } catch {
      setReabrirError("Erro de conexão.");
    } finally {
      setReabrindo(false);
    }
  };

  const handleDelete = async (balanceId: string) => {
    if (!confirm("Excluir este balanço permanentemente?")) return;
    setDeletingId(balanceId);
    try {
      const res  = await api.post("/api/balances/delete", { balanceId });
      const data = await res.json() as { success?: boolean; error?: string };
      if (res.ok && data.success) {
        setBalancos(prev => prev.filter(b => b.id !== balanceId));
      } else {
        alert(data.error ?? "Erro ao excluir balanço.");
      }
    } catch {
      alert("Erro de conexão.");
    } finally {
      setDeletingId(null);
    }
  };


  const handleDownloadPDF = () => {
    const divergCount = visibleProducts.filter(p => { const ef = prodScope === "todos" ? (counts[p.id] ?? "0") : (counts[p.id] ?? ""); const c = parseInt(ef); return !isNaN(c) && c !== p.stock; }).length;
    const okCount = visibleProducts.filter(p => { const ef = prodScope === "todos" ? (counts[p.id] ?? "0") : (counts[p.id] ?? ""); const c = parseInt(ef); return !isNaN(c) && c === p.stock; }).length;
    const naoContado = visibleProducts.filter(p => { const ef = prodScope === "todos" ? (counts[p.id] ?? "0") : (counts[p.id] ?? ""); return ef === ""; }).length;
    const tableRows = visibleProducts.map((p, i) => {
      const raw = counts[p.id];
      const ef = prodScope === "todos" ? (raw ?? "0") : (raw ?? "");
      const counted = parseInt(ef);
      const diff = isNaN(counted) ? null : counted - p.stock;
      const diffStr = diff === null ? "—" : diff > 0 ? `<span style="color:#16a34a;font-weight:700">+${diff}</span>` : diff < 0 ? `<span style="color:#dc2626;font-weight:700">${diff}</span>` : `<span style="color:#6b7280">0</span>`;
      const stBg = diff === null ? "#f9fafb" : diff === 0 ? "#f0fdf4" : "#fefce8";
      const stColor = diff === null ? "#9ca3af" : diff === 0 ? "#16a34a" : "#d97706";
      const stLabel = diff === null ? "Não contado" : diff === 0 ? "OK" : "Divergente";
      return `<tr style="background:${i%2===0?"#fff":"#f9fafb"}"><td>${p.name}</td><td style="font-family:monospace;font-size:11px;color:#6b7280">${p.sku}</td><td style="text-align:center;font-weight:700">${p.stock}</td><td style="text-align:center;font-weight:700">${isNaN(counted) ? "—" : counted}</td><td style="text-align:center">${diffStr}</td><td style="text-align:center"><span style="display:inline-block;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:600;background:${stBg};color:${stColor}">${stLabel}</span></td></tr>`;
    }).join("");
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Balanço de Estoque — ARMAZIX</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Inter',Arial,sans-serif;background:#f8fafc;color:#111827;-webkit-print-color-adjust:exact}
  .page{max-width:960px;margin:0 auto;padding:32px 28px}
  .header{display:flex;align-items:center;justify-content:space-between;padding:24px 28px;background:linear-gradient(135deg,#00C853,#00e676);border-radius:16px;margin-bottom:24px;color:#fff}
  .logo{font-size:22px;font-weight:800;letter-spacing:-0.5px}.logo span{opacity:.7;font-weight:400}
  .header-meta{text-align:right;font-size:12px;opacity:.85;line-height:1.6}
  .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px}
  .kpi{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px 18px}
  .kpi-val{font-size:22px;font-weight:700;color:#111827;margin-bottom:2px}
  .kpi-label{font-size:11px;color:#6b7280;font-weight:500;text-transform:uppercase;letter-spacing:.4px}
  .card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;margin-bottom:24px}
  .card-header{padding:14px 20px;border-bottom:1px solid #f3f4f6;display:flex;align-items:center;justify-content:space-between}
  .card-title{font-size:13px;font-weight:700;color:#111827}
  .card-meta{font-size:12px;color:#6b7280}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th{background:#f9fafb;padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.4px;border-bottom:1px solid #e5e7eb}
  td{padding:10px 14px;border-bottom:1px solid #f3f4f6;vertical-align:middle}
  .footer{text-align:center;font-size:11px;color:#9ca3af;padding-top:8px}
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div>
      <div class="logo">ARMAZIX <span></span></div>
      <div style="font-size:13px;margin-top:4px;opacity:.9">Relatório de Balanço de Estoque</div>
    </div>
    <div class="header-meta">
      <div>Gerado em ${new Date().toLocaleDateString("pt-BR")}</div>
      <div>${new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</div>
      <div style="margin-top:4px;font-weight:600">Produtos: ${prodScope === "todos" ? "Todos" : "Selecionados"}</div>
    </div>
  </div>
  <div class="kpis">
    <div class="kpi"><div class="kpi-val">${visibleProducts.length}</div><div class="kpi-label">Total de produtos</div></div>
    <div class="kpi" style="border-color:#bbf7d0"><div class="kpi-val" style="color:#16a34a">${okCount}</div><div class="kpi-label">Sem divergência</div></div>
    <div class="kpi" style="border-color:#fde68a"><div class="kpi-val" style="color:#d97706">${divergCount}</div><div class="kpi-label">Divergentes</div></div>
    <div class="kpi" style="border-color:#e5e7eb"><div class="kpi-val" style="color:#9ca3af">${naoContado}</div><div class="kpi-label">Não contados</div></div>
  </div>
  <div class="card">
    <div class="card-header"><span class="card-title">Lista de contagem</span><span class="card-meta">${visibleProducts.length} produto(s)</span></div>
    <table>
      <thead><tr><th>Produto</th><th>SKU</th><th style="text-align:center">Sistema</th><th style="text-align:center">Contado</th><th style="text-align:center">Diferença</th><th style="text-align:center">Status</th></tr></thead>
      <tbody>${tableRows}</tbody>
    </table>
  </div>
  <div class="footer">ARMAZIX &mdash; Balanço gerado automaticamente &mdash; ${new Date().toLocaleString("pt-BR")}</div>
</div>
</body></html>`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `balanco-${new Date().toISOString().slice(0,10)}.html`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownload = () => {
    const rows = [
      ["Produto", "SKU", "Estoque sistema", "Contado", "Diferença"],
      ...visibleProducts.map(p => {
        const c = counts[p.id] ?? (prodScope === "todos" ? "0" : "");
        const diff = c !== "" ? parseInt(c) - p.stock : "—";
        return [p.name, p.sku, p.stock, c || (prodScope === "todos" ? "0" : ""), diff];
      }),
    ];
    const csv = rows.map(r => r.join(";")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "balanco.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const [exportRowOpen, setExportRowOpen] = useState<string | null>(null);

  // ── Lista de balanços ──
  if (view === "lista") {
    const fmtDate = (iso: string | null) => iso
      ? new Date(iso).toLocaleDateString("pt-BR")
      : "—";

    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Histórico de balanços realizados.</p>
          <Button className="rounded-xl gap-2 h-9 bg-gradient-primary text-primary-foreground"
            onClick={() => { resetForm(); setView("novo"); }}>
            <Plus className="w-4 h-4" />Novo Balanço
          </Button>
        </div>

        <Card className="rounded-2xl border-border/50 shadow-soft overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 border-b border-border/40">
                <tr>
                  {["Código", "Itens", "Produtos", "Data contagem", "Encerramento", "Criado por", "Status", "Ações"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {loadingBalancos ? (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground text-sm">
                    <Loader2 className="w-4 h-4 animate-spin inline mr-2" />Carregando...
                  </td></tr>
                ) : balancos.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground text-sm">Nenhum balanço registrado.</td></tr>
                ) : balancos.map(b => (
                  <tr key={b.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-semibold">{b.codigo}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{b.items?.length ?? 0}</td>
                    <td className="px-4 py-3 text-xs capitalize">{b.prodScope === "todos" ? "Todos" : "Selecionados"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(b.dataContagem)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(b.dataEncerramento)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{b.createdByName ?? "—"}</td>
                    <td className="px-4 py-3">
                      {b.status === "encerrado" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-secondary text-muted-foreground">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />Encerrado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/15 text-emerald-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />Em aberto
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5 flex-wrap">
                        {/* Editar — disponível para todos os balanços */}
                        <button onClick={() => handleEditar(b)}
                          className="text-xs px-2 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex items-center gap-1 font-medium">
                          <Pencil className="w-3 h-3" />Editar
                        </button>
                        <div className="relative">
                          <button onClick={() => setExportRowOpen(v => v === b.id ? null : b.id)}
                            className="text-xs px-2 py-1 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors flex items-center gap-1">
                            <Download className="w-3 h-3" />Exportar<ChevronDown className="w-2.5 h-2.5" />
                          </button>
                          {exportRowOpen === b.id && (
                            <div className="absolute right-0 top-full mt-1 z-20 bg-background border border-border/50 rounded-xl shadow-lg overflow-hidden min-w-[150px]">
                              <button onClick={() => { handleDownload(); setExportRowOpen(null); }}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-secondary/60 flex items-center gap-2">
                                <Download className="w-3 h-3" />Excel (.csv)
                              </button>
                              <button onClick={() => { handleDownloadPDF(); setExportRowOpen(null); }}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-secondary/60 flex items-center gap-2">
                                <FileText className="w-3 h-3" />PDF (download)
                              </button>
                            </div>
                          )}
                        </div>
                        {b.status !== "encerrado" && (
                          <button onClick={() => handleDelete(b.id)} disabled={deletingId === b.id}
                            className="text-xs px-2 py-1 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors flex items-center gap-1 disabled:opacity-50">
                            {deletingId === b.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                            Excluir
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    );
  }

  // ── Formulário Novo Balanço ──
  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-base">
            {editingBalance ? `Balanço — ${editingBalance.codigo}` : "Novo Balanço"}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {!editingBalance && "Preencha a contagem, salve o progresso e encerre quando concluído"}
            {editingBalance?.status !== "encerrado" && editingBalance && (
              <span className="inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Em aberto — continue a contagem e encerre quando finalizar
              </span>
            )}
            {editingBalance?.status === "encerrado" && (
              <span className="inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />Encerrado em {editingBalance.dataEncerramento ? new Date(editingBalance.dataEncerramento).toLocaleDateString("pt-BR") : "—"}
              </span>
            )}
          </p>
        </div>
        <button onClick={() => { resetForm(); setView("lista"); }} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5">
          <X className="w-4 h-4" />Voltar
        </button>
      </div>

      {/* Banner: balanço encerrado */}
      {editingBalance?.status === "encerrado" && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 space-y-1">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              Este balanço está encerrado
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
              As correções de estoque já foram aplicadas. Ao reabrir, <strong>{(editingBalance.items ?? []).filter(i => i.diff !== null && i.diff !== 0).length} ajuste(s) de estoque</strong> serão revertidos e o balanço voltará para <em>Em aberto</em> para que você possa continuar editando.
            </p>
            {reabrirError && (
              <p className="text-xs text-red-600 font-medium">{reabrirError}</p>
            )}
          </div>
          <button
            onClick={handleReabrir}
            disabled={reabrindo}
            className="shrink-0 h-9 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-sm font-semibold flex items-center gap-2 transition-colors shadow-sm"
          >
            {reabrindo
              ? <><Loader2 className="w-4 h-4 animate-spin" />Reabrindo...</>
              : <><RefreshCw className="w-4 h-4" />Reabrir Balanço</>
            }
          </button>
        </div>
      )}

      {/* Configurações */}
      <Card className={`rounded-2xl border-border/50 shadow-soft ${editingBalance?.status === "encerrado" ? "opacity-60 pointer-events-none select-none" : ""}`}>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Configurações do balanço</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Produtos contados */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase">Produtos contados</Label>
            <div className="flex gap-2">
              <button onClick={() => { setProdScope("todos"); setSelectedIds([]); }}
                className={`flex-1 h-9 text-sm rounded-xl border font-medium transition-colors ${prodScope === "todos" ? "bg-primary text-primary-foreground border-primary" : "border-input bg-background text-muted-foreground hover:text-foreground"}`}>
                Todos
              </button>
              <button onClick={() => setProdScope("alguns")}
                className={`flex-1 h-9 text-sm rounded-xl border font-medium transition-colors ${prodScope === "alguns" ? "bg-primary text-primary-foreground border-primary" : "border-input bg-background text-muted-foreground hover:text-foreground"}`}>
                Alguns
              </button>
            </div>
            {prodScope === "todos" && (
              <p className="text-[11px] text-muted-foreground leading-snug">Produtos não informados na contagem terão estoque zerado.</p>
            )}
            {prodScope === "alguns" && (
              <p className="text-[11px] text-muted-foreground leading-snug">Apenas os produtos informados serão contabilizados.</p>
            )}
          </div>

          {/* Datas */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase">Data da contagem</Label>
              <Input type="date" value={dataContagem} onChange={e => setDataContagem(e.target.value)} className="h-9 rounded-xl text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase">Encerramento</Label>
              <Input type="text" value={editingBalance?.dataEncerramento ? new Date(editingBalance.dataEncerramento).toLocaleDateString("pt-BR") : "Será preenchido ao encerrar"} disabled className="h-9 rounded-xl text-sm disabled:opacity-50 text-muted-foreground" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Adicionar produto (modo "alguns") */}
      {prodScope === "alguns" && (
        <Card className="rounded-2xl border-border/50 shadow-soft">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Adicionar produtos à contagem</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input placeholder="Buscar produto por nome ou SKU..." value={addSearch} onChange={e => setAddSearch(e.target.value)} className="pl-9 h-9 rounded-xl text-sm" />
            </div>
            {addSearch.length > 0 && filteredAdd.length > 0 && (
              <div className="border border-border/40 rounded-xl overflow-hidden divide-y divide-border/30 max-h-40 overflow-y-auto">
                {filteredAdd.slice(0, 8).map(p => (
                  <button key={p.id} onClick={() => { setSelectedIds(v => [...v, p.id]); setAddSearch(""); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-secondary/50 transition-colors flex items-center justify-between">
                    <span>{p.name}</span>
                    <span className="text-xs text-muted-foreground font-mono">{p.sku}</span>
                  </button>
                ))}
              </div>
            )}
            {selectedIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedIds.map(id => {
                  const p = realProducts.find(x => x.id === id);
                  return p ? (
                    <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary font-medium">
                      {p.name}
                      <button onClick={() => setSelectedIds(v => v.filter(x => x !== id))} className="hover:text-destructive"><X className="w-3 h-3" /></button>
                    </span>
                  ) : null;
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tabela de contagem */}
      <Card className={`rounded-2xl border-border/50 shadow-soft overflow-hidden ${editingBalance?.status === "encerrado" ? "opacity-60 pointer-events-none select-none" : ""}`}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Lista de contagem</CardTitle>
            {divergencias.length > 0 && (
              <Badge className="rounded-full bg-amber-500/15 text-amber-600 border-0 gap-1 text-[11px]">
                <AlertCircle className="w-3 h-3" />{divergencias.length} divergência(s)
              </Badge>
            )}
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 border-b border-border/40">
              <tr>
                {["Produto", "SKU", "Preço", "Un.", "Estoque sistema", "Contado", "Diferença"].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {loadingProds && prodScope === "todos" ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin inline mr-2" />Carregando produtos...
                </td></tr>
              ) : visibleProducts.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {prodScope === "alguns" ? "Busque e adicione produtos acima." : "Nenhum produto ativo encontrado."}
                </td></tr>
              ) : visibleProducts.map(p => {
                const rawCounted = counts[p.id];
                const efectivo = prodScope === "todos" ? (rawCounted ?? "0") : (rawCounted ?? "");
                const counted = parseInt(efectivo);
                const diff = isNaN(counted) ? null : counted - p.stock;
                return (
                  <tr key={p.id} className={`transition-colors ${diff !== null && diff !== 0 ? "bg-amber-500/5" : "hover:bg-secondary/30"}`}>
                    <td className="px-4 py-2.5 font-medium">{p.name}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{p.sku ?? "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {p.costPrice != null ? `R$ ${p.costPrice.toFixed(2).replace(".", ",")}` : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{p.unit}</td>
                    <td className="px-4 py-2.5 font-bold">{p.stock}</td>
                    <td className="px-4 py-2.5">
                      <Input type="number" placeholder={prodScope === "todos" ? "0" : "Contar..."} value={rawCounted ?? ""}
                        onChange={e => setCount(p.id, e.target.value)} className="h-8 w-24 rounded-lg text-sm" />
                    </td>
                    <td className="px-4 py-2.5">
                      {diff === null ? <span className="text-muted-foreground text-xs">—</span> : (
                        <span className={`font-bold text-sm ${diff > 0 ? "text-emerald-600" : diff < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                          {diff > 0 ? `+${diff}` : diff}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {visibleProducts.length > 0 && (
              <tfoot className="border-t border-border/40 bg-secondary/30">
                <tr>
                  <td colSpan={4} className="px-4 py-2.5 text-xs font-semibold text-muted-foreground">
                    {visibleProducts.length} produto(s)
                  </td>
                  <td className="px-4 py-2.5 font-bold text-sm">
                    {visibleProducts.reduce((s, p) => s + p.stock, 0)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>

      {/* Etapas de ação — ocultas quando encerrado (reabertura é pelo banner acima) */}
      {editingBalance?.status === "encerrado" && (
        <div className="flex justify-end">
          <Button variant="outline" className="rounded-xl gap-1.5 h-9 text-sm"
            onClick={() => { resetForm(); setView("lista"); }}>
            Voltar para lista
          </Button>
        </div>
      )}
      {editingBalance?.status !== "encerrado" && (
      <div className="rounded-2xl border border-border/50 bg-secondary/30 p-4 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Etapas do balanço</p>
        <div className="flex flex-wrap gap-2">

          {/* ETAPA 1 — Salvar Progresso */}
          <Button
            variant="outline"
            className={`rounded-xl gap-1.5 h-9 text-sm ${savedOk ? "border-emerald-500 text-emerald-600" : ""}`}
            onClick={handleSalvar}
            disabled={saving}
            title="Salva o progresso sem alterar o estoque. Pode ser continuado depois."
          >
            {saving
              ? <><Loader2 className="w-4 h-4 animate-spin" />Salvando...</>
              : savedOk
                ? <><CheckCircle2 className="w-4 h-4 text-emerald-500" />Progresso salvo!</>
                : <><Check className="w-4 h-4" />1. Salvar Progresso</>
            }
          </Button>

          {/* ETAPA 2 — Conferir Itens */}
          <Button
            variant="outline"
            className={`rounded-xl gap-1.5 h-9 text-sm ${conferido ? "border-blue-500 text-blue-600" : ""}`}
            onClick={() => setConferido(true)}
            disabled={conferido}
            title="Processa as diferenças na tabela para auditoria visual. Não altera o estoque."
          >
            {conferido
              ? <><CheckCircle2 className="w-4 h-4 text-blue-500" />Itens conferidos</>
              : <><Eye className="w-4 h-4" />2. Conferir Itens</>
            }
          </Button>

          {/* ETAPA 3 — Encerrar Balanço */}
          <Button
            variant="outline"
            className={`rounded-xl gap-1.5 h-9 text-sm transition-colors ${
              conferido
                ? "border-amber-500 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950"
                : "opacity-50 cursor-not-allowed"
            }`}
            onClick={handleEncerrarDefinitivo}
            disabled={!conferido || encerrando}
            title={!conferido ? "Execute a conferência antes de encerrar" : "Consolida o estoque e encerra o balanço (irreversível)"}
          >
            {encerrando
              ? <><Loader2 className="w-4 h-4 animate-spin" />Encerrando...</>
              : <><XCircle className="w-4 h-4" />3. Encerrar Balanço</>
            }
          </Button>

          {/* Ferramentas de exportação */}
          <Button variant="outline" className="rounded-xl gap-1.5 h-9 text-sm" onClick={() => window.print()}>
            <FileText className="w-4 h-4" />Imprimir
          </Button>
          <Button variant="outline" className="rounded-xl gap-1.5 h-9 text-sm" onClick={handleDownload}>
            <Download className="w-4 h-4" />Excel
          </Button>
          <Button variant="outline" className="rounded-xl gap-1.5 h-9 text-sm" onClick={handleDownloadPDF}>
            <Download className="w-4 h-4" />PDF
          </Button>

          <div className="flex-1" />
          <Button variant="outline" className="rounded-xl gap-1.5 h-9 text-sm" onClick={() => { resetForm(); setView("lista"); }}>
            Cancelar
          </Button>
        </div>

        {/* Indicadores de progresso */}
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
          <span className={`flex items-center gap-1 ${editingBalance ? "text-emerald-600 font-medium" : ""}`}>
            <span className={`w-2 h-2 rounded-full ${editingBalance ? "bg-emerald-500" : "bg-border"}`} />
            {editingBalance ? `Salvo — ${editingBalance.codigo}` : "Não salvo ainda"}
          </span>
          <span className={`flex items-center gap-1 ${conferido ? "text-blue-600 font-medium" : ""}`}>
            <span className={`w-2 h-2 rounded-full ${conferido ? "bg-blue-500" : "bg-border"}`} />
            {conferido ? `${divergencias.length} divergência(s) revisadas` : "Aguardando conferência"}
          </span>
        </div>

        {saveError && (
          <p className="text-sm text-destructive bg-destructive/10 rounded-xl px-3 py-2">{saveError}</p>
        )}
        {encerrarError && (
          <p className="text-sm text-destructive bg-destructive/10 rounded-xl px-3 py-2">{encerrarError}</p>
        )}
      </div>
      )}
    </div>
  );
}
