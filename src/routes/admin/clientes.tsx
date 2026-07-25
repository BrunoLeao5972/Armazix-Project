import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { escapeHtml } from "@/lib/utils";
import {
  Search, Plus, MoreHorizontal, Mail, Phone,
  Check, X, RefreshCw,
  Users, Edit, Trash2, FileDown,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const CustomerFormModal = lazy(() => import("./-modal-cliente"));

export const Route = createFileRoute("/admin/clientes")({
  component: CustomersPage,
  head: () => ({ meta: [{ title: "Clientes/Fornecedores/Entregadores — ARMAZIX" }] }),
});

// ─── Types ────────────────────────────────────────────────────────
export interface Customer {
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

// ─── Masks ────────────────────────────────────────────────────────
export const maskPhone = (v: string) => {
  const d = v.replace(/\D/g, "").substring(0, 11);
  if (d.length <= 10) return d.replace(/^(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
  return d.replace(/^(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
};

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

// ─── Main Page ────────────────────────────────────────────────────
type ContactFilter = "all" | "clients" | "suppliers" | "deliverers";

function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [contactFilter, setContactFilter] = useState<ContactFilter>("all");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [hasOpenedModal, setHasOpenedModal] = useState(false);
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

  const openCreate = () => { setEditing(null); setModalOpen(true); setHasOpenedModal(true); };
  const openEdit   = (c: Customer) => { setEditing(c); setModalOpen(true); setHasOpenedModal(true); };

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
        <td>${escapeHtml(c.name)}</td>
        <td>${c.phone ? escapeHtml(maskPhone(c.phone)) : "—"}</td>
        <td>${escapeHtml(c.email) || "—"}</td>
        <td>${escapeHtml(addr)}</td>
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
    const w = window.open("", "_blank", "noopener");
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

      {hasOpenedModal && (
        <Suspense fallback={null}>
          <CustomerFormModal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            onSaved={handleSaved}
            editing={editing}
          />
        </Suspense>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  );
}
