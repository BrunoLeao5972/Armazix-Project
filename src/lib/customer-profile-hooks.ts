// Hooks compartilhados entre ProfileDrawer (desktop) e /store/account (mobile)
// — as duas telas de "Central do Cliente" mostram os mesmos dados (favoritos,
// endereços, cupons), então a busca/mutação fica aqui em vez de duplicada.
import { useCallback, useEffect, useState } from "react";
import type { StoreProduct } from "@/lib/store-context";

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

// ─── Pedidos ────────────────────────────────────────────────────────────────
export interface CustomerOrder {
  id: string;
  number: number;
  status: string;
  total: string;
  createdAt: string;
  items: { productName: string; quantity: number }[];
}

export function useCustomerOrders(token: string | null) {
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!token) { setOrders([]); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/customer/orders", { headers: authHeaders(token) });
      if (res.ok) {
        const data = await res.json() as { orders: CustomerOrder[] };
        setOrders(data.orders ?? []);
      }
    } catch {}
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { refetch(); }, [refetch]);

  return { orders, loading, refetch };
}

// ─── Favoritos ──────────────────────────────────────────────────────────────
export function useCustomerFavoriteProducts(token: string | null) {
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading]   = useState(false);

  const refetch = useCallback(async () => {
    if (!token) { setProducts([]); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/customer/favorites", { headers: authHeaders(token) });
      if (res.ok) {
        const data = await res.json() as { products: Omit<StoreProduct, "costPrice">[] };
        setProducts((data.products ?? []).map(p => ({ ...p, costPrice: null })));
      }
    } catch {}
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { refetch(); }, [refetch]);

  return { products, loading, refetch };
}

// ─── Endereços ──────────────────────────────────────────────────────────────
export interface CustomerAddress {
  id: string;
  label: string | null;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  zip: string;
  isDefault: boolean | null;
}

export interface AddressFormInput {
  label?: string; cep?: string; street: string; number: string;
  neighborhood?: string; city: string; state: string; complement?: string;
  isDefault?: boolean;
}

export const MAX_CUSTOMER_ADDRESSES = 5;

export function useCustomerAddresses(token: string | null) {
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [loading, setLoading]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState("");

  const refetch = useCallback(async () => {
    if (!token) { setAddresses([]); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/customer/addresses", { headers: authHeaders(token) });
      if (res.ok) {
        const data = await res.json() as { addresses: CustomerAddress[] };
        setAddresses(data.addresses ?? []);
      }
    } catch {}
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { refetch(); }, [refetch]);

  const create = useCallback(async (input: AddressFormInput) => {
    if (!token) return false;
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/customer/addresses/create", {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeaders(token) },
        body: JSON.stringify(input),
      });
      const data = await res.json() as { address?: CustomerAddress; error?: string };
      if (res.ok && data.address) { await refetch(); return true; }
      setError(data.error || "Erro ao salvar endereço");
      return false;
    } catch {
      setError("Erro de conexão. Tente novamente.");
      return false;
    } finally { setSaving(false); }
  }, [token, refetch]);

  const remove = useCallback(async (id: string) => {
    if (!token) return false;
    try {
      const res = await fetch("/api/customer/addresses/delete", {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeaders(token) },
        body: JSON.stringify({ id }),
      });
      if (res.ok) { await refetch(); return true; }
      return false;
    } catch { return false; }
  }, [token, refetch]);

  const setDefault = useCallback(async (id: string) => {
    if (!token) return false;
    try {
      const res = await fetch("/api/customer/addresses/set-default", {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeaders(token) },
        body: JSON.stringify({ id }),
      });
      if (res.ok) { await refetch(); return true; }
      return false;
    } catch { return false; }
  }, [token, refetch]);

  return { addresses, loading, saving, error, setError, refetch, create, remove, setDefault };
}

// ─── Cupons ─────────────────────────────────────────────────────────────────
export interface CustomerCoupon {
  id: string;
  code: string;
  type: string; // "percent" | "fixed"
  discount: string;
  minOrderValue: string | null;
  expiresAt: string | null;
}

export function useCustomerCoupons(token: string | null) {
  const [coupons, setCoupons] = useState<CustomerCoupon[]>([]);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!token) { setCoupons([]); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/customer/coupons", { headers: authHeaders(token) });
      if (res.ok) {
        const data = await res.json() as { coupons: CustomerCoupon[] };
        setCoupons(data.coupons ?? []);
      }
    } catch {}
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { refetch(); }, [refetch]);

  return { coupons, loading, refetch };
}
