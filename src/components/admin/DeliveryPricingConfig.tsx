import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, Plus, Trash2, MapPin, Loader2 } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FixaSettings {
  taxaCliente: string;
}

export interface DinamicaSettings {
  taxaBasica: string;
  distanciaBase: string;
  valorPorKmAdicional: string;
}

export interface BairroDesenhoSettings {
  poligonos: Array<Array<[number, number]>>;
  tipoCobranca: "fixa" | "fixa_variavel";
  valorFixo: string;
  valorPorKm: string;
}

export interface RaioItem {
  id: string;
  raioMetros: number;
  tipoCobranca: "fixa" | "fixa_variavel";
  valorFixo: string;
  valorPorKm: string;
}

export interface RaioSettings {
  storeLat: number;
  storeLng: number;
  raios: RaioItem[];
}

export interface MatrizFaixa {
  id: string;
  de: number;
  ate: number;
  valor: string;
}

export interface BairroFixoItem {
  id: string;
  nome: string;
  valor: string;
  ativo: boolean;
}

export interface BairroFixoSettings {
  uf: string;
  codigoCidade: string;
  nomeCidade: string;
  bairros: BairroFixoItem[];
}

export interface DeliveryModelConfig {
  fixa: FixaSettings;
  dinamica: DinamicaSettings;
  bairroDesenho: BairroDesenhoSettings;
  raio: RaioSettings;
  matriz: MatrizFaixa[];
  bairroFixo: BairroFixoSettings;
}

export const DEFAULT_DELIVERY_MODEL_CONFIG: DeliveryModelConfig = {
  fixa: { taxaCliente: "0.00" },
  dinamica: { taxaBasica: "0.00", distanciaBase: "5", valorPorKmAdicional: "1.50" },
  bairroDesenho: { poligonos: [], tipoCobranca: "fixa", valorFixo: "0.00", valorPorKm: "0.00" },
  raio: { storeLat: -23.5505, storeLng: -46.6333, raios: [] },
  matriz: [{ id: crypto.randomUUID(), de: 0, ate: 1000, valor: "0.00" }],
  bairroFixo: { uf: "", codigoCidade: "", nomeCidade: "", bairros: [] },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function InfoBanner({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3 p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 text-blue-700 dark:text-blue-400">
      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
      <p className="text-sm">{text}</p>
    </div>
  );
}

function NumInput({
  label,
  hint,
  value,
  onChange,
  prefix,
  suffix,
  min = "0",
  step = "0.01",
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  prefix?: string;
  suffix?: string;
  min?: string;
  step?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      <div className="relative flex items-center">
        {prefix && (
          <span className="absolute left-3 text-sm text-muted-foreground select-none">{prefix}</span>
        )}
        <Input
          type="number"
          min={min}
          step={step}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`h-11 rounded-xl ${prefix ? "pl-8" : ""} ${suffix ? "pr-12" : ""}`}
        />
        {suffix && (
          <span className="absolute right-3 text-sm text-muted-foreground select-none">{suffix}</span>
        )}
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ─── Taxa Fixa ────────────────────────────────────────────────────────────────

function TaxaFixaConfig({
  value,
  onChange,
}: {
  value: FixaSettings;
  onChange: (v: FixaSettings) => void;
}) {
  return (
    <div className="space-y-4">
      <InfoBanner text="Defina um valor fixo cobrado em todas as entregas, independente da distância." />
      <NumInput
        label="Taxa de entrega — Cliente (R$)"
        hint="Valor cobrado do cliente no momento do pedido."
        value={value.taxaCliente}
        onChange={(v) => onChange({ ...value, taxaCliente: v })}
        prefix="R$"
      />
    </div>
  );
}

// ─── Dinâmica ─────────────────────────────────────────────────────────────────

function DinamicaConfig({
  value,
  onChange,
}: {
  value: DinamicaSettings;
  onChange: (v: DinamicaSettings) => void;
}) {
  return (
    <div className="space-y-4">
      <InfoBanner text="A taxa é calculada automaticamente com base na distância entre o estabelecimento e o endereço do cliente." />
      <div className="grid gap-4 sm:grid-cols-3">
        <NumInput
          label="Taxa base (R$)"
          hint="Valor para a distância base."
          value={value.taxaBasica}
          onChange={(v) => onChange({ ...value, taxaBasica: v })}
          prefix="R$"
        />
        <NumInput
          label="Distância base (km)"
          hint="Km incluídos na taxa base."
          value={value.distanciaBase}
          onChange={(v) => onChange({ ...value, distanciaBase: v })}
          suffix="km"
          step="0.5"
        />
        <NumInput
          label="Valor por km adicional"
          hint="R$ cobrado por km além da base."
          value={value.valorPorKmAdicional}
          onChange={(v) => onChange({ ...value, valorPorKmAdicional: v })}
          prefix="R$"
        />
      </div>
      <div className="p-3.5 rounded-xl bg-secondary/30 border border-border/50">
        <p className="text-xs text-muted-foreground leading-relaxed">
          <strong>Fórmula:</strong> Taxa = Taxa base + (km − distância base) × valor por km adicional
        </p>
      </div>
    </div>
  );
}

// ─── Por Bairro — Mapa com desenho de polígono ────────────────────────────────

function BairroMapConfig({
  value,
  onChange,
}: {
  value: BairroDesenhoSettings;
  onChange: (v: BairroDesenhoSettings) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const drawnLayersRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current || typeof window === "undefined") return;

    let cancelled = false;

    const init = async () => {
      // Inject Leaflet CSS
      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }
      if (!document.getElementById("leaflet-draw-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-draw-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.css";
        document.head.appendChild(link);
      }

      const L = (await import("leaflet")).default;
      // @ts-ignore
      const LD = await import("leaflet-draw");
      void LD;

      if (cancelled || !containerRef.current) return;

      // Fix default icon paths
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(containerRef.current, { center: [-15.7801, -47.9292], zoom: 4 });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);

      const drawnItems = new L.FeatureGroup();
      map.addLayer(drawnItems);

      // Load existing polygons
      if (value.poligonos.length > 0) {
        value.poligonos.forEach((coords) => {
          const poly = L.polygon(coords as [number, number][]);
          drawnItems.addLayer(poly);
        });
        try { map.fitBounds(drawnItems.getBounds()); } catch {}
      }

      // @ts-ignore
      const drawControl = new L.Control.Draw({
        edit: { featureGroup: drawnItems },
        draw: { polygon: {}, polyline: false, rectangle: false, circle: false, marker: false, circlemarker: false },
      });
      map.addControl(drawControl);

      const collectPolygons = () => {
        const polys: Array<Array<[number, number]>> = [];
        drawnItems.eachLayer((layer: any) => {
          if (layer.getLatLngs) {
            const coords = (layer.getLatLngs() as any[][])[0]?.map((ll: any) => [ll.lat, ll.lng] as [number, number]);
            if (coords) polys.push(coords);
          }
        });
        return polys;
      };

      map.on("draw:created", (e: any) => {
        drawnItems.addLayer(e.layer);
        onChange({ ...value, poligonos: collectPolygons() });
      });
      map.on("draw:edited", () => onChange({ ...value, poligonos: collectPolygons() }));
      map.on("draw:deleted", () => onChange({ ...value, poligonos: collectPolygons() }));

      mapRef.current = map;
      leafletRef.current = L;
      drawnLayersRef.current = drawnItems;
      setMapReady(true);
    };

    void init();
    return () => {
      cancelled = true;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <InfoBanner text="Desenhe no mapa a área de cobertura de entrega. Use o ícone de polígono na barra de ferramentas para traçar os limites." />
      <div
        ref={containerRef}
        className="w-full rounded-xl overflow-hidden border border-border/50"
        style={{ height: 380 }}
      />
      {!mapReady && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando mapa…
        </div>
      )}
      {value.poligonos.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {value.poligonos.length} polígono(s) desenhado(s)
        </p>
      )}
      <div className="space-y-3 pt-2">
        <div className="space-y-1.5">
          <Label className="text-sm">Tipo de cobrança na área</Label>
          <Select
            value={value.tipoCobranca}
            onValueChange={(v) => onChange({ ...value, tipoCobranca: v as "fixa" | "fixa_variavel" })}
          >
            <SelectTrigger className="h-11 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fixa">Taxa fixa</SelectItem>
              <SelectItem value="fixa_variavel">Taxa fixa + por km adicional</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <NumInput
            label="Valor fixo (R$)"
            value={value.valorFixo}
            onChange={(v) => onChange({ ...value, valorFixo: v })}
            prefix="R$"
          />
          {value.tipoCobranca === "fixa_variavel" && (
            <NumInput
              label="Valor por km adicional"
              value={value.valorPorKm}
              onChange={(v) => onChange({ ...value, valorPorKm: v })}
              prefix="R$"
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Por Raio ─────────────────────────────────────────────────────────────────

function RaioMapConfig({
  value,
  onChange,
}: {
  value: RaioSettings;
  onChange: (v: RaioSettings) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const circlesRef = useRef<any[]>([]);
  const leafletRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);

  const redrawCircles = (L: any, map: any, raios: RaioItem[], lat: number, lng: number) => {
    circlesRef.current.forEach((c) => c.remove());
    circlesRef.current = raios.map((r, i) => {
      const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];
      return L.circle([lat, lng], {
        radius: r.raioMetros,
        color: colors[i % colors.length],
        fillOpacity: 0.1,
        weight: 2,
      }).addTo(map);
    });
  };

  useEffect(() => {
    if (!containerRef.current || typeof window === "undefined") return;
    let cancelled = false;

    const init = async () => {
      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }

      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current) return;

      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(containerRef.current, {
        center: [value.storeLat, value.storeLng],
        zoom: 13,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);

      const marker = L.marker([value.storeLat, value.storeLng], { draggable: true }).addTo(map);
      marker.bindPopup("Arraste para a localização do seu estabelecimento").openPopup();
      marker.on("dragend", () => {
        const { lat, lng } = marker.getLatLng();
        onChange({ ...value, storeLat: lat, storeLng: lng });
        redrawCircles(L, map, value.raios, lat, lng);
      });

      markerRef.current = marker;
      mapRef.current = map;
      leafletRef.current = L;
      redrawCircles(L, map, value.raios, value.storeLat, value.storeLng);
      setMapReady(true);
    };

    void init();
    return () => {
      cancelled = true;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-draw circles when raios change after init
  useEffect(() => {
    if (!mapRef.current || !leafletRef.current) return;
    redrawCircles(leafletRef.current, mapRef.current, value.raios, value.storeLat, value.storeLng);
  }, [value.raios, value.storeLat, value.storeLng]); // eslint-disable-line react-hooks/exhaustive-deps

  const addRaio = () => {
    const newRaio: RaioItem = {
      id: crypto.randomUUID(),
      raioMetros: (value.raios[value.raios.length - 1]?.raioMetros ?? 0) + 2000,
      tipoCobranca: "fixa",
      valorFixo: "0.00",
      valorPorKm: "0.00",
    };
    onChange({ ...value, raios: [...value.raios, newRaio] });
  };

  const updateRaio = (id: string, patch: Partial<RaioItem>) => {
    onChange({ ...value, raios: value.raios.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  };

  const removeRaio = (id: string) => {
    onChange({ ...value, raios: value.raios.filter((r) => r.id !== id) });
  };

  return (
    <div className="space-y-4">
      <InfoBanner text="Defina círculos concêntricos ao redor do seu estabelecimento com taxas diferentes por raio. Arraste o marcador no mapa para a localização correta." />
      <div
        ref={containerRef}
        className="w-full rounded-xl overflow-hidden border border-border/50"
        style={{ height: 340 }}
      />
      {!mapReady && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando mapa…
        </div>
      )}

      <div className="space-y-3 pt-1">
        {value.raios.map((r, i) => {
          const colors = ["bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-red-500", "bg-violet-500"];
          return (
            <div key={r.id} className="p-4 rounded-xl border border-border/50 bg-background space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${colors[i % colors.length]}`} />
                  <span className="text-sm font-medium">Raio {i + 1}</span>
                </div>
                <button type="button" onClick={() => removeRaio(r.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <NumInput
                  label="Raio (metros)"
                  value={String(r.raioMetros)}
                  onChange={(v) => updateRaio(r.id, { raioMetros: Math.max(0, parseInt(v) || 0) })}
                  suffix="m"
                  step="100"
                  min="100"
                />
                <div className="space-y-1.5">
                  <Label className="text-sm">Tipo de cobrança</Label>
                  <Select
                    value={r.tipoCobranca}
                    onValueChange={(v) => updateRaio(r.id, { tipoCobranca: v as "fixa" | "fixa_variavel" })}
                  >
                    <SelectTrigger className="h-11 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixa">Taxa fixa</SelectItem>
                      <SelectItem value="fixa_variavel">Fixa + por km</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <NumInput
                  label="Valor fixo (R$)"
                  value={r.valorFixo}
                  onChange={(v) => updateRaio(r.id, { valorFixo: v })}
                  prefix="R$"
                />
                {r.tipoCobranca === "fixa_variavel" && (
                  <NumInput
                    label="Por km adicional (R$)"
                    value={r.valorPorKm}
                    onChange={(v) => updateRaio(r.id, { valorPorKm: v })}
                    prefix="R$"
                  />
                )}
              </div>
            </div>
          );
        })}
        <Button type="button" variant="outline" size="sm" onClick={addRaio} className="rounded-xl gap-2 w-full">
          <Plus className="w-4 h-4" /> Adicionar raio
        </Button>
      </div>
    </div>
  );
}

// ─── Matriz de Distâncias ─────────────────────────────────────────────────────

function MatrizConfig({
  value,
  onChange,
}: {
  value: MatrizFaixa[];
  onChange: (v: MatrizFaixa[]) => void;
}) {
  const addFaixa = () => {
    const last = value[value.length - 1];
    onChange([
      ...value,
      { id: crypto.randomUUID(), de: last?.ate ?? 0, ate: (last?.ate ?? 0) + 1000, valor: "0.00" },
    ]);
  };

  const update = (id: string, patch: Partial<MatrizFaixa>) => {
    onChange(value.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };

  const remove = (id: string) => {
    if (value.length <= 1) return;
    onChange(value.filter((f) => f.id !== id));
  };

  return (
    <div className="space-y-4">
      <InfoBanner text="Configure faixas de distância com valores de entrega distintos. Distâncias fora das faixas definidas podem ser bloqueadas ou cobradas pela última faixa." />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground border-b border-border/50">
              <th className="text-left py-2 pr-3 font-medium">De (m)</th>
              <th className="text-left py-2 pr-3 font-medium">Até (m)</th>
              <th className="text-left py-2 pr-3 font-medium">Taxa (R$)</th>
              <th className="py-2 w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {value.map((f, i) => (
              <tr key={f.id}>
                <td className="py-2 pr-3">
                  <Input
                    type="number"
                    min="0"
                    value={f.de}
                    onChange={(e) => update(f.id, { de: Math.max(0, parseInt(e.target.value) || 0) })}
                    className="h-9 rounded-lg w-28"
                    disabled={i === 0}
                  />
                </td>
                <td className="py-2 pr-3">
                  <Input
                    type="number"
                    min={f.de + 1}
                    value={f.ate}
                    onChange={(e) => update(f.id, { ate: Math.max(f.de + 1, parseInt(e.target.value) || 0) })}
                    className="h-9 rounded-lg w-28"
                  />
                </td>
                <td className="py-2 pr-3">
                  <div className="relative flex items-center">
                    <span className="absolute left-2.5 text-xs text-muted-foreground">R$</span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={f.valor}
                      onChange={(e) => update(f.id, { valor: e.target.value })}
                      className="h-9 rounded-lg pl-8 w-28"
                    />
                  </div>
                </td>
                <td className="py-2">
                  <button
                    type="button"
                    onClick={() => remove(f.id)}
                    disabled={value.length <= 1}
                    className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-30"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={addFaixa} className="rounded-xl gap-2">
        <Plus className="w-4 h-4" /> Adicionar faixa
      </Button>
    </div>
  );
}

// ─── Bairro Fixo ──────────────────────────────────────────────────────────────

const BRASIL_UFS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

function BairroFixoConfig({
  value,
  onChange,
}: {
  value: BairroFixoSettings;
  onChange: (v: BairroFixoSettings) => void;
}) {
  const [cidades, setCidades] = useState<{ nome: string; codigo_ibge: string }[]>([]);
  const [loadingCidades, setLoadingCidades] = useState(false);
  const [loadingDistritos, setLoadingDistritos] = useState(false);
  const [batchValor, setBatchValor] = useState("0.00");

  const fetchCidades = async (uf: string) => {
    setLoadingCidades(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/ibge/municipios/v1/${uf}`);
      const data = await res.json() as { nome: string; codigo_ibge: string }[];
      setCidades(data.sort((a, b) => a.nome.localeCompare(b.nome)));
    } catch {
      setCidades([]);
    } finally {
      setLoadingCidades(false);
    }
  };

  const fetchDistritos = async (codigoCidade: string, nomeCidade: string) => {
    setLoadingDistritos(true);
    try {
      const res = await fetch(
        `https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${codigoCidade}/subdistrito`
      );
      const data = await res.json() as { nome: string; id: number }[];
      const bairros: BairroFixoItem[] = data.map((d) => ({
        id: String(d.id),
        nome: d.nome,
        valor: "0.00",
        ativo: true,
      }));
      onChange({ ...value, codigoCidade, nomeCidade, bairros: bairros.length > 0 ? bairros : [] });
    } catch {
      onChange({ ...value, codigoCidade, nomeCidade, bairros: [] });
    } finally {
      setLoadingDistritos(false);
    }
  };

  const updateBairro = (id: string, patch: Partial<BairroFixoItem>) => {
    onChange({ ...value, bairros: value.bairros.map((b) => (b.id === id ? { ...b, ...patch } : b)) });
  };

  const addBairro = () => {
    onChange({
      ...value,
      bairros: [...value.bairros, { id: crypto.randomUUID(), nome: "", valor: "0.00", ativo: true }],
    });
  };

  const applyBatch = () => {
    onChange({ ...value, bairros: value.bairros.map((b) => ({ ...b, valor: batchValor })) });
  };

  return (
    <div className="space-y-4">
      <InfoBanner text="Selecione o estado e a cidade para carregar os distritos. Defina o valor de entrega por bairro individualmente ou em lote." />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-sm">Estado (UF)</Label>
          <Select
            value={value.uf}
            onValueChange={(uf) => {
              onChange({ ...value, uf, codigoCidade: "", nomeCidade: "", bairros: [] });
              setCidades([]);
              fetchCidades(uf);
            }}
          >
            <SelectTrigger className="h-11 rounded-xl">
              <SelectValue placeholder="Selecione…" />
            </SelectTrigger>
            <SelectContent>
              {BRASIL_UFS.map((uf) => (
                <SelectItem key={uf} value={uf}>{uf}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm">Cidade</Label>
          <Select
            value={value.codigoCidade}
            disabled={!value.uf || loadingCidades}
            onValueChange={(codigo) => {
              const cidade = cidades.find((c) => c.codigo_ibge === codigo);
              if (cidade) fetchDistritos(codigo, cidade.nome);
            }}
          >
            <SelectTrigger className="h-11 rounded-xl">
              <SelectValue placeholder={loadingCidades ? "Carregando…" : "Selecione…"} />
            </SelectTrigger>
            <SelectContent>
              {cidades.map((c) => (
                <SelectItem key={c.codigo_ibge} value={c.codigo_ibge}>{c.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {value.codigoCidade && (
        <>
          {loadingDistritos ? (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-6">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando bairros…
            </div>
          ) : (
            <div className="space-y-3">
              {/* Batch price */}
              <div className="flex items-end gap-3 p-3.5 rounded-xl bg-secondary/30 border border-border/50">
                <NumInput
                  label="Aplicar valor em lote"
                  value={batchValor}
                  onChange={setBatchValor}
                  prefix="R$"
                />
                <Button type="button" variant="outline" size="sm" onClick={applyBatch} className="rounded-xl mb-0.5 shrink-0">
                  Aplicar a todos
                </Button>
              </div>

              {/* Bairro list */}
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {value.bairros.map((b) => (
                  <div key={b.id} className="flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-background">
                    <Switch
                      checked={b.ativo}
                      onCheckedChange={(v) => updateBairro(b.id, { ativo: v })}
                      className="shrink-0"
                    />
                    <Input
                      value={b.nome}
                      onChange={(e) => updateBairro(b.id, { nome: e.target.value })}
                      placeholder="Nome do bairro"
                      className="h-9 rounded-lg flex-1"
                    />
                    <div className="relative flex items-center shrink-0">
                      <span className="absolute left-2.5 text-xs text-muted-foreground">R$</span>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={b.valor}
                        onChange={(e) => updateBairro(b.id, { valor: e.target.value })}
                        disabled={!b.ativo}
                        className="h-9 rounded-lg pl-8 w-28"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addBairro} className="rounded-xl gap-2 w-full">
                <Plus className="w-4 h-4" /> Adicionar bairro manualmente
              </Button>
            </div>
          )}
        </>
      )}

      {!value.codigoCidade && (
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
          <MapPin className="w-8 h-8 opacity-30" />
          <p className="text-sm">Selecione o estado e a cidade para configurar os bairros.</p>
        </div>
      )}
    </div>
  );
}

// ─── Main Switch Component ────────────────────────────────────────────────────

type ModelKey = "fixa" | "dinamica" | "bairro" | "raio" | "matriz" | "bairroFixo";

export function DeliveryPricingConfig({
  model,
  value,
  onChange,
}: {
  model: string;
  value: DeliveryModelConfig;
  onChange: (v: DeliveryModelConfig) => void;
}) {
  const modelKey = model as ModelKey;

  if (modelKey === "fixa") {
    return (
      <TaxaFixaConfig
        value={value.fixa}
        onChange={(v) => onChange({ ...value, fixa: v })}
      />
    );
  }
  if (modelKey === "dinamica") {
    return (
      <DinamicaConfig
        value={value.dinamica}
        onChange={(v) => onChange({ ...value, dinamica: v })}
      />
    );
  }
  if (modelKey === "bairro") {
    return (
      <BairroMapConfig
        value={value.bairroDesenho}
        onChange={(v) => onChange({ ...value, bairroDesenho: v })}
      />
    );
  }
  if (modelKey === "raio") {
    return (
      <RaioMapConfig
        value={value.raio}
        onChange={(v) => onChange({ ...value, raio: v })}
      />
    );
  }
  if (modelKey === "matriz") {
    return (
      <MatrizConfig
        value={value.matriz}
        onChange={(v) => onChange({ ...value, matriz: v })}
      />
    );
  }
  if (modelKey === "bairroFixo") {
    return (
      <BairroFixoConfig
        value={value.bairroFixo}
        onChange={(v) => onChange({ ...value, bairroFixo: v })}
      />
    );
  }
  return null;
}
