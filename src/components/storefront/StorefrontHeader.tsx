import { ShoppingBag, Search, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { formatPrice, type ConfiguracaoVitrine } from "@/lib/store-context";

interface StorefrontHeaderProps {
  storeName: string;
  storeInitials: string;
  onSearch: (query: string) => void;
  cartCount: number;
  cartItems: Array<{
    id: string;
    name: string;
    price: number;
    qty: number;
    imageUrl?: string | null;
    emoji?: string | null;
  }>;
  config: ConfiguracaoVitrine;
  onRemoveFromCart?: (id: string) => void;
  onQtyChange?: (id: string, qty: number) => void;
  cartSubtotal: number;
  onSendToWhatsApp?: () => void;
  onGoToCheckout?: () => void;
}

export function StorefrontHeader({
  storeName,
  storeInitials,
  onSearch,
  cartCount,
  cartItems,
  config,
  onRemoveFromCart,
  onQtyChange,
  cartSubtotal,
  onSendToWhatsApp,
  onGoToCheckout,
}: StorefrontHeaderProps) {
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        {/* Left: Logo + Store Name */}
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-white font-bold text-sm"
            style={{ backgroundColor: config.corPrimaria }}
          >
            {storeInitials}
          </div>
          <span className="font-semibold text-slate-900 truncate text-sm sm:text-base">
            {storeName}
          </span>
        </div>

        {/* Right: Search + Cart */}
        <div className="flex items-center gap-2 ml-auto">
          {/* Search (Hidden on mobile, visible on md+) */}
          <div className="hidden sm:relative sm:block flex-1 max-w-xs">
            <input
              type="text"
              placeholder="Buscar..."
              onChange={(e) => onSearch(e.target.value)}
              className="w-full h-10 rounded-full bg-slate-100 px-4 pr-10 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          </div>

          {/* Cart Icon */}
          <Sheet>
            <SheetTrigger asChild>
              <button className="relative w-10 h-10 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors flex items-center justify-center">
                <ShoppingBag className="w-5 h-5 text-slate-600" />
                {cartCount > 0 && (
                  <span
                    className="absolute -top-1 -right-1 min-w-[20px] h-[20px] rounded-full text-white text-[11px] font-bold flex items-center justify-center"
                    style={{ backgroundColor: config.corPrimaria }}
                  >
                    {cartCount}
                  </span>
                )}
              </button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-md flex flex-col">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5" style={{ color: config.corPrimaria }} />
                  Sacola
                  {cartCount > 0 && (
                    <Badge className="rounded-full bg-slate-900/5 text-slate-700 border-0">
                      {cartCount}
                    </Badge>
                  )}
                </SheetTitle>
              </SheetHeader>

              {cartItems.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center">
                  <ShoppingBag className="w-12 h-12 text-slate-300" />
                  <p className="text-sm font-medium text-slate-900">Sua sacola está vazia</p>
                  <p className="text-xs text-slate-500">Adicione produtos para montar seu pedido</p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto py-4 space-y-3">
                  {cartItems.map((item) => (
                    <div key={item.id} className="flex gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="w-16 h-16 rounded-lg bg-white flex items-center justify-center overflow-hidden shrink-0">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.name} className="w-full h-full object-contain" />
                        ) : (
                          <span className="text-2xl">{item.emoji || "📦"}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate text-slate-900">{item.name}</p>
                        {config.exibirPreco ? (
                          <p className="text-sm font-bold mt-1" style={{ color: config.corPrimaria }}>
                            R$ {formatPrice(item.price)}
                          </p>
                        ) : (
                          <p className="text-xs text-slate-500 mt-1">Sob consulta</p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            onClick={() => onQtyChange?.(item.id, item.qty - 1)}
                            className="w-7 h-7 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 flex items-center justify-center text-sm font-semibold"
                          >
                            −
                          </button>
                          <span className="text-sm font-semibold w-6 text-center text-slate-900">{item.qty}</span>
                          <button
                            onClick={() => onQtyChange?.(item.id, item.qty + 1)}
                            className="w-7 h-7 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 flex items-center justify-center text-sm font-semibold"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <button
                        onClick={() => onRemoveFromCart?.(item.id)}
                        className="w-8 h-8 rounded-lg hover:bg-red-50 flex items-center justify-center text-slate-400 hover:text-red-600 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {cartItems.length > 0 && (
                <div className="border-t border-slate-200 pt-4 space-y-3">
                  {config.exibirPreco && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">Subtotal</span>
                      <span className="font-semibold text-slate-900">R$ {formatPrice(cartSubtotal)}</span>
                    </div>
                  )}

                  {config.pedidoWhatsapp ? (
                    <button
                      onClick={onSendToWhatsApp}
                      className="w-full h-11 rounded-lg bg-green-500 hover:bg-green-600 text-white font-semibold transition-colors flex items-center justify-center gap-2"
                    >
                      Enviar para WhatsApp
                    </button>
                  ) : (
                    <button
                      onClick={onGoToCheckout}
                      className="w-full h-11 rounded-lg text-white font-semibold transition-colors"
                      style={{ backgroundColor: config.corPrimaria }}
                    >
                      Finalizar Pedido
                    </button>
                  )}
                </div>
              )}
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
