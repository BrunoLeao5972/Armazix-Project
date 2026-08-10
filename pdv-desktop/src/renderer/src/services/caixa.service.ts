// Sessão de caixa (turno) — a API hoje só sabe abrir/fechar caixa online
// (cria a linha em caixaSessoes na hora). Pra permitir "abrir o caixa
// normalmente" offline, como pedido, guardamos a última sessão aberta
// localmente: se já existe uma sessão aberta em cache, o turno continua
// mesmo sem internet. Só o PRIMEIRO turno de um computador exige estar
// online uma vez — não dá pra inventar um id de sessão que o servidor nunca
// viu sem arriscar duas sessões offline colidindes quando ambas sincronizarem.
import { api } from "./api";

export interface CaixaSessao {
  id: string;
  saldoInicial: string;
  openedAt: string;
}

const STORAGE_KEY = "armazix_pdv_caixa_sessao";

interface AbrirCaixaResponse {
  success: true;
  sessao: { id: string; saldoInicial: string };
}

export function getCachedSessao(): CaixaSessao | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CaixaSessao;
  } catch {
    return null;
  }
}

export async function openRegister(saldoInicial: string, abertoPor?: string): Promise<CaixaSessao> {
  const res = await api.post<AbrirCaixaResponse>("/api/pdv/caixa/abrir", { saldoInicial, abertoPor });
  const sessao: CaixaSessao = {
    id: res.sessao.id,
    saldoInicial: res.sessao.saldoInicial,
    openedAt: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessao));
  return sessao;
}

export function clearCachedSessao(): void {
  localStorage.removeItem(STORAGE_KEY);
}
