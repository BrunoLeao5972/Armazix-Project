import { useState, useEffect, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "@/lib/api-client";
import {
  Search, Plus, MoreHorizontal, Mail, Phone, Loader2,
  User, MapPin, FileText, Check, X, RefreshCw,
  Users, ChevronDown, Instagram, Edit, Trash2, FileDown,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/customers")({
  component: CustomersPage,
  head: () => ({ meta: [{ title: "Clientes/Fornecedores/Entregadores — ARMAZIX" }] }),
});

// ─── Types ────────────────────────────────────────────────────────
interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  cpf: string | null;
  isSupplier?: boolean;
  isDeliverer?: boolean;
  status?: string;
  ordersCount?: number;
  totalSpent?: string;
  createdAt?: string;
}

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
const maskPhone = (v: string) => {
  const d = v.replace(/\D/g, "").substring(0, 11);
  if (d.length <= 10) return d.replace(/^(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
  return d.replace(/^(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
};
const maskCPF  = (v: string) => v.replace(/\D/g, "").substring(0, 11).replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, "$1.$2.$3-$4").replace(/-$/, "");
const maskCNPJ = (v: string) => v.replace(/\D/g, "").substring(0, 14).replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, "$1.$2.$3/$4-$5").replace(/-$/, "");
const maskCEP  = (v: string) => v.replace(/\D/g, "").substring(0, 8).replace(/(\d{5})(\d{0,3})/, "$1-$2").replace(/-$/, "");

// ─── Helpers ─────────────────────────────────────────────────────
function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map(n => n[0].toUpperCase()).join("");
}

// ─── Toast ────────────────────────────────────────────────────────
function Toast({ msg, type }: { msg: string; type: "success" | "error" }) {
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-lg text-sm font-medium animate-in slide-in-from-bottom-4 duration-200 ${type === "success" ? "bg-emerald-600 text-white" : "bg-destructive text-white"}`}>
      {type === "success" ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
      {msg}
    </div>
  );
}

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
function CustomerFormModal({
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

// ─── Main Page ────────────────────────────────────────────────────
type ContactFilter = "all" | "clients" | "suppliers" | "deliverers";

function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [contactFilter, setContactFilter] = useState<ContactFilter>("all");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback((msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchCustomers = useCallback(async () => {
    const storeId = localStorage.getItem("storeId");
    if (!storeId) { setLoading(false); return; }
    try {
      const res = await fetch(`/api/customers/list?storeId=${storeId}`);
      const data = await res.json();
      if (res.ok) setCustomers(data.customers || []);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const handleSaved = (customer: Customer, isNew: boolean) => {
    setCustomers(prev => isNew ? [customer, ...prev] : prev.map(c => c.id === customer.id ? customer : c));
    showToast(isNew ? "Contato criado com sucesso!" : "Contato atualizado!", "success");
  };

  const openCreate = () => { setEditing(null); setModalOpen(true); };
  const openEdit   = (c: Customer) => { setEditing(c); setModalOpen(true); };

  const filtered = customers.filter(c => {
    if (contactFilter === "clients" && (c.isSupplier || c.isDeliverer)) return false;
    if (contactFilter === "suppliers" && !c.isSupplier) return false;
    if (contactFilter === "deliverers" && !c.isDeliverer) return false;
    return (
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.email || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.phone || "").includes(search)
    );
  });

  const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString("pt-BR", { month: "short", year: "numeric" }) : "—";

  const exportPDF = () => {
    const rows = filtered.map(c => {
      const addr = [c as any].map((x: any) => [
        x.street && x.number ? `${x.street}, ${x.number}` : "",
        x.complement || "",
        x.neighborhood || "",
        x.city && x.state ? `${x.city} — ${x.state}` : (x.city || ""),
        x.cep ? `CEP ${x.cep}` : "",
      ].filter(Boolean).join(", "))[0] || "—";
      return `<tr>
        <td>${c.name}</td>
        <td>${c.phone ? maskPhone(c.phone) : "—"}</td>
        <td>${c.email || "—"}</td>
        <td>${addr}</td>
      </tr>`;
    }).join("");
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>Relatório de Contatos — ARMAZIX</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; font-size: 12px; color: #111; padding: 32px; }
        h1 { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
        p.sub { color: #666; font-size: 11px; margin-bottom: 24px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #f3f4f6; text-align: left; padding: 9px 12px; font-size: 10px; text-transform: uppercase; letter-spacing: .06em; border-bottom: 2px solid #e5e7eb; color: #555; }
        td { padding: 8px 12px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
        tr:hover td { background: #f9fafb; }
        .footer { margin-top: 28px; font-size: 10px; color: #aaa; text-align: right; }
        @media print { body { padding: 16px; } }
      </style></head><body>
      <h1>Relatório de Clientes</h1>
      <p class="sub">Gerado em ${new Date().toLocaleString("pt-BR")} &mdash; ${filtered.length} contato(s)</p>
      <table>
        <thead><tr><th>Nome</th><th>Telefone</th><th>E-mail</th><th>Endereço</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="footer">ARMAZIX</div>
    </body></html>`;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 400);
  };

  if (loading) {
    return (
      <div className="space-y-5 animate-in fade-in duration-300">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-7 w-32 bg-secondary rounded-xl animate-pulse" />
            <div className="h-4 w-24 bg-secondary rounded-xl animate-pulse" />
          </div>
          <div className="h-9 w-32 bg-secondary rounded-xl animate-pulse" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
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
          <h1 className="text-2xl font-bold tracking-tight">Clientes, Fornecedores e Entregadores</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {customers.length} cadastrado{customers.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="rounded-xl h-9"
            onClick={() => { setLoading(true); fetchCustomers(); }}>
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
          <Button variant="outline" size="sm" onClick={exportPDF} disabled={filtered.length === 0}
            className="rounded-xl gap-1.5 h-9">
            <FileDown className="w-3.5 h-3.5" /> PDF
          </Button>
          <Button onClick={openCreate}
            className="h-9 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow gap-2">
            <Plus className="w-4 h-4" /> Novo contato
          </Button>
        </div>
      </div>

      {/* Filter tabs + Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex gap-1 p-1 bg-secondary/40 rounded-xl overflow-x-auto no-scrollbar">
          {([["all", "Todos"], ["clients", "Clientes"], ["suppliers", "Fornecedores"], ["deliverers", "Entregadores"]] as const).map(([v, label]) => (
            <button key={v} onClick={() => setContactFilter(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${contactFilter === v ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {label}
              {v === "all" && customers.length > 0 && <span className="ml-1.5 text-[10px] opacity-60">{customers.length}</span>}
              {v === "clients" && <span className="ml-1.5 text-[10px] opacity-60">{customers.filter(c => !c.isSupplier && !c.isDeliverer).length}</span>}
              {v === "suppliers" && <span className="ml-1.5 text-[10px] opacity-60">{customers.filter(c => c.isSupplier).length}</span>}
              {v === "deliverers" && <span className="ml-1.5 text-[10px] opacity-60">{customers.filter(c => c.isDeliverer).length}</span>}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, e-mail ou telefone..." value={search}
            onChange={e => setSearch(e.target.value)} className="pl-9 h-9 rounded-xl" />
        </div>
      </div>

      {/* Empty state */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
            <Users className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold">{search || contactFilter !== "all" ? "Nenhum resultado" : "Nenhum contato ainda"}</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            {search ? `Não encontramos contatos para "${search}"` : contactFilter === "suppliers" ? "Nenhum fornecedor cadastrado. Crie um contato e marque como fornecedor." : contactFilter === "deliverers" ? "Nenhum entregador cadastrado. Crie um contato e marque como entregador." : contactFilter === "clients" ? "Nenhum cliente cadastrado." : "Comece cadastrando seu primeiro contato"}
          </p>
          {!search && contactFilter === "all" && (
            <Button onClick={openCreate} className="mt-5 h-9 rounded-xl bg-gradient-primary text-primary-foreground gap-2">
              <Plus className="w-4 h-4" /> Cadastrar primeiro contato
            </Button>
          )}
        </div>
      ) : (

        /* List */
        <div className="space-y-2">
          {filtered.map(c => (
            <Card key={c.id}
              className="rounded-2xl border-border/50 shadow-soft hover:shadow-ambient transition-all cursor-pointer group"
              onClick={() => openEdit(c)}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3">

                  {/* Avatar + info */}
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="w-10 h-10 shrink-0">
                      <AvatarFallback className="bg-primary/15 text-primary text-sm font-bold">
                        {initials(c.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold truncate">{c.name}</p>
                        {c.isSupplier && (
                          <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/15 text-amber-700">
                            Fornecedor
                          </span>
                        )}
                        {c.isDeliverer && (
                          <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-blue-500/15 text-blue-700">
                            Entregador
                          </span>
                        )}
                        {c.status === "inativo" && (
                          <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-secondary text-muted-foreground">
                            Inativo
                          </span>
                        )}
                        {c.status === "suspenso" && (
                          <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-destructive/10 text-destructive">
                            Suspenso
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        {c.email && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Mail className="w-3 h-3" />{c.email}
                          </span>
                        )}
                        {c.phone && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Phone className="w-3 h-3" />{maskPhone(c.phone)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right side */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="hidden sm:block text-right">
                      <p className="text-sm font-bold">{c.totalSpent || "R$ 0,00"}</p>
                      <p className="text-xs text-muted-foreground">{c.ordersCount ?? 0} pedidos</p>
                    </div>
                    <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-secondary text-muted-foreground">
                      Desde {fmtDate(c.createdAt)}
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-xl">
                        <DropdownMenuItem className="rounded-lg gap-2" onClick={e => { e.stopPropagation(); openEdit(c); }}>
                          <Edit className="w-3.5 h-3.5" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem className="rounded-lg gap-2 text-destructive focus:text-destructive"
                          onClick={e => e.stopPropagation()}>
                          <Trash2 className="w-3.5 h-3.5" /> Remover
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CustomerFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
        editing={editing}
      />

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  );
}
