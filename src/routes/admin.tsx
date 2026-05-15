import { useState, useEffect } from "react";
import { createFileRoute, Link, Outlet, useRouter, useNavigate } from "@tanstack/react-router";
import {
  ShoppingBag,
  LayoutDashboard,
  ShoppingCart,
  Package,
  Tags,
  Users,
  Warehouse,
  DollarSign,
  Monitor,
  Truck,
  Ticket,
  BarChart3,
  Settings,
  ChevronLeft,
  Search,
  Bell,
  ChevronDown,
  Menu,
  X,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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

const NAV_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/admin/dashboard" },
  { label: "Pedidos", icon: ShoppingCart, href: "/admin/orders" },
  { label: "Produtos", icon: Package, href: "/admin/products" },
  { label: "Categorias", icon: Tags, href: "/admin/categories" },
  { label: "Clientes", icon: Users, href: "/admin/customers" },
  { label: "Estoque", icon: Warehouse, href: "/admin/stock" },
  { label: "Financeiro", icon: DollarSign, href: "/admin/financial" },
  { label: "PDV", icon: Monitor, href: "/admin/pdv" },
  { label: "Delivery", icon: Truck, href: "/admin/delivery" },
  { label: "Cupons", icon: Ticket, href: "/admin/coupons" },
  { label: "Relatórios", icon: BarChart3, href: "/admin/reports" },
  { label: "Configurações", icon: Settings, href: "/admin/settings" },
];

function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();
  const pathname = router.state.location.pathname;
  const navigate = useNavigate();

  const [userName, setUserName] = useState("");
  const [userInitials, setUserInitials] = useState("");
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [userPlan, setUserPlan] = useState("Free");

  useEffect(() => {
    api.get("/api/user/get").then(async (res) => {
      if (res.ok) {
        const data = await res.json() as { user?: { name?: string; avatarUrl?: string } };
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
    }).catch(() => {});

    const storeId = localStorage.getItem("storeId");
    if (storeId) {
      fetch(`/api/subscriptions/status?storeId=${storeId}`)
        .then(r => r.json())
        .then((data: { plan?: string }) => {
          const labels: Record<string, string> = { free: "Free", start: "Start", pro: "Pro", full: "Full" };
          if (data.plan) setUserPlan(labels[data.plan] || "Free");
        }).catch(() => {});
    }
  }, []);

  const handleLogout = async () => {
    try { await api.post("/api/auth/logout", {}); } catch { /* ignore */ }
    localStorage.removeItem("csrf_token");
    localStorage.removeItem("storeId");
    navigate({ to: "/login" });
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col border-r border-border/50 bg-surface transition-[width] duration-200 fixed left-0 top-0 h-screen z-30 ${
          collapsed ? "w-[68px]" : "w-[240px]"
        }`}
      >
        <div className="h-16 flex items-center justify-between px-4">
          <Link to="/admin/dashboard" className="flex items-center gap-2.5 font-bold text-lg">
            <span className="grid place-items-center w-9 h-9 rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow shrink-0">
              <ShoppingBag className="w-5 h-5" />
            </span>
            {!collapsed && <span>ARMAZIX</span>}
          </Link>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-secondary transition-colors"
          >
            <ChevronLeft
              className={`w-4 h-4 transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`}
            />
          </button>
        </div>
        <Separator className="opacity-50" />
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto no-scrollbar">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <item.icon className={`w-5 h-5 shrink-0 ${active ? "text-primary" : ""}`} />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>
        <Separator className="opacity-50" />
        <div className="p-3">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {!collapsed && <span>Sair</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            className="fixed left-0 top-0 bottom-0 w-[260px] bg-surface border-r border-border/50 z-50 lg:hidden flex flex-col animate-in slide-in-from-left duration-100"
          >
            <div className="h-16 flex items-center justify-between px-4">
              <Link to="/admin/dashboard" className="flex items-center gap-2.5 font-bold text-lg" onClick={() => setMobileOpen(false)}>
                <span className="grid place-items-center w-9 h-9 rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
                  <ShoppingBag className="w-5 h-5" />
                </span>
                ARMAZIX
              </Link>
              <button onClick={() => setMobileOpen(false)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-secondary">
                <X className="w-5 h-5" />
              </button>
            </div>
            <Separator className="opacity-50" />
            <nav className="flex-1 py-3 px-3 space-y-0.5 overflow-y-auto no-scrollbar">
              {NAV_ITEMS.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }`}
                  >
                    <item.icon className={`w-5 h-5 ${active ? "text-primary" : ""}`} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
            <Separator className="opacity-50" />
            <div className="p-3">
              <button
                type="button"
                onClick={() => { setMobileOpen(false); handleLogout(); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span>Sair</span>
              </button>
            </div>
          </aside>
        </>
      )}

      {/* Main content area */}
      <div className={`flex-1 flex flex-col min-w-0 transition-[margin] duration-200 ${collapsed ? "lg:ml-[68px]" : "lg:ml-[240px]"}`}>
        {/* Topbar */}
        <header className="h-16 border-b border-border/50 bg-surface sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6">
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
            <Badge variant="outline" className="hidden sm:flex gap-1.5 rounded-full px-3 py-1 text-xs font-medium border-primary/30 text-primary">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              Loja ativa
            </Badge>
            <Button variant="ghost" size="icon" className="rounded-xl relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary" />
            </Button>
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
                <DropdownMenuItem className="rounded-lg cursor-pointer" onClick={() => navigate({ to: "/admin/settings", search: { tab: "perfil" } })}>Meu perfil</DropdownMenuItem>
                <DropdownMenuItem className="rounded-lg cursor-pointer" onClick={() => navigate({ to: "/admin/settings" })}>Minha loja</DropdownMenuItem>
                <DropdownMenuItem className="rounded-lg cursor-pointer" onClick={() => navigate({ to: "/admin/settings", search: { tab: "senha" } })}>Redefinir senha</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="rounded-lg cursor-pointer text-destructive" onClick={handleLogout}>Sair</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
