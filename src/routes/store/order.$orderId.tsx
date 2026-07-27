import { createFileRoute } from "@tanstack/react-router";
import { Loader2, LogIn } from "lucide-react";
import { useStore } from "../store";
import { useCustomerOrderDetail } from "@/lib/customer-profile-hooks";
import { OrderDetailContent } from "@/components/storefront/profile/OrderDetailContent";

export const Route = createFileRoute("/store/order/$orderId")({
  component: OrderTrackingPage,
});

function OrderTrackingPage() {
  const { orderId } = Route.useParams();
  const { customerToken } = useStore();
  const { order, loading, notFound } = useCustomerOrderDetail(customerToken, orderId);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;

  if (!customerToken) {
    return (
      <div className="px-4 py-20 text-center flex flex-col items-center gap-2">
        <LogIn className="w-8 h-8 text-muted-foreground" />
        <p className="text-lg font-bold">Faça login para ver seu pedido</p>
        <p className="text-sm text-muted-foreground">Entre com o telefone usado na compra pra acompanhar o status.</p>
      </div>
    );
  }

  if (!order || notFound) return <div className="px-4 py-20 text-center"><p className="text-lg font-bold">Pedido não encontrado</p></div>;

  return (
    <div className="px-4 pt-4 pb-4">
      <OrderDetailContent order={order} />
    </div>
  );
}
