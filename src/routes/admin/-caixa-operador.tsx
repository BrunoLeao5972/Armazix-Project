import { useState, useEffect } from "react";
import { api } from "@/lib/api-client";
import { HelpCircle, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";

// ─── Responsável = usuário real da loja, não texto livre ──────────
// "Aberto por"/"Encerrado por" deixaram de aceitar qualquer nome digitado:
// agora é um membro de verdade da loja (GET /api/store-users/list) que
// precisa provar a própria senha (POST /api/pdv/caixa/verificar-operador)
// antes de a ação ser sequer oferecida pra confirmação.
//
// Módulo compartilhado de propósito: a abertura de caixa existe em dois
// lugares (ModalAbrirCaixa, em -modais-caixa-pdv.tsx, e o PainelAbrirCaixa
// inline de pdv.tsx) e o fechamento em outro (ModalFecharCaixa) — os três
// precisam da MESMA regra, senão um deles volta a aceitar texto livre.
// Sem dependência de pdv.tsx, pra não criar import circular.
export interface Operador { userId: string; name: string; active: boolean }

export function useOperadores(): Operador[] {
  const [operadores, setOperadores] = useState<Operador[]>([]);
  useEffect(() => {
    api.get("/api/store-users/list").then(async (res) => {
      const data = await res.json() as { users?: Operador[] };
      if (res.ok) setOperadores((data.users ?? []).filter(u => u.active !== false));
    }).catch(() => {});
  }, []);
  return operadores;
}

export async function verificarOperador(userId: string, password: string): Promise<{ ok: true; name: string } | { ok: false; error: string }> {
  try {
    const res  = await api.post("/api/pdv/caixa/verificar-operador", { userId, password });
    const data = await res.json() as { success?: boolean; name?: string; error?: string };
    if (res.ok && data.success && data.name) return { ok: true, name: data.name };
    return { ok: false, error: data.error || "Senha incorreta" };
  } catch { return { ok: false, error: "Erro de conexão" }; }
}

// ─── Campo Responsável (select) + Senha ──
export function CampoOperador({ operadores, operadorId, setOperadorId, senha, setSenha }: {
  operadores: Operador[]; operadorId: string; setOperadorId: (v: string) => void;
  senha: string; setSenha: (v: string) => void;
}) {
  return (
    <>
      <div>
        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Responsável</label>
        <select value={operadorId} onChange={e => setOperadorId(e.target.value)}
          className="mt-1 h-10 w-full rounded-xl border border-border bg-card px-3 text-sm font-medium text-foreground">
          <option value="">Selecione...</option>
          {operadores.map(o => <option key={o.userId} value={o.userId}>{o.name}</option>)}
        </select>
      </div>
      <div>
        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Senha</label>
        <Input type="password" value={senha} onChange={e => setSenha(e.target.value)}
          placeholder="Sua senha" className="mt-1 h-10 rounded-xl text-sm" />
      </div>
    </>
  );
}

// ─── Popup "tem certeza?" — sempre aparece antes da ação final, esteja o
// resto preenchido ou não. Empilha sobre o modal (z-index maior). ──
export function ModalConfirmarAcao({ titulo, mensagem, corBtn, loading, onConfirmar, onCancelar }: {
  titulo: string; mensagem: string; corBtn: string; loading: boolean;
  onConfirmar: () => void; onCancelar: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-xs p-6 text-center animate-in fade-in zoom-in-95 duration-150">
        <div className="w-12 h-12 mx-auto rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mb-4">
          <HelpCircle className="w-6 h-6 text-amber-600" />
        </div>
        <h3 className="text-sm font-bold text-foreground">{titulo}</h3>
        <p className="text-xs text-muted-foreground mt-1.5">{mensagem}</p>
        <div className="flex gap-2 mt-5">
          <button onClick={onCancelar} disabled={loading}
            className="flex-1 h-10 rounded-xl bg-secondary hover:bg-secondary text-muted-foreground font-semibold text-sm transition-colors disabled:opacity-60">
            Cancelar
          </button>
          <button onClick={onConfirmar} disabled={loading}
            className={`flex-1 h-10 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-60 ${corBtn}`}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}
