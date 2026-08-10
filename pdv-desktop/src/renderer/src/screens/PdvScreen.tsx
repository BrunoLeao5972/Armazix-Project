import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../hooks/useAuth";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { useCart } from "../hooks/useCart";
import { getDatabase, type ArmazixDatabase } from "../db/database";
import type { CategoryDoc, ProductDoc } from "../db/types";
import { getCachedSessao, openRegister, type CaixaSessao } from "../services/caixa.service";
import { syncCatalog, enqueueSale, drainQueue, countPendingSales } from "../services/sync.service";
import { Header } from "../components/pdv/Header";
import { SearchBar } from "../components/pdv/SearchBar";
import { CategoryTabs, ALL } from "../components/pdv/CategoryTabs";
import { ProductGrid } from "../components/pdv/ProductGrid";
import { Cart } from "../components/pdv/Cart";
import { OpenRegisterModal } from "../components/pdv/OpenRegisterModal";

export function PdvScreen() {
  const { session, signOut } = useAuth();
  const online = useOnlineStatus();
  const cart = useCart();

  const [db, setDb] = useState<ArmazixDatabase | null>(null);
  const [categories, setCategories] = useState<CategoryDoc[]>([]);
  const [categoryId, setCategoryId] = useState<string>(ALL);
  const [searchTerm, setSearchTerm] = useState("");
  const [sessao, setSessao] = useState<CaixaSessao | null>(() => getCachedSessao());
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  useEffect(() => {
    getDatabase().then(setDb);
  }, []);

  useEffect(() => {
    if (!db || !session) return;
    const query = db.categories.find({ selector: { storeId: session.storeId, active: true } });
    const sub = query.$.subscribe((docs) => {
      const plain = docs.map((d) => d.toJSON() as CategoryDoc);
      plain.sort((a, b) => a.position - b.position);
      setCategories(plain);
    });
    return () => sub.unsubscribe();
  }, [db, session]);

  const refreshPendingCount = useCallback(() => {
    countPendingSales().then(setPendingCount).catch(() => {});
  }, []);

  useEffect(() => {
    refreshPendingCount();
    const interval = setInterval(refreshPendingCount, 10_000);
    return () => clearInterval(interval);
  }, [refreshPendingCount]);

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      await Promise.allSettled([syncCatalog(), drainQueue()]);
      refreshPendingCount();
    } finally {
      setSyncing(false);
    }
  };

  const handleAddProduct = (p: ProductDoc) => cart.addProduct(p);

  const handleOpenRegister = async (saldoInicial: string) => {
    const abertoPor = session?.name;
    const novaSessao = await openRegister(saldoInicial, abertoPor);
    setSessao(novaSessao);
  };

  const handleFinalize = async (paymentMethod: string) => {
    if (!session || !sessao) return;
    setFinalizing(true);
    try {
      await enqueueSale({
        storeId: session.storeId,
        sessaoId: sessao.id,
        paymentMethod,
        items: cart.lines.map((l) => ({
          productId: l.productId,
          productName: l.name,
          productEmoji: l.emoji,
          quantity: l.quantity,
          unitPrice: l.unitPrice.toFixed(2),
          total: (l.unitPrice * l.quantity).toFixed(2),
        })),
        subtotal: cart.subtotal.toFixed(2),
        discount: cart.discount > 0 ? cart.discount.toFixed(2) : null,
        total: cart.total.toFixed(2),
      });
      cart.clear();
      refreshPendingCount();
    } finally {
      setFinalizing(false);
    }
  };

  if (!session) return null;

  if (!sessao) {
    return (
      <OpenRegisterModal online={online} operatorName={session.name} onOpen={handleOpenRegister} />
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-surface">
      <Header
        storeName={session.storeName || "Armazix PDV"}
        operatorName={session.name}
        online={online}
        pendingCount={pendingCount}
        syncing={syncing}
        onSyncNow={handleSyncNow}
        onLogout={signOut}
      />

      <div className="flex-1 flex min-h-0">
        <main className="flex-1 min-w-0 flex flex-col p-5 gap-4 overflow-hidden">
          <SearchBar value={searchTerm} onChange={setSearchTerm} />
          <CategoryTabs categories={categories} activeId={categoryId} onSelect={setCategoryId} />
          <div className="flex-1 overflow-y-auto scrollbar-thin -mr-2 pr-2">
            <ProductGrid db={db} categoryId={categoryId} searchTerm={searchTerm} onAdd={handleAddProduct} />
          </div>
        </main>

        <Cart
          lines={cart.lines}
          subtotal={cart.subtotal}
          discount={cart.discount}
          total={cart.total}
          onQuantityChange={cart.updateQuantity}
          onRemove={cart.removeLine}
          onSetDiscount={cart.setDiscount}
          onFinalize={handleFinalize}
          finalizing={finalizing}
        />
      </div>
    </div>
  );
}
