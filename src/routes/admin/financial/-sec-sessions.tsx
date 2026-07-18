import { useState, useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ── Sessões PDV ──────────────────────────────────────────────────
interface CaixaSessaoPdv {
  id: string; saldoInicial: string; saldoFinal: string | null;
  totalDinheiro: string; totalPix: string; totalCartao: string;
  totalDebito: string; totalOutros: string; totalVendas: number;
  status: string; abertoPor: string | null; encerradoPor: string | null;
  openedAt: string; closedAt: string | null;
}

export function SecaoCaixaSessoes() {
  const [sessoes, setSessoes]     = useState<CaixaSessaoPdv[]>([]);
  const [statusFil, setStatusFil] = useState("all");
  const [dateFrom, setDateFrom]   = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo]       = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading]     = useState(false);

  const buscar = async () => {
    setLoading(true);
    try {
      const storeId = localStorage.getItem("storeId") || "";
      const params  = new URLSearchParams({ storeId });
      if (statusFil !== "all") params.set("status", statusFil);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo)   params.set("dateTo", dateTo);
      const res  = await fetch(`/api/pdv/caixa/sessoes?${params}`, { credentials: "include" });
      const data = await res.json() as { sessoes?: CaixaSessaoPdv[] };
      if (res.ok) setSessoes(data.sessoes || []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { buscar(); }, []);

  const fmtBRL = (v: string | number) => {
    const n = typeof v === "string" ? parseFloat(v) : v;
    return "R$ " + (isNaN(n) ? "0,00" : n.toFixed(2).replace(".", ","));
  };
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const totalGeral = sessoes.reduce((s, x) =>
    s + parseFloat(x.totalDinheiro) + parseFloat(x.totalPix) +
    parseFloat(x.totalCartao) + parseFloat(x.totalDebito) + parseFloat(x.totalOutros), 0);

  const totalVendasGeral = sessoes.reduce((s, x) => s + x.totalVendas, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Status</p>
          <select value={statusFil} onChange={e => setStatusFil(e.target.value)}
            className="h-9 px-3 rounded-lg border border-border text-sm font-medium bg-background focus:outline-none focus:ring-1 focus:ring-ring">
            <option value="all">Todos</option>
            <option value="aberta">Aberta</option>
            <option value="encerrada">Encerrada</option>
          </select>
        </div>
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">De</p>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-9 w-36 text-sm" />
        </div>
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Até</p>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-9 w-36 text-sm" />
        </div>
        <Button onClick={buscar} variant="outline" size="sm" className="gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" />Filtrar
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-border/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Sessões</p>
            <p className="text-2xl font-bold mt-1">{sessoes.length}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Vendas</p>
            <p className="text-2xl font-bold mt-1">{totalVendasGeral}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Vendido</p>
            <p className="text-xl font-bold text-emerald-600 mt-1">{fmtBRL(totalGeral)}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Abertas agora</p>
            <p className="text-2xl font-bold mt-1">{sessoes.filter(s => s.status === "aberta").length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela */}
      <Card className="rounded-2xl border-border/50">
        <CardHeader className="px-5 py-3 border-b border-border/40">
          <CardTitle className="text-sm font-semibold">Histórico de Sessões</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex justify-center py-12">
              <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : sessoes.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Nenhuma sessão no período</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 text-xs text-muted-foreground font-semibold">
                  <th className="px-4 py-2.5 text-left">Abertura</th>
                  <th className="px-4 py-2.5 text-left">Encerramento</th>
                  <th className="px-4 py-2.5 text-left">Operador</th>
                  <th className="px-4 py-2.5 text-right">Vendas</th>
                  <th className="px-4 py-2.5 text-right">Dinheiro</th>
                  <th className="px-4 py-2.5 text-right">PIX</th>
                  <th className="px-4 py-2.5 text-right">Cartão</th>
                  <th className="px-4 py-2.5 text-right">Total</th>
                  <th className="px-4 py-2.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {sessoes.map(s => {
                  const total = parseFloat(s.totalDinheiro) + parseFloat(s.totalPix) +
                    parseFloat(s.totalCartao) + parseFloat(s.totalDebito) + parseFloat(s.totalOutros);
                  const isAberta = s.status === "aberta";
                  return (
                    <tr key={s.id} className="hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-3 text-xs whitespace-nowrap">{fmtDate(s.openedAt)}</td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap text-muted-foreground">
                        {s.closedAt ? fmtDate(s.closedAt) : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{s.abertoPor || "—"}</td>
                      <td className="px-4 py-3 text-xs text-right tabular-nums">{s.totalVendas}</td>
                      <td className="px-4 py-3 text-xs text-right tabular-nums">{fmtBRL(parseFloat(s.totalDinheiro))}</td>
                      <td className="px-4 py-3 text-xs text-right tabular-nums">{fmtBRL(parseFloat(s.totalPix))}</td>
                      <td className="px-4 py-3 text-xs text-right tabular-nums">{fmtBRL(parseFloat(s.totalCartao) + parseFloat(s.totalDebito))}</td>
                      <td className="px-4 py-3 text-sm font-bold text-right tabular-nums text-emerald-600">{fmtBRL(total)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${
                          isAberta
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-secondary text-muted-foreground border-border"
                        }`}>
                          {isAberta ? "ABERTA" : "ENCERRADA"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}
