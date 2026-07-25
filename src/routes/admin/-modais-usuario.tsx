import { useState, useEffect } from "react";
import { api } from "@/lib/api-client";
import { Check, KeyRound, Loader2, Lock, Mail, ShieldCheck, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { StoreUser } from "./usuarios";

interface UserForm {
  name:      string;
  email:     string;
  storeRole: string;
  active:    boolean;
}

const EMPTY_FORM: UserForm = {
  name: "", email: "",
  storeRole: "operador", active: true,
};

const ASSIGNABLE_ROLES = [
  { value: "admin",    label: "Administrador" },
  { value: "gerente",  label: "Gerente" },
  { value: "vendedor", label: "Vendedor" },
  { value: "operador", label: "Operador" },
];

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

export function UserFormModal({
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

  useEffect(() => {
    setForm(editing
      ? { name: editing.name, email: editing.email, storeRole: editing.storeRole, active: editing.active }
      : EMPTY_FORM
    );
    setErrors({});
    setSaveError(null);
  }, [editing, open]);

  const set = <K extends keyof UserForm>(k: K, v: UserForm[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const validate = (): boolean => {
    const errs: typeof errors = {};
    if (!form.name.trim())  errs.name  = "Nome obrigatório";
    if (!form.email.trim()) errs.email = "E-mail obrigatório";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = "E-mail inválido";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    setSaveError(null);
    try {
      // Cadastro novo não cria conta: emite um convite. A senha é definida pela
      // própria pessoa ao aceitar, então o e-mail dela é a prova de identidade.
      const payload = editing
        ? { userId: editing.userId, name: form.name, storeRole: form.storeRole, active: form.active }
        : { name: form.name, email: form.email, storeRole: form.storeRole };

      const res  = await api.post(editing ? "/api/store-users/update" : "/api/store-users/invite", payload);
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
            {editing ? "Editar usuário" : "Convidar para a equipe"}
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-0.5">
            {editing
              ? "Atualize as informações do membro da equipe"
              : "Enviaremos um convite por e-mail. A pessoa define a própria senha ao aceitar."}
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
            <p className="text-xs text-muted-foreground mt-1">
              {editing
                ? "E-mail não pode ser alterado."
                : "O convite vai para este endereço — confira antes de enviar."}
            </p>
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

          {/* Status — só faz sentido em quem já aceitou o convite */}
          {editing && (
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
          )}

          {!editing && (
            <div className="flex gap-2.5 rounded-xl border border-border/60 bg-secondary/30 px-3.5 py-3">
              <Mail className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                A pessoa recebe um link válido por <strong className="text-foreground">7 dias</strong> e
                define a própria senha ao aceitar. Ela só passa a aparecer na equipe depois disso.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/50 bg-surface space-y-2">
          {saveError && <p className="text-xs text-destructive text-center">{saveError}</p>}
          <div className="flex items-center justify-between gap-3">
            <button type="button" onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Cancelar
            </button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim() || (!editing && !form.email.trim())}
              className="h-10 px-6 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {editing ? "Salvar alterações" : "Enviar convite"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Change Password Modal ────────────────────────────────────────────────────

export function ChangePasswordModal({
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
