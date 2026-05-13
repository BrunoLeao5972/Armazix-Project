import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Store,
  User,
  Bell,
  Shield,
  CreditCard,
  Palette,
  Globe,
  HelpCircle,
  Loader2,
  Check,
  Zap,
  Package,
  Smartphone,
  TrendingUp,
  Sparkles,
  ArrowRight,
  Building2,
  MapPin,
  Copy,
  Link2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/admin/settings")({
  component: SettingsPage,
  head: () => ({
    meta: [{ title: "Configurações — ARMAZIX" }],
  }),
});

interface StoreData {
  id: string;
  name: string;
  slug: string;
  description: string;
  phone: string;
  email: string;
  primaryColor: string;
  address?: {
    street: string;
    number: string;
    neighborhood: string;
    city: string;
    state: string;
    zip: string;
    complement?: string;
  };
}

function SettingsPage() {
  const [activeTab, setActiveTab] = useState("geral");
  const [store, setStore] = useState<StoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Form states
  const [storeName, setStoreName] = useState("");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#00C853");

  useEffect(() => {
    const storeId = localStorage.getItem("storeId");
    if (storeId) {
      fetchStore(storeId);
    } else {
      setLoading(false);
      setError("Loja não encontrada");
    }
  }, []);

  const fetchStore = async (storeId: string) => {
    try {
      const res = await fetch(`/api/store/get?id=${storeId}`);
      const data = await res.json();
      if (res.ok && data.store) {
        setStore(data.store);
        setStoreName(data.store.name || "");
        setDescription(data.store.description || "");
        setPhone(data.store.phone || "");
        setEmail(data.store.email || "");
        setPrimaryColor(data.store.primaryColor || "#00C853");
      } else {
        setError(data.error || "Erro ao carregar loja");
      }
    } catch (err) {
      setError("Erro de conexão");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!store) return;
    setSaving(true);
    setSuccess(false);
    try {
      const res = await fetch("/api/store/update", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          storeId: store.id,
          name: storeName,
          description,
          phone,
          email,
          primaryColor,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(true);
        setStore(data.store);
      } else {
        setError(data.error || "Erro ao salvar");
      }
    } catch (err) {
      setError("Erro de conexão");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">Gerencie sua loja, plano e preferências</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 rounded-xl">
          <TabsTrigger value="geral" className="rounded-lg">Geral</TabsTrigger>
          <TabsTrigger value="personalizacao" className="rounded-lg">Aparência</TabsTrigger>
          <TabsTrigger value="planos" className="rounded-lg">Ver Planos</TabsTrigger>
          <TabsTrigger value="notificacoes" className="rounded-lg">Notificações</TabsTrigger>
        </TabsList>

        <TabsContent value="geral" className="mt-6 space-y-6">
          {/* Store Info */}
          <Card className="rounded-2xl border-border/50 shadow-soft">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Store className="w-4 h-4" />
                Dados da loja
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome da loja</Label>
                  <Input 
                    value={storeName} 
                    onChange={(e) => setStoreName(e.target.value)}
                    className="h-11 rounded-xl" 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Slug (URL)</Label>
                  <Input value={store?.slug || ""} disabled className="h-11 rounded-xl bg-muted" />
                </div>
              </div>

              {/* Store Link */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Link2 className="w-3.5 h-3.5" />
                  Link da loja
                </Label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Input 
                      value={`https://${store?.slug}.armazix.com.br`} 
                      disabled 
                      className="h-11 rounded-xl bg-muted pr-10 font-mono text-sm"
                    />
                    <Globe className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  </div>
                  <CopyStoreUrlButton url={`https://${store?.slug}.armazix.com.br`} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input 
                  value={description} 
                  onChange={(e) => setDescription(e.target.value)}
                  className="h-11 rounded-xl" 
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>WhatsApp</Label>
                  <Input 
                    value={phone} 
                    onChange={(e) => setPhone(e.target.value)}
                    className="h-11 rounded-xl" 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email da loja</Label>
                  <Input 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11 rounded-xl" 
                  />
                </div>
              </div>
              {success && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <Check className="w-4 h-4" />
                  Alterações salvas com sucesso!
                </div>
              )}
              <Button 
                onClick={handleSave}
                disabled={saving}
                className="h-10 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar alterações"}
              </Button>
            </CardContent>
          </Card>

          {/* Address */}
          <Card className="rounded-2xl border-border/50 shadow-soft">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Endereço
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Rua</Label>
                  <Input value={store?.address?.street || ""} disabled className="h-11 rounded-xl bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label>Número</Label>
                  <Input value={store?.address?.number || ""} disabled className="h-11 rounded-xl bg-muted" />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Bairro</Label>
                  <Input value={store?.address?.neighborhood || ""} disabled className="h-11 rounded-xl bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label>Complemento</Label>
                  <Input value={store?.address?.complement || ""} disabled className="h-11 rounded-xl bg-muted" />
                </div>
              </div>
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Cidade</Label>
                  <Input value={store?.address?.city || ""} disabled className="h-11 rounded-xl bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Input value={store?.address?.state || ""} disabled className="h-11 rounded-xl bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label>CEP</Label>
                  <Input value={store?.address?.zip || ""} disabled className="h-11 rounded-xl bg-muted" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                O endereço é definido no cadastro inicial. Para alterar, entre em contato com o suporte.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="personalizacao" className="mt-6 space-y-6">
          <Card className="rounded-2xl border-border/50 shadow-soft">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Palette className="w-4 h-4" />
                Aparência
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  Cor principal
                </Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-10 h-10 rounded-xl border border-border cursor-pointer"
                  />
                  <Input
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-32 h-11 rounded-xl font-mono"
                  />
                </div>
              </div>
              <Button 
                onClick={handleSave}
                disabled={saving}
                className="h-10 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar alterações"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="planos" className="mt-6 space-y-6">
          <PlansSection />
        </TabsContent>

        <TabsContent value="notificacoes" className="mt-6 space-y-6">
          <Card className="rounded-2xl border-border/50 shadow-soft">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Bell className="w-4 h-4" />
                Notificações
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Novos pedidos</div>
                  <div className="text-xs text-muted-foreground">Receber notificação a cada novo pedido</div>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Estoque baixo</div>
                  <div className="text-xs text-muted-foreground">Alertar quando produto atingir mínimo</div>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Pagamentos</div>
                  <div className="text-xs text-muted-foreground">Notificar sobre pagamentos recebidos</div>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Marketing</div>
                  <div className="text-xs text-muted-foreground">Novidades e dicas por email</div>
                </div>
                <Switch />
              </div>
            </CardContent>
          </Card>

          {/* Security */}
          <Card className="rounded-2xl border-border/50 shadow-soft">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Segurança
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Senha atual</Label>
                  <Input type="password" placeholder="••••••••" className="h-11 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label>Nova senha</Label>
                  <Input type="password" placeholder="Mínimo 8 caracteres" className="h-11 rounded-xl" />
                </div>
              </div>
              <Button variant="outline" className="h-10 rounded-xl font-medium">
                Alterar senha
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Copy Store URL Button Component ───────────────────────────────
function CopyStoreUrlButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={handleCopy}
      className="h-11 w-11 rounded-xl shrink-0"
    >
      {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
    </Button>
  );
}

// ─── Plans Section Component ─────────────────────────────────────
function PlansSection() {
  const [currentPlan] = useState("start");
  const [pdvEnabled, setPdvEnabled] = useState(false);

  const PDV_PRICE = 50;

  const plans = [
    {
      id: "free",
      name: "Free",
      price: 0,
      description: "Ideal para testar",
      features: [
        { text: "Até 5 produtos", included: true },
        { text: "Pedidos online", included: true },
        { text: "Relatórios básicos", included: true },
        { text: "1 usuário", included: true },
        { text: "Suporte por email", included: true },
      ],
      color: "border-border",
      badge: null,
    },
    {
      id: "start",
      name: "Start",
      price: 19.90,
      description: "Perfeito para começar",
      features: [
        { text: "Até 30 produtos", included: true },
        { text: "Pedidos online", included: true },
        { text: "Relatórios básicos", included: true },
        { text: "1 usuário", included: true },
        { text: "Suporte por email", included: true },
      ],
      color: "border-blue-400",
      badge: null,
    },
    {
      id: "pro",
      name: "Pro",
      price: 39.90,
      description: "Para lojas em crescimento",
      features: [
        { text: "Até 70 produtos", included: true },
        { text: "Pedidos online + Delivery", included: true },
        { text: "Relatórios avançados", included: true },
        { text: "Até 3 usuários", included: true },
        { text: "Suporte prioritário", included: true },
      ],
      color: "border-primary shadow-glow",
      badge: "Mais escolhido",
    },
    {
      id: "full",
      name: "Full",
      price: 79.90,
      description: "Produtos ilimitados",
      features: [
        { text: "Produtos ilimitados", included: true },
        { text: "Pedidos online + Delivery", included: true },
        { text: "Relatórios avançados", included: true },
        { text: "Usuários ilimitados", included: true },
        { text: "Suporte prioritário", included: true },
      ],
      color: "border-amber-500",
      badge: "Premium",
    },
  ];

  const currentPlanData = plans.find(p => p.id === currentPlan);
  const basePrice = currentPlanData?.price || 0;
  const totalPrice = basePrice + (pdvEnabled ? PDV_PRICE : 0);

  return (
    <div className="space-y-6">
      {/* Current Plan */}
      <Card className="rounded-2xl border-border/50 shadow-soft bg-gradient-to-r from-primary/5 to-transparent">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Plano atual</div>
              <div className="text-2xl font-bold">{plans.find(p => p.id === currentPlan)?.name}</div>
              <div className="text-sm text-muted-foreground mt-1">
                {pdvEnabled ? (
                  <div className="space-y-0.5">
                    <div className="line-through">R$ {basePrice.toFixed(2).replace(".", ",")}/mês</div>
                    <div className="text-primary font-semibold">
                      R$ {totalPrice.toFixed(2).replace(".", ",")}/mês (com PDV)
                    </div>
                  </div>
                ) : (
                  `R$ ${basePrice.toFixed(2).replace(".", ",")}/mês`
                )}
              </div>
            </div>
            <Badge className="rounded-full bg-primary text-primary-foreground">Ativo</Badge>
          </div>
        </CardContent>
      </Card>

      {/* PDV Addon */}
      <Card className="rounded-2xl border-border/50 shadow-soft">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Módulo PDV
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="text-sm font-medium">Ativar PDV</div>
              <div className="text-xs text-muted-foreground">
                Sistema de ponto de venda para vendas presenciais
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                + R$ {PDV_PRICE.toFixed(2).replace(".", ",")}/mês (adicional)
              </div>
            </div>
            <Switch 
              checked={pdvEnabled}
              onCheckedChange={setPdvEnabled}
            />
          </div>
        </CardContent>
      </Card>

      {/* Plan Cards */}
      <div className="grid gap-4">
        {plans.map((plan) => (
          <Card 
            key={plan.id}
            className={`rounded-2xl border-2 shadow-soft transition-all ${
              currentPlan === plan.id ? plan.color : "border-border hover:border-border/80"
            }`}
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold">{plan.name}</span>
                    {plan.badge && (
                      <Badge className="rounded-full text-[10px] px-2">
                        {plan.badge}
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground mt-0.5">
                    {plan.description}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">
                    {plan.price === 0 ? "Gratuito" : `R$ ${plan.price.toFixed(2).replace(".", ",")}`}
                  </div>
                  {plan.price > 0 && <div className="text-xs text-muted-foreground">/mês</div>}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-2 mb-4">
                {plan.features.map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    {feature.included ? (
                      <Check className="w-4 h-4 text-primary" />
                    ) : (
                      <span className="w-4 h-4 rounded-full border border-muted-foreground/30" />
                    )}
                    <span className={feature.included ? "" : "text-muted-foreground"}>
                      {feature.text}
                    </span>
                  </div>
                ))}
              </div>

              {currentPlan === plan.id ? (
                <Button disabled className="w-full h-10 rounded-xl">
                  Plano atual
                </Button>
              ) : (
                <Button 
                  variant={plan.id === "pro" ? "default" : "outline"}
                  className={`w-full h-10 rounded-xl font-medium ${
                    plan.id === "pro" ? "bg-gradient-primary shadow-glow" : ""
                  }`}
                >
                  {currentPlan && plans.findIndex(p => p.id === currentPlan) < plans.findIndex(p => p.id === plan.id) 
                    ? "Fazer upgrade" 
                    : "Fazer downgrade"}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Você pode alterar seu plano a qualquer momento. A cobrança será ajustada proporcionalmente.
      </p>
    </div>
  );
}
