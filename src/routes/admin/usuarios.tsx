import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "@/lib/api-client";
import {
  Search, Plus, MoreHorizontal, Mail,
  Check, X, RefreshCw, UserCog, KeyRound, PowerOff, Power,
  ShieldCheck, Edit, Phone, Clock, Trash2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const UserFormModal = lazy(() =>
  import("./-modais-usuario").then(m => ({ default: m.UserFormModal }))
);
const ChangePasswordModal = lazy(() =>
  import("./-modais-usuario").then(m => ({ default: m.ChangePasswordModal }))
);

export const Route = createFileRoute("/admin/usuarios")({
  component: UsersPage,
  head: () => ({ meta: [{ title: "Usuários — ARMAZIX" }] }),
});

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StoreUser {
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

/** Convite emitido e ainda não aceito — a pessoa ainda não existe na equipe. */
interface PendingInvite {
  id:        string;
  email:     string;
  name:      string;
  role:      string;
  expiresAt: string;
  createdAt: string;
}

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

// ─── Masks ────────────────────────────────────────────────────────────────────

export const maskPhone = (v: string) => {
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

// ─── Main Page ────────────────────────────────────────────────────────────────

function UsersPage() {
  const [users, setUsers]       = useState<StoreUser[]>([]);
  const [invites, setInvites]   = useState<PendingInvite[]>([]);
  const [search, setSearch]     = useState("");
  const [loading, setLoading]   = useState(true);
  const [modalOpen, setModalOpen]     = useState(false);
  const [editing, setEditing]         = useState<StoreUser | null>(null);
  const [hasOpenedModal, setHasOpenedModal] = useState(false);
  const [pwModalOpen, setPwModalOpen] = useState(false);
  const [pwTarget, setPwTarget]       = useState<StoreUser | null>(null);
  const [hasOpenedPwModal, setHasOpenedPwModal] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback((msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, invitesRes] = await Promise.all([
        api.get("/api/store-users/list"),
        api.get("/api/store-users/invites"),
      ]);
      const usersData = await usersRes.json() as { users?: StoreUser[] };
      if (usersRes.ok) setUsers(usersData.users ?? []);

      // Só o owner enxerga convites — para os demais perfis a rota devolve 403
      // e a seção simplesmente não aparece.
      if (invitesRes.ok) {
        const invitesData = await invitesRes.json() as { invites?: PendingInvite[] };
        setInvites(invitesData.invites ?? []);
      } else {
        setInvites([]);
      }
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
    showToast(isNew ? "Convite enviado por e-mail!" : "Usuário atualizado!", "success");
  };

  const handleRevokeInvite = async (invite: PendingInvite) => {
    try {
      const res = await api.post("/api/store-users/invite-revoke", { inviteId: invite.id });
      if (res.ok) {
        setInvites(prev => prev.filter(i => i.id !== invite.id));
        showToast("Convite cancelado.", "success");
      } else {
        showToast("Não foi possível cancelar o convite.", "error");
      }
    } catch {
      showToast("Erro de conexão.", "error");
    }
  };

  const handleToggleStatus = async (u: StoreUser) => {
    try {
      const res = await api.post("/api/store-users/toggle-status", { userId: u.userId, active: !u.active });
      if (res.ok) { fetchUsers(); showToast(u.active ? "Usuário inativado." : "Usuário ativado!", "success"); }
    } catch {}
  };

  const openCreate = () => { setEditing(null); setModalOpen(true); setHasOpenedModal(true); };
  const openEdit   = (u: StoreUser) => { setEditing(u); setModalOpen(true); setHasOpenedModal(true); };
  const openPw     = (u: StoreUser) => { setPwTarget(u); setPwModalOpen(true); setHasOpenedPwModal(true); };

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
            <Plus className="w-4 h-4" /> Convidar usuário
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome ou e-mail…" value={search}
          onChange={e => setSearch(e.target.value)} className="pl-9 h-9 rounded-xl" />
      </div>

      {/* Convites pendentes */}
      {invites.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Convites pendentes ({invites.length})
            </p>
          </div>
          {invites.map(inv => (
            <Card key={inv.id} className="rounded-2xl border-dashed border-border/70 bg-secondary/20 shadow-none">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 shrink-0 rounded-full bg-secondary flex items-center justify-center">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold truncate">{inv.name}</p>
                        <span className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${ROLE_COLORS[inv.role] ?? ROLE_COLORS.operador}`}>
                          {ROLE_LABELS[inv.role] ?? inv.role}
                        </span>
                        <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400">
                          Aguardando aceite
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {inv.email} — expira em {new Date(inv.expiresAt).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="ghost" size="sm"
                    className="rounded-xl h-8 gap-1.5 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => handleRevokeInvite(inv)}
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Cancelar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty state */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
            <UserCog className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold">{search ? "Nenhum resultado" : "Nenhum usuário cadastrado"}</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            {search ? `Não encontramos usuários para "${search}"` : "Comece convidando o primeiro membro da equipe"}
          </p>
          {!search && (
            <Button onClick={openCreate} className="mt-5 h-9 rounded-xl bg-gradient-primary text-primary-foreground gap-2">
              <Plus className="w-4 h-4" /> Convidar primeiro usuário
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

      {hasOpenedModal && (
        <Suspense fallback={null}>
          <UserFormModal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            onSaved={handleSaved}
            editing={editing}
          />
        </Suspense>
      )}

      {hasOpenedPwModal && (
        <Suspense fallback={null}>
          <ChangePasswordModal
            open={pwModalOpen}
            onClose={() => setPwModalOpen(false)}
            onSaved={() => showToast("Senha alterada com sucesso!", "success")}
            target={pwTarget}
          />
        </Suspense>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  );
}
