import type { SVGProps } from "react";

// Módulo à parte pra não acoplar os chunks lazy de -menu-funcoes-pdv.tsx e
// -modal-pontos-atendimento.tsx (que também usam esse ícone).
export function MesaTableIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* Tampo da Mesa */}
      <rect x="3" y="7" width="18" height="4" rx="1" />

      {/* Pernas da Frente */}
      <path d="M 5 11 v 9" />
      <path d="M 19 11 v 9" />

      {/* Pernas de Trás (Menores para dar profundidade) */}
      <path d="M 8 11 v 5" />
      <path d="M 16 11 v 5" />
    </svg>
  );
}
