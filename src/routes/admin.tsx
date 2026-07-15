import { useState, useEffect, lazy, Suspense } from "react";

const WhatsAppModal = lazy(() =>
  import("@/components/admin/WhatsAppModal").then((m) => ({ default: m.WhatsAppModal }))
);

import { createFileRoute, Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  ShoppingCart,
  Loader2,
  Package,
  Tags,
  Users,
  Warehouse,
  Monitor,
  Ticket,
  Printer,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronDown,
  Search,
  Bell,
  Menu,
  X,
  LogOut,
  MessageCircle,
  UserCog,
  Building2,
  ArrowLeftRight,
  ArrowUpCircle,
  ArrowDownCircle,
  RefreshCw,
  FileText,
  Scale,
  SlidersHorizontal,
  History,
  FileSpreadsheet,
  CreditCard,
  Banknote,
  TrendingUp,
  ArrowUpDown,
  BarChart2,
  Lock,
  MonitorCheck,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { api } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
  head: () => ({
    meta: [{ title: "Painel — ARMAZIX" }],
  }),
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface NavItem {
  label: string;
  icon: LucideIcon;
  href?: string;
  action?: "whatsapp";
}

interface NavGroup {
  id: string;
  /** Undefined = no divider; defined = show section label above items */
  label?: string;
  /** True = render as collapsible accordion */
  collapsible?: boolean;
  items: NavItem[];
}

// ─── Navigation tree ──────────────────────────────────────────────────────────

const NAV_GROUPS: NavGroup[] = [
  {
    id: "top",
    items: [
      { label: "Dashboard",  icon: LayoutDashboard, href: "/admin/dashboard" },
      { label: "Pedidos",    icon: ShoppingCart,    href: "/admin/orders"    },
      { label: "Relatórios", icon: BarChart3,       href: "/admin/reports"   },
    ],
  },
  {
    id: "cadastros",
    label: "Cadastros",
    collapsible: true,
    items: [
      { label: "Produtos e Serviços",     icon: Package,   href: "/admin/products"   },
      { label: "Categorias",              icon: Tags,      href: "/admin/categories" },
      { label: "Setores",                 icon: Building2, href: "/admin/sectors"    },
      { label: "Clientes e Fornecedores", icon: Users,     href: "/admin/customers"  },
      { label: "Usuários",                icon: UserCog,   href: "/admin/users"      },
      { label: "Impressoras",             icon: Printer,       href: "/admin/printers"            },
      { label: "Ambientes de Impressão",  icon: MonitorCheck,  href: "/admin/print-environments"  },
    ],
  },
  {
    id: "estoque",
    label: "Estoque",
    collapsible: true,
    items: [
      { label: "Inventário",    icon: Warehouse,         href: "/admin/stock"             },
      { label: "Entradas",      icon: ArrowUpCircle,     href: "/admin/stock/entries"     },
      { label: "Saídas",        icon: ArrowDownCircle,   href: "/admin/stock/exits"       },
      { label: "Transferências",icon: ArrowLeftRight,    href: "/admin/stock/transfers"   },
      { label: "Extrato",       icon: FileText,          href: "/admin/stock/extract"     },
      { label: "Balanço",       icon: Scale,             href: "/admin/stock/balance"     },
      { label: "Ajuste",        icon: SlidersHorizontal, href: "/admin/stock/adjustments" },
      { label: "Histórico",     icon: History,           href: "/admin/stock/history"     },
      { label: "Balancete",     icon: FileSpreadsheet,   href: "/admin/stock/balancete"   },
    ],
  },
  {
    id: "financeiro",
    label: "Financeiro",
    collapsible: true,
    items: [
      { label: "Dashboard Financeiro", icon: BarChart3,   href: "/admin/financial"             },
      { label: "Contas a pagar",       icon: CreditCard,  href: "/admin/financial/payables"    },
      { label: "Contas a receber",     icon: Banknote,    href: "/admin/financial/receivables" },
      { label: "Fluxo de Caixa",       icon: TrendingUp,  href: "/admin/financial/cashflow"    },
      { label: "Movimentações",        icon: ArrowUpDown, href: "/admin/financial/movements"   },
      { label: "DRE",                  icon: BarChart2,   href: "/admin/financial/dre"         },
      { label: "Históricos",           icon: History,     href: "/admin/financial/history"     },
      { label: "Sessões de Caixa",     icon: Lock,        href: "/admin/financial/sessions"    },
    ],
  },
  {
    id: "outros",
    label: "Outros",
    items: [
      { label: "PDV",           icon: Monitor,       href: "/admin/pdv"      },
      { label: "Cupons",        icon: Ticket,        href: "/admin/coupons"  },
      { label: "Configurações", icon: Settings,      href: "/admin/settings" },
      { label: "WhatsApp",      icon: MessageCircle, action: "whatsapp"      },
    ],
  },
];

// ─── NavLink atom ─────────────────────────────────────────────────────────────

function NavLink({
  item,
  collapsed,
  active,
  onClose,
  onAction,
}: {
  item: NavItem;
  collapsed: boolean;
  active: boolean;
  onClose: () => void;
  onAction: (a: string) => void;
}) {
  const cls = [
    "flex items-center gap-3 rounded-xl text-sm font-medium transition-colors",
    collapsed ? "px-2 py-2.5 justify-center" : "px-3 py-2",
    active
      ? "bg-primary/10 text-primary"
      : "text-muted-foreground hover:bg-secondary hover:text-foreground",
  ].join(" ");

  const inner = (
    <>
      <item.icon className={`w-5 h-5 shrink-0 ${active ? "text-primary" : ""}`} />
      {!collapsed && <span className="truncate leading-tight">{item.label}</span>}
    </>
  );

  if (item.href) {
    return (
      <Link
        to={item.href}
        className={cls}
        onClick={onClose}
        title={collapsed ? item.label : undefined}
      >
        {inner}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={`w-full ${cls}`}
      title={collapsed ? item.label : undefined}
      onClick={() => { onClose(); item.action && onAction(item.action); }}
    >
      {inner}
    </button>
  );
}

// ─── SidebarNav ───────────────────────────────────────────────────────────────

function SidebarNav({
  pathname,
  collapsed,
  onAction,
  onClose,
}: {
  pathname: string;
  collapsed: boolean;
  onAction: (a: string) => void;
  onClose: () => void;
}) {
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const init = new Set<string>();
    NAV_GROUPS.forEach(g => {
      if (g.collapsible && g.items.some(i => i.href === pathname)) init.add(g.id);
    });
    return init;
  });

  // Auto-open the accordion when navigating directly into a collapsed group
  useEffect(() => {
    NAV_GROUPS.forEach(g => {
      if (g.collapsible && g.items.some(i => i.href === pathname)) {
        setOpenGroups(prev => {
          if (prev.has(g.id)) return prev;
          return new Set([...prev, g.id]);
        });
      }
    });
  }, [pathname]);

  function toggle(id: string) {
    setOpenGroups(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ── Collapsed: flat icon strip ────────────────────────────────────────────
  if (collapsed) {
    return (
      <div className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto no-scrollbar">
        {NAV_GROUPS.flatMap(g => g.items).map(item => (
          <NavLink
            key={item.href ?? item.label}
            item={item}
            collapsed
            active={!!item.href && pathname === item.href}
            onClose={onClose}
            onAction={onAction}
          />
        ))}
      </div>
    );
  }

  // ── Expanded: grouped with optional accordion ─────────────────────────────
  return (
    <div className="flex-1 py-3 overflow-y-auto no-scrollbar">
      {NAV_GROUPS.map(group => {
        const hasActive = group.items.some(i => i.href === pathname);
        const isOpen = !group.collapsible || openGroups.has(group.id) || hasActive;

        return (
          <div key={group.id}>
            {/* Section divider / label */}
            {group.label && (
              group.collapsible ? (
                <button
                  type="button"
                  onClick={() => toggle(group.id)}
                  className="w-full flex items-center justify-between px-4 pt-5 pb-1.5 hover:opacity-75 transition-opacity"
                >
                  <span className="text-[10px] font-semibold text-muted-foreground/55 uppercase tracking-widest select-none">
                    {group.label}
                  </span>
                  <ChevronDown
                    className={`w-3 h-3 text-muted-foreground/40 transition-transform duration-200 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
              ) : (
                <p className="px-4 pt-5 pb-1.5 text-[10px] font-semibold text-muted-foreground/55 uppercase tracking-widest select-none">
                  {group.label}
                </p>
              )
            )}

            {/* Items — smooth accordion via CSS grid-rows trick */}
            {group.collapsible ? (
              <div
                className={`grid transition-[grid-template-rows] duration-200 ease-in-out ${
                  isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                }`}
              >
                <div className="overflow-hidden">
                  <div className="px-2 pb-1 space-y-0.5">
                    {group.items.map(item => (
                      <NavLink
                        key={item.href ?? item.label}
                        item={item}
                        collapsed={false}
                        active={!!item.href && pathname === item.href}
                        onClose={onClose}
                        onAction={onAction}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="px-2 pb-1 space-y-0.5">
                {group.items.map(item => (
                  <NavLink
                    key={item.href ?? item.label}
                    item={item}
                    collapsed={false}
                    active={!!item.href && pathname === item.href}
                    onClose={onClose}
                    onAction={onAction}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── AdminLayout ──────────────────────────────────────────────────────────────

function AdminLayout() {
  const [collapsed, setCollapsed]     = useState(false);
  const [mobileOpen, setMobileOpen]   = useState(false);
  const [wppModalOpen, setWppModalOpen] = useState(false);
  const [mounted, setMounted]         = useState(false);

  const pathname  = useRouterState({ select: (s) => s.location.pathname });
  const navigate  = useNavigate();

  const [userName,     setUserName]     = useState("");
  const [userInitials, setUserInitials] = useState("");
  const [userAvatar,   setUserAvatar]   = useState<string | null>(null);
  const [userPlan,     setUserPlan]     = useState("Free");

  useEffect(() => {
    setMounted(true);

    api.get("/api/user/get")
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) {
          localStorage.removeItem("csrf_token");
          localStorage.removeItem("storeId");
          navigate({ to: "/login" });
          return;
        }
        if (res.ok) {
          const data = (await res.json()) as { user?: { name?: string; avatarUrl?: string } };
          const name = data.user?.name || "";
          if (name) {
            setUserName(name);
            const words = name.trim().split(/\s+/);
            const initials = words.length >= 2
              ? words[0][0] + words[words.length - 1][0]
              : words[0].slice(0, 2);
            setUserInitials(initials.toUpperCase());
          }
          if (data.user?.avatarUrl) setUserAvatar(data.user.avatarUrl);
        }
      })
      .catch(() => {});

    async function ensureStoreId() {
      let storeId = localStorage.getItem("storeId");
      if (!storeId) {
        try {
          const r = await api.get("/api/store/user");
          if (r.ok) {
            const d = await r.json() as { store?: { id: string } };
            storeId = d.store?.id ?? null;
            if (storeId) localStorage.setItem("storeId", storeId);
          }
        } catch { /* não crítico */ }
      }
      if (storeId) {
        fetch(`/api/subscriptions/status?storeId=${storeId}`)
          .then(r => r.json())
          .then((data: { plan?: string }) => {
            const labels: Record<string, string> = { free: "Free", start: "Start", pro: "Pro", full: "Full" };
            if (data.plan) setUserPlan(labels[data.plan] || "Free");
          })
          .catch(() => {});
      }
    }
    ensureStoreId();
  }, []);

  const handleLogout = async () => {
    try { await api.post("/api/auth/logout", {}); } catch { /* ignore */ }
    localStorage.removeItem("csrf_token");
    localStorage.removeItem("storeId");
    navigate({ to: "/login" });
  };

  const handleSidebarAction = (action: string) => {
    if (action === "whatsapp") setWppModalOpen(true);
  };

  // SSR guard — prevents SSR-incompatible libs from running in Cloudflare Worker
  if (!mounted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // ── Shared footer (Sair) ──────────────────────────────────────────────────
  function SidebarFooter({ fullWidth }: { fullWidth: boolean }) {
    return (
      <div className="p-3">
        <button
          type="button"
          onClick={handleLogout}
          className={[
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium",
            "text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors",
            !fullWidth && collapsed ? "justify-center" : "",
          ].join(" ")}
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {(fullWidth || !collapsed) && <span>Sair</span>}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">

      {/* ── Desktop sidebar ────────────────────────────────────────────────── */}
      <aside
        className={[
          "hidden lg:flex flex-col border-r border-border/50 bg-surface",
          "fixed left-0 top-0 h-screen z-30 transition-[width] duration-200",
          collapsed ? "w-[68px]" : "w-[240px]",
        ].join(" ")}
      >
        {/* Logo + collapse toggle */}
        <div className="h-16 flex items-center justify-between px-3 shrink-0">
          <Link to="/admin/dashboard" className="flex items-center gap-2.5 font-bold text-lg overflow-hidden">
            <span className="grid place-items-center w-9 h-9 rounded-2xl shrink-0 overflow-hidden">
              <img src="/logo.png" alt="ARMAZIX" className="w-full h-full object-contain" />
            </span>
            {!collapsed && <span className="truncate">ARMAZIX</span>}
          </Link>
          <button
            onClick={() => setCollapsed(v => !v)}
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-secondary transition-colors shrink-0"
          >
            <ChevronLeft
              className={`w-4 h-4 transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`}
            />
          </button>
        </div>

        <Separator className="opacity-50 shrink-0" />

        <SidebarNav
          pathname={pathname}
          collapsed={collapsed}
          onAction={handleSidebarAction}
          onClose={() => {}}
        />

        <Separator className="opacity-50 shrink-0" />
        <SidebarFooter fullWidth={false} />
      </aside>

      {/* ── Mobile sidebar overlay ─────────────────────────────────────────── */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed left-0 top-0 bottom-0 w-[268px] bg-surface border-r border-border/50 z-50 lg:hidden flex flex-col animate-in slide-in-from-left duration-100">
            <div className="h-16 flex items-center justify-between px-4 shrink-0">
              <Link
                to="/admin/dashboard"
                className="flex items-center gap-2.5 font-bold text-lg"
                onClick={() => setMobileOpen(false)}
              >
                <span className="grid place-items-center w-9 h-9 rounded-2xl overflow-hidden shrink-0">
                  <img src="/logo.png" alt="ARMAZIX" className="w-full h-full object-contain" />
                </span>
                ARMAZIX
              </Link>
              <button
                onClick={() => setMobileOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-secondary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <Separator className="opacity-50 shrink-0" />

            <SidebarNav
              pathname={pathname}
              collapsed={false}
              onAction={(a) => { setMobileOpen(false); handleSidebarAction(a); }}
              onClose={() => setMobileOpen(false)}
            />

            <Separator className="opacity-50 shrink-0" />
            <SidebarFooter fullWidth />
          </aside>
        </>
      )}

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-[margin] duration-200 ${
          collapsed ? "lg:ml-[68px]" : "lg:ml-[240px]"
        }`}
      >
        {/* Topbar */}
        <header className="h-16 border-b border-border/50 bg-surface sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden w-9 h-9 rounded-xl flex items-center justify-center hover:bg-secondary transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar pedidos, produtos..."
                className="pl-9 h-9 w-64 rounded-xl bg-secondary/50 border-0 focus-visible:ring-1"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="hidden sm:flex gap-1.5 rounded-full px-3 py-1 text-xs font-medium border-primary/30 text-primary"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              Loja ativa
            </Badge>
            <button className="relative w-9 h-9 rounded-xl flex items-center justify-center hover:bg-secondary transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary" />
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-xl hover:bg-secondary transition-colors">
                  <Avatar className="w-8 h-8">
                    {userAvatar && <AvatarImage src={userAvatar} alt={userName} />}
                    <AvatarFallback className="bg-primary/15 text-primary text-xs font-bold">
                      {userInitials || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden sm:block text-left">
                    <div className="text-sm font-medium leading-tight">{userName || "..."}</div>
                    <div className="text-[11px] text-muted-foreground">Plano {userPlan}</div>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 rounded-xl">
                <DropdownMenuItem
                  className="rounded-lg cursor-pointer"
                  onClick={() => navigate({ to: "/admin/settings", search: { tab: "perfil" } })}
                >
                  Meu perfil
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="rounded-lg cursor-pointer"
                  onClick={() => navigate({ to: "/admin/settings", search: { tab: "geral" } })}
                >
                  Minha loja
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="rounded-lg cursor-pointer"
                  onClick={() => navigate({ to: "/admin/settings", search: { tab: "senha" } })}
                >
                  Redefinir senha
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="rounded-lg cursor-pointer text-destructive"
                  onClick={handleLogout}
                >
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto">
          <Outlet />
        </main>
      </div>

      {/* WhatsApp modal — lazy loaded */}
      <Suspense fallback={null}>
        <WhatsAppModal open={wppModalOpen} onClose={() => setWppModalOpen(false)} />
      </Suspense>
    </div>
  );
}
