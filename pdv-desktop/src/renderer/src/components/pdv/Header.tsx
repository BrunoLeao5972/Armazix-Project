import { RefreshCw, Wifi, WifiOff, LogOut, Store } from "lucide-react";
import { cn } from "../../lib/cn";

export function Header({
  storeName,
  operatorName,
  online,
  pendingCount,
  syncing,
  onSyncNow,
  onLogout,
}: {
  storeName: string;
  operatorName: string;
  online: boolean;
  pendingCount: number;
  syncing: boolean;
  onSyncNow: () => void;
  onLogout: () => void;
}) {
  return (
    <header className="h-16 shrink-0 border-b border-black/5 bg-white flex items-center justify-between px-6">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shrink-0">
          <Store className="w-4.5 h-4.5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{storeName}</p>
          <p className="text-xs text-ink/50 truncate">Operador: {operatorName}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {pendingCount > 0 && (
          <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
            {pendingCount} venda{pendingCount > 1 ? "s" : ""} pendente{pendingCount > 1 ? "s" : ""}
          </span>
        )}

        <span
          className={cn(
            "flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full",
            online ? "text-primary bg-primary-light" : "text-amber-700 bg-amber-50",
          )}
        >
          {online ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
          {online ? "Online" : "Offline"}
        </span>

        <button
          type="button"
          onClick={onSyncNow}
          disabled={!online || syncing}
          title="Sincronizar agora"
          className="w-9 h-9 rounded-xl border border-black/10 flex items-center justify-center hover:bg-black/5 disabled:opacity-40 transition-colors"
        >
          <RefreshCw className={cn("w-4 h-4", syncing && "animate-spin")} />
        </button>

        <button
          type="button"
          onClick={onLogout}
          title="Sair"
          className="w-9 h-9 rounded-xl border border-black/10 flex items-center justify-center hover:bg-black/5 transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
