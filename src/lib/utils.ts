import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Escapa valores antes de interpolar em template literals de HTML cru
 * (relatórios impressos via document.write, exports para Blob/download).
 * JSX já escapa sozinho — isso é só para os poucos lugares que montam
 * HTML como string fora do React.
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!
  ));
}
