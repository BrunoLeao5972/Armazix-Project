import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "@/lib/api-client";
import {
  Printer, Plus, Loader2, Check, X, RefreshCw,
  Trash2, Edit, Cpu, MoreHorizontal,
  Download, Zap,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PrinterFormModal = lazy(() => import("./-modais-impressora"));
const PrintPreviewModal = lazy(() =>
  import("./-modais-impressora").then(m => ({ default: m.PrintPreviewModal }))
);

export const Route = createFileRoute("/admin/impressoras")({
  component: PrintersPage,
  head: () => ({ meta: [{ title: "Impressoras — ARMAZIX" }] }),
});

// ─── Types ────────────────────────────────────────────────────────
export interface PrinterRecord {
  id: string;
  code: string;
  name: string;
  type: string;
  driver: string;
  path: string | null;
  columns: number | null;
  active: boolean;
  createdAt: string;
}

export const TYPE_COLORS: Record<string, string> = {
  Produção: "bg-blue-500/15 text-blue-700",
  Caixa:    "bg-emerald-500/15 text-emerald-700",
  Delivery: "bg-orange-500/15 text-orange-700",
};

// ─── Toast ────────────────────────────────────────────────────────
function Toast({ msg, type }: { msg: string; type: "success" | "error" }) {
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-lg text-sm font-medium animate-in slide-in-from-bottom-4 duration-200 ${type === "success" ? "bg-emerald-600 text-white" : "bg-destructive text-white"}`}>
      {type === "success" ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
      {msg}
    </div>
  );
}

// URL do instalador — coloque ArmazixPrinter-Setup.exe em public/downloads/
// ou configure VITE_AGENT_DOWNLOAD_URL no .env
const AGENT_DOWNLOAD_URL: string =
  (import.meta as { env?: Record<string, string> }).env?.VITE_AGENT_DOWNLOAD_URL
  ?? "/downloads/ArmazixPrinter-Setup.exe";

// ─── Agent Status Banner ──────────────────────────────────────────
function AgentBanner() {
  const [status, setStatus] = useState<"checking" | "online" | "offline">("checking");

  const check = useCallback(async () => {
    setStatus("checking");
    try {
      const ctrl  = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 3000);
      const res   = await fetch("http://localhost:3989/health", { signal: ctrl.signal });
      clearTimeout(timer);
      setStatus(res.ok ? "online" : "offline");
    } catch {
      setStatus("offline");
    }
  }, []);

  useEffect(() => { check(); }, [check]);

  return (
    <div className="flex items-center gap-4 px-4 py-3.5 rounded-2xl border border-border/50 bg-secondary/20">
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
        <Cpu className="w-5 h-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold">Armazix Print Agent</p>
          {status === "checking" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary text-muted-foreground text-[11px]">
              <Loader2 className="w-2.5 h-2.5 animate-spin" /> Verificando...
            </span>
          )}
          {status === "online" && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[11px] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
              Ativo · porta 3989
            </span>
          )}
          {status === "offline" && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[11px] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
              Não detectado
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {status === "online"
            ? "Agente rodando — clique no ícone 🔍 no formulário de impressora para selecionar impressoras do PC."
            : "Instale o agente para imprimir direto nas impressoras do computador sem precisar do IP de rede."}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {status !== "checking" && (
          <button onClick={check} title="Verificar status"
            className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        )}
        <a href={AGENT_DOWNLOAD_URL} download="ArmazixPrinter-Setup.exe"
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl border border-border/70 bg-background text-xs font-medium hover:bg-secondary/60 transition-colors whitespace-nowrap">
          <Download className="w-3.5 h-3.5" /> Baixar Agente
        </a>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────
function PrintersPage() {
  const [printersList, setPrintersList] = useState<PrinterRecord[]>([]);
  const [loading, setLoading]       = useState(true);
  const [formOpen, setFormOpen]     = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [hasOpenedForm, setHasOpenedForm] = useState(false);
  const [hasOpenedPreview, setHasOpenedPreview] = useState(false);
  const [editing, setEditing]       = useState<PrinterRecord | null>(null);
  const [previewing, setPreviewing] = useState<PrinterRecord | null>(null);
  const [toast, setToast]           = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [deleting, setDeleting]     = useState<string | null>(null);

  const showToast = useCallback((msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchPrinters = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/printers/list");
      const data = await res.json() as { printers?: PrinterRecord[] };
      if (res.ok) setPrintersList(data.printers ?? []);
    } catch { showToast("Erro ao carregar impressoras", "error"); }
    finally   { setLoading(false); }
  }, [showToast]);

  useEffect(() => { fetchPrinters(); }, [fetchPrinters]);

  const handleSaved = (p: PrinterRecord, isNew: boolean) => {
    setPrintersList(prev => isNew ? [p, ...prev] : prev.map(r => r.id === p.id ? p : r));
    showToast(isNew ? "Impressora cadastrada!" : "Impressora atualizada!", "success");
  };

  const openCreate  = () => { setEditing(null); setFormOpen(true); setHasOpenedForm(true); };
  const openEdit    = (p: PrinterRecord) => { setEditing(p); setFormOpen(true); setHasOpenedForm(true); };
  const openPreview = (p: PrinterRecord) => { setPreviewing(p); setPreviewOpen(true); setHasOpenedPreview(true); };

  const handleDelete = async (p: PrinterRecord) => {
    if (!confirm(`Excluir a impressora "${p.name}"?`)) return;
    setDeleting(p.id);
    try {
      const res = await api.post("/api/printers/delete", { printerId: p.id });
      if (res.ok) { setPrintersList(prev => prev.filter(r => r.id !== p.id)); showToast("Impressora excluída", "success"); }
      else showToast("Erro ao excluir", "error");
    } catch { showToast("Erro de conexão", "error"); }
    finally   { setDeleting(null); }
  };

  if (loading) {
    return (
      <div className="space-y-5 animate-in fade-in duration-300">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-7 w-40 bg-secondary rounded-xl animate-pulse" />
            <div className="h-4 w-24 bg-secondary rounded-xl animate-pulse" />
          </div>
          <div className="h-9 w-36 bg-secondary rounded-xl animate-pulse" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 bg-secondary rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-300">

      {/* Armazix Print Agent — status e download */}
      <AgentBanner />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
            <Printer className="w-6 h-6 text-muted-foreground" /> Impressoras
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {printersList.length} impressora{printersList.length !== 1 ? "s" : ""} cadastrada{printersList.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="rounded-xl h-9" onClick={fetchPrinters}>
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
          <Button onClick={openCreate}
            className="h-9 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow gap-2">
            <Plus className="w-4 h-4" /> Nova Impressora
          </Button>
        </div>
      </div>

      {/* Empty state */}
      {printersList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
            <Printer className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold">Nenhuma impressora cadastrada</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            Cadastre impressoras térmicas para automação de pedidos na cozinha, caixa e delivery
          </p>
          <Button onClick={openCreate} className="mt-5 h-9 rounded-xl bg-gradient-primary text-primary-foreground gap-2">
            <Plus className="w-4 h-4" /> Cadastrar primeira impressora
          </Button>
        </div>
      ) : (
        <div className="space-y-2">

          {/* Column labels — desktop */}
          <div className="hidden sm:grid grid-cols-[80px_1fr_100px_120px_1fr_80px_44px] gap-4 px-4 py-2">
            {["Código", "Nome", "Tipo", "Driver", "Caminho", "Colunas", ""].map((h, i) => (
              <span key={i} className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{h}</span>
            ))}
          </div>

          {printersList.map(p => (
            <Card key={p.id}
              className="rounded-2xl border-border/50 shadow-soft hover:shadow-ambient transition-all cursor-pointer group"
              onClick={() => openEdit(p)}>
              <CardContent className="p-4">

                {/* Desktop row */}
                <div className="hidden sm:grid grid-cols-[80px_1fr_100px_120px_1fr_80px_44px] gap-4 items-center">
                  <span className="text-xs font-mono font-semibold text-muted-foreground">{p.code}</span>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Printer className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-sm font-semibold truncate">{p.name}</span>
                  </div>
                  <span className={`inline-flex items-center px-2 py-1 rounded-lg text-[11px] font-semibold w-fit ${TYPE_COLORS[p.type] ?? "bg-secondary text-muted-foreground"}`}>
                    {p.type}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Cpu className="w-3 h-3 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground">{p.driver}</span>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono truncate">{p.path ?? "—"}</span>
                  <span className="text-xs text-muted-foreground text-center">{p.columns ?? 48} col</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="icon"
                        className="w-8 h-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-xl">
                      <DropdownMenuItem onClick={e => { e.stopPropagation(); openPreview(p); }} className="gap-2 rounded-lg">
                        <Zap className="w-3.5 h-3.5 text-amber-500" /> Testar Impressão
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={e => { e.stopPropagation(); openEdit(p); }} className="gap-2 rounded-lg">
                        <Edit className="w-3.5 h-3.5" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={e => { e.stopPropagation(); handleDelete(p); }}
                        disabled={deleting === p.id}
                        className="gap-2 rounded-lg text-destructive focus:text-destructive">
                        {deleting === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Mobile card */}
                <div className="sm:hidden flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Printer className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold">{p.name}</p>
                        <span className="text-[10px] font-mono text-muted-foreground">{p.code}</span>
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${TYPE_COLORS[p.type] ?? "bg-secondary text-muted-foreground"}`}>
                          {p.type}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">
                        {p.path ?? "—"} · {p.columns ?? 48} col
                      </p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg shrink-0">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-xl">
                      <DropdownMenuItem onClick={e => { e.stopPropagation(); openPreview(p); }} className="gap-2 rounded-lg">
                        <Zap className="w-3.5 h-3.5 text-amber-500" /> Testar Impressão
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={e => { e.stopPropagation(); openEdit(p); }} className="gap-2 rounded-lg">
                        <Edit className="w-3.5 h-3.5" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={e => { e.stopPropagation(); handleDelete(p); }}
                        disabled={deleting === p.id}
                        className="gap-2 rounded-lg text-destructive focus:text-destructive">
                        {deleting === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modals */}
      {hasOpenedForm && (
        <Suspense fallback={null}>
          <PrinterFormModal
            open={formOpen} onClose={() => setFormOpen(false)}
            onSaved={handleSaved} editing={editing}
          />
        </Suspense>
      )}
      {hasOpenedPreview && (
        <Suspense fallback={null}>
          <PrintPreviewModal
            open={previewOpen} onClose={() => setPreviewOpen(false)}
            printer={previewing}
          />
        </Suspense>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  );
}
