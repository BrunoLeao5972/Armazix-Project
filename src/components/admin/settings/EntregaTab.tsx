import { useState } from "react";
import { Truck, CreditCard, Check, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api-client";
import { DeliveryPricingConfig, StoreLocationPicker } from "@/components/admin/DeliveryPricingConfig";
import type { DeliveryModelConfig } from "@/components/admin/DeliveryPricingConfig";
import type { StoreData } from "./types";

const GEO_MODELS = ["dinamica", "raio", "bairro", "matriz"];

const DELIVERY_MODELS = [
  { key: "fixa",       label: "Taxa Fixa",    sub: "Valor único"          },
  { key: "dinamica",   label: "Dinâmica",     sub: "Por distância"        },
  { key: "bairro",     label: "Por Bairro",   sub: "Área específica"      },
  { key: "raio",       label: "Raio",         sub: "Círculos no mapa"     },
  { key: "matriz",     label: "Matriz",       sub: "Faixas de distância"  },
  { key: "bairroFixo", label: "Bairro Fixo",  sub: "Valor por bairro"     },
] as const;

interface EntregaTabProps {
  store: StoreData | null;
  modalidadeEntrega: string; setModalidadeEntrega: (v: string) => void;
  consumirNoLocal: boolean; setConsumirNoLocal: (v: boolean) => void;
  entregaUber: boolean; setEntregaUber: (v: boolean) => void;
  freeShippingEnabled: boolean; setFreeShippingEnabled: (v: boolean) => void;
  freeShippingAbove: string; setFreeShippingAbove: (v: string) => void;
  modeloCobranca: string; setModeloCobranca: (v: string) => void;
  deliveryModelConfig: DeliveryModelConfig; setDeliveryModelConfig: (v: DeliveryModelConfig) => void;
  storeLat: number | null; setStoreLat: (v: number | null) => void;
  storeLng: number | null; setStoreLng: (v: number | null) => void;
}

export function EntregaTab({
  store, modalidadeEntrega, setModalidadeEntrega, consumirNoLocal, setConsumirNoLocal,
  entregaUber, setEntregaUber, freeShippingEnabled, setFreeShippingEnabled,
  freeShippingAbove, setFreeShippingAbove, modeloCobranca, setModeloCobranca,
  deliveryModelConfig, setDeliveryModelConfig, storeLat, setStoreLat, storeLng, setStoreLng,
}: EntregaTabProps) {
  const [deliverySaving, setDeliverySaving] = useState(false);
  const [deliverySuccess, setDeliverySuccess] = useState(false);
  const [deliveryError, setDeliveryError] = useState("");

  const handleSaveDelivery = async () => {
    if (!store) return;
    setDeliverySaving(true);
    setDeliverySuccess(false);
    setDeliveryError("");
    try {
      const res = await api.post("/api/store/update", {
        storeId: store.id,
        deliveryConfig: {
          modalidade: modalidadeEntrega,
          consumirNoLocal,
          entregaUber,
          modeloCobranca,
          taxaEntregaCliente: deliveryModelConfig.fixa.taxaCliente,
          modelConfig: deliveryModelConfig,
        },
        freeShippingAbove: freeShippingEnabled ? freeShippingAbove : null,
        latitude: storeLat,
        longitude: storeLng,
      });
      const data = await res.json();
      if (res.ok) {
        setDeliverySuccess(true);
        setTimeout(() => setDeliverySuccess(false), 3000);
      } else {
        setDeliveryError((data as { error?: string }).error || "Erro ao salvar");
      }
    } catch {
      setDeliveryError("Erro de conexão");
    } finally {
      setDeliverySaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Seção 1: Tipo de Entrega */}
      <Card className="rounded-2xl border-border/50 shadow-soft">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Truck className="w-4 h-4" />
            Tipo de Entrega
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>Modalidade</Label>
            <Select value={modalidadeEntrega} onValueChange={setModalidadeEntrega}>
              <SelectTrigger className="h-11 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas (Delivery + Retirada no Local)</SelectItem>
                <SelectItem value="delivery">Apenas Delivery</SelectItem>
                <SelectItem value="retirada">Apenas Retirada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Consumir no Local */}
          <label className="flex items-start gap-4 p-4 rounded-xl border border-border/50 cursor-pointer hover:border-primary/30 hover:bg-secondary/20 transition-colors select-none">
            <Checkbox
              checked={consumirNoLocal}
              onCheckedChange={(v) => setConsumirNoLocal(v === true)}
              className="mt-0.5 shrink-0"
            />
            <div>
              <div className="text-sm font-medium">Habilitar Consumir no Local</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                A opção 'Consumir no Local' aparecerá no app para o cliente.
              </div>
            </div>
          </label>

          {/* Entrega pelo Uber */}
          <label className="flex items-start gap-4 p-4 rounded-xl border border-border/50 cursor-pointer hover:border-primary/30 hover:bg-secondary/20 transition-colors select-none">
            <Checkbox
              checked={entregaUber}
              onCheckedChange={(v) => setEntregaUber(v === true)}
              className="mt-0.5 shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">Entrega pelo Uber</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black tracking-tight bg-black text-white dark:bg-white dark:text-black">
                  UBER
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Mostra no app que a entrega será feita pelo Uber. A taxa de entrega do cliente fica zerada e os valores serão contabilizados fora da plataforma.
              </div>
            </div>
          </label>

          {/* Frete Grátis acima de */}
          <div
            className={[
              "rounded-xl border transition-colors",
              freeShippingEnabled
                ? "border-primary/30 bg-primary/5"
                : "border-border/50 hover:border-primary/30 hover:bg-secondary/20",
            ].join(" ")}
          >
            <label className="flex items-start gap-4 p-4 cursor-pointer select-none">
              <Checkbox
                checked={freeShippingEnabled}
                onCheckedChange={(v) => setFreeShippingEnabled(v === true)}
                className="mt-0.5 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">Frete grátis acima de</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Pedidos acima do valor definido não cobram taxa de entrega.
                </div>
              </div>
            </label>
            {freeShippingEnabled && (
              <div className="px-4 pb-4">
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-sm text-muted-foreground select-none">R$</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={freeShippingAbove}
                    onChange={(e) => setFreeShippingAbove(e.target.value)}
                    placeholder="0.00"
                    className="h-11 rounded-xl pl-9"
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Seção 2: Modelo de Cobrança */}
      <Card className="rounded-2xl border-border/50 shadow-soft">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            Modelo de Cobrança
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Selecione como a taxa de entrega será calculada.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {DELIVERY_MODELS.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setModeloCobranca(m.key)}
                className={[
                  "flex flex-col items-start gap-1 p-4 rounded-xl border text-left transition-all",
                  modeloCobranca === m.key
                    ? "border-primary bg-primary/5 ring-1 ring-primary/20 shadow-glow"
                    : "border-border/50 bg-background hover:border-primary/30 hover:bg-secondary/20",
                ].join(" ")}
              >
                <span className="text-sm font-semibold">{m.label}</span>
                <span className="text-xs text-muted-foreground">{m.sub}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Seção 3: Localização da loja — só relevante pros modelos por distância */}
      {GEO_MODELS.includes(modeloCobranca) && (
        <StoreLocationPicker
          lat={storeLat}
          lng={storeLng}
          onChange={(lat, lng) => { setStoreLat(lat); setStoreLng(lng); }}
          onLocateFromAddress={async () => {
            const res = await api.post("/api/store/geocode-address", {});
            if (!res.ok) return null;
            const data = await res.json() as { lat: number; lng: number };
            return data;
          }}
        />
      )}

      {/* Seção 4: Configuração do modelo selecionado */}
      <Card className="rounded-2xl border-border/50 shadow-soft animate-in fade-in duration-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">
            {DELIVERY_MODELS.find((m) => m.key === modeloCobranca)?.label ?? "Configuração"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <DeliveryPricingConfig
            model={modeloCobranca}
            value={deliveryModelConfig}
            onChange={setDeliveryModelConfig}
            storeLat={storeLat}
            storeLng={storeLng}
          />
        </CardContent>
      </Card>

      {deliveryError && <p className="text-sm text-destructive">{deliveryError}</p>}
      {deliverySuccess && (
        <div className="flex items-center gap-2 text-sm text-green-600">
          <Check className="w-4 h-4" />
          Configurações de entrega salvas com sucesso!
        </div>
      )}
      <Button
        onClick={handleSaveDelivery}
        disabled={deliverySaving}
        className="h-10 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow"
      >
        {deliverySaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar configurações"}
      </Button>
    </div>
  );
}
