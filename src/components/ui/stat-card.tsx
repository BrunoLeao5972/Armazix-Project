import type { ElementType, ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Card de indicador (KPI) compacto: ícone ao lado do número, em vez de o ícone
// em cima e o número grande embaixo. Ocupa cerca de metade da altura do layout
// anterior, o que importa no celular, onde os cards em 2 colunas viravam blocos
// enormes. Único lugar pra ajustar o tamanho de todos os indicadores do painel.
export function StatCard({
  icon: Icon, label, value, sub, iconBg, iconColor, valueClassName, className, center, badge, onClick,
}: {
  icon?: ElementType;
  label: string;
  value: ReactNode;
  sub?: string;
  iconBg?: string;
  iconColor?: string;
  valueClassName?: string;
  className?: string;
  /** Sem ícone e com texto centralizado (ex.: contadores de entrega). */
  center?: boolean;
  /** Elemento extra à direita (ex.: variação ▲ 12% do dashboard). */
  badge?: ReactNode;
  onClick?: () => void;
}) {
  return (
    <Card className={cn("rounded-xl border-border/50 shadow-soft", className)} onClick={onClick}>
      <CardContent className={cn("p-2.5 flex items-center gap-2.5", center && "justify-center text-center")}>
        {Icon && (
          <span className={cn("grid place-items-center w-8 h-8 rounded-lg shrink-0", iconBg)}>
            <Icon className={cn("w-4 h-4", iconColor)} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className={cn("text-base font-bold tracking-tight leading-tight truncate", valueClassName)}>{value}</div>
          <div className="text-[11px] text-muted-foreground leading-tight truncate">{label}</div>
          {sub && <div className="text-[10px] text-muted-foreground leading-tight truncate mt-0.5">{sub}</div>}
        </div>
        {badge}
      </CardContent>
    </Card>
  );
}
