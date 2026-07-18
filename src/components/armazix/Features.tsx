import type { ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";

interface FeatureBlock {
  eyebrow: string;
  heading: string;
  body: string;
  bullets: string[];
  visual: ReactNode;
  reversed?: boolean;
  zix?: string;
}

const FEATURES: FeatureBlock[] = [
  {
    eyebrow: "Checkout Integrado",
    heading: "Do carrinho ao pagamento em segundos",
    body: "Seu cliente escolhe os produtos, informa o endereço e paga — tudo dentro da sua loja, sem redirecionar para outros sites",
    bullets: [
      "PIX, cartão de crédito e pagamento na entrega",
      "Cálculo automático de frete por bairro",
      "Cupons de desconto com regras flexíveis",
    ],
    visual: <CheckoutMockup />,
  },
  {
    eyebrow: "Controle Real de Estoque",
    heading: "Nunca mais venda o que não tem",
    body: "A cada pedido confirmado, o estoque é decrementado na hora — configure limites de alerta e saiba exatamente quando reabastecer",
    bullets: [
      "Atualização automática a cada venda ou ajuste",
      "Alertas de estoque baixo configuráveis por produto",
      "Histórico completo de movimentações",
    ],
    visual: <EstoqueMockup />,
    reversed: true,
  },
  {
    eyebrow: "Multi-canal",
    heading: "Venda pelo WhatsApp, vitrine e presencial",
    body: "Seus clientes chegam por caminhos diferentes — o Armazix centraliza tudo num único painel, sem duplicar esforço nem perder pedido",
    bullets: [
      "Loja pública com link próprio para compartilhar",
      "PDV para atendimento presencial integrado",
      "Histórico unificado de pedidos por canal",
    ],
    visual: <MultiCanalMockup />,
    zix: "Dica do Zix: cole o link da sua loja no status do WhatsApp e receba pedidos sem fazer nada extra!",
  },
  {
    eyebrow: "Relatórios Diretos",
    heading: "Dados que você entende, decisões que você toma",
    body: "Chega de planilha — o Armazix transforma seus dados de vendas em gráficos e resumos claros, para você agir rápido",
    bullets: [
      "Faturamento por período e por produto",
      "Ticket médio e produtos mais vendidos",
      "Exportação para análise externa",
    ],
    visual: <RelatoriosMockup />,
    reversed: true,
  },
];

export function Features() {
  return (
    <section id="recursos" className="py-16 lg:py-24 bg-secondary/40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-20">
          <span className="text-sm font-semibold text-primary">Recursos em destaque</span>
          <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight">
            Cada detalhe pensado para o varejo brasileiro
          </h2>
        </div>

        <div className="space-y-24 lg:space-y-32">
          {FEATURES.map((feat, i) => (
            <FeatureRow key={i} {...feat} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureRow({ eyebrow, heading, body, bullets, visual, reversed, zix }: FeatureBlock) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
      {/* Text */}
      <div className={reversed ? "lg:order-2" : "lg:order-1"}>
        <span className="text-sm font-semibold text-primary">{eyebrow}</span>
        <h3 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight">{heading}</h3>
        <p className="mt-4 text-muted-foreground leading-relaxed">{body}</p>
        <ul className="mt-6 space-y-3">
          {bullets.map((b) => (
            <li key={b} className="flex items-start gap-3 text-sm">
              <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <span className="text-foreground/80">{b}</span>
            </li>
          ))}
        </ul>
        {zix && <ZixTip tip={zix} />}
      </div>

      {/* Visual */}
      <div className={`flex justify-center ${reversed ? "lg:order-1" : "lg:order-2"}`}>
        {visual}
      </div>
    </div>
  );
}

function ZixTip({ tip }: { tip: string }) {
  return (
    <div className="mt-8 flex items-start gap-4 p-4 rounded-2xl bg-accent border border-primary/15">
      <span className="text-3xl leading-none animate-bounce select-none">📦</span>
      <div>
        <div className="text-xs font-bold text-primary uppercase tracking-wider">Zix diz</div>
        <p className="text-sm text-foreground/80 mt-0.5 leading-relaxed">{tip}</p>
      </div>
    </div>
  );
}

function CheckoutMockup() {
  return (
    <div className="w-full max-w-sm bg-surface border border-border rounded-3xl shadow-soft p-6 space-y-4">
      <div className="text-sm font-bold">Resumo do Pedido</div>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">iPhone 14 Pro × 1</span>
          <span className="font-semibold">R$ 4.200</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Capinha × 2</span>
          <span className="font-semibold">R$ 60</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Entrega – Jardins</span>
          <span className="font-semibold">R$ 8</span>
        </div>
        <div className="h-px bg-border" />
        <div className="flex justify-between font-bold text-base">
          <span>Total</span>
          <span className="text-primary">R$ 4.268</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 pt-1">
        {["PIX", "Cartão", "Entrega"].map((m) => (
          <div
            key={m}
            className="rounded-xl border border-border py-2 text-xs font-semibold text-center text-foreground/70"
          >
            {m}
          </div>
        ))}
      </div>
      <button className="w-full py-3 rounded-2xl bg-gradient-primary text-primary-foreground text-sm font-semibold shadow-glow">
        Confirmar Pedido
      </button>
    </div>
  );
}

function EstoqueMockup() {
  const items = [
    { name: "iPhone 14 Pro", stock: 84, level: "ok" },
    { name: "Samsung S23+", stock: 12, level: "low" },
    { name: "Capinha Azul", stock: 2, level: "critical" },
    { name: "Fone Bluetooth", stock: 31, level: "ok" },
  ];
  const badge: Record<string, string> = {
    ok: "bg-emerald-100 text-emerald-700",
    low: "bg-yellow-100 text-yellow-700",
    critical: "bg-red-100 text-red-600",
  };
  return (
    <div className="w-full max-w-sm bg-surface border border-border rounded-3xl shadow-soft overflow-hidden">
      <div className="px-5 py-4 border-b border-border text-sm font-bold">
        Controle de Estoque
      </div>
      <div className="divide-y divide-border">
        {items.map((item) => (
          <div key={item.name} className="flex items-center justify-between px-5 py-3.5">
            <span className="text-sm text-foreground/90">{item.name}</span>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${badge[item.level]}`}>
              {item.stock} un
            </span>
          </div>
        ))}
      </div>
      <div className="px-5 py-3 bg-red-50 border-t border-red-100 flex items-center gap-2 text-xs text-red-600 font-medium">
        ⚠️ 1 produto abaixo do limite mínimo
      </div>
    </div>
  );
}

function MultiCanalMockup() {
  return (
    <div className="w-full max-w-sm space-y-4">
      <div className="bg-surface border border-[#25D366]/40 rounded-2xl p-4 flex items-start gap-3 shadow-soft">
        <img src="/Logo Wpp.png" alt="WhatsApp" className="w-8 h-8 object-contain shrink-0 mt-0.5" />
        <div>
          <div className="text-xs font-bold text-[#128C7E]">WhatsApp</div>
          <p className="text-sm mt-0.5 text-foreground/80 leading-snug">
            "Oi, vi na sua loja o iPhone Pro, ainda tem?"
          </p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[
          { emoji: "🛒", label: "Vitrine Online", sub: "Link próprio" },
          { emoji: "🖥️", label: "PDV Físico", sub: "Atendimento presencial" },
          { emoji: "📊", label: "Painel Único", sub: "Todos os pedidos" },
        ].map((c) => (
          <div key={c.label} className="bg-surface border border-border rounded-2xl p-3 text-center shadow-soft">
            <div className="text-2xl mb-1">{c.emoji}</div>
            <div className="text-[11px] font-semibold leading-tight">{c.label}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{c.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RelatoriosMockup() {
  return (
    <div className="w-full max-w-sm bg-surface border border-border rounded-3xl shadow-soft p-6 space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-muted-foreground">Faturamento semanal</div>
          <div className="text-2xl font-bold mt-0.5">R$ 24.890</div>
        </div>
        <div className="text-xs font-bold bg-emerald-100 text-emerald-700 px-2.5 py-1.5 rounded-full">
          +12,4%
        </div>
      </div>
      <svg viewBox="0 0 260 60" className="w-full h-14">
        <defs>
          <linearGradient id="rfg" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.72 0.21 145)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="oklch(0.72 0.21 145)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M0,50 C20,45 40,28 70,30 C100,32 115,46 145,32 C175,18 200,10 230,12 L260,10 L260,60 L0,60 Z"
          fill="url(#rfg)"
        />
        <path
          d="M0,50 C20,45 40,28 70,30 C100,32 115,46 145,32 C175,18 200,10 230,12 L260,10"
          fill="none"
          stroke="oklch(0.72 0.21 145)"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      <div>
        <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2.5">
          Top produtos
        </div>
        <div className="space-y-2 text-sm">
          {[
            { name: "iPhone 14 Pro", qty: "48 un" },
            { name: "Samsung S23+", qty: "31 un" },
            { name: "Capinha Premium", qty: "19 un" },
          ].map((p) => (
            <div key={p.name} className="flex justify-between">
              <span className="text-foreground/80">{p.name}</span>
              <span className="font-semibold text-muted-foreground">{p.qty}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
