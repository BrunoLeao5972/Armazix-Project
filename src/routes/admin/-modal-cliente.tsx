import { useState, useEffect } from "react";
import { api } from "@/lib/api-client";
import {
  Check, ChevronDown, FileText, Loader2, Mail, MapPin, Instagram, Phone, Search, User, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { maskPhone } from "./clientes";
import type { Customer } from "./clientes";

interface CustomerForm {
  type: "pf" | "pj";
  name: string;
  cpf: string;
  birthdate: string;
  phone: string;
  whatsapp: string;
  email: string;
  instagram: string;
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  notes: string;
  isSupplier: boolean;
  isDeliverer: boolean;
  status: "ativo" | "inativo" | "suspenso";
}

const EMPTY: CustomerForm = {
  type: "pf", name: "", cpf: "", birthdate: "",
  phone: "", whatsapp: "", email: "", instagram: "",
  cep: "", street: "", number: "", complement: "",
  neighborhood: "", city: "", state: "", notes: "",
  isSupplier: false,
  isDeliverer: false,
  status: "ativo",
};

const BR_STATES = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS",
  "MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

// ─── Masks ────────────────────────────────────────────────────────
const maskCPF  = (v: string) => v.replace(/\D/g, "").substring(0, 11).replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, "$1.$2.$3-$4").replace(/-$/, "");
const maskCNPJ = (v: string) => v.replace(/\D/g, "").substring(0, 14).replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, "$1.$2.$3/$4-$5").replace(/-$/, "");
const maskCEP  = (v: string) => v.replace(/\D/g, "").substring(0, 8).replace(/(\d{5})(\d{0,3})/, "$1-$2").replace(/-$/, "");

// ─── Field ────────────────────────────────────────────────────────
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{label}</Label>
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

// ─── Customer Form Modal ──────────────────────────────────────────
export default function CustomerFormModal({
  open, onClose, onSaved, editing,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (c: Customer, isNew: boolean) => void;
  editing: Customer | null;
}) {
  const [form, setForm] = useState<CustomerForm>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [tab, setTab] = useState<"basic" | "contact" | "address" | "notes">("basic");
  const [errors, setErrors] = useState<{ name?: string }>({});

  useEffect(() => {
    if (editing) {
      setForm({ ...EMPTY, name: editing.name, email: editing.email || "", phone: maskPhone(editing.phone || ""), cpf: editing.cpf ? maskCPF(editing.cpf) : "", isSupplier: editing.isSupplier ?? false, isDeliverer: editing.isDeliverer ?? false, status: (editing.status as CustomerForm["status"]) ?? "ativo" });
    } else {
      setForm(EMPTY);
    }
    setTab("basic");
  }, [editing, open]);

  const set = (k: keyof CustomerForm, v: string | boolean) => setForm(f => ({ ...f, [k]: v }));

  const lookupCEP = async (cep: string) => {
    const raw = cep.replace(/\D/g, "");
    if (raw.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${raw}/json/`);
      const d = await res.json();
      if (!d.erro) {
        setForm(f => ({ ...f, street: d.logradouro || "", neighborhood: d.bairro || "", city: d.localidade || "", state: d.uf || "" }));
      }
    } catch {} finally { setCepLoading(false); }
  };

  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!form.name.trim()) {
      setErrors({ name: "O nome do contato é obrigatório." });
      setTab("basic");
      return;
    }
    setErrors({});
    setSaveError(null);
    setSaving(true);
    try {
      let res: Response;
      let data: { success?: boolean; customer?: Customer; error?: string };

      if (editing?.id) {
        // UPDATE — envia o id do registro existente; nunca cria duplicata
        res = await api.post("/api/customers/update", {
          customerId:  editing.id,
          name:        form.name,
          email:       form.email || undefined,
          phone:       form.phone.replace(/\D/g, "") || undefined,
          cpf:         form.cpf.replace(/\D/g, "")   || undefined,
          isSupplier:  form.isSupplier,
          isDeliverer: form.isDeliverer,
          status:      form.status,
        });
        data = await res.json();
        if (res.ok && data.customer) {
          onSaved(data.customer, false);
          onClose();
        } else {
          setSaveError(data.error || "Erro ao atualizar. Tente novamente.");
        }
      } else {
        // INSERT — apenas quando não há id (contato novo)
        res = await api.post("/api/customers/create", {
          name:        form.name,
          email:       form.email || undefined,
          phone:       form.phone.replace(/\D/g, "") || undefined,
          cpf:         form.cpf.replace(/\D/g, "")   || undefined,
          isSupplier:  form.isSupplier,
          isDeliverer: form.isDeliverer,
          status:      form.status,
        });
        data = await res.json();
        if (res.ok && data.customer) {
          onSaved(data.customer, true);
          onClose();
        } else {
          setSaveError(data.error || "Erro ao cadastrar. Tente novamente.");
        }
      }
    } catch {
      setSaveError("Erro de conexão. Verifique sua internet e tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const TABS = [
    { id: "basic",   label: "Dados",     icon: User },
    { id: "contact", label: "Contato",   icon: Phone },
    { id: "address", label: "Endereço",  icon: MapPin },
    { id: "notes",   label: "Notas",     icon: FileText },
  ] as const;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="rounded-2xl max-w-2xl p-0 overflow-hidden max-h-[90vh] flex flex-col">
        <DialogHeader className="px-6 pt-5 pb-0">
          <DialogTitle className="text-lg font-bold">
            {editing ? "Editar contato" : "Novo contato"}
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-0.5">
            {editing ? "Atualize as informações do contato" : "Preencha os dados para cadastrar"}
          </p>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4 border-b border-border/50 overflow-x-auto no-scrollbar">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-xl whitespace-nowrap transition-colors border-b-2 -mb-px
                ${tab === t.id ? "border-primary text-primary bg-primary/5" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">

          {/* ── Dados ── */}
          {tab === "basic" && (
            <>
              {/* Tipo PF/PJ */}
              <div className="flex gap-2 p-1 bg-secondary/40 rounded-xl w-fit">
                {(["pf", "pj"] as const).map(t => (
                  <button key={t} type="button" onClick={() => set("type", t)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${form.type === t ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                    {t === "pf" ? "Pessoa Física" : "Pessoa Jurídica"}
                  </button>
                ))}
              </div>

              <Field label="Nome completo *">
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input autoFocus placeholder={form.type === "pf" ? "Ex: Maria da Silva" : "Razão Social"}
                    value={form.name}
                    onChange={e => { set("name", e.target.value); setErrors(v => ({ ...v, name: undefined })); }}
                    className={`h-10 rounded-xl pl-9 ${errors.name ? "border-destructive ring-1 ring-destructive" : ""}`} />
                </div>
                {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label={form.type === "pf" ? "CPF" : "CNPJ"}>
                  <Input placeholder={form.type === "pf" ? "000.000.000-00" : "00.000.000/0000-00"}
                    value={form.cpf}
                    onChange={e => set("cpf", form.type === "pf" ? maskCPF(e.target.value) : maskCNPJ(e.target.value))}
                    className="h-10 rounded-xl" />
                </Field>
                {form.type === "pf" && (
                  <Field label="Data de nascimento">
                    <Input type="date" value={form.birthdate} onChange={e => set("birthdate", e.target.value)} className="h-10 rounded-xl" />
                  </Field>
                )}
              </div>

              {/* Supplier toggle */}
              <button
                type="button"
                onClick={() => set("isSupplier", !form.isSupplier)}
                className="w-full flex items-center justify-between p-3.5 rounded-xl border border-border bg-secondary/20 hover:bg-secondary/40 transition-colors text-left"
              >
                <div>
                  <p className="text-sm font-medium">Fornecedor</p>
                  <p className="text-xs text-muted-foreground">Usar como fornecedor nas entradas de estoque</p>
                </div>
                <div className={`w-11 h-6 rounded-full relative shrink-0 transition-colors duration-200 ${form.isSupplier ? "bg-primary" : "bg-border"}`}>
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${form.isSupplier ? "translate-x-5" : "translate-x-0"}`} />
                </div>
              </button>

              {/* Deliverer toggle */}
              <button
                type="button"
                onClick={() => set("isDeliverer", !form.isDeliverer)}
                className="w-full flex items-center justify-between p-3.5 rounded-xl border border-border bg-secondary/20 hover:bg-secondary/40 transition-colors text-left"
              >
                <div>
                  <p className="text-sm font-medium">Entregador</p>
                  <p className="text-xs text-muted-foreground">Responsável por realizar entregas dos pedidos</p>
                </div>
                <div className={`w-11 h-6 rounded-full relative shrink-0 transition-colors duration-200 ${form.isDeliverer ? "bg-primary" : "bg-border"}`}>
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${form.isDeliverer ? "translate-x-5" : "translate-x-0"}`} />
                </div>
              </button>

              {/* Status */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Status</p>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { value: "ativo",    label: "Ativo",    color: "emerald" },
                    { value: "inativo",  label: "Inativo",  color: "secondary" },
                    { value: "suspenso", label: "Suspenso", color: "amber" },
                  ] as const).map(({ value, label, color }) => {
                    const active = form.status === value;
                    const colorClass =
                      color === "emerald"   ? (active ? "border-emerald-500 bg-emerald-500/10 text-emerald-700" : "border-border text-muted-foreground hover:border-emerald-300") :
                      color === "amber"     ? (active ? "border-amber-500 bg-amber-500/10 text-amber-700"       : "border-border text-muted-foreground hover:border-amber-300") :
                                              (active ? "border-border bg-secondary text-foreground"            : "border-border text-muted-foreground hover:bg-secondary/50");
                    return (
                      <button key={value} type="button" onClick={() => set("status", value)}
                        className={`h-9 rounded-xl border text-xs font-semibold transition-all ${colorClass}`}>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* ── Contato ── */}
          {tab === "contact" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Telefone">
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input placeholder="(11) 99999-9999" value={form.phone}
                      onChange={e => set("phone", maskPhone(e.target.value))} className="h-10 rounded-xl pl-9" />
                  </div>
                </Field>
                <Field label="WhatsApp">
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-emerald-500" />
                    <Input placeholder="(11) 99999-9999" value={form.whatsapp}
                      onChange={e => set("whatsapp", maskPhone(e.target.value))} className="h-10 rounded-xl pl-9" />
                  </div>
                </Field>
              </div>

              <Field label="E-mail">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input type="email" placeholder="cliente@email.com" value={form.email}
                    onChange={e => set("email", e.target.value)} className="h-10 rounded-xl pl-9" />
                </div>
              </Field>

              <Field label="Instagram">
                <div className="relative">
                  <Instagram className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input placeholder="@usuario" value={form.instagram}
                    onChange={e => set("instagram", e.target.value)} className="h-10 rounded-xl pl-9" />
                </div>
              </Field>
            </>
          )}

          {/* ── Endereço ── */}
          {tab === "address" && (
            <>
              <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
                <Field label="CEP">
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input placeholder="00000-000" value={form.cep}
                      onChange={e => set("cep", maskCEP(e.target.value))}
                      onBlur={e => lookupCEP(e.target.value)}
                      className="h-10 rounded-xl pl-9" />
                  </div>
                </Field>
                <Button type="button" variant="outline" size="sm"
                  onClick={() => lookupCEP(form.cep)}
                  disabled={cepLoading}
                  className="h-10 rounded-xl gap-1.5">
                  {cepLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  Buscar
                </Button>
              </div>

              <div className="grid grid-cols-[1fr_120px] gap-3">
                <Field label="Rua / Logradouro">
                  <Input placeholder="Rua das Flores" value={form.street}
                    onChange={e => set("street", e.target.value)} className="h-10 rounded-xl" />
                </Field>
                <Field label="Número">
                  <Input placeholder="123" value={form.number}
                    onChange={e => set("number", e.target.value)} className="h-10 rounded-xl" />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Complemento">
                  <Input placeholder="Apto 4B" value={form.complement}
                    onChange={e => set("complement", e.target.value)} className="h-10 rounded-xl" />
                </Field>
                <Field label="Bairro">
                  <Input placeholder="Centro" value={form.neighborhood}
                    onChange={e => set("neighborhood", e.target.value)} className="h-10 rounded-xl" />
                </Field>
              </div>

              <div className="grid grid-cols-[1fr_100px] gap-3">
                <Field label="Cidade">
                  <Input placeholder="São Paulo" value={form.city}
                    onChange={e => set("city", e.target.value)} className="h-10 rounded-xl" />
                </Field>
                <Field label="Estado">
                  <div className="relative">
                    <select value={form.state} onChange={e => set("state", e.target.value)}
                      className="w-full h-10 px-3 pr-8 text-sm rounded-xl border border-input bg-background appearance-none focus:outline-none focus:ring-2 focus:ring-ring transition">
                      <option value="">UF</option>
                      {BR_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  </div>
                </Field>
              </div>
            </>
          )}

          {/* ── Notas ── */}
          {tab === "notes" && (
            <Field label="Observações internas" hint={`${form.notes.length}/500`}>
              <textarea
                placeholder="Preferências, histórico relevante, notas de atendimento..."
                value={form.notes} maxLength={500}
                onChange={e => set("notes", e.target.value)}
                rows={6}
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-input bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring transition"
              />
            </Field>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/50 bg-surface space-y-2">
          {saveError && (
            <p className="text-xs text-destructive text-center">{saveError}</p>
          )}
          <div className="flex items-center justify-between gap-3">
            <button type="button" onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Cancelar
            </button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}
              className="h-10 px-6 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {editing ? "Salvar alterações" : "Cadastrar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
