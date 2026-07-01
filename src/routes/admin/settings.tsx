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
  ShieldAlert,
  Search,
  ChevronDown,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Fingerprint,
} from "lucide-react";
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImageUploadCrop } from "@/components/armazix/ImageUploadCrop";
import { PaymentMethodEditor } from "@/components/admin/PaymentMethodEditor";
import type { PaymentMethodConfig } from "@/lib/store-context";

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
  logoUrl?: string;
  banners?: Array<{ imageUrl: string | null; position: number | null }>;
  backgroundColor?: string;
  textColor?: string;
  showPrice?: boolean;
  whatsappOrderEnabled?: boolean;
  whatsappPhone?: string;
  highlightLowStock?: boolean;
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
  const [logoUrl, setLogoUrl] = useState("");
  const [bannerImages, setBannerImages] = useState<string[]>([]);
  const [bannersSaving, setBannersSaving] = useState(false);
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");
  const [textColor, setTextColor] = useState("#0f172a");
  const [showPrice, setShowPrice] = useState(true);
  const [whatsappOrderEnabled, setWhatsappOrderEnabled] = useState(false);
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [highlightLowStock, setHighlightLowStock] = useState(false);

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
  const [mpPublicKey, setMpPublicKey] = useState("");
  const [mpTokenSaving, setMpTokenSaving] = useState(false);
  const [mpTokenSuccess, setMpTokenSuccess] = useState(false);
  const [mpTokenError, setMpTokenError] = useState("");

  // Payment methods config
  const [paymentMethodsConfig, setPaymentMethodsConfig] = useState<PaymentMethodConfig[]>([
    { key: "cash",        label: "Dinheiro",          enabled: true,  maxInstallments: 1,  payAtDelivery: true,  especie: "dinheiro"                                  },
    { key: "pix",         label: "PIX",               enabled: true,  maxInstallments: 1,  payAtDelivery: true,  especie: "pix"                                       },
    { key: "card",        label: "Cartão de Crédito", enabled: true,  maxInstallments: 12, payAtDelivery: true,  especie: "cartao",      operacao: "credito"           },
    { key: "debit",       label: "Cartão de Débito",  enabled: true,  maxInstallments: 1,  payAtDelivery: true,  especie: "cartao",      operacao: "debito"            },
    { key: "mercadopago", label: "Mercado Pago",       enabled: false, maxInstallments: 1,                       especie: "mercadopago"                               },
  ]);
  const [deliveryPaymentEnabled, setDeliveryPaymentEnabled] = useState(true);
  const [newMethodLabel, setNewMethodLabel] = useState("");
  const [pmcSaving, setPmcSaving] = useState(false);
  const [pmcSuccess, setPmcSuccess] = useState(false);

  // User profile states
  const [profileName, setProfileName] = useState("");
  const [profileAvatar, setProfileAvatar] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState("");
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [vitrineSaving, setVitrineSaving] = useState(false);
  const [vitrineSuccess, setVitrineSuccess] = useState(false);
  const [vitrineError, setVitrineError] = useState("");

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
      const res = await api.post("/api/payments/mp-token", {
        storeId: store.id,
        accessToken: mpToken,
        publicKey: mpPublicKey.trim() || undefined,
      });
      const data = await res.json() as { error?: string };
      if (res.ok) {
        setMpTokenSuccess(true);
        setTimeout(() => setMpTokenSuccess(false), 3000);
      } else {
        setMpTokenError(data.error || "Erro ao salvar credenciais");
      }
    } catch {
      setMpTokenError("Erro de conexão");
    } finally {
      setMpTokenSaving(false);
    }
  };

  const savePaymentConfig = async () => {
    if (!store) return;
    setPmcSaving(true);
    setPmcSuccess(false);
    try {
      const res = await api.post("/api/store/update", { paymentMethodsConfig, deliveryPaymentEnabled });
      if (res.ok) {
        setPmcSuccess(true);
        setTimeout(() => setPmcSuccess(false), 3000);
      }
    } catch {} finally { setPmcSaving(false); }
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
        setLogoUrl(data.store.logoUrl || "");
        if (data.store.banners && data.store.banners.length > 0) {
          setBannerImages(
            [...data.store.banners]
              .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
              .map((b: { imageUrl: string | null }) => b.imageUrl || "")
              .filter(Boolean)
          );
        }
        setBackgroundColor(data.store.backgroundColor || "#ffffff");
        setTextColor(data.store.textColor || "#0f172a");
        setShowPrice(data.store.showPrice !== false);
        setWhatsappOrderEnabled(data.store.whatsappOrderEnabled === true);
        setWhatsappPhone(data.store.whatsappPhone || data.store.phone || "");
        setHighlightLowStock(data.store.highlightLowStock === true);
        if (data.store.mpPublicKey) setMpPublicKey(data.store.mpPublicKey);
        if (data.store.paymentMethodsConfig?.length) setPaymentMethodsConfig(data.store.paymentMethodsConfig);
        if (data.store.deliveryPaymentEnabled !== undefined) setDeliveryPaymentEnabled(data.store.deliveryPaymentEnabled !== false);
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

  const handleSaveVitrine = async () => {
    if (!store) return;
    setVitrineSaving(true);
    setVitrineSuccess(false);
    setVitrineError("");
    try {
      if (whatsappOrderEnabled && !whatsappPhone.trim()) {
        setVitrineError("Informe o WhatsApp para ativar o pedido via WhatsApp");
        return;
      }
      const res = await api.post("/api/store/update", {
        storeId: store.id,
        logoUrl: logoUrl || null,
        primaryColor,
        backgroundColor,
        textColor,
        showPrice,
        whatsappOrderEnabled,
        whatsappPhone: whatsappOrderEnabled ? whatsappPhone : null,
        highlightLowStock,
      });
      const data = await res.json();
      if (res.ok) {
        setVitrineSuccess(true);
        setStore(data.store);
        setTimeout(() => setVitrineSuccess(false), 3000);
      } else {
        setVitrineError(data.error || "Erro ao salvar vitrine");
      }
    } catch {
      setVitrineError("Erro de conexão");
    } finally {
      setVitrineSaving(false);
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
        {/* Scrollable tab bar: fills full width on desktop, scrolls on mobile */}
        <div className="w-full overflow-x-auto [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: "none" }}>
          <TabsList className="flex w-full min-w-max h-auto justify-start items-center gap-1 p-1.5 rounded-2xl">
            <TabsTrigger value="geral"          className="flex-1 shrink-0 rounded-xl px-4 py-2.5 text-xs font-medium text-center whitespace-nowrap">Geral</TabsTrigger>
            <TabsTrigger value="horarios"       className="flex-1 shrink-0 rounded-xl px-4 py-2.5 text-xs font-medium text-center whitespace-nowrap">Horários</TabsTrigger>
            <TabsTrigger value="personalizacao" className="flex-1 shrink-0 rounded-xl px-4 py-2.5 text-xs font-medium text-center whitespace-nowrap">Personalização</TabsTrigger>
            <TabsTrigger value="pagamentos"     className="flex-1 shrink-0 rounded-xl px-4 py-2.5 text-xs font-medium text-center whitespace-nowrap">Formas de pagamento</TabsTrigger>
            <TabsTrigger value="perfil"         className="flex-1 shrink-0 rounded-xl px-4 py-2.5 text-xs font-medium text-center whitespace-nowrap">Perfil</TabsTrigger>
            <TabsTrigger value="planos"         className="flex-1 shrink-0 rounded-xl px-4 py-2.5 text-xs font-medium text-center whitespace-nowrap">Planos</TabsTrigger>
            <TabsTrigger value="auditoria"      className="flex-1 shrink-0 rounded-xl px-4 py-2.5 text-xs font-medium text-center whitespace-nowrap">Auditoria</TabsTrigger>
          </TabsList>
        </div>

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
                  Link da sua loja
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
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => window.open(`https://${store?.slug}.armazix.com.br`, "_blank")}
                    className="h-11 w-11 rounded-xl shrink-0"
                    title="Abrir loja em nova guia"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Padrão limpo, sem hífens ou caracteres especiais.
                </p>
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
              {/* Store ID */}
              <div className="flex items-center justify-between py-1">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
                  <Fingerprint className="w-3 h-3" />
                  Store ID:
                  <span className="font-mono">{store?.id ?? "—"}</span>
                </span>
                <CopyStoreUrlButton url={store?.id ?? ""} />
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
                Personalizar
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="text-sm font-semibold">Identidade básica</div>

                <ImageUploadCrop
                  label="Logo"
                  value={logoUrl}
                  onChange={setLogoUrl}
                  recommendedText="Tamanho recomendado: 250x250px (Proporção 1:1) - PNG transparente"
                  aspect={1}
                  targetWidth={250}
                  targetHeight={250}
                  maxBytes={2 * 1024 * 1024}
                  outputFormat="image/png"
                />

                {/* Multi-banner — até 5 banners, salvos como WebP */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">Banners da loja</div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{bannerImages.length}/5 banners</span>
                      {bannersSaving && <span className="text-xs text-muted-foreground">Salvando...</span>}
                    </div>
                  </div>

                  <div className="space-y-4">
                    {bannerImages.map((img, idx) => (
                      <div key={idx} className="relative">
                        <div className="text-xs text-muted-foreground mb-1">Banner {idx + 1}</div>
                        <ImageUploadCrop
                          label=""
                          value={img}
                          onChange={(val) => {
                            const updated = [...bannerImages];
                            updated[idx] = val;
                            setBannerImages(updated);
                          }}
                          recommendedText="Proporção 16:5 — converte para WebP"
                          aspect={16 / 5}
                          targetWidth={1600}
                          targetHeight={500}
                          maxBytes={4 * 1024 * 1024}
                          outputFormat="image/webp"
                        />
                        {img && (
                          <button
                            type="button"
                            onClick={() => setBannerImages((prev) => prev.filter((_, i) => i !== idx))}
                            className="absolute top-0 right-0 text-xs text-destructive hover:underline"
                          >
                            Remover banner
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {bannerImages.length < 5 && (
                    <button
                      type="button"
                      onClick={() => setBannerImages((prev) => [...prev, ""])}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      + Adicionar banner
                    </button>
                  )}

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 rounded-xl text-sm"
                      disabled={bannersSaving}
                      onClick={async () => {
                        if (!store) return;
                        setBannersSaving(true);
                        try {
                          const res = await api.post("/api/banners/save", {
                            imageUrls: bannerImages.filter(Boolean),
                          });
                          if (!res.ok) {
                            const d = await res.json() as { error?: string };
                            setVitrineError(d.error || "Erro ao salvar banners");
                          }
                        } catch {
                          setVitrineError("Erro de conexão ao salvar banners");
                        } finally {
                          setBannersSaving(false);
                        }
                      }}
                    >
                      {bannersSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar banners"}
                    </Button>
                    <span className="text-xs text-muted-foreground">Banners são salvos separadamente das demais configurações</span>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="text-sm font-semibold">Cores do tema</div>

                <div className="grid md:grid-cols-2 gap-6 items-start">
                  <div className="space-y-4">
                    <ColorField label="Cor primária" value={primaryColor} onChange={setPrimaryColor} />
                    <ColorField label="Cor de fundo" value={backgroundColor} onChange={setBackgroundColor} />
                    <ColorField label="Cor dos textos" value={textColor} onChange={setTextColor} />
                  </div>

                  <div className="md:pt-2">
                    <StorefrontMiniPreview
                      primaryColor={primaryColor}
                      backgroundColor={backgroundColor}
                      textColor={textColor}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="text-sm font-semibold">Opções de layout</div>

                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium">Exibir preço nos produtos?</div>
                    <div className="text-xs text-muted-foreground">Desative para usar apenas como vitrine/catálogo</div>
                  </div>
                  <Switch checked={showPrice} onCheckedChange={setShowPrice} />
                </div>

                <Separator />

                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium">Permitir pedido via WhatsApp?</div>
                    <div className="text-xs text-muted-foreground">Ativa o botão “Enviar pedido para o WhatsApp”</div>
                  </div>
                  <Switch checked={whatsappOrderEnabled} onCheckedChange={setWhatsappOrderEnabled} />
                </div>

                {whatsappOrderEnabled && (
                  <div className="space-y-2">
                    <Label>Telefone do WhatsApp</Label>
                    <Input value={whatsappPhone} onChange={(e) => setWhatsappPhone(e.target.value)} placeholder="Ex: 5581999999999" className="h-11 rounded-xl font-mono" />
                    <p className="text-xs text-muted-foreground">Use DDI + DDD + número (apenas dígitos)</p>
                  </div>
                )}

                <Separator />

                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium">Destacar estoque baixo / últimas unidades?</div>
                    <div className="text-xs text-muted-foreground">Mostra um aviso discreto no card do produto</div>
                  </div>
                  <Switch checked={highlightLowStock} onCheckedChange={setHighlightLowStock} />
                </div>
              </div>

              {vitrineError && <p className="text-sm text-destructive">{vitrineError}</p>}
              {vitrineSuccess && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <Check className="w-4 h-4" />
                  Personalização salva com sucesso!
                </div>
              )}

              <Button
                onClick={handleSaveVitrine}
                disabled={vitrineSaving}
                className="h-10 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow"
              >
                {vitrineSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar personalização"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Formas de Pagamento ────────────────────────────────────── */}
        <TabsContent value="pagamentos" className="mt-6 space-y-6">

          <Card className="rounded-2xl border-border/50 shadow-soft">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                Formas de Pagamento
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Configure espécie, operação, taxas de parcelamento, repasse ao cliente e dados do PIX.
              </p>
            </CardHeader>
            <CardContent className="pb-5">
              <PaymentMethodEditor
                methods={paymentMethodsConfig}
                deliveryPaymentEnabled={deliveryPaymentEnabled}
                saving={pmcSaving}
                success={pmcSuccess}
                onMethodsChange={setPaymentMethodsConfig}
                onDeliveryPaymentChange={setDeliveryPaymentEnabled}
                onSave={savePaymentConfig}
              />
            </CardContent>
          </Card>

          {/* Card Mercado Pago credenciais */}
          <Card className="rounded-2xl border-border/50 shadow-soft">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Zap className="w-4 h-4 text-blue-500" />
                Mercado Pago — Credenciais
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">

              {/* Guia visual */}
              <div className="rounded-xl border border-blue-200 bg-blue-50/60 dark:bg-blue-950/30 dark:border-blue-900 p-4 space-y-3">
                <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">Como encontrar suas credenciais</p>
                <ol className="space-y-1.5 text-blue-700 dark:text-blue-400 text-xs list-none">
                  <li className="flex items-start gap-2">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center text-[10px]">1</span>
                    Acesse <span className="font-mono mx-1 bg-blue-100 dark:bg-blue-900 px-1 rounded">mercadopago.com.br</span> e faça login
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center text-[10px]">2</span>
                    Vá em <strong>Sua conta → Ferramentas de integração → Credenciais</strong>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center text-[10px]">3</span>
                    Copie a <strong>Public Key</strong> e o <strong>Access Token</strong> de <strong>produção</strong>
                  </li>
                </ol>
              </div>

              {/* Public Key */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Label className="text-sm font-medium">Public Key</Label>
                  <Badge variant="secondary" className="text-[10px] rounded-full">Pública — segura para o frontend</Badge>
                </div>
                <Input
                  type="text"
                  value={mpPublicKey}
                  onChange={(e) => setMpPublicKey(e.target.value)}
                  placeholder="APP_USR-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className="h-11 rounded-xl font-mono text-sm"
                />
                <p className="text-[11px] text-muted-foreground">Começa com <code className="bg-muted px-1 rounded">APP_USR-</code> ou <code className="bg-muted px-1 rounded">TEST-</code></p>
              </div>

              <Separator />

              {/* Access Token */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Label className="text-sm font-medium">Access Token</Label>
                  <Badge className="text-[10px] rounded-full bg-amber-500/15 text-amber-700 border-0 hover:bg-amber-500/15">Privado — nunca compartilhe</Badge>
                </div>
                <Input
                  type="password"
                  value={mpToken}
                  onChange={(e) => { setMpToken(e.target.value); setMpTokenError(""); }}
                  placeholder="APP_USR-0000000000000000-000000-xxxxxxxx-000000000"
                  className="h-11 rounded-xl font-mono text-sm"
                />
                <p className="text-[11px] text-muted-foreground">Armazenado de forma criptografada. Começa com <code className="bg-muted px-1 rounded">APP_USR-</code> (produção) ou <code className="bg-muted px-1 rounded">TEST-</code> (sandbox).</p>
              </div>

              {mpTokenError && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {mpTokenError}
                </div>
              )}
              {mpTokenSuccess && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle2 className="w-4 h-4" />
                  Credenciais salvas com sucesso!
                </div>
              )}

              <Button
                onClick={saveMpToken}
                disabled={mpTokenSaving || !mpToken}
                className="h-10 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow"
              >
                {mpTokenSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar credenciais"}
              </Button>

              <Separator />

              <div className="space-y-1.5">
                <p className="text-sm font-medium">Como funciona o Checkout Pro</p>
                <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                  <li>O cliente escolhe "Mercado Pago" e é redirecionado para a página de pagamento</li>
                  <li>Aceita PIX, cartão de crédito/débito e boleto automaticamente</li>
                  <li>O pedido é confirmado via webhook após o pagamento</li>
                  <li>Ative "Mercado Pago" na lista acima para disponibilizar no checkout</li>
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

          {/* Alterar Senha */}
          <Card className="rounded-2xl border-border/50 shadow-soft">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Alterar Senha
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

        <TabsContent value="auditoria" className="mt-6">
          <AuditoriaSection />
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

function normalizeHex(value: string): string {
  const v = value.trim().toUpperCase();
  if (!v) return "";
  const raw = v.startsWith("#") ? v.slice(1) : v;
  const cleaned = raw.replace(/[^0-9A-F]/g, "").slice(0, 6);
  return `#${cleaned}`;
}

function expandHex3(value: string): string {
  const raw = value.replace("#", "");
  if (raw.length !== 3) return value;
  const [a, b, c] = raw.split("");
  return `#${a}${a}${b}${b}${c}${c}`;
}

function isHex6(value: string): boolean {
  return /^#[0-9A-F]{6}$/.test(value.toUpperCase());
}

function ColorField(props: { label: string; value: string; onChange: (value: string) => void }) {
  const [text, setText] = useState(props.value.toUpperCase());

  useEffect(() => {
    setText(props.value.toUpperCase());
  }, [props.value]);

  return (
    <div className="space-y-2">
      <Label>{props.label}</Label>
      <div className="flex items-center gap-3">
        <label className="relative shrink-0">
          <span
            className="block w-11 h-11 rounded-full border border-border/60 shadow-sm"
            style={{ backgroundColor: props.value }}
          />
          <input
            type="color"
            value={props.value}
            onChange={(e) => {
              const v = e.target.value.toUpperCase();
              props.onChange(v);
              setText(v);
            }}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
        </label>

        <Input
          value={text}
          onChange={(e) => {
            const next = e.target.value.toUpperCase();
            setText(next);
            const normalized = normalizeHex(next);
            if (isHex6(normalized)) {
              props.onChange(normalized);
              setText(normalized);
            }
          }}
          onBlur={() => {
            const normalized = normalizeHex(text);
            const expanded = isHex6(expandHex3(normalized)) ? expandHex3(normalized) : normalized;
            if (isHex6(expanded)) props.onChange(expanded);
            setText(isHex6(expanded) ? expanded : props.value.toUpperCase());
          }}
          placeholder="#0B1F3A"
          className="h-11 rounded-xl font-mono uppercase"
        />
      </div>
    </div>
  );
}

function StorefrontMiniPreview(props: { primaryColor: string; backgroundColor: string; textColor: string }) {
  const borderColor = `color-mix(in oklab, ${props.textColor} 18%, transparent)`;
  const surfaceColor = `color-mix(in oklab, ${props.backgroundColor} 90%, white)`;
  const surface2Color = `color-mix(in oklab, ${props.backgroundColor} 82%, white)`;
  const mutedTextColor = `color-mix(in oklab, ${props.textColor} 65%, transparent)`;

  return (
    <div className="rounded-2xl border border-border/50 bg-secondary/20 p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="text-sm font-semibold">Mini-preview</div>
        <Badge className="rounded-full bg-primary/15 text-primary border-0 text-[10px]">Tempo real</Badge>
      </div>

      <div className="mx-auto w-full max-w-[340px]">
        <div className="rounded-[2.5rem] border border-border/60 bg-muted/30 p-3 shadow-soft">
          <div
            className="rounded-[2rem] overflow-hidden"
            style={{ backgroundColor: props.backgroundColor, color: props.textColor }}
          >
            <div
              className="px-3 pt-3 pb-2"
              style={{
                backgroundColor: surfaceColor,
                borderBottom: `1px solid ${borderColor}`,
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="w-8 h-8 rounded-2xl border"
                    style={{ backgroundColor: props.primaryColor, borderColor: borderColor }}
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate">Sua Loja</div>
                    <div className="text-[10px] truncate" style={{ color: mutedTextColor }}>
                      Catálogo online
                    </div>
                  </div>
                </div>
                <div
                  className="w-9 h-9 rounded-2xl flex items-center justify-center border"
                  style={{ backgroundColor: surface2Color, borderColor: borderColor }}
                >
                  <Package className="w-4 h-4" style={{ color: mutedTextColor }} />
                </div>
              </div>

              <div
                className="mt-3 h-9 rounded-2xl flex items-center gap-2 px-3 border"
                style={{ backgroundColor: props.backgroundColor, borderColor: borderColor }}
              >
                <Search className="w-4 h-4" style={{ color: mutedTextColor }} />
                <span className="text-xs" style={{ color: mutedTextColor }}>
                  Buscar produtos...
                </span>
              </div>
            </div>

            <div className="p-3 space-y-3">
              <div
                className="h-16 rounded-2xl border"
                style={{
                  backgroundImage: `linear-gradient(135deg, color-mix(in oklab, ${props.primaryColor} 35%, transparent), transparent)`,
                  backgroundColor: surface2Color,
                  borderColor: borderColor,
                }}
              />

              <div className="grid grid-cols-2 gap-2">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-2xl border overflow-hidden"
                    style={{ backgroundColor: surfaceColor, borderColor: borderColor }}
                  >
                    <div className="aspect-square" style={{ backgroundColor: surface2Color }} />
                    <div className="p-2 space-y-1">
                      <div className="text-[11px] font-medium leading-snug">Produto</div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[11px] font-bold" style={{ color: props.primaryColor }}>
                          R$ 19,90
                        </div>
                        <div
                          className="w-7 h-7 rounded-xl flex items-center justify-center"
                          style={{ backgroundColor: props.primaryColor, color: "#fff" }}
                        >
                          +
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div
                className="h-10 rounded-2xl flex items-center justify-center text-xs font-semibold"
                style={{ backgroundColor: props.primaryColor, color: "#fff" }}
              >
                Enviar pedido
              </div>
            </div>
          </div>
        </div>
      </div>
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
    id: "full", name: "Full", price: 99.90, pixPrice: 104.90,
    description: "Produtos ilimitados",
    features: [
      { text: "Produtos ilimitados", included: true },
      { text: "Pedidos online + Delivery", included: true },
      { text: "Relatórios avançados", included: true },
      { text: "Usuários ilimitados", included: true },
      { text: "Ponto de Venda incluso", included: true },
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
                {plan.price > 0 && plan.id !== "full" && (
                  <div className={`flex items-center justify-between py-3 px-4 rounded-xl mb-4 border transition-colors ${pdvOn ? "bg-primary/8 border-primary/30" : "bg-secondary/50 border-transparent"}`}>
                    <div className="flex items-center gap-2.5">
                      <Building2 className={`w-4 h-4 shrink-0 ${pdvOn ? "text-primary" : "text-muted-foreground"}`} />
                      <div>
                        <div className="text-sm font-semibold">PDV — Ponto de Venda</div>
                        <div className="text-xs text-muted-foreground mt-0.5">Terminal para loja física</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-bold tabular-nums ${pdvOn ? "text-primary" : "text-foreground/60"}`}>
                        + R$ {fmtPrice(PDV_PRICE_CONST)}<span className="text-xs font-normal">/mês</span>
                      </span>
                      <Switch checked={pdvOn} onCheckedChange={(c) => setPdvToggles(prev => ({ ...prev, [plan.id]: c }))} />
                    </div>
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

// ─── Auditoria Section ────────────────────────────────────────────
type ModuloAudit = "FINANCEIRO_RECEBER" | "FINANCEIRO_PAGAR" | "FINANCEIRO_FLUXO" | "VENDAS_PDV" | "ESTOQUE" | "AUTENTICACAO" | "CONFIGURACOES";
type StatusAudit = "success" | "failure" | "denied";
interface LogAudit {
  id: string; data_hora: string; nome_usuario: string; acao: string;
  modulo: ModuloAudit; recurso_id: string; recurso_tipo: string;
  status: StatusAudit; ip_origem: string; dispositivo: string;
  dados_anteriores: Record<string, unknown> | null;
  dados_novos: Record<string, unknown> | null;
}

const MODULOS_AUDIT: ModuloAudit[] = ["FINANCEIRO_RECEBER","FINANCEIRO_PAGAR","FINANCEIRO_FLUXO","VENDAS_PDV","ESTOQUE","AUTENTICACAO","CONFIGURACOES"];
const STATUS_AUDIT_LIST: StatusAudit[] = ["success","failure","denied"];

function StatusAuditBadge({ status }: { status: StatusAudit }) {
  const map: Record<StatusAudit, { label: string; cls: string }> = {
    success: { label: "Sucesso", cls: "bg-emerald-50 text-emerald-700" },
    failure: { label: "Falha",   cls: "bg-rose-50 text-rose-700"      },
    denied:  { label: "Negado",  cls: "bg-amber-50 text-amber-700"    },
  };
  const { label, cls } = map[status];
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${cls}`}>{label}</span>;
}

function ModuloBadge({ modulo }: { modulo: ModuloAudit }) {
  const map: Record<ModuloAudit, string> = {
    FINANCEIRO_RECEBER: "bg-emerald-500/10 text-emerald-700",
    FINANCEIRO_PAGAR:   "bg-indigo-500/10 text-indigo-700",
    FINANCEIRO_FLUXO:   "bg-blue-500/10 text-blue-700",
    VENDAS_PDV:         "bg-violet-500/10 text-violet-700",
    ESTOQUE:            "bg-amber-500/10 text-amber-700",
    AUTENTICACAO:       "bg-slate-200 text-slate-700",
    CONFIGURACOES:      "bg-pink-500/10 text-pink-700",
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${map[modulo]}`}>{modulo.replace(/_/g, " ")}</span>;
}

function AuditoriaSection() {
  const [filterModulo, setFilterModulo] = useState<ModuloAudit | "TODOS">("TODOS");
  const [search,       setSearch]       = useState("");
  const [expanded,     setExpanded]     = useState<string | null>(null);
  const [dataInicio,   setDataInicio]   = useState("");
  const [dataFim,      setDataFim]      = useState("");

  const filtered = useMemo(() => ([] as LogAudit[]).filter(l => {
    if (filterModulo !== "TODOS" && l.modulo !== filterModulo) return false;
    if (search && !l.nome_usuario.toLowerCase().includes(search.toLowerCase())
      && !l.acao.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [filterModulo, search]);

  const kpis = useMemo(() => ({
    total: 0,
  }), []);

  return (
    <div className="space-y-6">

      {/* Filtros */}
      <Card className="rounded-2xl border-border/50">
        <CardContent className="p-4 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
            {/* Módulo */}
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Módulo</p>
              <div className="relative">
                <select value={filterModulo} onChange={e => setFilterModulo(e.target.value as ModuloAudit | "TODOS")}
                  className="w-full h-9 px-3 pr-8 text-sm rounded-xl bg-secondary/40 border border-input appearance-none focus:outline-none focus:ring-2 focus:ring-ring/30 cursor-pointer">
                  <option value="TODOS">Todos os Módulos</option>
                  {MODULOS_AUDIT.map(m => <option key={m} value={m}>{m.replace(/_/g, " ")}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            {/* Período */}
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Período</p>
              <div className="grid grid-cols-2 gap-2">
                <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
                  className="h-9 w-full rounded-xl text-sm bg-secondary/40 border-input" />
                <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
                  className="h-9 w-full rounded-xl text-sm bg-secondary/40 border-input" />
              </div>
            </div>

            {/* Busca */}
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Buscar</p>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Usuário ou ação..."
                  className="pl-10 h-9 w-full rounded-xl text-sm bg-secondary/40 border-input" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Aviso imutabilidade */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
        <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800 leading-relaxed">
          <span className="font-bold">Registros protegidos.</span> Os logs de auditoria não podem ser alterados ou excluídos.
          Isso garante a segurança e integridade do histórico de atividades da sua loja.
        </p>
      </div>

      {/* Tabela */}
      <div>
        <p className="text-sm text-muted-foreground px-1 mb-3">{filtered.length} de {kpis.total} eventos</p>
        <Card className="rounded-2xl border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 border-b border-border/40">
                <tr>
                  {["Quando","Quem","O que","Onde",""].map(h => (
                    <th key={h} className="text-left px-3 py-2.5 text-[11px] font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filtered.length === 0
                  ? <tr><td colSpan={5} className="py-10 text-center text-sm text-muted-foreground">Nenhum evento encontrado</td></tr>
                  : filtered.map(l => (
                    <>
                      <tr key={l.id} onClick={() => setExpanded(expanded === l.id ? null : l.id)}
                        className="transition-colors cursor-pointer hover:bg-secondary/20">
                        <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{l.data_hora}</td>
                        <td className="px-3 py-2.5 font-medium whitespace-nowrap">{l.nome_usuario}</td>
                        <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px]">
                            {l.acao.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="px-3 py-2.5"><ModuloBadge modulo={l.modulo} /></td>
                        <td className="px-3 py-2.5 w-10">
                          <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-150 ${expanded === l.id ? "rotate-180" : ""}`} />
                        </td>
                      </tr>
                      {expanded === l.id && (
                        <tr key={`${l.id}-d`} className="bg-secondary/20">
                          <td colSpan={5} className="px-4 py-4">
                            <div className="space-y-3">
                              {(l.dados_anteriores || l.dados_novos) && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {l.dados_anteriores && (
                                    <div className="space-y-2">
                                      <p className="text-[11px] font-semibold text-rose-600 uppercase tracking-wider">Antes</p>
                                      <div className="space-y-1">
                                        {Object.entries(l.dados_anteriores).map(([k, v]) => (
                                          <div key={k} className="flex items-center justify-between text-sm py-1 border-b border-border/30 last:border-0">
                                            <span className="text-muted-foreground">{k}</span>
                                            <span className="font-mono text-xs bg-rose-50 text-rose-700 px-2 py-0.5 rounded">{String(v)}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {l.dados_novos && (
                                    <div className="space-y-2">
                                      <p className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">Depois</p>
                                      <div className="space-y-1">
                                        {Object.entries(l.dados_novos).map(([k, v]) => (
                                          <div key={k} className="flex items-center justify-between text-sm py-1 border-b border-border/30 last:border-0">
                                            <span className="text-muted-foreground">{k}</span>
                                            <span className="font-mono text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded">{String(v)}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                              {(!l.dados_anteriores && !l.dados_novos) && (
                                <p className="text-sm text-muted-foreground italic">Sem alterações de dados para este evento.</p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))
                }
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
