import { useState, useEffect, lazy, Suspense } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "@/lib/api-client";
import {
  Plus, Pencil, Trash2, Building2, Search, Loader2, Check, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";

const SectorModal = lazy(() => import("./-modal-setor"));

export const Route = createFileRoute("/admin/setores")({
  component: SectorsPage,
  head: () => ({ meta: [{ title: "Setores — ARMAZIX" }] }),
});

export interface Sector {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  active: boolean;
  position: number;
}

function SectorsPage() {
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [hasOpenedModal, setHasOpenedModal] = useState(false);
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

  const openNew = () => { setEditing(null); setModalOpen(true); setHasOpenedModal(true); };
  const openEdit = (s: Sector) => { setEditing(s); setModalOpen(true); setHasOpenedModal(true); };

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

      {hasOpenedModal && (
        <Suspense fallback={null}>
          <SectorModal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            onSaved={handleSaved}
            editing={editing}
          />
        </Suspense>
      )}

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
