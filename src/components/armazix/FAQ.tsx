import { useState, useEffect } from "react";
import { Plus, Minus } from "lucide-react";

const FAQS = [
  {
    q: "O Armazix é gratuito?",
    a: "Sim, o plano gratuito permite testar a plataforma, cadastrar produtos, criar sua loja virtual e receber pedidos sem custo por 7 dias. Planos pagos desbloqueam relatórios avançados, múltiplos usuários e integração com gateways de pagamento.",
  },
  {
    q: "Preciso de um site ou domínio próprio para usar?",
    a: "Não precisa. O Armazix cria automaticamente um endereço no formato sualoja.armazix.com.br para a sua loja.",
  },
  {
    q: "Como funciona o checkout integrado?",
    a: "Seu cliente adiciona produtos ao carrinho e finaliza o pedido direto na vitrine — informando o endereço e escolhendo a forma de pagamento (PIX, cartão ou na entrega). Tudo sem sair da sua loja.",
  },
  {
    q: "O estoque é atualizado automaticamente?",
    a: "Sim. A cada pedido confirmado, o estoque é decrementado em tempo real. Você também pode configurar limites de estoque baixo para receber alertas antes de zerar o produto.",
  },
  {
    q: "O Armazix funciona para delivery?",
    a: "Muito bem. Você configura taxas de entrega por bairro, frete grátis a partir de um valor mínimo, horários de funcionamento e recebe os pedidos com o endereço do cliente já no painel.",
  },
  {
    q: "Quantos produtos posso cadastrar?",
    a: "No plano gratuito o limite é de 15 produtos para testar. No plano Start você pode cadastrar até 25 produtos, no plano Pro até 70 produtos e no plano Full o cadastro é ilimitado, com suporte a variações (cor, tamanho, capacidade) e múltiplas imagens por produto.",
  },
  {
    q: "Consigo usar o PDV sem internet?",
    a: "O PDV do Armazix funciona com uma conexão básica à internet — mesmo 4G é suficiente. Uma versão com suporte offline está disponível para uso no Desktop em armazix.com.br/downloads. O PDV registra as informações localmente e, ao reconectar à rede, envia os dados automaticamente para a nuvem.",
  },
  {
    q: "Como é o suporte ao cliente?",
    a: "Suporte via WhatsApp, feito pelo time do Armazix. Você fala direto com quem construiu a plataforma — sem chatbot de triagem, sem fila.",
  },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(null);
  // Garante que os handlers de clique são registrados apenas no cliente,
  // evitando problemas de hidratação SSR com conteúdo cacheado no edge.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  return (
    <section id="faq" className="py-16 lg:py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <span className="text-sm font-semibold text-primary">Dúvidas frequentes</span>
          <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight">
            Respondemos as principais perguntas
          </h2>
        </div>

        <div className="rounded-3xl border border-border overflow-hidden divide-y divide-border bg-surface">
          {FAQS.map((faq, i) => (
            <div key={faq.q}>
              <button
                type="button"
                onClick={mounted ? () => setOpen(open === i ? null : i) : undefined}
                className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left transition-colors hover:bg-secondary/40"
              >
                <span className="font-semibold text-sm sm:text-base pr-2">{faq.q}</span>
                <span className="shrink-0 grid place-items-center w-7 h-7 rounded-full bg-accent text-primary pointer-events-none">
                  {mounted && open === i ? (
                    <Minus className="w-3.5 h-3.5" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                </span>
              </button>
              {mounted && open === i && (
                <div className="px-6 pb-5 text-sm text-muted-foreground leading-relaxed">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
