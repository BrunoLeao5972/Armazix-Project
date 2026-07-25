import { useEffect, useState } from "react";
import {
  ChevronDown, ArrowUpCircle, ArrowDownCircle, Settings2, ClipboardList,
  ArrowLeftRight, AlertTriangle, Activity,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api-client";

// ─── Types compartilhados entre seções de estoque ──────────────────
export interface Movement {
  id: string; date: string; product: string; type: string;
  qty: number; balanceBefore: number; balanceAfter: number;
  user: string; note: string;
}

export interface DbMovement {
  id: string;
  productId: string | null;
  productName: string;
  type: string;
  quantity: number;
  balanceBefore: number;
  balanceAfter: number;
  origem: string;
  createdByName: string | null;
  createdAt: string;
}

export interface Sector { id: string; name: string; color: string | null; active: boolean }

/** Formas de pagamento com baixa automática no financeiro — usado por Entrada e Saída. */
export const BAIXA_AUTOMATICA = ["Dinheiro", "Pix"];

/** Hook compartilhado: carrega lista de setores ativos da loja. */
export function useSectors() {
  const [sectors, setSectors] = useState<Sector[]>([]);
  useEffect(() => {
    api.get("/api/sectors/list")
      .then(r => r.json())
      .then((d: { sectors?: Sector[] }) => setSectors((d.sectors ?? []).filter(s => s.active)))
      .catch(() => {});
  }, []);
  return sectors;
}

/** Select estilizado para escolha de setor. */
export function SectorSelect({
  sectors, value, onChange, required, error, placeholder,
}: {
  sectors: Sector[];
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  error?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`w-full h-10 px-3 pr-8 text-sm rounded-xl border appearance-none focus:outline-none focus:ring-2 focus:ring-ring bg-background ${
          error ? "border-destructive ring-1 ring-destructive" : "border-input"
        }`}
      >
        <option value="">{placeholder ?? "Selecione o setor..."}</option>
        {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
      {required && !value && error && (
        <p className="text-[11px] text-destructive mt-1">Setor obrigatório</p>
      )}
    </div>
  );
}

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

export const dbTypeToKey = (type: string): string => {
  const map: Record<string, string> = {
    ENTRADA: "entrada", SAIDA: "saida", VENDA: "saida",
    AJUSTE: "ajuste", RECONTAGEM: "ajuste",
    PERDA: "perda", AVARIA: "perda",
    TRANSFERENCIA: "transferencia",
  };
  return map[type.toUpperCase()] ?? "ajuste";
};

export const MOV_TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  entrada:      { label: "Entrada",      color: "text-emerald-600", bg: "bg-emerald-500/15", icon: ArrowUpCircle },
  saida:        { label: "Saída",        color: "text-blue-600",    bg: "bg-blue-500/15",    icon: ArrowDownCircle },
  ajuste:       { label: "Ajuste",       color: "text-violet-600",  bg: "bg-violet-500/15",  icon: Settings2 },
  inventario:   { label: "Inventário",   color: "text-primary",     bg: "bg-primary/15",     icon: ClipboardList },
  transferencia:{ label: "Transferência",color: "text-amber-600",   bg: "bg-amber-500/15",   icon: ArrowLeftRight },
  perda:        { label: "Perda",        color: "text-destructive", bg: "bg-destructive/15", icon: AlertTriangle },
};

export function MovTypeBadge({ type }: { type: string }) {
  const cfg = MOV_TYPE_CONFIG[type] ?? { label: type, color: "text-muted-foreground", bg: "bg-secondary", icon: Activity };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${cfg.bg} ${cfg.color}`}>
      <Icon className="w-3 h-3" />{cfg.label}
    </span>
  );
}

export function SummaryCard({ icon: Icon, label, value, color, bg }: {
  icon: React.ElementType; label: string; value: string | number; color: string; bg: string;
}) {
  return (
    <Card className="rounded-2xl border-border/50 shadow-soft">
      <CardContent className="p-4">
        <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center mb-3`}>
          <Icon className={`w-4.5 h-4.5 ${color}`} />
        </div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
      </CardContent>
    </Card>
  );
}

export function EmptyState({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mb-3">
        <Icon className="w-7 h-7 text-muted-foreground" />
      </div>
      <p className="font-semibold text-sm">{title}</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-xs">{desc}</p>
    </div>
  );
}

export function SkeletonRows({ n = 5 }: { n?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="h-14 rounded-xl bg-secondary/60 animate-pulse" />
      ))}
    </div>
  );
}
