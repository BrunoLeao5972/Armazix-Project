import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "@/lib/api-client";
import {
  Plus, Pencil, Trash2, Building2, Search, Loader2, Check, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";

export const Route = createFileRoute("/admin/sectors")({
  component: SectorsPage,
  head: () => ({ meta: [{ title: "Setores — ARMAZIX" }] }),
});

interface Sector {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  active: boolean;
  position: number;
}

const PRESET_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#3b82f6", "#64748b",
];

function SectorModal({
  open, onClose, onSaved, editing,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (sector: Sector, isNew: boolean) => void;
  editing: Sector | null;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setDescription(editing.description ?? "");
      setColor(editing.color ?? PRESET_COLORS[0]);
    } else {
      setName("");
      setDescription("");
      setColor(PRESET_COLORS[0]);
    }
    setError(null);
  }, [editing, open]);

  const handleSave = async () => {
    if (!name.trim()) { setError("Nome obrigatório"); return; }
    setSaving(true);
    setError(null);
    try {
      const payload = { name: name.trim(), description: description.trim() || undefined, color };
      const res = editing
        ? await api.post("/api/sectors/update", { sectorId: editing.id, ...payload })
        : await api.post("/api/sectors/create", payload);
      const data = await res.json();
      if (res.ok && data.sector) {
        onSaved(data.sector, !editing);
        onClose();
      } else {
        setError(data?.error ?? "Erro ao salvar setor");
      }
    } catch {
      setError("Erro de conexão");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="rounded-2xl max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar setor" : "Novo setor"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input
              placeholder="Ex: Prateleira A, Refrigerados..."
              value={name}
              onChange={e => setName(e.target.value)}
              className="h-10 rounded-xl"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição <span className="text-muted-foreground font-normal">(opcional)</span></Label>
            <Input
              placeholder="Localização ou observação"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="h-10 rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label>Cor de identificação</Label>
            <div className="flex gap-2 flex-wrap">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  style={{ backgroundColor: c }}
                >
                  {color === c && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
                </button>
              ))}
            </div>
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={onClose} className="flex-1 rounded-xl">
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving} className="flex-1 rounded-xl">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (editing ? "Salvar" : "Criar setor")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SectorsPage() {
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Sector | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const storeId = localStorage.getItem("storeId");
    if (!storeId) { setLoading(false); return; }
    fetch(`/api/sectors/list?storeId=${storeId}`, { credentials: "include" })
      .then(r => r.json())
      .then((d: { sectors?: Sector[] }) => setSectors(d.sectors ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const openNew = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (s: Sector) => { setEditing(s); setModalOpen(true); };

  const handleSaved = (sector: Sector, isNew: boolean) => {
    setSectors(prev =>
      isNew ? [...prev, sector] : prev.map(s => s.id === sector.id ? sector : s)
    );
    showToast(isNew ? "Setor criado!" : "Setor atualizado!");
  };

  const handleDelete = async (sector: Sector) => {
    const ok = await confirm(
      "Excluir setor",
      `Tem certeza que deseja excluir "${sector.name}"? Todos os vínculos com produtos serão removidos.`,
      "Excluir",
    );
    if (!ok) return;
    try {
      const res = await api.post("/api/sectors/delete", { sectorId: sector.id });
      if (res.ok) {
        setSectors(prev => prev.filter(s => s.id !== sector.id));
        showToast("Setor excluído");
      } else {
        showToast("Erro ao excluir setor", "error");
      }
    } catch {
      showToast("Erro de conexão", "error");
    }
  };

  const handleToggleActive = async (sector: Sector) => {
    try {
      const res = await api.post("/api/sectors/update", { sectorId: sector.id, active: !sector.active });
      const data = await res.json();
      if (res.ok && data.sector) {
        setSectors(prev => prev.map(s => s.id === sector.id ? data.sector : s));
      }
    } catch { /* silent */ }
  };

  const filtered = sectors.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.description ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {confirmDialog}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-lg text-sm font-medium animate-in slide-in-from-bottom-4 duration-200 ${
          toast.type === "success" ? "bg-emerald-600 text-white" : "bg-destructive text-white"
        }`}>
          {toast.type === "success" ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      <SectorModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
        editing={editing}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Setores</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Áreas ou locais de armazenamento vinculados a produtos
          </p>
        </div>
        <Button onClick={openNew} className="rounded-xl gap-1.5 h-9">
          <Plus className="w-4 h-4" />Novo setor
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar setor..."
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
          <Building2 className="w-10 h-10 opacity-30" />
          <p className="text-sm">
            {search ? "Nenhum setor encontrado" : "Nenhum setor cadastrado ainda"}
          </p>
          {!search && (
            <Button variant="outline" onClick={openNew} className="rounded-xl gap-1.5 mt-1">
              <Plus className="w-4 h-4" />Criar primeiro setor
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-2">
          {filtered.map(sector => (
            <div
              key={sector.id}
              className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:bg-secondary/30 transition-colors"
            >
              {/* Color dot */}
              <div
                className="w-4 h-4 rounded-full shrink-0"
                style={{ backgroundColor: sector.color ?? "#64748b" }}
              />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{sector.name}</p>
                {sector.description && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{sector.description}</p>
                )}
              </div>

              {/* Active toggle */}
              <button
                type="button"
                role="switch"
                aria-checked={sector.active}
                onClick={() => handleToggleActive(sector)}
                title={sector.active ? "Ativo" : "Inativo"}
                className={`w-9 h-5 rounded-full transition-colors duration-200 relative shrink-0 ${
                  sector.active ? "bg-primary" : "bg-muted-foreground/30"
                }`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
                  sector.active ? "translate-x-4" : "translate-x-0"
                }`} />
              </button>

              {/* Actions */}
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-xl"
                  onClick={() => openEdit(sector)}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => handleDelete(sector)}
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
