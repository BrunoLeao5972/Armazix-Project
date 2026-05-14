import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, XCircle, Clock, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/store/payment")({
  component: PaymentResultPage,
  head: () => ({
    meta: [{ title: "Pagamento — ARMAZIX" }],
  }),
});

function PaymentResultPage() {
  const { status, order } = Route.useSearch<{ status?: string; order?: string }>();

  if (status === "success") {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center animate-in fade-in zoom-in-95 duration-500">
        <div className="w-20 h-20 rounded-full bg-gradient-primary flex items-center justify-center shadow-glow mb-5">
          <CheckCircle2 className="w-10 h-10 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-bold">Pagamento aprovado!</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Seu pedido foi confirmado e está sendo preparado.
        </p>
        {order && (
          <p className="text-xs text-muted-foreground mt-1 font-mono opacity-60">
            Ref: {order}
          </p>
        )}
        <div className="mt-8 w-full max-w-xs space-y-3">
          <Link to="/store">
            <Button className="w-full h-11 rounded-2xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow">
              Continuar comprando
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (status === "failure") {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center animate-in fade-in zoom-in-95 duration-500">
        <div className="w-20 h-20 rounded-full bg-destructive/15 flex items-center justify-center mb-5">
          <XCircle className="w-10 h-10 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold">Pagamento recusado</h1>
        <p className="text-sm text-muted-foreground mt-2">
          O pagamento não foi processado. Tente novamente com outro método.
        </p>
        <div className="mt-8 w-full max-w-xs space-y-3">
          <Link to="/store/checkout">
            <Button className="w-full h-11 rounded-2xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow">
              Tentar novamente
            </Button>
          </Link>
          <Link to="/store">
            <Button variant="outline" className="w-full h-11 rounded-2xl font-semibold">
              Voltar à loja
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (status === "pending") {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center animate-in fade-in zoom-in-95 duration-500">
        <div className="w-20 h-20 rounded-full bg-yellow-500/15 flex items-center justify-center mb-5">
          <Clock className="w-10 h-10 text-yellow-500" />
        </div>
        <h1 className="text-2xl font-bold">Pagamento em análise</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-xs">
          Seu pagamento está sendo processado. Você receberá uma confirmação em breve.
        </p>
        {order && (
          <p className="text-xs text-muted-foreground mt-1 font-mono opacity-60">
            Ref: {order}
          </p>
        )}
        <div className="mt-8 w-full max-w-xs">
          <Link to="/store">
            <Button className="w-full h-11 rounded-2xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow">
              Voltar à loja
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Fallback
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <ShoppingBag className="w-12 h-12 text-muted-foreground mb-4" />
      <p className="text-sm text-muted-foreground">Status de pagamento desconhecido</p>
      <Link to="/store" className="mt-4 text-sm font-semibold text-primary">
        Voltar à loja
      </Link>
    </div>
  );
}
