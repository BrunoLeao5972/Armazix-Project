import { Loader2, Package } from "lucide-react";
import { useCustomerOrderDetail } from "@/lib/customer-profile-hooks";
import { OrderDetailContent } from "./OrderDetailContent";

export function OrderDetailView({ token, orderId }: { token: string | null; orderId: string | null }) {
  const { order, loading, notFound } = useCustomerOrderDetail(token, orderId);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!order || notFound) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center px-6">
        <Package className="w-8 h-8 text-muted-foreground/50" />
        <p className="text-sm font-medium">Pedido não encontrado</p>
      </div>
    );
  }

  return <OrderDetailContent order={order} />;
}
