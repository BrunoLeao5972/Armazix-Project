import { useState, useEffect, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "@/lib/api-client";
import {
  Search, Plus, MoreHorizontal, Mail, Loader2,
  Check, X, RefreshCw, UserCog, KeyRound, PowerOff, Power,
  ShieldCheck, User, Lock, Edit, Phone,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/users")({
  component: UsersPage,
  head: () => ({ meta: [{ title: "Usuários — ARMAZIX" }] }),
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface StoreUser {
  userId:    string;
  storeRole: string;
  joinedAt:  string;
  name:      string;
  email:     string;
  phone:     string | null;
  cpf:       string | null;
  active:    boolean;
  avatarUrl: string | null;
}

interface UserForm {
  name:            string;
  email:           string;
  storeRole:       string;
  active:          boolean;
  password:        string;
  confirmPassword: string;
}

const EMPTY_FORM: UserForm = {
  name: "", email: "",
  storeRole: "operador", active: true,
  password: "", confirmPassword: "",
};

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  owner:    "Proprietário",
  admin:    "Administrador",
  gerente:  "Gerente",
  vendedor: "Vendedor",
  operador: "Operador",
  cashier:  "Operador",
};

const ROLE_COLORS: Record<string, string> = {
  owner:    "bg-violet-500/15 text-violet-700 dark:text-violet-400",
  admin:    "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  gerente:  "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  vendedor: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  operador: "bg-secondary text-muted-foreground",
  cashier:  "bg-secondary text-muted-foreground",
};

const ASSIGNABLE_ROLES = [
  { value: "admin",    label: "Administrador" },
  { value: "gerente",  label: "Gerente" },
  { value: "vendedor", label: "Vendedor" },
  { value: "operador", label: "Operador" },
];

// ─── Masks ────────────────────────────────────────────────────────────────────

const maskPhone = (v: string) => {
  const d = v.replace(/\D/g, "").substring(0, 11);
  if (d.length <= 10) return d.replace(/^(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
  return d.replace(/^(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map(n => n[0].toUpperCase()).join("");
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ msg, type }: { msg: string; type: "success" | "error" }) {
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-lg text-sm font-medium animate-in slide-in-from-bottom-4 duration-200 ${type === "success" ? "bg-emerald-600 text-white" : "bg-destructive text-white"}`}>
      {type === "success" ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
      {msg}
    </div>
  );
}

// ─── Field ────────────────────────────────────────────────────────────────────

function Field({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ─── User Form Modal ──────────────────────────────────────────────────────────

function UserFormModal({
  open, onClose, onSaved, editing,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (isNew: boolean) => void;
  editing: StoreUser | null;
}) {
  const [form, setForm]       = useState<UserForm>(EMPTY_FORM);
  const [saving, setSaving]   = useState(false);
  const [errors, setErrors]   = useState<Partial<Record<keyof UserForm, string>>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showPw, setShowPw]   = useState(false);

  useEffect(() => {
    setForm(editing
      ? { ...EMPTY_FORM, name: editing.name, email: editing.email, storeRole: editing.storeRole, active: editing.active }
      : EMPTY_FORM
    );
    setErrors({});
    setSaveError(null);
    setShowPw(false);
  }, [editing, open]);

  const set = <K extends keyof UserForm>(k: K, v: UserForm[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const validate = (): boolean => {
    const errs: typeof errors = {};
    if (!form.name.trim())  errs.name  = "Nome obrigatório";
    if (!form.email.trim()) errs.email = "E-mail obrigatório";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = "E-mail inválido";
    if (!editing) {
      if (!form.password)                errs.password = "Senha obrigatória";
      else if (form.password.length < 8) errs.password = "Mínimo 8 caracteres";
      if (form.password !== form.confirmPassword) errs.confirmPassword = "Senhas não coincidem";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const payload = editing
        ? { userId: editing.userId, name: form.name, storeRole: form.storeRole, active: form.active }
        : { name: form.name, email: form.email, storeRole: form.storeRole, active: form.active, password: form.password };

      const res  = await api.post(editing ? "/api/store-users/update" : "/api/store-users/create", payload);
      const data = await res.json() as { success?: boolean; error?: string };

      if (res.ok) { onSaved(!editing); onClose(); }
      else setSaveError(data.error ?? "Erro ao salvar. Tente novamente.");
    } catch {
      setSaveError("Erro de conexão. Verifique sua internet e tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="rounded-2xl max-w-lg p-0 overflow-hidden max-h-[90vh] flex flex-col">
        <DialogHeader className="px-6 pt-5 pb-4">
          <DialogTitle className="text-lg font-bold">
            {editing ? "Editar usuário" : "Novo usuário"}
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-0.5">
            {editing ? "Atualize as informações do membro da equipe" : "Preencha os dados para criar o acesso ao painel"}
          </p>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 px-6 pb-2 space-y-4">

          {/* Nome */}
          <Field label="Nome completo *" error={errors.name}>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                autoFocus
                placeholder="Ex: Maria da Silva"
                value={form.name}
                onChange={e => { set("name", e.target.value); setErrors(v => ({ ...v, name: undefined })); }}
                className={`h-10 rounded-xl pl-9 ${errors.name ? "border-destructive ring-1 ring-destructive" : ""}`}
              />
            </div>
          </Field>

          {/* E-mail */}
          <Field label="E-mail *" error={errors.email}>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                type="email"
                placeholder="usuario@email.com"
                value={form.email}
                onChange={e => { set("email", e.target.value); setErrors(v => ({ ...v, email: undefined })); }}
                disabled={!!editing}
                className={`h-10 rounded-xl pl-9 ${errors.email ? "border-destructive ring-1 ring-destructive" : ""} ${editing ? "opacity-60 cursor-not-allowed" : ""}`}
              />
            </div>
            {editing && <p className="text-xs text-muted-foreground mt-1">E-mail não pode ser alterado.</p>}
          </Field>

          {/* Perfil */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Perfil de acesso</p>
            {form.storeRole === "owner" ? (
              <div className="h-10 rounded-xl border border-border/50 bg-secondary/30 flex items-center px-3 gap-2">
                <ShieldCheck className="w-4 h-4 text-violet-500" />
                <span className="text-sm font-medium">Proprietário</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {ASSIGNABLE_ROLES.map(r => {
                  const active = form.storeRole === r.value;
                  return (
                    <button key={r.value} type="button" onClick={() => set("storeRole", r.value)}
                      className={`h-10 rounded-xl border text-sm font-medium transition-all ${active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"}`}>
                      {r.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Status */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Status</p>
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: true,  label: "Ativo",   color: "emerald" },
                { value: false, label: "Inativo", color: "secondary" },
              ] as const).map(({ value, label, color }) => {
                const active = form.active === value;
                const cls =
                  color === "emerald"
                    ? (active ? "border-emerald-500 bg-emerald-500/10 text-emerald-700" : "border-border text-muted-foreground hover:border-emerald-300")
                    : (active ? "border-border bg-secondary text-foreground" : "border-border text-muted-foreground hover:bg-secondary/50");
                return (
                  <button key={label} type="button" onClick={() => set("active", value)}
                    className={`h-10 rounded-xl border text-sm font-semibold transition-all ${cls}`}>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Senha (apenas no cadastro) */}
          {!editing && (
            <>
              <Field label="Senha *" error={errors.password}>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    type={showPw ? "text" : "password"}
                    placeholder="Mín. 8 caracteres"
                    value={form.password}
                    onChange={e => { set("password", e.target.value); setErrors(v => ({ ...v, password: undefined })); }}
                    className={`h-10 rounded-xl pl-9 pr-16 ${errors.password ? "border-destructive ring-1 ring-destructive" : ""}`}
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground">
                    {showPw ? "ocultar" : "mostrar"}
                  </button>
                </div>
              </Field>

              <Field label="Confirmar senha *" error={errors.confirmPassword}>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    type={showPw ? "text" : "password"}
                    placeholder="Repita a senha"
                    value={form.confirmPassword}
                    onChange={e => { set("confirmPassword", e.target.value); setErrors(v => ({ ...v, confirmPassword: undefined })); }}
                    onKeyDown={e => e.key === "Enter" && handleSave()}
                    className={`h-10 rounded-xl pl-9 ${errors.confirmPassword ? "border-destructive ring-1 ring-destructive" : ""}`}
                  />
                </div>
              </Field>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/50 bg-surface space-y-2">
          {saveError && <p className="text-xs text-destructive text-center">{saveError}</p>}
          <div className="flex items-center justify-between gap-3">
            <button type="button" onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Cancelar
            </button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}
              className="h-10 px-6 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {editing ? "Salvar alterações" : "Criar usuário"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Change Password Modal ────────────────────────────────────────────────────

function ChangePasswordModal({
  open, onClose, onSaved, target,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  target: StoreUser | null;
}) {
  const [pwNew, setPwNew]       = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState(false);

  useEffect(() => {
    setPwNew(""); setPwConfirm(""); setError(""); setSuccess(false); setShowPw(false);
  }, [open]);

  const handleSave = async () => {
    if (!target) return;
    if (!pwNew)               { setError("Nova senha é obrigatória"); return; }
    if (pwNew.length < 8)     { setError("Mínimo 8 caracteres"); return; }
    if (pwNew !== pwConfirm)  { setError("Senhas não coincidem"); return; }
    setSaving(true);
    setError("");
    try {
      const res  = await api.post("/api/store-users/change-password", { userId: target.userId, newPassword: pwNew });
      const data = await res.json() as { success?: boolean; error?: string };
      if (res.ok) { setSuccess(true); setTimeout(() => { onSaved(); onClose(); }, 1000); }
      else setError(data.error ?? "Erro ao alterar senha");
    } catch {
      setError("Erro de conexão");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="rounded-2xl max-w-md p-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-6 pt-5 pb-4">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <KeyRound className="w-5 h-5 text-primary" />
            Alterar senha
          </DialogTitle>
          {target && (
            <p className="text-sm text-muted-foreground mt-0.5">
              Definindo nova senha para <strong>{target.name}</strong>
            </p>
          )}
        </DialogHeader>

        <div className="px-6 pb-2 space-y-4">
          {success ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <Check className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-sm font-medium">Senha alterada com sucesso!</p>
            </div>
          ) : (
            <>
              {error && <p className="text-xs text-destructive text-center">{error}</p>}

              <Field label="Nova senha">
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    type={showPw ? "text" : "password"}
                    placeholder="Mín. 8 caracteres"
                    value={pwNew}
                    onChange={e => setPwNew(e.target.value)}
                    className="h-10 rounded-xl pl-9 pr-16"
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground">
                    {showPw ? "ocultar" : "mostrar"}
                  </button>
                </div>
              </Field>

              <Field label="Confirmar nova senha">
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    type={showPw ? "text" : "password"}
                    placeholder="Repita a senha"
                    value={pwConfirm}
                    onChange={e => setPwConfirm(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleSave()}
                    className="h-10 rounded-xl pl-9"
                  />
                </div>
              </Field>
            </>
          )}
        </div>

        {!success && (
          <div className="px-6 py-4 border-t border-border/50 bg-surface flex items-center justify-between gap-3">
            <button type="button" onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Cancelar
            </button>
            <Button onClick={handleSave} disabled={saving}
              className="h-10 px-6 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Alterar senha
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function UsersPage() {
  const [users, setUsers]       = useState<StoreUser[]>([]);
  const [search, setSearch]     = useState("");
  const [loading, setLoading]   = useState(true);
  const [modalOpen, setModalOpen]     = useState(false);
  const [editing, setEditing]         = useState<StoreUser | null>(null);
  const [pwModalOpen, setPwModalOpen] = useState(false);
  const [pwTarget, setPwTarget]       = useState<StoreUser | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback((msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await api.get("/api/store-users/list");
      const data = await res.json() as { users?: StoreUser[]; error?: string };
      if (res.ok) setUsers(data.users ?? []);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchUsers();
    api.get("/api/user/get")
      .then(r => r.json() as Promise<{ user?: { id: string } }>)
      .then(d => { if (d.user?.id) setCurrentUserId(d.user.id); })
      .catch(() => {});
  }, [fetchUsers]);

  const handleSaved = (isNew: boolean) => {
    fetchUsers();
    showToast(isNew ? "Usuário criado com sucesso!" : "Usuário atualizado!", "success");
  };

  const handleToggleStatus = async (u: StoreUser) => {
    try {
      const res = await api.post("/api/store-users/toggle-status", { userId: u.userId, active: !u.active });
      if (res.ok) { fetchUsers(); showToast(u.active ? "Usuário inativado." : "Usuário ativado!", "success"); }
    } catch {}
  };

  const openCreate = () => { setEditing(null); setModalOpen(true); };
  const openEdit   = (u: StoreUser) => { setEditing(u); setModalOpen(true); };
  const openPw     = (u: StoreUser) => { setPwTarget(u); setPwModalOpen(true); };

  const filtered = users.filter(u => {
    if (!search) return true;
    const q = search.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

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
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[72px] bg-secondary rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-300">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cadastro de Usuários</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {users.length} usuário{users.length !== 1 ? "s" : ""} cadastrado{users.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="rounded-xl h-9"
            onClick={() => { setLoading(true); fetchUsers(); }}>
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
          <Button onClick={openCreate}
            className="h-9 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow gap-2">
            <Plus className="w-4 h-4" /> Novo usuário
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome ou e-mail…" value={search}
          onChange={e => setSearch(e.target.value)} className="pl-9 h-9 rounded-xl" />
      </div>

      {/* Empty state */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
            <UserCog className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold">{search ? "Nenhum resultado" : "Nenhum usuário cadastrado"}</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            {search ? `Não encontramos usuários para "${search}"` : "Comece adicionando o primeiro membro da equipe"}
          </p>
          {!search && (
            <Button onClick={openCreate} className="mt-5 h-9 rounded-xl bg-gradient-primary text-primary-foreground gap-2">
              <Plus className="w-4 h-4" /> Adicionar primeiro usuário
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(u => {
            const isSelf  = u.userId === currentUserId;
            const isOwner = u.storeRole === "owner";
            return (
              <Card key={u.userId}
                className="rounded-2xl border-border/50 shadow-soft hover:shadow-ambient transition-all cursor-pointer group"
                onClick={() => openEdit(u)}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-3">

                    {/* Avatar + info */}
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="w-10 h-10 shrink-0">
                        <AvatarFallback className="bg-primary/15 text-primary text-sm font-bold">
                          {initials(u.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold truncate">{u.name}</p>
                          {isSelf && (
                            <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-secondary text-muted-foreground">
                              você
                            </span>
                          )}
                          <span className={`shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${ROLE_COLORS[u.storeRole] ?? ROLE_COLORS.operador}`}>
                            {isOwner && <ShieldCheck className="w-3 h-3" />}
                            {ROLE_LABELS[u.storeRole] ?? u.storeRole}
                          </span>
                          {!u.active && (
                            <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-destructive/10 text-destructive">
                              Inativo
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Mail className="w-3 h-3" />{u.email}
                          </span>
                          {u.phone && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Phone className="w-3 h-3" />{maskPhone(u.phone)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-xl">
                        <DropdownMenuItem className="rounded-lg gap-2"
                          onClick={e => { e.stopPropagation(); openEdit(u); }}>
                          <Edit className="w-3.5 h-3.5" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem className="rounded-lg gap-2"
                          onClick={e => { e.stopPropagation(); openPw(u); }}>
                          <KeyRound className="w-3.5 h-3.5" /> Alterar senha
                        </DropdownMenuItem>
                        {!isSelf && !isOwner && (
                          <DropdownMenuItem
                            className={`rounded-lg gap-2 ${u.active ? "text-amber-600 focus:text-amber-600" : "text-emerald-600 focus:text-emerald-600"}`}
                            onClick={e => { e.stopPropagation(); handleToggleStatus(u); }}>
                            {u.active ? <><PowerOff className="w-3.5 h-3.5" /> Inativar</> : <><Power className="w-3.5 h-3.5" /> Ativar</>}
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <UserFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
        editing={editing}
      />

      <ChangePasswordModal
        open={pwModalOpen}
        onClose={() => setPwModalOpen(false)}
        onSaved={() => showToast("Senha alterada com sucesso!", "success")}
        target={pwTarget}
      />

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  );
}
