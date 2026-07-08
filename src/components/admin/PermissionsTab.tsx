import { useState, useEffect, useCallback } from "react";
import {
  ShieldCheck, Plus, Trash2, Loader2, Check, X,
  Package, DollarSign, BarChart3, CreditCard, RotateCcw,
  AlertTriangle, Lock, Pencil,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api-client";
import { PERMISSION_SECTIONS, SYSTEM_ROLES } from "@/lib/permissions";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RoleProfile {
  id:          string;
  storeId:     string;
  name:        string;
  slug:        string;
  isSystem:    boolean;
  permissions: Record<string, boolean>;
  createdAt:   string;
  updatedAt:   string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_STYLES: Record<string, { bg: string; border: string; dot: string; badge: string }> = {
  admin:    { bg: "bg-blue-50 dark:bg-blue-950/30",    border: "border-blue-200 dark:border-blue-800/50",    dot: "bg-blue-500",    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400" },
  gerente:  { bg: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-emerald-200 dark:border-emerald-800/50", dot: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" },
  vendedor: { bg: "bg-amber-50 dark:bg-amber-950/30",   border: "border-amber-200 dark:border-amber-800/50",   dot: "bg-amber-500",   badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400" },
  operador: { bg: "bg-slate-50 dark:bg-slate-900/40",   border: "border-slate-200 dark:border-slate-700",      dot: "bg-slate-400",   badge: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
};

const CUSTOM_STYLE = {
  bg: "bg-violet-50 dark:bg-violet-950/30",
  border: "border-violet-200 dark:border-violet-800/50",
  dot: "bg-violet-500",
  badge: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400",
};

const SECTION_ICONS: Record<string, React.ReactNode> = {
  cadastros:  <Package className="w-4 h-4" />,
  financeiro: <DollarSign className="w-4 h-4" />,
  relatorios: <BarChart3 className="w-4 h-4" />,
  caixa:      <CreditCard className="w-4 h-4" />,
  estornos:   <RotateCcw className="w-4 h-4" />,
};

const SYSTEM_SLUGS = new Set(SYSTEM_ROLES.map(r => r.slug));

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ msg, type }: { msg: string; type: "success" | "error" }) {
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-lg text-sm font-medium animate-in slide-in-from-bottom-4 duration-200 ${type === "success" ? "bg-emerald-600 text-white" : "bg-destructive text-white"}`}>
      {type === "success" ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
      {msg}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PermissionsTab() {
  const [profiles, setProfiles]     = useState<RoleProfile[]>([]);
  const [selected, setSelected]     = useState<RoleProfile | null>(null);
  const [perms, setPerms]           = useState<Record<string, boolean>>({});
  const [isDirty, setIsDirty]       = useState(false);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);

  // New profile dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName]       = useState("");
  const [createError, setCreateError] = useState("");
  const [creating, setCreating]     = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<RoleProfile | null>(null);
  const [deleting, setDeleting]         = useState(false);

  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback((msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Load profiles
  const loadProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await api.get("/api/role-profiles/list");
      const data = await res.json() as { profiles?: RoleProfile[]; error?: string };
      if (res.ok && data.profiles) {
        // Sort: system roles first (in canonical order), then custom alphabetically
        const order = ["admin", "gerente", "vendedor", "operador"];
        const sorted = [...data.profiles].sort((a, b) => {
          const ai = order.indexOf(a.slug);
          const bi = order.indexOf(b.slug);
          if (ai !== -1 && bi !== -1) return ai - bi;
          if (ai !== -1) return -1;
          if (bi !== -1) return 1;
          return a.name.localeCompare(b.name);
        });
        setProfiles(sorted);
        // Select first if nothing selected
        setSelected(prev => prev ? (sorted.find(p => p.id === prev.id) ?? sorted[0] ?? null) : (sorted[0] ?? null));
      }
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadProfiles(); }, [loadProfiles]);

  // Sync perms when selection changes
  useEffect(() => {
    if (selected) {
      setPerms({ ...selected.permissions });
      setIsDirty(false);
    }
  }, [selected]);

  const handleSelectProfile = (p: RoleProfile) => {
    setSelected(p);
  };

  const handleToggle = (key: string, value: boolean) => {
    setPerms(prev => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  // Save permissions
  const handleSave = async () => {
    if (!selected || !isDirty) return;
    setSaving(true);
    try {
      const res  = await api.post("/api/role-profiles/save", {
        profileId:   selected.id,
        permissions: perms,
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (res.ok) {
        setIsDirty(false);
        setProfiles(prev => prev.map(p => p.id === selected.id ? { ...p, permissions: perms } : p));
        showToast("Permissões salvas com sucesso!", "success");
      } else {
        showToast(data.error ?? "Erro ao salvar", "error");
      }
    } catch {
      showToast("Erro de conexão", "error");
    } finally {
      setSaving(false);
    }
  };

  // Create profile
  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) { setCreateError("Nome obrigatório"); return; }
    setCreating(true);
    setCreateError("");
    try {
      const res  = await api.post("/api/role-profiles/create", { name });
      const data = await res.json() as { success?: boolean; profile?: RoleProfile; error?: string };
      if (res.ok && data.profile) {
        setCreateOpen(false);
        setNewName("");
        await loadProfiles();
        setSelected(data.profile);
        showToast("Perfil criado com sucesso!", "success");
      } else {
        setCreateError(data.error ?? "Erro ao criar perfil");
      }
    } catch {
      setCreateError("Erro de conexão");
    } finally {
      setCreating(false);
    }
  };

  // Delete profile
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res  = await api.post("/api/role-profiles/delete", { profileId: deleteTarget.id });
      const data = await res.json() as { success?: boolean; error?: string };
      if (res.ok) {
        setDeleteTarget(null);
        await loadProfiles();
        showToast("Perfil excluído.", "success");
      } else {
        showToast(data.error ?? "Erro ao excluir", "error");
        setDeleteTarget(null);
      }
    } catch {
      showToast("Erro de conexão", "error");
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 gap-3 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Carregando perfis…</span>
      </div>
    );
  }

  const style = selected ? (ROLE_STYLES[selected.slug] ?? CUSTOM_STYLE) : CUSTOM_STYLE;

  return (
    <div className="flex flex-col lg:flex-row gap-6 min-h-0">

      {/* ── Left: profiles list ──────────────────────────────────── */}
      <div className="w-full lg:w-64 xl:w-72 flex-shrink-0 flex flex-col gap-3">

        {/* New profile button */}
        <Button
          onClick={() => { setNewName(""); setCreateError(""); setCreateOpen(true); }}
          variant="outline"
          className="w-full h-10 rounded-xl border-dashed border-2 gap-2 text-sm font-medium hover:border-primary hover:text-primary transition-colors"
        >
          <Plus className="w-4 h-4" />
          Novo perfil de acesso
        </Button>

        {/* Profile cards */}
        <div className="flex flex-col gap-2">
          {profiles.map(p => {
            const s = ROLE_STYLES[p.slug] ?? CUSTOM_STYLE;
            const isActive = selected?.id === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelectProfile(p)}
                className={`w-full text-left p-3.5 rounded-2xl border transition-all group relative ${
                  isActive
                    ? `${s.bg} ${s.border} shadow-sm ring-1 ring-inset ${s.border}`
                    : "bg-card border-border/50 hover:border-border"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 mt-0.5 ${s.dot}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{p.name}</p>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium mt-0.5 ${s.badge}`}>
                        {p.isSystem ? "Predefinido" : "Personalizado"}
                      </span>
                    </div>
                  </div>
                  {/* Delete button — only for custom profiles */}
                  {!p.isSystem && (
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); setDeleteTarget(p); }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all shrink-0"
                      title="Excluir perfil"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {p.isSystem && (
                    <Lock className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0 mt-0.5" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Right: permission matrix ─────────────────────────────── */}
      <div className="flex-1 min-w-0">
        {!selected ? (
          <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
            <ShieldCheck className="w-10 h-10 opacity-20 mb-3" />
            <p className="text-sm">Selecione um perfil para gerenciar as permissões</p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">

            {/* Profile header */}
            <div className={`flex items-start justify-between gap-4 p-4 rounded-2xl border ${style.bg} ${style.border}`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${style.badge}`}>
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base">{selected.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {selected.isSystem
                      ? "Perfil predefinido — apenas permissões podem ser alteradas"
                      : "Perfil personalizado — permissões e nome editáveis"}
                  </p>
                </div>
              </div>
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 ${style.badge}`}>
                {selected.isSystem ? <Lock className="w-3 h-3" /> : <Pencil className="w-3 h-3" />}
                {selected.isSystem ? "Predefinido" : "Personalizado"}
              </span>
            </div>

            {/* Permission sections */}
            <div className="flex flex-col gap-4">
              {PERMISSION_SECTIONS.map(section => (
                <Card key={section.key} className="rounded-2xl border-border/50 shadow-soft">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                      <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                        {SECTION_ICONS[section.key]}
                      </span>
                      {section.label}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">{section.description}</p>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-0">
                    {section.items.map((item, idx) => (
                      <div
                        key={item.key}
                        className={`flex items-center justify-between gap-4 py-3.5 ${
                          idx < section.items.length - 1 ? "border-b border-border/40" : ""
                        }`}
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          {item.critical && (
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className={`text-sm font-medium ${item.critical ? "text-amber-700 dark:text-amber-400" : ""}`}>
                              {item.label}
                              {item.critical && (
                                <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                  Crítico
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                          </div>
                        </div>
                        <Switch
                          checked={perms[item.key] ?? false}
                          onCheckedChange={v => handleToggle(item.key, v)}
                          className="shrink-0"
                        />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Save button */}
            <div className="flex items-center justify-between gap-4 pt-1 pb-2">
              {isDirty ? (
                <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Há alterações não salvas
                </p>
              ) : (
                <span />
              )}
              <Button
                onClick={handleSave}
                disabled={saving || !isDirty}
                className="h-10 px-6 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Salvar permissões
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Create dialog ─────────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={v => { if (!v) { setCreateOpen(false); setNewName(""); setCreateError(""); } }}>
        <DialogContent className="rounded-2xl max-w-sm p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-5 pb-4">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Plus className="w-5 h-5 text-primary" />
              Novo perfil de acesso
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-0.5">
              Crie um perfil personalizado com permissões específicas para sua equipe.
            </p>
          </DialogHeader>
          <div className="px-6 pb-4 space-y-3">
            {createError && (
              <p className="text-xs text-destructive text-center">{createError}</p>
            )}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Nome do perfil</label>
              <Input
                autoFocus
                placeholder="Ex: Supervisor, Faturista, Caixa…"
                value={newName}
                onChange={e => { setNewName(e.target.value); setCreateError(""); }}
                onKeyDown={e => e.key === "Enter" && handleCreate()}
                className="h-10 rounded-xl"
              />
            </div>
          </div>
          <div className="px-6 py-4 border-t border-border/50 bg-surface flex items-center justify-between">
            <button
              type="button"
              onClick={() => { setCreateOpen(false); setNewName(""); setCreateError(""); }}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancelar
            </button>
            <Button
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
              className="h-10 px-6 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow gap-2"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Criar perfil
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation dialog ────────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={v => { if (!v) setDeleteTarget(null); }}>
        <DialogContent className="rounded-2xl max-w-sm p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-5 pb-4">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-destructive">
              <Trash2 className="w-5 h-5" />
              Excluir perfil
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-0.5">
              Tem certeza que deseja excluir o perfil <strong>{deleteTarget?.name}</strong>? Esta ação não pode ser desfeita.
            </p>
          </DialogHeader>
          <div className="px-6 py-4 border-t border-border/50 bg-surface flex items-center justify-between">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancelar
            </button>
            <Button
              onClick={handleDelete}
              disabled={deleting}
              variant="destructive"
              className="h-10 px-6 rounded-xl gap-2"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Excluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  );
}
