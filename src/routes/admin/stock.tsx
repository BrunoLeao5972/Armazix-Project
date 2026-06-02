import { lazy, Suspense, useEffect, useState, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowUpCircle, ArrowDownCircle, AlertTriangle, Package, TrendingUp, TrendingDown,
  MoreHorizontal, Loader2, Search, Filter, Download, Plus, RefreshCw,
  ClipboardList, ArrowLeftRight, ArrowRight, FileText, BarChart3, Settings2, History,
  CheckCircle2, XCircle, Clock, ChevronDown, X, Check, Eye, Pencil,
  Warehouse, Truck, ShoppingBag, Trash2, AlertCircle, Activity,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
const StockMovementChart = lazy(() => import("@/components/armazix/StockMovementChart"));

export const Route = createFileRoute("/admin/stock")({
  component: StockPage,
  head: () => ({
    meta: [{ title: "Movimentação — ARMAZIX" }],
  }),
});

// ─── Types ────────────────────────────────────────────────────────
type MovTab = "estoque" | "entrada" | "saida" | "transferencias" | "extrato" | "inventario" | "ajustes" | "historico" | "balanco";

interface StockProduct {
  id: string; name: string; sku: string; category: string;
  stock: number; minStock: number; location: string;
  lastMovement: string; costPrice: number; price: number;
}

interface Movement {
  id: string; date: string; product: string; type: string;
  qty: number; balanceBefore: number; balanceAfter: number;
  user: string; note: string;
}

interface EntryItem { product: string; qty: string; cost: string; lot: string; expiry: string; }
interface ExitItem  { product: string; qty: string; }
interface TransferItem { product: string; qty: string; }

const PAYMENT_METHODS = ["Dinheiro", "Boleto", "Pix", "Cartão de crédito", "Cartão de débito", "Transferência", "Cheque"];
const MOCK_USERS = ["Admin", "Carlos Silva", "Ana Oliveira", "Pedro Costa", "Fernanda Lima"];

// ─── Helpers ──────────────────────────────────────────────────────
const MOV_TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  entrada:      { label: "Entrada",      color: "text-emerald-600", bg: "bg-emerald-500/15", icon: ArrowUpCircle },
  saida:        { label: "Saída",        color: "text-blue-600",    bg: "bg-blue-500/15",    icon: ArrowDownCircle },
  ajuste:       { label: "Ajuste",       color: "text-violet-600",  bg: "bg-violet-500/15",  icon: Settings2 },
  inventario:   { label: "Inventário",   color: "text-primary",     bg: "bg-primary/15",     icon: ClipboardList },
  transferencia:{ label: "Transferência",color: "text-amber-600",   bg: "bg-amber-500/15",   icon: ArrowLeftRight },
  perda:        { label: "Perda",        color: "text-destructive", bg: "bg-destructive/15", icon: AlertTriangle },
};

function StockStatusBadge({ stock, min }: { stock: number; min: number }) {
  if (stock === 0)        return <Badge className="rounded-full text-[11px] bg-destructive/15 text-destructive border-0">Sem estoque</Badge>;
  if (stock <= min * 0.5) return <Badge className="rounded-full text-[11px] bg-red-500/15 text-red-600 border-0">Crítico</Badge>;
  if (stock <= min)       return <Badge className="rounded-full text-[11px] bg-amber-500/15 text-amber-600 border-0">Baixo</Badge>;
  return                         <Badge className="rounded-full text-[11px] bg-emerald-500/15 text-emerald-600 border-0">Em estoque</Badge>;
}

function MovTypeBadge({ type }: { type: string }) {
  const cfg = MOV_TYPE_CONFIG[type] ?? { label: type, color: "text-muted-foreground", bg: "bg-secondary", icon: Activity };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${cfg.bg} ${cfg.color}`}>
      <Icon className="w-3 h-3" />{cfg.label}
    </span>
  );
}

function SummaryCard({ icon: Icon, label, value, color, bg }: {
  icon: React.ElementType; label: string; value: string | number; color: string; bg: string;
}) {
  return (
    <Card className="rounded-2xl border-border/50 shadow-soft">
      <CardContent className="p-4">
        <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center mb-3`}>
          <Icon className={`w-4.5 h-4.5 ${color}`} />
        </div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mb-3">
        <Icon className="w-7 h-7 text-muted-foreground" />
      </div>
      <p className="font-semibold text-sm">{title}</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-xs">{desc}</p>
    </div>
  );
}

function SkeletonRows({ n = 5 }: { n?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="h-14 rounded-xl bg-secondary/60 animate-pulse" />
      ))}
    </div>
  );
}

// ─── MOCK DATA ────────────────────────────────────────────────────
const MOCK_PRODUCTS: StockProduct[] = [
  { id: "1", name: "Arroz Integral 5kg", sku: "ARR-001", category: "Grãos", stock: 42, minStock: 20, location: "A-01", lastMovement: "25/05/2026", costPrice: 18.90, price: 29.90 },
  { id: "2", name: "Feijão Preto 1kg", sku: "FEJ-002", category: "Grãos", stock: 8, minStock: 15, location: "A-02", lastMovement: "24/05/2026", costPrice: 7.50, price: 12.90 },
  { id: "3", name: "Macarrão Espaguete", sku: "MAC-003", category: "Massas", stock: 0, minStock: 10, location: "B-01", lastMovement: "20/05/2026", costPrice: 3.20, price: 5.90 },
  { id: "4", name: "Azeite Extra Virgem", sku: "AZT-004", category: "Óleos", stock: 5, minStock: 8, location: "C-03", lastMovement: "23/05/2026", costPrice: 28.00, price: 45.90 },
  { id: "5", name: "Sal Refinado 1kg", sku: "SAL-005", category: "Temperos", stock: 120, minStock: 30, location: "A-05", lastMovement: "22/05/2026", costPrice: 1.80, price: 3.50 },
];

const MOCK_MOVEMENTS: Movement[] = [
  { id: "m1", date: "25/05/2026 14:32", product: "Arroz Integral 5kg", type: "entrada", qty: 20, balanceBefore: 22, balanceAfter: 42, user: "Admin", note: "NF 1234" },
  { id: "m2", date: "24/05/2026 10:15", product: "Feijão Preto 1kg", type: "saida", qty: 5, balanceBefore: 13, balanceAfter: 8, user: "Admin", note: "Pedido #892" },
  { id: "m3", date: "23/05/2026 09:00", product: "Azeite Extra Virgem", type: "ajuste", qty: -3, balanceBefore: 8, balanceAfter: 5, user: "Admin", note: "Recontagem" },
  { id: "m4", date: "22/05/2026 16:45", product: "Macarrão Espaguete", type: "perda", qty: 6, balanceBefore: 6, balanceAfter: 0, user: "Admin", note: "Avaria" },
  { id: "m5", date: "21/05/2026 11:20", product: "Sal Refinado 1kg", type: "transferencia", qty: 30, balanceBefore: 90, balanceAfter: 120, user: "Admin", note: "Depósito B→A" },
];

// ─── SEÇÃO: ESTOQUE ───────────────────────────────────────────────
function SecaoEstoque() {
  const [search, setSearch] = useState("");
  const [loading] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const products_ref = MOCK_PRODUCTS;

  const handleExportEstoqueCSV = () => {
    const filtered_ref = products_ref.filter(p =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase())
    );
    const rows = [
      ["Produto", "SKU", "Categoria", "Estoque", "M\u00edn.", "Localiza\u00e7\u00e3o", "\u00daltima mov."],
      ...filtered_ref.map(p => [p.name, p.sku, p.category, p.stock, p.minStock, p.location, p.lastMovement]),
    ];
    const csv = rows.map(r => r.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "estoque.csv"; a.click();
    URL.revokeObjectURL(url);
    setExportOpen(false);
  };

  const handleExportEstoquePDF = () => {
    const filtered_pdf = products_ref.filter(p =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase())
    );
    const totalVal = filtered_pdf.reduce((s, p) => s + p.stock * p.costPrice, 0);
    const semEst = filtered_pdf.filter(p => p.stock === 0).length;
    const baixoEst = filtered_pdf.filter(p => p.stock > 0 && p.stock <= p.minStock).length;
    const emEst = filtered_pdf.filter(p => p.stock > p.minStock).length;
    const tableRows = filtered_pdf.map((p, i) => {
      const st = p.stock === 0 ? ["Sem estoque","#fef2f2","#dc2626"] : p.stock <= p.minStock ? ["Estoque baixo","#fffbeb","#d97706"] : ["Em estoque","#f0fdf4","#16a34a"];
      return `<tr style="background:${i%2===0?"#fff":"#f9fafb"}"><td>${p.name}</td><td style="font-family:monospace;font-size:11px;color:#6b7280">${p.sku}</td><td>${p.category}</td><td style="text-align:center;font-weight:700">${p.stock}</td><td style="text-align:center;color:#6b7280">${p.minStock}</td><td style="color:#6b7280">${p.location}</td><td style="color:#6b7280">${p.lastMovement}</td><td><span style="display:inline-block;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:600;background:${st[1]};color:${st[2]}">${st[0]}</span></td></tr>`;
    }).join("");
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Relat\u00f3rio de Estoque \u2014 ARMAZIX</title>
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
  .kpi.green .kpi-val{color:#00C853} .kpi.red .kpi-val{color:#dc2626} .kpi.amber .kpi-val{color:#d97706}
  .card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;margin-bottom:24px}
  .card-header{padding:14px 20px;border-bottom:1px solid #f3f4f6;display:flex;align-items:center;justify-content:space-between}
  .card-title{font-size:13px;font-weight:700;color:#111827}
  .card-count{font-size:12px;color:#6b7280}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th{background:#f9fafb;padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.4px;border-bottom:1px solid #e5e7eb}
  td{padding:10px 14px;border-bottom:1px solid #f3f4f6;vertical-align:middle}
  .footer{text-align:center;font-size:11px;color:#9ca3af;padding-top:8px}
  .dot{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:5px}
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div>
      <div class="logo">ARMAZIX <span></span></div>
      <div style="font-size:13px;margin-top:4px;opacity:.9">Relat\u00f3rio de Estoque</div>
    </div>
    <div class="header-meta">
      <div>Gerado em ${new Date().toLocaleDateString("pt-BR")}</div>
      <div>${new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</div>
      <div style="margin-top:4px;font-weight:600">${filtered_pdf.length} produto(s)</div>
    </div>
  </div>
  <div class="kpis">
    <div class="kpi green"><div class="kpi-val">${emEst}</div><div class="kpi-label">Em estoque</div></div>
    <div class="kpi amber"><div class="kpi-val">${baixoEst}</div><div class="kpi-label">Estoque baixo</div></div>
    <div class="kpi red"><div class="kpi-val">${semEst}</div><div class="kpi-label">Sem estoque</div></div>
    <div class="kpi"><div class="kpi-val" style="color:#00C853">R$ ${totalVal.toFixed(2).replace(".",",")}</div><div class="kpi-label">Valor em estoque</div></div>
  </div>
  <div class="card">
    <div class="card-header"><span class="card-title">Produtos</span><span class="card-count">${filtered_pdf.length} itens</span></div>
    <table>
      <thead><tr><th>Produto</th><th>SKU</th><th>Categoria</th><th style="text-align:center">Estoque</th><th style="text-align:center">M\u00ednimo</th><th>Localiza\u00e7\u00e3o</th><th>\u00daltima mov.</th><th>Status</th></tr></thead>
      <tbody>${tableRows}</tbody>
    </table>
  </div>
  <div class="footer">ARMAZIX &mdash; Relat\u00f3rio gerado automaticamente &mdash; ${new Date().toLocaleString("pt-BR")}</div>
</div>
</body></html>`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `estoque-${new Date().toISOString().slice(0,10)}.html`; a.click();
    URL.revokeObjectURL(url);
    setExportOpen(false);
  };
  const products = MOCK_PRODUCTS;

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase()) ||
    p.category.toLowerCase().includes(search.toLowerCase())
  );

  const totalValue = products.reduce((s, p) => s + p.stock * p.costPrice, 0);
  const semEstoque = products.filter(p => p.stock === 0).length;
  const baixo      = products.filter(p => p.stock > 0 && p.stock <= p.minStock).length;

  return (
    <div className="space-y-5">
      {/* Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard icon={Package}       label="Total de produtos"       value={products.length}                        color="text-primary"       bg="bg-primary/15" />
        <SummaryCard icon={XCircle}       label="Sem estoque"             value={semEstoque}                            color="text-destructive"   bg="bg-destructive/15" />
        <SummaryCard icon={AlertTriangle} label="Estoque baixo"           value={baixo}                                 color="text-amber-600"     bg="bg-amber-500/15" />
        <SummaryCard icon={TrendingUp}    label="Valor total em estoque"  value={`R$ ${totalValue.toFixed(2).replace(".", ",")}`} color="text-emerald-600" bg="bg-emerald-500/15" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input placeholder="Buscar produto, SKU..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 rounded-xl" />
        </div>
        <div className="flex gap-2 items-center">
          <Button variant="outline" size="sm" className="rounded-xl h-9 gap-1.5"><Filter className="w-3.5 h-3.5" />Filtrar</Button>
          <div className="relative">
            <Button variant="outline" size="sm" className="rounded-xl h-9 gap-1.5" onClick={() => setExportOpen(v => !v)}>
              <Download className="w-3.5 h-3.5" />Exportar<ChevronDown className="w-3 h-3" />
            </Button>
            {exportOpen && (
              <div className="absolute right-0 top-full mt-1 z-20 bg-background border border-border/50 rounded-xl shadow-lg overflow-hidden min-w-[140px]">
                <button onClick={handleExportEstoqueCSV} className="w-full text-left px-3 py-2 text-sm hover:bg-secondary/60 flex items-center gap-2"><Download className="w-3.5 h-3.5" />Excel (.csv)</button>
                <button onClick={handleExportEstoquePDF} className="w-full text-left px-3 py-2 text-sm hover:bg-secondary/60 flex items-center gap-2"><FileText className="w-3.5 h-3.5" />PDF (imprimir)</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? <SkeletonRows /> : filtered.length === 0 ? (
        <EmptyState icon={Package} title="Nenhum produto encontrado" desc="Ajuste o filtro ou cadastre produtos no módulo de Produtos." />
      ) : (
        <Card className="rounded-2xl border-border/50 shadow-soft overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 border-b border-border/40">
                <tr>
                  {["Produto", "SKU", "Categoria", "Estoque", "Mín.", "Localização", "Última mov.", "Status"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filtered.map(p => (
                  <tr key={p.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.sku}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.category}</td>
                    <td className="px-4 py-3 font-bold">{p.stock}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.minStock}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.location}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{p.lastMovement}</td>
                    <td className="px-4 py-3"><StockStatusBadge stock={p.stock} min={p.minStock} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── SEÇÃO: ENTRADA ───────────────────────────────────────────────
// Formas de pagamento com baixa automática no financeiro
const BAIXA_AUTOMATICA = ["Dinheiro", "Pix"];

function SecaoEntrada() {
  const [showForm, setShowForm] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [alertaBaixa, setAlertaBaixa] = useState<string | null>(null);
  const [items, setItems] = useState<EntryItem[]>([{ product: "", qty: "", cost: "", lot: "", expiry: "" }]);
  const [supplier, setSupplier] = useState("");
  const [nf, setNf] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [obs, setObs] = useState("");
  const [payMethod, setPayMethod] = useState("Boleto");
  const [installments, setInstallments] = useState("1");
  const [dueDate, setDueDate] = useState("");
  const [sendToFinancial, setSendToFinancial] = useState(true);
  const [saved, setSaved] = useState(false);

  const addItem = () => setItems(v => [...v, { product: "", qty: "", cost: "", lot: "", expiry: "" }]);
  const removeItem = (i: number) => setItems(v => v.filter((_, idx) => idx !== i));
  const setItem = (i: number, k: keyof EntryItem, v: string) =>
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [k]: v } : it));

  const total = items.reduce((s, it) => s + (parseFloat(it.qty || "0") * parseFloat(it.cost || "0")), 0);
  const parcelValue = installments && parseInt(installments) > 0 ? total / parseInt(installments) : total;

  const resetForm = () => {
    setItems([{ product: "", qty: "", cost: "", lot: "", expiry: "" }]);
    setSupplier("");
    setNf("");
    setDate(new Date().toISOString().split("T")[0]);
    setObs("");
    setPayMethod("Boleto");
    setInstallments("1");
    setDueDate("");
    setSendToFinancial(true);
    setEditandoId(null);
  };

  const handleSave = () => {
    if (editandoId) {
      // Modo edição: atualiza sem duplicar no financeiro
      console.log(`[EDITAR ENTRADA] ID: ${editandoId} - Atualizando sem duplicar no financeiro`);
    } else {
      // Modo criação: cria novo
      console.log(`[CRIAR ENTRADA] Nova entrada registrada`);
    }
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      setShowForm(false);
      resetForm();
    }, 2500);
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
    setSupplier(entrada.note?.includes("NF") ? "" : entrada.note || "");
    setObs(entrada.note || "");
    setDate(entrada.date.split(" ")[0].split("/").reverse().join("-"));
    setItems([{ product: entrada.product, qty: String(entrada.qty), cost: "", lot: "", expiry: "" }]);
    setShowForm(true);
  };

  const handleCancelar = () => {
    setShowForm(false);
    resetForm();
  };

  // Lista de últimas entradas
  const ultimasEntradas = MOCK_MOVEMENTS.filter(m => m.type === "entrada").slice(0, 6);

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
                <a href="/admin/financial" className="text-xs font-semibold text-primary hover:text-primary/80 inline-flex items-center gap-1">
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
            <Input placeholder="Nome do fornecedor" value={supplier} onChange={e => setSupplier(e.target.value)} className="h-10 rounded-xl" /></div>
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
            <div key={i} className="grid grid-cols-[1fr_70px_90px_90px_110px_36px] gap-2 items-center">
              <Input placeholder="Produto" value={it.product} onChange={e => setItem(i, "product", e.target.value)} className="h-9 rounded-xl text-sm" />
              <Input placeholder="Qtd" type="number" value={it.qty} onChange={e => setItem(i, "qty", e.target.value)} className="h-9 rounded-xl text-sm" />
              <Input placeholder="Custo" type="number" value={it.cost} onChange={e => setItem(i, "cost", e.target.value)} className="h-9 rounded-xl text-sm" />
              <Input placeholder="Lote" value={it.lot} onChange={e => setItem(i, "lot", e.target.value)} className="h-9 rounded-xl text-sm" />
              <Input type="date" value={it.expiry} onChange={e => setItem(i, "expiry", e.target.value)} className="h-9 rounded-xl text-sm" />
              <button onClick={() => removeItem(i)} className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                <X className="w-3.5 h-3.5" />
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

      <div className="flex gap-3">
        <Button variant="outline" className="rounded-xl gap-2" onClick={handleCancelar}><ArrowLeftRight className="w-4 h-4 rotate-180" />Voltar</Button>
        <Button variant="outline" className="rounded-xl gap-2"><FileText className="w-4 h-4" />Salvar rascunho</Button>
        <Button className="rounded-xl gap-2 bg-gradient-primary text-primary-foreground" onClick={handleSave}>
          {saved ? <><Check className="w-4 h-4" />{editandoId ? "Atualizado!" : "Confirmado!"}</> : <><CheckCircle2 className="w-4 h-4" />{editandoId ? "Salvar alterações" : "Confirmar entrada"}</>}
        </Button>
      </div>
    </div>
  );
}

// ─── SEÇÃO: SAÍDA ─────────────────────────────────────────────────
const EXIT_TYPES = ["Venda", "Perda", "Uso interno", "Troca", "Avaria"];

function SecaoSaida() {
  const [showForm, setShowForm] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [alertaBaixa, setAlertaBaixa] = useState<string | null>(null);
  const [items, setItems] = useState<ExitItem[]>([{ product: "", qty: "" }]);
  const [tipo, setTipo] = useState("Venda");
  const [responsavel, setResponsavel] = useState("");
  const [obs, setObs] = useState("");
  const [saved, setSaved] = useState(false);

  const addItem = () => setItems(v => [...v, { product: "", qty: "" }]);
  const removeItem = (i: number) => setItems(v => v.filter((_, idx) => idx !== i));
  const setItem = (i: number, k: keyof ExitItem, v: string) =>
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [k]: v } : it));

  const resetForm = () => {
    setItems([{ product: "", qty: "" }]);
    setTipo("Venda");
    setResponsavel("");
    setObs("");
    setEditandoId(null);
  };

  const handleSave = () => {
    if (editandoId) {
      // Modo edição: atualiza sem duplicar no financeiro
      console.log(`[EDITAR SAÍDA] ID: ${editandoId} - Atualizando sem duplicar no financeiro`);
    } else {
      // Modo criação: cria novo
      console.log(`[CRIAR SAÍDA] Nova saída registrada`);
    }
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      setShowForm(false);
      resetForm();
    }, 2000);
  };

  const handleEditar = (saida: Movement) => {
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
    setItems([{ product: saida.product, qty: String(saida.qty) }]);
    setShowForm(true);
  };

  const handleCancelar = () => {
    setShowForm(false);
    resetForm();
  };

  // Lista de últimas saídas
  const ultimasSaidas = MOCK_MOVEMENTS.filter(m => m.type === "saida").slice(0, 6);

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
                <a href="/admin/financial" className="text-xs font-semibold text-primary hover:text-primary/80 inline-flex items-center gap-1">
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
                    <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center shrink-0">
                      <ArrowDownCircle className="w-4.5 h-4.5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">{m.product}</span>
                        <span className="text-xs bg-blue-500/15 text-blue-600 px-2 py-0.5 rounded-full shrink-0">Saída</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                        <span>{m.date}</span>
                        <span>• {m.user}</span>
                        {m.note && <span className="truncate">• {m.note}</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0 flex flex-col items-end gap-1">
                      <span className="font-bold text-sm text-rose-600">-{m.qty} un</span>
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
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase">Responsável</Label>
            <div className="relative">
              <select value={responsavel} onChange={e => setResponsavel(e.target.value)} className="w-full h-10 px-3 pr-8 text-sm rounded-xl border border-input bg-background appearance-none focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">Selecionar usuário…</option>
                {MOCK_USERS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            </div>
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
            <div key={i} className="grid grid-cols-[1fr_100px_36px] gap-2 items-center">
              <Input placeholder="Produto" value={it.product} onChange={e => setItem(i, "product", e.target.value)} className="h-9 rounded-xl text-sm" />
              <Input placeholder="Qtd" type="number" value={it.qty} onChange={e => setItem(i, "qty", e.target.value)} className="h-9 rounded-xl text-sm" />
              <button onClick={() => removeItem(i)} className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button variant="outline" className="rounded-xl gap-2" onClick={handleCancelar}><ArrowLeftRight className="w-4 h-4 rotate-180" />Voltar</Button>
        <Button className="rounded-xl gap-2 bg-gradient-primary text-primary-foreground" onClick={handleSave}>
          {saved ? <><Check className="w-4 h-4" />{editandoId ? "Atualizado!" : "Registrado!"}</> : <><ArrowDownCircle className="w-4 h-4" />{editandoId ? "Salvar alterações" : "Confirmar saída"}</>}
        </Button>
      </div>
    </div>
  );
}

// ─── SEÇÃO: TRANSFERÊNCIAS ────────────────────────────────────────
function SecaoTransferencias() {
  const [items, setItems] = useState<TransferItem[]>([{ product: "", qty: "" }]);
  const [origem, setOrigem] = useState("");
  const [destino, setDestino] = useState("");
  const [obs, setObs] = useState("");
  const [saved, setSaved] = useState(false);

  const addItem = () => setItems(v => [...v, { product: "", qty: "" }]);
  const removeItem = (i: number) => setItems(v => v.filter((_, idx) => idx !== i));
  const setItem = (i: number, k: keyof TransferItem, v: string) =>
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [k]: v } : it));

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
      <div className="w-16 h-16 rounded-2xl bg-amber-500/15 flex items-center justify-center">
        <AlertTriangle className="w-8 h-8 text-amber-500" />
      </div>
      <div>
        <p className="font-semibold text-base">Módulo em desenvolvimento</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">A seção de transferências entre depósitos está sendo lapidada. Em breve estará disponível.</p>
      </div>
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-500/15 text-amber-600"><Clock className="w-3.5 h-3.5" />Em breve</span>
    </div>
  );
}

// ─── SEÇÃO: EXTRATO ───────────────────────────────────────────────
function SecaoExtrato() {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("todos");
  const movements = MOCK_MOVEMENTS;

  const filtered = movements.filter(m => {
    const matchSearch = m.product.toLowerCase().includes(search.toLowerCase()) || m.note.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === "todos" || m.type === filterType;
    return matchSearch && matchType;
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input placeholder="Buscar produto" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 rounded-xl" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {["todos", "entrada", "saida", "ajuste", "transferencia", "perda"].map(t => (
            <button key={t} onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${filterType === t ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
              {t === "todos" ? "Todos" : MOV_TYPE_CONFIG[t]?.label ?? t}
            </button>
          ))}
          <Button variant="outline" size="sm" className="rounded-xl h-8 gap-1.5"><Download className="w-3.5 h-3.5" />Exportar</Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={FileText} title="Nenhuma movimentação" desc="Sem resultados para os filtros selecionados." />
      ) : (
        <div className="space-y-2">
          {filtered.map(m => {
            const cfg = MOV_TYPE_CONFIG[m.type] ?? { label: m.type, color: "text-foreground", bg: "bg-secondary", icon: Activity };
            const Icon = cfg.icon;
            const positive = m.qty > 0;
            return (
              <Card key={m.id} className="rounded-2xl border-border/50 shadow-soft hover:shadow-ambient transition-all">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl ${cfg.bg} flex items-center justify-center shrink-0`}>
                      <Icon className={`w-4.5 h-4.5 ${cfg.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{m.product}</span>
                        <MovTypeBadge type={m.type} />
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                        <span>{m.date}</span>
                        <span>Por {m.user}</span>
                        {m.note && <span className="truncate">{m.note}</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`font-bold text-base ${positive ? "text-emerald-600" : "text-destructive"}`}>
                        {positive ? "+" : ""}{m.qty} un
                      </span>
                      <div className="text-xs text-muted-foreground mt-0.5">{m.balanceBefore} → {m.balanceAfter}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── SEÇÃO: BALANÇO (antigo Inventário) ───────────────────────────
interface BalancoRecord {
  codigo: string;
  contagem: string;
  encerramento: string;
  status: "aberto" | "encerrado";
  produtos: "todos" | "alguns";
  preco: string;
}

const MOCK_BALANCOS: BalancoRecord[] = [
  { codigo: "100.001.077", contagem: "31/07/2025 10:39", encerramento: "31/07/2025 10:47", status: "encerrado", produtos: "todos", preco: "Preço de custo" },
  { codigo: "100.001.111", contagem: "31/07/2025 10:50", encerramento: "31/07/2025 10:50", status: "encerrado", produtos: "alguns", preco: "Preço de custo" },
  { codigo: "100.001.112", contagem: "31/07/2025 10:43", encerramento: "31/07/2025 10:43", status: "aberto",    produtos: "todos", preco: "Preço de custo" },
];

function gerarCodigo() {
  const n = Math.floor(100000000 + Math.random() * 900000000);
  return `${String(n).slice(0,3)}.${String(n).slice(3,6)}.${String(n).slice(6,9)}`;
}

function SecaoInventario() {
  const allProducts = MOCK_PRODUCTS;

  const [view, setView] = useState<"lista" | "novo">("lista");
  const [balancos, setBalancos] = useState<BalancoRecord[]>(MOCK_BALANCOS);

  // form state
  const [prodScope, setProdScope] = useState<"todos" | "alguns">("todos");
  const [preco, setPreco] = useState("Preço de custo");
  const [dataContagem, setDataContagem] = useState(new Date().toISOString().split("T")[0]);
  const [dataEnc, setDataEnc] = useState("");
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [addSearch, setAddSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [encerrado, setEncerrado] = useState(false);

  const setCount = (id: string, v: string) => setCounts(prev => ({ ...prev, [id]: v }));

  const visibleProducts = prodScope === "todos"
    ? allProducts
    : allProducts.filter(p => selectedIds.includes(p.id));

  const filteredAdd = allProducts.filter(p =>
    !selectedIds.includes(p.id) &&
    (p.name.toLowerCase().includes(addSearch.toLowerCase()) || p.sku.toLowerCase().includes(addSearch.toLowerCase()))
  );

  const divergencias = visibleProducts.filter(p => {
    if (prodScope === "todos") {
      const c = parseInt(counts[p.id] || "");
      return isNaN(c) || c !== p.stock;
    }
    const c = parseInt(counts[p.id] || "");
    return !isNaN(c) && c !== p.stock;
  });

  const handleEncerrar = () => {
    setEncerrado(true);
    setDataEnc(new Date().toLocaleString("pt-BR"));
  };

  const handleSalvar = () => {
    const novo: BalancoRecord = {
      codigo: gerarCodigo(),
      contagem: new Date(dataContagem + "T00:00:00").toLocaleDateString("pt-BR") + " " + new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      encerramento: encerrado ? dataEnc : "—",
      status: encerrado ? "encerrado" : "aberto",
      produtos: prodScope,
      preco,
    };
    setBalancos(prev => [novo, ...prev]);
    setView("lista");
    setProdScope("todos"); setPreco("Preço de custo"); setCounts({}); setSelectedIds([]); setEncerrado(false); setDataEnc("");
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
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "balanco.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const [exportRowOpen, setExportRowOpen] = useState<string | null>(null);

  // ── Lista de balanços ──
  if (view === "lista") {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Histórico de balanços realizados.</p>
          <Button className="rounded-xl gap-2 h-9 bg-gradient-primary text-primary-foreground" onClick={() => setView("novo")}>
            <Plus className="w-4 h-4" />Novo Balanço
          </Button>
        </div>

        <Card className="rounded-2xl border-border/50 shadow-soft overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 border-b border-border/40">
                <tr>
                  {["Código", "Produtos", "Data contagem", "Data encerramento", "Status", "Ações"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {balancos.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground text-sm">Nenhum balanço registrado.</td></tr>
                ) : balancos.map(b => (
                  <tr key={b.codigo} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-semibold">{b.codigo}</td>
                    <td className="px-4 py-3 text-xs capitalize">{b.produtos}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{b.contagem}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{b.encerramento}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${b.status === "encerrado" ? "bg-secondary text-muted-foreground" : "bg-emerald-500/15 text-emerald-600"}`}>
                        {b.status === "encerrado" ? "Encerrado" : "Em aberto"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        <button className="text-xs px-2 py-1 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors flex items-center gap-1">
                          <FileText className="w-3 h-3" />Visualizar
                        </button>
                        <div className="relative">
                          <button onClick={() => setExportRowOpen(v => v === b.codigo ? null : b.codigo)} className="text-xs px-2 py-1 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors flex items-center gap-1">
                            <Download className="w-3 h-3" />Exportar<ChevronDown className="w-2.5 h-2.5" />
                          </button>
                          {exportRowOpen === b.codigo && (
                            <div className="absolute right-0 top-full mt-1 z-20 bg-background border border-border/50 rounded-xl shadow-lg overflow-hidden min-w-[150px]">
                              <button onClick={() => { handleDownload(); setExportRowOpen(null); }} className="w-full text-left px-3 py-2 text-xs hover:bg-secondary/60 flex items-center gap-2"><Download className="w-3 h-3" />Excel (.csv)</button>
                              <button onClick={() => { handleDownloadPDF(); setExportRowOpen(null); }} className="w-full text-left px-3 py-2 text-xs hover:bg-secondary/60 flex items-center gap-2"><FileText className="w-3 h-3" />PDF (download)</button>
                            </div>
                          )}
                        </div>
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
          <h3 className="font-semibold text-base">Novo Balanço</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Lançamento: <span className="font-medium">Novo balanço</span></p>
        </div>
        <button onClick={() => setView("lista")} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5">
          <X className="w-4 h-4" />Cancelar
        </button>
      </div>

      {/* Configurações */}
      <Card className="rounded-2xl border-border/50 shadow-soft">
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
              <Label className="text-xs font-semibold text-muted-foreground uppercase">Data de encerramento</Label>
              <Input type="date" value={typeof dataEnc === "string" && dataEnc.includes("/") ? "" : dataEnc} onChange={e => setDataEnc(e.target.value)} disabled={encerrado} className="h-9 rounded-xl text-sm disabled:opacity-50" />
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
                  const p = allProducts.find(x => x.id === id);
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
      <Card className="rounded-2xl border-border/50 shadow-soft overflow-hidden">
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
              {visibleProducts.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">Nenhum produto selecionado.</td></tr>
              ) : visibleProducts.map(p => {
                const rawCounted = counts[p.id];
                const efectivo = prodScope === "todos" ? (rawCounted ?? "0") : (rawCounted ?? "");
                const counted = parseInt(efectivo);
                const diff = isNaN(counted) ? null : counted - p.stock;
                return (
                  <tr key={p.id} className={`transition-colors ${diff !== null && diff !== 0 ? "bg-amber-500/5" : "hover:bg-secondary/30"}`}>
                    <td className="px-4 py-2.5 font-medium">{p.name}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{p.sku}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">R$ {p.costPrice.toFixed(2).replace(".", ",")}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">un</td>
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

      {/* Ações */}
      <div className="flex flex-wrap gap-2 pt-1">
        <Button variant="outline" className="rounded-xl gap-1.5 h-9 text-sm" onClick={handleEncerrar} disabled={encerrado}>
          {encerrado ? <><Check className="w-4 h-4 text-emerald-600" />Encerrado</> : <><XCircle className="w-4 h-4" />Encerrar</>}
        </Button>
        <Button variant="outline" className="rounded-xl gap-1.5 h-9 text-sm" onClick={() => window.print()}>
          <FileText className="w-4 h-4" />Imprimir
        </Button>
        <Button variant="outline" className="rounded-xl gap-1.5 h-9 text-sm" onClick={handleDownload}>
          <Download className="w-4 h-4" />Download Excel
        </Button>
        <Button variant="outline" className="rounded-xl gap-1.5 h-9 text-sm" onClick={handleDownloadPDF}>
          <Download className="w-4 h-4" />Download PDF
        </Button>
        <div className="flex-1" />
        <Button variant="outline" className="rounded-xl gap-1.5 h-9 text-sm" onClick={() => setView("lista")}>
          Cancelar
        </Button>
        <Button className="rounded-xl gap-1.5 h-9 text-sm bg-gradient-primary text-primary-foreground" onClick={handleSalvar}>
          <Check className="w-4 h-4" />Salvar balanço
        </Button>
      </div>
    </div>
  );
}

// ─── SEÇÃO: AJUSTES ───────────────────────────────────────────────
const ADJUST_TYPES = ["Correção", "Perda", "Avaria", "Recontagem"];

function SecaoAjustes() {
  const [product, setProduct] = useState("");
  const [qty, setQty] = useState("");
  const [tipo, setTipo] = useState("Correção");
  const [motivo, setMotivo] = useState("");
  const [obs, setObs] = useState("");
  const [saved, setSaved] = useState(false);

  return (
    <div className="space-y-5 max-w-xl">
      <p className="text-sm text-muted-foreground">Realize ajustes pontuais no estoque. Cada ajuste é registrado automaticamente no extrato.</p>
      <Card className="rounded-2xl border-border/50 shadow-soft">
        <CardHeader className="pb-3"><CardTitle className="text-base">Novo ajuste</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5"><Label className="text-xs font-semibold text-muted-foreground uppercase">Produto</Label>
            <Input placeholder="Nome ou SKU do produto" value={product} onChange={e => setProduct(e.target.value)} className="h-10 rounded-xl" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label className="text-xs font-semibold text-muted-foreground uppercase">Tipo de ajuste</Label>
              <div className="relative">
                <select value={tipo} onChange={e => setTipo(e.target.value)} className="w-full h-10 px-3 pr-8 text-sm rounded-xl border border-input bg-background appearance-none focus:outline-none focus:ring-2 focus:ring-ring">
                  {ADJUST_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              </div>
            </div>
            <div className="space-y-1.5"><Label className="text-xs font-semibold text-muted-foreground uppercase">Quantidade (+ / -)</Label>
              <Input type="number" placeholder="Ex: -3 ou +5" value={qty} onChange={e => setQty(e.target.value)} className="h-10 rounded-xl" /></div>
          </div>
          <div className="space-y-1.5"><Label className="text-xs font-semibold text-muted-foreground uppercase">Motivo</Label>
            <Input placeholder="Descreva o motivo" value={motivo} onChange={e => setMotivo(e.target.value)} className="h-10 rounded-xl" /></div>
          <div className="space-y-1.5"><Label className="text-xs font-semibold text-muted-foreground uppercase">Observação</Label>
            <Input placeholder="Detalhes adicionais" value={obs} onChange={e => setObs(e.target.value)} className="h-10 rounded-xl" /></div>
        </CardContent>
      </Card>
      <Button className="rounded-xl gap-2 bg-gradient-primary text-primary-foreground" onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2000); }}>
        {saved ? <><Check className="w-4 h-4" />Ajuste registrado!</> : <><Settings2 className="w-4 h-4" />Registrar ajuste</>}
      </Button>
    </div>
  );
}

// ─── SEÇÃO: HISTÓRICO ─────────────────────────────────────────────
function SecaoHistorico() {
  const [search, setSearch] = useState("");
  const movements = MOCK_MOVEMENTS;
  const filtered = movements.filter(m =>
    m.product.toLowerCase().includes(search.toLowerCase()) ||
    m.user.toLowerCase().includes(search.toLowerCase()) ||
    m.note.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input placeholder="Buscar por produto ou usuário..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 rounded-xl" />
        </div>
        <Button variant="outline" size="sm" className="rounded-xl h-9 gap-1.5"><Download className="w-3.5 h-3.5" />Exportar log</Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={History} title="Sem registros" desc="Nenhuma movimentação encontrada com os filtros atuais." />
      ) : (
        <div className="relative pl-6 space-y-0 before:absolute before:left-[9px] before:top-2 before:bottom-2 before:w-px before:bg-border/60">
          {filtered.map((m, i) => {
            const cfg = MOV_TYPE_CONFIG[m.type] ?? { label: m.type, color: "text-foreground", bg: "bg-secondary", icon: Activity };
            const Icon = cfg.icon;
            return (
              <div key={m.id} className="relative pb-5">
                <div className={`absolute -left-[19px] w-4 h-4 rounded-full ${cfg.bg} border-2 border-background flex items-center justify-center`}>
                  <Icon className={`w-2 h-2 ${cfg.color}`} />
                </div>
                <div className="pl-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{m.product}</span>
                    <MovTypeBadge type={m.type} />
                    <span className={`text-sm font-bold ${m.qty > 0 ? "text-emerald-600" : "text-destructive"}`}>
                      {m.qty > 0 ? "+" : ""}{m.qty} un
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{m.date}</span>
                    <span>Por {m.user}</span>
                    {m.note && <span>{m.note}</span>}
                    <span>Saldo: {m.balanceBefore} → {m.balanceAfter}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── SEÇÃO: BALANÇO ───────────────────────────────────────────────
function SecaoBalanco() {
  const products = MOCK_PRODUCTS;
  const totalValue = products.reduce((s, p) => s + p.stock * p.costPrice, 0);
  const totalItems = products.reduce((s, p) => s + p.stock, 0);
  const semEstoque = products.filter(p => p.stock === 0).length;
  const baixo = products.filter(p => p.stock > 0 && p.stock <= p.minStock).length;

  const kpis = [
    { icon: TrendingUp,    label: "Valor total em estoque", value: `R$ ${totalValue.toFixed(2).replace(".", ",")}`, color: "text-emerald-600", bg: "bg-emerald-500/15" },
    { icon: Package,       label: "Total de itens",         value: totalItems,                                       color: "text-primary",     bg: "bg-primary/15" },
    { icon: XCircle,       label: "Produtos sem estoque",   value: semEstoque,                                       color: "text-destructive", bg: "bg-destructive/15" },
    { icon: AlertTriangle, label: "Estoque baixo",          value: baixo,                                            color: "text-amber-600",   bg: "bg-amber-500/15" },
    { icon: ArrowUpCircle, label: "Entradas no período",    value: 3,                                                color: "text-emerald-600", bg: "bg-emerald-500/15" },
    { icon: ArrowDownCircle,label:"Saídas no período",      value: 1,                                                color: "text-blue-600",    bg: "bg-blue-500/15" },
    { icon: AlertCircle,   label: "Perdas / Avarias",       value: 1,                                                color: "text-destructive", bg: "bg-destructive/15" },
    { icon: Activity,      label: "Produtos movimentados",  value: 5,                                                color: "text-violet-600",  bg: "bg-violet-500/15" },
  ];

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <select className="h-9 pl-3 pr-8 text-sm rounded-xl border border-input bg-background appearance-none focus:outline-none focus:ring-2 focus:ring-ring">
            <option>Últimos 7 dias</option><option>Últimos 30 dias</option><option>Este mês</option><option>Este ano</option>
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        </div>
        <Button variant="outline" size="sm" className="rounded-xl h-9 gap-1.5"><Download className="w-3.5 h-3.5" />Exportar</Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map(k => <SummaryCard key={k.label} {...k} />)}
      </div>

      {/* Gráfico placeholder */}
      <Card className="rounded-2xl border-border/50 shadow-soft">
        <CardHeader className="pb-2"><CardTitle className="text-base font-semibold">Entradas × Saídas</CardTitle></CardHeader>
        <CardContent>
          <div className="h-[200px]">
            <Suspense fallback={<div className="h-full flex items-center justify-center text-sm text-muted-foreground">Carregando gráfico...</div>}>
              <StockMovementChart data={[
                { name: "Seg", entrada: 8, saida: 3 },
                { name: "Ter", entrada: 5, saida: 2 },
                { name: "Qua", entrada: 12, saida: 7 },
                { name: "Qui", entrada: 3, saida: 1 },
                { name: "Sex", entrada: 9, saida: 4 },
                { name: "Sáb", entrada: 2, saida: 1 },
                { name: "Dom", entrada: 0, saida: 0 },
              ]} />
            </Suspense>
          </div>
        </CardContent>
      </Card>

      {/* Tabela analítica */}
      <Card className="rounded-2xl border-border/50 shadow-soft overflow-hidden">
        <CardHeader className="pb-3"><CardTitle className="text-base font-semibold">Análise por produto</CardTitle></CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 border-b border-border/40">
              <tr>
                {["Produto", "Estoque atual", "Valor unitário", "Valor total", "Última mov.", "Giro", "Risco"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {products.map(p => {
                const vt = p.stock * p.costPrice;
                const giro = p.stock > 50 ? "Alto" : p.stock > 15 ? "Médio" : "Baixo";
                const risco = p.stock === 0 ? "Ruptura" : p.stock <= p.minStock ? "Atenção" : "Normal";
                return (
                  <tr key={p.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3 font-bold">{p.stock}</td>
                    <td className="px-4 py-3 text-muted-foreground">R$ {p.costPrice.toFixed(2).replace(".", ",")}</td>
                    <td className="px-4 py-3 font-semibold">R$ {vt.toFixed(2).replace(".", ",")}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{p.lastMovement}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${giro === "Alto" ? "bg-emerald-500/15 text-emerald-600" : giro === "Médio" ? "bg-blue-500/15 text-blue-600" : "bg-secondary text-muted-foreground"}`}>
                        {giro}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${risco === "Ruptura" ? "bg-destructive/15 text-destructive" : risco === "Atenção" ? "bg-amber-500/15 text-amber-600" : "bg-emerald-500/15 text-emerald-600"}`}>
                        {risco}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─── TABS CONFIG ──────────────────────────────────────────────────
const TABS: { id: MovTab; label: string; icon: React.ElementType }[] = [
  { id: "estoque",          label: "Estoque",             icon: Package },
  { id: "entrada",          label: "Entrada",             icon: ArrowUpCircle },
  { id: "saida",            label: "Saída",               icon: ArrowDownCircle },
  { id: "transferencias",   label: "Transferências",      icon: ArrowLeftRight },
  { id: "extrato",          label: "Extrato",             icon: FileText },
  { id: "inventario",       label: "Balanço",             icon: ClipboardList },
  { id: "ajustes",          label: "Ajustes",             icon: Settings2 },
  { id: "historico",        label: "Histórico",           icon: History },
  { id: "balanco",          label: "Balancete",           icon: BarChart3 },
];

// ─── MAIN PAGE ────────────────────────────────────────────────────
function StockPage() {
  const [tab, setTab] = useState<MovTab>("estoque");

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Movimentação</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Central de controle de estoque e movimentações</p>
        </div>
        <Button variant="outline" size="sm" className="rounded-xl h-9 gap-1.5" onClick={() => window.location.reload()}>
          <RefreshCw className="w-3.5 h-3.5" />Atualizar
        </Button>
      </div>

      {/* Tab Nav */}
      <div className="flex gap-1 overflow-x-auto no-scrollbar border-b border-border/40 pb-px">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium rounded-t-xl whitespace-nowrap transition-colors border-b-2 -mb-px ${
              tab === t.id
                ? "border-primary text-primary bg-primary/5"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div>
        {tab === "estoque"        && <SecaoEstoque />}
        {tab === "entrada"        && <SecaoEntrada />}
        {tab === "saida"          && <SecaoSaida />}
        {tab === "transferencias" && <SecaoTransferencias />}
        {tab === "extrato"        && <SecaoExtrato />}
        {tab === "inventario"     && <SecaoInventario />}
        {tab === "ajustes"        && <SecaoAjustes />}
        {tab === "historico"      && <SecaoHistorico />}
        {tab === "balanco"        && <SecaoBalanco />}
      </div>
    </div>
  );
}
