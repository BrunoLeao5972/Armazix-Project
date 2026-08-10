// Sensoriamento de conectividade — combina o evento nativo do navegador
// (rápido, mas só sabe se HÁ uma interface de rede) com um ping periódico
// de saúde na API (mais lento, mas prova que o Armazix Cloud está alcançável
// de verdade — rede pode estar "online" e o servidor fora do ar mesmo assim).
import { BehaviorSubject } from "rxjs";
import { pingHealth } from "./api";

const HEALTH_CHECK_INTERVAL_MS = 15_000;

export const isOnline$ = new BehaviorSubject<boolean>(navigator.onLine);

let intervalId: ReturnType<typeof setInterval> | null = null;

async function checkHealth(): Promise<void> {
  // Sem interface de rede nenhuma, nem tenta bater na API.
  if (!navigator.onLine) {
    isOnline$.next(false);
    return;
  }
  const reachable = await pingHealth();
  isOnline$.next(reachable);
}

function handleBrowserOnline(): void {
  void checkHealth();
}

function handleBrowserOffline(): void {
  isOnline$.next(false);
}

/** Chame uma vez, na inicialização do app. Retorna a função de limpeza. */
export function startNetworkMonitor(): () => void {
  window.addEventListener("online", handleBrowserOnline);
  window.addEventListener("offline", handleBrowserOffline);

  void checkHealth();
  intervalId = setInterval(() => void checkHealth(), HEALTH_CHECK_INTERVAL_MS);

  return () => {
    window.removeEventListener("online", handleBrowserOnline);
    window.removeEventListener("offline", handleBrowserOffline);
    if (intervalId) clearInterval(intervalId);
  };
}

/** Dispara uma checagem imediata — usado pelo botão de sincronização manual. */
export function checkNow(): Promise<void> {
  return checkHealth();
}
