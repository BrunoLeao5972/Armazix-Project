import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import {
  Store,
  Shield,
  Clock,
  Palette,
  Loader2,
  TrendingUp,
  ShieldAlert,
  Truck,
  User,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DEFAULT_DELIVERY_MODEL_CONFIG } from "@/components/admin/DeliveryPricingConfig";
import type { DeliveryModelConfig } from "@/components/admin/DeliveryPricingConfig";
import type { StoreData } from "@/components/admin/settings/types";

const GeralTab = lazy(() => import("@/components/admin/settings/GeralTab").then((m) => ({ default: m.GeralTab })));
const HorariosTab = lazy(() => import("@/components/admin/settings/HorariosTab").then((m) => ({ default: m.HorariosTab })));
const PersonalizacaoTab = lazy(() => import("@/components/admin/settings/PersonalizacaoTab").then((m) => ({ default: m.PersonalizacaoTab })));
const EntregaTab = lazy(() => import("@/components/admin/settings/EntregaTab").then((m) => ({ default: m.EntregaTab })));
const PerfilTab = lazy(() => import("@/components/admin/settings/PerfilTab").then((m) => ({ default: m.PerfilTab })));
const PlansSection = lazy(() => import("@/components/admin/settings/PlansSection").then((m) => ({ default: m.PlansSection })));
const AuditoriaSection = lazy(() => import("@/components/admin/settings/AuditoriaSection").then((m) => ({ default: m.AuditoriaSection })));
const PermissionsTab = lazy(() => import("@/components/admin/PermissionsTab").then((m) => ({ default: m.PermissionsTab })));

export const Route = createFileRoute("/admin/configuracoes")({
  component: SettingsPage,
  validateSearch: (search: Record<string, string>) => ({
    tab: search.tab as string | undefined,
  }),
  head: () => ({
    meta: [{ title: "Configurações — ARMAZIX" }],
  }),
});

const NAV_ITEMS = [
  { value: "geral",          label: "Geral",           icon: Store },
  { value: "horarios",       label: "Horários",        icon: Clock },
  { value: "personalizacao", label: "Personalização",  icon: Palette },
  { value: "entrega",        label: "Entrega",         icon: Truck },
  { value: "permissoes",     label: "Permissões",      icon: Shield },
  { value: "perfil",         label: "Perfil",          icon: User },
  { value: "planos",         label: "Planos",          icon: TrendingUp },
  { value: "auditoria",      label: "Auditoria",       icon: ShieldAlert },
] as const;

function TabFallback() {
  return (
    <div className="h-[40vh] flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  );
}

function SettingsPage() {
  const { tab: tabParam } = Route.useSearch();
  const [activeTab, setActiveTab] = useState(tabParam || "geral");
  const [store, setStore] = useState<StoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Form states
  const [storeName, setStoreName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#00C853");
  const [logoUrl, setLogoUrl] = useState("");
  const [bannerImages, setBannerImages] = useState<string[]>([]);
  const [bannerIntervalMs, setBannerIntervalMs] = useState(5000);
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");
  const [textColor, setTextColor] = useState("#0f172a");
  const [showPrice, setShowPrice] = useState(true);
  const [whatsappOrderEnabled, setWhatsappOrderEnabled] = useState(false);
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [highlightLowStock, setHighlightLowStock] = useState(false);
  const [allowNegativeStock, setAllowNegativeStock] = useState(true);
  const [layoutType, setLayoutType] = useState<'grid' | 'list'>('grid');

  // Address states
  const [addressCep, setAddressCep] = useState("");
  const [addressStreet, setAddressStreet] = useState("");
  const [addressNumber, setAddressNumber] = useState("");
  const [addressNeighborhood, setAddressNeighborhood] = useState("");
  const [addressCity, setAddressCity] = useState("");
  const [addressState, setAddressState] = useState("");
  const [addressComplement, setAddressComplement] = useState("");
  const [addressSaving, setAddressSaving] = useState(false);
  const [addressSuccess, setAddressSuccess] = useState(false);

  // Business hours states
  const [businessHours, setBusinessHours] = useState<Array<{ day: string; open: string; close: string; closed: boolean }>>([]);
  const [hoursSaving, setHoursSaving] = useState(false);
  const [hoursSuccess, setHoursSuccess] = useState(false);

  // User profile states
  const [profileName, setProfileName] = useState("");
  const [profileAvatar, setProfileAvatar] = useState("");

  // Delivery config states
  const [modalidadeEntrega, setModalidadeEntrega] = useState("todas");
  const [consumirNoLocal, setConsumirNoLocal] = useState(false);
  const [entregaUber, setEntregaUber] = useState(false);
  const [freeShippingEnabled, setFreeShippingEnabled] = useState(false);
  const [freeShippingAbove, setFreeShippingAbove] = useState("0.00");
  const [modeloCobranca, setModeloCobranca] = useState("fixa");
  const [deliveryModelConfig, setDeliveryModelConfig] = useState<DeliveryModelConfig>(DEFAULT_DELIVERY_MODEL_CONFIG);
  const [storeLat, setStoreLat] = useState<number | null>(null);
  const [storeLng, setStoreLng] = useState<number | null>(null);

  useEffect(() => {
    // Nunca confia no storeId que possa estar em cache no localStorage (pode
    // ser de uma conta anterior testada no mesmo navegador) — resolve sempre
    // pela sessão autenticada e realinha o cache a partir do resultado.
    api.get("/api/store/user").then(async (res) => {
      if (res.ok) {
        const data = await res.json() as { store?: { id: string } };
        const storeId = data.store?.id;
        if (storeId) {
          localStorage.setItem("storeId", storeId);
          fetchStore(storeId);
          return;
        }
      }
      setLoading(false);
      setError("Loja não encontrada");
    }).catch(() => {
      setLoading(false);
      setError("Loja não encontrada");
    });

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
        setBannerIntervalMs(data.store.bannerIntervalMs ?? 5000);
        // Sempre atualiza bannerImages do DB (mesmo array vazio limpa o estado)
        setBannerImages(
          (data.store.banners ?? [])
            .slice()
            .sort((a: { position: number | null }, b: { position: number | null }) => (a.position ?? 0) - (b.position ?? 0))
            .map((b: { imageUrl: string | null }) => b.imageUrl || "")
            .filter(Boolean)
        );
        setBackgroundColor(data.store.backgroundColor || "#ffffff");
        setTextColor(data.store.textColor || "#0f172a");
        setShowPrice(data.store.showPrice !== false);
        setWhatsappOrderEnabled(data.store.whatsappOrderEnabled === true);
        setWhatsappPhone(data.store.whatsappPhone || data.store.phone || "");
        setHighlightLowStock(data.store.highlightLowStock === true);
        setAllowNegativeStock(data.store.allowNegativeStock !== false);
        setLayoutType((data.store.layoutType as 'grid' | 'list') || 'grid');
        if (data.store.freeShippingAbove != null) {
          setFreeShippingEnabled(true);
          setFreeShippingAbove(data.store.freeShippingAbove);
        }
        if (data.store.latitude != null) setStoreLat(parseFloat(data.store.latitude));
        if (data.store.longitude != null) setStoreLng(parseFloat(data.store.longitude));
        if (data.store.deliveryConfig) {
          const dc = data.store.deliveryConfig;
          if (dc.modalidade) setModalidadeEntrega(dc.modalidade);
          setConsumirNoLocal(dc.consumirNoLocal === true);
          setEntregaUber(dc.entregaUber === true);
          if (dc.modeloCobranca) setModeloCobranca(dc.modeloCobranca);
          if (dc.modelConfig) {
            setDeliveryModelConfig({
              ...DEFAULT_DELIVERY_MODEL_CONFIG,
              ...dc.modelConfig,
              fixa: dc.modelConfig.fixa ?? (dc.taxaEntregaCliente ? { taxaCliente: dc.taxaEntregaCliente } : DEFAULT_DELIVERY_MODEL_CONFIG.fixa),
            });
          } else if (dc.taxaEntregaCliente) {
            setDeliveryModelConfig((prev) => ({ ...prev, fixa: { taxaCliente: dc.taxaEntregaCliente! } }));
          }
        }
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

  if (loading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="w-full animate-in fade-in duration-300">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">Gerencie sua loja, plano e preferências</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6 items-start">

          {/* Desktop sidebar nav */}
          <aside className="hidden md:flex flex-col sticky top-20">
            <TabsList className="flex flex-col w-full h-auto gap-0.5 p-1.5 rounded-2xl bg-secondary/80">
              {NAV_ITEMS.map(({ value, label, icon: Icon }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="w-full justify-start gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground
                    data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm
                    hover:bg-background/60 hover:text-foreground transition-all"
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </aside>

          {/* Content column */}
          <div className="min-w-0">
            {/* Mobile horizontal tab scroll */}
            <div className="md:hidden w-full overflow-x-auto [&::-webkit-scrollbar]:hidden mb-4" style={{ scrollbarWidth: "none" }}>
              <div className="flex gap-1 p-1.5 bg-secondary/80 rounded-2xl w-max">
                {NAV_ITEMS.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() => setActiveTab(value)}
                    className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium whitespace-nowrap transition-all ${
                      activeTab === value
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <TabsContent value="geral" className="mt-0 space-y-6">
              <Suspense fallback={<TabFallback />}>
                <GeralTab
                  store={store} setStore={setStore}
                  storeName={storeName} setStoreName={setStoreName}
                  ownerName={ownerName} setOwnerName={setOwnerName}
                  description={description} setDescription={setDescription}
                  phone={phone} setPhone={setPhone}
                  email={email} setEmail={setEmail}
                  primaryColor={primaryColor}
                  setError={setError}
                  addressCep={addressCep} setAddressCep={setAddressCep}
                  addressStreet={addressStreet} setAddressStreet={setAddressStreet}
                  addressNumber={addressNumber} setAddressNumber={setAddressNumber}
                  addressNeighborhood={addressNeighborhood} setAddressNeighborhood={setAddressNeighborhood}
                  addressCity={addressCity} setAddressCity={setAddressCity}
                  addressState={addressState} setAddressState={setAddressState}
                  addressComplement={addressComplement} setAddressComplement={setAddressComplement}
                  addressSaving={addressSaving} setAddressSaving={setAddressSaving}
                  addressSuccess={addressSuccess} setAddressSuccess={setAddressSuccess}
                />
              </Suspense>
            </TabsContent>

            <TabsContent value="horarios" className="mt-0 space-y-6">
              <Suspense fallback={<TabFallback />}>
                <HorariosTab
                  store={store}
                  businessHours={businessHours} setBusinessHours={setBusinessHours}
                  hoursSaving={hoursSaving} setHoursSaving={setHoursSaving}
                  hoursSuccess={hoursSuccess} setHoursSuccess={setHoursSuccess}
                  setError={setError}
                />
              </Suspense>
            </TabsContent>

            <TabsContent value="personalizacao" className="mt-0 space-y-6">
              <Suspense fallback={<TabFallback />}>
                <PersonalizacaoTab
                  store={store} setStore={setStore}
                  logoUrl={logoUrl} setLogoUrl={setLogoUrl}
                  bannerImages={bannerImages} setBannerImages={setBannerImages}
                  bannerIntervalMs={bannerIntervalMs} setBannerIntervalMs={setBannerIntervalMs}
                  primaryColor={primaryColor} setPrimaryColor={setPrimaryColor}
                  backgroundColor={backgroundColor} setBackgroundColor={setBackgroundColor}
                  textColor={textColor} setTextColor={setTextColor}
                  layoutType={layoutType} setLayoutType={setLayoutType}
                  showPrice={showPrice} setShowPrice={setShowPrice}
                  whatsappOrderEnabled={whatsappOrderEnabled} setWhatsappOrderEnabled={setWhatsappOrderEnabled}
                  whatsappPhone={whatsappPhone} setWhatsappPhone={setWhatsappPhone}
                  highlightLowStock={highlightLowStock} setHighlightLowStock={setHighlightLowStock}
                />
              </Suspense>
            </TabsContent>

            {/* ── Entrega ──────────────────────────────────────────────────── */}
            <TabsContent value="entrega" className="mt-0 space-y-6">
              <Suspense fallback={<TabFallback />}>
                <EntregaTab
                  store={store}
                  modalidadeEntrega={modalidadeEntrega} setModalidadeEntrega={setModalidadeEntrega}
                  consumirNoLocal={consumirNoLocal} setConsumirNoLocal={setConsumirNoLocal}
                  entregaUber={entregaUber} setEntregaUber={setEntregaUber}
                  freeShippingEnabled={freeShippingEnabled} setFreeShippingEnabled={setFreeShippingEnabled}
                  freeShippingAbove={freeShippingAbove} setFreeShippingAbove={setFreeShippingAbove}
                  modeloCobranca={modeloCobranca} setModeloCobranca={setModeloCobranca}
                  deliveryModelConfig={deliveryModelConfig} setDeliveryModelConfig={setDeliveryModelConfig}
                  storeLat={storeLat} setStoreLat={setStoreLat}
                  storeLng={storeLng} setStoreLng={setStoreLng}
                />
              </Suspense>
            </TabsContent>

            <TabsContent value="perfil" className="mt-0 space-y-6">
              <Suspense fallback={<TabFallback />}>
                <PerfilTab
                  store={store} setStore={setStore}
                  profileName={profileName} setProfileName={setProfileName}
                  profileAvatar={profileAvatar} setProfileAvatar={setProfileAvatar}
                  highlightLowStock={highlightLowStock} setHighlightLowStock={setHighlightLowStock}
                  allowNegativeStock={allowNegativeStock} setAllowNegativeStock={setAllowNegativeStock}
                />
              </Suspense>
            </TabsContent>

            <TabsContent value="planos" className="mt-0">
              <Suspense fallback={<TabFallback />}>
                <PlansSection />
              </Suspense>
            </TabsContent>

            <TabsContent value="auditoria" className="mt-0">
              <Suspense fallback={<TabFallback />}>
                <AuditoriaSection />
              </Suspense>
            </TabsContent>

            <TabsContent value="permissoes" className="mt-0">
              <Suspense fallback={<TabFallback />}>
                <PermissionsTab />
              </Suspense>
            </TabsContent>

          </div>{/* /content column */}
        </div>{/* /grid */}
      </Tabs>
    </div>
  );
}
