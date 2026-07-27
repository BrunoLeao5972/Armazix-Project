// Radix Portal (Sheet/Dialog) renderiza por padrão direto em document.body,
// escapando do wrapper .theme-light-locked em __root.tsx — como custom
// properties CSS cascateiam pela árvore real do DOM, o conteúdo portalizado
// passa a herdar direto de <html>, ignorando a reafirmação de tema claro do
// wrapper. Este contexto expõe o próprio nó do wrapper como container do
// Portal, para que o conteúdo portalizado continue sendo descendente real
// dele (display:contents não impede isso — só tira o wrapper do fluxo de
// layout, não da árvore do DOM).
import { createContext, useContext } from "react";

export const PortalContainerContext = createContext<HTMLElement | null>(null);

export function usePortalContainer(): HTMLElement | undefined {
  return useContext(PortalContainerContext) ?? undefined;
}
