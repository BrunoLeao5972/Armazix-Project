import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { ThemeProvider, NO_FLASH_THEME_SCRIPT } from "@/lib/theme";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Ops! Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A página que você está procurando não existe ou foi movida.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Voltar a tela inicial
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Esta página não carregou
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Algo deu errado em nosso lado. Você pode tentar recarregar ou voltar para a tela inicial.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Tentar novamente
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Voltar a tela inicial
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "ARMAZIX" },
      { name: "description", content: "Sua loja digital com a velocidade de um clique." },
      { name: "author", content: "ARMAZIX" },
      { property: "og:title", content: "ARMAZIX" },
      { property: "og:description", content: "Sua loja digital com a velocidade de um clique." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Script síncrono (sem async/defer) dentro de <head>: o parser HTML
            executa isto durante o parse do próprio <head>, e o navegador só
            pinta a página depois que o <head> termina de ser parseado E o
            CSS termina de carregar — então a classe .dark já está aplicada
            antes do primeiro paint, não importa a posição exata em que este
            script acabe aparecendo no HTML final (o React 19 promove
            <link rel="stylesheet"> para o topo do <head>, à frente de tags
            comuns como esta, mas isso não afeta a garantia acima). O SSR não
            tem acesso a localStorage/matchMedia, então isso só pode ser
            resolvido no client — ver src/lib/theme.tsx. */}
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_THEME_SCRIPT }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  // Modo escuro é exclusivo do painel administrativo — a loja pública, a
  // landing page e as telas de autenticação (login, cadastro, convite...)
  // sempre ficam no claro, mesmo que .dark esteja ativo em <html> por causa
  // do admin ter sido usado na mesma aba. "contents" tira este wrapper do
  // fluxo de layout (não afeta flex/grid dos filhos); .theme-light-locked só
  // reafirma as variáveis de cor claras (ver styles.css) — não interfere no
  // <html class="dark"> em si, que o admin continua controlando normalmente.
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isAdminRoute = pathname.startsWith("/admin");

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <div className={isAdminRoute ? "contents" : "contents theme-light-locked"}>
          <Outlet />
        </div>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
