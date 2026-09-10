import { useEffect, useState } from "react";
import type { StoreRole } from "@/lib/reports-permissions";

// storeUsers.role do operador logado na loja atual. `null` enquanto carrega
// OU se a request falhar — o consumidor deve tratar null como "sem permissão",
// nunca como admin por padrão (mesmo princípio do useStoreInfo de relatorios.tsx).
export function useStoreRole(): StoreRole | null {
  const [role, setRole] = useState<StoreRole | null>(null);
  useEffect(() => {
    let vivo = true;
    fetch("/api/store/user")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { storeRole?: StoreRole } | null) => {
        if (vivo) setRole(d?.storeRole ?? null);
      })
      .catch(() => {});
    return () => { vivo = false; };
  }, []);
  return role;
}
