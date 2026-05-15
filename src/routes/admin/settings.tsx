import { createFileRoute, Link } from "@tanstack/react-router";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "@/lib/api-client";
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
  Camera,
  RefreshCw,
  AlertCircle,
  QrCode,
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
  validateSearch: (search: Record<string, string>) => ({
    tab: search.tab as string | undefined,
  }),
  head: () => ({
    meta: [{ title: "Configurações — ARMAZIX" }],
  }),
});

interface StoreData {
  id: string;
  name: string;
  ownerName: string;
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
  const { tab: tabParam } = Route.useSearch();
  const [activeTab, setActiveTab] = useState(tabParam || "geral");
  const [store, setStore] = useState<StoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Form states
  const [storeName, setStoreName] = useState("");
  const [ownerName, setOwnerName] = useState("");
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

  // Mercado Pago states
  const [mpToken, setMpToken] = useState("");
  const [mpTokenSaving, setMpTokenSaving] = useState(false);
  const [mpTokenSuccess, setMpTokenSuccess] = useState(false);
  const [mpTokenError, setMpTokenError] = useState("");

  // User profile states
  const [profileName, setProfileName] = useState("");
  const [profileAvatar, setProfileAvatar] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState("");
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Password states
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState("");

  const saveMpToken = async () => {
    if (!store || !mpToken) return;
    setMpTokenSaving(true);
    setMpTokenSuccess(false);
    setMpTokenError("");
    try {
      const res = await api.post("/api/payments/mp-token", { storeId: store.id, accessToken: mpToken });
      const data = await res.json();
      if (res.ok) {
        setMpTokenSuccess(true);
        setTimeout(() => setMpTokenSuccess(false), 3000);
      } else {
        setMpTokenError(data.error || "Erro ao salvar token");
      }
    } catch {
      setMpTokenError("Erro de conexão");
    } finally {
      setMpTokenSaving(false);
    }
  };

  useEffect(() => {
    const storeId = localStorage.getItem("storeId");
    if (storeId) {
      fetchStore(storeId);
    } else {
      setLoading(false);
      setError("Loja não encontrada");
    }

    api.get("/api/user/get").then(async (res) => {
      if (res.ok) {
        const data = await res.json() as { user?: { name?: string; avatarUrl?: string } };
        if (data.user?.name) setProfileName(data.user.name);
        if (data.user?.avatarUrl) setProfileAvatar(data.user.avatarUrl);
      }
    }).catch(() => {});
  }, []);

  const fetchStore = async (storeId: string) => {
    try {
      const res = await fetch(`/api/store/get?id=${storeId}`);
      const data = await res.json();
      if (res.ok && data.store) {
        setStore(data.store);
        setStoreName(data.store.name || "");
        setOwnerName(data.store.ownerName || "");
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
      const res = await api.post("/api/store/update", {
        storeId: store.id,
        name: storeName,
        ownerName,
        description,
        phone,
        email,
        primaryColor,
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
      const res = await api.post("/api/store/update-address", { storeId: store.id, address });
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

  const handleSaveProfile = async () => {
    if (!profileName.trim()) {
      setProfileError("Nome é obrigatório");
      return;
    }
    setProfileSaving(true);
    setProfileSuccess(false);
    setProfileError("");
    try {
      const res = await api.post("/api/user/update-data", {
        name: profileName,
        avatarUrl: profileAvatar || null,
      });
      const data = await res.json() as { error?: string };
      if (res.ok) {
        setProfileSuccess(true);
        setTimeout(() => setProfileSuccess(false), 3000);
      } else {
        setProfileError(data.error || "Erro ao salvar perfil");
      }
    } catch {
      setProfileError("Erro de conexão");
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    setPwError("");
    setPwSuccess("");
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setPwError("Preencha todos os campos");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPwError("As senhas não coincidem");
      return;
    }
    setPwSaving(true);
    try {
      const res = await api.post("/api/user/update-password", {
        currentPassword,
        newPassword,
      });
      const data = await res.json() as { error?: string; message?: string };
      if (res.ok) {
        setPwSuccess(data.message || "Senha alterada com sucesso!");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmNewPassword("");
      } else {
        setPwError(data.error || "Erro ao alterar senha");
      }
    } catch {
      setPwError("Erro de conexão");
    } finally {
      setPwSaving(false);
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
        <TabsList className="grid w-full grid-cols-4 sm:grid-cols-7 rounded-xl">
          <TabsTrigger value="geral" className="rounded-lg">Geral</TabsTrigger>
          <TabsTrigger value="horarios" className="rounded-lg">Horários</TabsTrigger>
          <TabsTrigger value="personalizacao" className="rounded-lg">Aparência</TabsTrigger>
          <TabsTrigger value="pagamentos" className="rounded-lg">Pagamentos</TabsTrigger>
          <TabsTrigger value="senha" className="rounded-lg">Senha</TabsTrigger>
          <TabsTrigger value="perfil" className="rounded-lg">Perfil</TabsTrigger>
          <TabsTrigger value="planos" className="rounded-lg">Planos</TabsTrigger>
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
              <div className="space-y-2">
                <Label>Nome do titular</Label>
                <Input
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="Nome completo do responsável pela conta"
                  className="h-11 rounded-xl"
                />
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

        <TabsContent value="senha" className="mt-6 space-y-6">
          <Card className="rounded-2xl border-border/50 shadow-soft">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Redefinir Senha
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Senha atual</Label>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label>Nova senha</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label>Confirmar nova senha</Label>
                <Input
                  type="password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                  className="h-11 rounded-xl"
                />
              </div>
              {pwError && <p className="text-sm text-red-500">{pwError}</p>}
              {pwSuccess && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <Check className="w-4 h-4" />
                  {pwSuccess}
                </div>
              )}
              <Button
                onClick={handlePasswordChange}
                disabled={pwSaving || !currentPassword || !newPassword || !confirmNewPassword}
                className="h-10 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow"
              >
                {pwSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Alterar senha"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pagamentos" className="mt-6 space-y-6">
          <Card className="rounded-2xl border-border/50 shadow-soft">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                Mercado Pago — Checkout Pro
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-sm text-blue-700 dark:text-blue-300 space-y-1">
                <p className="font-medium">Como obter o Access Token:</p>
                <ol className="list-decimal list-inside space-y-0.5 text-xs opacity-90">
                  <li>Acesse <span className="font-mono">mercadopago.com.br</span> → Sua conta → Ferramentas de integração</li>
                  <li>Vá em <strong>Credenciais</strong> e copie o <strong>Access Token de produção</strong></li>
                  <li>Cole abaixo e salve</li>
                </ol>
              </div>
              <div className="space-y-2">
                <Label>Access Token</Label>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    value={mpToken}
                    onChange={(e) => { setMpToken(e.target.value); setMpTokenError(""); }}
                    placeholder="APP_USR-... ou TEST-..."
                    className="h-11 rounded-xl font-mono text-sm"
                  />
                  <Button
                    onClick={saveMpToken}
                    disabled={mpTokenSaving || !mpToken}
                    className="h-11 px-5 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow shrink-0"
                  >
                    {mpTokenSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : mpTokenSuccess ? <Check className="w-4 h-4" /> : "Salvar"}
                  </Button>
                </div>
                {mpTokenError && <p className="text-xs text-destructive">{mpTokenError}</p>}
                {mpTokenSuccess && <p className="text-xs text-green-600">Token salvo com sucesso!</p>}
              </div>
              <Separator />
              <div className="space-y-1">
                <p className="text-sm font-medium">Como funciona</p>
                <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                  <li>O cliente escolhe "Mercado Pago" no checkout</li>
                  <li>É redirecionado para a página de pagamento do Mercado Pago</li>
                  <li>Aceita PIX, cartão de crédito/débito e boleto automaticamente</li>
                  <li>O pedido é confirmado via webhook após o pagamento</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="perfil" className="mt-6 space-y-6">
          {/* User Profile */}
          <Card className="rounded-2xl border-border/50 shadow-soft">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <User className="w-4 h-4" />
                Meu Perfil
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Avatar className="w-20 h-20">
                    {profileAvatar && <AvatarImage src={profileAvatar} alt={profileName} />}
                    <AvatarFallback className="bg-primary/15 text-primary text-2xl font-bold">
                      {profileName.trim().split(/\s+/).map((w: string) => w[0]).slice(0, 2).join("").toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors"
                  >
                    <Camera className="w-3.5 h-3.5" />
                  </button>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 2 * 1024 * 1024) {
                        setProfileError("Imagem deve ter no máximo 2MB");
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = () => setProfileAvatar(reader.result as string);
                      reader.readAsDataURL(file);
                      e.target.value = "";
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Foto de perfil</p>
                  <p className="text-xs text-muted-foreground">JPG, PNG ou GIF — máx. 2MB</p>
                  {profileAvatar && (
                    <button
                      type="button"
                      onClick={() => setProfileAvatar("")}
                      className="text-xs text-destructive hover:underline"
                    >
                      Remover foto
                    </button>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Nome completo</Label>
                <Input
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="Seu nome completo"
                  className="h-11 rounded-xl"
                />
              </div>
              {profileError && <p className="text-sm text-red-500">{profileError}</p>}
              {profileSuccess && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <Check className="w-4 h-4" />
                  Perfil atualizado com sucesso!
                </div>
              )}
              <Button
                onClick={handleSaveProfile}
                disabled={profileSaving}
                className="h-10 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow"
              >
                {profileSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar perfil"}
              </Button>
            </CardContent>
          </Card>

          {/* Notifications */}
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
        </TabsContent>

        <TabsContent value="planos" className="mt-6">
          <PlansSection />
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

// ─── Types ───────────────────────────────────────────────────────
interface PlanDef {
  id: string;
  name: string;
  price: number;
  pixPrice: number;
  description: string;
  features: { text: string; included: boolean }[];
  color: string;
  badge: string | null;
}

interface PixPaymentData {
  paymentId: number;
  qrCode: string;
  qrCodeBase64?: string;
  ticketUrl?: string;
  totalAmount: number;
  expiresAt: string;
  planName: string;
}

interface SubStatus {
  plan: string;
  planStatus: string;
  planExpiresAt: string | null;
  paymentMethod: string;
  pdvEnabled: boolean;
  mpPaymentId: string | null;
  amountPaid: string | null;
  paymentStatus: string | null;
}

const PLANS_DEF: PlanDef[] = [
  {
    id: "free", name: "Free", price: 0, pixPrice: 0,
    description: "Ideal para testar",
    features: [
      { text: "Até 5 produtos", included: true },
      { text: "Pedidos online", included: true },
      { text: "Relatórios básicos", included: true },
      { text: "1 usuário", included: true },
      { text: "Suporte por email", included: true },
    ],
    color: "border-border", badge: null,
  },
  {
    id: "start", name: "Start", price: 19.90, pixPrice: 24.90,
    description: "Perfeito para começar",
    features: [
      { text: "Até 30 produtos", included: true },
      { text: "Pedidos online", included: true },
      { text: "Relatórios básicos", included: true },
      { text: "1 usuário", included: true },
      { text: "Suporte por email", included: true },
    ],
    color: "border-blue-400", badge: null,
  },
  {
    id: "pro", name: "Pro", price: 39.90, pixPrice: 44.90,
    description: "Para lojas em crescimento",
    features: [
      { text: "Até 70 produtos", included: true },
      { text: "Pedidos online + Delivery", included: true },
      { text: "Relatórios avançados", included: true },
      { text: "Até 3 usuários", included: true },
      { text: "Suporte prioritário", included: true },
    ],
    color: "border-primary shadow-glow", badge: "Mais escolhido",
  },
  {
    id: "full", name: "Full", price: 79.90, pixPrice: 84.90,
    description: "Produtos ilimitados",
    features: [
      { text: "Produtos ilimitados", included: true },
      { text: "Pedidos online + Delivery", included: true },
      { text: "Relatórios avançados", included: true },
      { text: "Usuários ilimitados", included: true },
      { text: "Suporte prioritário", included: true },
    ],
    color: "border-amber-500", badge: "Premium",
  },
];

const PDV_PRICE_CONST = 50;
const fmtPrice = (v: number) => v.toFixed(2).replace(".", ",");

// ─── Plans Section Component ─────────────────────────────────────
function PlansSection() {
  const [status, setStatus] = useState<SubStatus>({
    plan: "free", planStatus: "active", planExpiresAt: null,
    paymentMethod: "card_recurring", pdvEnabled: false,
    mpPaymentId: null, amountPaid: null, paymentStatus: null,
  });
  const [statusLoading, setStatusLoading] = useState(true);
  const [pdvToggles, setPdvToggles] = useState<Record<string, boolean>>({});
  const [subError, setSubError] = useState("");
  const [paymentModalPlan, setPaymentModalPlan] = useState<PlanDef | null>(null);
  const [pixData, setPixData] = useState<PixPaymentData | null>(null);
  // Card redirect countdown
  const [confirmPlan, setConfirmPlan] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(5);
  const [initPoint, setInitPoint] = useState<string | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadStatus = () => {
    api.get("/api/subscriptions/status")
      .then(r => r.json())
      .then((d: Partial<SubStatus>) => {
        setStatus({
          plan: d.plan || "free",
          planStatus: d.planStatus || "active",
          planExpiresAt: d.planExpiresAt ?? null,
          paymentMethod: d.paymentMethod || "card_recurring",
          pdvEnabled: d.pdvEnabled ?? false,
          mpPaymentId: d.mpPaymentId ?? null,
          amountPaid: d.amountPaid ?? null,
          paymentStatus: d.paymentStatus ?? null,
        });
      })
      .catch(() => {})
      .finally(() => setStatusLoading(false));
  };

  useEffect(() => { loadStatus(); }, []);

  const getPayerInfo = async () => {
    const res = await api.get("/api/user/get");
    if (!res.ok) return null;
    const data = await res.json() as { user?: { email?: string; name?: string } };
    return { email: data.user?.email || "", name: data.user?.name || "" };
  };

  const handleCardPayment = async (plan: PlanDef, withPdv: boolean) => {
    setSubError("");
    setPaymentModalPlan(null);
    try {
      const payer = await getPayerInfo();
      if (!payer?.email) { setSubError("Email não encontrado. Faça login novamente."); return; }
      const res = await api.post("/api/subscriptions/create", {
        planId: plan.id, withPdv, payerEmail: payer.email, payerName: payer.name,
      });
      const data = await res.json() as { init_point?: string; error?: string };
      if (res.ok && data.init_point) {
        setInitPoint(data.init_point);
        setConfirmPlan(plan.name);
        setCountdown(5);
        countdownRef.current = setInterval(() => {
          setCountdown(prev => {
            if (prev <= 1) { clearInterval(countdownRef.current!); window.location.href = data.init_point!; return 0; }
            return prev - 1;
          });
        }, 1000);
      } else {
        setSubError(data.error || "Erro ao iniciar assinatura");
      }
    } catch { setSubError("Erro de conexão"); }
  };

  const handlePixPayment = async (plan: PlanDef, withPdv: boolean) => {
    setSubError("");
    setPaymentModalPlan(null);
    try {
      const payer = await getPayerInfo();
      if (!payer?.email) { setSubError("Email não encontrado. Faça login novamente."); return; }
      const res = await api.post("/api/subscriptions/create-pix", {
        planId: plan.id, withPdv, payerEmail: payer.email, payerName: payer.name,
      });
      const data = await res.json() as { qrCode?: string; qrCodeBase64?: string; ticketUrl?: string; totalAmount?: number; expiresAt?: string; paymentId?: number; error?: string };
      if (res.ok && data.qrCode) {
        setPixData({
          paymentId: data.paymentId!,
          qrCode: data.qrCode,
          qrCodeBase64: data.qrCodeBase64,
          ticketUrl: data.ticketUrl,
          totalAmount: data.totalAmount!,
          expiresAt: data.expiresAt!,
          planName: plan.name,
        });
      } else {
        setSubError(data.error || "Erro ao gerar cobrança PIX");
      }
    } catch { setSubError("Erro de conexão"); }
  };

  const cancelRedirect = () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setConfirmPlan(null); setInitPoint(null); setCountdown(5);
  };

  const currentPlanDef = PLANS_DEF.find(p => p.id === status.plan) || PLANS_DEF[0];

  const planStatusBadge: Record<string, { label: string; cls: string }> = {
    active:    { label: "Ativo",                cls: "bg-primary text-primary-foreground" },
    pending:   { label: "Aguardando pagamento", cls: "bg-yellow-500 text-white" },
    expired:   { label: "Expirado",             cls: "bg-destructive text-destructive-foreground" },
    paused:    { label: "Pausado",              cls: "bg-orange-500 text-white" },
    cancelled: { label: "Cancelado",            cls: "bg-muted text-muted-foreground" },
  };
  const badge = planStatusBadge[status.planStatus] || { label: status.planStatus, cls: "bg-muted text-muted-foreground" };

  return (
    <div className="space-y-6">
      {/* Current Plan Status */}
      <Card className="rounded-2xl border-border/50 shadow-soft bg-gradient-to-r from-primary/5 to-transparent">
        <CardContent className="p-5">
          {statusLoading ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-muted animate-pulse" />
              <div className="space-y-1.5 flex-1">
                <div className="h-5 w-28 rounded bg-muted animate-pulse" />
                <div className="h-3 w-40 rounded bg-muted animate-pulse" />
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Plano atual</p>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold">{currentPlanDef.name}</p>
                  <Badge className={`rounded-full text-xs ${badge.cls}`}>{badge.label}</Badge>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  {currentPlanDef.price > 0 && (
                    <span className="flex items-center gap-1.5">
                      {status.paymentMethod === "pix_manual"
                        ? <Smartphone className="w-3.5 h-3.5" />
                        : <CreditCard className="w-3.5 h-3.5" />}
                      {status.paymentMethod === "pix_manual" ? "PIX mensal" : "Cartão recorrente"}
                    </span>
                  )}
                  {status.pdvEnabled && (
                    <span className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" />PDV incluído</span>
                  )}
                  {status.planExpiresAt && (
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      Vence {new Date(status.planExpiresAt).toLocaleDateString("pt-BR")}
                    </span>
                  )}
                  {status.amountPaid && (
                    <span className="text-xs">Último pagamento: R$ {Number(status.amountPaid).toFixed(2).replace(".", ",")}</span>
                  )}
                </div>
              </div>
              {status.paymentMethod === "pix_manual" && currentPlanDef.price > 0 && (
                <Button
                  size="sm" variant="outline"
                  className="shrink-0 rounded-xl h-9 gap-1.5 text-sm"
                  onClick={() => setPaymentModalPlan(currentPlanDef)}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Renovar PIX
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {subError && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-sm text-destructive">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {subError}
        </div>
      )}

      {/* Plan Cards */}
      <div className="grid gap-4">
        {PLANS_DEF.map((plan) => {
          const pdvOn = pdvToggles[plan.id] ?? false;
          const cardTotal = plan.price + (pdvOn ? PDV_PRICE_CONST : 0);
          const pixTotal = plan.pixPrice + (pdvOn ? PDV_PRICE_CONST : 0);
          const isCurrent = status.plan === plan.id;
          return (
            <Card key={plan.id} className={`rounded-2xl border-2 shadow-soft transition-all ${isCurrent ? plan.color : "border-border hover:border-border/80"}`}>
              <CardContent className="p-5">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xl font-bold">{plan.name}</span>
                      {plan.badge && <Badge className="rounded-full text-[10px] px-2">{plan.badge}</Badge>}
                      {isCurrent && <Badge variant="outline" className="rounded-full text-[10px] px-2 border-primary text-primary">Atual</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{plan.description}</p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    {plan.price === 0 ? (
                      <div className="text-xl font-bold">Gratuito</div>
                    ) : (
                      <>
                        <div className="text-xl font-bold">R$ {fmtPrice(cardTotal)}</div>
                        <div className="text-xs text-muted-foreground">/mês no cartão</div>
                        <div className="text-xs text-primary font-semibold mt-0.5">
                          R$ {fmtPrice(pixTotal)} via PIX
                        </div>
                      </>
                    )}
                  </div>
                </div>
                {/* Features */}
                <div className="grid sm:grid-cols-2 gap-1.5 mb-4">
                  {plan.features.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      {f.included
                        ? <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                        : <span className="w-3.5 h-3.5 rounded-full border border-muted-foreground/30 shrink-0" />}
                      <span className={f.included ? "" : "text-muted-foreground"}>{f.text}</span>
                    </div>
                  ))}
                </div>
                {/* PDV Toggle */}
                {plan.price > 0 && (
                  <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-secondary/50 mb-4">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium">PDV — Ponto de Venda</div>
                        <div className="text-xs text-muted-foreground">+ R$ {fmtPrice(PDV_PRICE_CONST)}/mês</div>
                      </div>
                    </div>
                    <Switch checked={pdvOn} onCheckedChange={(c) => setPdvToggles(prev => ({ ...prev, [plan.id]: c }))} />
                  </div>
                )}
                {/* CTA */}
                {isCurrent ? (
                  <Button disabled className="w-full h-10 rounded-xl">Plano atual</Button>
                ) : plan.id === "free" ? (
                  <Button variant="outline" disabled className="w-full h-10 rounded-xl">Gratuito</Button>
                ) : (
                  <Button
                    onClick={() => { setSubError(""); setPaymentModalPlan(plan); }}
                    variant={plan.id === "pro" ? "default" : "outline"}
                    className={`w-full h-10 rounded-xl font-medium ${plan.id === "pro" ? "bg-gradient-primary shadow-glow" : ""}`}
                  >
                    {PLANS_DEF.findIndex(p => p.id === status.plan) < PLANS_DEF.findIndex(p => p.id === plan.id)
                      ? "Fazer upgrade" : "Fazer downgrade"}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Cartão recorrente: renovação automática mensal. PIX mensal: validade de 30 dias, renovação manual.
        PDV é adicional de R$ {fmtPrice(PDV_PRICE_CONST)}/mês.
      </p>

      {/* Payment Method Modal */}
      {paymentModalPlan && createPortal(
        <PaymentModal
          plan={paymentModalPlan}
          withPdv={pdvToggles[paymentModalPlan.id] ?? false}
          onClose={() => setPaymentModalPlan(null)}
          onCard={handleCardPayment}
          onPix={handlePixPayment}
        />,
        document.body
      )}

      {/* Card Redirect Countdown */}
      {confirmPlan && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-in fade-in duration-200">
          <div className="bg-card rounded-2xl border border-border shadow-lg p-6 w-full max-w-sm mx-4 animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="relative w-16 h-16">
                <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                  <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="4" className="text-border" />
                  <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="4"
                    strokeDasharray={`${2 * Math.PI * 28}`}
                    strokeDashoffset={`${2 * Math.PI * 28 * (1 - countdown / 5)}`}
                    strokeLinecap="round" className="text-primary transition-all duration-1000" />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-xl font-bold">{countdown}</span>
              </div>
              <div>
                <h3 className="text-lg font-bold">Redirecionando para o Mercado Pago</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Você será levado para a página de assinatura do plano{" "}
                  <span className="font-semibold text-foreground">{confirmPlan}</span>.
                </p>
              </div>
              <div className="flex gap-3 w-full">
                <Button variant="outline" className="flex-1 h-10 rounded-xl" onClick={cancelRedirect}>Cancelar</Button>
                <Button className="flex-1 h-10 rounded-xl bg-gradient-primary text-primary-foreground shadow-glow"
                  onClick={() => { if (initPoint) window.location.href = initPoint; }}>
                  Ir agora
                </Button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* PIX QR Code Modal */}
      {pixData && createPortal(
        <PixModal
          data={pixData}
          onClose={() => {
            setPixData(null);
            loadStatus();
          }}
        />,
        document.body
      )}
    </div>
  );
}

// ─── Payment Method Selection Modal ──────────────────────────────
function PaymentModal({
  plan, withPdv, onClose, onCard, onPix,
}: {
  plan: PlanDef;
  withPdv: boolean;
  onClose: () => void;
  onCard: (plan: PlanDef, withPdv: boolean) => void;
  onPix: (plan: PlanDef, withPdv: boolean) => void;
}) {
  const [selected, setSelected] = useState<"card" | "pix" | null>(null);
  const [loading, setLoading] = useState(false);

  const cardTotal = plan.price + (withPdv ? PDV_PRICE_CONST : 0);
  const pixTotal = plan.pixPrice + (withPdv ? PDV_PRICE_CONST : 0);

  const handleConfirm = async () => {
    if (!selected) return;
    setLoading(true);
    if (selected === "card") { onCard(plan, withPdv); }
    else { onPix(plan, withPdv); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
      <div className="bg-card rounded-2xl border border-border shadow-xl w-full max-w-md animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="text-lg font-bold">Forma de pagamento</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Plano <span className="font-semibold text-foreground">{plan.name}</span>{withPdv ? " + PDV" : ""}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-5 space-y-3">
          {/* Features summary */}
          <div className="p-3 rounded-xl bg-secondary/50 space-y-1">
            {plan.features.slice(0, 3).map((f, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>{f.text}</span>
              </div>
            ))}
            {withPdv && (
              <div className="flex items-center gap-2 text-sm">
                <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>PDV — Ponto de Venda</span>
              </div>
            )}
          </div>

          {/* Card option */}
          <button
            type="button"
            onClick={() => setSelected("card")}
            className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
              selected === "card" ? "border-primary bg-primary/5" : "border-border hover:border-border/60"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${selected === "card" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-sm">Cartão de crédito</div>
                  <div className="text-xs text-muted-foreground">Renovação automática mensal</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold">R$ {fmtPrice(cardTotal)}</div>
                <div className="text-xs text-muted-foreground">/mês</div>
              </div>
            </div>
          </button>

          {/* PIX option */}
          <button
            type="button"
            onClick={() => setSelected("pix")}
            className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
              selected === "pix" ? "border-primary bg-primary/5" : "border-border hover:border-border/60"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${selected === "pix" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-sm">PIX mensal</div>
                  <div className="text-xs text-muted-foreground">Validade de 30 dias · renovação manual</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold">R$ {fmtPrice(pixTotal)}</div>
                <div className="text-xs text-primary font-medium">+R$ 5,00</div>
              </div>
            </div>
          </button>

          {/* Price summary */}
          {selected && (
            <div className="p-3 rounded-xl bg-secondary/30 text-sm space-y-1 animate-in fade-in duration-150">
              <div className="flex justify-between text-muted-foreground">
                <span>Plano {plan.name}</span>
                <span>R$ {fmtPrice(selected === "card" ? plan.price : plan.pixPrice)}</span>
              </div>
              {withPdv && (
                <div className="flex justify-between text-muted-foreground">
                  <span>PDV</span>
                  <span>R$ {fmtPrice(PDV_PRICE_CONST)}</span>
                </div>
              )}
              {selected === "pix" && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Taxa PIX</span>
                  <span>R$ 5,00</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span>R$ {fmtPrice(selected === "card" ? cardTotal : pixTotal)}/mês</span>
              </div>
            </div>
          )}
        </div>

        <div className="p-5 pt-0 flex gap-3">
          <Button variant="outline" className="flex-1 h-11 rounded-xl" onClick={onClose}>Cancelar</Button>
          <Button
            className="flex-1 h-11 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow"
            disabled={!selected || loading}
            onClick={handleConfirm}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : selected === "pix" ? "Gerar QR Code PIX" : "Continuar para pagamento"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── PIX QR Code Modal ────────────────────────────────────────────
function PixModal({ data, onClose }: { data: PixPaymentData; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<"approved" | "pending" | null>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(data.qrCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch { /* ignore */ }
  };

  const handleCheckStatus = async () => {
    setChecking(true);
    setCheckResult(null);
    try {
      const res = await api.get("/api/subscriptions/status");
      const d = await res.json() as { planStatus?: string };
      setCheckResult(d.planStatus === "active" ? "approved" : "pending");
    } catch { setCheckResult("pending"); }
    finally { setChecking(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
      <div className="bg-card rounded-2xl border border-border shadow-xl w-full max-w-sm animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold">Pagar via PIX</h2>
              <p className="text-xs text-muted-foreground">Plano {data.planName}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-5 space-y-4">
          {/* Amount */}
          <div className="text-center py-1">
            <p className="text-xs text-muted-foreground">Valor a pagar</p>
            <p className="text-3xl font-bold">R$ {fmtPrice(data.totalAmount)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Vencimento da cobrança: {new Date(data.expiresAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
            </p>
          </div>

          {/* QR Code Image */}
          {data.qrCodeBase64 ? (
            <div className="flex justify-center">
              <img
                src={`data:image/png;base64,${data.qrCodeBase64}`}
                alt="QR Code PIX"
                className="w-48 h-48 rounded-xl border border-border"
              />
            </div>
          ) : (
            <div className="flex justify-center">
              <div className="w-48 h-48 rounded-xl border border-border bg-muted flex items-center justify-center">
                <QrCode className="w-16 h-16 text-muted-foreground" />
              </div>
            </div>
          )}

          {/* Copy paste */}
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Código PIX copia e cola</p>
            <div className="flex gap-2">
              <div className="flex-1 px-3 py-2 rounded-xl bg-muted text-xs font-mono truncate border border-border">
                {data.qrCode.slice(0, 40)}…
              </div>
              <Button size="icon" variant="outline" className="h-9 w-9 rounded-xl shrink-0" onClick={handleCopy}>
                {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {/* Instructions */}
          <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-700 dark:text-blue-300 space-y-1">
            <p className="font-medium">Como pagar:</p>
            <ol className="list-decimal list-inside space-y-0.5 opacity-90">
              <li>Abra o app do seu banco</li>
              <li>Acesse PIX → Pagar com QR Code ou Copia e Cola</li>
              <li>Após confirmação, seu plano será ativado em instantes</li>
            </ol>
          </div>

          {/* Check status */}
          {checkResult === "approved" && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-sm text-green-700 dark:text-green-300">
              <Check className="w-4 h-4 shrink-0" />
              Pagamento confirmado! Seu plano foi ativado.
            </div>
          )}
          {checkResult === "pending" && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-sm text-yellow-700 dark:text-yellow-300">
              <Clock className="w-4 h-4 shrink-0" />
              Pagamento ainda não confirmado. Aguarde alguns instantes.
            </div>
          )}
        </div>

        <div className="p-5 pt-0 flex gap-3">
          <Button variant="outline" className="flex-1 h-10 rounded-xl text-sm" onClick={onClose}>
            Fechar
          </Button>
          <Button
            className="flex-1 h-10 rounded-xl bg-gradient-primary text-primary-foreground text-sm shadow-glow"
            disabled={checking}
            onClick={checkResult === "approved" ? onClose : handleCheckStatus}
          >
            {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : checkResult === "approved" ? "Concluir" : "Verificar pagamento"}
          </Button>
        </div>
      </div>
    </div>
  );
}

  const [currentPlan, setCurrentPlan] = useState("free");
  const [planStatus, setPlanStatus] = useState("active");
  const [planExpiresAt, setPlanExpiresAt] = useState<string | null>(null);
  const [pdvToggles, setPdvToggles] = useState<Record<string, boolean>>({ start: false, pro: false, full: false });
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [subError, setSubError] = useState("");

  // Redirect confirmation modal
  const [confirmPlan, setConfirmPlan] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(5);
  const [initPoint, setInitPoint] = useState<string | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCountdown = (url: string) => {
    setInitPoint(url);
    setCountdown(5);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!);
          window.location.href = url;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const cancelRedirect = () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setConfirmPlan(null);
    setInitPoint(null);
    setSubscribing(null);
    setCountdown(5);
  };

  const confirmRedirect = () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (initPoint) window.location.href = initPoint;
  };

  const PDV_PRICE = 50;

  useEffect(() => {
    const storeId = localStorage.getItem("storeId");
    if (!storeId) return;
    fetch(`/api/subscriptions/status?storeId=${storeId}`)
      .then(r => r.json())
      .then(data => {
        if (data.plan) setCurrentPlan(data.plan);
        if (data.planStatus) setPlanStatus(data.planStatus);
        if (data.planExpiresAt) setPlanExpiresAt(data.planExpiresAt);
      })
      .catch(() => {});
  }, []);

  const handleUpgrade = async (planId: string) => {
    setSubError("");
    const storeId = localStorage.getItem("storeId");
    const userId = localStorage.getItem("userId");
    if (!storeId) { setSubError("Loja não encontrada"); return; }

    setSubscribing(planId);
    try {
      // Fetch user email from API (not stored in localStorage)
      let payerEmail = "";
      let payerName = "";
      if (userId) {
        const userRes = await api.get(`/api/user/get?userId=${userId}`);
        if (userRes.ok) {
          const userData = await userRes.json();
          payerEmail = userData.user?.email || "";
          payerName = userData.user?.name || "";
        }
      }

      if (!payerEmail) { setSubError("Email do usuário não encontrado. Faça login novamente."); setSubscribing(null); return; }

      const res = await api.post("/api/subscriptions/create", {
        storeId,
        planId,
        withPdv: pdvToggles[planId] || false,
        payerEmail,
        payerName,
      });
      const data = await res.json();
      if (res.ok && data.init_point) {
        setConfirmPlan(planId);
        startCountdown(data.init_point);
      } else {
        setSubError(data.error || "Erro ao iniciar assinatura");
        setSubscribing(null);
      }
    } catch {
      setSubError("Erro de conexão");
      setSubscribing(null);
    }
  };

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

  const currentPlanData = plans.find(p => p.id === currentPlan) || plans[0];
  const basePrice = currentPlanData?.price || 0;
  const currentPdv = pdvToggles[currentPlan] || false;
  const totalPrice = basePrice + (currentPdv ? PDV_PRICE : 0);

  const formatPrice = (val: number) => val.toFixed(2).replace(".", ",");

  const planStatusLabel: Record<string, string> = {
    active: "Ativo",
    pending: "Pendente",
    paused: "Pausado",
    cancelled: "Cancelado",
  };

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
                {basePrice === 0 ? "Gratuito" : `R$ ${formatPrice(basePrice)}/mês`}
              </div>
              {planExpiresAt && (
                <div className="text-xs text-muted-foreground mt-1">
                  Expira em: {new Date(planExpiresAt).toLocaleDateString("pt-BR")}
                </div>
              )}
            </div>
            <Badge className={`rounded-full ${
              planStatus === "active" ? "bg-primary text-primary-foreground" :
              planStatus === "pending" ? "bg-yellow-500 text-white" :
              "bg-destructive text-destructive-foreground"
            }`}>
              {planStatusLabel[planStatus] || planStatus}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {subError && (
        <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-sm text-destructive">
          {subError}
        </div>
      )}

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
                ) : plan.id === "free" ? (
                  <Button variant="outline" disabled className="w-full h-10 rounded-xl font-medium">
                    Gratuito
                  </Button>
                ) : (
                  <Button
                    onClick={() => handleUpgrade(plan.id)}
                    disabled={subscribing === plan.id}
                    variant={plan.id === "pro" ? "default" : "outline"}
                    className={`w-full h-10 rounded-xl font-medium ${
                      plan.id === "pro" ? "bg-gradient-primary shadow-glow" : ""
                    }`}
                  >
                    {subscribing === plan.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        {plans.findIndex(p => p.id === currentPlan) < plans.findIndex(p => p.id === plan.id)
                          ? "Fazer upgrade"
                          : "Fazer downgrade"}
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
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

      {/* Redirect confirmation modal */}
      {confirmPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-in fade-in duration-200">
          <div className="bg-card rounded-2xl border border-border shadow-lg p-6 w-full max-w-sm mx-4 animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center gap-4">
              {/* Countdown ring */}
              <div className="relative w-16 h-16">
                <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                  <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="4" className="text-border" />
                  <circle
                    cx="32" cy="32" r="28"
                    fill="none" stroke="currentColor" strokeWidth="4"
                    strokeDasharray={`${2 * Math.PI * 28}`}
                    strokeDashoffset={`${2 * Math.PI * 28 * (1 - countdown / 5)}`}
                    strokeLinecap="round"
                    className="text-primary transition-all duration-1000"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-xl font-bold">{countdown}</span>
              </div>

              <div>
                <h3 className="text-lg font-bold">Redirecionando para o Mercado Pago</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Você será levado à página de pagamento do plano{" "}
                  <span className="font-semibold text-foreground capitalize">{confirmPlan}</span>.
                  <br />O redirecionamento acontece em <span className="font-bold text-primary">{countdown}s</span>.
                </p>
              </div>

              <div className="flex gap-3 w-full">
                <Button
                  variant="outline"
                  className="flex-1 h-10 rounded-xl font-medium"
                  onClick={cancelRedirect}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1 h-10 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow"
                  onClick={confirmRedirect}
                >
                  Ir agora
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
