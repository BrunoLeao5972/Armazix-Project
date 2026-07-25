import { useState, useEffect } from "react";
import { api } from "@/lib/api-client";
import { ChevronDown, Loader2, MonitorCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Category, PrinterOption, PrintEnvironment } from "./ambientes-impressao";

export default function EnvironmentModal({
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
                  <a href="/admin/impressoras" className="underline underline-offset-2">Cadastrar impressora</a>
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
