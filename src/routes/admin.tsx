import { useState, useEffect, lazy, Suspense } from "react";

const WhatsAppModal = lazy(() =>
  import("@/components/admin/WhatsAppModal").then((m) => ({ default: m.WhatsAppModal }))
);
const PlansSection = lazy(() =>
  import("@/components/admin/settings/PlansSection").then((m) => ({ default: m.PlansSection }))
);
const CompleteDocumentoLoja = lazy(() =>
  import("@/components/admin/settings/CompleteDocumentoLoja").then((m) => ({ default: m.CompleteDocumentoLoja }))
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
  Receipt,
  Mail,
  AlertTriangle,
  Clock,
  Lock,
  MonitorCheck,
  Settings2,
} from "lucide-react";

import { isStorePlanBlocked } from "@/lib/plans";
import { OrderNotifier, useNotificationPermission } from "./admin/-order-notifier";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/admin/ThemeToggle";
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
      { label: "Pedidos",    icon: ShoppingCart,    href: "/admin/pedidos"    },
      { label: "Relatórios", icon: BarChart3,       href: "/admin/relatorios"   },
    ],
  },
  {
    id: "cadastros",
    label: "Cadastros",
    collapsible: true,
    items: [
      { label: "Produtos e Serviços",     icon: Package,   href: "/admin/produtos"   },
      { label: "Categorias",              icon: Tags,      href: "/admin/categorias" },
      { label: "Setores",                 icon: Building2, href: "/admin/setores"    },
      { label: "Clientes e Fornecedores", icon: Users,     href: "/admin/clientes"  },
      { label: "Usuários",                icon: UserCog,   href: "/admin/usuarios"      },
      { label: "Impressoras",             icon: Printer,       href: "/admin/impressoras"            },
      { label: "Ambientes de Impressão",  icon: MonitorCheck,  href: "/admin/ambientes-impressao"  },
    ],
  },
  {
    id: "estoque",
    label: "Estoque",
    collapsible: true,
    items: [
      { label: "Inventário",    icon: Warehouse,         href: "/admin/estoque"             },
      { label: "Entradas",      icon: ArrowUpCircle,     href: "/admin/estoque/entradas"     },
      { label: "Saídas",        icon: ArrowDownCircle,   href: "/admin/estoque/saidas"       },
      { label: "Extrato",       icon: FileText,          href: "/admin/estoque/extrato"     },
      { label: "Balanço",       icon: Scale,             href: "/admin/estoque/balanco"     },
      { label: "Ajuste",        icon: SlidersHorizontal, href: "/admin/estoque/ajustes" },
      { label: "Histórico",     icon: History,           href: "/admin/estoque/historico"     },
      { label: "Balancete",     icon: FileSpreadsheet,   href: "/admin/estoque/balancete"   },
    ],
  },
  {
    id: "financeiro",
    label: "Financeiro",
    collapsible: true,
    items: [
      { label: "Dashboard Financeiro", icon: BarChart3,   href: "/admin/financeiro"             },
      { label: "Vendas",               icon: Receipt,     href: "/admin/financeiro/vendas"   },
      { label: "Contas a pagar",       icon: CreditCard,  href: "/admin/financeiro/pagar"    },
      { label: "Contas a receber",     icon: Banknote,    href: "/admin/financeiro/receber" },
      { label: "Fluxo de Caixa",       icon: TrendingUp,  href: "/admin/financeiro/fluxo-caixa"    },
      { label: "Movimentações",        icon: ArrowUpDown, href: "/admin/financeiro/movimentacoes"   },
      { label: "DRE",                  icon: BarChart2,   href: "/admin/financeiro/dre"         },
      { label: "Históricos",           icon: History,     href: "/admin/financeiro/historico"     },
      { label: "Sessões de Caixa",     icon: Lock,        href: "/admin/financeiro/sessoes"    },
      { label: "Gerais",               icon: Settings2,   href: "/admin/financeiro/configuracoes"    },
    ],
  },
  {
    id: "outros",
    label: "Outros",
    items: [
      { label: "PDV",           icon: Monitor,       href: "/admin/pdv"      },
      { label: "Cupons",        icon: Ticket,        href: "/admin/cupons"  },
      { label: "Configurações", icon: Settings,      href: "/admin/configuracoes" },
      { label: "WhatsApp",      icon: MessageCircle, action: "whatsapp"      },
    ],
  },
];

// ─── NavLink atom ─────────────────────────────────────────────────────────────

function NavLink({
  item,
  collapsed,
  active,
  alert,
  onClose,
  onAction,
}: {
  item: NavItem;
  collapsed: boolean;
  active: boolean;
  /** Bolinha vermelha piscando (ex.: chegou pedido e o operador está noutra tela) */
  alert?: boolean;
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
      <span className="relative shrink-0">
        <item.icon className={`w-5 h-5 ${active ? "text-primary" : ""}`} />
        {alert && (
          <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75 animate-ping motion-reduce:animate-none" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-surface" />
          </span>
        )}
      </span>
      {!collapsed && (
        <span className="flex items-center gap-1.5 min-w-0 leading-tight">
          <span className="truncate">{item.label}</span>
          {alert && (
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500 animate-pulse motion-reduce:animate-none" />
          )}
        </span>
      )}
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
  alertPedidos,
  onAction,
  onClose,
}: {
  pathname: string;
  collapsed: boolean;
  /** Liga a bolinha vermelha piscando no item "Pedidos" */
  alertPedidos?: boolean;
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
            alert={!!alertPedidos && item.href === "/admin/pedidos"}
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
                        alert={!!alertPedidos && item.href === "/admin/pedidos"}
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
                    alert={!!alertPedidos && item.href === "/admin/pedidos"}
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
  const { perm: notifPerm, request: requestNotif } = useNotificationPermission();

  // Bolinha vermelha piscando no item "Pedidos" — ligada pelo vigia global
  // quando chega pedido e o operador está noutra tela (PDV, Financeiro…),
  // desligada assim que ele entra no quadro de pedidos.
  const [alertaPedido, setAlertaPedido] = useState(false);
  useEffect(() => {
    if (pathname === "/admin/pedidos") setAlertaPedido(false);
  }, [pathname]);

  const [userName,     setUserName]     = useState("");
  const [userInitials, setUserInitials] = useState("");
  const [userAvatar,   setUserAvatar]   = useState<string | null>(null);
  const [userPlan,     setUserPlan]     = useState("Free");

  // ── Lembrete de email não verificado ──────────────────────────────────────
  // Começa "true" (some) até a resposta chegar — evita um flash do banner pra
  // quem já verificou. "Dispensar" some só na sessão atual (sessionStorage);
  // continua reaparecendo enquanto o email não for verificado de fato.
  const [emailVerified, setEmailVerified] = useState(true);
  const [userEmail,     setUserEmail]     = useState("");
  const [bannerDismissed, setBannerDismissed] = useState(
    typeof window !== "undefined" && sessionStorage.getItem("armazix:emailBannerDismissed") === "true"
  );

  // ── Alerta de expiração de plano (teste grátis ou assinatura paga) ────────
  // Não é dispensável — se sumisse, o lojista podia perder acesso sem perceber.
  const [planId,        setPlanId]        = useState("free");
  const [planExpiresAt, setPlanExpiresAt] = useState<string | null>(null);
  // planStatus/planChecked alimentam o bloqueio de plano vencido (ver
  // src/lib/plans.ts). planChecked só vira true depois da 1ª resposta de
  // /api/subscriptions/status — antes disso nunca mostra a tela de
  // bloqueio, mesmo que os valores iniciais (planStatus null) tecnicamente
  // "pareçam" vencidos pra isStorePlanBlocked().
  const [planStatus,  setPlanStatus]  = useState<string | null>(null);
  const [planChecked, setPlanChecked] = useState(false);
  const planBlocked = planChecked && isStorePlanBlocked({ planStatus, planExpiresAt });

  // Usada no mount e no polling da tela de bloqueio (mais abaixo) — mesma
  // chamada, só muda de onde é disparada.
  function checkPlanStatus(storeId: string) {
    return fetch(`/api/subscriptions/status?storeId=${storeId}`)
      .then(r => r.json())
      .then((data: { plan?: string; planStatus?: string; planExpiresAt?: string | null }) => {
        const labels: Record<string, string> = { free: "Free", start: "Start", pro: "Pro", full: "Full" };
        if (data.plan) setUserPlan(labels[data.plan] || "Free");
        if (data.plan) setPlanId(data.plan);
        setPlanExpiresAt(data.planExpiresAt ?? null);
        setPlanStatus(data.planStatus ?? null);
        setPlanChecked(true);
      })
      .catch(() => {});
  }

  // ── Alerta de CNPJ/CPF pendente ───────────────────────────────────────────
  // registerHandler já exige documento desde sempre — isso só pega contas
  // criadas antes dessa regra existir (ou seedadas na mão). documentoChecked
  // só vira true depois da 1ª resposta, mesma cautela do plano: nunca bloqueia
  // com base num estado inicial que só "parece" pendente.
  const [documentoPendente, setDocumentoPendente] = useState(false);
  const [documentoChecked,  setDocumentoChecked]  = useState(false);
  const documentoBloqueado = documentoChecked && documentoPendente;
  // Plano vencido cobra antes (é o mais urgente); documento pendente só se
  // sobrepõe quando o plano está OK. Os dois usam o mesmo visual de bloqueio.
  const bloqueado = planBlocked || documentoBloqueado;

  function checkDocumentoStatus(storeId: string) {
    return fetch(`/api/store/get?id=${storeId}`)
      .then(r => r.json())
      // O servidor nunca devolve cnpj/cpf cru aqui (LGPD) — só documentoTipo,
      // presente quando já há algum documento vinculado (ver store-handler.ts).
      .then((data: { store?: { documentoTipo?: "cpf" | "cnpj" | null } }) => {
        setDocumentoPendente(!data.store?.documentoTipo);
        setDocumentoChecked(true);
      })
      .catch(() => {});
  }

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
          const data = (await res.json()) as { user?: { name?: string; avatarUrl?: string; email?: string; emailVerified?: boolean } };
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
          if (data.user?.email) setUserEmail(data.user.email);
          setEmailVerified(data.user?.emailVerified !== false);
        }
      })
      .catch(() => {});

    async function ensureStoreId() {
      // Sempre revalida contra a sessão autenticada, mesmo com valor em cache
      // — um storeId de outra conta pode ter ficado no localStorage (ex:
      // navegador usado para testar mais de uma conta) e nunca deve ser usado
      // sem confirmar que ainda é o dono logado.
      let storeId: string | null = null;
      try {
        const r = await api.get("/api/store/user");
        if (r.ok) {
          const d = await r.json() as { store?: { id: string } };
          storeId = d.store?.id ?? null;
          if (storeId) localStorage.setItem("storeId", storeId);
        }
      } catch { /* não crítico */ }
      if (!storeId) storeId = localStorage.getItem("storeId");
      if (storeId) {
        checkPlanStatus(storeId);
        checkDocumentoStatus(storeId);
      }
    }
    ensureStoreId();
  }, []);

  // Enquanto a tela de bloqueio está no ar, revalida sozinho a cada ~8s —
  // assim que o webhook do PIX aprovar o pagamento, a tela libera sem o
  // lojista precisar recarregar a página.
  useEffect(() => {
    if (!planBlocked) return;
    const storeId = localStorage.getItem("storeId");
    if (!storeId) return;
    const interval = setInterval(() => checkPlanStatus(storeId), 8000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planBlocked]);

  const handleLogout = async () => {
    try { await api.post("/api/auth/logout", {}); } catch { /* ignore */ }
    localStorage.removeItem("csrf_token");
    localStorage.removeItem("storeId");
    navigate({ to: "/login" });
  };

  const handleSidebarAction = (action: string) => {
    if (action === "whatsapp") setWppModalOpen(true);
  };

  const dismissEmailBanner = () => {
    setBannerDismissed(true);
    sessionStorage.setItem("armazix:emailBannerDismissed", "true");
  };

  const planDaysRemaining = planExpiresAt
    ? Math.ceil((new Date(planExpiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
    : null;
  const showPlanExpiryBanner = planDaysRemaining !== null && planDaysRemaining <= 5;
  const planDaysLabel = planDaysRemaining !== null
    ? (planDaysRemaining <= 0 ? "hoje" : `${planDaysRemaining} dia${planDaysRemaining === 1 ? "" : "s"}`)
    : "";

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

        <div className={bloqueado ? "flex-1 min-h-0 overflow-hidden blur-[3px] pointer-events-none select-none opacity-60 transition-all" : "contents"}>
          <SidebarNav
            pathname={pathname}
            collapsed={collapsed}
            alertPedidos={alertaPedido}
            onAction={handleSidebarAction}
            onClose={() => {}}
          />
        </div>

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

            <div className={bloqueado ? "flex-1 min-h-0 overflow-hidden blur-[3px] pointer-events-none select-none opacity-60 transition-all" : "contents"}>
              <SidebarNav
                pathname={pathname}
                collapsed={false}
                alertPedidos={alertaPedido}
                onAction={(a) => { setMobileOpen(false); handleSidebarAction(a); }}
                onClose={() => setMobileOpen(false)}
              />
            </div>

            <Separator className="opacity-50 shrink-0" />
            <SidebarFooter fullWidth />
          </aside>
        </>
      )}

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <div
        className={`flex-1 flex flex-col min-w-0 h-screen overflow-hidden transition-[margin] duration-200 ${
          collapsed ? "lg:ml-[68px]" : "lg:ml-[240px]"
        }`}
      >
        {/* Topbar — não precisa mais de "sticky": a coluna inteira agora tem
            altura travada em h-screen, então quem rola é só o <main> abaixo. */}
        <header className="h-16 border-b border-border/50 bg-surface z-30 flex items-center justify-between px-4 sm:px-6 shrink-0">
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
            <button
              onClick={() => { requestNotif(); navigate({ to: "/admin/pedidos" }); }}
              title={
                notifPerm === "granted" ? "Notificações de novos pedidos ativas — ir para pedidos"
                : notifPerm === "denied" ? "Notificações bloqueadas no navegador — ir para pedidos"
                : "Ativar notificações de novos pedidos"
              }
              className="relative w-9 h-9 rounded-xl flex items-center justify-center hover:bg-secondary transition-colors"
            >
              <Bell className="w-5 h-5" />
              {notifPerm !== "granted" && notifPerm !== "unsupported" && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary" />
              )}
            </button>

            <ThemeToggle />

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
                  onClick={() => navigate({ to: "/admin/configuracoes", search: { tab: "perfil" } })}
                >
                  Meu perfil
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="rounded-lg cursor-pointer"
                  onClick={() => navigate({ to: "/admin/configuracoes", search: { tab: "geral" } })}
                >
                  Minha loja
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="rounded-lg cursor-pointer"
                  onClick={() => navigate({ to: "/admin/configuracoes", search: { tab: "senha" } })}
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

        {/* Lembrete de email não verificado — discreto, sempre volta a aparecer
            em novas sessões enquanto o email não for confirmado de fato */}
        {!emailVerified && !bannerDismissed && (
          <div className="shrink-0 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800/60 px-4 sm:px-6 py-2 flex items-center gap-2.5 text-xs sm:text-sm">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="text-amber-800 dark:text-amber-300 flex-1 min-w-0 truncate">
              Seu email ainda não foi verificado.
            </span>
            <button
              onClick={() => navigate({ to: "/verify-email", search: { email: userEmail, next: "admin" } })}
              className="flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 transition-colors shrink-0"
            >
              <Mail className="w-3.5 h-3.5" /> Verificar agora
            </button>
            <button
              onClick={dismissEmailBanner}
              title="Dispensar por agora"
              className="w-6 h-6 rounded-lg flex items-center justify-center text-amber-600/70 dark:text-amber-400/70 hover:bg-amber-500/10 hover:text-amber-800 dark:hover:text-amber-200 transition-colors shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Alerta de expiração de plano — teste grátis ou assinatura paga a
            <= 5 dias de vencer. Sem botão de dispensar de propósito. */}
        {showPlanExpiryBanner && (
          <div className="shrink-0 bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-800/60 px-4 sm:px-6 py-2 flex items-center gap-2.5 text-xs sm:text-sm">
            <Clock className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
            <span className="text-red-800 dark:text-red-300 flex-1 min-w-0 truncate">
              {planId === "free"
                ? `Seu período de teste vence em ${planDaysLabel}. Assine um plano para não perder o acesso ao sistema.`
                : `Plano atual vence em ${planDaysLabel}. Assine um plano para não perder o acesso ao sistema.`}
            </span>
            <button
              onClick={() => navigate({ to: "/admin/configuracoes", search: { tab: "planos" } })}
              className="flex items-center gap-1 font-semibold text-red-700 dark:text-red-300 hover:text-red-900 dark:hover:text-red-100 transition-colors shrink-0"
            >
              <ArrowUpCircle className="w-3.5 h-3.5" /> {planId === "free" ? "Renovar / Assinar Plano" : "Renovar / Fazer Upgrade"}
            </button>
          </div>
        )}

        {/* Page content */}
        {/* overflow-x-hidden: nenhuma página de conteúdo deve conseguir rolar de
            lado — se algum elemento (ex: uma barra de ferramentas) transbordar,
            fica só clipado, em vez de tornar o conteúdo arrastável na horizontal
            (o que em touch se sente como a página/sidebar "balançando" ao rolar
            verticalmente). */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto overflow-x-hidden">
          {planBlocked ? (
            <div className="max-w-2xl mx-auto space-y-5">
              <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 flex items-start gap-3">
                <Lock className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <h1 className="font-semibold text-foreground">Seu plano venceu</h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    O acesso ao painel fica bloqueado até a renovação. Escolha um plano e pague
                    por PIX ou cartão abaixo — assim que o pagamento for confirmado, o painel
                    libera automaticamente.
                  </p>
                </div>
              </div>
              <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}>
                <PlansSection />
              </Suspense>
            </div>
          ) : documentoBloqueado ? (
            <div className="max-w-2xl mx-auto space-y-5">
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 flex items-start gap-3">
                <FileText className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h1 className="font-semibold text-foreground">Falta o CNPJ/CPF da sua conta</h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    Pra validar sua conta e continuar usando o painel, precisamos do CNPJ ou CPF
                    do titular. É um dado único por conta e, depois de salvo, só o suporte pode alterar.
                  </p>
                </div>
              </div>
              <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}>
                <CompleteDocumentoLoja
                  storeId={localStorage.getItem("storeId") || ""}
                  onResolved={() => setDocumentoPendente(false)}
                />
              </Suspense>
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>

      {/* WhatsApp modal — lazy loaded */}
      <Suspense fallback={null}>
        <WhatsAppModal open={wppModalOpen} onClose={() => setWppModalOpen(false)} />
      </Suspense>

      {/* Vigia de novos pedidos — som + notificação do SO + aceite automático
          + bolinha piscando no menu, em qualquer tela do admin, não só no
          quadro de pedidos. */}
      <OrderNotifier onNovoPedido={() => setAlertaPedido(true)} />
    </div>
  );
}
