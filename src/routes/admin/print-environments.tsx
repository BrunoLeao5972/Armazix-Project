import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "@/lib/api-client";
import {
  Plus, Pencil, Trash2, Printer, Layers, Search,
  Loader2, Check, X, ChevronDown, MonitorCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";

export const Route = createFileRoute("/admin/print-environments")({
  component: PrintEnvironmentsPage,
  head: () => ({ meta: [{ title: "Ambientes de Impressão — ARMAZIX" }] }),
});

// ── Types ────────────────────────────────────────────────────────────────────
interface Category { id: string; name: string; emoji: string | null }
interface PrinterOption { id: string; name: string; type: string }
interface PrintEnvironment {
  id: string;
  code: string;
  name: string;
  active: boolean;
  categoryId: string;
  printerId: string | null;
  category: { id: string; name: string; emoji: string | null } | null;
  printer: { id: string; name: string; type: string } | null;
}

// ── Modal de criação/edição ───────────────────────────────────────────────────
function EnvironmentModal({
  open, onClose, onSaved, editing,
  categories, printers,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (env: PrintEnvironment, isNew: boolean) => void;
  editing: PrintEnvironment | null;
  categories: Category[];
  printers: PrinterOption[];
}) {
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [printerId, setPrinterId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(editing?.name ?? "");
      setCategoryId(editing?.categoryId ?? "");
      setPrinterId(editing?.printerId ?? "");
      setError(null);
    }
  }, [editing, open]);

  const handleSave = async () => {
    if (!name.trim()) { setError("Nome obrigatório"); return; }
    if (!categoryId)  { setError("Selecione uma categoria mãe"); return; }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        categoryId,
        printerId: printerId || null,
      };
      const res = editing
        ? await api.post("/api/print-environments/update", { id: editing.id, ...payload })
        : await api.post("/api/print-environments/create", payload);
      const data = await res.json();
      if (res.ok && data.environment) {
        onSaved(data.environment, !editing);
        onClose();
      } else {
        setError(data?.error ?? "Erro ao salvar ambiente");
      }
    } catch {
      setError("Erro de conexão");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="rounded-2xl max-w-lg p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border/50">
          <DialogTitle className="flex items-center gap-2 text-base">
            <MonitorCheck className="w-4 h-4 text-muted-foreground" />
            {editing ? "Editar ambiente" : "Novo ambiente de impressão"}
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-5 space-y-6">

          {/* BLOCO: INFORMAÇÕES GERAIS */}
          <div className="space-y-4">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
              Informações gerais
            </p>
            <div className="grid grid-cols-[96px_1fr] gap-3">
              {/* Código — read-only */}
              <div className="space-y-1.5">
                <Label className="text-xs">Código</Label>
                <Input
                  disabled
                  value={editing?.code ?? "AUTO"}
                  className="h-10 rounded-xl bg-secondary/40 text-muted-foreground text-xs font-mono text-center"
                />
              </div>
              {/* Nome */}
              <div className="space-y-1.5">
                <Label className="text-xs">Nome do ambiente <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="Ex: COZINHA, BALCÃO, CHAPA..."
                  value={name}
                  onChange={e => setName(e.target.value.toUpperCase())}
                  className="h-10 rounded-xl font-semibold tracking-wide"
                  autoFocus
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* BLOCO: DIRECIONAMENTO */}
          <div className="space-y-4">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
              Direcionamento
            </p>

            {/* Categoria mãe */}
            <div className="space-y-1.5">
              <Label className="text-xs">
                Categoria mãe <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <select
                  value={categoryId}
                  onChange={e => setCategoryId(e.target.value)}
                  className="w-full h-10 rounded-xl border border-border/60 bg-background text-sm px-3 pr-9 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
                >
                  <option value="">Selecione uma categoria mãe...</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.emoji ? `${c.emoji} ` : ""}{c.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-muted-foreground" />
              </div>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Ao selecionar a categoria mãe, todos os produtos e subcategorias contidos nela
                responderão por este ambiente de impressão.
              </p>
            </div>

            {/* Perfil de impressora */}
            <div className="space-y-1.5">
              <Label className="text-xs">Perfil de impressora</Label>
              <div className="relative">
                <select
                  value={printerId}
                  onChange={e => setPrinterId(e.target.value)}
                  className="w-full h-10 rounded-xl border border-border/60 bg-background text-sm px-3 pr-9 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
                >
                  <option value="">Sem impressora vinculada</option>
                  {printers.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.type ? ` — ${p.type}` : ""}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-muted-foreground" />
              </div>
              {printers.length === 0 && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400">
                  Nenhuma impressora cadastrada.{" "}
                  <a href="/admin/printers" className="underline underline-offset-2">Cadastrar impressora</a>
                </p>
              )}
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive font-medium">{error}</p>
          )}

          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 rounded-xl"
            >
              {saving
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : (editing ? "Salvar alterações" : "Criar ambiente")
              }
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
function PrintEnvironmentsPage() {
  const [environments, setEnvironments] = useState<PrintEnvironment[]>([]);
  const [categories,   setCategories]   = useState<Category[]>([]);
  const [printers,     setPrinters]     = useState<PrinterOption[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState("");
  const [modalOpen,    setModalOpen]    = useState(false);
  const [editing,      setEditing]      = useState<PrintEnvironment | null>(null);
  const [toast,        setToast]        = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Carrega lista de ambientes + dados do formulário em paralelo
  useEffect(() => {
    Promise.all([
      fetch("/api/print-environments/list").then(r => r.json()),
      fetch("/api/print-environments/form-data").then(r => r.json()),
    ])
      .then(([listData, formData]: [
        { environments?: PrintEnvironment[] },
        { categories?: Category[]; printers?: PrinterOption[] },
      ]) => {
        setEnvironments(listData.environments ?? []);
        setCategories(formData.categories ?? []);
        setPrinters(formData.printers ?? []);
      })
      .catch(() => showToast("Erro ao carregar dados", "error"))
      .finally(() => setLoading(false));
  }, []);

  const openNew  = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (env: PrintEnvironment) => { setEditing(env); setModalOpen(true); };

  const handleSaved = (env: PrintEnvironment, isNew: boolean) => {
    // Re-fetch para obter dados com joins (categoria + impressora)
    fetch("/api/print-environments/list")
      .then(r => r.json())
      .then((d: { environments?: PrintEnvironment[] }) => setEnvironments(d.environments ?? []))
      .catch(() => {});
    showToast(isNew ? "Ambiente criado!" : "Ambiente atualizado!");
  };

  const handleToggleActive = async (env: PrintEnvironment) => {
    try {
      const res = await api.post("/api/print-environments/update", { id: env.id, active: !env.active });
      const data = await res.json();
      if (res.ok && data.environment) {
        setEnvironments(prev => prev.map(e => e.id === env.id ? { ...e, active: !e.active } : e));
      }
    } catch { /* silent */ }
  };

  const handleDelete = async (env: PrintEnvironment) => {
    const ok = await confirm(
      "Excluir ambiente",
      `Tem certeza que deseja excluir "${env.name}"? Esta ação não pode ser desfeita.`,
      "Excluir",
    );
    if (!ok) return;
    try {
      const res = await api.post("/api/print-environments/delete", { id: env.id });
      if (res.ok) {
        setEnvironments(prev => prev.filter(e => e.id !== env.id));
        showToast("Ambiente excluído");
      } else {
        showToast("Erro ao excluir", "error");
      }
    } catch {
      showToast("Erro de conexão", "error");
    }
  };

  const filtered = environments.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    (e.category?.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (e.printer?.name ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {confirmDialog}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-lg text-sm font-medium animate-in slide-in-from-bottom-4 duration-200 ${
          toast.type === "success" ? "bg-emerald-600 text-white" : "bg-destructive text-white"
        }`}>
          {toast.type === "success" ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      <EnvironmentModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
        editing={editing}
        categories={categories}
        printers={printers}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ambientes de Impressão</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Vincule categorias mãe a perfis de impressora para roteamento automático
          </p>
        </div>
        <Button onClick={openNew} className="rounded-xl gap-1.5 h-9">
          <Plus className="w-4 h-4" />Novo ambiente
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, categoria ou impressora..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 h-9 rounded-xl"
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
          <MonitorCheck className="w-10 h-10 opacity-25" />
          <p className="text-sm">
            {search ? "Nenhum ambiente encontrado" : "Nenhum ambiente cadastrado ainda"}
          </p>
          {!search && (
            <Button variant="outline" onClick={openNew} className="rounded-xl gap-1.5 mt-1">
              <Plus className="w-4 h-4" />Criar primeiro ambiente
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-2">
          {filtered.map(env => (
            <div
              key={env.id}
              className={`flex items-center gap-4 p-4 rounded-xl border transition-colors ${
                env.active
                  ? "border-border bg-card hover:bg-secondary/30"
                  : "border-border/40 bg-secondary/10 opacity-60"
              }`}
            >
              {/* Código */}
              <div className="shrink-0 w-12 h-10 rounded-lg bg-primary/8 border border-primary/15 flex items-center justify-center">
                <span className="text-[11px] font-bold font-mono text-primary">{env.code}</span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-sm font-bold tracking-wide truncate">{env.name}</p>
                <div className="flex items-center gap-3 flex-wrap">
                  {/* Categoria */}
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Layers className="w-3 h-3 shrink-0" />
                    {env.category
                      ? <>{env.category.emoji && <span>{env.category.emoji}</span>}{env.category.name}</>
                      : <span className="text-destructive/70">Categoria removida</span>
                    }
                  </span>
                  {/* Impressora */}
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Printer className="w-3 h-3 shrink-0" />
                    {env.printer
                      ? <>{env.printer.name}<Badge variant="outline" className="ml-1 text-[9px] h-4 px-1.5 rounded-full">{env.printer.type}</Badge></>
                      : <span className="italic opacity-60">Sem impressora</span>
                    }
                  </span>
                </div>
              </div>

              {/* Toggle ativo */}
              <button
                type="button"
                role="switch"
                aria-checked={env.active}
                onClick={() => handleToggleActive(env)}
                title={env.active ? "Ativo" : "Inativo"}
                className={`w-9 h-5 rounded-full transition-colors duration-200 relative shrink-0 ${
                  env.active ? "bg-primary" : "bg-muted-foreground/30"
                }`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
                  env.active ? "translate-x-4" : "translate-x-0"
                }`} />
              </button>

              {/* Ações */}
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost" size="icon"
                  className="h-8 w-8 rounded-xl"
                  onClick={() => openEdit(env)}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost" size="icon"
                  className="h-8 w-8 rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => handleDelete(env)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
