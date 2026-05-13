import { ShoppingBag, Lock, ShieldCheck } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid md:grid-cols-4 gap-10">
          <div className="md:col-span-2">
            <a href="#" className="flex items-center gap-2 font-bold text-lg">
              <span className="grid place-items-center w-9 h-9 rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
                <ShoppingBag className="w-5 h-5" />
              </span>
              ARMAZIX
            </a>
            <p className="mt-4 text-sm text-muted-foreground max-w-sm">
              O ecossistema brasileiro para lojas digitais e marketplaces locais.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full bg-secondary text-foreground/80">
                <Lock className="w-3.5 h-3.5" />
                Criptografia SSL
              </span>
              <span className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full bg-secondary text-foreground/80">
                <ShieldCheck className="w-3.5 h-3.5" />
                Pagamentos Protegidos
              </span>
            </div>
          </div>
          <FooterCol
            title="Produto"
            links={["Funcionalidades", "Categorias", "Preços", "Status"]}
          />
          <FooterCol
            title="Institucional"
            links={["Sobre", "Blog", "Termos", "Privacidade"]}
          />
        </div>
        <div className="mt-12 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} ARMAZIX. armazix.com.br</p>
          <p>Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: string[] }) {
  return (
    <div>
      <h4 className="font-semibold text-sm mb-4">{title}</h4>
      <ul className="space-y-3 text-sm text-muted-foreground">
        {links.map((l) => (
          <li key={l}>
            <a href="#" className="hover:text-foreground transition-colors">
              {l}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
