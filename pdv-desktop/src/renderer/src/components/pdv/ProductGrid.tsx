import { useEffect, useState } from "react";
import { PackageSearch } from "lucide-react";
import type { MangoQuerySelector } from "rxdb";
import type { ArmazixDatabase } from "../../db/database";
import type { ProductDoc } from "../../db/types";
import { ProductCard } from "./ProductCard";
import { FAVORITES } from "./CategoryTabs";

export function ProductGrid({
  db,
  categoryId,
  searchTerm,
  onAdd,
}: {
  db: ArmazixDatabase | null;
  categoryId: string;
  searchTerm: string;
  onAdd: (p: ProductDoc) => void;
}) {
  const [products, setProducts] = useState<ProductDoc[]>([]);

  useEffect(() => {
    if (!db) return;

    const selector: MangoQuerySelector<ProductDoc> = { active: true };
    if (categoryId === FAVORITES) selector.featured = true;
    else if (categoryId !== "__all__") selector.categoryId = categoryId;

    // RxDB/Dexie não tem "contains" nativo — o recorte por categoria já
    // chega pequeno (catálogo típico de loja/restaurante), então filtra o
    // termo de busca no cliente em cima do resultado da query reativa.
    const query = db.products.find({ selector });
    const sub = query.$.subscribe((docs) => {
      const plain = docs.map((d) => d.toJSON() as ProductDoc);
      const term = searchTerm.trim().toLowerCase();
      const filtered = term
        ? plain.filter(
            (p) =>
              p.name.toLowerCase().includes(term) ||
              p.barcode?.toLowerCase() === term ||
              p.pdvCode?.toLowerCase() === term ||
              p.sku?.toLowerCase().includes(term),
          )
        : plain;
      setProducts(filtered);
    });

    return () => sub.unsubscribe();
  }, [db, categoryId, searchTerm]);

  if (products.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-ink/40 py-20">
        <PackageSearch className="w-10 h-10" />
        <p className="text-sm">Nenhum produto encontrado</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} onAdd={onAdd} />
      ))}
    </div>
  );
}
