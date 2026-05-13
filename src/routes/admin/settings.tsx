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
  Pencil,
  X,
  Mail,
  Clock,
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

  // Email edit states
  const [emailLocked, setEmailLocked] = useState(true);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [emailStep, setEmailStep] = useState<"idle" | "input" | "code">("idle");
  const [emailSending, setEmailSending] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [emailSuccess, setEmailSuccess] = useState("");

  // Address states
  const [addressCep, setAddressCep] = useState("");
  const [addressStreet, setAddressStreet] = useState("");
  const [addressNumber, setAddressNumber] = useState("");
  const [addressNeighborhood, setAddressNeighborhood] = useState("");
  const [addressCity, setAddressCity] = useState("");
  const [addressState, setAddressState] = useState("");
  const [addressComplement, setAddressComplement] = useState("");
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState("");
  const [addressSaving, setAddressSaving] = useState(false);
  const [addressSuccess, setAddressSuccess] = useState(false);

  // Business hours states
  const [businessHours, setBusinessHours] = useState<Array<{ day: string; open: string; close: string; closed: boolean }>>([]);
  const [hoursSaving, setHoursSaving] = useState(false);
  const [hoursSuccess, setHoursSuccess] = useState(false);

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
        if (data.store.address) {
          setAddressCep(data.store.address.zip || "");
          setAddressStreet(data.store.address.street || "");
          setAddressNumber(data.store.address.number || "");
          setAddressNeighborhood(data.store.address.neighborhood || "");
          setAddressCity(data.store.address.city || "");
          setAddressState(data.store.address.state || "");
          setAddressComplement(data.store.address.complement || "");
        }
        // Load business hours
        if (data.store.businessHours && data.store.businessHours.length > 0) {
          setBusinessHours(data.store.businessHours);
        } else {
          setBusinessHours([
            { day: "Segunda", open: "08:00", close: "18:00", closed: false },
            { day: "Terça", open: "08:00", close: "18:00", closed: false },
            { day: "Quarta", open: "08:00", close: "18:00", closed: false },
            { day: "Quinta", open: "08:00", close: "18:00", closed: false },
            { day: "Sexta", open: "08:00", close: "18:00", closed: false },
            { day: "Sábado", open: "08:00", close: "12:00", closed: false },
            { day: "Domingo", open: "00:00", close: "00:00", closed: true },
          ]);
        }
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

  const lookupCep = async (cep: string) => {
    setCepLoading(true);
    setCepError("");
    try {
      const res = await fetch(`/api/validate-cep?cep=${cep}`);
      const data = await res.json();
      if (res.ok) {
        setAddressStreet(data.street || "");
        setAddressNeighborhood(data.neighborhood || "");
        setAddressCity(data.city || "");
        setAddressState(data.state || "");
      } else {
        setCepError(data.error || "CEP não encontrado");
      }
    } catch {
      setCepError("Erro ao buscar CEP");
    } finally {
      setCepLoading(false);
    }
  };

  const handleSaveAddress = async () => {
    if (!store) return;
    setAddressSaving(true);
    setAddressSuccess(false);
    try {
      const address = {
        street: addressStreet,
        number: addressNumber,
        neighborhood: addressNeighborhood,
        city: addressCity,
        state: addressState,
        zip: addressCep,
        complement: addressComplement || undefined,
      };
      const res = await fetch("/api/store/update-address", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ storeId: store.id, address }),
      });
      const data = await res.json();
      if (res.ok) {
        setAddressSuccess(true);
        setStore({ ...store, address });
      } else {
        setError(data.error || "Erro ao salvar endereço");
      }
    } catch {
      setError("Erro de conexão");
    } finally {
      setAddressSaving(false);
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
        <TabsList className="grid w-full grid-cols-5 rounded-xl">
          <TabsTrigger value="geral" className="rounded-lg">Geral</TabsTrigger>
          <TabsTrigger value="horarios" className="rounded-lg">Horários</TabsTrigger>
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
                  <Label className="flex items-center gap-1.5">Email da loja</Label>
                  <div className="relative">
                    <Input 
                      value={email} 
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-11 rounded-xl pr-10" 
                      disabled={emailLocked}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-primary"
                      onClick={() => {
                        setNewEmail(email);
                        setEmailStep("input");
                        setShowEmailModal(true);
                        setEmailError("");
                        setEmailSuccess("");
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
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
              {/* CEP field first */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">CEP</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      value={addressCep}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "").slice(0, 8);
                        setAddressCep(val);
                        setCepError("");
                        if (val.length === 8) {
                          lookupCep(val);
                        }
                      }}
                      placeholder="00000000"
                      className="h-11 rounded-xl font-mono"
                      maxLength={8}
                    />
                    {cepLoading && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  <Button
                    variant="outline"
                    className="h-11 rounded-xl"
                    disabled={cepLoading || addressCep.length !== 8}
                    onClick={() => lookupCep(addressCep)}
                  >
                    Buscar
                  </Button>
                </div>
                {cepError && <p className="text-xs text-red-500">{cepError}</p>}
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Rua</Label>
                  <Input value={addressStreet} onChange={(e) => setAddressStreet(e.target.value)} className="h-11 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label>Número</Label>
                  <Input value={addressNumber} onChange={(e) => setAddressNumber(e.target.value)} className="h-11 rounded-xl" />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Bairro</Label>
                  <Input value={addressNeighborhood} onChange={(e) => setAddressNeighborhood(e.target.value)} className="h-11 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label>Complemento</Label>
                  <Input value={addressComplement} onChange={(e) => setAddressComplement(e.target.value)} className="h-11 rounded-xl" />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cidade</Label>
                  <Input value={addressCity} onChange={(e) => setAddressCity(e.target.value)} className="h-11 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Input value={addressState} onChange={(e) => setAddressState(e.target.value)} className="h-11 rounded-xl" maxLength={2} />
                </div>
              </div>
              {addressSuccess && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <Check className="w-4 h-4" />
                  Endereço salvo com sucesso!
                </div>
              )}
              <Button
                onClick={handleSaveAddress}
                disabled={addressSaving}
                className="h-10 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow"
              >
                {addressSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar endereço"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="horarios" className="mt-6 space-y-6">
          <Card className="rounded-2xl border-border/50 shadow-soft">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Horário de Funcionamento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {businessHours.length === 0 && (
                <p className="text-sm text-muted-foreground">Carregando horários...</p>
              )}
              {businessHours.map((item, idx) => (
                <div key={item.day} className="flex items-center gap-3 py-2 border-b last:border-b-0">
                  <span className="w-28 text-sm font-medium">{item.day}</span>
                  <Switch
                    checked={!item.closed}
                    onCheckedChange={(checked) => {
                      const updated = [...businessHours];
                      updated[idx] = { ...updated[idx], closed: !checked };
                      setBusinessHours(updated);
                    }}
                  />
                  {!item.closed ? (
                    <>
                      <Input
                        type="time"
                        value={item.open}
                        onChange={(e) => {
                          const updated = [...businessHours];
                          updated[idx] = { ...updated[idx], open: e.target.value };
                          setBusinessHours(updated);
                        }}
                        className="h-9 rounded-lg w-28 text-sm"
                      />
                      <span className="text-muted-foreground">até</span>
                      <Input
                        type="time"
                        value={item.close}
                        onChange={(e) => {
                          const updated = [...businessHours];
                          updated[idx] = { ...updated[idx], close: e.target.value };
                          setBusinessHours(updated);
                        }}
                        className="h-9 rounded-lg w-28 text-sm"
                      />
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">Fechado</span>
                  )}
                </div>
              ))}
              {hoursSuccess && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <Check className="w-4 h-4" />
                  Horários salvos com sucesso!
                </div>
              )}
              <Button
                onClick={async () => {
                  if (!store) return;
                  setHoursSaving(true);
                  setHoursSuccess(false);
                  try {
                    const res = await fetch("/api/store/update-business-hours", {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ storeId: store.id, businessHours }),
                    });
                    const data = await res.json();
                    if (res.ok) {
                      setHoursSuccess(true);
                    } else {
                      setError(data.error || "Erro ao salvar horários");
                    }
                  } catch {
                    setError("Erro de conexão");
                  } finally {
                    setHoursSaving(false);
                  }
                }}
                disabled={hoursSaving}
                className="h-10 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow"
              >
                {hoursSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar horários"}
              </Button>
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

      {/* Email Change Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-in fade-in duration-200">
          <div className="bg-card rounded-2xl border border-border shadow-lg p-6 w-full max-w-md mx-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Alterar Email
              </h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  setShowEmailModal(false);
                  setEmailStep("idle");
                  setEmailError("");
                  setEmailSuccess("");
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {emailStep === "input" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Digite o novo email. Enviaremos um código de verificação para confirmar a alteração.
                </p>
                <div className="space-y-2">
                  <Label>Novo email</Label>
                  <Input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="novo@email.com"
                    className="h-11 rounded-xl"
                  />
                </div>
                {emailError && <p className="text-sm text-red-500">{emailError}</p>}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 h-10 rounded-xl"
                    onClick={() => {
                      setShowEmailModal(false);
                      setEmailStep("idle");
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    className="flex-1 h-10 rounded-xl bg-gradient-primary text-primary-foreground"
                    disabled={emailSending || !newEmail || newEmail === email}
                    onClick={async () => {
                      if (!newEmail || newEmail === email) return;
                      setEmailSending(true);
                      setEmailError("");
                      try {
                        const userId = localStorage.getItem("userId");
                        const res = await fetch("/api/user/send-email-code", {
                          method: "POST",
                          headers: { "content-type": "application/json" },
                          body: JSON.stringify({ userId, newEmail: newEmail }),
                        });
                        const data = await res.json();
                        if (res.ok) {
                          setEmailStep("code");
                        } else {
                          setEmailError(data.error || "Erro ao enviar código");
                        }
                      } catch {
                        setEmailError("Erro de conexão");
                      } finally {
                        setEmailSending(false);
                      }
                    }}
                  >
                    {emailSending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enviar código"}
                  </Button>
                </div>
              </div>
            )}

            {emailStep === "code" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Digite o código de 6 dígitos enviado para <strong>{newEmail}</strong>.
                </p>
                <div className="space-y-2">
                  <Label>Código de verificação</Label>
                  <Input
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    className="h-11 rounded-xl text-center text-2xl tracking-[0.5em] font-mono"
                    maxLength={6}
                  />
                </div>
                {emailError && <p className="text-sm text-red-500">{emailError}</p>}
                {emailSuccess && <p className="text-sm text-green-600 flex items-center gap-1"><Check className="w-4 h-4" />{emailSuccess}</p>}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 h-10 rounded-xl"
                    onClick={() => {
                      setEmailStep("input");
                      setEmailError("");
                    setVerificationCode("");
                    }}
                  >
                    Voltar
                  </Button>
                  <Button
                    className="flex-1 h-10 rounded-xl bg-gradient-primary text-primary-foreground"
                    disabled={emailSending || verificationCode.length !== 6}
                    onClick={async () => {
                      setEmailSending(true);
                      setEmailError("");
                      try {
                        const userId = localStorage.getItem("userId");
                        const res = await fetch("/api/user/verify-email-change", {
                          method: "POST",
                          headers: { "content-type": "application/json" },
                          body: JSON.stringify({ userId, newEmail, code: verificationCode }),
                        });
                        const data = await res.json();
                        if (res.ok) {
                          setEmail(newEmail);
                          setEmailSuccess("Email atualizado com sucesso!");
                          setTimeout(() => {
                            setShowEmailModal(false);
                            setEmailStep("idle");
                            setVerificationCode("");
                            setEmailSuccess("");
                          }, 1500);
                        } else {
                          setEmailError(data.error || "Código inválido");
                        }
                      } catch {
                        setEmailError("Erro de conexão");
                      } finally {
                        setEmailSending(false);
                      }
                    }}
                  >
                    {emailSending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
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
  const [pdvToggles, setPdvToggles] = useState<Record<string, boolean>>({ start: false, pro: false, full: false });

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
  const currentPdv = pdvToggles[currentPlan] || false;
  const totalPrice = basePrice + (currentPdv ? PDV_PRICE : 0);

  const formatPrice = (val: number) => val.toFixed(2).replace(".", ",");

  return (
    <div className="space-y-6">
      {/* Current Plan */}
      <Card className="rounded-2xl border-border/50 shadow-soft bg-gradient-to-r from-primary/5 to-transparent">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Plano atual</div>
              <div className="text-2xl font-bold">{currentPlanData?.name}</div>
              <div className="text-sm text-muted-foreground mt-1">
                {currentPdv ? (
                  <div className="space-y-0.5">
                    <div className="line-through">R$ {formatPrice(basePrice)}/mês</div>
                    <div className="text-primary font-semibold">
                      R$ {formatPrice(totalPrice)}/mês (com PDV)
                    </div>
                  </div>
                ) : (
                  `R$ ${formatPrice(basePrice)}/mês`
                )}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Validade: 30 dias</div>
            </div>
            <Badge className="rounded-full bg-primary text-primary-foreground">Ativo</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Plan Cards */}
      <div className="grid gap-4">
        {plans.map((plan) => {
          const pdvOn = pdvToggles[plan.id] || false;
          const planTotal = plan.price + (pdvOn ? PDV_PRICE : 0);

          return (
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
                      {plan.price === 0 ? "Gratuito" : `R$ ${formatPrice(planTotal)}`}
                    </div>
                    {plan.price > 0 && (
                      <div className="text-xs text-muted-foreground">
                        /mês {pdvOn && <span className="text-primary">(com PDV)</span>}
                      </div>
                    )}
                    {plan.price > 0 && (
                      <div className="text-xs text-muted-foreground">30 dias</div>
                    )}
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

                {/* PDV Toggle per plan */}
                {plan.price > 0 && (
                  <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-secondary/50 mb-4">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium">Adicionar PDV</div>
                        <div className="text-xs text-muted-foreground">+ R$ {formatPrice(PDV_PRICE)}/mês</div>
                      </div>
                    </div>
                    <Switch
                      checked={pdvOn}
                      onCheckedChange={(checked) =>
                        setPdvToggles(prev => ({ ...prev, [plan.id]: checked }))
                      }
                    />
                  </div>
                )}

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
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Todos os planos possuem validade de 30 dias. O PDV é um adicional de R$ {formatPrice(PDV_PRICE)}/mês e não está incluso em nenhum plano.
      </p>
    </div>
  );
}
