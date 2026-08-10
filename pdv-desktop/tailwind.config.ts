import type { Config } from "tailwindcss";

// Paleta própria do PDV desktop — mesmo verde de identidade do Armazix
// (armazix.com.br), mas configurada localmente porque este pacote não
// compartilha build/tokens com o app web (Electron tem pipeline próprio).
export default {
  content: ["./src/renderer/index.html", "./src/renderer/src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#00C853",
          dark: "#00A846",
          light: "#E8FBF0",
        },
        surface: "#F7F8FA",
        ink: "#0F172A",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 2px 12px rgba(15, 23, 42, 0.06)",
        glow: "0 8px 24px rgba(0, 200, 83, 0.25)",
      },
      borderRadius: {
        xl2: "1rem",
      },
    },
  },
  plugins: [],
} satisfies Config;
