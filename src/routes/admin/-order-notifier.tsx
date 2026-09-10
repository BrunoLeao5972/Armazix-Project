import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { ShoppingBag } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────
// Vigia de novos pedidos — montado no AdminLayout, roda em QUALQUER tela do
// admin (não só em /admin/pedidos). Antes, a detecção de pedido novo vivia
// dentro de pedidos.tsx: se o operador estivesse em Produtos, Financeiro,
// PDV… nada avisava que entrou pedido. Agora:
//   - som curto (Web Audio, sem asset) sempre que chega pedido pra aceitar;
//   - notificação do sistema operacional (Notification API) quando a aba
//     está em segundo plano OU o operador não está no quadro de pedidos —
//     é isso que faz "avisar mesmo sem estar na tela";
//   - toast clicável no canto, só quando NÃO está no quadro (lá o pedido
//     já aparece sozinho no kanban).
// Não usa Service Worker / Web Push (que exigiria VAPID + assinatura no
// backend e entregaria com o navegador fechado) — o escopo aqui é "outra
// tela do admin" / "aba em segundo plano", que a Notification API cobre
// enquanto qualquer aba do painel estiver aberta.
// ─────────────────────────────────────────────────────────────────────────

const POLL_MS = 20_000;

type OrderLite = { id: string; number: number; status: string };
// Avisa de qualquer pedido novo que ainda esteja "vivo" — inclusive os que
// o aceite automático já empurrou pra "preparando" entre um poll e outro
// (o operador ainda quer saber que entrou pedido). Só ignora os que já
// nasceram/terminaram fora do fluxo.
const ESTADOS_FINAIS = new Set(["delivered", "cancelled"]);

// Beep de 2 tons via Web Audio — nada de arquivo. Se o navegador bloquear
// (aba nunca recebeu interação), falha em silêncio.
function playBeep() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const done = () => { ctx.close().catch(() => {}); };
    const ping = (freq: number, at: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + at);
      gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + at);
      osc.stop(ctx.currentTime + at + 0.3);
    };
    ctx.resume().catch(() => {});
    ping(880, 0);
    ping(1174.66, 0.16);
    setTimeout(done, 700);
  } catch { /* silêncio */ }
}

export function OrderNotifier() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const pathnameRef = useRef(pathname);
  useEffect(() => { pathnameRef.current = pathname; }, [pathname]);

  const seen = useRef<Set<string>>(new Set());
  const baselineDone = useRef(false);
  const [toast, setToast] = useState<{ number: number; count: number } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback((novos: OrderLite[]) => {
    if (novos.length === 0) return;
    playBeep();

    const noQuadro = pathnameRef.current === "/admin/pedidos";
    const oculto = typeof document !== "undefined" && document.visibilityState === "hidden";

    if ((oculto || !noQuadro) && typeof Notification !== "undefined" && Notification.permission === "granted") {
      try {
        const n = novos.length === 1
          ? new Notification(`Novo pedido #${novos[0].number}`, {
              body: "Toque para abrir o quadro de pedidos", tag: "armazix-pedido",
            })
          : new Notification(`${novos.length} novos pedidos`, {
              body: "Toque para abrir o quadro de pedidos", tag: "armazix-pedido",
            });
        n.onclick = () => { window.focus(); navigate({ to: "/admin/pedidos" }); n.close(); };
      } catch { /* alguns navegadores restringem Notification fora de SW */ }
    }

    if (!noQuadro) {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      setToast({ number: novos[novos.length - 1].number, count: novos.length });
      toastTimer.current = setTimeout(() => setToast(null), 9000);
    }
  }, [navigate]);

  useEffect(() => {
    let parado = false;

    const tick = async () => {
      const storeId = typeof window !== "undefined" ? localStorage.getItem("storeId") : null;
      if (!storeId) return;
      try {
        const res = await fetch(`/api/orders/list?storeId=${storeId}`);
        if (!res.ok) return;
        const data = await res.json() as { orders?: OrderLite[] };
        const orders = data.orders ?? [];

        if (!baselineDone.current) {
          // 1ª passada: registra tudo que já existe sem avisar — abrir o
          // painel não deve disparar alerta pros pedidos que já estavam lá.
          orders.forEach((o) => seen.current.add(o.id));
          baselineDone.current = true;
          return;
        }

        const novos = orders.filter((o) => !ESTADOS_FINAIS.has(o.status) && !seen.current.has(o.id));
        orders.forEach((o) => seen.current.add(o.id));
        if (novos.length) notify(novos);
      } catch { /* rede instável — tenta de novo no próximo tick */ }
    };

    tick();
    const retry = setTimeout(tick, 3_000); // storeId pode não estar pronto no 1º tick
    const iv = setInterval(() => { if (!parado) tick(); }, POLL_MS);
    return () => {
      parado = true;
      clearTimeout(retry);
      clearInterval(iv);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [notify]);

  if (!toast) return null;
  return (
    <button
      onClick={() => { setToast(null); navigate({ to: "/admin/pedidos" }); }}
      className="fixed bottom-6 right-6 z-[100] flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-lg text-sm font-semibold bg-primary text-primary-foreground animate-in slide-in-from-bottom-4 duration-200"
    >
      <ShoppingBag className="w-4 h-4" />
      {toast.count === 1 ? `Novo pedido #${toast.number}` : `${toast.count} novos pedidos`} — abrir quadro
    </button>
  );
}

// Estado de permissão de notificação — pro sino da topbar mostrar o ponto
// de "ative as notificações" e pedir a permissão no clique (browsers só
// deixam pedir a partir de um gesto do usuário).
export function useNotificationPermission() {
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">(
    typeof Notification === "undefined" ? "unsupported" : Notification.permission,
  );
  const request = useCallback(async () => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "default") {
      try { setPerm(await Notification.requestPermission()); }
      catch { /* ignora */ }
    } else {
      setPerm(Notification.permission);
    }
  }, []);
  return { perm, request };
}
